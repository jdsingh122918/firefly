"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  Crown,
  MoreVertical,
  UserCheck,
  UserPlus,
  Search,
  Phone,
  Mail,
  Settings
} from "lucide-react";
import { Family, FamilyRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EnhancedFamilyCardProps {
  family: Family;
  onSetPrimaryContact?: (familyId: string, userId: string) => void;
  onUpdateFamilyRole?: (userId: string, familyId: string, newRole: FamilyRole) => void;
  onViewDetails?: (familyId: string) => void;
  className?: string;
}

export function EnhancedFamilyCard({
  family,
  onSetPrimaryContact,
  onUpdateFamilyRole,
  onViewDetails,
  className
}: EnhancedFamilyCardProps) {
  const [showMembersDialog, setShowMembersDialog] = useState(false);

  const primaryContact = family.members?.find(member =>
    member.id === family.primaryContactId
  );

  const familyAdmins = family.members?.filter(member =>
    member.familyRole === FamilyRole.FAMILY_ADMIN
  ) || [];

  const regularMembers = family.members?.filter(member =>
    member.familyRole === FamilyRole.MEMBER
  ) || [];

  const totalMembers = family.members?.length || 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">
              {family.name}
            </CardTitle>
            {family.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {family.description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 min-h-[44px] min-w-[44px]">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Family Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onViewDetails?.(family.id)}>
                <Settings className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowMembersDialog(true)}>
                <Users className="mr-2 h-4 w-4" />
                Manage Members
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Search className="mr-2 h-4 w-4" />
                Family Search
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Primary Contact Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Primary Contact</h4>
            <Crown className="h-4 w-4 text-yellow-500" />
          </div>

          {primaryContact ? (
            <div className="flex items-center space-x-3 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {primaryContact.firstName && primaryContact.lastName
                    ? `${primaryContact.firstName} ${primaryContact.lastName}`
                    : primaryContact.email}
                </p>
                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                  <span className="flex items-center">
                    <Mail className="h-3 w-3 mr-1" />
                    {primaryContact.email}
                  </span>
                  {primaryContact.phoneNumber && (
                    <span className="flex items-center">
                      <Phone className="h-3 w-3 mr-1" />
                      {primaryContact.phoneNumber}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                Primary
              </Badge>
            </div>
          ) : (
            <div className="p-3 border-2 border-dashed border-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">
                No primary contact assigned
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <UserCheck className="h-4 w-4 mr-2" />
                    Assign Primary Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Primary Contact</DialogTitle>
                    <DialogDescription>
                      Select a family member to be the primary contact for {family.name}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    {family.members?.map((member) => (
                      <Button
                        key={member.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          onSetPrimaryContact?.(family.id, member.id);
                        }}
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.email}
                      </Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Members Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Family Members</h4>
            <span className="text-xs text-muted-foreground">
              {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {familyAdmins.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <Settings className="h-3 w-3 mr-1" />
                {familyAdmins.length} Admin{familyAdmins.length !== 1 ? 's' : ''}
              </Badge>
            )}

            {regularMembers.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {regularMembers.length} Member{regularMembers.length !== 1 ? 's' : ''}
              </Badge>
            )}

            {totalMembers === 0 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                No members assigned
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowMembersDialog(true)}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-2" />
            Manage
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails?.(family.id)}
            className="flex-1"
          >
            <Settings className="h-4 w-4 mr-2" />
            Details
          </Button>
        </div>

        {/* Creation Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center justify-between">
            <span>
              Created by {family.createdBy?.firstName
                ? `${family.createdBy.firstName} ${family.createdBy.lastName || ''}`.trim()
                : family.createdBy?.email || 'Unknown'}
            </span>
            <span>
              {new Date(family.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>

      {/* Members Management Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Family Members - {family.name}</DialogTitle>
            <DialogDescription>
              Manage roles and assignments for family members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {family.members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {member.firstName && member.lastName
                      ? `${member.firstName} ${member.lastName}`
                      : member.email}
                  </p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge
                      variant={member.familyRole === FamilyRole.PRIMARY_CONTACT ? "default" : "outline"}
                      className="text-xs"
                    >
                      {member.familyRole}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {member.role}
                    </Badge>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onSetPrimaryContact?.(family.id, member.id)}
                      disabled={member.familyRole === FamilyRole.PRIMARY_CONTACT}
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Set as Primary Contact
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onUpdateFamilyRole?.(member.id, family.id, FamilyRole.FAMILY_ADMIN)}
                      disabled={member.familyRole === FamilyRole.FAMILY_ADMIN}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Make Family Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onUpdateFamilyRole?.(member.id, family.id, FamilyRole.MEMBER)}
                      disabled={member.familyRole === FamilyRole.MEMBER}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Make Regular Member
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )) || (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No members assigned to this family yet.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}