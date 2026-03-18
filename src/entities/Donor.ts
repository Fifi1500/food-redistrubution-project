import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Donation } from "./Donation";

export enum BusinessType {
  BAKERY = "bakery",
  RESTAURANT = "restaurant",
  SUPERMARKET = "supermarket",
  OTHER = "other",
}

@Entity("donors")
export class Donor {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => User, (user) => user.donorProfile)
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column()
  organizationName: string;

  @Column({
    type: "enum",
    enum: BusinessType,
    default: BusinessType.OTHER,
  })
  businessType: BusinessType;

  @Column({ nullable: true })
  verificationDocument: string; // URL ou chemin du fichier

  @Column({ default: false })
  isVerified: boolean;

  @OneToMany(() => Donation, (donation) => donation.donor)
  donations: Donation[];
}
