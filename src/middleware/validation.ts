import {
  body,
  param,
  query,
  validationResult,
  ValidationError,
} from "express-validator";
import { Request, Response, NextFunction } from "express";

// Middleware de validation
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err: ValidationError) => {
      //erreurs de champ standard
      if ("path" in err) {
        return {
          field: err.path,
          message: err.msg,
        };
      }
      //erreurs de validation personnalisées
      return {
        field: "unknown",
        message: err.msg,
      };
    });

    return res.status(400).json({
      message: "Erreur de validation",
      errors: formattedErrors,
    });
  }
  next();
};

export const registerValidation = [
  //BASIC FIELDS
  body("email").isEmail().withMessage("Email invalide").normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Mot de passe trop court (min 6 caractères)")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage(
      "Le mot de passe doit contenir au moins une lettre et un chiffre",
    ),

  body("name")
    .notEmpty()
    .withMessage("Nom requis")
    .isLength({ min: 2, max: 100 })
    .withMessage("Nom doit contenir entre 2 et 100 caractères"),

  body("role")
    .isIn(["donor", "beneficiary", "admin"])
    .withMessage("Rôle invalide"),

  //OPTIONAL FIELDS
  body("phone")
    .optional()
    .matches(/^[0-9+\s]{8,15}$/)
    .withMessage(
      "Numéro de téléphone invalide (ex: 0612345678 ou +33123456789)",
    ),

  body("location")
    .optional()
    .isObject()
    .withMessage("Localisation doit être un objet")
    .custom((value) => {
      if (value && value.coordinates) {
        const [lng, lat] = value.coordinates;
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return true;
        }
      }
      return false;
    })
    .withMessage("Coordonnées GPS invalides"),

  body("address")
    .optional()
    .isString()
    .isLength({ min: 5 })
    .withMessage("Adresse trop courte (min 5 caractères)"),

  // DONOR VALIDATION

  body("organizationName")
    .if(body("role").equals("donor"))
    .notEmpty()
    .withMessage("Nom de l'organisation requis pour donor")
    .isLength({ min: 2, max: 100 })
    .withMessage("Nom d'organisation trop long (max 100 caractères)"),

  body("businessType")
    .if(body("role").equals("donor"))
    .isIn(["bakery", "restaurant", "supermarket", "other"])
    .withMessage(
      "Type de commerce invalide (bakery, restaurant, supermarket, other)",
    ),

  body("phone")
    .if(body("role").equals("donor"))
    .notEmpty()
    .withMessage("Téléphone requis pour donor")
    .matches(/^[0-9+\s]{8,15}$/)
    .withMessage("Numéro de téléphone invalide"),

  body("location")
    .if(body("role").equals("donor"))
    .notEmpty()
    .withMessage("Localisation requise pour donor")
    .isObject()
    .custom((value) => {
      if (value && value.coordinates) {
        const [lng, lat] = value.coordinates;
        return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      }
      return false;
    })
    .withMessage(
      "Coordonnées GPS invalides (ex: { type: 'Point', coordinates: [lng, lat] })",
    ),

  // =========================
  //BENEFICIARY VALIDATION

  body("organizationType")
    .if(body("role").equals("beneficiary"))
    .isIn(["association", "individual", "other"])
    .withMessage(
      "Type d'organisation invalide (association, individual, other)",
    ),

  body("phone")
    .if(body("role").equals("beneficiary"))
    .notEmpty()
    .withMessage("Téléphone requis pour beneficiary")
    .matches(/^[0-9+\s]{8,15}$/)
    .withMessage("Numéro de téléphone invalide"),

  body("address")
    .if(body("role").equals("beneficiary"))
    .notEmpty()
    .withMessage("Adresse requise pour beneficiary")
    .isLength({ min: 5 })
    .withMessage("Adresse trop courte (min 5 caractères)"),

  validate,
];

// Règles de validation pour la connexion
export const loginValidation = [
  body("email").isEmail().withMessage("Email invalide"),
  body("password").notEmpty().withMessage("Mot de passe requis"),
  validate,
];

// --Donations--------

