import { AppDataSource } from "../config/db";
import {
  Donation,
  DonationStatus,
  Request,
  RequestStatus,
  User,
  UserRole,
} from "../entities";
import { paginatedResponse, getPagination, WILAYAS } from "../utils";

export class StatsService {
  private donationRepository = AppDataSource.getRepository(Donation);
  private requestRepository = AppDataSource.getRepository(Request);
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Dashboard statistics (vue d'ensemble)
   */
  async getDashboardStats(): Promise<any> {
    const totalDonations = await this.donationRepository.count();
    const activeDonations = await this.donationRepository.count({
      where: { status: DonationStatus.AVAILABLE },
    });
    const completedDonations = await this.donationRepository.count({
      where: { status: DonationStatus.COMPLETED },
    });

    const totalRequests = await this.requestRepository.count();
    const pendingRequests = await this.requestRepository.count({
      where: { status: RequestStatus.PENDING },
    });
    const approvedRequests = await this.requestRepository.count({
      where: { status: RequestStatus.APPROVED },
    });

    const totalUsers = await this.userRepository.count();
    const totalDonors = await this.userRepository.count({
      where: { role: UserRole.DONOR },
    });
    const totalBeneficiaries = await this.userRepository.count({
      where: { role: UserRole.BENEFICIARY },
    });

    // Quantité totale redistribuée (en kg)
    const totalQuantityResult = await this.donationRepository
      .createQueryBuilder("donation")
      .select("SUM(donation.totalQuantity)", "total")
      .where("donation.status = :status", { status: DonationStatus.COMPLETED })
      .getRawOne();

    return {
      donations: {
        total: totalDonations,
        active: activeDonations,
        completed: completedDonations,
      },
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        approved: approvedRequests,
      },
      users: {
        total: totalUsers,
        donors: totalDonors,
        beneficiaries: totalBeneficiaries,
      },
      impact: {
        totalQuantityKg: parseFloat(totalQuantityResult?.total || 0),
        mealsServed: Math.floor(
          parseFloat(totalQuantityResult?.total || 0) * 2,
        ), // 1kg ≈ 2 repas
      },
    };
  }

  /**
   * Quick stats for dashboard (cartes rapides)
   */
  async getQuickStats(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newDonationsToday = await this.donationRepository.count({
      where: { createdAt: today },
    });

    const newRequestsToday = await this.requestRepository.count({
      where: { requestDate: today },
    });

    const pendingVerifications = await this.userRepository.count({
      where: { role: UserRole.DONOR, isActive: false },
    });

    return {
      newDonationsToday,
      newRequestsToday,
      pendingVerifications,
      activeDonations: await this.donationRepository.count({
        where: { status: DonationStatus.AVAILABLE },
      }),
    };
  }

  /**
   * Recent activities (dernières actions)
   */
  async getRecentActivities(limit: number = 10): Promise<any[]> {
    const recentDonations = await this.donationRepository.find({
      relations: ["donor", "donor.user"],
      order: { createdAt: "DESC" },
      take: limit,
    });

    const recentRequests = await this.requestRepository.find({
      relations: ["donation", "beneficiary", "beneficiary.user"],
      order: { requestDate: "DESC" },
      take: limit,
    });

    // Mélanger et trier par date
    const activities = [
      ...recentDonations.map((d) => ({
        type: "donation_created",
        message: `${d.donor?.user?.name || "Un donateur"} a créé un don "${d.foodType}"`,
        date: d.createdAt,
        donationId: d.id,
      })),
      ...recentRequests.map((r) => ({
        type: "request_created",
        message: `${r.beneficiary?.user?.name || "Un bénéficiaire"} a demandé ${r.requestedQuantity} ${r.donation?.unit} de "${r.donation?.foodType}"`,
        date: r.requestDate,
        requestId: r.id,
      })),
    ];

    return activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  }

  /**
   * Overall platform impact
   */
  async getOverallImpact(): Promise<any> {
    const totalQuantityResult = await this.donationRepository
      .createQueryBuilder("donation")
      .select("SUM(donation.totalQuantity)", "total")
      .where("donation.status = :status", { status: DonationStatus.COMPLETED })
      .getRawOne();

    const totalQuantity = parseFloat(totalQuantityResult?.total || 0);

    // Nombre de bénéficiaires servis
    const beneficiariesServed = await this.requestRepository
      .createQueryBuilder("request")
      .select("COUNT(DISTINCT request.beneficiaryId)", "count")
      .where("request.status IN (:...statuses)", {
        statuses: [RequestStatus.APPROVED, RequestStatus.COLLECTED],
      })
      .getRawOne();

    // CO2 évité (estimation : 1kg de nourriture = 2.5kg CO2)
    const co2Saved = totalQuantity * 2.5;

    // Nombre de repas servis (1kg = 2 repas)
    const mealsServed = totalQuantity * 2;

    return {
      totalQuantityKg: totalQuantity,
      beneficiariesServed: parseInt(beneficiariesServed?.count || 0),
      co2SavedKg: co2Saved,
      mealsServed: mealsServed,
      activeDonors: await this.userRepository.count({
        where: { role: UserRole.DONOR, isActive: true },
      }),
      activeBeneficiaries: await this.userRepository.count({
        where: { role: UserRole.BENEFICIARY, isActive: true },
      }),
    };
  }

