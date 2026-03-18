import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { User } from "./User";

export enum NotificationType {
  NEW_DONATION = "new_donation",
  REQUEST_RECEIVED = "request_received",
  REQUEST_APPROVED = "request_approved",
  REQUEST_REJECTED = "request_rejected",
  REMINDER = "reminder",
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @Column({
    type: "enum",
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  message: string;

  @Column({ nullable: true })
  link: string; // URL ou chemin vers l'entité concernée

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
