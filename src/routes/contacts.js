import express from "express";
import { nanoid } from "nanoid";
import { getDb } from "../mongo.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();
const COLLECTION = "contactMessages";

function toAppDoc(doc) {
  if (!doc) return doc;
  const id = String(doc.id || doc._id);
  return { ...doc, id, _id: id };
}

async function col() {
  return getDb().collection(COLLECTION);
}

function shape(doc) {
  const d = toAppDoc(doc);
  return {
    id: d.id,
    _id: d.id,
    name: d.name || "",
    email: d.email || "",
    phone: d.phone || "",
    subject: d.subject || "",
    message: d.message || "",
    status: d.status || "new",
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

/** Public create — website contact form */
router.post("/public", async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "name, email and message are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid email is required",
      });
    }

    const now = new Date().toISOString();
    const id = nanoid();
    const doc = {
      _id: id,
      id,
      name,
      email,
      phone,
      subject: subject || "Website enquiry",
      message,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };

    await (await col()).insertOne(doc);
    return res.status(201).json({ success: true, data: shape(doc) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to save contact message",
    });
  }
});

/** Admin list */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const q = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim();

    const filter = {};
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { subject: { $regex: q, $options: "i" } },
        { message: { $regex: q, $options: "i" } },
      ];
    }

    const collection = await col();
    const total = await collection.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const docs = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return res.json({
      success: true,
      messages: docs.map(shape),
      total,
      page,
      pages,
      limit,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to load contact messages",
    });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim();
    if (!status) {
      return res.status(400).json({ success: false, message: "status required" });
    }

    const collection = await col();
    const existing = await collection.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id }],
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const updatedAt = new Date().toISOString();
    await collection.updateOne(
      { _id: existing._id },
      { $set: { status, updatedAt } }
    );

    return res.json({
      success: true,
      data: shape({ ...existing, status, updatedAt }),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to update message",
    });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const collection = await col();
    const result = await collection.deleteOne({
      $or: [{ id: req.params.id }, { _id: req.params.id }],
    });
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete message",
    });
  }
});

export default router;
