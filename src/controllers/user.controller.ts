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
        return res.status(404).json({ message: "User not found" });
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
        return res.status(401).json({ message: "Not authenticated" });
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
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { oldPassword, newPassword } = req.body;
      await userService.changePassword(user.id, oldPassword, newPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  //delete my account
  static async deleteAccount(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { password } = req.body;
      await userService.deleteAccount(user.id, password);

      res.json({ message: "Account deleted successfully" });
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
      res.json({ message: "Donor verified successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async verifyBeneficiary(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.verifyBeneficiary(id);
      res.json({ message: "Beneficiary verified successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  // -------------------------------------------
  static async deactivateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.deactivateUser(id);
      res.json({ message: "User deactivated successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  // -------------------------------------------
  static async activateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.activateUser(id);
      res.json({ message: "User activated successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  //------------------
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ message: "User deleted successfully" });
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
      res.json({ message: `Role changed to ${role} successfully` });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
