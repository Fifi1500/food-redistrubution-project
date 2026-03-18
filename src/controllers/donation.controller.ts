import { Request, Response } from "express";
import { DonationService } from "../services/donation.service";

const donationService = new DonationService();

export class DonationController {
  // Créer un don
  async create(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const donation = await donationService.createDonation(user, req.body);
      res.status(201).json({
        message: "Don créé avec succès",
        donation,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message || "Erreur lors de la création du don",
      });
    }
  }

  // Récupérer tous les dons disponibles
  async getAvailable(req: Request, res: Response) {
    try {
      const donations = await donationService.getAvailableDonations();
      res.json({ donations });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la récupération des dons",
      });
    }
  }

  // Récupérer les dons à proximité
  async getNearby(req: Request, res: Response) {
    try {
      const { lat, lng, radius } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          message: "Latitude et longitude requises",
        });
      }

      const donations = await donationService.getNearbyDonations(
        parseFloat(lat as string),
        parseFloat(lng as string),
        radius ? parseFloat(radius as string) : 10,
      );

      res.json({ donations });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la recherche",
      });
    }
  }

  // Récupérer un don par ID
  async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const donation = await donationService.getDonationById(id);

      if (!donation) {
        return res.status(404).json({ message: "Don non trouvé" });
      }

      res.json({ donation });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la récupération",
      });
    }
  }

  // Récupérer les dons du donateur connecté
  async getMyDonations(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const donations = await donationService.getDonorDonations(user);
      res.json({ donations });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la récupération",
      });
    }
  }

  // Mettre à jour le statut d'un don
  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const donation = await donationService.updateDonationStatus(id, status);

      if (!donation) {
        return res.status(404).json({ message: "Don non trouvé" });
      }

      res.json({
        message: "Statut mis à jour avec succès",
        donation,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la mise à jour",
      });
    }
  }

  // Supprimer un don
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await donationService.deleteDonation(id);
      res.json({ message: "Don supprimé avec succès" });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors de la suppression",
      });
    }
  }
}
