import { AppDataSource } from "../config/db";
import {
  User,
  UserRole,
  Donor,
  Beneficiary,
  Donation,
  Request,
  Notification,
} from "../entities";
import { hashPassword, comparePassword, isValidPassword } from "../utils";
import { In } from "typeorm";

export class UserService {
  private userRepository = AppDataSource.getRepository(User);
  private donorRepository = AppDataSource.getRepository(Donor);
  private beneficiaryRepository = AppDataSource.getRepository(Beneficiary);
  private donationRepository = AppDataSource.getRepository(Donation);
  private requestRepository = AppDataSource.getRepository(Request);
  private notificationRepository = AppDataSource.getRepository(Notification);

  async getAllUsers(page: number = 1, limit: number = 20) {
    const [users, total] = await this.userRepository.findAndCount({
      relations: ["donorProfile", "beneficiaryProfile"],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });

    const usersWithoutPassword = users.map((user) => {
      const { password, ...rest } = user;
      return rest;
    });

    return { users: usersWithoutPassword, total };
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ["donorProfile", "beneficiaryProfile"],
    });

    if (!user) return null;

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  //apdate my profile
  async updateProfile(userId: string, data: Partial<User>) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    // Ne pas permettre la modification de l'email et du rôle
    delete data.email;
    delete data.role;
    delete data.password;

    // Mettre à jour
    Object.assign(user, data);
    await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  //  changer mon mot de passe
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    // Vérifier l'ancien mot de passe
    const isValid = await comparePassword(oldPassword, user.password);
    if (!isValid) {
      throw new Error("Ancien mot de passe incorrect");
    }

    // Valider le nouveau mot de passe
    if (!isValidPassword(newPassword)) {
      throw new Error(
        "Le nouveau mot de passe doit contenir au moins 6 caractères",
      );
    }

    // Hasher et sauvegarder
    user.password = await hashPassword(newPassword);
    await this.userRepository.save(user);
  }

  // delete my account
  async deleteAccount(userId: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    // Vérifier le mot de passe
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new Error("Mot de passe incorrect");
    }

    await this.userRepository.remove(user);
  }

  // ============================================
  //   Admin
  async verifyDonor(userId: string) {
    const donor = await this.donorRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!donor) {
      throw new Error("Donateur non trouvé");
    }

    donor.isVerified = true;
    await this.donorRepository.save(donor);
  }

  async verifyBeneficiary(userId: string) {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!beneficiary) {
      throw new Error("Bénéficiaire non trouvé");
    }

    beneficiary.isVerified = true;
    await this.beneficiaryRepository.save(beneficiary);
  }

  async deactivateUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    user.isActive = false;
    await this.userRepository.save(user);
  }

  async activateUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    user.isActive = true;
    await this.userRepository.save(user);
  }

  async deleteUser(userId: string): Promise<void> {
    // Commencer une transaction pour garantir l'intégrité
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Vérifier que l'utilisateur existe
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        relations: ["donorProfile", "beneficiaryProfile"],
      });

      if (!user) {
        throw new Error("Utilisateur non trouvé");
      }

      // 2. Supprimer les notifications de l'utilisateur
      await queryRunner.manager.delete(Notification, { user: { id: userId } });

      // 3. Si c'est un donateur, supprimer ses dons et demandes liées
      if (user.donorProfile) {
        const donorId = user.donorProfile.id;

        // Récupérer les IDs des dons du donateur
        const donations = await queryRunner.manager.find(Donation, {
          where: { donor: { id: donorId } },
          select: ["id"],
        });

        const donationIds = donations.map((d) => d.id);

        if (donationIds.length > 0) {
          // Supprimer les demandes liées à ces dons
          await queryRunner.manager.delete(Request, {
            donation: { id: In(donationIds) },
          });
          // Supprimer les dons
          await queryRunner.manager.delete(Donation, {
            donor: { id: donorId },
          });
        }

        // Supprimer le profil donateur
        await queryRunner.manager.delete(Donor, { user: { id: userId } });
      }

      // 4. Si c'est un bénéficiaire, supprimer ses demandes
      if (user.beneficiaryProfile) {
        const beneficiaryId = user.beneficiaryProfile.id;

        // Supprimer les demandes du bénéficiaire
        await queryRunner.manager.delete(Request, {
          beneficiary: { id: beneficiaryId },
        });
        // Supprimer le profil bénéficiaire
        await queryRunner.manager.delete(Beneficiary, { user: { id: userId } });
      }

      // 5. Supprimer l'utilisateur
      await queryRunner.manager.delete(User, { id: userId });

      // Valider la transaction
      await queryRunner.commitTransaction();
    } catch (error) {
      // Annuler la transaction en cas d'erreur
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Libérer le queryRunner
      await queryRunner.release();
    }
  }

  async getUnverifiedUsers() {
    const unverifiedDonors = await this.donorRepository.find({
      where: { isVerified: false },
      relations: ["user"],
      select: {
        id: true,
        organizationName: true,
        businessType: true,
        user: {
          id: true,
          email: true,
          name: true,
          phone: true,
          address: true,
          createdAt: true,
        },
      },
    });

    const unverifiedBeneficiaries = await this.beneficiaryRepository.find({
      where: { isVerified: false },
      relations: ["user"],
      select: {
        id: true,
        organizationType: true,
        user: {
          id: true,
          email: true,
          name: true,
          phone: true,
          address: true,
          createdAt: true,
        },
      },
    });

    return {
      donors: unverifiedDonors.map((d) => ({
        ...d,
        user: { ...d.user, password: undefined },
      })),
      beneficiaries: unverifiedBeneficiaries.map((b) => ({
        ...b,
        user: { ...b.user, password: undefined },
      })),
    };
  }

  async changeRole(userId: string, role: UserRole) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["donorProfile", "beneficiaryProfile"],
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    const oldRole = user.role;
    user.role = role;

    // Gérer les profils spécifiques
    if (oldRole === UserRole.DONOR && user.donorProfile) {
      await this.donorRepository.remove(user.donorProfile);
    }
    if (oldRole === UserRole.BENEFICIARY && user.beneficiaryProfile) {
      await this.beneficiaryRepository.remove(user.beneficiaryProfile);
    }

    await this.userRepository.save(user);
  }
}
