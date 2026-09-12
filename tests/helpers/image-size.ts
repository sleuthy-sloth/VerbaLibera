import { readFileSync } from "node:fs";

/**
 * Image dimensions without a dependency.
 *
 * The image-dimension guard has to run in CI, where Pillow is not installed, so
 * the two header formats the repo actually ships are read directly: PNG's IHDR
 * and JPEG's start-of-frame marker. Anything else returns null and the caller
 * says so rather than guessing.
 */
export type Dimensions = { width: number; height: number };

export function imageDimensions(path: string): Dimensions | null {
  const buffer = readFileSync(path);
  if (buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a")
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF0..SOF15, minus the markers that are not frame headers.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      const length = buffer.readUInt16BE(offset + 2);
      if (!length) break;
      offset += 2 + length;
    }
  }
  return null;
}
