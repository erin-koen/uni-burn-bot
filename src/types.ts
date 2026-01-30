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
  burnerAddress?: string; // The address that initiated the transaction (tx.from)
}

export interface Config {
  ethereumRpcUrl: string;
  tokenAddress: string;
  recipientAddress: string;
  amount: string; // Amount in token's smallest unit (e.g., wei for 18 decimals) - kept for backward compatibility
  amounts: string[]; // Array of amounts to monitor (includes the original amount plus any additional amounts)
  tokenDecimals?: number; // Token decimals (default: 18)
  slackBotToken: string;
  slackChannel: string;
  pollInterval: number;
}

