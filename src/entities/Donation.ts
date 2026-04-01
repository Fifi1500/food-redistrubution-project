import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Donor } from "./Donor";
import { Request } from "./Request";

export enum FoodCategory {
  BAKERY = "bakery",
  PREPARED_MEALS = "prepared_meals",
  GROCERIES = "groceries",
  PRODUCE = "produce",
  DAIRY = "dairy",
  OTHER = "other",
}

export enum DonationStatus {
  AVAILABLE = "available",
  COMPLETED = "completed",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

export enum UnitType {
  KG = "kg",
  G = "g",
  L = "L",
  ML = "mL",
  PIECES = "pièces",
  UNITS = "unités",
  BOXES = "cartons",
  BAGS = "sacs",
  PACKS = "paquets",
  TRAYS = "plateaux",
  CONTAINERS = "barquettes",
}

@Entity("donations")
@Index(["status"])
export class Donation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Donor, (donor) => donor.donations)
  donor: Donor;

  @Column()
  foodType: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({
    type: "enum",
    enum: FoodCategory,
    default: FoodCategory.OTHER,
  })
  category: FoodCategory;

  @Column("float")
  totalQuantity: number;

  @Column("float")
  availableQuantity: number;

  @Column({
    type: "enum",
    enum: UnitType,
    default: UnitType.KG,
  })
  unit: UnitType;

  @Column({ type: "timestamp" })
  expirationDate: Date;

  @Column()
  pickupAddress: string;

  // should install PostGIS
  // @Column({
  //   type: "geometry",
  //   spatialFeatureType: "Point",
  //   srid: 4326,
  //   nullable: true,
  // })
  pickupLocation: any;

  @Column({ default: false })
  requiresRefrigeration: boolean;

  @Column({ nullable: true })
  handlingInstructions: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({
    type: "enum",
    enum: DonationStatus,
    default: DonationStatus.AVAILABLE,
  })
  status: DonationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Request, (request) => request.donation)
  requests: Request[];
}
