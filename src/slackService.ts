import { WebClient } from '@slack/web-api';
import { TokenTransfer } from './types';

export class SlackService {
  private client: WebClient;
  private channel: string;

  constructor(botToken: string, channel: string) {
    this.client = new WebClient(botToken);
    this.channel = channel;
    console.log(`Slack service initialized for channel: ${this.channel}`);
  }

  private formatTokenTransferMessage(transfer: TokenTransfer, historicalCount: number = 0): any[] {
    const txUrl = `https://etherscan.io/tx/${transfer.hash}`;
    const tokenUrl = `https://etherscan.io/token/${transfer.tokenAddress}`;

    // Format value (assuming 18 decimals - user can adjust if needed)
    const valueRaw = transfer.value;
    const valueFormatted = valueRaw.toString();

    // Format gas price
    const gasPriceWei = transfer.gasPrice || BigInt(0);
    const gasPriceGwei = Number(gasPriceWei) / 1e9;

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
            text: `*Transaction Hash:*\n\`${transfer.hash}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Block Number:*\n${transfer.blockNumber.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Token Address:*\n\`${transfer.tokenAddress}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Amount:*\n${valueFormatted}`,
          },
          {
            type: 'mrkdwn',
            text: `*From:*\n\`${transfer.from}\``,
          },
          {
            type: 'mrkdwn',
            text: `*To:*\n\`${transfer.to}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Gas Used:*\n${transfer.gasUsed?.toLocaleString() || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Gas Price:*\n${gasPriceGwei.toFixed(2)} Gwei`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${transfer.status === 1 ? '✅ Success' : '❌ Failed'}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Timestamp:* ${transfer.timestamp.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
        },
      },
    ];

    // Add historical context if available
    if (historicalCount > 0) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📊 This is transfer #${historicalCount + 1} matching your criteria`,
          },
        ],
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

  async sendTransferAlert(transfer: TokenTransfer, historicalCount: number = 0): Promise<void> {
    const blocks = this.formatTokenTransferMessage(transfer, historicalCount);
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

      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*<${txUrl}|${transfer.hash.slice(0, 10)}...>*\n${timeAgo}`,
          },
          {
            type: 'mrkdwn',
            text: `*Amount:* ${transfer.value.toString()}\n*Block:* ${transfer.blockNumber.toLocaleString()}`,
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

