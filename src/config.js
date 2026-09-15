import dotenv from "dotenv";
dotenv.config();

function resolveMongoDbName(uri) {
  if (process.env.MONGODB_DB_NAME) return process.env.MONGODB_DB_NAME;
  try {
    const path = new URL(uri).pathname.replace(/^\//, "");
    return path.split("?")[0] || "techcultureBackOffice";
  } catch {
    return "techcultureBackOffice";
  }
}

const mongoUri = process.env.MONGODB_URI || "";

export const config = {
  port: Number(process.env.PORT || 5050),
  jwtSecret: process.env.JWT_SECRET || "techculture-admin-secret",
  adminEmail: process.env.ADMIN_EMAIL || "admin@techculture.ai",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin@123",
  adminName: process.env.ADMIN_NAME || "TechCulture Admin",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000",
  mongoUri,
  mongoDbName: resolveMongoDbName(mongoUri),
};
