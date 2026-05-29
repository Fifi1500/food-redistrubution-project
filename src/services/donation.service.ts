import { AppDataSource } from "../config/db";
import {
  Donation,
  DonationStatus,
  FoodCategory,
  Donor,
  User,
  UnitType,
  Request,
  RequestStatus,
} from "../entities";
import {
  isValidCoordinates,
  isValidQuantity,
  isValidAddress,
  formatDate,
  NOTIF_TYPES,
  getPagination,
  paginatedResponse,
  formatError,
  formatQuantity,
  isValidUnit,
} from "../utils";
import { NotificationService } from "./notification.service";

export interface CreateDonationData {
  foodType: string;
  description?: string;
  category: FoodCategory;
  totalQuantity: number;
  unit: UnitType;
  expirationDate: Date;
  pickupAddress: string;
  pickupLocation?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  wilaya?: string; // Code wilaya (ex: "16", "31")
  requiresRefrigeration?: boolean;
  handlingInstructions?: string;
  imageUrl?: string;
}

export interface DonationFilters {
  category?: FoodCategory;
  status?: DonationStatus;
  minQuantity?: number;
  maxQuantity?: number;
  startDate?: Date;
  endDate?: Date;
  requiresRefrigeration?: boolean;
}

export class DonationService {
  private donationRepository = AppDataSource.getRepository(Donation);
  private donorRepository = AppDataSource.getRepository(Donor);
  private requestRepository = AppDataSource.getRepository(Request);
  private userRepository = AppDataSource.getRepository(User);
  private notificationService = new NotificationService();

  async createDonation(
    user: User,
    data: CreateDonationData,
  ): Promise<Donation> {
    // 1. Vérifier que l'utilisateur est un donateur
    const donor = await this.donorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!donor) {
      throw new Error("You must be a donor to create a donation");
    }

    if (!data.unit) {
      data.unit = UnitType.KG;
    }

    // 2. Validation des données
    if (!data.foodType || data.foodType.trim() === "") {
      throw new Error("Food type is required");
    }

    if (!isValidQuantity(data.totalQuantity)) {
      throw new Error("Quantity must be greater than 0");
    }

    if (!data.expirationDate || new Date(data.expirationDate) <= new Date()) {
      throw new Error("Expiration date must be in the future");
    }

    if (!isValidAddress(data.pickupAddress)) {
      throw new Error("Pickup address is required");
    }

    let pickupLocation = data.pickupLocation || null;

    if (pickupLocation && pickupLocation.coordinates) {
      const [lng, lat] = pickupLocation.coordinates;
      if (!isValidCoordinates(lat, lng)) {
        throw new Error("Invalid GPS coordinates");
      }
    }

    if (!isValidUnit(data.unit)) {
      throw new Error("Invalid unit");
    }

    // 3. Créer le don
    const donationData = {
      donor: donor,
      foodType: data.foodType,
      description: data.description || null,
      category: data.category || FoodCategory.OTHER,
      totalQuantity: data.totalQuantity,
      availableQuantity: data.totalQuantity,
      unit: data.unit,
      expirationDate: data.expirationDate,
      pickupAddress: data.pickupAddress,
      pickupLocation: pickupLocation,
      wilaya: data.wilaya,
      requiresRefrigeration: data.requiresRefrigeration || false,
      handlingInstructions: data.handlingInstructions,
      imageUrl: data.imageUrl,
      status: DonationStatus.AVAILABLE,
    };

    const donation = this.donationRepository.create(donationData) as Donation;
    const savedDonation = await this.donationRepository.save(donation);

    // 4. Notifier les administrateurs si le don est urgent ou bientôt expiré
    const now = new Date();
    const expirationTime = new Date(savedDonation.expirationDate).getTime();
    const timeToExpiry = expirationTime - now.getTime();
    const soonThresholdMs = 48 * 60 * 60 * 1000; // 48 heures
    const isSoonExpired = timeToExpiry > 0 && timeToExpiry <= soonThresholdMs;
    const isUrgent = savedDonation.requiresRefrigeration || isSoonExpired;

