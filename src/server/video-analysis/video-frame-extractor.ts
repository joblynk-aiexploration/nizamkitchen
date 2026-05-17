// Placeholder — frame extraction requires ffmpeg or equivalent
// Not implemented for MVP. Shows a clear setup message instead of crashing.

export type FrameExtractionResult =
  | { success: true; frameTimestamps: number[]; frameCount: number }
  | { success: false; error: string };

export async function extractFramesFromVideo(
  _filePath: string,
  _intervalSeconds?: number,
): Promise<FrameExtractionResult> {
  return {
    success: false,
    error: "Video frame extraction is not configured. Install ffmpeg and configure LOCAL_VISION_MODEL_ENABLED=true to enable frame-based analysis.",
  };
}

export function isFrameExtractionAvailable(): boolean {
  return false; // Will be true when ffmpeg integration is implemented
}
