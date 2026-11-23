// File helpers shared by crime reports and private chats.
//  - detectFile():  checks the real content of a file (not just its name) and only allows documents, PDFs, pictures and videos
//  - stripJpegMetadata(): removes GPS / camera data from photos that become public
//  - sendBuffer():  sends a file from memory, with Range support so videos can be played and skipped through
//  - uploader():    multer wrapper with friendly error messages
const path = require("path");
const multer = require("multer");
const { MAX_FILE_MB } = require("./config");

const MIME = {
  jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  txt: "text/plain; charset=utf-8",
};

const kindOfMime = (mime) =>
  mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime === "application/pdf" ? "pdf" : "document";

const startsWith = (buf, bytes, offset = 0) => buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf, from, to) => buf.toString("latin1", from, to);

// Returns { ext, mime, kind } or null when the file type is not allowed.
function detectFile(buf, originalName = "") {
  const nameExt = path.extname(String(originalName)).slice(1).toLowerCase();
  const ok = (ext) => ({ ext, mime: MIME[ext], kind: kindOfMime(MIME[ext]) });
  if (!buf || buf.length < 8) return null;

  if (startsWith(buf, [0xff, 0xd8, 0xff])) return ok("jpg");
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ok("png");
  if (ascii(buf, 0, 6) === "GIF87a" || ascii(buf, 0, 6) === "GIF89a") return ok("gif");
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return ok("webp");
  if (ascii(buf, 0, 5) === "%PDF-") return ok("pdf");
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return ok("webm");

  if (ascii(buf, 4, 8) === "ftyp") {
    const brand = ascii(buf, 8, 12);
    if (/^(heic|heix|hevc|hevx|mif1|msf1|avif|avis)$/.test(brand)) return null; // photos in HEIC/AVIF: not supported
    return ok(brand === "qt  " ? "mov" : "mp4");
  }

  // Old Office files (OLE container): trust the extension only together with the OLE signature
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && ["doc", "xls", "ppt"].includes(nameExt)) return ok(nameExt);

  // Modern Office / OpenDocument files are ZIP containers: check for the folder that proves what they are
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) && ["docx", "xlsx", "pptx", "odt"].includes(nameExt)) {
    const sample = Buffer.concat([buf.subarray(0, 65536), buf.subarray(Math.max(0, buf.length - 65536))]).toString("latin1");
    const proof = { docx: "word/", xlsx: "xl/", pptx: "ppt/", odt: "application/vnd.oasis.opendocument.text" }[nameExt];
    if (sample.includes(proof)) return ok(nameExt);
    return null;
  }

  // Plain text
  if (nameExt === "txt") {
    if (buf.subarray(0, 8192).includes(0)) return null;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
      return ok("txt");
    } catch {
      return null;
    }
  }
  return null;
}

// ---------- photo privacy ----------
// Phone photos contain GPS position, device model and time. Public report photos must not leak the reporter's exact
// spot, so every JPEG loses its EXIF/XMP/IPTC/comment segments. Only the rotation flag is kept (otherwise photos
// would appear sideways).
function readExifOrientation(seg) {
  // seg = APP1 payload after the 2 length bytes, starting with "Exif\0\0"
  if (seg.length < 20 || seg.toString("latin1", 0, 4) !== "Exif") return 1;
  const t = seg.subarray(6);
  const le = t.toString("latin1", 0, 2) === "II";
  const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  try {
    if (u16(2) !== 42) return 1;
    const ifd = u32(4);
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const e = ifd + 2 + i * 12;
      if (u16(e) === 0x0112) {
        const v = u16(e + 8);
        return v >= 1 && v <= 8 ? v : 1;
      }
    }
  } catch { /* malformed EXIF: ignore */ }
  return 1;
}

function stripJpegMetadata(buf) {
  if (!startsWith(buf, [0xff, 0xd8])) return buf;
  const parts = [buf.subarray(0, 2)];
  let orientation = 1;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break; // unexpected data: keep the rest untouched
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xda || marker === 0xd9) break; // start of image data
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { parts.push(buf.subarray(i, i + 2)); i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) break;
    const seg = buf.subarray(i, i + 2 + len);
    if (marker === 0xe1) orientation = Math.max(orientation, readExifOrientation(seg.subarray(4)) || 1);
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe; // EXIF/XMP, Photoshop/IPTC, comments
    if (!drop) parts.push(seg);
    i += 2 + len;
  }
  if (orientation > 1) {
    // tiny EXIF block that contains ONLY the rotation flag
    const exif = Buffer.from([
      0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1, length 34, "Exif\0\0"
      0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,             // big-endian TIFF header
      0x00, 0x01,                                                  // 1 entry
      0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // orientation
      0x00, 0x00, 0x00, 0x00,                                      // no next IFD
    ]);
    parts.splice(1, 0, exif);
  }
  parts.push(buf.subarray(i));
  return Buffer.concat(parts);
}

// ---------- sending ----------
function headerName(name) {
  const clean = String(name || "file").replace(/[\r\n"\\/]/g, "_");
  const ascii = clean.replace(/[^\x20-\x7e]/g, "_");
  return `filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

// Pictures, videos and PDFs open in the browser; documents are downloaded.
const canShowInline = (mime) => mime.startsWith("image/") || mime.startsWith("video/") || mime === "application/pdf";

// Sends a file that is already in memory (used for decrypted chat files). Supports Range requests.
function sendBuffer(req, res, buf, { mime, name }) {
  const total = buf.length;
  res.setHeader("Content-Type", mime);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", `${canShowInline(mime) ? "inline" : "attachment"}; ${headerName(name)}`);

  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (m && (m[1] !== "" || m[2] !== "")) {
    let start, end;
    if (m[1] === "") { start = Math.max(0, total - Number(m[2])); end = total - 1; }
    else { start = Number(m[1]); end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1); }
    if (start > end || start >= total) {
      res.writeHead(416, { "Content-Range": `bytes */${total}` });
      return res.end();
    }
    res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": end - start + 1 });
    return res.end(buf.subarray(start, end + 1));
  }
  res.setHeader("Content-Length", total);
  res.end(buf);
}

// ---------- uploading ----------
// kind: "single" (one file in field `field`) or "many" (up to `max` files)
function uploader(field, max = 1) {
  const m = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: max, fields: 20 } });
  const run = max === 1 ? m.single(field) : m.array(field, max);
  return (req, res, next) =>
    run(req, res, (err) => {
      if (!err) return next();
      const msg =
        err.code === "LIMIT_FILE_SIZE" ? `Each file must be under ${MAX_FILE_MB} MB`
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE" ? `You can attach at most ${max} file${max === 1 ? "" : "s"}`
        : "File upload failed";
      res.status(400).json({ error: msg });
    });
}

const WRONG_TYPE = "Allowed files: pictures (JPG, PNG, GIF, WebP), videos (MP4, MOV, WebM), PDF, and documents (DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, TXT)";

module.exports = { detectFile, stripJpegMetadata, sendBuffer, uploader, kindOfMime, canShowInline, headerName, WRONG_TYPE, MIME };
