import {bytesToFloat32, decodeBase64} from '../src/services/base64';

declare const btoa: (data: string) => string;

describe('base64', () => {
  it('decodes known bytes', () => {
    // "hello" -> aGVsbG8=
    expect(Array.from(decodeBase64('aGVsbG8='))).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });

  it('round-trips float32 little-endian bytes', () => {
    const source = new Float32Array([1, -2.5, 3.25, 0]);
    const bytes = new Uint8Array(source.buffer.slice(0));
    const binary = Array.from(bytes)
      .map((byte) => String.fromCharCode(byte))
      .join('');
    const encoded = btoa(binary);

    const decoded = bytesToFloat32(decodeBase64(encoded));

    expect(Array.from(decoded)).toEqual(Array.from(source));
  });

  it('handles unpadded base64', () => {
    expect(Array.from(decodeBase64('aGVsbG8'))).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });

  it('rejects invalid input', () => {
    expect(() => decodeBase64('!!!!')).toThrow();
    expect(() => bytesToFloat32(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
