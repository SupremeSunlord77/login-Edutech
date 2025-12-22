import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/database";
import {generateAccessToken,generateRefreshToken,} from "../utils/jwt.util";

/**
 * LOGIN
 */
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
    schoolId: user.schoolId ?? undefined,
  });

  const refreshToken = generateRefreshToken(user.id);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
    },
    accessToken,
    refreshToken,
  });
};

/**
 * AUTH ME
 * (uses req.user set by authenticate middleware)
 */
export const me = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  res.json({
    data: {
      userId: req.user.userId,
      role: req.user.role,
      email: req.user.email,
      schoolId: req.user.schoolId ?? null,
    },
  });
};
