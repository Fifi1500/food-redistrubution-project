import { Request, Response } from "express";
import { PDFService } from "../services";

const pdfService = new PDFService();

export class PDFController {
  /**
   * Exporter les dons en PDF
   */
  static async exportDonationsPDF(req: Request, res: Response) {
    try {
      const pdf = await pdfService.generateDonationsPDF();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=donations.pdf",
      );
      res.send(pdf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Exporter les utilisateurs en PDF
   */
  static async exportUsersPDF(req: Request, res: Response) {
    try {
      const role = req.query.role as string;
      const pdf = await pdfService.generateUsersPDF(role);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=utilisateurs.pdf",
      );
      res.send(pdf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Exporter les statistiques en PDF
   */
  static async exportStatsPDF(req: Request, res: Response) {
    try {
      const pdf = await pdfService.generateStatsPDF();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=statistiques.pdf",
      );
      res.send(pdf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
