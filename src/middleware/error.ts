import { Request, Response, NextFunction } from "express";
import { formatError } from "../utils";

// Middleware pour les erreurs 404 (route non trouvée)
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Middleware  erreurs
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || "Internal server error";

  // Erreur de validation
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  }

  // Erreur JWT
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Erreur Multer
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large (max 5MB)";
    } else {
      message = err.message;
    }
  }

  // Formater l'erreur
  const formattedError = formatError({ code: err.code, message });

  res.status(statusCode).json({
    message: formattedError.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
