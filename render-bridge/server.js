const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const https = require("https");
require("dotenv").config();

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.REALTIME_JWT_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!JWT_SECRET) {
  console.error("❌ REALTIME_JWT_SECRET environment variable is required");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 WebSocket bridge listening on port ${PORT}`);

// Track active connections
let connectionCount = 0;

wss.on("connection", (clientWs, req) => {
  const connectionId = ++connectionCount;
  console.log(
    `[${connectionId}] New connection from ${req.socket.remoteAddress}`
  );

  let isAuthenticated = false;
  let openaiWs = null;
  let authTimeout = null;

  // Require authentication within 5 seconds
  authTimeout = setTimeout(() => {
    if (!isAuthenticated) {
      console.log(`[${connectionId}] Authentication timeout`);
      clientWs.send(
        JSON.stringify({
          type: "error",
          message: "Authentication timeout",
        })
      );
      clientWs.close(4001, "Authentication timeout");
    }
  }, 5000);

  // Handle messages from client
  clientWs.on("message", async (data) => {
    try {
      // Convert to string first to check if it's JSON
      const dataStr = data.toString();

      // Try to parse as JSON
      let message;
      try {
        message = JSON.parse(dataStr);
        console.log(`[${connectionId}] Received JSON:`, message.type);
      } catch (e) {
        // Not JSON - treat as binary audio data (PCM16)
        if (
          isAuthenticated &&
          openaiWs &&
          openaiWs.readyState === WebSocket.OPEN
        ) {
          // Convert binary audio to base64 and send as input_audio_buffer.append event
          const audioBase64 = data.toString("base64");
          openaiWs.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: audioBase64,
            })
          );
        }
        return;
      }

      // Handle authentication
      if (message.type === "auth") {
        if (isAuthenticated) {
          console.log(`[${connectionId}] Already authenticated`);
          return;
        }

        const token = message.token;
        if (!token) {
          clientWs.send(
            JSON.stringify({
              type: "error",
              message: "No token provided",
            })
          );
          clientWs.close(4001, "No token provided");
          return;
        }

        // Verify JWT
        try {
          jwt.verify(token, JWT_SECRET);
          isAuthenticated = true;
          clearTimeout(authTimeout);
          console.log(`[${connectionId}] ✅ Authenticated`);

          // Connect to OpenAI Realtime API
          await connectToOpenAI(connectionId, clientWs);
        } catch (err) {
          console.log(`[${connectionId}] ❌ Invalid token: ${err.message}`);
          clientWs.send(
            JSON.stringify({
              type: "error",
              message: "Invalid token",
            })
          );
          clientWs.close(4001, "Invalid token");
        }
        return;
      }

      // All other messages require authentication
      if (!isAuthenticated) {
        clientWs.send(
          JSON.stringify({
            type: "error",
            message: "Not authenticated",
          })
        );
        return;
      }

      // Forward other messages to OpenAI
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify(message));
      }
    } catch (err) {
      console.error(`[${connectionId}] Error handling message:`, err);
      clientWs.send(
        JSON.stringify({
          type: "error",
          message: "Failed to process message",
        })
      );
    }
  });

  // Connect to OpenAI Realtime API
  async function connectToOpenAI(connId, clientSocket) {
    try {
      console.log(`[${connId}] Connecting to OpenAI Realtime API...`);

      // OpenAI Realtime API WebSocket URL
      const url =
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

      openaiWs = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      openaiWs.on("open", () => {
        console.log(`[${connId}] ✅ Connected to OpenAI Realtime API`);

        // Notify client of successful connection
        clientSocket.send(
          JSON.stringify({
            type: "connected",
            message: "Connected to OpenAI Realtime API",
          })
        );
      });

      openaiWs.on("message", (data) => {
        // Forward OpenAI messages to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(data);
        }
      });

      openaiWs.on("error", (error) => {
        console.error(`[${connId}] OpenAI WebSocket error:`, error);
        clientSocket.send(
          JSON.stringify({
            type: "error",
            message: "OpenAI connection error",
          })
        );
      });

      openaiWs.on("close", (code, reason) => {
        console.log(`[${connId}] OpenAI connection closed: ${code} ${reason}`);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(
            JSON.stringify({
              type: "disconnected",
              message: "OpenAI connection closed",
            })
          );
        }
      });
    } catch (err) {
      console.error(`[${connId}] Failed to connect to OpenAI:`, err);
      clientSocket.send(
        JSON.stringify({
          type: "error",
          message: "Failed to connect to OpenAI",
        })
      );
    }
  }

  // Handle client disconnect
  clientWs.on("close", (code, reason) => {
    console.log(`[${connectionId}] Client disconnected: ${code} ${reason}`);
    clearTimeout(authTimeout);
    if (openaiWs) {
      openaiWs.close();
    }
  });

  clientWs.on("error", (error) => {
    console.error(`[${connectionId}] Client WebSocket error:`, error);
  });
});

// Health check endpoint (for Render)
const http = require("http");
const healthServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        connections: wss.clients.size,
        uptime: process.uptime(),
      })
    );
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

const HEALTH_PORT = process.env.HEALTH_PORT || 8081;
healthServer.listen(HEALTH_PORT, () => {
  console.log(`🏥 Health check server on port ${HEALTH_PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing servers...");
  wss.close(() => {
    healthServer.close(() => {
      console.log("Servers closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, closing servers...");
  wss.close(() => {
    healthServer.close(() => {
      console.log("Servers closed");
      process.exit(0);
    });
  });
});
