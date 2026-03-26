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
  sendNotification,
  broadcastToBeneficiaries,
  formatDate,
  NOTIF_TYPES,
  getPagination,
  paginatedResponse,
  formatError,
  formatQuantity,
  isValidUnit,
} from "../utils";

// ============================================
// INTERFACES
// ============================================

export interface CreateDonationData {
  foodType: string;
  category: FoodCategory;
  totalQuantity: number;
  unit: UnitType;
  expirationDate: Date;
  pickupAddress: string;
  pickupLocation: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
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

// ============================================
// SERVICE
// ============================================

export class DonationService {
  private donationRepository = AppDataSource.getRepository(Donation);
  private donorRepository = AppDataSource.getRepository(Donor);
  private requestRepository = AppDataSource.getRepository(Request);

  async createDonation(
    user: User,
    data: CreateDonationData,
  ): Promise<Donation> {
    // 1. Vérifier que l'utilisateur est un donateur
    const donor = await this.donorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!donor) {
      throw new Error("Vous devez être un donateur pour créer un don");
    }

    if (!data.unit) {
      data.unit = UnitType.KG;
    }

    // 2. Validation des données
    if (!data.foodType || data.foodType.trim() === "") {
      throw new Error("Le type d'aliment est requis");
    }

    if (!isValidQuantity(data.totalQuantity)) {
      throw new Error("La quantité doit être supérieure à 0");
    }

    if (!data.expirationDate || new Date(data.expirationDate) <= new Date()) {
      throw new Error("La date d'expiration doit être dans le futur");
    }

    if (!isValidAddress(data.pickupAddress)) {
      throw new Error("L'adresse de retrait est requise");
    }

    if (!data.pickupLocation || !data.pickupLocation.coordinates) {
      throw new Error("Les coordonnées GPS sont requises");
    }

    const [lng, lat] = data.pickupLocation.coordinates;
    if (!isValidCoordinates(lat, lng)) {
      throw new Error("Coordonnées GPS invalides");
    }

    if (!isValidUnit(data.unit)) {
      throw new Error("Unité invalide");
    }
    // 3. Créer le don
    const donation = this.donationRepository.create({
      donor: donor,
      foodType: data.foodType,
      category: data.category || FoodCategory.OTHER,
      totalQuantity: data.totalQuantity,
      availableQuantity: data.totalQuantity,
      unit: data.unit,
      expirationDate: data.expirationDate,
      pickupAddress: data.pickupAddress,
      pickupLocation: data.pickupLocation,
      requiresRefrigeration: data.requiresRefrigeration || false,
      handlingInstructions: data.handlingInstructions,
      imageUrl: data.imageUrl,
      status: DonationStatus.AVAILABLE,
    });

    const savedDonation = await this.donationRepository.save(donation);

    // 4. Notifier les bénéficiaires à proximité
    const message = `🍽️ Nouveau don disponible : ${savedDonation.foodType}  (${formatQuantity(savedDonation.totalQuantity, savedDonation.unit)}) à ${savedDonation.pickupAddress}`;
    broadcastToBeneficiaries(NOTIF_TYPES.NEW_DONATION, message, {
      donation: savedDonation,
    });

    return savedDonation;
  }

  // get units
  async getUnits(): Promise<{ value: string; label: string }[]> {
    return [
      { value: "kg", label: "Kilogrammes (kg)" },
      { value: "g", label: "Grammes (g)" },
      { value: "L", label: "Litres (L)" },
      { value: "mL", label: "Millilitres (mL)" },
      { value: "pièces", label: "Pièces" },
      { value: "unités", label: "Unités" },
      { value: "cartons", label: "Cartons" },
      { value: "sacs", label: "Sacs" },
      { value: "paquets", label: "Paquets" },
    ];
  }

  //Get donations

  //available
  async getAvailableDonations(
    page: number = 1,
    limit: number = 20,
    filters?: DonationFilters,
  ) {
    const { skip } = getPagination(page, limit);

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

  //nearby
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

  //by id
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

  //of a donor
  async getDonorDonations(user: User, page: number = 1, limit: number = 20) {
    const donor = await this.donorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!donor) {
      throw new Error("Vous n'êtes pas un donateur");
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

  //expired
  async getExpiredDonations(): Promise<Donation[]> {
    return await this.donationRepository.find({
      where: {
        status: DonationStatus.AVAILABLE,
        expirationDate: new Date(),
      },
      relations: ["donor", "donor.user"],
    });
  }

  //update status
  async updateDonationStatus(
    id: string,
    status: DonationStatus,
  ): Promise<Donation | null> {
    const donation = await this.getDonationById(id);

    if (!donation) {
      throw new Error("Don non trouvé");
    }

    donation.status = status;
    await this.donationRepository.save(donation);

    // Notifier donor
    if (donation.donor?.user) {
      const message = `Le statut de votre don "${donation.foodType}" est passé à ${status}`;
      await sendNotification(
        donation.donor.user.id,
        NOTIF_TYPES.NEW_DONATION,
        message,
        `/donations/${id}`,
      );
    }

    return donation;
  }

  //update available quantity
  async updateAvailableQuantity(
    donationId: string,
    quantityToReduce: number,
  ): Promise<Donation | null> {
    const donation = await this.donationRepository.findOne({
      where: { id: donationId },
    });

    if (!donation) {
      throw new Error("Don non trouvé");
    }

    if (quantityToReduce > donation.availableQuantity) {
      throw new Error("Quantité insuffisante");
    }

    donation.availableQuantity -= quantityToReduce;

    // Si plus de quantité disponible, marquer comme complété
    if (donation.availableQuantity <= 0) {
      donation.status = DonationStatus.COMPLETED;
    }

    await this.donationRepository.save(donation);
    return donation;
  }

  //delete donation
  async deleteDonation(id: string, user: User): Promise<void> {
    const donation = await this.donationRepository.findOne({
      where: { id },
      relations: ["donor", "donor.user"],
    });

    if (!donation) {
      throw new Error("Don non trouvé");
    }

    // Vérifier que l'utilisateur est le propriétaire ou admin
    if (donation.donor.user.id !== user.id && user.role !== "admin") {
      throw new Error("Vous n'êtes pas autorisé à supprimer ce don");
    }

    // Vérifier qu'il n'y a pas de demandes approuvées
    const hasApprovedRequests = await this.requestRepository.count({
      where: {
        donation: { id },
        status: RequestStatus.APPROVED,
      },
    });

    if (hasApprovedRequests > 0) {
      throw new Error(
        "Impossible de supprimer un don avec des demandes approuvées",
      );
    }

    await this.donationRepository.remove(donation);
  }

  //change status to expired
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

  //static donation for donor
  async getDonorStats(user: User): Promise<any> {
    const donor = await this.donorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!donor) {
      throw new Error("Vous n'êtes pas un donateur");
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

  //donation by key word
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
}
