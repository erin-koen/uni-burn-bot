import Database from 'better-sqlite3';
import { TokenTransfer } from './types';

export class TransactionDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'transactions.db') {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS token_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT UNIQUE NOT NULL,
        block_number INTEGER NOT NULL,
        token_address TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        initiator_address TEXT,
        value TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        gas_used INTEGER,
        gas_price TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tx_hash ON token_transfers(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_block_number ON token_transfers(block_number);
      CREATE INDEX IF NOT EXISTS idx_token_address ON token_transfers(token_address);
      CREATE INDEX IF NOT EXISTS idx_to_address ON token_transfers(to_address);
      CREATE INDEX IF NOT EXISTS idx_initiator_address ON token_transfers(initiator_address);
    `);
  }

  transferExists(txHash: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM token_transfers WHERE tx_hash = ?');
    const result = stmt.get(txHash);
    return result !== undefined;
  }

  addTransfer(transfer: TokenTransfer): void {
    const stmt = this.db.prepare(`
      INSERT INTO token_transfers (
        tx_hash, block_number, token_address, from_address, to_address, initiator_address,
        value, timestamp, gas_used, gas_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      transfer.hash,
      transfer.blockNumber,
      transfer.tokenAddress,
      transfer.from,
      transfer.to,
      transfer.initiatorAddress || null,
      transfer.value.toString(),
      transfer.timestamp.toISOString(),
      transfer.gasUsed || null,
      transfer.gasPrice?.toString() || null
    );
  }

  getTransferHistory(tokenAddress?: string, recipientAddress?: string, limit: number = 10): TokenTransfer[] {
    let query = 'SELECT * FROM token_transfers';
    const conditions: string[] = [];
    const params: any[] = [];

    if (tokenAddress) {
      conditions.push('token_address = ?');
      params.push(tokenAddress);
    }

    if (recipientAddress) {
      conditions.push('to_address = ?');
      params.push(recipientAddress);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY block_number DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      hash: row.tx_hash,
      blockNumber: row.block_number,
      tokenAddress: row.token_address,
      from: row.from_address,
      to: row.to_address,
      value: BigInt(row.value),
      timestamp: new Date(row.timestamp),
      gasUsed: row.gas_used,
      gasPrice: row.gas_price ? BigInt(row.gas_price) : undefined,
      status: row.status,
      initiatorAddress: row.initiator_address,
    }));
  }

  getInitiatorStats(initiatorAddress: string): { count: number; rank: number; totalInitiators: number } {
    // Get count for this initiator
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM token_transfers
      WHERE initiator_address = ?
    `);
    const countResult = countStmt.get(initiatorAddress) as { count: number };
    const count = countResult.count;

    // Get total number of unique initiators
    const totalStmt = this.db.prepare(`
      SELECT COUNT(DISTINCT initiator_address) as total
      FROM token_transfers
      WHERE initiator_address IS NOT NULL
    `);
    const totalResult = totalStmt.get() as { total: number };
    const totalInitiators = totalResult.total;

    // Get rank by counting how many distinct initiators have more transactions
    const rankStmt = this.db.prepare(`
      WITH initiator_counts AS (
        SELECT
          initiator_address,
          COUNT(*) as tx_count
        FROM token_transfers
        WHERE initiator_address IS NOT NULL
        GROUP BY initiator_address
      )
      SELECT COUNT(*) + 1 as rank
      FROM initiator_counts
      WHERE tx_count > (SELECT tx_count FROM initiator_counts WHERE initiator_address = ?)
    `);
    const rankResult = rankStmt.get(initiatorAddress) as { rank: number };
    const rank = rankResult.rank;

    return { count, rank, totalInitiators };
  }

  getTransferCount(tokenAddress?: string, recipientAddress?: string): number {
    let query = 'SELECT COUNT(*) as count FROM token_transfers';
    const conditions: string[] = [];
    const params: any[] = [];

    if (tokenAddress) {
      conditions.push('token_address = ?');
      params.push(tokenAddress);
    }

    if (recipientAddress) {
      conditions.push('to_address = ?');
      params.push(recipientAddress);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  getPreviousTransferTimestamp(currentHash: string, currentTimestamp: Date): Date | null {
    // Get the transfer that came before this one chronologically
    const stmt = this.db.prepare(`
      SELECT timestamp
      FROM token_transfers
      WHERE tx_hash != ?
        AND (block_number < (SELECT block_number FROM token_transfers WHERE tx_hash = ?)
          OR (block_number = (SELECT block_number FROM token_transfers WHERE tx_hash = ?)
              AND timestamp < ?))
      ORDER BY block_number DESC, timestamp DESC
      LIMIT 1
    `);
    const result = stmt.get(currentHash, currentHash, currentHash, currentTimestamp.toISOString()) as { timestamp: string } | undefined;
    return result ? new Date(result.timestamp) : null;
  }

  getAverageTimeBetweenTransfers(): number | null {
    // Get all timestamps ordered by block number
    const stmt = this.db.prepare(`
      SELECT timestamp
      FROM token_transfers
      ORDER BY block_number ASC
    `);
    const rows = stmt.all() as { timestamp: string }[];

    if (rows.length < 2) {
      return null; // Need at least 2 transfers to calculate average
    }

    let totalDiff = 0;
    for (let i = 1; i < rows.length; i++) {
      const prevTime = new Date(rows[i - 1].timestamp).getTime();
      const currTime = new Date(rows[i].timestamp).getTime();
      totalDiff += currTime - prevTime;
    }

    return totalDiff / (rows.length - 1); // Average in milliseconds
  }

  close(): void {
    this.db.close();
  }
}

