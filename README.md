# Ethereum Token Transfer Monitor Slack Bot

A Slack bot that monitors the Ethereum blockchain for specific ERC-20 token transfers and alerts a Slack channel when matching transfers are detected. The bot maintains a database of historical transfers to provide context in alerts.

Built with TypeScript and Node.js.

## Features

- Monitors Ethereum blockchain for specific ERC-20 token transfers
- Filters by token address, recipient address, and exact amount
- Stores transfer history in SQLite database
- Sends formatted alerts to Slack channels with historical context
- Configurable monitoring parameters
- TypeScript for type safety

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```
# Ethereum RPC endpoint (use Infura, Alchemy, or your own node)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Token contract address to monitor
TOKEN_ADDRESS=0x...

# Recipient address to monitor (where tokens are being sent TO)
RECIPIENT_ADDRESS=0x...

# Amount to monitor (in token's smallest unit, e.g., for 18 decimals: 1000000000000000000 = 1 token)
AMOUNT=1000000000000000000

# Optional: Token decimals for human-readable formatting (default: 18)
# TOKEN_DECIMALS=18

# Slack configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL="#your-channel"

# Optional: Polling interval in seconds (default: 30)
# POLL_INTERVAL=30
```

3. Build the project:
```bash
npm run build
```

4. Run the bot:
```bash
npm start
```

Or run in development mode (with ts-node):
```bash
npm run dev
```

## Configuration

- `ETHEREUM_RPC_URL`: Your Ethereum RPC endpoint
- `TOKEN_ADDRESS`: The ERC-20 token contract address to monitor
- `RECIPIENT_ADDRESS`: The address that receives the tokens (the `to` address in the Transfer event)
- `AMOUNT`: The exact amount to monitor (in the token's smallest unit, e.g., wei for 18 decimals)
- `TOKEN_DECIMALS`: (Optional) Token decimals for human-readable formatting (default: 18)
- `SLACK_BOT_TOKEN`: Your Slack bot token (starts with `xoxb-`)
- `SLACK_CHANNEL`: The Slack channel to send alerts to (e.g., `#alerts`). **Note:** If the channel name starts with `#`, you must quote the value: `"#channel-name"`
- `POLL_INTERVAL`: (Optional) How often to check for new transfers in seconds (default: 30)

### Amount Calculation

For tokens with 18 decimals (most common):
- 1 token = `1000000000000000000` (1e18)
- 0.5 tokens = `500000000000000000` (5e17)
- 100 tokens = `100000000000000000000` (1e20)

For tokens with different decimals, adjust accordingly. For example, USDC has 6 decimals:
- 1 USDC = `1000000` (1e6)

## Database

The bot uses SQLite (via better-sqlite3) to store transfer history. The database file is created automatically as `transactions.db`.

## Viewing History

To view stored transfer history:
```bash
npm run view-history
```

## Project Structure

```
src/
  bot.ts              # Main bot entry point
  database.ts         # Database models and operations
  ethereumMonitor.ts  # Ethereum blockchain monitoring
  slackService.ts     # Slack integration
  types.ts            # TypeScript type definitions
  viewHistory.ts      # Utility to view transaction history
```

## Development

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled bot
- `npm run dev` - Run the bot with ts-node (for development)
- `npm run view-history` - View transaction history
