import { AppDataSource } from "../config/db";
import {
  User,
  Beneficiary,
  Donation,
  DonationStatus,
  Request,
  RequestStatus,
} from "../entities/index";
import { NOTIF_TYPES } from "../utils";
import { NotificationService } from "./notification.service";

export class RequestService {
  private requestRepository = AppDataSource.getRepository(Request);
  private donationRepository = AppDataSource.getRepository(Donation);
  private beneficiaryRepository = AppDataSource.getRepository(Beneficiary);
  private notificationService = new NotificationService();

  // Créer une demande
  async createRequest(
    user: User,
    donationId: string,
    quantity: number,
    notes?: string,
  ) {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!beneficiary) {
      throw new Error("You are not a beneficiary");
    }

    const donation = await this.donationRepository
      .createQueryBuilder("donation")
      .leftJoinAndSelect("donation.donor", "donor")
      .leftJoinAndSelect("donor.user", "donorUser")
      .where("donation.id = :donationId", { donationId })
      .getOne();

    if (!donation) {
      throw new Error("Donation not found");
    }

    if (donation.status !== DonationStatus.AVAILABLE) {
      throw new Error("This donation is no longer available");
    }

    if (quantity > donation.availableQuantity) {
      throw new Error("Requested quantity exceeds available quantity");
    }

    const request = this.requestRepository.create({
      donation,
      donationId: donation.id,
      beneficiary,
      beneficiaryId: beneficiary.id,
      requestedQuantity: quantity,
      status: RequestStatus.PENDING,
      notes,
    });

    const savedRequest = await this.requestRepository.save(request);

    // Notify the donor that a new request was created for their donation
    try {
      const donorUserId = donation.donor?.user?.id;
      if (!donorUserId) {
        console.error(
          "Cannot notify donor: missing donor user relation for donation",
          { donationId: donation.id },
        );
      } else {
        const title = "📩 New request received";
        const message = `${user.name || "A beneficiary"} requested ${quantity} of "${donation.foodType}" from your donation.`;

        await this.notificationService.createAndSend(
          donorUserId,
          NOTIF_TYPES.REQUEST_RECEIVED,
          title,
          message,
          {
            requestId: savedRequest.id,
            donationId: donation.id,
            link: `/donations/${donation.id}`,
            data: { requestedQuantity: quantity },
          },
        );
      }
    } catch (err) {
      console.error(
        "Failed to notify donor of new request",
        {
          donationId: donation.id,
          donorId: donation.donor?.id,
          donorUserId: donation.donor?.user?.id,
          requestId: savedRequest.id,
        },
        err,
      );
    }

    return savedRequest;
  }

  async updateRequestStatus(
    requestId: string,
    status: RequestStatus,
    user: User,
  ): Promise<Request> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: [
        "donation",
        "donation.donor",
        "donation.donor.user",
        "beneficiary",
        "beneficiary.user",
      ],
    });

    if (!request) {
      throw new Error("Request not found");
    }

    // Vérifier que l'utilisateur est le donateur ou admin
    if (request.donation.donor.user.id !== user.id && user.role !== "admin") {
      throw new Error("You are not authorized");
    }

    // Mettre à jour le statut
    // If approving, reduce donation available quantity now
    if (status === RequestStatus.APPROVED) {
      if (!request.donation) {
        throw new Error("Donation not found");
      }

      if (request.requestedQuantity > request.donation.availableQuantity) {
        throw new Error("Insufficient quantity at approval time");
      }

      request.donation.availableQuantity -= request.requestedQuantity;
      if (request.donation.availableQuantity <= 0) {
        request.donation.status = DonationStatus.COMPLETED;
      }

      await this.donationRepository.save(request.donation);
    }

    request.status = status;
    request.processedAt = new Date();

    await this.requestRepository.save(request);

    const notificationType =
      status === RequestStatus.APPROVED
        ? NOTIF_TYPES.REQUEST_APPROVED
        : status === RequestStatus.REJECTED
          ? NOTIF_TYPES.REQUEST_REJECTED
          : NOTIF_TYPES.REQUEST_STATUS_CHANGED;

    await this.notificationService.createAndSend(
      request.beneficiary.user.id,
      notificationType,
      `The status of your request for "${request.donation.foodType}" changed to ${status}`,
      `The status of your request for "${request.donation.foodType}" changed to ${status}`,
      {
        requestId: request.id,
        link: `/requests/${request.id}`,
        data: { status, donationId: request.donation?.id },
      },
    );

    return request;
  }

  // Demandes du bénéficiaire
  async getMyRequests(user: User) {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!beneficiary) {
      throw new Error("Vous n'êtes pas un bénéficiaire");
    }

    return await this.requestRepository.find({
      where: { beneficiary: { id: beneficiary.id } },
      relations: ["donation", "donation.donor", "donation.donor.user"],
      order: { requestDate: "DESC" },
    });
  }

  // Demandes reçues (pour donor)
  async getReceivedRequests(user: User) {
    const donations = await this.donationRepository.find({
      where: { donor: { user: { id: user.id } } },
      relations: [
        "requests",
        "requests.beneficiary",
        "requests.beneficiary.user",
      ],
    });

    const allRequests = donations.flatMap((d) => d.requests);
    return allRequests.sort(
      (a, b) => b.requestDate.getTime() - a.requestDate.getTime(),
    );
  }

  // Beneficiary cancels  own pending request
  async cancelRequest(
    requestId: string,
    user: User,
  ): Promise<{ message: string }> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: [
        "donation",
        "donation.donor",
        "donation.donor.user",
        "beneficiary",
        "beneficiary.user",
      ],
    });

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.beneficiary?.user?.id !== user.id && user.role !== "admin") {
      throw new Error("You are not authorized to cancel this request");
    }

    // Only pending
    if (request.status !== RequestStatus.PENDING) {
      throw new Error("Only pending requests can be cancelled");
    }

    // Remove the request
    await this.requestRepository.remove(request);

    // Notify donor that the request was cancelled
    try {
      if (request.donation?.donor?.user?.id) {
        const title = "❌ Request cancelled";
        const message = `${request.beneficiary?.user?.name || "A beneficiary"} cancelled their request for "${request.donation.foodType}".`;
        await this.notificationService.createAndSend(
          request.donation.donor.user.id,
          NOTIF_TYPES.REQUEST_STATUS_CHANGED,
          title,
          message,
          {
            requestId: request.id,
            donationId: request.donation.id,
            link: `/donations/${request.donation.id}`,
          },
        );
      }
    } catch (err) {
      console.error("Failed to notify donor of cancelled request", err);
    }

    return { message: "Request cancelled" };
  }
}
