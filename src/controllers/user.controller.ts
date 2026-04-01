import { Request, Response } from "express";
import { UserService } from "../services";
import { UserRole } from "../entities";

const userService = new UserService();

export class UserController {
  //============================================
  static async getAllUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { users, total } = await userService.getAllUsers(page, limit);

      res.json({
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  //============================================
  static async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  //------------------------
  static async updateProfile(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const updatedUser = await userService.updateProfile(user.id, req.body);
      res.json({ user: updatedUser });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  //---------------------------
  static async changePassword(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const { oldPassword, newPassword } = req.body;
      await userService.changePassword(user.id, oldPassword, newPassword);

      res.json({ message: "Mot de passe changé avec succès" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  //delete my account
  static async deleteAccount(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const { password } = req.body;
      await userService.deleteAccount(user.id, password);

      res.json({ message: "Compte supprimé avec succès" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  // ============================================
  //ADMIN

  //------
  static async verifyDonor(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.verifyDonor(id);
      res.json({ message: "Donateur vérifié avec succès" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async verifyBeneficiary(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.verifyBeneficiary(id);
      res.json({ message: "Bénéficiaire vérifié avec succès" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  // -------------------------------------------
  static async deactivateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.deactivateUser(id);
      res.json({ message: "Utilisateur désactivé avec succès" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  // -------------------------------------------
  static async activateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.activateUser(id);
      res.json({ message: "Utilisateur activé avec succès" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  //------------------
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
  // -------------------------------------------

  static async getUnverifiedUsers(req: Request, res: Response) {
    try {
      const result = await userService.getUnverifiedUsers();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  //   -----------------------------
  static async changeRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      await userService.changeRole(id, role);
      res.json({ message: `Rôle changé en ${role} avec succès` });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
