import { WebClient } from '@slack/web-api';
import { TokenTransfer } from './types';
import { TransactionDatabase } from './database';

export class SlackService {
  private client: WebClient;
  private channel: string;
  private tokenDecimals: number;

  constructor(botToken: string, channel: string, tokenDecimals: number = 18) {
    this.client = new WebClient(botToken);
    this.channel = channel;
    this.tokenDecimals = tokenDecimals;
    console.log(`Slack service initialized for channel: ${this.channel}`);
  }

  private formatTokenAmount(value: bigint): string {
    const divisor = BigInt(10 ** this.tokenDecimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;

    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }

    // Format fractional part with proper decimal places
    const fractionalStr = fractionalPart.toString().padStart(this.tokenDecimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, ''); // Remove trailing zeros

    return `${wholePart}.${trimmedFractional}`;
  }

  private formatTimeDifference(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private formatTokenTransferMessage(
    transfer: TokenTransfer,
    initiatorStats?: { count: number; rank: number; totalInitiators: number },
    timeSinceLast?: number | null,
    averageTimeBetween?: number | null
  ): any[] {
    const txUrl = `https://etherscan.io/tx/${transfer.hash}`;
    const tokenUrl = `https://etherscan.io/token/${transfer.tokenAddress}`;
    const initiatorAddress = transfer.initiatorAddress || transfer.from;
    const initiatorUrl = `https://etherscan.io/address/${initiatorAddress}`;

    // Format token amount in human-readable format
    const amountFormatted = this.formatTokenAmount(transfer.value);

    // Build message blocks
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔔 Token Transfer Detected',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Amount:*\n${amountFormatted} tokens`,
          },
          {
            type: 'mrkdwn',
            text: `*Block Number:*\n${transfer.blockNumber.toLocaleString()}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Initiator Address:*\n<${initiatorUrl}|\`${initiatorAddress}\`>`,
        },
      },
    ];

    // Add initiator stats if available
    if (initiatorStats) {
      const rankSuffix = this.getRankSuffix(initiatorStats.rank);
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Initiator Stats:*\n• Transactions: ${initiatorStats.count}\n• Rank: ${initiatorStats.rank}${rankSuffix} of ${initiatorStats.totalInitiators} total initiators`,
          },
        ],
      });
    }

    // Add transaction details
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Transaction Hash:*\n<${txUrl}|\`${transfer.hash.slice(0, 10)}...\`>`,
        },
        {
          type: 'mrkdwn',
          text: `*Status:*\n${transfer.status === 1 ? '✅ Success' : '❌ Failed'}`,
        },
      ],
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Timestamp:* ${transfer.timestamp.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
      },
    });

    // Add time statistics
    const timeStats: string[] = [];
    if (timeSinceLast !== null && timeSinceLast !== undefined) {
      timeStats.push(`*Time Since Last:* ${this.formatTimeDifference(timeSinceLast)}`);
    }
    if (averageTimeBetween !== null && averageTimeBetween !== undefined) {
      timeStats.push(`*Avg Time Between:* ${this.formatTimeDifference(averageTimeBetween)}`);
    }

    if (timeStats.length > 0) {
      blocks.push({
        type: 'section',
        fields: timeStats.map(stat => ({
          type: 'mrkdwn',
          text: stat,
        })),
      });
    }

    // Add Etherscan links
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${txUrl}|View Transaction on Etherscan> | <${tokenUrl}|View Token on Etherscan>`,
      },
    });

    return blocks;
  }

  async sendMessage(blocks: any[]): Promise<void> {
    try {
      const response = await this.client.chat.postMessage({
        channel: this.channel,
        blocks,
        text: 'New token transfer detected', // Fallback text
      });

      console.log(`Message sent to ${this.channel}: ${response.ts}`);
    } catch (error: any) {
      console.error(`Error sending message to Slack:`, error.message);
      throw error;
    }
  }

  private getRankSuffix(rank: number): string {
    if (rank % 100 >= 11 && rank % 100 <= 13) {
      return 'th';
    }
    switch (rank % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  async sendTransferAlert(
    transfer: TokenTransfer,
    initiatorStats?: { count: number; rank: number; totalInitiators: number },
    timeSinceLast?: number | null,
    averageTimeBetween?: number | null
  ): Promise<void> {
    const blocks = this.formatTokenTransferMessage(transfer, initiatorStats, timeSinceLast, averageTimeBetween);
    await this.sendMessage(blocks);
  }

  async sendHistoricalSummary(transfers: TokenTransfer[], db: TransactionDatabase): Promise<void> {
    if (transfers.length === 0) {
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
      await this.sendMessage(blocks);
      return;
    }

    // Sort by timestamp (newest first)
    const sortedTransfers = [...transfers].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Send header message
    const headerBlocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🤖 Bot Started - ${transfers.length} Historical Transfer(s) Found`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Found *${transfers.length}* matching transfer(s) since December 27, 2025:`,
        },
      },
    ];
    await this.sendMessage(headerBlocks);

    // Send each transfer as a separate message to avoid Slack's 50 block limit
    // Each transfer uses about 7-8 blocks, so we can fit ~6 per message
    const MAX_BLOCKS_PER_MESSAGE = 45; // Leave some buffer
    const BLOCKS_PER_TRANSFER = 8; // divider + 6 sections + divider (approx)
    const transfersPerMessage = Math.floor(MAX_BLOCKS_PER_MESSAGE / BLOCKS_PER_TRANSFER);

    for (let i = 0; i < sortedTransfers.length; i += transfersPerMessage) {
      const batch = sortedTransfers.slice(i, i + transfersPerMessage);
      const blocks: any[] = [];

      for (const transfer of batch) {
        const txUrl = `https://etherscan.io/tx/${transfer.hash}`;
        const initiatorAddress = transfer.initiatorAddress || transfer.from;
        const initiatorUrl = `https://etherscan.io/address/${initiatorAddress}`;
        const amountFormatted = this.formatTokenAmount(transfer.value);

        // Get initiator stats
        let initiatorStats: { count: number; rank: number; totalInitiators: number } | undefined;
        if (transfer.initiatorAddress) {
          initiatorStats = db.getInitiatorStats(transfer.initiatorAddress);
        }

        blocks.push({
          type: 'divider',
        });

        blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Amount:*\n${amountFormatted} tokens`,
            },
            {
              type: 'mrkdwn',
              text: `*Block Number:*\n${transfer.blockNumber.toLocaleString()}`,
            },
          ],
        });

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Initiator Address:*\n<${initiatorUrl}|\`${initiatorAddress}\`>`,
          },
        });

        if (initiatorStats) {
          const rankSuffix = this.getRankSuffix(initiatorStats.rank);
          blocks.push({
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Initiator Stats:*\n• Transactions: ${initiatorStats.count}\n• Rank: ${initiatorStats.rank}${rankSuffix} of ${initiatorStats.totalInitiators} total initiators`,
              },
            ],
          });
        }

        blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Transaction Hash:*\n<${txUrl}|\`${transfer.hash.slice(0, 10)}...\`>`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${transfer.status === 1 ? '✅ Success' : '❌ Failed'}`,
            },
          ],
        });

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Timestamp:* ${transfer.timestamp.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
          },
        });

        // Add time statistics for historical transfers
        const previousTransferTimestamp = db.getPreviousTransferTimestamp(transfer.hash, transfer.timestamp);
        const timeSinceLast = previousTransferTimestamp
          ? transfer.timestamp.getTime() - previousTransferTimestamp.getTime()
          : null;
        const averageTimeBetween = db.getAverageTimeBetweenTransfers();

        const timeStats: string[] = [];
        if (timeSinceLast !== null && timeSinceLast !== undefined) {
          timeStats.push(`*Time Since Last:* ${this.formatTimeDifference(timeSinceLast)}`);
        }
        if (averageTimeBetween !== null && averageTimeBetween !== undefined) {
          timeStats.push(`*Avg Time Between:* ${this.formatTimeDifference(averageTimeBetween)}`);
        }

        if (timeStats.length > 0) {
          blocks.push({
            type: 'section',
            fields: timeStats.map(stat => ({
              type: 'mrkdwn',
              text: stat,
            })),
          });
        }
      }

      blocks.push({
        type: 'divider',
      });

      await this.sendMessage(blocks);
    }

    // Send final message
    const finalBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ Historical summary complete. Bot is now monitoring for new transfers...',
        },
      },
    ];
    await this.sendMessage(finalBlocks);
  }

  private getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m ago`;
    }
    return `${diffMins}m ago`;
  }
}

