import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import multer from "multer";
import { Binary } from "mongodb";
import { nanoid } from "nanoid";
import { requireAdmin } from "../middleware/auth.js";
import { getDb } from "../mongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const COLLECTION = "uploadedFiles";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

function safeExt(originalname = "") {
  const ext = path.extname(originalname).toLowerCase() || ".jpg";
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
}

async function saveUpload({ buffer, mimetype, originalname }) {
  const filename = `${Date.now()}-${nanoid(8)}${safeExt(originalname)}`;
  const diskPath = path.join(UPLOAD_DIR, filename);

  // Local disk cache (handy in dev; wiped on Render restarts)
  fs.writeFileSync(diskPath, buffer);

  // Persist in MongoDB so images survive Render redeploys
  const col = getDb().collection(COLLECTION);
  await col.updateOne(
    { _id: filename },
    {
      $set: {
        _id: filename,
        filename,
        mimetype: mimetype || "application/octet-stream",
        size: buffer.length,
        data: new Binary(buffer),
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  return { filename, url: `/uploads/${filename}`, size: buffer.length, mimetype };
}

/** Serve uploaded image from disk cache, then MongoDB */
export async function serveUpload(req, res, next) {
  try {
    const filename = path.basename(req.params.filename || "");
    if (!filename) {
      return res.status(400).json({ success: false, message: "Missing filename" });
    }

    const diskPath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }

    const doc = await getDb().collection(COLLECTION).findOne({ _id: filename });
    if (!doc?.data) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    const buffer = Buffer.isBuffer(doc.data)
      ? doc.data
      : Buffer.from(doc.data.buffer || doc.data);

    // Rebuild disk cache for faster follow-up requests
    try {
      fs.writeFileSync(diskPath, buffer);
    } catch {
      /* ignore cache write errors on read-only FS */
    }

    res.setHeader("Content-Type", doc.mimetype || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

const router = express.Router();

router.post("/image", requireAdmin, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Upload failed",
      });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    try {
      const saved = await saveUpload({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      });
      return res.status(201).json({
        success: true,
        url: saved.url,
        filename: saved.filename,
        size: saved.size,
        mimetype: saved.mimetype,
      });
    } catch (saveErr) {
      console.error("Upload save failed:", saveErr);
      return res.status(500).json({
        success: false,
        message: "Failed to save image",
      });
    }
  });
});

export { UPLOAD_DIR };
export default router;
