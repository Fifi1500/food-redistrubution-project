// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { AuthService } from "../services";
import { randomBytes } from "crypto";
import { sendEmail } from "../utils/email";
import { User } from "../entities";
import { AppDataSource } from "../config/db";
import { hashPassword } from "../utils";

const authService = new AuthService();

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { user, token } = await authService.register(req.body);
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword, token });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const { user, token } = await authService.login(email, password);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }

  static async Profile(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // ✅ DEMANDE DE RÉINITIALISATION - CORRIGÉ
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email requis" });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { email },
      });

      // Pour des raisons de sécurité, on ne dit pas si l'email existe
      if (!user) {
        return res.json({
          message:
            "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
        });
      }

      // Générer un token unique
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // Sauvegarder le token
      user.resetToken = token;
      user.resetTokenExpires = expiresAt;
      await userRepository.save(user);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetLink = `${frontendUrl}/reset-password?token=${token}`;

      // Envoyer l'email
      await sendEmail({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe - FoodShare",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10b981; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9fafb; }
              .button { 
                display: inline-block; 
                background: #10b981; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 8px; 
                margin: 20px 0;
              }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>FoodShare</h1>
              </div>
              <div class="content">
                <h2>Bonjour ${user.name},</h2>
                <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
                <p>Cliquez sur le bouton ci-dessous pour le modifier :</p>
                <div style="text-align: center;">
                  <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
                </div>
                <p>Ce lien est valable <strong>15 minutes</strong>.</p>
                <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
              </div>
              <div class="footer">
                <p>FoodShare - Plateforme de redistribution alimentaire</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      res.json({
        message:
          "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: error.message });
    }
  }

  // ✅ RÉINITIALISATION DU MOT DE PASSE - CORRIGÉ
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res
          .status(400)
          .json({ message: "Token et nouveau mot de passe requis" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          message: "Le mot de passe doit contenir au moins 6 caractères",
        });
      }

      const userRepository = AppDataSource.getRepository(User);

      // Trouver l'utilisateur avec ce token non expiré
      const user = await userRepository.findOne({
        where: { resetToken: token },
      });

      if (!user) {
        return res.status(400).json({ message: "Lien invalide" });
      }

      if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
        return res.status(400).json({ message: "Lien expiré" });
      }

      // Hasher et sauvegarder le nouveau mot de passe
      const hashedPassword = await hashPassword(newPassword);
      user.password = hashedPassword;
      user.resetToken = "";
      user.resetTokenExpires = new Date(0);

      await userRepository.save(user);

      res.json({ message: "Mot de passe réinitialisé avec succès" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: error.message });
    }
  }
}
