import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { user, token } = await authService.register(req.body);

      // Ne pas renvoyer le mot de passe
      const { password, ...userWithoutPassword } = user;

      res.status(201).json({
        message: "Inscription réussie",
        user: userWithoutPassword,
        token,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message || "Erreur lors de l'inscription",
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const { user, token } = await authService.login(email, password);

      // Ne pas renvoyer le mot de passe
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        message: "Connexion réussie",
        user: userWithoutPassword,
        token,
      });
    } catch (error: any) {
      res.status(401).json({
        message: error.message || "Erreur de connexion",
      });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      // Ne pas renvoyer le mot de passe
      const { password, ...userWithoutPassword } = user;

      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
}
