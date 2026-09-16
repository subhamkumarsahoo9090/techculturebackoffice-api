import express from "express";
import { nanoid } from "nanoid";
import { getDb } from "../mongo.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();
const COLLECTION = "demoBookings";

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
    fullName: d.fullName || "",
    workEmail: d.workEmail || "",
    phone: d.phone || "",
    company: d.company || "",
    location: d.location || "",
    message: d.message || "",
    demoDate: d.demoDate || "",
    demoTime: d.demoTime || "",
    eventId: d.eventId || "",
    meetLink: d.meetLink || "",
    calendarLink: d.calendarLink || "",
    status: d.status || "scheduled",
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

/** Public create — called by website after Google Calendar booking */
router.post("/public", async (req, res) => {
  try {
    const body = req.body || {};
    const fullName = String(body.fullName || "").trim();
    const workEmail = String(body.workEmail || "").trim().toLowerCase();
    const phone = String(body.phone || "").replace(/\D/g, "");
    const demoDate = String(body.demoDate || "").trim();
    const demoTime = String(body.demoTime || "").trim();

    if (!fullName || !workEmail || !demoDate || !demoTime) {
      return res.status(400).json({
        success: false,
        message: "fullName, workEmail, demoDate and demoTime are required",
      });
    }

    const now = new Date().toISOString();
    const id = nanoid();
    const doc = {
      _id: id,
      id,
      fullName,
      workEmail,
      phone,
      company: String(body.company || "").trim() || "N/A",
      location: String(body.location || "").trim() || "N/A",
      message: String(body.message || "").trim(),
      demoDate,
      demoTime,
      eventId: String(body.eventId || ""),
      meetLink: String(body.meetLink || ""),
      calendarLink: String(body.calendarLink || ""),
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    };

    await (await col()).insertOne(doc);
    return res.status(201).json({ success: true, data: shape(doc) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to save demo booking" });
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
        { fullName: { $regex: q, $options: "i" } },
        { workEmail: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { company: { $regex: q, $options: "i" } },
        { demoDate: { $regex: q, $options: "i" } },
      ];
    }

    const collection = await col();
    const total = await collection.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const docs = await collection
      .find(filter)
      .sort({ demoDate: -1, demoTime: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return res.json({
      success: true,
      bookings: docs.map(shape),
      total,
      page,
      pages,
      limit,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load demo bookings" });
  }
});

/** Admin detail */
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const doc = await (await col()).findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id }],
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    return res.json({ success: true, data: shape(doc) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load booking" });
  }
});

/** Admin update status */
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim();
    const allowed = new Set(["scheduled", "completed", "cancelled", "no-show"]);
    if (!allowed.has(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be scheduled, completed, cancelled, or no-show",
      });
    }

    const collection = await col();
    const existing = await collection.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id }],
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const now = new Date().toISOString();
    await collection.updateOne(
      { _id: existing._id },
      { $set: { status, updatedAt: now } }
    );
    const doc = await collection.findOne({ _id: existing._id });
    return res.json({ success: true, data: shape(doc) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to update booking" });
  }
});

/** Admin delete */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const result = await (await col()).deleteOne({
      $or: [{ id: req.params.id }, { _id: req.params.id }],
    });
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    return res.json({ success: true, message: "Booking deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to delete booking" });
  }
});

export default router;
