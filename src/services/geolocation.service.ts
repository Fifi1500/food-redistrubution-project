import { AppDataSource } from "../config/db";
import { Donation, DonationStatus } from "../entities/Donation";

export class GeolocationService {
  private donationRepository = AppDataSource.getRepository(Donation);

  // Trouver les dons à proximité (rayon en km)
  async findNearbyDonations(lat: number, lng: number, radiusKm: number = 10) {
    const query = `
      SELECT d.*, 
             ST_Distance(d."pickupLocation", ST_SetSRID(ST_MakePoint($1, $2), 4326)) as distance
      FROM donations d
      WHERE d.status = 'available'
        AND ST_DWithin(
          d."pickupLocation", 
          ST_SetSRID(ST_MakePoint($1, $2), 4326), 
          $3
        )
      ORDER BY distance ASC
    `;

    const donations = await AppDataSource.query(query, [
      lng,
      lat,
      radiusKm * 1000,
    ]);
    return donations;
  }

  // Calculer la distance entre deux points
  async calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): Promise<number> {
    const query = `
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint($1, $2), 4326),
        ST_SetSRID(ST_MakePoint($3, $4), 4326)
      ) as distance
    `;

    const result = await AppDataSource.query(query, [lng1, lat1, lng2, lat2]);
    return result[0].distance / 1000; // Convertir mètres en km
  }
}
