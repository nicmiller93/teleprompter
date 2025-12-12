import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!HEYGEN_API_KEY) {
    return NextResponse.json(
      { error: "HeyGen API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { uploadcareFileUrl, avatarName, userName, userEmail } =
      await request.json();

    if (!uploadcareFileUrl || !avatarName) {
      return NextResponse.json(
        { error: "Missing required fields: uploadcareFileUrl, avatarName" },
        { status: 400 }
      );
    }

    // Convert Uploadcare URL to direct video URL
    // Uploadcare CDN URLs are in the format: https://ucarecdn.com/{uuid}/
    // We need to ensure it's a direct .mp4 link
    const videoUrl = uploadcareFileUrl.endsWith("/")
      ? `${uploadcareFileUrl}video.mp4`
      : uploadcareFileUrl;

    // For now, we'll use the same video for both training footage and consent
    // In production, you might want separate consent video
    const requestBody = {
      training_footage_url: videoUrl,
      video_consent_url: videoUrl, // Using same video for consent
      avatar_name: avatarName,
      callback_id: `${userName}_${userEmail}_${Date.now()}`,
    };

    console.log("Submitting to HeyGen:", requestBody);

    // Submit to HeyGen API
    const response = await fetch("https://api.heygen.com/v2/video_avatar", {
      method: "POST",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HeyGen API error:", errorText);
      return NextResponse.json(
        { error: `HeyGen API failed: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Check if HeyGen returned an error
    if (result.error) {
      console.error("HeyGen returned error:", result.error);
      return NextResponse.json(
        { error: `HeyGen error: ${result.error}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      avatarId: result.data?.avatar_id,
      avatarGroupId: result.data?.avatar_group_id,
      message: "Avatar creation submitted successfully",
    });
  } catch (error) {
    console.error("Error creating avatar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
