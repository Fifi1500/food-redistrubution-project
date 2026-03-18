import { AppDataSource } from "../config/db";
import { Donation, DonationStatus, FoodCategory } from "../entities/Donation";
import { Donor } from "../entities/Donor";
import { User } from "../entities/User";

export class DonationService {
  private donationRepository = AppDataSource.getRepository(Donation);
  private donorRepository = AppDataSource.getRepository(Donor);

  // Créer un nouveau don
  async createDonation(user: User, donationData: any) {
    // Récupérer le profil donateur
    const donor = await this.donorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!donor) {
      throw new Error("Utilisateur n'est pas un donateur");
    }

    // Créer le don
    const donation = this.donationRepository.create({
      donor: donor,
      foodType: donationData.foodType,
      category: donationData.category,
      totalQuantity: donationData.totalQuantity,
      availableQuantity: donationData.totalQuantity, // Au début = total
      expirationDate: donationData.expirationDate,
      pickupAddress: donationData.pickupAddress,
      pickupLocation: donationData.pickupLocation, // Format: { type: "Point", coordinates: [lng, lat] }
      requiresRefrigeration: donationData.requiresRefrigeration || false,
      handlingInstructions: donationData.handlingInstructions,
      imageUrl: donationData.imageUrl,
      status: DonationStatus.AVAILABLE,
    });

    return await this.donationRepository.save(donation);
  }

  // Récupérer tous les dons disponibles
  async getAvailableDonations() {
    return await this.donationRepository.find({
      where: { status: DonationStatus.AVAILABLE },
      relations: ["donor", "donor.user"],
      order: { createdAt: "DESC" },
    });
  }

  // Récupérer les dons à proximité (simplifié)
  async getNearbyDonations(lat: number, lng: number, radius: number = 10) {
    // Note: Pour une vraie recherche géospatiale, il faudrait utiliser PostGIS
    // Mais pour l'instant, on retourne tous les dons disponibles
    return await this.getAvailableDonations();
  }

  // Récupérer un don par ID
  async getDonationById(id: string) {
    return await this.donationRepository.findOne({
      where: { id },
      relations: ["donor", "donor.user"],
    });
  }

  // Récupérer les dons d'un donateur
  async getDonorDonations(user: User) {
    const donor = await this.donorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!donor) {
      throw new Error("Utilisateur n'est pas un donateur");
    }

    return await this.donationRepository.find({
      where: { donor: { id: donor.id } },
      relations: [
        "requests",
        "requests.beneficiary",
        "requests.beneficiary.user",
      ],
      order: { createdAt: "DESC" },
    });
  }

  // Mettre à jour le statut d'un don
  async updateDonationStatus(id: string, status: DonationStatus) {
    await this.donationRepository.update(id, { status });
    return await this.getDonationById(id);
  }

  // Supprimer un don (soft delete ou réel)
  async deleteDonation(id: string) {
    return await this.donationRepository.delete(id);
  }
}
