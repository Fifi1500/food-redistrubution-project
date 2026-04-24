import { Request, Response } from "express";
import { NotificationService } from "../services";
import { NotificationType } from "../utils/types";

const notificationService = new NotificationService();

export class NotificationController {
  /**
   * Récupérer mes notifications
   */
  static async getMyNotifications(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await notificationService.getUserNotifications(
        user.id,
        limit,
      );
      const unreadCount = await notificationService.getUnreadCount(user.id);

      res.json({ notifications, unreadCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      await notificationService.markAsRead(id, user.id);
      res.json({ message: "Notification marquée comme lue" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  static async markAllAsRead(req: Request, res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      await notificationService.markAllAsRead(user.id);
      res.json({ message: "Toutes les notifications sont lues" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Supprimer une notification
   */
  static async deleteNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      await notificationService.deleteNotification(id, user.id);
      res.json({ message: "Notification supprimée" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getAllNotifications(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await notificationService.getAllNotifications(page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async sendNotification(req: Request, res: Response) {
    try {
      const { title, message, target } = req.body;
      const admin = req.user;

      if (!title || !message) {
        return res.status(400).json({ message: "Titre et message requis" });
      }

      let recipients: string[] = [];

      if (target === "donors") {
        const donors = await notificationService.getAllDonors();
        recipients = donors.map((d) => d.id);
      } else if (target === "beneficiaries") {
        const beneficiaries = await notificationService.getAllBeneficiaries();
        recipients = beneficiaries.map((b) => b.id);
      } else {
        const allUsers = await notificationService.getAllUsers();
        recipients = allUsers.map((u) => u.id);
      }

      // Envoyer les notifications
      for (const userId of recipients) {
        await notificationService.createAndSend(
          userId,
          "admin_notification" as NotificationType,
          title,
          message,
          { link: "/notifications" },
        );
      }

      res.json({
        success: true,
        sentCount: recipients.length,
        message: `Notification envoyée à ${recipients.length} utilisateur(s)`,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
