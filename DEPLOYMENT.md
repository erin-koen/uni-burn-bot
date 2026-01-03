# Deployment Guide

This bot can be deployed to various cloud services. Here are recommended options:

## Recommended Cloud Services

### 1. **Railway** (Easiest)
- Simple deployment from GitHub
- Automatic environment variable management
- Free tier available
- Persistent storage for SQLite database

**Steps:**
1. Push code to GitHub
2. Connect Railway to your repo
3. Add environment variables in Railway dashboard
4. Deploy

### 2. **Render**
- Free tier for background workers
- Easy GitHub integration
- Environment variable management

**Steps:**
1. Create a new "Background Worker" service
2. Connect your GitHub repo
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables

### 3. **Fly.io**
- Good for long-running processes
- Free tier available
- Persistent volumes for database

**Steps:**
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Run `fly launch` in project directory
3. Configure persistent volume for database
4. Deploy with `fly deploy`

### 4. **AWS EC2 / Lightsail**
- More control, requires more setup
- Good for production workloads
- Use PM2 or systemd to keep process running

### 5. **Heroku**
- Simple deployment
- Requires credit card for background workers
- Use Heroku Postgres instead of SQLite for better persistence

## Environment Variables

Make sure to set these in your cloud service:

```
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
TOKEN_ADDRESS=0x...
RECIPIENT_ADDRESS=0x...
AMOUNT=1000000000000000000
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL=#your-channel
POLL_INTERVAL=30
```

## Important Considerations

### Database Persistence

**SQLite (current setup):**
- Works fine for single-instance deployments
- Database file needs persistent storage
- Not suitable for multi-instance deployments

**For production/multi-instance, consider:**
- PostgreSQL (via Railway, Render, or Heroku)
- MongoDB Atlas
- Supabase

### Process Management

The bot runs continuously. Cloud services handle this, but for self-hosted:
- Use PM2: `npm install -g pm2 && pm2 start dist/bot.js`
- Use systemd on Linux
- Use Docker with restart policies

### Monitoring

Consider adding:
- Health check endpoint (optional)
- Logging service (Datadog, Logtail, etc.)
- Uptime monitoring (UptimeRobot, Pingdom)

## Docker Deployment (Optional)

If you want to containerize:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/bot.js"]
```

Then deploy to:
- Railway
- Fly.io
- AWS ECS/Fargate
- Google Cloud Run
- Azure Container Instances

