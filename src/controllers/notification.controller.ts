import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";
import { AppDataSource } from "../config/db";

const notificationService = new NotificationService();

export class NotificationController {
  // Récupérer mes notifications
  async getMyNotifications(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const unreadOnly = req.query.unread === "true";
      const notifications = await notificationService.getUserNotifications(
        user.id,
        unreadOnly,
      );

      res.json({ notifications });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la récupération",
      });
    }
  }

  // Compter les notifications non lues
  async getUnreadCount(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const count = await notificationService.getUnreadCount(user.id);
      res.json({ unreadCount: count });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors du comptage",
      });
    }
  }

  // Marquer une notification comme lue
  async markAsRead(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const { id } = req.params;
      const notification = await notificationService.markAsRead(id, user.id);

      res.json({
        message: "Notification marquée comme lue",
        notification,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la mise à jour",
      });
    }
  }

  // Marquer toutes les notifications comme lues
  async markAllAsRead(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      await AppDataSource.query(
        'UPDATE notifications SET "isRead" = true WHERE "userId" = $1',
        [user.id],
      );

      res.json({
        message: "Toutes les notifications ont été marquées comme lues",
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la mise à jour",
      });
    }
  }
}
