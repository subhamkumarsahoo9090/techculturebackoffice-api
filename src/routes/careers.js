import express from "express";
import { nanoid } from "nanoid";
import { readCollection, writeCollection } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

async function listJobs() {
  return readCollection("jobs", []);
}

async function saveJobs(jobs) {
  return writeCollection("jobs", jobs);
}

/** Public careers jobs */
router.get("/public", async (req, res) => {
  try {
    let jobs = (await listJobs()).filter((j) => j.active !== false);
    const { department, q } = req.query;
    if (department && department !== "All") {
      jobs = jobs.filter((j) => j.department === department);
    }
    if (q) {
      const needle = String(q).toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title?.toLowerCase().includes(needle) ||
          j.stack?.toLowerCase().includes(needle) ||
          j.summary?.toLowerCase().includes(needle)
      );
    }
    return res.json({ success: true, total: jobs.length, jobs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load jobs" });
  }
});

router.get("/public/:id", async (req, res) => {
  try {
    const job = (await listJobs()).find(
      (j) => (j.id === req.params.id || j.slug === req.params.id) && j.active !== false
    );
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    return res.json({ success: true, job });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load job" });
  }
});

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { q } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    let jobs = await listJobs();
    if (q) {
      const needle = String(q).toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title?.toLowerCase().includes(needle) ||
          j.stack?.toLowerCase().includes(needle) ||
          j.department?.toLowerCase().includes(needle) ||
          j.summary?.toLowerCase().includes(needle)
      );
    }
    jobs.sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
    );

    const total = jobs.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;
    const pageJobs = jobs.slice(start, start + limit);

    return res.json({
      success: true,
      total,
      page: safePage,
      limit,
      pages,
      jobs: pageJobs,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load jobs" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const job = (await listJobs()).find((j) => j.id === req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    return res.json({ success: true, job });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load job" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const jobs = await listJobs();
    const body = req.body || {};
    const id =
      body.id ||
      String(body.title || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") ||
      nanoid(8);

    if (!body.title) {
      return res.status(400).json({ success: false, message: "title required" });
    }
    if (jobs.some((j) => j.id === id)) {
      return res.status(409).json({ success: false, message: "Job id already exists" });
    }

    const now = new Date().toISOString();
    const job = {
      id,
      title: body.title,
      department: body.department || "Engineering",
      location: body.location || "India · Hybrid",
      type: body.type || "Full-time",
      experience: body.experience || "",
      stack: body.stack || "",
      summary: body.summary || "",
      responsibilities: Array.isArray(body.responsibilities) ? body.responsibilities : [],
      requirements: Array.isArray(body.requirements) ? body.requirements : [],
      niceToHave: Array.isArray(body.niceToHave) ? body.niceToHave : [],
      active: body.active !== false,
      createdAt: now,
      updatedAt: now,
    };

    jobs.unshift(job);
    await saveJobs(jobs);
    return res.status(201).json({ success: true, job });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to create job" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const jobs = await listJobs();
    const idx = jobs.findIndex((j) => j.id === req.params.id);
    if (idx < 0) return res.status(404).json({ success: false, message: "Job not found" });

    const body = req.body || {};
    const updated = {
      ...jobs[idx],
      ...body,
      id: jobs[idx].id,
      responsibilities: Array.isArray(body.responsibilities)
        ? body.responsibilities
        : jobs[idx].responsibilities,
      requirements: Array.isArray(body.requirements)
        ? body.requirements
        : jobs[idx].requirements,
      niceToHave: Array.isArray(body.niceToHave) ? body.niceToHave : jobs[idx].niceToHave,
      updatedAt: new Date().toISOString(),
    };
    jobs[idx] = updated;
    await saveJobs(jobs);
    return res.json({ success: true, job: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to update job" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const jobs = await listJobs();
    const next = jobs.filter((j) => j.id !== req.params.id);
    if (next.length === jobs.length) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    await saveJobs(next);
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to delete job" });
  }
});

export default router;
