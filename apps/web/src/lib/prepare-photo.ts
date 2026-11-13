/** Larger photos are downscaled in the browser before upload. */
const DOWNSCALE_ABOVE_BYTES = 1024 * 1024;
const MAX_EDGE_PIXELS = 1600;

/**
 * Shrink a large photo before it is sent, so phone photos fit the upload
 * limit and arrive quickly. A format the browser cannot decode -- HEIC outside
 * Safari, say -- is sent as it is, and the server's own limit still applies.
 * Browser only.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (file.size <= DOWNSCALE_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PIXELS / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
