import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { AppDataSource } from "./config/db";
import routes from "./routes/user.routes";
import { Client } from "pg";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Middleware
app.use(helmet());
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: true, // ← Permet toutes les origines
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", routes);

// Health check
app.get("/", (req, res) => res.send("🍽️ Food Surplus API"));
app.get("/health", (req, res) => res.json({ status: "OK" }));

// Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 Client connecté");

  socket.on("authenticate", (userId: string) => {
    socket.join(`user:${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client déconnecté");
  });
});

async function createDatabaseIfNotExists() {
  const dbName = process.env.DB_DATABASE || "food_surplus_db";
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5433"),
    user: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "password",
    database: "postgres",
  });

  try {
    console.log("🔍 Vérification de la base de données...");
    await client.connect();

    // Vérifier d'abord si la base existe
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );

    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Base de données "${dbName}" créée avec succès !`);
    } else {
      console.log(`✅ La base de données "${dbName}" existe déjà`);
    }
  } catch (error) {
    console.error("❌ Erreur:", error);
    throw error;
  } finally {
    await client.end();
  }
}
// ============================================
// DÉMARRAGE
// ============================================

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // 1. Créer la base si elle n'existe pas
    await createDatabaseIfNotExists();

    // 2. Initialiser TypeORM
    await AppDataSource.initialize();
    console.log("✅ Base de données connectée");

    // 3. Activer PostGIS (si nécessaire)
    try {
      await AppDataSource.query("CREATE EXTENSION IF NOT EXISTS postgis;");
      console.log("✅ Extension PostGIS activée");
    } catch (err) {
      console.log("⚠️ PostGIS non disponible (géolocalisation limitée)");
    }

    // 4. Démarrer le serveur
    httpServer.listen(PORT, () => {
      console.log(`🚀 Serveur sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Erreur DB:", error);
  }
}

startServer();

export { io };
