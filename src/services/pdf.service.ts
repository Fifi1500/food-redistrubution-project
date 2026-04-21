import PDFDocument from "pdfkit";
import { AppDataSource } from "../config/db";
import { Donation, DonationStatus, Request, User, UserRole } from "../entities";
import { getWilayaName } from "../utils/myFanc";

export class PDFService {
  private donationRepository = AppDataSource.getRepository(Donation);
  private requestRepository = AppDataSource.getRepository(Request);
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Générer un PDF des dons
   */
  async generateDonationsPDF(): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const donations = await this.donationRepository.find({
          relations: ["donor", "donor.user"],
          order: { createdAt: "DESC" },
        });

        const doc = new PDFDocument({ margin: 50 });
        const buffers: any[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        // Entête
        doc.fontSize(20).text("Rapport des Dons", { align: "center" });
        doc.moveDown();
        doc
          .fontSize(10)
          .text(`Généré le: ${new Date().toLocaleDateString()}`, {
            align: "center",
          });
        doc.moveDown();

        // Statistiques
        const totalDonations = donations.length;
        const totalQuantity = donations.reduce(
          (sum, d) => sum + d.totalQuantity,
          0,
        );

        doc
          .fontSize(12)
          .text(`Total dons: ${totalDonations}`, { continued: true });
        doc.text(`   Quantité totale: ${totalQuantity} kg`, { align: "right" });
        doc.moveDown();

        // Tableau
        const startX = 50;
        let startY = doc.y + 10;

        // En-têtes du tableau
        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("Type", startX, startY, { width: 80 });
        doc.text("Quantité", startX + 85, startY, { width: 70 });
        doc.text("Unité", startX + 160, startY, { width: 50 });
        doc.text("Statut", startX + 215, startY, { width: 80 });
        doc.text("Donateur", startX + 300, startY, { width: 100 });
        doc.text("Date", startX + 410, startY, { width: 80 });

        startY += 20;
        doc.font("Helvetica");

        // Lignes du tableau
        for (const d of donations) {
          if (startY > 700) {
            doc.addPage();
            startY = 50;
          }

          doc.text(d.foodType.substring(0, 20), startX, startY, { width: 80 });
          doc.text(d.totalQuantity.toString(), startX + 85, startY, {
            width: 70,
          });
          doc.text(d.unit, startX + 160, startY, { width: 50 });
          doc.text(d.status, startX + 215, startY, { width: 80 });
          doc.text(
            d.donor?.user?.name?.substring(0, 15) || "N/A",
            startX + 300,
            startY,
            { width: 100 },
          );
          doc.text(d.createdAt.toLocaleDateString(), startX + 410, startY, {
            width: 80,
          });

          startY += 20;
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Générer un PDF des utilisateurs
   */
  async generateUsersPDF(role?: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const where: any = {};
        if (role && role !== "all") where.role = role;

        const users = await this.userRepository.find({
          where,
          relations: ["donorProfile", "beneficiaryProfile"],
          order: { createdAt: "DESC" },
        });

        const doc = new PDFDocument({ margin: 50 });
        const buffers: any[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        // Entête
        doc.fontSize(20).text("Rapport des Utilisateurs", { align: "center" });
        doc.moveDown();
        doc
          .fontSize(10)
          .text(`Généré le: ${new Date().toLocaleDateString()}`, {
            align: "center",
          });
        if (role) doc.text(`Rôle: ${role}`, { align: "center" });
        doc.moveDown();

        // Statistiques
        doc.fontSize(12).text(`Total utilisateurs: ${users.length}`);
        doc.moveDown();

        // Tableau
        let startY = doc.y + 10;

        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("Nom", 50, startY, { width: 100 });
        doc.text("Email", 155, startY, { width: 120 });
        doc.text("Téléphone", 280, startY, { width: 80 });
        doc.text("Rôle", 365, startY, { width: 60 });
        doc.text("Date", 430, startY, { width: 80 });

        startY += 20;
        doc.font("Helvetica");

        for (const u of users.slice(0, 30)) {
          if (startY > 700) {
            doc.addPage();
            startY = 50;
          }

          doc.text(u.name.substring(0, 20), 50, startY, { width: 100 });
          doc.text(u.email.substring(0, 25), 155, startY, { width: 120 });
          doc.text(u.phone || "N/A", 280, startY, { width: 80 });
          doc.text(u.role, 365, startY, { width: 60 });
          doc.text(u.createdAt.toLocaleDateString(), 430, startY, {
            width: 80,
          });

          startY += 20;
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Générer un PDF des statistiques (Dashboard)
   */
  async generateStatsPDF(): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const totalDonations = await this.donationRepository.count();
        const completedDonations = await this.donationRepository.count({
          where: {  status: DonationStatus.COMPLETED },
        });
        const totalUsers = await this.userRepository.count();
        const totalDonors = await this.userRepository.count({
          where: { role: UserRole.DONOR },
        });
        const totalBeneficiaries = await this.userRepository.count({
          where: { role: UserRole.BENEFICIARY },
        });

        const totalQuantityResult = await this.donationRepository
          .createQueryBuilder("donation")
          .select("SUM(donation.totalQuantity)", "total")
          .where("donation.status = :status", { status: DonationStatus.COMPLETED })
          .getRawOne();

        const totalQuantity = parseFloat(totalQuantityResult?.total || 0);

        const doc = new PDFDocument({ margin: 50 });
        const buffers: any[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        // Entête
        doc
          .fontSize(20)
          .text("Tableau de Bord - Statistiques", { align: "center" });
        doc.moveDown();
        doc
          .fontSize(10)
          .text(`Généré le: ${new Date().toLocaleDateString()}`, {
            align: "center",
          });
        doc.moveDown();
        doc.moveDown();

        // Statistiques
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("📊 Vue d'ensemble", { underline: true });
        doc.moveDown();
        doc.fontSize(12).font("Helvetica");

        doc.text(`• Total des dons: ${totalDonations}`, { continued: true });
        doc.text(`   Dons complétés: ${completedDonations}`, {
          align: "right",
        });
        doc.moveDown(0.5);

        doc.text(`• Total utilisateurs: ${totalUsers}`, { continued: true });
        doc.text(
          `   Donateurs: ${totalDonors} | Bénéficiaires: ${totalBeneficiaries}`,
          { align: "right" },
        );
        doc.moveDown(0.5);

        doc.text(`• Quantité redistribuée: ${totalQuantity} kg`, {
          continued: true,
        });
        doc.text(`   Repas servis: ${Math.floor(totalQuantity * 2)}`, {
          align: "right",
        });
        doc.moveDown();
        doc.moveDown();

        // Impact
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("🌍 Impact environnemental", { underline: true });
        doc.moveDown();
        doc.fontSize(12).font("Helvetica");

        const co2Saved = totalQuantity * 2.5;
        doc.text(`• CO2 évité: ${co2Saved.toFixed(0)} kg`);
        doc.text(
          `• Équivalent trajets voiture: ${Math.floor(co2Saved / 200)} km`,
        );
        doc.text(
          `• Arbres nécessaires pour absorber ce CO2: ${Math.floor(co2Saved / 25)}`,
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
