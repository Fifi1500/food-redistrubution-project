import { Request, Response } from "express";
import { StatsService } from "../services";

const statsService = new StatsService();

export class StatsController {
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const stats = await statsService.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getQuickStats(req: Request, res: Response) {
    try {
      const stats = await statsService.getQuickStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getRecentActivities(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const activities = await statsService.getRecentActivities(limit);
      res.json({ activities });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getOverallImpact(req: Request, res: Response) {
    try {
      const impact = await statsService.getOverallImpact();
      res.json(impact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getImpactByPeriod(req: Request, res: Response) {
    try {
      const period = (req.query.period as "day" | "week" | "month") || "month";
      const impact = await statsService.getImpactByPeriod(period);
      res.json(impact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getTopDonors(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const donors = await statsService.getTopDonors(limit);
      res.json({ donors });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getTopBeneficiaries(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const beneficiaries = await statsService.getTopBeneficiaries(limit);
      res.json({ beneficiaries });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getImpactByWilaya(req: Request, res: Response) {
    try {
      const impact = await statsService.getImpactByWilaya();
      res.json({ impact });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
