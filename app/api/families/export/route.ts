import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import type {
  ExportParams,
  ExportedFamily,
  FamilyExportData,
  JSONExportResponse
} from "@/lib/types/api";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

// Validation schema for export parameters
const exportParamsSchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  includeMembers: z.coerce.boolean().default(true),
  includeContactInfo: z.coerce.boolean().default(true),
  dateRange: z.enum(["all", "last30", "last90", "lastYear"]).default("all"),
});

// GET /api/families/export - Export families data
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

    // Only ADMIN and VOLUNTEER can export data
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate export parameters
    const { searchParams } = new URL(request.url);
    const validatedParams = exportParamsSchema.parse({
      format: searchParams.get("format") || undefined,
      includeMembers: searchParams.get("includeMembers") || undefined,
      includeContactInfo: searchParams.get("includeContactInfo") || undefined,
      dateRange: searchParams.get("dateRange") || undefined,
    });

    console.log("📊 Exporting families data:", {
      format: validatedParams.format,
      includeMembers: validatedParams.includeMembers,
      includeContactInfo: validatedParams.includeContactInfo,
      dateRange: validatedParams.dateRange,
      exportedBy: user.email,
    });

    // Get families data
    let families = await familyRepository.getAllFamilies();

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

      families = families.filter((family) => family.createdAt >= cutoffDate);
    }

    console.log("✅ Export data prepared:", {
      familyCount: families.length,
      totalMembers: families.reduce(
        (sum, f) => sum + (f.members?.length || 0),
        0,
      ),
    });

    // Generate export based on format
    if (validatedParams.format === "csv") {
      const csvData = generateCSV(families, validatedParams);

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="families-export-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } else {
      const jsonData = generateJSON(families, validatedParams);

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="families-export-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error exporting families data:", error);

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
      { error: "Failed to export families data" },
      { status: 500 },
    );
  }
}

function generateCSV(families: ExportedFamily[], params: ExportParams): string {
  const headers = [
    "Family ID",
    "Family Name",
    "Description",
    "Created Date",
    "Creator Email",
    "Primary Contact ID",
    "Primary Contact Name",
    "Primary Contact Email",
    "Total Members",
  ];

  if (params.includeMembers) {
    headers.push(
      "Member IDs",
      "Member Names",
      "Member Emails",
      "Member Roles",
      "Family Roles",
    );
  }

  const rows = families.map((family) => {
    const primaryContact = family.members?.find(
      (m) => m.id === family.primaryContactId,
    );

    const baseRow = [
      family.id,
      `"${family.name.replace(/"/g, '""')}"`, // Escape quotes in CSV
      `"${(family.description || "").replace(/"/g, '""')}"`,
      family.createdAt.toISOString().split("T")[0],
      family.createdBy?.email || "Unknown",
      family.primaryContactId || "",
      primaryContact
        ? `"${primaryContact.firstName} ${primaryContact.lastName}".trim()`
        : "",
      primaryContact?.email || "",
      family.members?.length || 0,
    ];

    if (params.includeMembers && family.members) {
      const memberIds = family.members.map((m) => m.id).join(";");
      const memberNames = family.members
        .map((m) =>
          m.firstName ? `${m.firstName} ${m.lastName || ""}`.trim() : m.email,
        )
        .join(";");
      const memberEmails = family.members.map((m) => m.email).join(";");
      const memberRoles = family.members.map((m) => m.role).join(";");
      const familyRoles = family.members
        .map((m) => m.familyRole || "MEMBER")
        .join(";");

      baseRow.push(
        `"${memberIds}"`,
        `"${memberNames}"`,
        `"${memberEmails}"`,
        `"${memberRoles}"`,
        `"${familyRoles}"`,
      );
    }

    return baseRow;
  });

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function generateJSON(families: ExportedFamily[], params: ExportParams): JSONExportResponse {
  return {
    exportMetadata: {
      generatedAt: new Date().toISOString(),
      totalFamilies: families.length,
      totalMembers: families.reduce(
        (sum, f) => sum + (f.members?.length || 0),
        0,
      ),
      parameters: params,
    },
    families: families.map((family) => {
      const exportFamily: FamilyExportData = {
        id: family.id,
        name: family.name,
        description: family.description,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
        primaryContactId: family.primaryContactId,
        createdBy: family.createdBy
          ? {
              id: family.createdBy.id,
              email: family.createdBy.email,
              name: family.createdBy.firstName
                ? `${family.createdBy.firstName} ${family.createdBy.lastName || ""}`.trim()
                : family.createdBy.email,
            }
          : null,
        memberCount: family.members?.length || 0,
      };

      if (params.includeMembers && family.members) {
        exportFamily.members = family.members.map((member) => ({
          id: member.id,
          email: params.includeContactInfo ? member.email : "[REDACTED]",
          name: member.firstName
            ? `${member.firstName} ${member.lastName || ""}`.trim()
            : "[Name not provided]",
          role: member.role,
          familyRole: member.familyRole || "MEMBER",
          phoneNumber: params.includeContactInfo
            ? member.phoneNumber
            : "[REDACTED]",
          createdAt: member.createdAt,
          isPrimaryContact: member.id === family.primaryContactId,
        }));
      }

      return exportFamily;
    }),
  };
}
