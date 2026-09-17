import { describe, expect, it } from "vitest";
import {
  FILE_RESPONSE_HEADERS,
  isInlineImageMime,
  looksLikeVideo,
  sniffImageMime,
  storedGenericMime,
} from "../../lib/uploads";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00", "latin1");
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>');
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42")]);

describe("upload type checks", () => {
  it("recognises raster images by their bytes, never SVG", () => {
    expect(sniffImageMime(PNG)).toBe("image/png");
    expect(sniffImageMime(JPEG)).toBe("image/jpeg");
    expect(sniffImageMime(GIF)).toBe("image/gif");
    expect(sniffImageMime(WEBP)).toBe("image/webp");
    expect(sniffImageMime(SVG)).toBeNull();
    expect(sniffImageMime(Buffer.from("<html><script>x</script>"))).toBeNull();
    expect(isInlineImageMime("image/svg+xml")).toBe(false);
    expect(isInlineImageMime("image/png")).toBe(true);
  });

  it("stores brand files with a safe type: SVG and HTML become downloads", () => {
    expect(storedGenericMime("image/svg+xml", SVG)).toBe("application/octet-stream");
    expect(storedGenericMime("text/html", Buffer.from("<html>"))).toBe("application/octet-stream");
    // declarado PNG, mas é SVG
    expect(storedGenericMime("image/png", SVG)).toBe("application/octet-stream");
    // declarado qualquer coisa, mas os bytes são PNG
    expect(storedGenericMime("application/octet-stream", PNG)).toBe("image/png");
    expect(storedGenericMime("application/pdf", Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(storedGenericMime("", Buffer.from("8BPS"))).toBe("application/octet-stream");
  });

  it("recognises videos and sandboxes every served file", () => {
    expect(looksLikeVideo(MP4)).toBe(true);
    expect(looksLikeVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]))).toBe(true);
    expect(looksLikeVideo(SVG)).toBe(false);
    expect(FILE_RESPONSE_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(FILE_RESPONSE_HEADERS["Content-Security-Policy"]).toContain("sandbox");
    expect(FILE_RESPONSE_HEADERS["Content-Security-Policy"]).toContain("default-src 'none'");
  });
});
