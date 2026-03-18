import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Donation } from "./Donation";
import { Beneficiary } from "./Beneficiary";

export enum RequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

@Entity("requests")
export class Request {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Donation, (donation) => donation.requests)
  donation: Donation;

  @ManyToOne(() => Beneficiary, (beneficiary) => beneficiary.requests)
  beneficiary: Beneficiary;

  @Column("float")
  requestedQuantity: number;

  @Column({
    type: "enum",
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @CreateDateColumn()
  requestDate: Date;

  @Column({ type: "timestamp", nullable: true })
  processedAt: Date; // date de réponse (approbation/rejet)

  @Column({ nullable: true })
  notes: string; // pour que le bénéficiaire ajoute un message

  @UpdateDateColumn()
  updatedAt: Date;
}
