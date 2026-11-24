import type { Prisma } from "../src/generated/prisma/client.js";
import { describe, expect, it } from "vitest";
import { AuditService } from "../src/modules/audit/audit.service.js";
import { eraseAuditEmails } from "../src/modules/audit/audit-erasure.js";
import type { WebRevalidator } from "../src/modules/audit/web-revalidator.js";
import { MeService } from "../src/modules/me/me.service.js";
import { PlayersActionsService } from "../src/modules/players/players-actions.service.js";
import { FakeDb } from "./support/fake-db.js";
import { failure } from "./support/http.js";
import { goodPassword, makeAuth } from "./support/services.js";

const PLAYER = "player-1";
const ADMIN = "admin-1";
const EMAIL = "player@example.com";

/** A player, with the audit events and reports an active account accumulates. */
async function setup() {
  const { db, passwords } = makeAuth();
  const password = goodPassword();
  await db.user.create({
    data: {
      id: PLAYER,
      email: EMAIL,
      passwordHash: await passwords.hash(password),
      role: "PLAYER",
      publicId: "public-1",
      status: "ACTIVE",
      mustChangePassword: false,
    },
  });
  const event = (id: string, entityId: string, action: string, detail: Record<string, unknown>) =>
    db.auditEvent.rows.push({
      id,
      userId: ADMIN,
      action,
      entityType: "player",
      entityId,
      detail,
      createdAt: new Date(),
    });
  event("name", PLAYER, "PLAYER_NAME_CHANGED", { email: EMAIL, from: null, to: "Ada" });
  event("export", PLAYER, "PLAYER_EXPORTED", { email: EMAIL });
  event("other", "player-2", "PLAYER_SUSPENDED", { email: "other@example.com" });
  for (const [id, reporterId, targetPublic] of [
    ["by-them", PLAYER, "public-9"],
    ["about-them", "player-9", "public-1"],
    ["unrelated", "player-9", "public-9"],
  ] as const) {
    db.report.rows.push({ id, reporterId, targetPublic });
  }
  const audit = new AuditService(db.asPrisma(), {
    notify: () => undefined,
  } as unknown as WebRevalidator);
  return {
    db,
    password,
    me: new MeService(db.asPrisma(), passwords),
    actions: new PlayersActionsService(db.asPrisma(), audit),
  };
}

/** The statements a deletion path sent to clear the audit log. */
function erasures(db: FakeDb) {
  return db.raw
    .filter((q) => q.sql.includes('UPDATE "AuditEvent"'))
    .map((q) => ({
      ...q,
      sql: q.sql.replace(/\s+/g, " ").trim(),
    }));
}

describe("erasing the email from the audit log", () => {
  it("removes only the email key, and only from the events about that player", async () => {
    const db = new FakeDb();
    await eraseAuditEmails(db.asPrisma() as unknown as Prisma.TransactionClient, PLAYER);
    expect(erasures(db)).toEqual([
      {
        sql: 'UPDATE "AuditEvent" SET "detail" = "detail" - \'email\' WHERE "entityType" = \'player\' AND "entityId" = ? AND "detail" -> \'email\' IS NOT NULL',
        values: [PLAYER],
        inTransaction: false,
      },
    ]);
  });

  it("an admin's deletion records PLAYER_DELETED without the email and erases it in the same transaction", async () => {
    const { db, actions } = await setup();
    await actions.remove(PLAYER, ` ${EMAIL.toUpperCase()} `, ADMIN);
    expect(db.user.rows).toHaveLength(0);
    expect(erasures(db)).toMatchObject([{ values: [PLAYER], inTransaction: true }]);

    const deleted = db.auditEvent.rows.find((e) => e.action === "PLAYER_DELETED");
    expect(deleted).toMatchObject({ userId: ADMIN, entityType: "player", entityId: PLAYER });
    expect(deleted?.detail).not.toHaveProperty("email");
    // The reports they made and the ones about them go too.
    expect(db.report.rows.map((r) => r.id)).toEqual(["unrelated"]);
  });

  it("the player's own deletion sends the same statement in the same transaction", async () => {
    const { db, me, password } = await setup();
    await me.deleteAccount(PLAYER, password);
    expect(db.user.rows).toHaveLength(0);
    expect(erasures(db)).toMatchObject([{ values: [PLAYER], inTransaction: true }]);

    const direct = new FakeDb();
    await eraseAuditEmails(direct.asPrisma() as unknown as Prisma.TransactionClient, PLAYER);
    expect(erasures(db)[0]!.sql).toBe(erasures(direct)[0]!.sql);
  });

  it("a wrong password deletes nothing and erases nothing", async () => {
    const { db, me } = await setup();
    expect(await failure(() => me.deleteAccount(PLAYER, "wrong-password-xx"))).toMatchObject({
      status: 422,
      code: "PASSWORD_INCORRECT",
    });
    expect(db.user.rows).toHaveLength(1);
    expect(erasures(db)).toHaveLength(0);
  });

  it("the other actions of an active account still record the email", async () => {
    const { db, actions } = await setup();
    await actions.suspend(PLAYER, ADMIN);
    expect(db.auditEvent.rows.at(-1)).toMatchObject({
      action: "PLAYER_SUSPENDED",
      detail: { email: EMAIL },
    });
  });
});
