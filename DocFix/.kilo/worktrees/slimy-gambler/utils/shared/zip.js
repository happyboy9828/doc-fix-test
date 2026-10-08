// Shared ZIP writer (store method).
//
// Store only, on purpose: PNG, JPG and WebP payloads are already compressed, so
// deflating them again costs CPU and saves nothing. Only text payloads (JSON,
// HTML snippets) would benefit, and those are tiny.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Raw DEFLATE stream, used by the PNG encoder in JpgToPng.
export async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_HEADER = 0x06054b50;
const UTF8_NAMES = 0x0800;
const VERSION = 20;
const STORED = 0;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_SIZE = 22;

// ZIP stores entries in DOS date/time, so years before 1980 are not encodable.
function dosDateTime(now) {
  return {
    time: (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1),
    date: ((Math.max(now.getFullYear(), 1980) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
  };
}

function uniqueName(name, seen) {
  const count = seen.get(name) || 0;
  seen.set(name, count + 1);
  if (!count) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  return stem + "-" + count + extension;
}

// entries: [{ name, data }] with `data` a Uint8Array. Repeated names get a
// numeric suffix so the archive never contains two identical paths.
export function createZip(entries) {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const seen = new Map();

  const items = entries.map((entry) => {
    const data = entry.data;
    return { nameBytes: encoder.encode(uniqueName(entry.name, seen)), data, crc: crc32(data) };
  });

  const size = items.reduce(
    (total, item) =>
      total + LOCAL_HEADER_SIZE + CENTRAL_HEADER_SIZE + item.nameBytes.length * 2 + item.data.length,
    END_SIZE
  );
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let pointer = 0;
  let offset = 0;

  items.forEach((item) => {
    item.offset = offset;
    view.setUint32(pointer, LOCAL_HEADER, true);
    view.setUint16(pointer + 4, VERSION, true);
    view.setUint16(pointer + 6, UTF8_NAMES, true);
    view.setUint16(pointer + 8, STORED, true);
    view.setUint16(pointer + 10, time, true);
    view.setUint16(pointer + 12, date, true);
    view.setUint32(pointer + 14, item.crc, true);
    view.setUint32(pointer + 18, item.data.length, true);
    view.setUint32(pointer + 22, item.data.length, true);
    view.setUint16(pointer + 26, item.nameBytes.length, true);
    out.set(item.nameBytes, pointer + LOCAL_HEADER_SIZE);
    out.set(item.data, pointer + LOCAL_HEADER_SIZE + item.nameBytes.length);

    const next = pointer + LOCAL_HEADER_SIZE + item.nameBytes.length + item.data.length;
    offset = next;
    pointer = next;
  });

  const centralStart = pointer;
  items.forEach((item) => {
    view.setUint32(pointer, CENTRAL_HEADER, true);
    view.setUint16(pointer + 4, VERSION, true);
    view.setUint16(pointer + 6, VERSION, true);
    view.setUint16(pointer + 8, UTF8_NAMES, true);
    view.setUint16(pointer + 10, STORED, true);
    view.setUint16(pointer + 12, time, true);
    view.setUint16(pointer + 14, date, true);
    view.setUint32(pointer + 16, item.crc, true);
    view.setUint32(pointer + 20, item.data.length, true);
    view.setUint32(pointer + 24, item.data.length, true);
    view.setUint16(pointer + 28, item.nameBytes.length, true);
    view.setUint32(pointer + 42, item.offset, true);
    out.set(item.nameBytes, pointer + CENTRAL_HEADER_SIZE);
    pointer += CENTRAL_HEADER_SIZE + item.nameBytes.length;
  });

  view.setUint32(pointer, END_HEADER, true);
  view.setUint16(pointer + 8, items.length, true);
  view.setUint16(pointer + 10, items.length, true);
  view.setUint32(pointer + 12, pointer - centralStart, true);
  view.setUint32(pointer + 16, centralStart, true);

  return new Blob([out], { type: "application/zip" });
}

// files: [{ name, blob }]
export async function createZipFromBlobs(files) {
  return createZip(
    await Promise.all(
      files.map(async (file) => ({ name: file.name, data: new Uint8Array(await file.blob.arrayBuffer()) }))
    )
  );
}

export function encodeText(text) {
  return new TextEncoder().encode(text);
}