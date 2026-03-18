import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import donationRoutes from "./routes/donation.routes";
import { Client } from "pg"; // IMPORTANT: ajouter pg
import { AppDataSource } from "./config/db";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
// Routes simples pour tester
app.get("/", (req, res) => {
  res.send("🍽️ Food Surplus API est opérationnelle !");
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Serveur fonctionne correctement" });
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 Nouveau client connecté");
  socket.on("disconnect", () => {
    console.log("🔌 Client déconnecté");
  });
});

// 📌 FONCTION MAGIQUE : Crée automatiquement la base de données si elle n'existe pas
async function createDatabaseIfNotExists() {
  // Connexion à PostgreSQL (base par défaut 'postgres')
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "password",
    database: "postgres", // On se connecte à la base système 'postgres'
  });

  try {
    console.log("🔍 Vérification de la base de données...");
    await client.connect();

    const dbName = process.env.DB_DATABASE || "food_surplus";

    // Vérifier si la base existe déjà
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );

    if (res.rowCount === 0) {
      console.log(`📦 Création de la base de données "${dbName}"...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Base de données "${dbName}" créée avec succès !`);
    } else {
      console.log(`✅ La base de données "${dbName}" existe déjà`);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la création de la base:", error);
    console.log("💡 Vérifiez que PostgreSQL est bien installé et lancé");
    process.exit(1); // Arrêter le serveur si pas de base de données
  } finally {
    await client.end();
  }
}

// 🚀 FONCTION PRINCIPALE : Initialise tout
async function startServer() {
  try {
    // 1. Créer la base si nécessaire
    await createDatabaseIfNotExists();

    // 2. Initialiser TypeORM (qui va créer les tables automatiquement)
    await AppDataSource.initialize();
    console.log("✅ Connexion à la base de données établie");
    console.log("📊 Tables créées automatiquement (synchronize: true)");

    // 3. Démarrer le serveur
    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
      console.log(`📝 Environnement: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  }
}

// Lancer tout !
startServer();

export { io };
