import { randomUUID } from "node:crypto";
import type { PrismaService } from "../../src/core/prisma/prisma.service.js";

type Row = Record<string, unknown>;
type Where = Row;

/** A filter of the kind `{ lt: value }` or `{ not: null }`. */
function isFilter(value: unknown): value is Row {
  return (
    value !== null &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    Object.keys(value).every((key) => key === "lt" || key === "not")
  );
}

/** A minimal in-memory stand-in for the tables the unit tests use. */
class Table {
  rows: Row[] = [];

  constructor(private readonly unique: string[]) {}

  private match(row: Row, where: Where): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (key === "OR") return (value as Where[]).some((part) => this.match(row, part));
      if (isFilter(value)) {
        if ("lt" in value) {
          const field = row[key];
          const bound = value.lt;
          if (field instanceof Date && bound instanceof Date) return field < bound;
          return typeof field === "number" && typeof bound === "number" && field < bound;
        }
        return row[key] !== null && row[key] !== undefined;
      }
      // A compound key (userId_date) names several columns.
      if (value !== null && typeof value === "object")
        return Object.entries(value).every(([column, wanted]) => row[column] === wanted);
      if (value === null) return row[key] === null || row[key] === undefined;
      return row[key] === value;
    });
  }

  async findUnique({ where }: { where: Where }): Promise<Row | null> {
    return this.rows.find((row) => this.match(row, where)) ?? null;
  }

  async findFirst({ where }: { where: Where }): Promise<Row | null> {
    return this.findUnique({ where });
  }

  /** The matching rows as copies, sorted by the one column `orderBy` may name. */
  async findMany({
    where = {},
    orderBy,
  }: {
    where?: Where;
    orderBy?: Record<string, "asc" | "desc">;
  }): Promise<Row[]> {
    const rows = this.rows.filter((row) => this.match(row, where)).map((row) => ({ ...row }));
    const [column, direction] = Object.entries(orderBy ?? {})[0] ?? [];
    if (!column) return rows;
    return rows.sort(
      (a, b) =>
        (String(a[column]) < String(b[column])
          ? -1
          : String(a[column]) > String(b[column])
            ? 1
            : 0) * (direction === "desc" ? -1 : 1),
    );
  }

  async create({ data }: { data: Row }): Promise<Row> {
    for (const key of this.unique) {
      if (this.rows.some((row) => row[key] === data[key])) {
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }
    }
    const row = { id: randomUUID(), createdAt: new Date(), revokedAt: null, ...data };
    this.rows.push(row);
    return row;
  }

  async update({ where, data }: { where: Row; data: Row }): Promise<Row> {
    const row = await this.findUnique({ where });
    if (!row) throw new Error("not found");
    Object.assign(row, data);
    return row;
  }

  async upsert({ where, create, update }: { where: Row; create: Row; update: Row }): Promise<Row> {
    return (await this.findUnique({ where }))
      ? this.update({ where, data: update })
      : this.create({ data: create });
  }

  async updateMany({ where, data }: { where: Row; data: Row }): Promise<{ count: number }> {
    const matching = this.rows.filter((row) => this.match(row, where));
    for (const row of matching) Object.assign(row, data);
    return { count: matching.length };
  }

  async delete({ where }: { where: Where }): Promise<Row> {
    const row = await this.findUnique({ where });
    if (!row) throw new Error("not found");
    this.rows.splice(this.rows.indexOf(row), 1);
    return row;
  }

  async deleteMany({ where = {} }: { where?: Where }): Promise<{ count: number }> {
    const doomed = this.rows.filter((row) => this.match(row, where));
    for (const row of doomed) this.rows.splice(this.rows.indexOf(row), 1);
    return { count: doomed.length };
  }

  /** The sums asked for; a sum over no rows is null, as in PostgreSQL. */
  async aggregate({
    where = {},
    _sum,
  }: {
    where?: Where;
    _sum: Record<string, unknown>;
  }): Promise<{ _sum: Record<string, number | null> }> {
    const rows = this.rows.filter((row) => this.match(row, where));
    const sum: Record<string, number | null> = {};
    for (const column of Object.keys(_sum)) {
      const values = rows
        .map((row) => row[column])
        .filter((v): v is number => typeof v === "number");
      sum[column] = values.length === 0 ? null : values.reduce((total, v) => total + v, 0);
    }
    return { _sum: sum };
  }
}

export class FakeDb {
  user = new Table(["email"]);
  refreshToken = new Table(["tokenHash"]);
  level = new Table(["slug"]);
  levelVersion = new Table([]);
  levelProgress = new Table([]);
  playerSettings = new Table(["userId"]);
  submission = new Table([]);
  pointsLedger = new Table([]);
  pointsRuleSet = new Table(["version"]);
  auditEvent = new Table([]);
  report = new Table([]);

  /**
   * The raw statements the code sent, in order: the SQL with `?` where each parameter went, the
   * parameters, and whether a transaction was open. The statements themselves are not run.
   */
  readonly raw: { sql: string; values: unknown[]; inTransaction: boolean }[] = [];
  private open = 0;

  async $transaction<T>(work: (tx: FakeDb) => Promise<T>): Promise<T> {
    this.open += 1;
    try {
      return await work(this);
    } finally {
      this.open -= 1;
    }
  }

  private record(strings: TemplateStringsArray, values: unknown[]): void {
    this.raw.push({ sql: strings.join("?"), values, inTransaction: this.open > 0 });
  }

  async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
    this.record(strings, values);
    return [];
  }

  async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number> {
    this.record(strings, values);
    return 1;
  }

  asPrisma(): PrismaService {
    return this as unknown as PrismaService;
  }
}
