import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { UserRole as AppUserRole } from "@/lib/auth/roles";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import type {
  UserExportParams,
  UserExportData,
  UserJSONExportResponse
} from "@/lib/types/api";
import type { User } from "@/lib/types";

const userRepository = new UserRepository();

// Validation schema for export parameters
const exportParamsSchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  includeContactInfo: z.coerce.boolean().default(true),
  includeFamilyInfo: z.coerce.boolean().default(true),
  roleFilter: z.enum(["all", "ADMIN", "VOLUNTEER", "MEMBER"]).default("all"),
  dateRange: z.enum(["all", "last30", "last90", "lastYear"]).default("all"),
});

// GET /api/users/export - Export users data
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database to check role
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN can export user data
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Insufficient permissions - Admin access required" },
        { status: 403 },
      );
    }

    // Parse and validate export parameters
    const { searchParams } = new URL(request.url);
    const validatedParams = exportParamsSchema.parse({
      format: searchParams.get("format") || undefined,
      includeContactInfo: searchParams.get("includeContactInfo") || undefined,
      includeFamily: searchParams.get("includeFamily") || undefined,
      roleFilter: searchParams.get("roleFilter") || undefined,
      dateRange: searchParams.get("dateRange") || undefined,
    });

    console.log("📊 Exporting users data:", {
      format: validatedParams.format,
      includeContactInfo: validatedParams.includeContactInfo,
      includeFamilyInfo: validatedParams.includeFamilyInfo,
      roleFilter: validatedParams.roleFilter,
      dateRange: validatedParams.dateRange,
      exportedBy: user.email,
    });

    // Get users data
    let users = await userRepository.getAllUsers();

    // Apply role filtering
    if (validatedParams.roleFilter !== "all") {
      users = users.filter((u) => u.role === validatedParams.roleFilter);
    }

    // Apply date range filtering
    if (validatedParams.dateRange !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (validatedParams.dateRange) {
        case "last30":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "last90":
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "lastYear":
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      users = users.filter((user) => user.createdAt >= cutoffDate);
    }

    console.log("✅ Export data prepared:", {
      userCount: users.length,
      roleBreakdown: {
        admin: users.filter((u) => u.role === "ADMIN").length,
        volunteer: users.filter((u) => u.role === "VOLUNTEER").length,
        member: users.filter((u) => u.role === "MEMBER").length,
      },
    });

    // Convert roleFilter for the export functions
    const exportParams: UserExportParams = {
      ...validatedParams,
      roleFilter: validatedParams.roleFilter === "all" ? undefined : validatedParams.roleFilter as AppUserRole,
    };

    // Generate export based on format
    if (validatedParams.format === "csv") {
      const csvData = generateUserCSV(users, exportParams);

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="users-export-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } else {
      const jsonData = generateUserJSON(users, exportParams);

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="users-export-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error exporting users data:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid export parameters",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to export users data" },
      { status: 500 },
    );
  }
}

function generateUserCSV(users: User[], params: UserExportParams): string {
  const headers = [
    "User ID",
    "First Name",
    "Last Name",
    "Role",
    "Family Role",
    "Email Verified",
    "Phone Verified",
    "Created Date",
  ];

  if (params.includeContactInfo) {
    headers.push("Email", "Phone Number");
  }

  if (params.includeFamilyInfo) {
    headers.push("Family ID", "Family Name");
  }

  const rows = users.map((user) => {
    const baseRow = [
      user.id,
      `"${(user.firstName || "").replace(/"/g, '""')}"`,
      `"${(user.lastName || "").replace(/"/g, '""')}"`,
      user.role,
      user.familyRole || "MEMBER",
      user.emailVerified ? "Yes" : "No",
      user.phoneVerified ? "Yes" : "No",
      user.createdAt.toISOString().split("T")[0],
    ];

    if (params.includeContactInfo) {
      baseRow.push(
        `"${user.email.replace(/"/g, '""')}"`,
        `"${(user.phoneNumber || "").replace(/"/g, '""')}"`,
      );
    }

    if (params.includeFamilyInfo) {
      baseRow.push(
        user.familyId || "",
        `"${(user.family?.name || "").replace(/"/g, '""')}"`,
      );
    }

    return baseRow;
  });

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function generateUserJSON(users: User[], params: UserExportParams): UserJSONExportResponse {
  return {
    exportMetadata: {
      generatedAt: new Date().toISOString(),
      totalUsers: users.length,
      parameters: params,
    },
    users: users.map((user) => {
      const exportUser: UserExportData = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.firstName
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : user.email,
        role: user.role,
        familyRole: user.familyRole,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      if (params.includeContactInfo) {
        exportUser.email = user.email;
        exportUser.phoneNumber = user.phoneNumber;
      }

      if (params.includeFamilyInfo && user.family) {
        exportUser.family = {
          id: user.familyId,
          name: user.family.name,
          description: user.family.description,
          memberCount: user.family.members?.length || 0,
        };
      }

      return exportUser;
    }),
  };
}
