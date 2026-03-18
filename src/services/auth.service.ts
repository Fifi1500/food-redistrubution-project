import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database";
import { User, UserRole } from "../entities/User";
import { Donor } from "../entities/Donor";
import { Beneficiary } from "../entities/Beneficiary";

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private donorRepository = AppDataSource.getRepository(Donor);
  private beneficiaryRepository = AppDataSource.getRepository(Beneficiary);

  async register(userData: any) {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new Error("Cet email est déjà utilisé");
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Créer l'utilisateur de base
    const user = this.userRepository.create({
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      phone: userData.phone,
      role: userData.role,
      address: userData.address,
    });

    await this.userRepository.save(user);

    // Créer le profil spécifique selon le rôle
    if (userData.role === UserRole.DONOR) {
      const donor = this.donorRepository.create({
        user: user,
        organizationName: userData.organizationName,
        businessType: userData.businessType,
      });
      await this.donorRepository.save(donor);
    } else if (userData.role === UserRole.BENEFICIARY) {
      const beneficiary = this.beneficiaryRepository.create({
        user: user,
        organizationType: userData.organizationType,
      });
      await this.beneficiaryRepository.save(beneficiary);
    }

    // Générer le token JWT
    const token = this.generateToken(user);

    return { user, token };
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ["donorProfile", "beneficiaryProfile"],
    });

    if (!user) {
      throw new Error("Email ou mot de passe incorrect");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error("Email ou mot de passe incorrect");
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  private generateToken(user: User) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "secret_temp",
      { expiresIn: "7d" },
    );
  }
}
