import { AppDataSource } from "../config/db";
import { Notification, NotificationType } from "../entities/Notification";
import { User } from "../entities/User";
import { io } from "../app";

export class NotificationService {
  private notificationRepository = AppDataSource.getRepository(Notification);

  // Créer une notification
  async createNotification(
    userId: string,
    type: NotificationType,
    message: string,
    link?: string,
  ) {
    const notification = this.notificationRepository.create({
      user: { id: userId } as User,
      type,
      message,
      link,
      isRead: false,
    });

    const saved = await this.notificationRepository.save(notification);

    // Envoyer en temps réel via Socket.IO
    io.to(`user-${userId}`).emit("notification", saved);

    return saved;
  }

  // Marquer comme lue
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (notification) {
      notification.isRead = true;
      await this.notificationRepository.save(notification);
    }

    return notification;
  }

  // Récupérer les notifications d'un utilisateur
  async getUserNotifications(userId: string, unreadOnly: boolean = false) {
    const where: any = { user: { id: userId } };
    if (unreadOnly) {
      where.isRead = false;
    }

    return await this.notificationRepository.find({
      where,
      order: { createdAt: "DESC" },
    });
  }

  // Compter les notifications non lues
  async getUnreadCount(userId: string) {
    return await this.notificationRepository.count({
      where: { user: { id: userId }, isRead: false },
    });
  }

  // Notification pour nouveau don
  async notifyNewDonation(donation: any) {
    // Trouver tous les bénéficiaires à proximité
    const query = `
      SELECT u.id, u.email
      FROM users u
      JOIN beneficiaries b ON b.user_id = u.id
      WHERE u.role = 'beneficiary'
        AND ST_DWithin(
          u.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326),
          10000
        )
    `;

    const nearbyBeneficiaries = await AppDataSource.query(query, [
      donation.pickupLocation.coordinates[0],
      donation.pickupLocation.coordinates[1],
    ]);

    for (const beneficiary of nearbyBeneficiaries) {
      await this.createNotification(
        beneficiary.id,
        NotificationType.NEW_DONATION,
        `Nouveau don disponible : ${donation.foodType} - ${donation.totalQuantity} ${donation.unit}`,
        `/donations/${donation.id}`,
      );
    }
  }

  // Notification pour demande reçue
  async notifyRequestReceived(donation: any, request: any) {
    await this.createNotification(
      donation.donor.user.id,
      NotificationType.REQUEST_RECEIVED,
      `Nouvelle demande pour votre don "${donation.foodType}" : ${request.requestedQuantity} ${donation.unit}`,
      `/donations/${donation.id}/requests`,
    );
  }

  // Notification pour demande approuvée
  async notifyRequestApproved(request: any, donation: any) {
    await this.createNotification(
      request.beneficiary.user.id,
      NotificationType.REQUEST_APPROVED,
      `Votre demande pour "${donation.foodType}" a été approuvée !`,
      `/requests/${request.id}`,
    );
  }

  // Notification pour demande rejetée
  async notifyRequestRejected(request: any, donation: any, reason?: string) {
    const message = reason
      ? `Votre demande pour "${donation.foodType}" a été rejetée. Motif : ${reason}`
      : `Votre demande pour "${donation.foodType}" a été rejetée.`;

    await this.createNotification(
      request.beneficiary.user.id,
      NotificationType.REQUEST_REJECTED,
      message,
      `/donations/${donation.id}`,
    );
  }

  // Notification pour rappel de retrait
  async notifyPickupReminder(request: any, donation: any) {
    await this.createNotification(
      request.beneficiary.user.id,
      NotificationType.REMINDER,
      `Rappel : Retrait de "${donation.foodType}" à récupérer avant ${new Date(donation.expirationDate).toLocaleDateString()}`,
      `/requests/${request.id}`,
    );
  }
}
