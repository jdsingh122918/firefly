"use client";

import React from 'react';
import Link from 'next/link';
import {
  MoreHorizontal,
  Users,
  Calendar,
  User,
  Mail,
  Eye,
  Edit,
  Trash2,
  FileText,
  UserCheck
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Family {
  id: string;
  name: string;
  description?: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  assignedVolunteer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  members: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  memberCount: number;
}

interface FamilyTileProps {
  family: Family;
  onDelete: (familyId: string, familyName: string) => void;
  basePath?: string; // e.g., "/admin/families" or "/volunteer/families"
}

const getFamilyTileColors = (family: Family) => {
  // Priority 1: Family member count (larger families get different color emphasis)
  if (family.memberCount > 5) {
    return {
      border: 'border-l-[var(--healthcare-education)]',
      background: 'bg-blue-50 dark:bg-blue-950/20',
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
    };
  }
  if (family.memberCount > 2) {
    return {
      border: 'border-l-[var(--healthcare-basic)]',
      background: 'bg-orange-50 dark:bg-orange-950/20',
      hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
    };
  }

  // Default: Healthcare home (community care)
  return {
    border: 'border-l-[var(--healthcare-home)]',
    background: 'bg-teal-50 dark:bg-teal-950/20',
    hover: 'hover:bg-teal-100 dark:hover:bg-teal-950/30'
  };
};

export function FamilyTile({ family, onDelete, basePath = "/admin/families" }: FamilyTileProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Allow click through to navigation unless clicking on dropdown trigger
    const target = e.target as HTMLElement;
    if (target.closest('[data-dropdown-trigger]')) {
      e.preventDefault();
    }
  };

  const cardColors = getFamilyTileColors(family);

  return (
    <Card
      className={cn(
        "border-l-4 transition-colors cursor-pointer",
        cardColors.border,
        cardColors.background,
        cardColors.hover
      )}
      onClick={handleClick}
    >
      <Link href={`${basePath}/${family.id}`} className="block">
        <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
          {/* Top Section: Family Name + Member Count */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate text-base sm:text-lg">{family.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {family.memberCount} {family.memberCount === 1 ? 'member' : 'members'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Bottom Section: Metadata Grid */}
          <div className="grid grid-cols-1 gap-2 text-sm">
            {/* Assigned Volunteer Section */}
            <div className="flex items-start gap-2 min-w-0">
              <UserCheck className="h-3 w-3 shrink-0 text-muted-foreground mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {family.assignedVolunteer ? (
                    <>
                      <span className="font-medium truncate">
                        {family.assignedVolunteer.name}
                      </span>
                      {family.assignedVolunteer.email && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">
                            {family.assignedVolunteer.email}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground italic">No volunteer assigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Creator Information */}
            <div className="flex items-start gap-2 min-w-0">
              <User className="h-3 w-3 shrink-0 text-muted-foreground mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium truncate">
                    {family.createdBy?.name || 'Unknown Creator'}
                  </span>
                </div>
                {family.createdBy?.email && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate">
                      {family.createdBy.email}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="flex items-center justify-end pt-2 border-t border-border/50">
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.location.href = `${basePath}/${family.id}`
              }}
              className="min-h-[44px]"
            >
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}