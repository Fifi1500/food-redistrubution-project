import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
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
  RESERVED = "reserved",
  COMPLETED = "completed",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

@Entity("donations")
export class Donation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Donor, (donor) => donor.donations)
  donor: Donor;

  @Column()
  foodType: string;

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

  @Column({ type: "timestamp" })
  expirationDate: Date; // date limite de consommation

  @Column()
  pickupAddress: string;

  @Column({
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
  })
  pickupLocation: { type: "Point"; coordinates: [number, number] };

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
