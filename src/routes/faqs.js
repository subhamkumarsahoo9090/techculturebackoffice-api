import express from "express";
import { nanoid } from "nanoid";
import { getDb } from "../mongo.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();
const COLLECTION = "faqs";

const SEED_FAQS = [
  {
    question: "What products does TechCulture AI offer?",
    answer:
      "We provide production-ready platforms across the financial client lifecycle — including Digital KYC, Aadhaar Verification, Business KYC, Re-KYC, Account Closure, Online IPO Bidding, Middleware for UCC/DP/KRA routing, and related digital onboarding tools.",
  },
  {
    question: "How does Digital KYC work with TechCulture?",
    answer:
      "Our Digital KYC journey combines document capture, OCR, liveness/face match, and rule-based checks so institutions can onboard customers faster with a clear audit trail suitable for regulated workflows.",
  },
  {
    question: "What is Middleware Central Engine used for?",
    answer:
      "Middleware sits between customer eSign/verification and market systems. It routes requests, transforms data, aggregates responses from UCC, DP and KRA partners, and returns a single final status to your back office.",
  },
  {
    question: "Can we book a product demo online?",
    answer:
      "Yes. Use Book a Demo on the website to pick a working-day slot. You receive a calendar invite with a Google Meet link, and the booking is also saved for our team to follow up.",
  },
  {
    question: "How quickly do you respond to contact form messages?",
    answer:
      "We typically respond within one business day. Messages submitted from the website are stored securely and reviewed by the TechCulture team.",
  },
  {
    question: "Do you support broker, NBFC, and MFD use cases?",
    answer:
      "Yes. Our solutions are built for Indian financial institutions — brokers, NBFCs, MFDs, and related partners — with compliance-friendly flows for onboarding, servicing, and closure.",
  },
  {
    question: "Is Aadhaar-based verification available?",
    answer:
      "Yes. Aadhaar Verification and Aadhaar eSign options help confirm identity and complete paperless signing as part of your onboarding or agreement journeys.",
  },
  {
    question: "Can TechCulture integrate with DigiLocker, CDSL, NSDL, NSE, or BSE?",
    answer:
      "Our platforms are designed around common Indian market and identity ecosystems such as DigiLocker, depositories, exchanges, and KRA networks. Exact integrations depend on your product scope and approvals.",
  },
  {
    question: "Where is TechCulture AI located?",
    answer:
      "TECHCULTURE TECHNOLOGIES PRIVATE LIMITED (CIN: U62010DL2026PTC460892). Corporate office: B35/2, Lobe-03, 5th Floor of Tower B, The Corenthum Building, Sector-62, Noida, Uttar Pradesh 201301. Registered address: 50, 51 Second Floor, Regal Building, Connaught Place, New Delhi, Delhi 110001. You can also reach us at info@techculture.ai or +91 74282 38091.",
  },
  {
    question: "How do careers and job applications work on the site?",
    answer:
      "Open roles are listed on the Careers page. You can apply online with your details and resume; applications are reviewed by our hiring team through the backoffice.",
  },
  {
    question: "Can we customize KYC or onboarding flows for our institution?",
    answer:
      "Yes. Journeys can be tailored for your compliance rules, branding, partner systems, and operational handoffs while keeping auditability and scalable architecture.",
  },
  {
    question: "How do we get started with TechCulture AI?",
    answer:
      "Share your requirements via the contact form or book a demo. We will understand your use case, recommend the right products (KYC, Middleware, IPO, etc.), and outline next implementation steps.",
  },
];

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
    question: d.question || "",
    answer: d.answer || "",
    order: d.order ?? 999,
    isActive: d.isActive !== false,
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

