# Teleprompter WebSocket Bridge

WebSocket server that bridges between Framer client and OpenAI Realtime API with JWT authentication.

## Features

- ✅ JWT token verification (from Vercel endpoint)
- ✅ WebSocket connection to OpenAI Realtime API
- ✅ Bidirectional audio/text streaming
- ✅ Automatic session configuration
- ✅ Health check endpoint
- ✅ Connection timeout and error handling

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and set:

- `REALTIME_JWT_SECRET`: Must match the secret in Vercel (already set)
- `OPENAI_API_KEY`: Your OpenAI API key from https://platform.openai.com/api-keys

### 3. Test Locally

```bash
npm start
```

Server will start on port 8080 (WebSocket) and 8081 (health check).

## API

### WebSocket Connection

**URL**: `ws://localhost:8080` (local) or `wss://your-app.onrender.com` (production)

### Message Types

#### From Client → Bridge

**1. Authentication** (required first):

```json
{
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**2. Audio Data**:
Send binary PCM16 audio data directly (after authentication)

**3. Control Messages**:

```json
{
  "type": "session.update",
  "session": {
    /* configuration */
  }
}
```

#### From Bridge → Client

**1. Connection Status**:

```json
{
  "type": "connected",
  "message": "Connected to OpenAI Realtime API"
}
```

**2. Transcription Results**:

```json
{
  "type": "conversation.item.input_audio_transcription.completed",
  "transcript": "transcribed text here"
}
```

**3. Errors**:

```json
{
  "type": "error",
  "message": "error description"
}
```

### Health Check Endpoint

**URL**: `GET /health`

**Response**:

```json
{
  "status": "ok",
  "connections": 2,
  "uptime": 12345.67
}
```

## Deployment to Render

### Option 1: Deploy from GitHub

1. Push this code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository
5. Configure:
   - **Name**: `teleprompter-ws-bridge`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add Environment Variables:
   - `REALTIME_JWT_SECRET`: `WPEOEO8AWAbiPSgWUuqNJRKiXNOpwCHpEOGqHS7I+bw=`
   - `OPENAI_API_KEY`: Your OpenAI API key
7. Click **"Create Web Service"**

### Option 2: Deploy with Render CLI

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy
render deploy
```

## Testing

### 1. Get JWT Token

```bash
TOKEN=$(curl -s https://speed-sermon-rttp.vercel.app/api/token | jq -r .token)
echo $TOKEN
```

### 2. Connect with wscat

```bash
npm install -g wscat

# Connect
wscat -c ws://localhost:8080

# Authenticate (paste your token)
{"type":"auth","token":"YOUR_TOKEN_HERE"}

# You should see: {"type":"connected","message":"Connected to OpenAI Realtime API"}
```

### 3. Test with Audio

See `test-client.js` for a complete test client example.

## Architecture

```
Framer Client
    ↓
[1] Fetch JWT from https://speed-sermon-rttp.vercel.app/api/token
    ↓
[2] Connect WebSocket to wss://your-bridge.onrender.com
    ↓
[3] Send auth message with JWT
    ↓
[4] Bridge verifies JWT and connects to OpenAI
    ↓
[5] Client sends audio → Bridge → OpenAI
    ↓
[6] OpenAI sends transcription → Bridge → Client
    ↓
[7] Client updates teleprompter UI
```

## Security

- ✅ JWT tokens expire after 5 minutes
- ✅ Authentication required before any data transfer
- ✅ 5-second authentication timeout
- ✅ OpenAI API key never exposed to client
- ✅ All secrets in environment variables

## Troubleshooting

### "Authentication timeout"

- Make sure you send the `auth` message within 5 seconds of connecting

### "Invalid token"

- Token may have expired (5 min lifetime)
- JWT secret might not match between Vercel and Render
- Fetch a new token from Vercel endpoint

### "Failed to connect to OpenAI"

- Check your `OPENAI_API_KEY` is valid
- Ensure you have access to the Realtime API (may require waitlist)

## Next Steps

After deploying:

1. Note your Render WebSocket URL (e.g., `wss://teleprompter-ws-bridge.onrender.com`)
2. Update the Framer component to:
   - Fetch token from Vercel: `https://speed-sermon-rttp.vercel.app/api/token`
   - Connect to this WebSocket bridge
   - Send audio and receive transcriptions
