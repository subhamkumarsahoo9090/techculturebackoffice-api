import dns from "dns";
import { MongoClient } from "mongodb";
import { config } from "./config.js";

// Some Windows/ISP DNS setups refuse MongoDB SRV lookups
dns.setServers(["8.8.8.8", "1.1.1.1"]);

let client;
let db;

export async function connectMongo() {
  if (db) return db;
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is missing in .env");
  }

  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.mongoDbName);
  await db.command({ ping: 1 });
  console.log(`✅ MongoDB connected → ${config.mongoDbName}`);
  return db;
}

export function getDb() {
  if (!db) throw new Error("MongoDB not connected. Call connectMongo() first.");
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
