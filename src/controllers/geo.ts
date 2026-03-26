import { Request, Response } from "express";
import { GeolocationService } from "../services/geolocation.service";

const geolocationService = new GeolocationService();

export class GeolocationController {
  // Trouver les dons à proximité
  async findNearby(req: Request, res: Response) {
    try {
      const { lat, lng, radius } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          message: "Latitude et longitude requises",
        });
      }

      const donations = await geolocationService.findNearbyDonations(
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

  // Calculer la distance entre deux points
  async calculateDistance(req: Request, res: Response) {
    try {
      const { lat1, lng1, lat2, lng2 } = req.query;

      if (!lat1 || !lng1 || !lat2 || !lng2) {
        return res.status(400).json({
          message: "Les deux points sont requis",
        });
      }

      const distance = await geolocationService.calculateDistance(
        parseFloat(lat1 as string),
        parseFloat(lng1 as string),
        parseFloat(lat2 as string),
        parseFloat(lng2 as string),
      );

      res.json({ distanceKm: distance });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Erreur lors du calcul",
      });
    }
  }
}
