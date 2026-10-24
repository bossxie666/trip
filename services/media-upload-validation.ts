export const maxImageBytes = 10 * 1024 * 1024;

/** Check bytes, not the browser-supplied MIME or filename. This is not a decoder. */
export function assertImageSignature(contentType: string, input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const matches = (signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  let valid = false;
  if (contentType === "image/jpeg") valid = bytes.length >= 4 && matches([0xff, 0xd8, 0xff]);
  if (contentType === "image/png") valid = matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === "image/webp") valid = bytes.length >= 16 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(text(12, 4));
  if (contentType === "image/heic" || contentType === "image/heif") {
    // ISO-BMFF major brands used by HEIF/HEIC. Do not accept arbitrary MP4/AVIF.
    // Both MIME labels occur for the same iPhone container family.
    const boxSize = bytes.length >= 4 ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0) : 0;
    valid = bytes.length >= 16 && boxSize >= 16 && text(4, 4) === "ftyp" && ["mif1", "msf1", "heic", "heix", "hevc", "hevx"].includes(text(8, 4));
  }
  if (!valid) throw new Error("MEDIA_UPLOAD_INVALID_TYPE");
}

/** Bound reads even when Content-Length is absent or dishonest. */
export async function readUploadBody(request: Request, limit = maxImageBytes): Promise<ArrayBuffer> {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > limit) {
    await request.body?.cancel().catch(() => {});
    throw new Error("MEDIA_UPLOAD_TOO_LARGE");
  }
  if (!request.body) throw new Error("MEDIA_UPLOAD_MISMATCH");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        throw new Error("MEDIA_UPLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
