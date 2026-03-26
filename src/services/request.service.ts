import { AppDataSource } from "../config/db";
import { Request, RequestStatus } from "../entities/Request";
import { Donation, DonationStatus } from "../entities/Donation";
import { Beneficiary } from "../entities/Beneficiary";
import { User } from "../entities/User";

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

  // Approuver une demande
  async approveRequest(requestId: string) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ["donation"],
    });

    if (!request) {
      throw new Error("Demande non trouvée");
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new Error("Cette demande ne peut plus être traitée");
    }

    request.status = RequestStatus.APPROVED;
    request.processedAt = new Date();

    // Mettre à jour la quantité disponible
    request.donation.availableQuantity -= request.requestedQuantity;

    if (request.donation.availableQuantity <= 0) {
      request.donation.status = DonationStatus.COMPLETED;
    }

    await this.donationRepository.save(request.donation);
    return await this.requestRepository.save(request);
  }

  // Rejeter une demande
  async rejectRequest(requestId: string, notes?: string) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error("Demande non trouvée");
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new Error("Cette demande ne peut plus être traitée");
    }

    request.status = RequestStatus.REJECTED;
    request.processedAt = new Date();
    if (notes) request.notes = notes;

    return await this.requestRepository.save(request);
  }

  // Terminer une demande
  async completeRequest(requestId: string) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error("Demande non trouvée");
    }

    if (request.status !== RequestStatus.APPROVED) {
      throw new Error("Seule une demande approuvée peut être terminée");
    }

    request.status = RequestStatus.COMPLETED;
    return await this.requestRepository.save(request);
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

  // Demandes reçues (pour donateur)
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
