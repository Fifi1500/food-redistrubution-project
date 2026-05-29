import { Request, Response, NextFunction } from "express";
import { verifyToken, extractToken } from "../utils";
import { AppDataSource } from "../config/db";
import { User } from "../entities";

// Interface pour étendre Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Middleware d'authentification
export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      throw new Error();
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error();
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: decoded.id },
      relations: ["donorProfile", "beneficiaryProfile"],
    });

    if (!user) {
      throw new Error();
    }

    // Vérifier si le compte est actif
    if (user.isActive === false) {
      return res.status(403).json({ message: "Account deactivated" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authenticated" });
  }
};

export const role = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};

export const isDonor = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.user.role !== "donor") {
    return res.status(403).json({ message: "Reserved for donors" });
  }

  next();
};

export const isBeneficiary = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.user.role !== "beneficiary") {
    return res.status(403).json({ message: "Reserved for beneficiaries" });
  }

  next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Reserved for administrators" });
  }

  next();
};
