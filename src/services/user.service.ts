import { AppDataSource } from "../config/db";
import { User, UserRole, Donor, Beneficiary } from "../entities";
import { hashPassword, comparePassword, isValidPassword } from "../utils";

export class UserService {
  private userRepository = AppDataSource.getRepository(User);
  private donorRepository = AppDataSource.getRepository(Donor);
  private beneficiaryRepository = AppDataSource.getRepository(Beneficiary);

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

  async deleteUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    await this.userRepository.remove(user);
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
