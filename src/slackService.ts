import { WebClient } from '@slack/web-api';
import { TokenTransfer } from './types';

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
    timeSinceLast: number | null,
    aggregateStats: {
      totalTokens: bigint;
      totalTransactions: number;
      averageTimeBetween: number | null;
      totalBurners: number;
      topBurners: Array<{ address: string; count: number }>;
    }
  ): any[] {
    const txUrl = `https://etherscan.io/tx/${transfer.hash}`;
    const burnerAddress = transfer.burnerAddress || transfer.from;
    const burnerUrl = `https://etherscan.io/address/${burnerAddress}`;

    // Build message blocks
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ' :unicorn_face: :fire: UNI  Burn Detected',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📋 Most Recent Transaction*',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Burner:*\n<${burnerUrl}|\`${burnerAddress}\`>`,
          },
          {
            type: 'mrkdwn',
            text: `*Transaction Hash:*\n<${txUrl}|\`${transfer.hash.slice(0, 10)}...\`>`,
          },
        ],
      },
    ];

    // Add time since last if available
    if (timeSinceLast !== null && timeSinceLast !== undefined) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Time Since Last Transaction:* ${this.formatTimeDifference(timeSinceLast)}`,
        },
      });
    }

    // Add aggregate statistics
    blocks.push({
      type: 'divider',
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*📊 Aggregate Statistics*',
      },
    });

    const totalTokensFormatted = this.formatTokenAmount(aggregateStats.totalTokens);
    const avgTimeFormatted = aggregateStats.averageTimeBetween
      ? this.formatTimeDifference(aggregateStats.averageTimeBetween)
      : 'N/A';

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Total Tokens Sent:*\n${totalTokensFormatted} tokens`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Transactions:*\n${aggregateStats.totalTransactions.toLocaleString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Average Time Between:*\n${avgTimeFormatted}`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Burners:*\n${aggregateStats.totalBurners.toLocaleString()}`,
        },
      ],
    });

    // Add top 3 burners
    if (aggregateStats.topBurners.length > 0) {
      const topBurnersText = aggregateStats.topBurners
        .map((burner, index) => {
          const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
          const burnerUrl = `https://etherscan.io/address/${burner.address}`;
          return `${rankEmoji} <${burnerUrl}|\`${burner.address.slice(0, 10)}...\`> - ${burner.count} transaction${burner.count !== 1 ? 's' : ''}`;
        })
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top 3 Burners:*\n${topBurnersText}`,
        },
      });
    }

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
    timeSinceLast: number | null,
    aggregateStats: {
      totalTokens: bigint;
      totalTransactions: number;
      averageTimeBetween: number | null;
      totalBurners: number;
      topBurners: Array<{ address: string; count: number }>;
    }
  ): Promise<void> {
    const blocks = this.formatTokenTransferMessage(transfer, timeSinceLast, aggregateStats);
    await this.sendMessage(blocks);
  }

}

