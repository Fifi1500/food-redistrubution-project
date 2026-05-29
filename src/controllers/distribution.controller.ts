import { Request, Response } from "express";
import { DistributionService } from "../services";

const distributionService = new DistributionService();

export class DistributionController {
  static async getAll(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const distributions = await distributionService.getAllDistributions(
        page,
        limit,
      );
      res.json(distributions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const distribution = await distributionService.getDistributionById(id);
      if (!distribution) {
        return res.status(404).json({ message: "Distribution not found" });
      }
      res.json(distribution);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user;

      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const distribution = await distributionService.updateDistributionStatus(
        id,
        status,
        user,
      );
      res.json({ message: "Statut mis à jour", distribution });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = req.user;

      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const result = await distributionService.cancelDistribution(
        id,
        user,
        reason,
      );
      res.json({ message: "Distribution cancelled", result });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const stats = await distributionService.getDistributionStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
