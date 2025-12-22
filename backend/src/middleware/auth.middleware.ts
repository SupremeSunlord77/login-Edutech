import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

interface JwtPayload {
  userId: string;
  role: Role;
  email: string;
  schoolId?: string;
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET!
    ) as JwtPayload;

    // ✅ attach user to req (now globally typed)
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
      schoolId: decoded.schoolId,
    };

    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
