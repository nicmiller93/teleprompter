# Render WebSocket Bridge - Implementation Plan

## Overview

Node.js WebSocket server that bridges between Framer client and OpenAI Realtime API.

## Architecture Flow

```
Framer Client
    ↓ (Fetch JWT)
Vercel /api/token → JWT Token
    ↓
Framer opens WebSocket → Render Bridge
    ↓ (Verify JWT)
Render validates token
    ↓ (Connect to OpenAI)
OpenAI Realtime API
    ↓ (Stream audio)
OpenAI processes speech
    ↓ (Return transcription)
Render Bridge → Framer
    ↓ (Auto-scroll)
Framer updates UI
```

## Required Files

### 1. `package.json`

Dependencies:

- `ws` - WebSocket server
- `jsonwebtoken` - JWT verification
- `dotenv` - Environment variables
- `express` (optional) - HTTP health checks

### 2. `server.js`

Main server file:

- Create WebSocket server
- Verify incoming JWT tokens
- Connect to OpenAI Realtime API
- Relay audio and transcription messages
- Handle errors and reconnections

### 3. `.env`

Environment variables:

```
PORT=8080
REALTIME_JWT_SECRET=WPEOEO8AWAbiPSgWUuqNJRKiXNOpwCHpEOGqHS7I+bw=
OPENAI_API_KEY=your-openai-api-key
```

### 4. `Dockerfile` or `render.yaml`

For Render deployment configuration

## Key Implementation Details

### JWT Verification

```javascript
const jwt = require("jsonwebtoken");

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.REALTIME_JWT_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

### WebSocket Message Types

**From Client → Bridge:**

- `auth`: Contains JWT token
- `audio`: Binary audio data (PCM16)
- `config`: Configuration updates

**From Bridge → Client:**

- `connected`: Successful connection
- `transcription`: Speech-to-text results
- `error`: Error messages

### OpenAI Realtime API Connection

- WebSocket URL: `wss://api.openai.com/v1/realtime`
- Model: `gpt-4o-realtime-preview-2024-10-01`
- Headers: `Authorization: Bearer ${OPENAI_API_KEY}`

## Security Checklist

- ✅ Verify JWT on every connection
- ✅ Use short-lived tokens (5 min)
- ✅ Store secrets in environment variables
- ✅ Validate message formats
- ✅ Rate limit connections per IP
- ✅ Close stale connections

## Deployment Steps (Render)

1. **Create new Web Service on Render**
2. **Connect to repository** (or use Docker)
3. **Set environment variables**:
   - `REALTIME_JWT_SECRET`
   - `OPENAI_API_KEY`
4. **Set build/start commands**:
   - Build: `npm install`
   - Start: `node server.js`
5. **Deploy and get WebSocket URL**

## Testing Plan

1. **Local testing**:

   ```bash
   node server.js
   # Test with wscat or custom client
   ```

2. **JWT verification test**:

   ```bash
   # Get token from Vercel
   TOKEN=$(curl -s https://speed-sermon-rttp.vercel.app/api/token | jq -r .token)

   # Connect with token
   wscat -c ws://localhost:8080 -H "Authorization: Bearer $TOKEN"
   ```

3. **OpenAI integration test**:
   - Send sample audio
   - Verify transcription response

## Next Actions

1. Create `render-bridge/` directory
2. Implement server.js with all features
3. Test locally
4. Deploy to Render
5. Update Framer component with Render URL
