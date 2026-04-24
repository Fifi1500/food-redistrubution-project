import { AppDataSource } from "../config/db";
import { Notification } from "../entities";
import { NotificationType } from "../utils/types";
import { sendNotification as sendSocketNotification } from "../utils";
import { User, UserRole } from "../entities/User";

export class NotificationService {
  private notificationRepository = AppDataSource.getRepository(Notification);
  private userRepository = AppDataSource.getRepository(User);

  // ============================================
  // RÉCUPÉRATION DES UTILISATEURS
  // ============================================

  async getAllDonors(): Promise<User[]> {
    return await this.userRepository.find({
      where: { role: UserRole.DONOR, isActive: true },
      select: ["id", "name", "email"],
    });
  }

  async getAllBeneficiaries(): Promise<User[]> {
    return await this.userRepository.find({
      where: { role: UserRole.BENEFICIARY, isActive: true },
      select: ["id", "name", "email"],
    });
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.find({
      where: { isActive: true },
      select: ["id", "name", "email", "role"],
    });
  }

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

  async getAllNotifications(page: number = 1, limit: number = 50) {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        relations: ["user"],
        order: { createdAt: "DESC" },
        skip: (page - 1) * limit,
        take: limit,
      });
    // Formater les notifications avec les infos utilisateur
    const formattedNotifications = notifications.map((notif) => ({
      id: notif.id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      target:
        notif.user?.role === "donor"
          ? "donors"
          : notif.user?.role === "beneficiary"
            ? "beneficiaries"
            : "all",
      recipientName: notif.user?.name,
      recipientEmail: notif.user?.email,
      recipientRole: notif.user?.role,
      isRead: notif.isRead,
      sentAt: notif.createdAt,
    }));

    return {
      notifications: formattedNotifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
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
