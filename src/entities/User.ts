import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  IntegerType,
} from "typeorm";
import { Donor } from "./Donor";
import { Beneficiary } from "./Beneficiary";

export enum UserRole {
  DONOR = "donor",
  BENEFICIARY = "beneficiary",
  ADMIN = "admin",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // sera hashé

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.BENEFICIARY,
  })
  role: UserRole;
  @Column({
    type: "varchar",
    length: 2,
    nullable: true,
  })
  wilaya: string;

  @Column({ nullable: true })
  address: string;

  @Column({
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    nullable: true,
  })
  location: { type: "Point"; coordinates: [number, number] };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations (facultatives)
  @OneToOne(() => Donor, (donor) => donor.user, { cascade: true })
  donorProfile?: Donor;

  @OneToOne(() => Beneficiary, (beneficiary) => beneficiary.user, {
    cascade: true,
  })
  beneficiaryProfile?: Beneficiary;
}
