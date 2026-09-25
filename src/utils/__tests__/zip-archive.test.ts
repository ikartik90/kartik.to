import { describe, it, expect } from "vitest";
import { crc32, uniqueEntryName, zipArchive } from "../zip-archive";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;

/** Reads the archive back as an unzipper does: from the tail's end-of-directory record inward. */
function readArchive(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();

  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== END_OF_DIRECTORY) end -= 1;
  expect(end).toBeGreaterThanOrEqual(0);

  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryAt = view.getUint32(end + 16, true);
  expect(directoryAt + directorySize).toBe(end);

  const entries: { name: string; text: string; crc: number }[] = [];
  let cursor = directoryAt;

  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(cursor, true)).toBe(CENTRAL_HEADER);
    const nameLength = view.getUint16(cursor + 28, true);
    const localAt = view.getUint32(cursor + 42, true);
    cursor += 46 + nameLength;

    expect(view.getUint32(localAt, true)).toBe(LOCAL_HEADER);
    const crc = view.getUint32(localAt + 14, true);
    const size = view.getUint32(localAt + 18, true);
    const localNameLength = view.getUint16(localAt + 26, true);
    const extraLength = view.getUint16(localAt + 28, true);
    const nameAt = localAt + 30;
    const dataAt = nameAt + localNameLength + extraLength;

    entries.push({
      name: decoder.decode(bytes.subarray(nameAt, nameAt + localNameLength)),
      text: decoder.decode(bytes.subarray(dataAt, dataAt + size)),
      crc,
    });
  }

  return entries;
}

describe("crc32", () => {
  it("agrees with the published checksums", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("zipArchive", () => {
  it("holds every file it was given, under its own name", () => {
    const bytes = zipArchive([
      { name: "check.svg", text: "<svg/>" },
      { name: "close.svg", text: "<svg><path d='M1 1'/></svg>" },
    ]);

    const entries = readArchive(bytes);
    expect(entries.map((entry) => entry.name)).toEqual(["check.svg", "close.svg"]);
    expect(entries[1].text).toBe("<svg><path d='M1 1'/></svg>");
  });

  it("checksums each file so an unzipper can prove it arrived whole", () => {
    const bytes = zipArchive([{ name: "a.svg", text: "hello" }]);
    expect(readArchive(bytes)[0].crc).toBe(0x3610a686);
  });

  it("counts bytes rather than characters", () => {
    // An en dash is three UTF-8 bytes in a one-character string.
    const bytes = zipArchive([{ name: "dash.svg", text: "–" }]);
    expect(readArchive(bytes)[0].text).toBe("–");
  });

  it("writes an empty archive rather than refusing one", () => {
    expect(readArchive(zipArchive([]))).toEqual([]);
  });
});

describe("uniqueEntryName", () => {
  it("leaves a name nothing else has taken", () => {
    expect(uniqueEntryName("check.svg", new Set())).toBe("check.svg");
  });

  it("numbers a repeat before its extension", () => {
    const taken = new Set(["check.svg"]);
    expect(uniqueEntryName("check.svg", taken)).toBe("check-2.svg");
  });

  it("keeps counting past the second", () => {
    const taken = new Set(["check.svg", "check-2.svg"]);
    expect(uniqueEntryName("check.svg", taken)).toBe("check-3.svg");
  });

  it("numbers a name with no extension at its end", () => {
    expect(uniqueEntryName("check", new Set(["check"]))).toBe("check-2");
  });
});
