# Deploy WebSocket Bridge to Render

## Quick Deploy Steps

### 1. Go to Render Dashboard

Visit: https://dashboard.render.com/

### 2. Create New Web Service

- Click **"New +"** button (top right)
- Select **"Web Service"**

### 3. Connect GitHub Repository

- Click **"Connect GitHub"** (if not already connected)
- Find and select: `nicmiller93/teleprompter`
- Click **"Connect"**

### 4. Configure the Service

**Basic Settings:**

- **Name**: `teleprompter-ws-bridge` (or any name you prefer)
- **Region**: Choose closest to you (e.g., Oregon US West)
- **Branch**: `main`
- **Root Directory**: `render-bridge`
- **Runtime**: `Node`

**Build & Deploy:**

- **Build Command**: `npm install`
- **Start Command**: `node server.js`

### 5. Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these two variables:

**Variable 1:**

- **Key**: `REALTIME_JWT_SECRET`
- **Value**: `WPEOEO8AWAbiPSgWUuqNJRKiXNOpwCHpEOGqHS7I+bw=`

**Variable 2:**

- **Key**: `OPENAI_API_KEY`
- **Value**: (your OpenAI API key from `.env` file)

### 6. Deploy!

- Click **"Create Web Service"**
- Wait for deployment (2-3 minutes)
- Once deployed, you'll get a URL like: `https://teleprompter-ws-bridge.onrender.com`

### 7. Test the Deployment

Once deployed, test with:

```bash
# Get a token
TOKEN=$(curl -s https://speed-sermon-rttp.vercel.app/api/token | jq -r .token)

# Test connection (replace with your Render URL)
wscat -c wss://your-app.onrender.com

# Then send:
{"type":"auth","token":"PASTE_TOKEN_HERE"}
```

## Troubleshooting

### Deployment Failed

- Check the logs in Render dashboard
- Ensure environment variables are set correctly
- Verify the root directory is `render-bridge`

### Can't Connect

- Ensure service is running (check Render dashboard)
- Verify WebSocket URL uses `wss://` (not `ws://`)
- Check JWT secret matches Vercel

### Health Check Failing

- The app exposes port 8080 for WebSocket
- Health endpoint is on port 8081

## Next Steps

After deployment:

1. Note your Render WebSocket URL
2. Update Framer component with:
   - Vercel token URL: `https://speed-sermon-rttp.vercel.app/api/token`
   - WebSocket URL: Your Render URL (e.g., `wss://teleprompter-ws-bridge.onrender.com`)
