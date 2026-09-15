import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { config } from "./config.js";
import { connectMongo, closeMongo } from "./mongo.js";
import { writeCollection, countCollection } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

async function seed() {
  const blogSeedPath = path.join(dataDir, "blog.seed.json");
  const jobsSeedPath = path.join(dataDir, "jobs.seed.json");
  const teamSeedPath = path.join(dataDir, "team.seed.json");

  if (!fs.existsSync(blogSeedPath)) {
    throw new Error("Missing data/blog.seed.json — run seed prep first");
  }
  if (!fs.existsSync(jobsSeedPath)) {
    throw new Error("Missing data/jobs.seed.json — run seed prep first");
  }
  if (!fs.existsSync(teamSeedPath)) {
    throw new Error("Missing data/team.seed.json — run seed prep first");
  }

  await connectMongo();

  const rawBlogs = JSON.parse(fs.readFileSync(blogSeedPath, "utf8"));
  const rawJobs = JSON.parse(fs.readFileSync(jobsSeedPath, "utf8"));
  const rawTeam = JSON.parse(fs.readFileSync(teamSeedPath, "utf8"));

  const blogs = rawBlogs.map((post) => ({
    id: post.id || nanoid(),
    ...post,
  }));

  const jobs = rawJobs.map((job) => ({
    ...job,
    active: true,
    createdAt: job.createdAt || new Date().toISOString(),
    updatedAt: job.updatedAt || new Date().toISOString(),
  }));

  const team = rawTeam.map((member) => {
    const id = member._id || member.id || nanoid();
    return {
      id,
      _id: id,
      name: member.name,
      roleId: member.roleId || { name: member.role || "Team Member" },
      order: member.order ?? 999,
      isActive: member.isActive !== false,
      bio: member.bio || "",
      linkedIn: member.linkedIn || "",
      twitter: member.twitter || "",
      imageUrl: member.imageUrl || "",
      email: member.email || "",
      joinedDate: member.joinedDate || null,
      createdAt: member.createdAt || new Date().toISOString(),
      updatedAt: member.updatedAt || new Date().toISOString(),
    };
  });

  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  const admins = [
    {
      id: "admin-1",
      name: config.adminName,
      email: config.adminEmail.toLowerCase(),
      passwordHash,
      role: "admin",
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];

  await writeCollection("blogs", blogs);
  await writeCollection("jobs", jobs);
  await writeCollection("team", team);
  await writeCollection("admins", admins);

  console.log("✅ Seed complete (MongoDB)");
  console.log(`   Blogs : ${await countCollection("blogs")}`);
  console.log(`   Jobs  : ${await countCollection("jobs")}`);
  console.log(`   Team  : ${await countCollection("team")}`);
  console.log(`   Admins: ${await countCollection("admins")}`);
  console.log(`   Admin : ${config.adminEmail} / ${config.adminPassword}`);

  await closeMongo();
}

seed().catch(async (err) => {
  console.error(err);
  try {
    await closeMongo();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
