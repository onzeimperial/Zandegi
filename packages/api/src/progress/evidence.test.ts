import { describe, expect, it } from "vitest";
import { MAX_EVIDENCE_PHOTO_BYTES } from "../client";
import { GenerationError } from "../errors";
import { fingerprintPhoto, sniffPhotoType } from "./evidence";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("sniffing a photo from its bytes", () => {
  it("recognises the accepted formats from their leading bytes", () => {
    expect(sniffPhotoType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffPhotoType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffPhotoType(text("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffPhotoType(text("\0\0\0\x18ftypheic"))).toBe("image/heic");
  });

  it("refuses SVG, which can carry script, and anything else", () => {
    expect(sniffPhotoType(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffPhotoType(text("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffPhotoType(text("MZ\x90\0"))).toBeNull(); // a Windows executable
    expect(sniffPhotoType(bytes())).toBeNull();
  });
});

describe("fingerprinting a photo", () => {
  it("keeps the SHA-256, size and sniffed type, and nothing else", async () => {
    const photo = bytes(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3);
    const fingerprint = await fingerprintPhoto(photo);

    expect(Object.keys(fingerprint).sort()).toEqual(["bytes", "mediaType", "sha256"]);
    expect(fingerprint.mediaType).toBe("image/jpeg");
    expect(fingerprint.bytes).toBe(7);
    expect(fingerprint.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives the same photo the same fingerprint", async () => {
    const photo = bytes(0xff, 0xd8, 0xff, 9, 9, 9);
    expect((await fingerprintPhoto(photo)).sha256).toBe((await fingerprintPhoto(photo)).sha256);
  });

  it("rejects an empty file, a non-photo and an oversized photo", async () => {
    for (const photo of [
      bytes(),
      text("not a photo"),
      new Uint8Array(MAX_EVIDENCE_PHOTO_BYTES + 1).fill(0xff),
    ]) {
      await expect(fingerprintPhoto(photo)).rejects.toBeInstanceOf(GenerationError);
    }
  });
});
