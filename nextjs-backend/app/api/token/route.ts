import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Session configuration for OpenAI Realtime API
    // Configure for transcription only - no AI responses
    const sessionConfig = {
      session: {
        type: "realtime",
        model: "gpt-realtime",
        turn_detection: null, // Disable automatic turn detection to prevent responses
        input_audio_transcription: {
          model: "whisper-1",
        },
      },
    };

    // Request ephemeral key from OpenAI
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionConfig),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to generate ephemeral key" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-API-Version": "webrtc",
      },
    });
  } catch (error) {
    console.error("Error generating ephemeral key:", error);
    return NextResponse.json(
      { error: "Failed to generate ephemeral key" },
      { status: 500 }
    );
  }
}

// CORS headers for Framer
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
