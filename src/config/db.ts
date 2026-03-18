import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { User } from "../entities/User";
import { Donor } from "../entities/Donor";
import { Beneficiary } from "../entities/Beneficiary";
import { Donation } from "../entities/Donation";
import { Request } from "../entities/Request";
import { Notification } from "../entities/Notification";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_DATABASE || "food_surplus",
  synchronize: process.env.NODE_ENV === "development", // true en dev pour créer automatiquement les tables (à utiliser avec précaution)
  logging: process.env.NODE_ENV === "development",
  entities: [User, Donor, Beneficiary, Donation, Request, Notification],
  migrations: ["src/migrations/*.ts"],
  subscribers: ["src/subscribers/*.ts"],
});
