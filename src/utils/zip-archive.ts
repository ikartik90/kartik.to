// A minimal zip writer: STORED entries, UTF-8 names, little-endian, no zip64.

export interface ZipEntry {
  name: string;
  text: string;
}

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

const STORED = 0;
const UTF8_NAMES = 0x0800;
const VERSION = 20;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Numbers a duplicate before its extension, and adds the result to `taken`. */
export function uniqueEntryName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }

  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";

  let n = 2;
  let candidate = `${stem}-${n}${extension}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${stem}-${n}${extension}`;
  }

  taken.add(candidate);
  return candidate;
}

/** MS-DOS format: seconds in two-second steps, years from 1980. */
function dosStamp(at: Date): { time: number; date: number } {
  return {
    time:
      (at.getHours() << 11) |
      (at.getMinutes() << 5) |
      (Math.floor(at.getSeconds() / 2) & 0x1f),
    date:
      ((Math.max(at.getFullYear() - 1980, 0) & 0x7f) << 9) |
      ((at.getMonth() + 1) << 5) |
      at.getDate(),
  };
}

export function zipArchive(entries: ZipEntry[], now = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosStamp(now);

  const files = entries.map((entry) => ({
    name: encoder.encode(entry.name),
    data: encoder.encode(entry.text),
  }));

  const localSize = files.reduce(
    (total, file) => total + 30 + file.name.length + file.data.length,
    0,
  );
  const directorySize = files.reduce(
    (total, file) => total + 46 + file.name.length,
    0,
  );

  const bytes = new Uint8Array(localSize + directorySize + 22);
  const view = new DataView(bytes.buffer);
  let at = 0;

  const offsets: number[] = [];
  const checksums: number[] = [];

  for (const file of files) {
    offsets.push(at);
    const crc = crc32(file.data);
    checksums.push(crc);

    view.setUint32(at, LOCAL_FILE_HEADER, true);
    view.setUint16(at + 4, VERSION, true);
    view.setUint16(at + 6, UTF8_NAMES, true);
    view.setUint16(at + 8, STORED, true);
    view.setUint16(at + 10, time, true);
    view.setUint16(at + 12, date, true);
    view.setUint32(at + 14, crc, true);
    // Stored, so the compressed and uncompressed sizes are the same number.
    view.setUint32(at + 18, file.data.length, true);
    view.setUint32(at + 22, file.data.length, true);
    view.setUint16(at + 26, file.name.length, true);
    view.setUint16(at + 28, 0, true);
    at += 30;

    bytes.set(file.name, at);
    at += file.name.length;
    bytes.set(file.data, at);
    at += file.data.length;
  }

  const directoryAt = at;

  files.forEach((file, index) => {
    view.setUint32(at, CENTRAL_FILE_HEADER, true);
    view.setUint16(at + 4, VERSION, true);
    view.setUint16(at + 6, VERSION, true);
    view.setUint16(at + 8, UTF8_NAMES, true);
    view.setUint16(at + 10, STORED, true);
    view.setUint16(at + 12, time, true);
    view.setUint16(at + 14, date, true);
    view.setUint32(at + 16, checksums[index], true);
    view.setUint32(at + 20, file.data.length, true);
    view.setUint32(at + 24, file.data.length, true);
    view.setUint16(at + 28, file.name.length, true);
    // The zeroed fields are already in the buffer; only the offset is written.
    view.setUint32(at + 42, offsets[index], true);
    at += 46;

    bytes.set(file.name, at);
    at += file.name.length;
  });

  view.setUint32(at, END_OF_CENTRAL_DIRECTORY, true);
  view.setUint16(at + 8, files.length, true);
  view.setUint16(at + 10, files.length, true);
  view.setUint32(at + 12, directoryAt === 0 ? 0 : at - directoryAt, true);
  view.setUint32(at + 16, directoryAt, true);

  return bytes;
}
