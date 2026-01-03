# Slack App Setup Guide

## Step 1: Create App

1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose **"From scratch"**
4. Enter app name (e.g., "Ethereum Monitor Bot")
5. Select your workspace
6. Click "Create App"

## Step 2: Configure Bot Token Scopes

1. In the left sidebar, go to **"OAuth & Permissions"**
2. Scroll down to **"Scopes"** → **"Bot Token Scopes"**
3. Add the following scope:
   - `chat:write` - Allows the bot to post messages to channels

## Step 3: Install App to Workspace

1. Scroll up to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**

## Step 4: Copy Bot Token

1. Go to **"OAuth & Permissions"** in the left sidebar (if not already there)
2. Scroll down to **"OAuth Tokens for Your Workspace"** section
3. Look for **"Bot User OAuth Token"** (it should be visible after you installed the app)
4. Click **"Copy"** next to the token (it starts with `xoxb-`)
5. This is your `SLACK_BOT_TOKEN` for the `.env` file

**Note:** If you don't see the Bot Token, make sure you completed "Install to Workspace" in Step 3. The token only appears after installation.

## Step 5: Invite Bot to Channel

1. Go to the Slack channel where you want alerts
2. Type `/invite @YourBotName` or use the channel settings
3. Make sure the bot is a member of the channel

**Important for private channels:** The bot MUST be a member of private channels. Invite it using `/invite @YourBotName` in the channel.

## Step 6: Add to .env

Add the token to your `.env` file:
```env
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CHANNEL=#your-channel-name
```

**Channel format:**
- Include the `#` symbol: `#general`, `#alerts`, etc.
- For private channels: Make sure the bot is invited first, then use `#private-channel-name`
- Alternative: You can use the channel ID (starts with `C`) instead: `C1234567890`

That's it! Your bot should now be able to send messages to the specified channel.

