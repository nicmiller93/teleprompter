import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.REALTIME_JWT_SECRET;

    if (!secret) {
      console.error("REALTIME_JWT_SECRET is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Optional: Add rate limiting or user authentication here
    // For now, we'll generate a token for any request

    // Generate a short-lived JWT (5 minutes)
    const token = jwt.sign(
      {
        iat: Math.floor(Date.now() / 1000),
        // You can add additional claims here like userId if you have auth
      },
      secret,
      {
        algorithm: "HS256",
        expiresIn: "5m", // 5 minutes
      }
    );

    return NextResponse.json(
      {
        token,
        expiresIn: 300, // 5 minutes in seconds
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Error generating token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
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
