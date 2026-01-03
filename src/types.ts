export interface TokenTransfer {
  hash: string;
  blockNumber: number;
  tokenAddress: string;
  from: string;
  to: string;
  value: bigint;
  timestamp: Date;
  gasUsed?: number;
  gasPrice?: bigint;
  status?: number;
}

export interface Config {
  ethereumRpcUrl: string;
  tokenAddress: string;
  recipientAddress: string;
  amount: string; // Amount in token's smallest unit (e.g., wei for 18 decimals)
  slackBotToken: string;
  slackChannel: string;
  pollInterval: number;
}

