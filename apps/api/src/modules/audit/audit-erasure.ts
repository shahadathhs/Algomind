import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Removes the email address from the audit events about a player. Call it inside the transaction
 * that deletes the account: what was done stays on record, the address does not. The events are
 * found by entity, because `AuditEvent.userId` is the admin who acted. Returns how many changed.
 */
export function eraseAuditEmails(tx: Prisma.TransactionClient, playerId: string): Promise<number> {
  return tx.$executeRaw`
    UPDATE "AuditEvent"
    SET "detail" = "detail" - 'email'
    WHERE "entityType" = 'player' AND "entityId" = ${playerId} AND "detail" -> 'email' IS NOT NULL`;
}
