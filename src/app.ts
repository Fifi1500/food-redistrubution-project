import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { AppDataSource } from "./config/db";
import routes from "./routes/user.routes";

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

// Démarrage
const PORT = process.env.PORT || 3001;

AppDataSource.initialize()
  .then(() => {
    console.log("✅ Base de données connectée");
    httpServer.listen(PORT, () => {
      console.log(`🚀 Serveur sur http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ Erreur DB:", error);
  });

export { io };
