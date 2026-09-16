import express from "express";
import { nanoid } from "nanoid";
import { readCollection, writeCollection } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

async function listBlogs() {
  return readCollection("blogs", []);
}

async function saveBlogs(blogs) {
  return writeCollection("blogs", blogs);
}

function publicShape(post) {
  return {
    slug: post.slug,
    title: post.title,
    subtitle: post.subtitle,
    excerpt: post.excerpt,
    content: post.content,
    contentFormat: post.contentFormat || "html",
    heroImage: post.heroImage,
    heroImageAlt: post.heroImageAlt,
    ogImage: post.ogImage,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    tags: post.tags || [],
    vertical: post.vertical || "all",
    author: post.author,
    authorBio: post.authorBio,
    status: post.status,
    readMinutes: post.readMinutes,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

/** Public — website blog listing (published only) */
router.get("/public", async (req, res) => {
  try {
    const { vertical, q, limit } = req.query;
    let posts = (await listBlogs()).filter((p) => p.status === "PUBLISHED");

    if (vertical && vertical !== "all") {
      posts = posts.filter(
        (p) => p.vertical === vertical || (p.tags || []).includes(String(vertical).toLowerCase())
      );
    }
    if (q) {
      const needle = String(q).toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title?.toLowerCase().includes(needle) ||
          p.excerpt?.toLowerCase().includes(needle) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(needle))
      );
    }

    posts.sort(
      (a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt)
    );

    const total = posts.length;
    const lim = Number(limit);
    if (lim > 0) posts = posts.slice(0, lim);

    return res.json({
      success: true,
      total,
      posts: posts.map(publicShape),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load blogs" });
  }
});

/** Public — single published post */
router.get("/public/:slug", async (req, res) => {
  try {
    const post = (await listBlogs()).find(
      (p) => p.slug === req.params.slug && p.status === "PUBLISHED"
    );
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    return res.json({ success: true, post: publicShape(post) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load post" });
  }
});

/** Admin list — paginated: ?page=1&limit=10&q=&status= */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, q } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    let posts = await listBlogs();
    if (status) posts = posts.filter((p) => p.status === status);
    if (q) {
      const needle = String(q).toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title?.toLowerCase().includes(needle) ||
          p.slug?.toLowerCase().includes(needle)
      );
    }
    posts.sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );

    const total = posts.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;
    const pagePosts = posts.slice(start, start + limit);

    return res.json({
      success: true,
      total,
      page: safePage,
      limit,
      pages,
      posts: pagePosts,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load blogs" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const post = (await listBlogs()).find(
      (p) => p.id === req.params.id || p.slug === req.params.id
    );
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    return res.json({ success: true, post });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load post" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const blogs = await listBlogs();
    const now = new Date().toISOString();
    const body = req.body || {};
    const slug = String(body.slug || body.title || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug || !body.title) {
      return res.status(400).json({ success: false, message: "title and slug required" });
    }
    if (blogs.some((p) => p.slug === slug)) {
      return res.status(409).json({ success: false, message: "Slug already exists" });
    }

    const post = {
      id: nanoid(),
      slug,
      title: body.title,
      subtitle: body.subtitle || "",
      excerpt: body.excerpt || "",
      content: body.content || "",
      contentFormat: body.contentFormat === "markdown" ? "markdown" : "html",
      heroImage: body.heroImage || "",
      heroImageAlt: body.heroImageAlt || "",
      ogImage: body.ogImage || body.heroImage || "",
      metaTitle: body.metaTitle || body.title,
      metaDescription: body.metaDescription || body.excerpt || "",
      tags: Array.isArray(body.tags) ? body.tags : [],
      vertical: body.vertical || "all",
      productIds: Array.isArray(body.productIds) ? body.productIds : [],
      author: body.author || "TechCulture AI",
      authorBio: body.authorBio || "",
      status: body.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      readMinutes: Number(body.readMinutes) || 5,
      publishedAt: body.status === "PUBLISHED" ? now : null,
      createdAt: now,
      updatedAt: now,
    };

    blogs.unshift(post);
    await saveBlogs(blogs);
    return res.status(201).json({ success: true, post });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to create post" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const blogs = await listBlogs();
    const idx = blogs.findIndex((p) => p.id === req.params.id || p.slug === req.params.id);
    if (idx < 0) return res.status(404).json({ success: false, message: "Post not found" });

    const prev = blogs[idx];
    const body = req.body || {};
    const nextStatus = body.status || prev.status;
    const updated = {
      ...prev,
      ...body,
      id: prev.id,
      slug: body.slug || prev.slug,
      content: body.content !== undefined ? body.content : prev.content,
      contentFormat:
        body.contentFormat === "markdown"
          ? "markdown"
          : body.contentFormat === "html"
            ? "html"
            : prev.contentFormat || "html",
      tags: Array.isArray(body.tags) ? body.tags : prev.tags,
      status: nextStatus,
      publishedAt:
        nextStatus === "PUBLISHED" ? prev.publishedAt || new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };

    blogs[idx] = updated;
    await saveBlogs(blogs);
    return res.json({ success: true, post: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to update post" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const blogs = await listBlogs();
    const next = blogs.filter((p) => p.id !== req.params.id && p.slug !== req.params.id);
    if (next.length === blogs.length) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    await saveBlogs(next);
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to delete post" });
  }
});

export default router;
