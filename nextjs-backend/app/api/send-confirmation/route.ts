import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Resend API key not configured" },
      { status: 500 }
    );
  }
  try {
    const { userName, userEmail, filename } = await request.json();

    if (!userName || !userEmail || !filename) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Send email via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Speed Sermon <contributors@speedsermon.com>",
        to: [userEmail],
        subject: "Your Teleprompter Recording is Ready",
        html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #4CAF50;">Recording Uploaded Successfully!</h1>
                        <p>Hi ${userName},</p>
                        <p>Your teleprompter video recording has been successfully uploaded and processed.</p>
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Recording Details:</strong></p>
                            <p style="margin: 10px 0 0 0;">Uploaded: ${new Date().toLocaleString()}</p>
                            <p style="margin: 10px 0 0 0;">File: ${filename}</p>
                        </div>
                        <p>Your video has been securely stored and is ready for review.</p>
                        <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for using Speed Sermon Teleprompter!</p>
                    </div>
                `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