export const createDonationValidation = [
  body("foodType")
    .notEmpty()
    .withMessage("Le type d'aliment est requis")
    .isString()
    .withMessage("Le type d'aliment doit être une chaîne de caractères")
    .isLength({ min: 2, max: 100 })
    .withMessage("Le type d'aliment doit contenir entre 2 et 100 caractères"),

  body("description")
    .optional()
    .isString()
    .withMessage("La description doit être une chaîne de caractères")
    .isLength({ min: 10, max: 500 })
    .withMessage("La description doit contenir entre 10 et 500 caractères"),

  body("totalQuantity")
    .notEmpty()
    .withMessage("La quantité est requise")
    .isFloat({ min: 0.1, max: 10000 })
    .withMessage("La quantité doit être comprise entre 0.1 et 10000"),

  body("expirationDate")
    .notEmpty()
    .withMessage("La date d'expiration est requise")
    .isISO8601()
    .withMessage("Format de date invalide")
    .custom((value) => new Date(value) > new Date())
    .withMessage("La date d'expiration doit être dans le futur"),

  body("pickupAddress")
    .notEmpty()
    .withMessage("L'adresse de retrait est requise")
    .isString()
    .withMessage("L'adresse doit être une chaîne de caractères")
    .isLength({ min: 5, max: 500 })
    .withMessage("L'adresse doit contenir entre 5 et 500 caractères"),

  body("pickupLocation")
    .notEmpty()
    .withMessage("Les coordonnées GPS sont requises")
    .isObject()
    .withMessage("Les coordonnées doivent être un objet")
    .custom((value) => {
      if (!value || typeof value !== "object") return false;
      if (value.type !== "Point") return false;
      if (!value.coordinates || !Array.isArray(value.coordinates)) return false;
      if (value.coordinates.length !== 2) return false;
      const [lng, lat] = value.coordinates;
      return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    })
    .withMessage(
      "Coordonnées GPS invalides. Format attendu: { type: 'Point', coordinates: [lng, lat] }",
    ),

  body("unit")
    .optional()
    .isIn([
      "kg",
      "g",
      "L",
      "mL",
      "pièces",
      "unités",
      "cartons",
      "sacs",
      "paquets",
      "plateaux",
      "barquettes",
    ])
    .withMessage("Unité invalide"),

  body("requiresRefrigeration")
    .optional()
    .isBoolean()
    .withMessage("La réfrigération requise doit être un booléen"),

  body("handlingInstructions")
    .optional()
    .isString()
    .withMessage("Les instructions doivent être une chaîne de caractères")
    .isLength({ max: 500 })
    .withMessage("Les instructions ne doivent pas dépasser 500 caractères"),

  body("imageUrl")
    .optional()
    .isURL()
    .withMessage("L'URL de l'image doit être une URL valide"),

  validate,
];

export const updateDonationStatusValidation = [
  param("id").isUUID().withMessage("ID de don invalide"),
  body("status")
    .notEmpty()
    .withMessage("Le statut est requis")
    .isIn(["available", "completed", "expired", "cancelled"])
    .withMessage("Statut invalide (available, completed, expired, cancelled)"),
  validate,
];

export const nearbyDonationsValidation = [
  query("lat")
    .notEmpty()
    .withMessage("La latitude est requise")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude invalide (doit être entre -90 et 90)"),
  query("lng")
    .notEmpty()
    .withMessage("La longitude est requise")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude invalide (doit être entre -180 et 180)"),
  query("radius")
    .optional()
    .isFloat({ min: 1, max: 100 })
    .withMessage("Rayon invalide (doit être entre 1 et 100 km)"),
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

// ============================================
//USERS VALIDATION
// ============================================

export const updateProfileValidation = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Nom doit contenir entre 2 et 100 caractères"),

  body("phone")
    .optional()
    .matches(/^[0-9+\s]{8,15}$/)
    .withMessage("Numéro de téléphone invalide"),

  body("address")
    .optional()
    .isLength({ min: 5 })
    .withMessage("Adresse trop courte"),

  validate,
];

export const changePasswordValidation = [
  body("oldPassword").notEmpty().withMessage("Ancien mot de passe requis"),

  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Nouveau mot de passe trop court (min 6 caractères)"),

  validate,
];

export const changeRoleValidation = [
  param("id").isUUID().withMessage("ID utilisateur invalide"),

  body("role")
    .isIn(["donor", "beneficiary", "admin"])
    .withMessage("Rôle invalide"),

  validate,
];
