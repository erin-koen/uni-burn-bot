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

  private formatTokenTransferMessage(
    transfer: TokenTransfer,
    initiatorStats?: { count: number; rank: number; totalInitiators: number }
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
    initiatorStats?: { count: number; rank: number; totalInitiators: number }
  ): Promise<void> {
    const blocks = this.formatTokenTransferMessage(transfer, initiatorStats);
    await this.sendMessage(blocks);
  }

  async sendHistoricalSummary(transfers: TokenTransfer[]): Promise<void> {
    if (transfers.length === 0) {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🤖 Bot Started - No Recent Transfers',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Bot is now monitoring. No matching transfers found in the last 24 hours.',
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

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🤖 Bot Started - ${transfers.length} Transfer(s) in Last 24 Hours`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Found *${transfers.length}* matching transfer(s) from the past 24 hours:`,
        },
      },
    ];

    // Add summary of each transfer (limit to 10 most recent to avoid message being too long)
    const transfersToShow = sortedTransfers.slice(0, 10);

    for (const transfer of transfersToShow) {
      const txUrl = `https://etherscan.io/tx/${transfer.hash}`;
      const timeAgo = this.getTimeAgo(transfer.timestamp);
      const amountFormatted = this.formatTokenAmount(transfer.value);

      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*<${txUrl}|${transfer.hash.slice(0, 10)}...>*\n${timeAgo}`,
          },
          {
            type: 'mrkdwn',
            text: `*Amount:* ${amountFormatted} tokens\n*Block:* ${transfer.blockNumber.toLocaleString()}`,
          },
        ],
      });
    }

    if (transfers.length > 10) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_Showing 10 most recent. ${transfers.length - 10} more transfer(s) found._`,
          },
        ],
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Bot is now monitoring for new transfers...',
      },
    });

    await this.sendMessage(blocks);
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

