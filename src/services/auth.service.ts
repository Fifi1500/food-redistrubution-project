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
import { NotificationService } from "./notification.service";

// ============================================
// INTERFACES
// ============================================

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: UserRole;
  wilaya?: string;
  address: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };

  organizationName?: string;
  businessType?: BusinessType;

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
  private notificationService = new NotificationService();

  async register(data: RegisterData): Promise<AuthResponse> {
    // Validation des données
    if (!data.email || !data.password || !data.name) {
      throw new Error("Email, password and name are required");
    }

    if (!isValidEmail(data.email)) {
      throw new Error("Invalid email");
    }

    if (!isValidPassword(data.password)) {
      throw new Error("Password must be at least 6 characters");
    }

    if (data.phone && !isValidPhone(data.phone)) {
      throw new Error("Invalid phone number");
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("This email is already in use");
    }

    // Hasher le mot de passe
    const hashedPassword = await hashPassword(data.password);

    // Résoudre la localisation
    let location: { type: "Point"; coordinates: [number, number] } | null =
      data.location || null;

    //Créer l'utilisateur
    const user = new User();
    user.email = data.email;
    user.password = hashedPassword;
    user.name = data.name;
    user.phone = data.phone;
    user.role = data.role;
    user.wilaya = data.wilaya ?? null;
    user.address = data.address;
    user.location = location;
    user.isActive = true;

    await this.userRepository.save(user);

    // Créer le profil selon le rôle
    if (data.role === UserRole.DONOR) {
      if (!data.organizationName) {
        throw new Error("Organization name is required for donors");
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

    // Notify administrators
    await this.notificationService.notifyAdmins(
      "New user registration",
      `New user ${user.name} (${user.email}) registered as ${data.role}.`,
      {
        link: "/admin/users",
        data: { role: data.role, email: user.email },
      },
    );

    // Générer le token
    const token = generateToken(user);

    const { password, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  // Connexion d'un utilisateur

  async login(email: string, password: string): Promise<AuthResponse> {
    // Validation
    if (!email || !password) {
      throw new Error("Email et mot de passe requis");
    }

    // Trouver l'utilisateur
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ["donorProfile", "beneficiaryProfile"],
    });

    if (!user) {
      throw new Error("Email ou mot de passe incorrect");
    }

    //  Vérifier si le compte est actif
    if (user.isActive === false) {
      throw new Error(
        "Votre compte a été désactivé. Contactez l'administrateur.",
      );
    }

    //  Vérifier le mot de passe
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      throw new Error("Email ou mot de passe incorrect");
    }

    // Générer le token
    const token = generateToken(user);

    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

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

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { email },
    });
    return !!user;
  }

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

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    await this.userRepository.remove(user);
  }

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
