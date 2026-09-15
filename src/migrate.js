import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectMongo, closeMongo } from "./mongo.js";
import { writeCollection, countCollection } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localDbDir = path.join(__dirname, "..", "data", "db");

function readLocalJson(name) {
  const fp = path.join(localDbDir, `${name}.json`);
  if (!fs.existsSync(fp)) {
    throw new Error(`Missing local file: ${fp}`);
  }
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

async function migrate() {
  console.log("Connecting to MongoDB…");
  await connectMongo();

  const collections = ["blogs", "jobs", "team", "admins"];
  for (const name of collections) {
    const data = readLocalJson(name);
    console.log(`Migrating ${name}: ${data.length} documents…`);
    await writeCollection(name, data);
    const count = await countCollection(name);
    console.log(`  ✅ ${name} → ${count} in MongoDB`);
  }

  await closeMongo();
  console.log("\n✅ Migration complete — all local data is on MongoDB.");
}

migrate().catch(async (err) => {
  console.error("Migration failed:", err);
  try {
    await closeMongo();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
