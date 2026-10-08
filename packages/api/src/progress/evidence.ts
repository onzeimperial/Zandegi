/**
 * Checking a photo offered as evidence, then letting it go.
 *
 * The type is decided from the file's own leading bytes, never from its name
 * or the browser's declared type -- both are trivially set to anything. Only a
 * narrow allowlist of raster formats is accepted; SVG and anything else that
 * can carry active content is refused (AD-10).
 *
 * What is kept is a fingerprint: the SHA-256 of the bytes, their size and the
 * sniffed type. The bytes themselves are discarded. This checks that the file
 * *is* a photo. It does not check that the photo *shows* the step -- that is
 * AD-10's review lifecycle, which the demo does not have.
 */

import { MAX_EVIDENCE_PHOTO_BYTES } from "../client";
import { GenerationError } from "../errors";
import type { PhotoFingerprint } from "./ledger";

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

/** HEIF brands an iPhone photo can carry in its `ftyp` box. */
const HEIF_BRANDS = ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"];

/** The media type the bytes actually are, or `null` if not an accepted photo. */
export function sniffPhotoType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  if (startsWith(bytes, ascii("ftyp"), 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (HEIF_BRANDS.includes(brand)) return "image/heic";
  }
  return null;
}

function toHex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Check a photo and return its fingerprint. Throws `EVIDENCE_REJECTED`. */
export async function fingerprintPhoto(bytes: Uint8Array): Promise<PhotoFingerprint> {
  if (bytes.length === 0) throw new GenerationError("EVIDENCE_REJECTED", "empty file");
  if (bytes.length > MAX_EVIDENCE_PHOTO_BYTES) {
    throw new GenerationError("EVIDENCE_REJECTED", `photo of ${bytes.length} bytes over the limit`);
  }
  const mediaType = sniffPhotoType(bytes);
  if (mediaType === null) {
    throw new GenerationError("EVIDENCE_REJECTED", "leading bytes are not an accepted photo type");
  }
  return {
    // A fresh copy: under the DOM library typings `digest` requires an
    // ArrayBuffer-backed array, and the caller's may sit on a shared buffer.
    sha256: toHex(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))),
    bytes: bytes.length,
    mediaType,
  };
}
