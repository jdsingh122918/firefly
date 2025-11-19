import { prisma } from "@/lib/db/prisma";
import {
  Family,
  CreateFamilyInput,
  User,
  BulkMemberAssignmentInput,
  MemberTransferInput,
  FamilyMergeInput,
  UpdateFamilyRoleInput,
  FamilyRole,
} from "@/lib/types";
import { UserRole } from "@/lib/auth/roles";

export class FamilyRepository {
  /**
   * Create a new family
   */
  async createFamily(data: CreateFamilyInput): Promise<Family> {
    const family = await prisma.family.create({
      data: {
        name: data.name,
        description: data.description || null,
        createdById: data.createdById,
        primaryContactId: data.primaryContactId || null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyRole: true,
            phoneNumber: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return this.transformPrismaFamily(family);
  }

  /**
   * Find family by ID
   */
  async getFamilyById(id: string): Promise<Family | null> {
    const family = await prisma.family.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyRole: true,
            phoneNumber: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return family ? this.transformPrismaFamily(family) : null;
  }

  /**
   * Get all families
   */
  async getAllFamilies(): Promise<Family[]> {
    const families = await prisma.family.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyRole: true,
            phoneNumber: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return families.map(this.transformPrismaFamily);
  }

  /**
   * Get families created by a specific user (for backward compatibility)
   */
  async getFamiliesByCreator(createdById: string): Promise<Family[]> {
    const families = await prisma.family.findMany({
      where: { createdById },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyRole: true,
            phoneNumber: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return families.map(this.transformPrismaFamily);
  }

  /**
   * Get families assigned to a volunteer (new assignment-based method)
   */
  async getFamiliesByVolunteer(volunteerId: string): Promise<Family[]> {
    const assignments = await prisma.volunteerFamilyAssignment.findMany({
      where: {
        volunteerId,
        isActive: true,
      },
      include: {
        family: {
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
            members: {
              select: {
                id: true,
                clerkId: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                familyRole: true,
                phoneNumber: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return assignments.map(assignment => this.transformPrismaFamily(assignment.family));
  }

  /**
   * Assign a volunteer to a family
   */
  async assignVolunteerToFamily(
    volunteerId: string,
    familyId: string,
    assignedBy: string,
    role = "manager"
  ): Promise<void> {
    await prisma.volunteerFamilyAssignment.create({
      data: {
        volunteerId,
        familyId,
        assignedBy,
        role,
        isActive: true,
      },
    });
  }

  /**
   * Remove a volunteer assignment from a family
   */
  async removeVolunteerFromFamily(
    volunteerId: string,
    familyId: string
  ): Promise<void> {
    await prisma.volunteerFamilyAssignment.updateMany({
      where: {
        volunteerId,
        familyId,
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get all volunteers assigned to a family
   */
  async getVolunteersForFamily(familyId: string): Promise<User[]> {
    const assignments = await prisma.volunteerFamilyAssignment.findMany({
      where: {
        familyId,
        isActive: true,
      },
      include: {
        volunteer: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyId: true,
            familyRole: true,
            createdById: true,
            phoneNumber: true,
            phoneVerified: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return assignments.map(assignment => assignment.volunteer as User);
  }

  /**
   * Get all family assignments for a volunteer
   */
  async getVolunteerFamilyAssignments(volunteerId: string) {
    return await prisma.volunteerFamilyAssignment.findMany({
      where: {
        volunteerId,
        isActive: true,
      },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
          },
        },
        assigner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  /**
   * Check if a volunteer is assigned to a family
   */
  async isVolunteerAssignedToFamily(
    volunteerId: string,
    familyId: string
  ): Promise<boolean> {
    const assignment = await prisma.volunteerFamilyAssignment.findFirst({
      where: {
        volunteerId,
        familyId,
        isActive: true,
      },
    });
    return !!assignment;
  }

  /**
   * Update family
   */
  async updateFamily(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Family> {
    const family = await prisma.family.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyRole: true,
            phoneNumber: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return this.transformPrismaFamily(family);
  }

  /**
   * Delete family
   */
  async deleteFamily(id: string): Promise<void> {
    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // First, remove all members from the family
      await tx.user.updateMany({
        where: { familyId: id },
        data: { familyId: null },
      });

      // Then delete the family
      await tx.family.delete({
        where: { id },
      });
    });
  }

  /**
   * Get family statistics
   */
  async getFamilyStats(): Promise<{
    total: number;
    totalMembers: number;
    averageMembersPerFamily: number;
  }> {
    const [total, totalMembers] = await Promise.all([
      prisma.family.count(),
      prisma.user.count({
        where: {
          familyId: { not: null },
        },
      }),
    ]);

    const averageMembersPerFamily =
      total > 0 ? Math.round((totalMembers / total) * 100) / 100 : 0;

    return { total, totalMembers, averageMembersPerFamily };
  }

  /**
   * Transform Prisma family object to application Family type
   */
  private transformPrismaFamily(prismaFamily: {
    id: string;
    name: string;
    description: string | null;
    createdById: string;
    primaryContactId: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
    } | null;
    members?: Array<{
      id: string;
      clerkId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      familyRole: string | null;
      phoneNumber: string | null;
      emailVerified: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): Family {
    return {
      id: prismaFamily.id,
      name: prismaFamily.name,
      description: prismaFamily.description,
      createdById: prismaFamily.createdById,
      primaryContactId: prismaFamily.primaryContactId,
      createdAt: prismaFamily.createdAt,
      updatedAt: prismaFamily.updatedAt,
      createdBy: prismaFamily.createdBy
        ? {
            id: prismaFamily.createdBy.id,
            clerkId: "", // Not included for privacy
            email: prismaFamily.createdBy.email,
            firstName: prismaFamily.createdBy.firstName,
            lastName: prismaFamily.createdBy.lastName,
            role: prismaFamily.createdBy.role as UserRole,
            familyId: null,
            familyRole: null,
            createdById: null,
            phoneNumber: null,
            phoneVerified: false,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : undefined,
      members:
        prismaFamily.members?.map((member) => ({
          id: member.id,
          clerkId: member.clerkId,
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          role: member.role as UserRole,
          familyId: prismaFamily.id,
          familyRole: member.familyRole as FamilyRole | null,
          createdById: null,
          phoneNumber: member.phoneNumber,
          phoneVerified: false,
          emailVerified: member.emailVerified,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        })) || [],
    };
  }

  /**
   * Set primary contact for a family
   */
  async setPrimaryContact(familyId: string, userId: string): Promise<Family> {
    // Update the family's primary contact
    const family = await prisma.family.update({
      where: { id: familyId },
      data: { primaryContactId: userId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyRole: true,
            phoneNumber: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    // Update user's family role to PRIMARY_CONTACT
    await prisma.user.update({
      where: { id: userId },
      data: { familyRole: "PRIMARY_CONTACT" },
    });

    return this.transformPrismaFamily(family);
  }

  /**
   * Update family role for a user
   */
  async updateFamilyRole(data: UpdateFamilyRoleInput): Promise<void> {
    await prisma.user.update({
      where: { id: data.userId },
      data: { familyRole: data.newFamilyRole },
    });

    // If setting as primary contact, update family record too
    if (data.newFamilyRole === "PRIMARY_CONTACT") {
      await prisma.family.update({
        where: { id: data.familyId },
        data: { primaryContactId: data.userId },
      });

      // Remove PRIMARY_CONTACT role from other family members
      await prisma.user.updateMany({
        where: {
          familyId: data.familyId,
          id: { not: data.userId },
          familyRole: "PRIMARY_CONTACT",
        },
        data: { familyRole: "MEMBER" },
      });
    }
  }

  /**
   * Bulk assign users to a family
   */
  async bulkAssignMembers(data: BulkMemberAssignmentInput): Promise<void> {
    await prisma.user.updateMany({
      where: {
        id: { in: data.userIds },
      },
      data: {
        familyId: data.targetFamilyId,
        familyRole: data.familyRole || "MEMBER",
      },
    });
  }

  /**
   * Transfer a member from one family to another
   */
  async transferMember(data: MemberTransferInput): Promise<void> {
    // First check if this user is the primary contact of the source family
    const sourceFamily = await prisma.family.findUnique({
      where: { id: data.fromFamilyId },
      select: { primaryContactId: true },
    });

    // Update user's family assignment
    await prisma.user.update({
      where: { id: data.userId },
      data: {
        familyId: data.toFamilyId,
        familyRole: data.newFamilyRole || "MEMBER",
      },
    });

    // If the transferred user was the primary contact, clear it from source family
    if (sourceFamily?.primaryContactId === data.userId) {
      await prisma.family.update({
        where: { id: data.fromFamilyId },
        data: { primaryContactId: null },
      });
    }

    // If the new role is primary contact, update the target family
    if (data.newFamilyRole === "PRIMARY_CONTACT") {
      await prisma.family.update({
        where: { id: data.toFamilyId },
        data: { primaryContactId: data.userId },
      });

      // Remove PRIMARY_CONTACT role from other target family members
      await prisma.user.updateMany({
        where: {
          familyId: data.toFamilyId,
          id: { not: data.userId },
          familyRole: "PRIMARY_CONTACT",
        },
        data: { familyRole: "MEMBER" },
      });
    }
  }

  /**
   * Merge two families into one
   */
  async mergeFamilies(data: FamilyMergeInput): Promise<Family> {
    const [sourceFamily, targetFamily] = await Promise.all([
      prisma.family.findUnique({
        where: { id: data.sourceFamilyId },
        include: { members: true },
      }),
      prisma.family.findUnique({
        where: { id: data.targetFamilyId },
        include: { members: true },
      }),
    ]);

    if (!sourceFamily || !targetFamily) {
      throw new Error("One or both families not found");
    }

    // Move all members from source to target family
    await prisma.user.updateMany({
      where: { familyId: data.sourceFamilyId },
      data: { familyId: data.targetFamilyId },
    });

    // Handle name and primary contact
    const updateData: { name?: string; primaryContactId?: string } = {};

    if (data.keepSourceName) {
      updateData.name = sourceFamily.name;
    }

    // If target family doesn't have a primary contact, use source family's
    if (!targetFamily.primaryContactId && sourceFamily.primaryContactId) {
      updateData.primaryContactId = sourceFamily.primaryContactId;
    }

    // Update target family if needed
    if (Object.keys(updateData).length > 0) {
      await prisma.family.update({
        where: { id: data.targetFamilyId },
        data: updateData,
      });
    }

    // Delete the source family
    await prisma.family.delete({
      where: { id: data.sourceFamilyId },
    });

    // Return the updated target family
    return (await this.getFamilyById(data.targetFamilyId)) as Family;
  }

  /**
   * Get families with search and filtering
   */
  async searchFamilies(
    query?: string,
    limit = 50,
    offset = 0,
  ): Promise<{
    families: Family[];
    total: number;
  }> {
    const whereClause = query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            {
              members: {
                some: {
                  OR: [
                    {
                      firstName: {
                        contains: query,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      lastName: {
                        contains: query,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      email: { contains: query, mode: "insensitive" as const },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {};

    const [families, total] = await Promise.all([
      prisma.family.findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          members: {
            select: {
              id: true,
              clerkId: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              familyRole: true,
              phoneNumber: true,
              emailVerified: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.family.count({ where: whereClause }),
    ]);

    return {
      families: families.map(this.transformPrismaFamily.bind(this)),
      total,
    };
  }

  /**
   * Get members available for assignment (not currently in any family)
   */
  async getUnassignedMembers(): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: {
        familyId: null,
        role: "MEMBER",
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        familyRole: true,
        familyId: true,
        createdById: true,
        phoneNumber: true,
        phoneVerified: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return users as User[];
  }
}
