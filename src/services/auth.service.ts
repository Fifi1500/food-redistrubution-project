import { AppDataSource } from "../config/db";
import {
  User,
  UserRole,
  Donor,
  Beneficiary,
  BusinessType,
  OrganizationType,
} from "../entities/index";
import {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  formatError,
  sendNotification,
  NOTIF_TYPES,
} from "../utils";

// ============================================
// INTERFACES
// ============================================

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: UserRole;
  address: string;
  // Pour les donateurs
  organizationName?: string;
  businessType?: BusinessType;
  // Pour les bénéficiaires
  organizationType?: OrganizationType;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Partial<User>;
  token: string;
}

// ============================================
// SERVICE
// ============================================

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private donorRepository = AppDataSource.getRepository(Donor);
  private beneficiaryRepository = AppDataSource.getRepository(Beneficiary);

  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    // 1. Validation des données
    if (!data.email || !data.password || !data.name) {
      throw new Error("Email, mot de passe et nom sont requis");
    }

    if (!isValidEmail(data.email)) {
      throw new Error("Email invalide");
    }

    if (!isValidPassword(data.password)) {
      throw new Error("Le mot de passe doit contenir au moins 6 caractères");
    }

    if (data.phone && !isValidPhone(data.phone)) {
      throw new Error("Numéro de téléphone invalide");
    }

    // 2. Vérifier si l'utilisateur existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("Cet email est déjà utilisé");
    }

    // 3. Hasher le mot de passe
    const hashedPassword = await hashPassword(data.password);

    // 4. Créer l'utilisateur de base
    const user = new User();
    user.email = data.email;
    user.password = hashedPassword;
    user.name = data.name;
    user.phone = data.phone;
    user.role = data.role;
    user.address = data.address;
    user.isActive = true;

    await this.userRepository.save(user);

    // 5. Créer le profil spécifique selon le rôle
    if (data.role === UserRole.DONOR) {
      if (!data.organizationName) {
        throw new Error(
          "Le nom de l'organisation est requis pour les donateurs",
        );
      }

      const donor = this.donorRepository.create({
        user: user,
        organizationName: data.organizationName,
        businessType: data.businessType || BusinessType.OTHER,
        isVerified: false,
      });
      await this.donorRepository.save(donor);
    } else if (data.role === UserRole.BENEFICIARY) {
      const beneficiary = this.beneficiaryRepository.create({
        user: user,
        organizationType: data.organizationType || OrganizationType.INDIVIDUAL,
        isVerified: false,
      });
      await this.beneficiaryRepository.save(beneficiary);
    }

    // 6. Générer le token JWT
    const token = generateToken(user);

    // 7. Ne pas renvoyer le mot de passe
    const { password, ...userWithoutPassword } = user;

    // 8. Envoyer une notification de bienvenue
    await sendNotification(
      user.id,
      NOTIF_TYPES.NEW_DONATION,
      `Bienvenue ${user.name} sur Food Surplus !`,
    );

    return { user: userWithoutPassword, token };
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    // 1. Validation
    if (!email || !password) {
      throw new Error("Email et mot de passe requis");
    }

    // 2. Trouver l'utilisateur
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ["donorProfile", "beneficiaryProfile"],
    });

    if (!user) {
      throw new Error("Email ou mot de passe incorrect");
    }

    // 3. Vérifier si le compte est actif
    if (user.isActive === false) {
      throw new Error(
        "Votre compte a été désactivé. Contactez l'administrateur.",
      );
    }

    // 4. Vérifier le mot de passe
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      throw new Error("Email ou mot de passe incorrect");
    }

    // 5. Générer le token
    const token = generateToken(user);

    // 6. Ne pas renvoyer le mot de passe
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  /**
   * Récupérer le profil d'un utilisateur
   */
  async getProfile(userId: string): Promise<Partial<User> | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["donorProfile", "beneficiaryProfile"],
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Mettre à jour le profil d'un utilisateur
   */
  async updateProfile(
    userId: string,
    data: Partial<User>,
  ): Promise<Partial<User>> {
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

  /**
   * Changer le mot de passe
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
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

  /**
   * Réinitialiser le mot de passe (oublie)
   */
  async resetPassword(email: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new Error("Aucun compte associé à cet email");
    }

    if (!isValidPassword(newPassword)) {
      throw new Error("Le mot de passe doit contenir au moins 6 caractères");
    }

    user.password = await hashPassword(newPassword);
    await this.userRepository.save(user);
  }

  /**
   * Vérifier si un email existe déjà
   */
  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { email },
    });
    return !!user;
  }

  /**
   * Récupérer tous les utilisateurs (admin)
   */
  async getAllUsers(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ users: Partial<User>[]; total: number }> {
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

  /**
   * Désactiver un utilisateur (admin)
   */
  async deactivateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    user.isActive = false;
    await this.userRepository.save(user);
  }

  /**
   * Activer un utilisateur (admin)
   */
  async activateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    user.isActive = true;
    await this.userRepository.save(user);
  }

  /**
   * Supprimer un utilisateur (admin)
   */
  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    await this.userRepository.remove(user);
  }

  /**
   * Vérifier un donateur (admin)
   */
  async verifyDonor(userId: string): Promise<void> {
    const donor = await this.donorRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!donor) {
      throw new Error("Donateur non trouvé");
    }

    donor.isVerified = true;
    await this.donorRepository.save(donor);
  }

  /**
   * Vérifier un bénéficiaire (admin)
   */
  async verifyBeneficiary(userId: string): Promise<void> {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!beneficiary) {
      throw new Error("Bénéficiaire non trouvé");
    }

    beneficiary.isVerified = true;
    await this.beneficiaryRepository.save(beneficiary);
  }
}