async function ensureSeedFaqs() {
  const collection = await col();
  const count = await collection.countDocuments();
  if (count > 0) return;

  const now = new Date().toISOString();
  const docs = SEED_FAQS.map((item, index) => {
    const id = nanoid();
    return {
      _id: id,
      id,
      question: item.question,
      answer: item.answer,
      order: index + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  });
  await collection.insertMany(docs);
}

async function listSorted() {
  return (await col()).find({}).sort({ order: 1, createdAt: 1 }).toArray();
}

/** Clamp order into 1..max (inclusive). */
function clampOrder(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const maxAllowed = Math.max(1, Number(max) || 1);
  return Math.min(maxAllowed, Math.max(1, Math.round(n)));
}

/** Rewrite every FAQ order to a clean 1..n sequence. */
async function renumberAll(docs) {
  const collection = await col();
  const now = new Date().toISOString();
  await Promise.all(
    docs.map((doc, index) =>
      collection.updateOne(
        { _id: doc._id },
        { $set: { order: index + 1, updatedAt: now } }
      )
    )
  );
}

/**
 * Move one FAQ to `targetOrder` and shift neighbors.
 * `docs` must already exclude the moving item when inserting a brand-new FAQ.
 */
async function placeAtOrder(movingDoc, targetOrder, others) {
  const max = others.length + 1;
  const order = clampOrder(targetOrder, max);
  const next = [...others];
  next.splice(order - 1, 0, movingDoc);
  await renumberAll(next);
  return order;
}

/** Public FAQs for website */
router.get("/public", async (_req, res) => {
  try {
    await ensureSeedFaqs();
    const docs = await (await col())
      .find({ isActive: { $ne: false } })
      .sort({ order: 1, createdAt: 1 })
      .toArray();

    return res.json({
      success: true,
      count: docs.length,
      data: docs.map(shape),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load FAQs" });
  }
});

/** Admin list */
router.get("/", requireAdmin, async (req, res) => {
  try {
    await ensureSeedFaqs();
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (q) {
      filter.$or = [
        { question: { $regex: q, $options: "i" } },
        { answer: { $regex: q, $options: "i" } },
      ];
    }

    const docs = await (await col())
      .find(filter)
      .sort({ order: 1, createdAt: 1 })
      .toArray();

    return res.json({
      success: true,
      count: docs.length,
      data: docs.map(shape),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load FAQs" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const question = String(body.question || "").trim();
    const answer = String(body.answer || "").trim();
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "question and answer are required",
      });
    }

    const collection = await col();
    const existing = await listSorted();
    const maxOrder = existing.length + 1;
    const order = clampOrder(
      body.order !== undefined && body.order !== "" ? body.order : maxOrder,
      maxOrder
    );

    const now = new Date().toISOString();
    const id = nanoid();
    const doc = {
      _id: id,
      id,
      question,
      answer,
      order,
      isActive: body.isActive !== false,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(doc);
    await placeAtOrder(doc, order, existing);

    const saved = await collection.findOne({ _id: id });
    return res.status(201).json({ success: true, data: shape(saved) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to create FAQ" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const collection = await col();
    const existing = await collection.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id }],
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }

    const body = req.body || {};
    const question = String(body.question ?? existing.question).trim();
    const answer = String(body.answer ?? existing.answer).trim();
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "question and answer are required",
      });
    }

    const all = await listSorted();
    const others = all.filter(
      (doc) => String(doc.id || doc._id) !== String(existing.id || existing._id)
    );
    const maxOrder = all.length;
    const nextOrder =
      body.order !== undefined && body.order !== ""
        ? clampOrder(body.order, maxOrder)
        : clampOrder(existing.order, maxOrder);

    const updatedFields = {
      question,
      answer,
      isActive:
        body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive !== false,
      updatedAt: new Date().toISOString(),
    };

    await collection.updateOne({ _id: existing._id }, { $set: updatedFields });
    const moving = { ...existing, ...updatedFields, order: nextOrder };
    await placeAtOrder(moving, nextOrder, others);

    const saved = await collection.findOne({ _id: existing._id });
    return res.json({
      success: true,
      data: shape(saved),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to update FAQ" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const collection = await col();
    const existing = await collection.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id }],
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }

    await collection.deleteOne({ _id: existing._id });
    const remaining = await listSorted();
    await renumberAll(remaining);

    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to delete FAQ" });
  }
});

export default router;
