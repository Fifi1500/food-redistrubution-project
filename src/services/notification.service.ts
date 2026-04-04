import { AppDataSource } from "../config/db";
import { Notification } from "../entities";
import { NotificationType } from "../utils/types";
import { sendNotification as sendSocketNotification } from "../utils";

export class NotificationService {
  private notificationRepository = AppDataSource.getRepository(Notification);

  async createAndSend(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      link?: string;
      donationId?: string;
      requestId?: string;
      data?: any;
    },
  ): Promise<Notification> {
    // ✅ Utiliser userId directement
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      message,
      link: options?.link,
      isRead: false,
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    // Envoyer via Socket.IO
    await sendSocketNotification(userId, type, title, message, {
      donationId: options?.donationId,
      requestId: options?.requestId,
      link: options?.link,
      data: options?.data,
    });

    return savedNotification;
  }

  async getUserNotifications(userId: string, limit: number = 50) {
    return await this.notificationRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    await this.notificationRepository.delete({
      id: notificationId,
      userId,
    });
  }
}
