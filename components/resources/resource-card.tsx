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
  if (isFeatured) return "bg-[hsl(var(--ppcc-blue)/0.1)] text-[hsl(var(--ppcc-blue))] border-[hsl(var(--ppcc-blue)/0.3)]";
  switch (status) {
    case 'APPROVED':
      return "bg-[hsl(var(--ppcc-teal)/0.1)] text-[hsl(var(--ppcc-teal))] border-[hsl(var(--ppcc-teal)/0.3)]";
    case 'PENDING':
      return "bg-[hsl(var(--ppcc-orange)/0.1)] text-[hsl(var(--ppcc-orange))] border-[hsl(var(--ppcc-orange)/0.3)]";
    case 'DRAFT':
      return "bg-[hsl(var(--ppcc-gray)/0.1)] text-[hsl(var(--ppcc-gray))] border-[hsl(var(--ppcc-gray)/0.3)]";
    case 'REJECTED':
      return "bg-[hsl(var(--ppcc-pink)/0.1)] text-[hsl(var(--ppcc-pink))] border-[hsl(var(--ppcc-pink)/0.3)]";
    default:
      return "bg-[hsl(var(--ppcc-gray)/0.1)] text-[hsl(var(--ppcc-gray))] border-[hsl(var(--ppcc-gray)/0.3)]";
  }
};

const getResourceCardColors = (resource: Resource) => {
  // Priority 1: Healthcare tags (highest priority)
  if (resource.tags && resource.tags.length > 0) {
    const tag = resource.tags[0].toLowerCase();
    if (tag.includes('medical') || tag.includes('health')) {
      return {
        border: 'border-l-[var(--healthcare-medical)]',
        background: 'bg-pink-50 dark:bg-pink-950/20',
        hover: 'hover:bg-pink-100 dark:hover:bg-pink-950/30'
      };
    }
    if (tag.includes('mental')) {
      return {
        border: 'border-l-[var(--healthcare-mental)]',
        background: 'bg-purple-50 dark:bg-purple-950/20',
        hover: 'hover:bg-purple-100 dark:hover:bg-purple-950/30'
      };
    }
    if (tag.includes('home') || tag.includes('community')) {
      return {
        border: 'border-l-[var(--healthcare-home)]',
        background: 'bg-teal-50 dark:bg-teal-950/20',
        hover: 'hover:bg-teal-100 dark:hover:bg-teal-950/30'
      };
    }
    if (tag.includes('equipment') || tag.includes('technology') || tag.includes('tool')) {
      return {
        border: 'border-l-[var(--healthcare-equipment)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      };
    }
    if (tag.includes('basic') || tag.includes('resources') || tag.includes('support')) {
      return {
        border: 'border-l-[var(--healthcare-basic)]',
        background: 'bg-orange-50 dark:bg-orange-950/20',
        hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
      };
    }
    if (tag.includes('education') || tag.includes('family') || tag.includes('training')) {
      return {
        border: 'border-l-[var(--healthcare-education)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      };
    }
    if (tag.includes('legal') || tag.includes('advocacy')) {
      return {
        border: 'border-l-[var(--healthcare-legal)]',
        background: 'bg-gray-50 dark:bg-gray-950/20',
        hover: 'hover:bg-gray-100 dark:hover:bg-gray-950/30'
      };
    }
  }

  // Priority 2: Resource status (Featured > Approved > Pending > Others)
  if (resource.isFeatured) {
    return {
      border: 'border-l-[var(--ppcc-blue)]',
      background: 'bg-blue-50 dark:bg-blue-950/20',
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
    };
  }
  if (resource.status === 'APPROVED') {
    return {
      border: 'border-l-[var(--ppcc-teal)]',
      background: 'bg-teal-50 dark:bg-teal-950/20',
      hover: 'hover:bg-teal-100 dark:hover:bg-teal-950/30'
    };
  }
  if (resource.status === 'PENDING') {
    return {
      border: 'border-l-[var(--ppcc-orange)]',
      background: 'bg-orange-50 dark:bg-orange-950/20',
      hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
    };
  }

  // Priority 3: Resource type mapping to healthcare categories
  switch (resource.type) {
    case 'VIDEO':
    case 'AUDIO':
    case 'IMAGE':
      return {
        border: 'border-l-[var(--healthcare-education)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      };
    case 'TOOL':
    case 'SERVICE':
      return {
        border: 'border-l-[var(--healthcare-equipment)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      };
    case 'CONTACT':
      return {
        border: 'border-l-[var(--healthcare-basic)]',
        background: 'bg-orange-50 dark:bg-orange-950/20',
        hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
      };
    case 'DOCUMENT':
    case 'LINK':
    default:
      return {
        border: 'border-l-[var(--healthcare-home)]',
        background: 'bg-teal-50 dark:bg-teal-950/20',
        hover: 'hover:bg-teal-100 dark:hover:bg-teal-950/30'
      };
  }
};

export function ResourceCard({ resource, userRole, showActions = false }: ResourceCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(resource.userBookmark);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const TypeIcon = getResourceTypeIcon(resource.type);
  const statusColor = getStatusColor(resource.status, resource.isFeatured);
  const cardColors = getResourceCardColors(resource);

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
    <Card className={`p-3 border-l-4 transition-colors ${cardColors.border} ${cardColors.background} ${cardColors.hover}`}>
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