    if (isUrgent) {
      const adminTitle = isSoonExpired
        ? "🚨 Expiring soon"
        : "🚨 Urgent donation";
      const adminMessage = `${savedDonation.foodType} (${formatQuantity(
        savedDonation.totalQuantity,
        savedDonation.unit,
      )}) is available at ${savedDonation.pickupAddress} and expires on ${formatDate(
        savedDonation.expirationDate,
      )}.`;

      await this.notificationService.notifyAdmins(adminTitle, adminMessage, {
        donationId: savedDonation.id,
        link: `/donations/${savedDonation.id}`,
        data: {
          expiresInHours: Math.round(timeToExpiry / (60 * 60 * 1000)),
          requiresRefrigeration: savedDonation.requiresRefrigeration,
        },
      });
    }

    // 5. Notifier les bénéficiaires à proximité si nous avons des coordonnées
    const title = "🍽️ New donation available near you!";
    const message = `${savedDonation.foodType} (${formatQuantity(savedDonation.totalQuantity, savedDonation.unit)}) at ${savedDonation.pickupAddress}`;

    if (
      savedDonation.pickupLocation &&
      savedDonation.pickupLocation.coordinates
    ) {
      await this.notifyNearbyBeneficiaries(savedDonation, title, message);
    }

    return savedDonation;
  }

  private async notifyNearbyBeneficiaries(
    donation: Donation,
    title: string,
    message: string,
  ): Promise<void> {
    // Récupérer les coordonnées du don
    const [lng, lat] = donation.pickupLocation.coordinates;
    const radiusKm = 10; // Rayon de 10 km

    // Requête PostGIS pour trouver les bénéficiaires à proximité
    const nearbyBeneficiaries = await this.userRepository
      .createQueryBuilder("user")
      .innerJoin("user.beneficiaryProfile", "beneficiary")
      .where("user.role = :role", { role: "beneficiary" })
      .andWhere("user.isActive = :active", { active: true })
      .andWhere(
        `ST_DWithin(
          user.location,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
          :radius
        )`,
        { lng, lat, radius: radiusKm * 1000 },
      )
      .select(["user.id"])
      .getMany();

    console.log(
      `📍 Found ${nearbyBeneficiaries.length} beneficiaries within ${radiusKm} km`,
    );

    // Envoyer la notification à chaque bénéficiaire
    for (const beneficiary of nearbyBeneficiaries) {
      await this.notificationService.createAndSend(
        beneficiary.id,
        NOTIF_TYPES.NEW_DONATION,
        title,
        message,
        {
          donationId: donation.id,
          link: `/donations/${donation.id}`,
          data: {
            foodType: donation.foodType,
            quantity: donation.totalQuantity,
            unit: donation.unit,
            pickupAddress: donation.pickupAddress,
          },
        },
      );
    }
  }

  // ============================================
  // GET UNITS
  // ============================================

  async getUnits(): Promise<{ value: string; label: string }[]> {
    return [
      { value: "kg", label: "Kilograms (kg)" },
      { value: "g", label: "Grams (g)" },
      { value: "L", label: "Liters (L)" },
      { value: "mL", label: "Milliliters (mL)" },
      { value: "pieces", label: "Pieces" },
      { value: "units", label: "Units" },
      { value: "boxes", label: "Boxes" },
      { value: "bags", label: "Bags" },
      { value: "packs", label: "Packs" },
    ];
  }

  // ============================================
  // GET AVAILABLE DONATIONS
  // ============================================

  async getAvailableDonations(
    page: number = 1,
    limit: number = 20,
    filters?: DonationFilters,
  ) {
    const { skip } = getPagination(page, limit);

    await this.markExpiredDonations();

    const queryBuilder = this.donationRepository
      .createQueryBuilder("donation")
      .leftJoinAndSelect("donation.donor", "donor")
      .leftJoinAndSelect("donor.user", "user")
      .where("donation.status = :status", { status: DonationStatus.AVAILABLE })
      .andWhere("donation.expirationDate > :now", { now: new Date() })
      .orderBy("donation.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    // Appliquer les filtres
    if (filters?.category) {
      queryBuilder.andWhere("donation.category = :category", {
        category: filters.category,
      });
    }

    if (filters?.requiresRefrigeration !== undefined) {
      queryBuilder.andWhere("donation.requiresRefrigeration = :refrigeration", {
        refrigeration: filters.requiresRefrigeration,
      });
    }

    if (filters?.minQuantity) {
      queryBuilder.andWhere("donation.availableQuantity >= :minQty", {
        minQty: filters.minQuantity,
      });
    }

    if (filters?.maxQuantity) {
      queryBuilder.andWhere("donation.availableQuantity <= :maxQty", {
        maxQty: filters.maxQuantity,
      });
    }

    const [donations, total] = await queryBuilder.getManyAndCount();

    // Formater les dates pour la réponse
    const formattedDonations = donations.map((donation) => ({
      ...donation,
      formattedDate: formatDate(donation.createdAt),
      formattedExpiration: formatDate(donation.expirationDate),
    }));

    return paginatedResponse(formattedDonations, total, page, limit);
  }

  // ============================================
  // GET NEARBY DONATIONS
  // ============================================

  async getNearbyDonations(
    lat: number,
    lng: number,
    radiusKm: number = 10,
    page: number = 1,
    limit: number = 20,
  ) {
    if (!isValidCoordinates(lat, lng)) {
      throw new Error("Coordonnées GPS invalides");
    }

    await this.markExpiredDonations();

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Requête PostGIS pour recherche géographique
    const query = `
      SELECT 
        d.*,
        u.name as donor_name,
        u.phone as donor_phone,
        ST_Distance(
          d."pickupLocation", 
          ST_SetSRID(ST_MakePoint($1, $2), 4326)
        ) as distance
      FROM donations d
      JOIN donors dr ON dr.id = d."donorId"
      JOIN users u ON u.id = dr.user_id
      WHERE d.status = $3
        AND d."expirationDate" > NOW()
        AND ST_DWithin(
          d."pickupLocation", 
          ST_SetSRID(ST_MakePoint($1, $2), 4326), 
          $4
        )
      ORDER BY distance ASC
      LIMIT $5 OFFSET $6
    `;

    const donations = await AppDataSource.query(query, [
      lng,
      lat,
      DonationStatus.AVAILABLE,
      radiusKm * 1000,
      limitNum,
      skip,
    ]);

    // Compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM donations d
      WHERE d.status = $1
        AND d."expirationDate" > NOW()
        AND ST_DWithin(
          d."pickupLocation", 
          ST_SetSRID(ST_MakePoint($2, $3), 4326), 
          $4
        )
    `;

    const totalResult = await AppDataSource.query(countQuery, [
      DonationStatus.AVAILABLE,
      lng,
      lat,
      radiusKm * 1000,
    ]);

    const total = parseInt(totalResult[0].total);

    // Formater les résultats
    const formattedDonations = donations.map((donation: any) => ({
      ...donation,
      distanceKm: (donation.distance / 1000).toFixed(2),
      formattedDate: formatDate(donation.createdAt),
      formattedExpiration: formatDate(donation.expirationDate),
    }));

    return paginatedResponse(formattedDonations, total, page, limitNum);
  }

  // ============================================
  // GET DONATION BY ID
  // ============================================

  async getDonationById(id: string): Promise<Donation | null> {
    const donation = await this.donationRepository.findOne({
      where: { id },
      relations: [
        "donor",
        "donor.user",
        "requests",
        "requests.beneficiary",
        "requests.beneficiary.user",
      ],
    });

    if (donation) {
      // Ajouter des informations formatées
      (donation as any).formattedDate = formatDate(donation.createdAt);
      (donation as any).formattedExpiration = formatDate(
        donation.expirationDate,
      );
      (donation as any).requestsCount = donation.requests?.length || 0;
    }

    return donation;
  }

  /*
   * Get donations by wilaya
   */
  async getDonationsByWilaya(
    wilaya: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const { skip } = getPagination(page, limit);

    const [donations, total] = await this.donationRepository.findAndCount({
      where: {
        wilaya: wilaya as any,
        status: DonationStatus.AVAILABLE,
      },
      relations: ["donor", "donor.user"],
      skip,
      take: limit,
    });

    return paginatedResponse(donations, total, page, limit);
  }
  // ============================================
  // GET DONOR DONATIONS
  // ============================================

  async getDonorDonations(user: User, page: number = 1, limit: number = 20) {
    const donor = await this.donorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!donor) {
      throw new Error("You are not a donor");
    }

    const { skip } = getPagination(page, limit);

    const [donations, total] = await this.donationRepository.findAndCount({
      where: { donor: { id: donor.id } },
      relations: [
        "requests",
        "requests.beneficiary",
        "requests.beneficiary.user",
      ],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    // Ajouter des statistiques
    const formattedDonations = donations.map((donation) => ({
      ...donation,
      requestsCount: donation.requests?.length || 0,
      approvedRequestsCount:
        donation.requests?.filter((r) => r.status === RequestStatus.APPROVED)
          .length || 0,
      completedRequestsCount:
        donation.requests?.filter((r) => r.status === RequestStatus.COMPLETED)
          .length || 0,
      formattedDate: formatDate(donation.createdAt),
      formattedExpiration: formatDate(donation.expirationDate),
    }));

    return paginatedResponse(formattedDonations, total, page, limit);
  }

  // ============================================
  // GET EXPIRED DONATIONS
  // ============================================

  async getExpiredDonations(): Promise<Donation[]> {
    return await this.donationRepository.find({
      where: {
        status: DonationStatus.AVAILABLE,
        expirationDate: new Date(),
      },
      relations: ["donor", "donor.user"],
    });
  }

  // ============================================
  // UPDATE DONATION STATUS
  // ============================================

  async updateDonationStatus(
    id: string,
    status: DonationStatus,
    user: User,
  ): Promise<Donation | null> {
    const donation = await this.getDonationById(id);

    if (!donation) {
      throw new Error("Donation not found");
    }

    // Vérifier que l'utilisateur est le propriétaire
    if (donation.donor?.user.id !== user.id && user.role !== "admin") {
      throw new Error("You are not authorized to modify this donation");
    }

    const oldStatus = donation.status;
    donation.status = status;
    await this.donationRepository.save(donation);

    // 1. NOTIFIER LE DONATEUR
    if (donation.donor?.user) {
      const statusMessages: Record<string, string> = {
        available: "available",
        completed: "completed",
        expired: "expired",
        cancelled: "cancelled",
      };

      await this.notificationService.createAndSend(
        donation.donor.user.id,
        NOTIF_TYPES.DONATION_STATUS_CHANGED,
        "📢 Statut de votre don modifié",
        `Your donation "${donation.foodType}" status changed to ${statusMessages[status] || status}`,
        {
          donationId: id,
          link: `/donations/${id}`,
          data: { oldStatus, newStatus: status, foodType: donation.foodType },
        },
      );
    }

    // 2. NOTIFIER LES BÉNÉFICIAIRES CONCERNÉS
    if (
      oldStatus !== status &&
      donation.requests &&
      donation.requests.length > 0
    ) {
      const beneficiaryIds = [
        ...new Set(
          donation.requests
            .filter((r) => r.beneficiary?.user?.id)
            .map((r) => r.beneficiary.user.id),
        ),
      ];

      const statusMessages: Record<string, string> = {
        available: "available again",
        completed: "completed",
        expired: "expired",
        cancelled: "cancelled",
      };

      for (const beneficiaryId of beneficiaryIds) {
        await this.notificationService.createAndSend(
          beneficiaryId,
          NOTIF_TYPES.DONATION_STATUS_CHANGED,
          "📢 Statut du don modifié",
          `The donation "${donation.foodType}" is now ${statusMessages[status] || status}`,
          {
            donationId: id,
            link: `/donations/${id}`,
            data: { oldStatus, newStatus: status, foodType: donation.foodType },
          },
        );
      }
    }

    return donation;
  }

  // ============================================
  // UPDATE AVAILABLE QUANTITY
  // ============================================

  async updateAvailableQuantity(
    donationId: string,
    quantityToReduce: number,
  ): Promise<Donation | null> {
    const donation = await this.donationRepository.findOne({
      where: { id: donationId },
    });

    if (!donation) {
      throw new Error("Donation not found");
    }

    if (quantityToReduce > donation.availableQuantity) {
      throw new Error("Insufficient quantity");
    }

    donation.availableQuantity -= quantityToReduce;

    // Si plus de quantité disponible, marquer comme complété
    if (donation.availableQuantity <= 0) {
      donation.status = DonationStatus.COMPLETED;
    }

    await this.donationRepository.save(donation);
    return donation;
  }

  // ============================================
  // DELETE DONATION
  // ============================================

  async deleteDonation(id: string, user: User): Promise<void> {
    const donation = await this.donationRepository.findOne({
      where: { id },
      relations: ["donor", "donor.user"],
    });

    if (!donation) {
      throw new Error("Donation not found");
    }

    // Vérifier que l'utilisateur est le propriétaire ou admin
    if (donation.donor.user.id !== user.id && user.role !== "admin") {
      throw new Error("You are not authorized to delete this donation");
    }

    // Vérifier qu'il n'y a pas de demandes approuvées
    const hasApprovedRequests = await this.requestRepository.count({
      where: {
        donation: { id },
        status: RequestStatus.APPROVED,
      },
    });

    if (hasApprovedRequests > 0) {
      throw new Error("Cannot delete a donation with approved requests");
    }

    await this.donationRepository.remove(donation);
  }

  // ============================================
  // MARK EXPIRED DONATIONS
  // ============================================

  async markExpiredDonations(): Promise<number> {
    const result = await this.donationRepository
      .createQueryBuilder()
      .update(Donation)
      .set({ status: DonationStatus.EXPIRED })
      .where("status = :status", { status: DonationStatus.AVAILABLE })
      .andWhere("expirationDate < :now", { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  // ============================================
  // GET DONOR STATS
  // ============================================

  async getDonorStats(user: User): Promise<any> {
    const donor = await this.donorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!donor) {
      throw new Error("You are not a donor");
    }

    const stats = await this.donationRepository
      .createQueryBuilder("d")
      .select("COUNT(d.id)", "total")
      .addSelect(
        "SUM(CASE WHEN d.status = :completed THEN 1 ELSE 0 END)",
        "completed",
      )
      .addSelect(
        "SUM(CASE WHEN d.status = :available THEN 1 ELSE 0 END)",
        "available",
      )
      .addSelect(
        "SUM(CASE WHEN d.status = :expired THEN 1 ELSE 0 END)",
        "expired",
      )
      .addSelect("SUM(d.totalQuantity)", "totalQuantity")
      .addSelect("SUM(d.availableQuantity)", "availableQuantity")
      .where("d.donorId = :donorId", { donorId: donor.id })
      .setParameter("completed", DonationStatus.COMPLETED)
      .setParameter("available", DonationStatus.AVAILABLE)
      .setParameter("expired", DonationStatus.EXPIRED)
      .getRawOne();

    return {
      totalDonations: parseInt(stats.total) || 0,
      completedDonations: parseInt(stats.completed) || 0,
      availableDonations: parseInt(stats.available) || 0,
      expiredDonations: parseInt(stats.expired) || 0,
      totalQuantityKg: parseFloat(stats.totalQuantity) || 0,
      availableQuantityKg: parseFloat(stats.availableQuantity) || 0,
    };
  }

  // ============================================
  // SEARCH DONATIONS
  // ============================================

  async searchDonations(keyword: string, page: number = 1, limit: number = 20) {
    const { skip } = getPagination(page, limit);

    const [donations, total] = await this.donationRepository
      .createQueryBuilder("donation")
      .leftJoinAndSelect("donation.donor", "donor")
      .leftJoinAndSelect("donor.user", "user")
      .where("donation.status = :status", { status: DonationStatus.AVAILABLE })
      .andWhere("donation.foodType ILIKE :keyword", { keyword: `%${keyword}%` })
      .orWhere("donation.handlingInstructions ILIKE :keyword", {
        keyword: `%${keyword}%`,
      })
      .orderBy("donation.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const formattedDonations = donations.map((donation) => ({
      ...donation,
      formattedDate: formatDate(donation.createdAt),
    }));

    return paginatedResponse(formattedDonations, total, page, limit);
  }

  // admin (tous les dons)
  async getAllDonationsForAdmin(page: number = 1, limit: number = 20) {
    const { skip } = getPagination(page, limit);

    const [donations, total] = await this.donationRepository.findAndCount({
      relations: ["donor", "donor.user"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    return paginatedResponse(donations, total, page, limit);
  }
}
