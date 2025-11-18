"use client";

import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';

interface UserTileProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'VOLUNTEER' | 'MEMBER';
    emailVerified: boolean;
    phoneNumber?: string;
    phoneVerified?: boolean;
    createdAt: Date;
    family?: {
      name: string;
    } | null;
    createdBy?: {
      name: string;
    } | null;
  };
  onDelete: (id: string, name: string) => void;
}

function getRoleColor(role: 'ADMIN' | 'VOLUNTEER' | 'MEMBER') {
  switch (role) {
    case 'ADMIN':
      return 'destructive';
    case 'VOLUNTEER':
      return 'default';
    case 'MEMBER':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function UserTile({ user, onDelete }: UserTileProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking on dropdown trigger
    const target = e.target as HTMLElement;
    if (target.closest('[data-dropdown-trigger]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all border-2 border-primary/20 backdrop-blur-sm shadow-sm"
      onClick={handleClick}
    >
      <Link href={`/admin/users/${user.id}`} className="block">
        <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
          {/* Top Section: Avatar + Name + Role */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                <AvatarFallback className="text-sm font-medium">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{user.name}</h3>
                <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="h-3 w-3 shrink-0" />
                  {user.email}
                </p>
              </div>
            </div>
            <Badge variant={getRoleColor(user.role)} className="shrink-0">
              {user.role}
            </Badge>
          </div>

          {/* Middle Section: Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-sm">
            {/* Family Assignment */}
            <div className="flex items-center gap-1 min-w-0">
              <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
              {user.family ? (
                <span className="truncate text-primary">{user.family.name}</span>
              ) : (
                <span className="text-muted-foreground italic">No family</span>
              )}
            </div>

            {/* Verification Status */}
            <div className="flex items-center gap-1 min-w-0">
              {user.emailVerified ? (
                <>
                  <CheckCircle className="h-3 w-3 shrink-0 text-green-600" />
                  <span className="text-green-600 text-xs">Verified</span>
                </>
              ) : (
                <span className="text-muted-foreground text-xs">Unverified</span>
              )}
            </div>

            {/* Phone Number */}
            {user.phoneNumber && (
              <div className="flex items-center gap-1 min-w-0">
                <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {user.phoneNumber}
                  {user.phoneVerified && <span className="ml-1 text-green-600">✓</span>}
                </span>
              </div>
            )}

            {/* Created Date */}
            <div className="flex items-center gap-1 text-muted-foreground min-w-0">
              <Calendar className="h-3 w-3 shrink-0" />
              <span className="text-xs truncate">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Bottom Section: Creator + Actions */}
          <div className="flex items-center justify-between pt-1 sm:pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground truncate flex-1 min-w-0 pr-2">
              {user.createdBy?.name ? `Created by ${user.createdBy.name}` : 'No creator info'}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-8 p-0 min-h-[44px] min-w-[44px]"
                  data-dropdown-trigger
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/users/${user.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/users/${user.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit User
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => onDelete(user.id, user.name)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}