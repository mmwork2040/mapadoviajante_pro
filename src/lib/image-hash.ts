// Perceptual image hashing (dHash) used to detect visually similar images,
// not just files with the same name/size. Runs fully in the browser via canvas.

const HASH_SIZE = 8; // 8x9 sampling → 64-bit difference hash
export const PHASH_TAG_PREFIX = "phash:";

function bitsToHex(bits: number[]): string {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex += nibble.toString(16);
  }
  return hex;
}

function hashFromImage(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = HASH_SIZE + 1;
    canvas.height = HASH_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, HASH_SIZE + 1, HASH_SIZE);
    const { data } = ctx.getImageData(0, 0, HASH_SIZE + 1, HASH_SIZE);
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    const bits: number[] = [];
    for (let row = 0; row < HASH_SIZE; row++) {
      for (let col = 0; col < HASH_SIZE; col++) {
        const idx = row * (HASH_SIZE + 1) + col;
        bits.push(gray[idx] > gray[idx + 1] ? 1 : 0);
      }
    }
    return bitsToHex(bits);
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function computeImagePHashFromFile(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return img ? hashFromImage(img) : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function computeImagePHashFromUrl(url: string): Promise<string | null> {
  const img = await loadImage(url);
  return img ? hashFromImage(img) : null;
}

/** Number of differing bits between two hex dHashes. Returns Infinity if incomparable. */
export function hammingHex(a?: string | null, b?: string | null): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

export function phashToTag(hash: string): string {
  return `${PHASH_TAG_PREFIX}${hash}`;
}

export function getPhashFromTags(tags?: string[] | null): string | null {
  const tag = (tags || []).find((t) => t.startsWith(PHASH_TAG_PREFIX));
  return tag ? tag.slice(PHASH_TAG_PREFIX.length) : null;
}

/** Hide internal phash tags from the UI. */
export function visibleTags(tags?: string[] | null): string[] {
  return (tags || []).filter((t) => !t.startsWith(PHASH_TAG_PREFIX));
}

// Thresholds (out of 64 bits): near-identical vs. visually similar.
export const IDENTICAL_MAX_DISTANCE = 4;
export const SIMILAR_MAX_DISTANCE = 12;
