import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
