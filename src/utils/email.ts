// src/utils/email.ts
export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
}) => {
  // Extraire le lien du HTML
  const linkMatch = options.html.match(/href="([^"]*)"/);
  const resetLink = linkMatch ? linkMatch[1] : null;

  console.log("\n🔐 ========== RÉINITIALISATION ==========");
  console.log(`📧 Email: ${options.to}`);
  console.log(`🔗 LIEN DE RÉINITIALISATION: ${resetLink}`);
  console.log("=========================================\n");

  // Optionnel : envoi réel si configuré
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: `"FoodShare" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      console.log(`✅ Email réel envoyé à ${options.to}`);
    } catch (error) {
      console.error("❌ Erreur envoi réel:", error);
    }
  } else {
    console.log("📧 Mode démo - Email non envoyé réellement");
  }
};
