# Architecture Update: WebRTC Implementation

## Overview

The teleprompter now uses **WebRTC** for direct browser-to-OpenAI connections, eliminating the need for the Render WebSocket bridge.

## New Architecture

```
Framer Component (Browser)
    ↓ (1. Request ephemeral key)
Vercel API (/api/token)
    ↓ (2. Request from OpenAI API)
OpenAI REST API (/v1/realtime/client_secrets)
    ↓ (3. Return ephemeral key)
Vercel → Framer
    ↓ (4. Establish WebRTC peer connection)
OpenAI Realtime API (Direct WebRTC)
```

## Benefits

### 1. **Lower Latency**

- Direct peer-to-peer connection between browser and OpenAI
- No intermediate server processing audio
- Faster transcription response

### 2. **Simpler Architecture**

- Only 2 services instead of 3 (removed Render bridge)
- No WebSocket management
- No manual audio format conversion

### 3. **Better Performance**

- WebRTC handles audio streaming natively
- Automatic quality adaptation
- Built-in error correction

### 4. **Lower Costs**

- No Render server costs
- Reduced data transfer overhead
- More efficient resource usage

## Technical Details

### Components

**1. Framer Component (`teleprompter-realtime.tsx`)**

- Uses `RTCPeerConnection` for WebRTC
- `RTCDataChannel` for receiving transcription events
- Native browser audio handling (no manual PCM conversion)

**2. Vercel API (`/api/token`)**

- Requests ephemeral keys from OpenAI
- Configures session (model, voice, transcription)
- Returns short-lived client secret

**3. OpenAI Realtime API**

- Direct WebRTC peer connection
- Speech-to-text transcription
- Server-side voice activity detection (VAD)

### Session Configuration

```typescript
{
  type: "realtime",
  model: "gpt-realtime",
  modalities: ["text", "audio"],
  audio: {
    input: { format: "pcm16", sample_rate: 24000 },
    output: { voice: "alloy", format: "pcm16", sample_rate: 24000 }
  },
  input_audio_transcription: {
    enabled: true,
    model: "whisper-1"
  },
  turn_detection: {
    enabled: true,
    type: "server_vad",
    threshold: 0.5,
    silence_duration_ms: 500
  }
}
```

## Deployment

### Vercel

1. Set environment variable: `OPENAI_API_KEY`
2. Deploy from GitHub: `git push`
3. Vercel auto-deploys

### Render Bridge

**No longer needed** - can be deleted or kept for reference

### Framer

1. Copy updated `teleprompter-realtime.tsx`
2. Paste into Framer Code Component
3. Test with voice control

## Migration Notes

### What Changed

- ❌ Removed: WebSocket connection to Render bridge
- ❌ Removed: Manual PCM16 audio conversion
- ❌ Removed: ScriptProcessorNode audio capture
- ✅ Added: RTCPeerConnection with WebRTC
- ✅ Added: Native audio track handling
- ✅ Added: Ephemeral key generation

### Environment Variables

**Before:**

- Vercel: `REALTIME_JWT_SECRET`
- Render: `REALTIME_JWT_SECRET`, `OPENAI_API_KEY`

**After:**

- Vercel: `OPENAI_API_KEY` only
- Render: Not needed

## References

- [OpenAI Realtime API - WebRTC](https://platform.openai.com/docs/guides/realtime-webrtc)
- [WebRTC API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
