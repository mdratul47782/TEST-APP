/**
 * Document numbering helper - race-safe sequential numbers per document type.
 *
 * Usage:
 *   const { nextDocNo } = require('../utils/docNo');
 *   const prNo = await nextDocNo(db, 'PR');   // -> "PR-00001"
 *
 * The counter lives in `document_sequences`. Increments happen inside a
 * transaction with a `SELECT ... FOR UPDATE` row lock so concurrent requests
 * can never hand out the same number. When a transaction is passed, the
 * lock joins that transaction's connection (same-tx atomicity).
 */
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { documentSequences } = require('../db/schema');

const PREFIXES = {
  SO: 'SO',
  PR: 'PR',
  PO: 'PO',
  GRN: 'GRN',
  MI: 'MI',
  CP: 'CP',
  ADJ: 'ADJ',
  QC: 'QC',
  FG: 'FG',
  SH: 'SH',
  PROD: 'PROD',
};

const WIDTH = 5;

/**
 * @param {import('drizzle-orm/mysql2').MySql2Database|import('drizzle-orm/mysql2').MySql2Transaction} client db or tx
 * @param {string} docType document type key
 * @returns {Promise<string>} formatted number e.g. PR-00001
 */
async function nextDocNo(client = db, docType) {
  const prefix = PREFIXES[docType] || docType.toUpperCase();

  // If the client is already inside a transaction, use it as-is; otherwise
  // open a short transaction around the locked read-modify-write.
  const runner = client === db ? db : null;
  const run = async (tx) => {
    // Ensure a counter row exists (unique on docType -> only one wins).
    const existing = await tx
      .select()
      .from(documentSequences)
      .where(eq(documentSequences.docType, docType))
      .limit(1)
      .for('update');

    let lastNo;
    if (existing.length === 0) {
      try {
        await tx.insert(documentSequences).values({ docType, lastNo: 1 });
        lastNo = 1;
      } catch {
        // Another request inserted the row concurrently - re-read under lock.
        const [row] = await tx
          .select()
          .from(documentSequences)
          .where(eq(documentSequences.docType, docType))
          .limit(1)
          .for('update');
        if (!row) throw new Error(`Failed to initialise document sequence: ${docType}`);
        await tx.update(documentSequences).set({ lastNo: row.lastNo + 1 }).where(eq(documentSequences.docType, docType));
        lastNo = row.lastNo + 1;
      }
    } else {
      await tx
        .update(documentSequences)
        .set({ lastNo: existing[0].lastNo + 1 })
        .where(eq(documentSequences.docType, docType));
      lastNo = existing[0].lastNo + 1;
    }

    return `${prefix}-${String(lastNo).padStart(WIDTH, '0')}`;
  };

  if (runner) {
    return runner.transaction(run);
  }
  return run(client);
}

module.exports = { nextDocNo, PREFIXES };
