import { nanoid } from "nanoid";
import { getDb } from "./mongo.js";

const ALLOWED = new Set(["blogs", "jobs", "team", "admins", "demoBookings"]);

function assertName(name) {
  if (!ALLOWED.has(name)) {
    throw new Error(`Unknown collection: ${name}`);
  }
}

/** Normalize app docs so id/_id stay stable string keys */
function toMongoDoc(item) {
  const id = String(item.id || item._id || nanoid());
  const { _id: _ignored, ...rest } = item;
  return { ...rest, id, _id: id };
}

function toAppDoc(doc) {
  if (!doc) return doc;
  const id = String(doc.id || doc._id);
  return { ...doc, id, _id: id };
}

export async function readCollection(name, fallback = []) {
  assertName(name);
  const docs = await getDb().collection(name).find({}).toArray();
  if (!docs.length) return structuredClone(fallback);
  return docs.map(toAppDoc);
}

export async function writeCollection(name, data) {
  assertName(name);
  const col = getDb().collection(name);
  const items = Array.isArray(data) ? data.map(toMongoDoc) : [];
  await col.deleteMany({});
  if (items.length) {
    await col.insertMany(items, { ordered: false });
  }
  return items.map(toAppDoc);
}

export async function countCollection(name) {
  assertName(name);
  return getDb().collection(name).countDocuments();
}
