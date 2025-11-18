"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrentPage?: boolean;
}

interface BreadcrumbNavigationProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbNavigation({
  items = [],
  className
}: BreadcrumbNavigationProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if no items provided
  const breadcrumbs = items.length > 0 ? items : generateBreadcrumbsFromPath(pathname);

  return (
    <nav
      className={cn(
        "flex items-center text-sm text-muted-foreground mb-4 overflow-x-auto scrollbar-thin",
        className
      )}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1 min-w-max">
        {breadcrumbs.map((item, index) => (
          <li key={item.href} className="flex items-center">
            {index === 0 && (
              <Home className="h-4 w-4 mr-2" />
            )}

            {index > 0 && (
              <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground/50" />
            )}

            {item.isCurrentPage || index === breadcrumbs.length - 1 ? (
              <span
                className="font-medium text-foreground max-w-[120px] sm:max-w-none truncate"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors max-w-[120px] sm:max-w-none truncate"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Auto-generate breadcrumbs from pathname
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with dashboard
  breadcrumbs.push({
    label: "Dashboard",
    href: "/dashboard"
  });

  let currentPath = "";

  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;

    // Skip the first segment if it's "dashboard" to avoid duplication
    if (segment === "dashboard" && index === 0) return;

    const label = getSegmentLabel(segment, pathSegments, index);

    breadcrumbs.push({
      label,
      href: currentPath,
      isCurrentPage: index === pathSegments.length - 1
    });
  });

  return breadcrumbs;
}

// Convert URL segments to human-readable labels
function getSegmentLabel(segment: string, allSegments: string[], index: number): string {
  // Handle dynamic routes with IDs
  if (segment.length > 20 && /^[a-f0-9]+$/i.test(segment)) {
    // This looks like a MongoDB ObjectId
    const prevSegment = allSegments[index - 1];
    switch (prevSegment) {
      case "families":
        return "Family Details";
      case "users":
        return "User Details";
      default:
        return "Details";
    }
  }

  // Handle common route mappings
  const labelMappings: Record<string, string> = {
    // Main sections
    "admin": "Admin",
    "volunteer": "Volunteer",
    "member": "Member",

    // Admin sections
    "families": "Families",
    "users": "Users",
    "settings": "Settings",
    "reports": "Reports",

    // Actions
    "create": "Create New",
    "edit": "Edit",
    "bulk-assign": "Bulk Assignment",
    "search": "Search",

    // Family management
    "primary-contact": "Primary Contact",
    "members": "Members",
    "transfer": "Transfer",
    "merge": "Merge",

    // User management
    "roles": "Roles",
    "permissions": "Permissions",
    "profile": "Profile",

    // Other common pages
    "dashboard": "Dashboard",
    "overview": "Overview",
    "analytics": "Analytics",
    "export": "Export",
  };

  // Return mapped label or capitalize the segment
  return labelMappings[segment] ||
         segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

// Hook to use breadcrumbs in pages
export function useBreadcrumbs(customItems?: BreadcrumbItem[]) {
  const pathname = usePathname();

  if (customItems) {
    return customItems;
  }

  return generateBreadcrumbsFromPath(pathname);
}

// Pre-defined breadcrumb configurations for common pages
export const BREADCRUMB_CONFIGS = {
  ADMIN_FAMILIES: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Families", href: "/admin/families" },
  ],

  ADMIN_USERS: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Users", href: "/admin/users" },
  ],

  FAMILY_DETAILS: (familyId: string, familyName?: string) => [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Families", href: "/admin/families" },
    { label: familyName || "Family Details", href: `/admin/families/${familyId}`, isCurrentPage: true },
  ],

  USER_DETAILS: (userId: string, userName?: string) => [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Users", href: "/admin/users" },
    { label: userName || "User Details", href: `/admin/users/${userId}`, isCurrentPage: true },
  ],

  BULK_ASSIGNMENT: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Families", href: "/admin/families" },
    { label: "Bulk Assignment", href: "/admin/families/bulk-assign", isCurrentPage: true },
  ],

  FAMILY_SEARCH: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Search Families", href: "/admin/families/search", isCurrentPage: true },
  ],
} as const;