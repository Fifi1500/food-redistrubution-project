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
    // Extraire le token du header Authorization
    const token = extractToken(req.headers.authorization);

    if (!token) {
      throw new Error();
    }

    // Vérifier le token
    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error();
    }

    // Récupérer l'utilisateur
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
      return res.status(403).json({ message: "Compte désactivé" });
    }

    // Ajouter l'utilisateur à la requête
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Non authentifié" });
  }
};

// Middleware pour vérifier les rôles
export const role = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    next();
  };
};

// Middleware pour vérifier si l'utilisateur est un donateur
export const isDonor = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  if (req.user.role !== "donor") {
    return res.status(403).json({ message: "Réservé aux donateurs" });
  }

  next();
};

// Middleware pour vérifier si l'utilisateur est un bénéficiaire
export const isBeneficiary = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  if (req.user.role !== "beneficiary") {
    return res.status(403).json({ message: "Réservé aux bénéficiaires" });
  }

  next();
};

// Middleware pour vérifier si l'utilisateur est admin
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Réservé aux administrateurs" });
  }

  next();
};
