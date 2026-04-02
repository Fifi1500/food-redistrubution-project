import { AppDataSource } from "../config/db";
import {
  User,
  Beneficiary,
  Donation,
  DonationStatus,
  Request,
  RequestStatus,
} from "../entities/index";
import { sendNotification, NOTIF_TYPES } from "../utils";

export class RequestService {
  private requestRepository = AppDataSource.getRepository(Request);
  private donationRepository = AppDataSource.getRepository(Donation);
  private beneficiaryRepository = AppDataSource.getRepository(Beneficiary);

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
      throw new Error("Vous n'êtes pas un bénéficiaire");
    }

    const donation = await this.donationRepository.findOne({
      where: { id: donationId },
    });

    if (!donation) {
      throw new Error("Don non trouvé");
    }

    if (donation.status !== DonationStatus.AVAILABLE) {
      throw new Error("Ce don n'est plus disponible");
    }

    if (quantity > donation.availableQuantity) {
      throw new Error("Quantité demandée supérieure à la quantité disponible");
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

    return await this.requestRepository.save(request);
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
      throw new Error("Demande non trouvée");
    }

    // Vérifier que l'utilisateur est le donateur ou admin
    if (request.donation.donor.user.id !== user.id && user.role !== "admin") {
      throw new Error("Vous n'êtes pas autorisé");
    }

    // Mettre à jour le statut
    request.status = status;
    request.processedAt = new Date();

    await this.requestRepository.save(request);

    // Notifier le bénéficiaire
    await sendNotification(
      request.beneficiary.user.id,
      NOTIF_TYPES.REQUEST_APPROVED,
      `Le statut de votre demande pour "${request.donation.foodType}" est passé à ${status}`,
      `/requests/${request.id}`,
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
}
