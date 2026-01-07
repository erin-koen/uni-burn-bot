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

  private generateChart(dailyData: Array<{ date: Date; movingAverageHours: number | null }>): string {
    const chartWidth = 70;
    const chartHeight = 15;
    const yAxisWidth = 8;
    const dataWidth = chartWidth - yAxisWidth;

    if (dailyData.length === 0) {
      return '```\nNo data available for chart\n```';
    }

    // Filter out null values but keep track of original indices
    const validDataWithIndices = dailyData
      .map((d, idx) => ({ ...d, originalIndex: idx }))
      .filter(d => d.movingAverageHours !== null) as Array<{
        date: Date;
        movingAverageHours: number;
        originalIndex: number
      }>;

    if (validDataWithIndices.length === 0) {
      return '```\nNo data available for chart\n```';
    }

    // Find min and max values
    const values = validDataWithIndices.map(d => d.movingAverageHours);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1; // Avoid division by zero

    // Normalize values to chart height
    const normalized = validDataWithIndices.map(d => ({
      date: d.date,
      value: Math.round(((d.movingAverageHours - minValue) / range) * (chartHeight - 1)),
      original: d.movingAverageHours,
      originalIndex: d.originalIndex
    }));

    // Create chart grid
    const chart: string[][] = Array(chartHeight).fill(null).map(() => Array(chartWidth).fill(' '));

    // Draw Y-axis labels and values (right-aligned)
    for (let y = 0; y < chartHeight; y++) {
      const value = maxValue - (range * y / (chartHeight - 1));
      const label = value.toFixed(1) + 'h';
      const labelStart = yAxisWidth - label.length - 1;

      // Add value label
      for (let i = 0; i < label.length; i++) {
        if (labelStart + i >= 0) {
          chart[y][labelStart + i] = label[i];
        }
      }
      // Add Y-axis line
      chart[y][yAxisWidth - 1] = '│';
    }

    // Draw data points as a line chart
    // Map each point to X position based on its position in the data array
    // The data array starts from the first transaction day, so indices are 0 to dataLength-1
    const dataLength = dailyData.length;
    if (normalized.length > 1) {
      for (let i = 0; i < normalized.length - 1; i++) {
        const point1 = normalized[i];
        const point2 = normalized[i + 1];

        // Calculate X position based on original index in dailyData array
        // Use dataLength - 1 to avoid division by zero and get proper spacing
        const x1 = yAxisWidth + Math.floor((point1.originalIndex / Math.max(1, dataLength - 1)) * dataWidth);
        const y1 = chartHeight - 1 - point1.value;
        const x2 = yAxisWidth + Math.floor((point2.originalIndex / Math.max(1, dataLength - 1)) * dataWidth);
        const y2 = chartHeight - 1 - point2.value;

        // Draw line between points
        const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        for (let step = 0; step <= steps; step++) {
          const t = steps > 0 ? step / steps : 0;
          const x = Math.round(x1 + (x2 - x1) * t);
          const y = Math.round(y1 + (y2 - y1) * t);

          if (x >= yAxisWidth && x < chartWidth && y >= 0 && y < chartHeight) {
            chart[y][x] = '█';
          }
        }
      }
    } else if (normalized.length === 1) {
      // Single point
      const point = normalized[0];
      const x = yAxisWidth + Math.floor((point.originalIndex / Math.max(1, dataLength - 1)) * dataWidth);
      const y = chartHeight - 1 - point.value;
      if (x >= yAxisWidth && x < chartWidth && y >= 0 && y < chartHeight) {
        chart[y][x] = '█';
      }
    }

    // Draw X-axis
    const xAxisY = chartHeight - 1;
    for (let x = yAxisWidth; x < chartWidth; x++) {
      chart[xAxisY][x] = '─';
    }
    chart[xAxisY][yAxisWidth - 1] = '└';

    // Add date labels at start, middle, and end
    const dateLabels = [
      dailyData[0]?.date || new Date(),
      dailyData[Math.floor(dailyData.length / 2)]?.date || new Date(),
      dailyData[dailyData.length - 1]?.date || new Date()
    ].map(d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    // Convert chart to string
    const chartLines = chart.map(row => row.join(''));

    // Add date labels on a separate line
    const dateLabelSpacing = Math.floor(dataWidth / 2);
    const dateLabelLine = ' '.repeat(yAxisWidth) +
      dateLabels[0].padEnd(dateLabelSpacing) +
      dateLabels[1].padEnd(dateLabelSpacing) +
      dateLabels[2];

    return '```\n' + chartLines.join('\n') + '\n' + dateLabelLine + '\n```';
  }

  private formatTokenTransferMessage(
    transfer: TokenTransfer,
    timeSinceLast: number | null,
    burnerCount: number,
    aggregateStats: {
      totalTokens: bigint;
      totalTransactions: number;
      averageTimeBetween: number | null;
      totalBurners: number;
      topBurners: Array<{ address: string; count: number }>;
      daily7DayMA: Array<{ date: Date; movingAverageHours: number | null }>;
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
            text: `*Burner:*\n<${burnerUrl}|\`${burnerAddress}\`>\n${burnerCount} transaction${burnerCount !== 1 ? 's' : ''}`,
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

    // Add 7-day moving average chart
    blocks.push({
      type: 'divider',
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*📈 7-Day Moving Average of Time Between Transactions (Last 30 Days)*',
      },
    });

    const chart = this.generateChart(aggregateStats.daily7DayMA);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: chart,
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
    timeSinceLast: number | null,
    burnerCount: number,
    aggregateStats: {
      totalTokens: bigint;
      totalTransactions: number;
      averageTimeBetween: number | null;
      totalBurners: number;
      topBurners: Array<{ address: string; count: number }>;
      daily7DayMA: Array<{ date: Date; movingAverageHours: number | null }>;
    }
  ): Promise<void> {
    const blocks = this.formatTokenTransferMessage(transfer, timeSinceLast, burnerCount, aggregateStats);
    await this.sendMessage(blocks);
  }

}

