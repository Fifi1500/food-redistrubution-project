import { AppDataSource } from "../config/db";
import {
  Donation,
  DonationStatus,
  Request,
  RequestStatus,
  User,
} from "../entities";
import { getPagination, paginatedResponse } from "../utils";

export class DistributionService {
  private donationRepository = AppDataSource.getRepository(Donation);
  private requestRepository = AppDataSource.getRepository(Request);

  /**
   * Get all distributions (redistributions)
   */
  async getAllDistributions(page: number = 1, limit: number = 20) {
    const { skip } = getPagination(page, limit);

    const [distributions, total] = await this.requestRepository.findAndCount({
      where: { status: RequestStatus.COLLECTED },
      relations: [
        "donation",
        "donation.donor",
        "donation.donor.user",
        "beneficiary",
        "beneficiary.user",
      ],
      order: { updatedAt: "DESC" },
      skip,
      take: limit,
    });

    const formattedDistributions = distributions.map((d) => ({
      id: d.id,
      donationId: d.donation?.id,
      donationTitle: d.donation?.foodType,
      donorName: d.donation?.donor?.user?.name,
      beneficiaryName: d.beneficiary?.user?.name,
      quantity: d.requestedQuantity,
      unit: d.donation?.unit,
      pickupAddress: d.donation?.pickupAddress,
      status: d.status,
      requestedAt: d.requestDate,
      collectedAt: d.processedAt || d.updatedAt,
    }));

    return paginatedResponse(formattedDistributions, total, page, limit);
  }

  /**
   * Get distribution by ID
   */
  async getDistributionById(id: string) {
    const distribution = await this.requestRepository.findOne({
      where: { id },
      relations: [
        "donation",
        "donation.donor",
        "donation.donor.user",
        "beneficiary",
        "beneficiary.user",
      ],
    });

    if (!distribution) return null;

    return {
      id: distribution.id,
      donation: {
        id: distribution.donation?.id,
        foodType: distribution.donation?.foodType,
        totalQuantity: distribution.donation?.totalQuantity,
        unit: distribution.donation?.unit,
        pickupAddress: distribution.donation?.pickupAddress,
        donor: {
          name: distribution.donation?.donor?.user?.name,
          email: distribution.donation?.donor?.user?.email,
          organizationName: distribution.donation?.donor?.organizationName,
        },
      },
      beneficiary: {
        name: distribution.beneficiary?.user?.name,
        email: distribution.beneficiary?.user?.email,
        organizationType: distribution.beneficiary?.organizationType,
      },
      quantity: distribution.requestedQuantity,
      status: distribution.status,
      requestedAt: distribution.requestDate,
      collectedAt: distribution.processedAt || distribution.updatedAt,
    };
  }

  /**
   * Update distribution status
   */
  async updateDistributionStatus(
    id: string,
    status: RequestStatus,
    user: User,
  ) {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: ["donation", "donation.donor"],
    });

    if (!request) throw new Error("Distribution non trouvée");

    // Vérifier les permissions
    if (
      request.donation?.donor?.user?.id !== user.id &&
      user.role !== "admin"
    ) {
      throw new Error("Non autorisé");
    }

    request.status = status;
    request.processedAt = new Date();

    await this.requestRepository.save(request);

    return this.getDistributionById(id);
  }

  /**
   * Cancel distribution
   */
  async cancelDistribution(id: string, user: User, reason?: string) {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: ["donation"],
    });

    if (!request) throw new Error("Distribution non trouvée");

    if (
      request.donation?.donor?.user?.id !== user.id &&
      user.role !== "admin"
    ) {
      throw new Error("Non autorisé");
    }

    if (
      request.status !== RequestStatus.APPROVED &&
      request.status !== RequestStatus.PENDING
    ) {
      throw new Error(
        "Seule une demande approuvée ou en attente peut être annulée",
      );
    }

    request.status = RequestStatus.REJECTED;
    request.processedAt = new Date();
    request.notes = reason || "Annulé par le donateur";

    // Restaurer la quantité du don
    if (request.donation) {
      request.donation.availableQuantity += request.requestedQuantity;
      if (
        request.donation.availableQuantity > 0 &&
        request.donation.status === DonationStatus.COMPLETED
      ) {
        request.donation.status = DonationStatus.AVAILABLE;
      }
      await this.donationRepository.save(request.donation);
    }

    await this.requestRepository.save(request);

    return { message: "Distribution annulée", id };
  }

  /**
   * Get distribution statistics
   */
  async getDistributionStats() {
    const totalDistributions = await this.requestRepository.count({
      where: { status: RequestStatus.COLLECTED },
    });

    const totalPending = await this.requestRepository.count({
      where: { status: RequestStatus.PENDING },
    });

    const totalApproved = await this.requestRepository.count({
      where: { status: RequestStatus.APPROVED },
    });

    const totalRejected = await this.requestRepository.count({
      where: { status: RequestStatus.REJECTED },
    });

    // Par mois
    const monthlyStats = await this.requestRepository
      .createQueryBuilder("request")
      .select("DATE_TRUNC('month', request.requestDate)", "month")
      .addSelect("COUNT(request.id)", "count")
      .where("request.status = :status", { status: RequestStatus.COLLECTED })
      .groupBy("month")
      .orderBy("month", "DESC")
      .limit(12)
      .getRawMany();

    return {
      totalDistributions,
      totalPending,
      totalApproved,
      totalRejected,
      monthlyStats: monthlyStats.map((m) => ({
        month: m.month,
        count: parseInt(m.count),
      })),
    };
  }
}
