---
applyTo: "**"
---

{
"project_name": "Speed Sermon Teleprompter Realtime",
"goal": "Build a voice-activated teleprompter using Framer (UI + audio), Next.js on Vercel (HTTP + JWT), and a Node WebSocket bridge on Render (OpenAI Realtime STT).",

"architecture": {
"framer": {
"role": [
"Display scrollable teleprompter UI",
"Capture mic audio and convert to PCM",
"Fetch short-lived JWT from Vercel",
"Open WebSocket to Render bridge",
"Send audio stream and receive STT events",
"Advance script segments based on transcription"
]
},
"next_vercel": {
"role": [
"Provide /api/token endpoint",
"Sign short-lived JWTs (HS256, 5–10 min)",
"Store REALTIME_JWT_SECRET",
"Provide future HTTP APIs",
"No WebSockets here"
]
},
"render_ws_bridge": {
"role": [
"Node service running ws library",
"Verify JWTs using REALTIME_JWT_SECRET",
"Open WS connection to OpenAI Realtime",
"Stream audio → OpenAI, relay STT → client",
"Store OPENAI_API_KEY"
]
},
"openai_realtime": {
"model": "gpt-4o-realtime-preview",
"function": "Low-latency speech-to-text over WebSocket"
}
},

"security": {
"OPENAI_API_KEY": "Render only",
"REALTIME_JWT_SECRET": "Shared between Vercel and Render",
"client_tokens": "Framer receives short-lived JWT only"
},

"tools": {
"ide": "VS Code with GitHub Copilot",
"terminal": "Warp",
"runtime": "Node 20+"
},

"milestones": [
"Implement /api/token in Next.js",
"Deploy Render WS bridge with JWT verification",
"Connect Framer teleprompter to Render WS (log messages)",
"Implement audio streaming and OpenAI Realtime integration",
"Add transcription-driven auto-scroll logic",
"Polish UX and add fail-safes"
],

"non_goals": [
"No WebSocket hosting on Vercel",
"No Firebase for realtime",
"No shadcn for this feature"
]
}
