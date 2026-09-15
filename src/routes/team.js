import express from "express";
import { nanoid } from "nanoid";
import { readCollection, writeCollection } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

async function listMembers() {
  return readCollection("team", []);
}

async function saveMembers(members) {
  return writeCollection("team", members);
}

function publicShape(m) {
  return {
    _id: m._id || m.id,
    id: m.id || m._id,
    name: m.name,
    roleId: m.roleId || { name: m.role || "Team Member" },
    role: m.roleId?.name || m.role || "Team Member",
    order: m.order ?? 999,
    isActive: m.isActive !== false,
    bio: m.bio || "",
    linkedIn: m.linkedIn || "",
    twitter: m.twitter || "",
    imageUrl: m.imageUrl || "",
    email: m.email || "",
    joinedDate: m.joinedDate || null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/** Public team list for website */
router.get("/public", async (req, res) => {
  try {
    let members = (await listMembers()).map(publicShape);
    if (req.query.active === "true") {
      members = members.filter((m) => m.isActive);
    }
    members.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    return res.json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load team" });
  }
});

router.get("/public/:id", async (req, res) => {
  try {
    const member = (await listMembers())
      .map(publicShape)
      .find((m) => m.id === req.params.id || m._id === req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    return res.json({ success: true, data: member });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load member" });
  }
});

/** Admin */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const members = (await listMembers())
      .map(publicShape)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    return res.json({ success: true, count: members.length, data: members });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load team" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const member = (await listMembers())
      .map(publicShape)
      .find((m) => m.id === req.params.id || m._id === req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    return res.json({ success: true, data: member });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load member" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const members = await listMembers();
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ success: false, message: "name required" });
    }

    const now = new Date().toISOString();
    const id = body._id || body.id || nanoid();
    const roleName = body.role || body.roleId?.name || "Team Member";

    const member = {
      id,
      _id: id,
      name: body.name,
      roleId: { _id: body.roleId?._id || nanoid(8), name: roleName },
      order: Number(body.order) || members.length + 1,
      isActive: body.isActive !== false,
      bio: body.bio || "",
      linkedIn: body.linkedIn || "",
      twitter: body.twitter || "",
      imageUrl: body.imageUrl || "",
      email: body.email || "",
      joinedDate: body.joinedDate || null,
      createdAt: now,
      updatedAt: now,
    };

    members.unshift(member);
    await saveMembers(members);
    return res.status(201).json({ success: true, data: publicShape(member) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to create member" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const members = await listMembers();
    const idx = members.findIndex(
      (m) => m.id === req.params.id || m._id === req.params.id
    );
    if (idx < 0) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const body = req.body || {};
    const prev = members[idx];
    const roleName =
      body.role || body.roleId?.name || prev.roleId?.name || prev.role || "Team Member";

    const updated = {
      ...prev,
      ...body,
      id: prev.id || prev._id,
      _id: prev._id || prev.id,
      roleId: {
        _id: body.roleId?._id || prev.roleId?._id || nanoid(8),
        name: roleName,
      },
      order: body.order !== undefined ? Number(body.order) : prev.order,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : prev.isActive,
      updatedAt: new Date().toISOString(),
    };

    members[idx] = updated;
    await saveMembers(members);
    return res.json({ success: true, data: publicShape(updated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to update member" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const members = await listMembers();
    const next = members.filter(
      (m) => m.id !== req.params.id && m._id !== req.params.id
    );
    if (next.length === members.length) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    await saveMembers(next);
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to delete member" });
  }
});

export default router;
