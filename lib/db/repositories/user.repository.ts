import { prisma } from "@/lib/db/prisma";
import { User, CreateUserInput, Family, FamilyRole } from "@/lib/types";
import { UserRole } from "@/lib/auth/roles";
import { Prisma } from "@prisma/client";

export class UserRepository {
  /**
   * Create a new user in the database
   */
  async createUser(data: CreateUserInput): Promise<User> {
    const user = await prisma.user.create({
      data: {
        clerkId: data.clerkId,
        email: data.email,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        role: data.role,
        familyId: data.familyId || null,
        createdById: data.createdById || null,
        phoneNumber: data.phoneNumber || null,
        emailVerified: true, // Since they verified email to sign up
      },
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return this.transformPrismaUser(user);
  }

  /**
   * Find user by Clerk ID
   */
  async getUserByClerkId(clerkId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return user ? this.transformPrismaUser(user) : null;
  }

  /**
   * Find user by database ID
   */
  async getUserById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return user ? this.transformPrismaUser(user) : null;
  }

  /**
   * Find user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return user ? this.transformPrismaUser(user) : null;
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return this.transformPrismaUser(user);
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string | null;
      role?: UserRole;
      familyId?: string | null;
      familyRole?: string | null;
    }
  ): Promise<User> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName || null }),
        ...(data.lastName !== undefined && { lastName: data.lastName || null }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber || null }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.familyId !== undefined && { familyId: data.familyId || null }),
        ...(data.familyRole !== undefined && { familyRole: data.familyRole || null }),
      } as Prisma.UserUpdateInput,
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return this.transformPrismaUser(user);
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: { role },
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map(this.transformPrismaUser);
  }

  /**
   * Assign family to user
   */
  async assignFamily(userId: string, familyId: string): Promise<User> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { familyId },
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return this.transformPrismaUser(user);
  }

  /**
   * Get all users with optional filters
   */
  async getAllUsers(filters?: {
    role?: UserRole;
    familyId?: string;
    createdById?: string;
  }): Promise<User[]> {
    const where: Record<string, unknown> = {};

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.familyId) {
      where.familyId = filters.familyId;
    }

    if (filters?.createdById) {
      where.createdById = filters.createdById;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map(this.transformPrismaUser);
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    total: number;
    admins: number;
    volunteers: number;
    members: number;
  }> {
    const [total, admins, volunteers, members] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.user.count({ where: { role: UserRole.VOLUNTEER } }),
      prisma.user.count({ where: { role: UserRole.MEMBER } }),
    ]);

    return { total, admins, volunteers, members };
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Transform Prisma user object to application User type
   */
  private transformPrismaUser(prismaUser: {
    id: string;
    clerkId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    familyId: string | null;
    familyRole: string | null;
    createdById: string | null;
    phoneNumber: string | null;
    phoneVerified: boolean;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    family?: {
      id: string;
      name: string;
      description: string | null;
      createdById: string;
      primaryContactId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdBy?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
    } | null;
  }): User {
    return {
      id: prismaUser.id,
      clerkId: prismaUser.clerkId,
      email: prismaUser.email,
      firstName: prismaUser.firstName,
      lastName: prismaUser.lastName,
      role: prismaUser.role as UserRole,
      familyId: prismaUser.familyId,
      familyRole: (prismaUser.familyRole as FamilyRole) || null,
      createdById: prismaUser.createdById,
      phoneNumber: prismaUser.phoneNumber,
      phoneVerified: prismaUser.phoneVerified,
      emailVerified: prismaUser.emailVerified,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      family: prismaUser.family
        ? ({
            id: prismaUser.family.id,
            name: prismaUser.family.name,
            description: prismaUser.family.description,
            createdById: prismaUser.family.createdById,
            primaryContactId: prismaUser.family.primaryContactId,
            createdAt: prismaUser.family.createdAt,
            updatedAt: prismaUser.family.updatedAt,
          } as Family)
        : null,
      createdBy: prismaUser.createdBy
        ? ({
            id: prismaUser.createdBy.id,
            clerkId: "", // Not included in selection for privacy
            email: prismaUser.createdBy.email,
            firstName: prismaUser.createdBy.firstName,
            lastName: prismaUser.createdBy.lastName,
            role: prismaUser.createdBy.role as UserRole,
            familyId: null,
            familyRole: null,
            createdById: null,
            phoneNumber: null,
            phoneVerified: false,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        : null,
    };
  }
}
