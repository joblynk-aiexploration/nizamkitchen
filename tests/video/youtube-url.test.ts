import { describe, expect, it } from "vitest";
import { parseYouTubeUrl, isYouTubeUrl, formatYouTubeDuration } from "@/lib/youtube";
import { isSafeUrl, sanitizeOptionalUrl } from "@/lib/media-url";

describe("parseYouTubeUrl", () => {
  it("parses standard watch URL", () => {
    const result = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("dQw4w9WgXcQ");
    expect(result!.normalizedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result!.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("parses youtube.com (no www) watch URL", () => {
    const result = parseYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be short link", () => {
    const result = parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("dQw4w9WgXcQ");
    expect(result!.normalizedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("parses YouTube Shorts URL", () => {
    const result = parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("dQw4w9WgXcQ");
  });

  it("parses YouTube embed URL", () => {
    const result = parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("dQw4w9WgXcQ");
  });

  it("parses URL with extra query params", () => {
    const result = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLxxx");
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-YouTube domain", () => {
    expect(parseYouTubeUrl("https://vimeo.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("rejects javascript: protocol", () => {
    expect(parseYouTubeUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects iframe HTML", () => {
    expect(parseYouTubeUrl('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')).toBeNull();
  });

  it("rejects data: URL", () => {
    expect(parseYouTubeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects URL with no video ID", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/")).toBeNull();
  });

  it("rejects malformed video ID (wrong length)", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=toolongvideoidentifier")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseYouTubeUrl("")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseYouTubeUrl(null as unknown as string)).toBeNull();
  });

  it("strips trailing whitespace", () => {
    const result = parseYouTubeUrl("  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ");
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("dQw4w9WgXcQ");
  });

  it("normalizes embed URL correctly", () => {
    const result = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result!.embedUrl).toMatch(/^https:\/\/www\.youtube\.com\/embed\/[A-Za-z0-9_-]{11}$/);
  });
});

describe("isYouTubeUrl", () => {
  it("returns true for valid YouTube URL", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("returns false for non-YouTube URL", () => {
    expect(isYouTubeUrl("https://example.com/video")).toBe(false);
  });
});

describe("formatYouTubeDuration", () => {
  it("formats seconds-only", () => {
    expect(formatYouTubeDuration(45)).toBe("0:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatYouTubeDuration(125)).toBe("2:05");
  });

  it("formats hours, minutes, seconds", () => {
    expect(formatYouTubeDuration(3661)).toBe("1:01:01");
  });

  it("pads minutes when hours present", () => {
    expect(formatYouTubeDuration(3600)).toBe("1:00:00");
  });
});

describe("isSafeUrl", () => {
  it("allows https URLs", () => {
    expect(isSafeUrl("https://example.com/path")).toBe(true);
  });

  it("allows http URLs", () => {
    expect(isSafeUrl("http://example.com/path")).toBe(true);
  });

  it("rejects javascript: protocol", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: protocol", () => {
    expect(isSafeUrl("data:text/html,hello")).toBe(false);
  });

  it("rejects vbscript: protocol", () => {
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects file: protocol", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects iframe HTML", () => {
    expect(isSafeUrl('<iframe src="https://example.com"></iframe>')).toBe(false);
  });

  it("rejects null", () => {
    expect(isSafeUrl(null)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isSafeUrl("")).toBe(false);
  });

  it("rejects unparseable string", () => {
    expect(isSafeUrl("not a url at all")).toBe(false);
  });
});

describe("sanitizeOptionalUrl", () => {
  it("returns URL when safe", () => {
    expect(sanitizeOptionalUrl("https://example.com")).toBe("https://example.com");
  });

  it("returns null for unsafe URL", () => {
    expect(sanitizeOptionalUrl("javascript:alert(1)")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(sanitizeOptionalUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(sanitizeOptionalUrl(undefined)).toBeNull();
  });

  it("trims whitespace from valid URL", () => {
    expect(sanitizeOptionalUrl("  https://example.com  ")).toBe("https://example.com");
  });
});
