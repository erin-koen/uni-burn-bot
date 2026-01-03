import * as dotenv from 'dotenv';
import { TransactionDatabase } from './database';
import { EthereumMonitor } from './ethereumMonitor';
import { SlackService } from './slackService';
import { Config } from './types';

dotenv.config();

function loadConfig(): Config {
  const ethereumRpcUrl = process.env.ETHEREUM_RPC_URL;
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const recipientAddress = process.env.RECIPIENT_ADDRESS;
  const amount = process.env.AMOUNT;
  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  const slackChannel = process.env.SLACK_CHANNEL;
  const pollInterval = parseInt(process.env.POLL_INTERVAL || '30', 10);

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
    slack = new SlackService(config.slackBotToken, config.slackChannel);
  } catch (error: any) {
    console.error(`Failed to initialize services:`, error.message);
    process.exit(1);
  }

  console.log('Bot started. Monitoring for token transfers...');
  console.log(`Polling interval: ${config.pollInterval} seconds`);

  // Check if this is first run (database is empty)
  const isFirstRun = db.getTransferCount(config.tokenAddress, config.recipientAddress) === 0;

  if (isFirstRun) {
    console.log('First run detected. Fetching last 24 hours of transfers...');
    try {
      const historicalTransfers = await monitor.getHistoricalTransfers(24);
      console.log(`Found ${historicalTransfers.length} historical transfer(s) in last 24 hours`);

      // Store all historical transfers in database
      for (const transfer of historicalTransfers) {
        if (!db.transferExists(transfer.hash)) {
          db.addTransfer(transfer);
        }
      }

      // Send summary to Slack
      await slack.sendHistoricalSummary(historicalTransfers);
      console.log('Sent historical summary to Slack');
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
            // Get historical count for context
            const historicalCount = db.getTransferCount(config.tokenAddress, config.recipientAddress);

            // Store transfer in database
            db.addTransfer(transfer);
            console.log(`Stored transfer: ${transfer.hash}`);

            // Send Slack alert
            try {
              await slack.sendTransferAlert(transfer, historicalCount);
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

