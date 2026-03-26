import jwt from "jsonwebtoken";
import { User } from "../entities/User";

// ============================================
// GESTION DES TOKENS JWT
// ============================================

const SECRET = process.env.JWT_SECRET || "secret_temp";
const EXPIRES_IN = "7d";

// Générer un token
export const generateToken = (user: User): string => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
};

// Vérifier un token
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    return null;
  }
};

// Extraire le token du header
export const extractToken = (authorization?: string): string | null => {
  if (!authorization) return null;
  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
};

// Rafraîchir un token
export const refreshToken = (oldToken: string): string | null => {
  const payload = verifyToken(oldToken);
  if (!payload) return null;

  const fakeUser = {
    id: payload.id,
    email: payload.email,
    role: payload.role,
  } as User;
  return generateToken(fakeUser);
};
