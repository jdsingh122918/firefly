"use client";

import { useState } from "react";
import { UserRole } from "@prisma/client";
import {
  BookOpen,
  ExternalLink,
  Star,
  Eye,
  Share2,
  Bookmark,
  MoreVertical,
  Download,
  Calendar,
  User,
  Tag,
  FileText,
  Video,
  Image as ImageIcon,
  Headphones,
  Link as LinkIcon,
  Wrench,
  Phone,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

interface Resource {
  id: string;
  title: string;
  description: string;
  content: string;
  type: string;
  visibility: string;
  status: string;
  familyId?: string;
  family?: {
    id: string;
    name: string;
  };
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
  tags: string[];
  externalUrl?: string;
  attachments: string[];
  isFeatured: boolean;
  isApproved: boolean;
  averageRating: number;
  totalRatings: number;
  totalViews: number;
  totalShares: number;
  totalBookmarks: number;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  userRating?: number;
  userBookmark: boolean;
  documents: any[];
}

interface ResourceCardProps {
  resource: Resource;
  userRole: UserRole;
  showActions?: boolean;
}

const getResourceTypeIcon = (type: string) => {
  switch (type) {
    case 'DOCUMENT':
      return FileText;
    case 'LINK':
      return LinkIcon;
    case 'VIDEO':
      return Video;
    case 'AUDIO':
      return Headphones;
    case 'IMAGE':
      return ImageIcon;
    case 'TOOL':
      return Wrench;
    case 'CONTACT':
      return Phone;
    case 'SERVICE':
      return Briefcase;
    default:
      return BookOpen;
  }
};

const getStatusColor = (status: string, isFeatured: boolean) => {
  if (isFeatured) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  switch (status) {
    case 'APPROVED':
      return "bg-green-100 text-green-800 border-green-200";
    case 'PENDING':
      return "bg-orange-100 text-orange-800 border-orange-200";
    case 'DRAFT':
      return "bg-gray-100 text-gray-800 border-gray-200";
    case 'REJECTED':
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export function ResourceCard({ resource, userRole, showActions = false }: ResourceCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(resource.userBookmark);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const TypeIcon = getResourceTypeIcon(resource.type);
  const statusColor = getStatusColor(resource.status, resource.isFeatured);

  const handleBookmark = async () => {
    try {
      setBookmarkLoading(true);
      const response = await fetch(`/api/resources/${resource.id}/bookmark`, {
        method: isBookmarked ? 'DELETE' : 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to update bookmark');
      }

      setIsBookmarked(!isBookmarked);
    } catch (error) {
      console.error('Error updating bookmark:', error);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: resource.title,
        text: resource.description,
        url: `${window.location.origin}/${userRole.toLowerCase()}/resources/${resource.id}`,
      });
    } catch (error) {
      // Fallback to clipboard
      navigator.clipboard.writeText(
        `${window.location.origin}/${userRole.toLowerCase()}/resources/${resource.id}`
      );
    }
  };

  return (
    <Card className="p-3 hover:shadow-md transition-shadow">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TypeIcon className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/${userRole.toLowerCase()}/resources/${resource.id}`}
                className="font-medium text-sm hover:text-primary transition-colors line-clamp-2"
              >
                {resource.title}
              </Link>
            </div>
          </div>

          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 min-h-[44px] min-w-[44px]">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/${userRole.toLowerCase()}/resources/${resource.id}`}>
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${userRole.toLowerCase()}/resources/${resource.id}/edit`}>
                    Edit Resource
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Delete Resource
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Status and Featured Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {resource.isFeatured && (
            <Badge variant="secondary" className={statusColor}>
              <Star className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
          {!resource.isFeatured && resource.status !== 'APPROVED' && (
            <Badge variant="secondary" className={statusColor}>
              {resource.status}
            </Badge>
          )}
          {resource.category && (
            <Badge variant="outline" className="text-xs">
              {resource.category.name}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Description */}
        {resource.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {resource.description}
          </p>
        )}

        {/* Tags */}
        {resource.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {resource.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {resource.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{resource.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {resource.averageRating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-current text-yellow-500" />
              <span>{resource.averageRating.toFixed(1)}</span>
              <span>({resource.totalRatings})</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{resource.totalViews}</span>
          </div>
          {resource.externalUrl && (
            <div className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              <span>External</span>
            </div>
          )}
        </div>

        {/* Creator and Date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{resource.creator?.name || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(resource.createdAt), { addSuffix: true })}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBookmark}
            disabled={bookmarkLoading}
            className="h-8 px-2 text-xs"
          >
            <Bookmark className={`h-3 w-3 mr-1 ${isBookmarked ? 'fill-current' : ''}`} />
            {isBookmarked ? 'Saved' : 'Save'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="h-8 px-2 text-xs"
          >
            <Share2 className="h-3 w-3 mr-1" />
            Share
          </Button>
          {resource.externalUrl && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 px-2 text-xs"
            >
              <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}