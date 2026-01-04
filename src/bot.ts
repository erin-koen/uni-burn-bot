import * as dotenv from 'dotenv';
import * as path from 'path';
import { TransactionDatabase } from './database';
import { EthereumMonitor } from './ethereumMonitor';
import { SlackService } from './slackService';
import { Config } from './types';

// Load .env file from project root (works with both ts-node and compiled JS)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function loadConfig(): Config {
  const ethereumRpcUrl = process.env.ETHEREUM_RPC_URL?.trim();
  const tokenAddress = process.env.TOKEN_ADDRESS?.trim();
  const recipientAddress = process.env.RECIPIENT_ADDRESS?.trim();
  const amount = process.env.AMOUNT?.trim();
  const tokenDecimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS.trim(), 10) : 18;
  const slackBotToken = process.env.SLACK_BOT_TOKEN?.trim();
  const slackChannel = process.env.SLACK_CHANNEL?.trim();
  const pollInterval = parseInt(process.env.POLL_INTERVAL?.trim() || '30', 10);

  if (!ethereumRpcUrl || !tokenAddress || !recipientAddress || !amount || !slackBotToken || !slackChannel) {
    console.error('Missing required environment variables. Please check your .env file.');
    console.error('Required: ETHEREUM_RPC_URL, TOKEN_ADDRESS, RECIPIENT_ADDRESS, AMOUNT, SLACK_BOT_TOKEN, SLACK_CHANNEL');
    process.exit(1);
  }

  return {
    ethereumRpcUrl,
    tokenAddress,
    recipientAddress,
    amount,
    tokenDecimals,
    slackBotToken,
    slackChannel,
    pollInterval,
  };
}

async function main(): Promise<void> {
  const config = loadConfig();

  // Initialize services
  let db: TransactionDatabase;
  let monitor: EthereumMonitor;
  let slack: SlackService;

  try {
    db = new TransactionDatabase();
    monitor = new EthereumMonitor(
      config.ethereumRpcUrl,
      config.tokenAddress,
      config.recipientAddress,
      config.amount
    );
    await monitor.initialize();
    slack = new SlackService(config.slackBotToken, config.slackChannel, config.tokenDecimals);
  } catch (error: any) {
    console.error(`Failed to initialize services:`, error.message);
    process.exit(1);
  }

  console.log('Bot started. Monitoring for token transfers...');
  console.log(`Polling interval: ${config.pollInterval} seconds`);

  // Check if this is first run (database is empty)
  const isFirstRun = db.getTransferCount(config.tokenAddress, config.recipientAddress) === 0;

  if (isFirstRun) {
    // Start date: December 27, 2025 at noon EST (17:00 UTC)
    const startDate = new Date('2025-12-27T17:00:00Z');
    console.log(`First run detected. Fetching transfers from ${startDate.toISOString()}...`);

    try {
      const historicalTransfers = await monitor.getHistoricalTransfers(startDate);
      console.log(`Found ${historicalTransfers.length} historical transfer(s) since ${startDate.toISOString()}`);

      // Store all historical transfers in database
      for (const transfer of historicalTransfers) {
        if (!db.transferExists(transfer.hash)) {
          db.addTransfer(transfer);
        }
      }

      // If we found transfers, send a message with the most recent one and aggregate stats
      if (historicalTransfers.length > 0) {
        // Sort by timestamp to get the most recent
        const sortedTransfers = [...historicalTransfers].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        const mostRecentTransfer = sortedTransfers[0];

        // Get time since last transfer (second most recent)
        const timeSinceLast = sortedTransfers.length > 1
          ? mostRecentTransfer.timestamp.getTime() - sortedTransfers[1].timestamp.getTime()
          : null;

        // Get aggregate statistics
        const totalTokens = db.getTotalTokensSent();
        const totalTransactions = db.getTransferCount(config.tokenAddress, config.recipientAddress);
        const averageTimeBetween = db.getAverageTimeBetweenTransfers();
        const totalInitiators = db.getTotalInitiators();
        const topInitiators = db.getTopInitiators(3);

        const aggregateStats = {
          totalTokens,
          totalTransactions,
          averageTimeBetween,
          totalInitiators,
          topInitiators,
        };

        // Send message with new format
        await slack.sendTransferAlert(mostRecentTransfer, timeSinceLast, aggregateStats);
        console.log('Sent historical summary to Slack');
      } else {
        // No transfers found
        const blocks = [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🤖 Bot Started - No Historical Transfers',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Bot is now monitoring. No matching transfers found since December 27, 2025.',
            },
          },
        ];
        await slack.sendMessage(blocks);
        console.log('Sent empty historical summary to Slack');
      }
    } catch (error: any) {
      console.error(`Error fetching/sending historical transfers:`, error.message);
    }
  }

  // Graceful shutdown handler
  const shutdown = () => {
    console.log('\nBot stopped by user');
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Main monitoring loop
  while (true) {
    try {
      // Check for new transfers
      const newTransfers = await monitor.checkForNewTransfers();

      if (newTransfers.length > 0) {
        console.log(`Found ${newTransfers.length} new transfer(s)`);

        for (const transfer of newTransfers) {
          // Check if we've already seen this transfer
          if (!db.transferExists(transfer.hash)) {
            // Store transfer in database first
            db.addTransfer(transfer);
            console.log(`Stored transfer: ${transfer.hash}`);

            // Get time since last transfer
            const previousTransferTimestamp = db.getPreviousTransferTimestamp(transfer.hash, transfer.timestamp);
            const timeSinceLast = previousTransferTimestamp
              ? transfer.timestamp.getTime() - previousTransferTimestamp.getTime()
              : null;

            // Get aggregate statistics
            const totalTokens = db.getTotalTokensSent();
            const totalTransactions = db.getTransferCount(config.tokenAddress, config.recipientAddress);
            const averageTimeBetween = db.getAverageTimeBetweenTransfers();
            const totalInitiators = db.getTotalInitiators();
            const topInitiators = db.getTopInitiators(3);

            const aggregateStats = {
              totalTokens,
              totalTransactions,
              averageTimeBetween,
              totalInitiators,
              topInitiators,
            };

            // Send Slack alert
            try {
              await slack.sendTransferAlert(transfer, timeSinceLast, aggregateStats);
              console.log(`Sent alert for transfer: ${transfer.hash}`);
            } catch (error: any) {
              console.error(`Failed to send Slack alert:`, error.message);
            }
          } else {
            console.log(`Transfer already exists: ${transfer.hash}`);
          }
        }
      } else {
        console.log('No new transfers found');
      }
    } catch (error: any) {
      console.error(`Error in monitoring loop:`, error.message);
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, config.pollInterval * 1000));
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

