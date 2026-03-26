import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Donation } from "./Donation";
import { Beneficiary } from "./Beneficiary";

export enum RequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
}

@Entity("requests")
@Index(["status"]) // Index simple
@Index(["donationId"]) // Index pour les recherches par don
export class Request {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Donation, (donation) => donation.requests)
  donation: Donation;

  @Column({ nullable: true })
  donationId: string;

  @ManyToOne(() => Beneficiary, (beneficiary) => beneficiary.requests)
  beneficiary: Beneficiary;

  @Column({ nullable: true })
  beneficiaryId: string;

  @Column("float")
  requestedQuantity: number;

  @Column({
    type: "enum",
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  requestDate: Date;

  @Column({ type: "timestamp", nullable: true })
  processedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
