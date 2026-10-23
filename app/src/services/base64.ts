const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP = new Int16Array(256).fill(-1);
for (let i = 0; i < ALPHABET.length; i += 1) {
  LOOKUP[ALPHABET.charCodeAt(i)] = i;
}

function valueOf(charCode: number): number {
  const value = charCode < 256 ? LOOKUP[charCode] : -1;
  if (value < 0) {
    throw new Error('Invalid base64 character');
  }
  return value;
}

/**
 * Pure-JS base64 decoder. Hermes does not guarantee `atob`, and the bundled
 * vector index must decode on device without pulling in a polyfill.
 */
export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[\s\r\n]/g, '');
  if (clean.length === 0) {
    return new Uint8Array(0);
  }
  if (clean.length % 4 === 1) {
    throw new Error('Invalid base64 length');
  }

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((clean.length * 3) / 4) - padding;
  const output = new Uint8Array(byteLength);

  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = valueOf(clean.charCodeAt(i));
    const c1 =
      i + 1 >= clean.length ? 0 : valueOf(clean.charCodeAt(i + 1));
    const c2 =
      i + 2 >= clean.length || clean.charCodeAt(i + 2) === 61 /* '=' */
        ? 0
        : valueOf(clean.charCodeAt(i + 2));
    const c3 =
      i + 3 >= clean.length || clean.charCodeAt(i + 3) === 61
        ? 0
        : valueOf(clean.charCodeAt(i + 3));

    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (outIndex < byteLength) {
      output[outIndex] = (triple >> 16) & 0xff;
      outIndex += 1;
    }
    if (outIndex < byteLength) {
      output[outIndex] = (triple >> 8) & 0xff;
      outIndex += 1;
    }
    if (outIndex < byteLength) {
      output[outIndex] = triple & 0xff;
      outIndex += 1;
    }
  }

  return output;
}

/** Convert little-endian float32 bytes to a Float32Array copy. */
export function bytesToFloat32(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % 4 !== 0) {
    throw new Error('Float32 payload length must be divisible by 4');
  }
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Float32Array(buffer);
}
