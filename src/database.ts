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
        tx_hash, block_number, token_address, from_address, to_address,
        value, timestamp, gas_used, gas_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      transfer.hash,
      transfer.blockNumber,
      transfer.tokenAddress,
      transfer.from,
      transfer.to,
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
    }));
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

  close(): void {
    this.db.close();
  }
}