  /**
   * Impact by time period
   */
  async getImpactByPeriod(
    period: "day" | "week" | "month" = "month",
  ): Promise<any> {
    let interval: string;
    switch (period) {
      case "day":
        interval = "1 day";
        break;
      case "week":
        interval = "1 week";
        break;
      default:
        interval = "1 month";
    }

    const results = await this.donationRepository
      .createQueryBuilder("donation")
      .select(`DATE_TRUNC('${period}', donation."createdAt") as period`)
      .addSelect("SUM(donation.totalQuantity)", "quantity")
      .addSelect("COUNT(donation.id)", "count")
      .where("donation.status = :status", { status: DonationStatus.COMPLETED })
      .groupBy("period")
      .orderBy("period", "DESC")
      .limit(12)
      .getRawMany();

    return results.map((r) => ({
      period: r.period,
      quantityKg: parseFloat(r.quantity || 0),
      donationsCount: parseInt(r.count || 0),
    }));
  }

  /**
   * Top donors
   */
  async getTopDonors(limit: number = 10): Promise<any[]> {
    return await this.donationRepository
      .createQueryBuilder("donation")
      .leftJoin("donation.donor", "donor")
      .leftJoin("donor.user", "user")
      .select([
        "user.id as userId",
        "user.name as name",
        "user.email as email",
        "donor.organizationName as organizationName",
        "SUM(donation.totalQuantity) as totalQuantity",
        "COUNT(donation.id) as donationCount",
      ])
      .where("donation.status = :status", { status: DonationStatus.COMPLETED })
      .groupBy("user.id")
      .addGroupBy("donor.organizationName")
      .orderBy("totalQuantity", "DESC")
      .limit(limit)
      .getRawMany();
  }

  /**
   * Top beneficiaries
   */
  async getTopBeneficiaries(limit: number = 10): Promise<any[]> {
    return await this.requestRepository
      .createQueryBuilder("request")
      .leftJoin("request.beneficiary", "beneficiary")
      .leftJoin("beneficiary.user", "user")
      .select([
        "user.id as userId",
        "user.name as name",
        "user.email as email",
        "beneficiary.organizationType as organizationType",
        "SUM(request.requestedQuantity) as totalQuantity",
        "COUNT(request.id) as requestCount",
      ])
      .where("request.status IN (:...statuses)", {
        statuses: [RequestStatus.APPROVED, RequestStatus.COLLECTED],
      })
      .groupBy("user.id")
      .addGroupBy("beneficiary.organizationType")
      .orderBy("totalQuantity", "DESC")
      .limit(limit)
      .getRawMany();
  }

  /**
   * Impact by wilaya (region)
   */
  async getImpactByWilaya(): Promise<any[]> {
    const results = await this.donationRepository
      .createQueryBuilder("donation")
      .select("donation.pickupAddress", "address")
      .addSelect("SUM(donation.totalQuantity)", "quantity")
      .where("donation.status = :status", { status: DonationStatus.COMPLETED })
      .groupBy("donation.pickupAddress")
      .getRawMany();

    // Regrouper par wilaya (simplifié - à améliorer avec géocodage)
    const wilayas: { [key: string]: number } = {};
    results.forEach((r) => {
      const wilaya = this.extractWilaya(r.address);
      if (wilaya) {
        wilayas[wilaya] = (wilayas[wilaya] || 0) + parseFloat(r.quantity || 0);
      }
    });

    return Object.entries(wilayas).map(([wilaya, quantity]) => ({
      wilaya,
      quantityKg: quantity,
    }));
  }

  private extractWilaya(address: string): string | null {
    const wilayas = [
      "Alger",
      "Oran",
      "Constantine",
      "Annaba",
      "Blida",
      "Tizi Ouzou",
      "Sétif",
      "Sidi Bel Abbès",
      "Biskra",
      "Tlemcen",
      "Béjaïa",
      "Skikda",
      "Batna",
    ];
    for (const wilaya of wilayas) {
      if (address.includes(wilaya)) return wilaya;
    }
    return null;
  }
}
