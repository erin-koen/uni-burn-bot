import * as dotenv from 'dotenv';
import { TransactionDatabase } from './database';

dotenv.config();

function main(): void {
  const db = new TransactionDatabase();
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const recipientAddress = process.env.RECIPIENT_ADDRESS;

  // Get all transfers
  const transfers = db.getTransferHistory(tokenAddress, recipientAddress, 50);

  if (transfers.length === 0) {
    console.log('No transfers found in database.');
    db.close();
    return;
  }

  console.log(`\nFound ${transfers.length} transfer(s):\n`);
  console.log('-'.repeat(120));

  for (const transfer of transfers) {
    console.log(`Hash: ${transfer.hash}`);
    console.log(`Block: ${transfer.blockNumber.toLocaleString()}`);
    console.log(`Token: ${transfer.tokenAddress}`);
    console.log(`From: ${transfer.from}`);
    console.log(`To: ${transfer.to}`);
    console.log(`Amount: ${transfer.value.toString()}`);
    console.log(`Gas Used: ${transfer.gasUsed?.toLocaleString() || 'N/A'}`);
    console.log(`Timestamp: ${transfer.timestamp.toISOString()}`);
    console.log('-'.repeat(120));
  }

  // Show statistics
  const totalCount = db.getTransferCount(tokenAddress, recipientAddress);
  console.log(`\nTotal transfers in database: ${totalCount}`);

  db.close();
}

main();

