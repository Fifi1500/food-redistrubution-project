// Rôles utilisateur
export enum UserRole {
  DONOR = "donor",
  BENEFICIARY = "beneficiary",
  ADMIN = "admin",
}

// Type de commerce
export enum BusinessType {
  BAKERY = "bakery",
  RESTAURANT = "restaurant",
  SUPERMARKET = "supermarket",
  OTHER = "other",
}

// Type d'organisation bénéficiaire
export enum OrganizationType {
  ASSOCIATION = "association",
  INDIVIDUAL = "individual",
  OTHER = "other",
}

// Catégories alimentaires
export enum FoodCategory {
  BAKERY = "bakery",
  PREPARED_MEALS = "prepared_meals",
  GROCERIES = "groceries",
  PRODUCE = "produce",
  DAIRY = "dairy",
  OTHER = "other",
}

// Statut d'un don
export enum DonationStatus {
  AVAILABLE = "available",
  RESERVED = "reserved",
  COMPLETED = "completed",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

// Statut d'une demande
export enum RequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum NotificationType {
  NEW_DONATION = "new_donation",
  DONATION_STATUS_CHANGED = "donation_status_changed",
  REQUEST_RECEIVED = "request_received",
  REQUEST_STATUS_CHANGED = "request_status_changed",
  REQUEST_APPROVED = "request_approved",
  REQUEST_REJECTED = "request_rejected",
  PICKUP_REMINDER = "pickup_reminder",
}
// units for quantity
export type UnitType =
  | "kg"
  | "g"
  | "L"
  | "mL"
  | "pièces"
  | "unités"
  | "cartons"
  | "sacs"
  | "boîtes"
  | string;

export const UNITS = {
  KILOGRAM: "kg",
  GRAM: "g",
  LITER: "L",
  MILLILITER: "mL",
  PIECES: "pièces",
  UNITS: "unités",
  BOXES: "cartons",
  BAGS: "sacs",
  PACKS: "paquets",
  PLATES: "plateaux",
  TRAYS: "barquettes",
} as const;
