import { Request, Response } from "express";
import { DonationService } from "../services";

const donationService = new DonationService();

export class DonationController {
  // create
  static async create(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      const donation = await donationService.createDonation(user, req.body);
      res.status(201).json(donation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getUnits(req: Request, res: Response) {
    try {
      const units = await donationService.getUnits();
      res.json({ units });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await donationService.getAvailableDonations(page, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async nearby(req: Request, res: Response) {
    try {
      const { lat, lng, radius } = req.query;
      if (!lat || !lng) {
        return res
          .status(400)
          .json({ message: "Latitude et longitude requises" });
      }
      const donations = await donationService.getNearbyDonations(
        parseFloat(lat as string),
        parseFloat(lng as string),
        radius ? parseFloat(radius as string) : 10,
      );
      res.json({ donations });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const donation = await donationService.getDonationById(id);
      if (!donation) {
        return res.status(404).json({ message: "Don non trouvé" });
      }
      res.json({ donation });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async myDonations(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      const donations = await donationService.getDonorDonations(user);
      res.json({ donations });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      const donation = await donationService.updateDonationStatus(
        id,
        status,
        user,
      );
      res.json({ donation });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      await donationService.deleteDonation(id, user);

      res.json({ message: "Don supprimé avec succès" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
