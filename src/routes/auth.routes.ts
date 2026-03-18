import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();
const authController = new AuthController();

// Routes publiques
router.post("/register", authController.register.bind(authController));
router.post("/login", authController.login.bind(authController));

// Routes protégées
router.get(
  "/profile",
  authMiddleware,
  authController.getProfile.bind(authController),
);

export default router;
