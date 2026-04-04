import { Request, Response } from "express";
import { NotificationService } from "../services";

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
}
