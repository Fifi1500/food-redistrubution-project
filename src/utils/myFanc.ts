import bcrypt from "bcryptjs";
import { io } from "../app";
import { UnitType } from "../entities/Donation";
import { NotificationType } from "./types";
// ============================================
// 1. VALIDATION
// ============================================

// email
export const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
  return regex.test(email);
};

// password
export const isValidPassword = (password: string): string | boolean => {
  return password && password.length >= 6;
};
// phone
export const isValidPhone = (phone: string): boolean => {
  const regex = /^[0-9+\s]{8,15}$/;
  return regex.test(phone);
};
//GPS
export const isValidCoordinates = (lat: number, lng: number): boolean => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

//quantity
export const isValidQuantity = (quantity: number): boolean => {
  return quantity > 0 && quantity < 10000;
};
//address
export const isValidAddress = (address: string): string | boolean => {
  return address && address.trim().length >= 5;
};
//name
export const isValidName = (name: string): string | boolean => {
  return name && name.trim().length >= 2;
};

//date (to be in the future)
export const isValidFutureDate = (date: Date): boolean => {
  return new Date(date) > new Date();
};

export const isValidUnit = (unit: string): boolean => {
  return Object.values(UnitType).includes(unit as UnitType);
};

// ============================================
// 2. AUTHENTIFICATION
// ============================================

// Hashe password
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

// password compare
export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

// ============================================
// 3. DISTANCE
// ============================================

const toRad = (degrees: number): number => degrees * (Math.PI / 180);

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ============================================
// 4. NOTIFICATIONS
// ============================================

// Structure d'une notification
export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  donationId?: string;
  requestId?: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
  data?: any;
}

// send to user
export const sendNotification = (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    donationId?: string;
    requestId?: string;
    link?: string;
    data?: any;
  },
) => {
  const notification: NotificationPayload = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    type,
    title,
    message,
    donationId: options?.donationId,
    requestId: options?.requestId,
    link:
      options?.link ||
      (options?.donationId ? `/donations/${options.donationId}` : undefined),
    isRead: false,
    createdAt: new Date(),
    data: options?.data,
  };

  io.to(`user:${userId}`).emit("notification", notification);
  return notification;
};

export const broadcastToBeneficiaries = (
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    donationId?: string;
    link?: string;
    data?: any;
  },
) => {
  const notification: NotificationPayload = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    type,
    title,
    message,
    donationId: options?.donationId,
    link:
      options?.link ||
      (options?.donationId ? `/donations/${options.donationId}` : undefined),
    isRead: false,
    createdAt: new Date(),
    data: options?.data,
  };

  io.to("role:beneficiary").emit("notification", notification);
};
// ============================================
// 5. FORMATAGE
// ============================================

// date
export const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

//quantity
export const formatQuantity = (
  quantity: number,
  unit: UnitType = UnitType.KG,
): string => {
  return `${quantity} ${unit}`;
};

// ============================================
// 6. PAGINATION
// ============================================

export const getPagination = (page: number = 1, limit: number = 20) => {
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(100, Math.max(1, limit));
  return { page: pageNum, limit: limitNum, skip: (pageNum - 1) * limitNum };
};

export const paginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) => {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// ============================================
// 7. GÉNÉRATION D'ID
// ============================================

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// ============================================
// 8. GESTION DES ERREURS
// ============================================

export const formatError = (error: any): { message: string; code?: string } => {
  if (error.code === "23505")
    return { message: "Déjà existant", code: "DUPLICATE" };
  if (error.code === "23503")
    return { message: "Ressource non trouvée", code: "FOREIGN_KEY" };
  if (error.code === "42704")
    return { message: "PostGIS non installé", code: "POSTGIS_MISSING" };
  return {
    message: error.message || "Erreur serveur",
    code: error.code || "UNKNOWN",
  };
};

// ============================================
// 9. TYPES DE NOTIFICATIONS
// ============================================

export const NOTIF_TYPES = {
  NEW_DONATION: NotificationType.NEW_DONATION,
  DONATION_STATUS_CHANGED: NotificationType.DONATION_STATUS_CHANGED,
  REQUEST_RECEIVED: NotificationType.REQUEST_RECEIVED,
  REQUEST_STATUS_CHANGED: NotificationType.REQUEST_STATUS_CHANGED,
  REQUEST_APPROVED: NotificationType.REQUEST_APPROVED,
  REQUEST_REJECTED: NotificationType.REQUEST_REJECTED,
  PICKUP_REMINDER: NotificationType.PICKUP_REMINDER,
} as const;

// ============================================
// /LISTE OF UNITS
// ============================================

export const UNITS_LIST = [
  { value: UnitType.KG, label: "Kilogrammes (kg)" },
  { value: UnitType.G, label: "Grammes (g)" },
  { value: UnitType.L, label: "Litres (L)" },
  { value: UnitType.ML, label: "Millilitres (mL)" },
  { value: UnitType.PIECES, label: "Pièces" },
  { value: UnitType.UNITS, label: "Unités" },
  { value: UnitType.BOXES, label: "Cartons" },
  { value: UnitType.BAGS, label: "Sacs" },
  { value: UnitType.PACKS, label: "Paquets" },
  { value: UnitType.TRAYS, label: "Plateaux" },
  { value: UnitType.CONTAINERS, label: "Barquettes" },
];
