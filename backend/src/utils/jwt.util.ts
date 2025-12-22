import jwt from 'jsonwebtoken';

/**
 * What goes inside the token
 */
interface TokenPayload {
  userId: string;
  role: string;
   email: string; 
  schoolId?: string;
}

/**
 * Create a short-lived access token (15 minutes)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: '15m'
  });
};

/**
 * Create a long-lived refresh token (7 days)
 */
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
};
