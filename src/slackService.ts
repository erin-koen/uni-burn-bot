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
}

