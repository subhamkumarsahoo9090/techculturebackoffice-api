import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config.js";
import { connectMongo } from "./mongo.js";
import { countCollection } from "./db.js";
import authRoutes from "./routes/auth.js";
import blogRoutes from "./routes/blogs.js";
import careerRoutes from "./routes/careers.js";
import teamRoutes from "./routes/team.js";
import demoRoutes from "./routes/demos.js";
import contactRoutes from "./routes/contacts.js";
import faqRoutes from "./routes/faqs.js";
import uploadRoutes, { serveUpload } from "./routes/uploads.js";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin.split(",").map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));
// Serve from disk cache first, then MongoDB (survives Render restarts)
app.get("/uploads/:filename", serveUpload);

app.get("/api/health", async (_req, res) => {
  try {
    const [blogs, jobs, team, demos] = await Promise.all([
      countCollection("blogs"),
      countCollection("jobs"),
      countCollection("team"),
      countCollection("demoBookings"),
    ]);
    res.json({
      success: true,
      service: "techculture-backoffice-api",
      db: "mongodb",
      database: config.mongoDbName,
      blogs,
      jobs,
      team,
      demos,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Health check failed" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/careers", careerRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/demos", demoRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/uploads", uploadRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Server error" });
});

async function start() {
  await connectMongo();
  app.listen(config.port, () => {
    console.log(`🚀 Backoffice API running on http://localhost:${config.port}`);
    console.log(`   Blog public : GET /api/blogs/public`);
    console.log(`   Careers public: GET /api/careers/public`);
    console.log(`   Team public: GET /api/team/public`);
    console.log(`   Demos public: POST /api/demos/public`);
    console.log(`   Contacts   : POST /api/contacts/public`);
    console.log(`   FAQs public: GET /api/faqs/public`);
    console.log(`   Uploads    : POST /api/uploads/image`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
