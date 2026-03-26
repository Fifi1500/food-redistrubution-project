import { Request, Response, NextFunction } from "express";
import { validationResult, body, param, query } from "express-validator";

// Middleware pour vérifier les erreurs de validation
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Règles de validation pour l'inscription
export const registerValidation = [
  body("email").isEmail().withMessage("Email invalide"),
  body("password").isLength({ min: 6 }).withMessage("Mot de passe trop court"),
  body("name").notEmpty().withMessage("Nom requis"),
  body("role")
    .isIn(["donor", "beneficiary", "admin"])
    .withMessage("Rôle invalide"),
  validate,
];

// Règles de validation pour la connexion
export const loginValidation = [
  body("email").isEmail().withMessage("Email invalide"),
  body("password").notEmpty().withMessage("Mot de passe requis"),
  validate,
];

// Règles de validation pour la création d'un don
export const createDonationValidation = [
  body("foodType").notEmpty().withMessage("Type d'aliment requis"),
  body("totalQuantity").isFloat({ min: 0.1 }).withMessage("Quantité invalide"),
  body("expirationDate").isISO8601().withMessage("Date invalide"),
  body("pickupAddress").notEmpty().withMessage("Adresse requise"),
  body("pickupLocation.coordinates")
    .isArray()
    .withMessage("Coordonnées requises"),
  validate,
];

// Règles de validation pour les paramètres d'ID
export const idParamValidation = [
  param("id").isUUID().withMessage("ID invalide"),
  validate,
];

// Règles de validation pour la pagination
export const paginationValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];
