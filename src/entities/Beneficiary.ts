import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Request } from "./Request";

export enum OrganizationType {
  ASSOCIATION = "association",
  INDIVIDUAL = "individual",
  OTHER = "other",
}

@Entity("beneficiaries")
export class Beneficiary {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => User, (user) => user.beneficiaryProfile)
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({
    type: "enum",
    enum: OrganizationType,
    default: OrganizationType.INDIVIDUAL,
  })
  organizationType: OrganizationType;

  @Column({ nullable: true })
  verificationDocument: string; // URL ou chemin

  @Column({ default: false })
  isVerified: boolean;

  @OneToMany(() => Request, (request) => request.beneficiary)
  requests: Request[];
}
