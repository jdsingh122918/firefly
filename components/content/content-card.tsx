'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MoreVertical,
  FileText,
  Star,
  Eye,
  Share2,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  Link,
  Video,
  Image,
  FileDown,
  Pin,
  Archive,
  Paperclip,
  FileIcon,
  FileAudio,
  ScrollText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResourceType, ResourceStatus, ResourceVisibility } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { formatFileSize } from '@/components/shared/format-utils';

/**
 * Unified Content Card Component
 *
 * Displays both NOTE and RESOURCE content with type-specific features:
 * - NOTE: Shows assignments, collaboration features, notes-specific actions
 * - RESOURCE: Shows ratings, curation status, download counts
 * - Shared: Tags, documents, basic metadata
 */

export interface ContentCardProps {
  content: {
    id: string;
    title: string;
    description?: string;
    resourceType: ResourceType;
    visibility: ResourceVisibility;
    status?: ResourceStatus;

    // Engagement metrics
    viewCount: number;
    downloadCount?: number;
    shareCount?: number;
    rating?: number;
    ratingCount?: number;

    // Flags
    hasCuration?: boolean;
    hasRatings?: boolean;
    isPinned?: boolean;
    isArchived?: boolean;
    isVerified?: boolean;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];

    // Relations
    creator?: {
      id: string;
      firstName?: string;
      lastName?: string;
      email: string;
    };
    family?: {
      id: string;
      name: string;
    };
    category?: {
      id: string;
      name: string;
      color?: string;
    };
    documents?: Array<{
      id: string;
      document: {
        id: string;
        title: string;
        type: string;
        fileSize?: number;
      };
    }>;

    // External metadata (for templates)
    externalMeta?: {
      isTemplate?: boolean;
      systemGenerated?: boolean;
      [key: string]: any;
    };
  };

  // Display options
  showRatings?: boolean;
  showCuration?: boolean;
  showDocuments?: boolean;

  // Actions
  onView?: (contentId: string) => void;
  onEdit?: (contentId: string) => void;
  onDelete?: (contentId: string) => void;
  onShare?: (contentId: string) => void;
  onPin?: (contentId: string) => void;
  onArchive?: (contentId: string) => void;
  onRate?: (contentId: string) => void; // RESOURCE only
  onApprove?: (contentId: string) => void; // RESOURCE only
  onFeature?: (contentId: string) => void; // RESOURCE only

  // User context
  userRole?: 'ADMIN' | 'VOLUNTEER' | 'MEMBER';
  canEdit?: boolean;
  canDelete?: boolean;
}

// Helper function to get appropriate icon for file type
const getDocumentIcon = (type?: string) => {
  if (!type) return FileIcon;

  const lowerType = type.toLowerCase();

  if (lowerType.includes('image') || lowerType.includes('png') || lowerType.includes('jpg') || lowerType.includes('jpeg') || lowerType.includes('gif')) return Image;
  if (lowerType.includes('video') || lowerType.includes('mp4') || lowerType.includes('avi') || lowerType.includes('mov')) return Video;
  if (lowerType.includes('audio') || lowerType.includes('mp3') || lowerType.includes('wav')) return FileAudio;
  if (lowerType.includes('pdf') || lowerType.includes('document') || lowerType.includes('doc') || lowerType.includes('docx')) return FileText;

  return FileIcon;
};

const ContentCard: React.FC<ContentCardProps> = ({
  content,
  showRatings = true,
  showCuration = true,
  showDocuments = true,
  onView,
  onEdit,
  onDelete,
  onShare,
  onPin,
  onArchive,
  onRate,
  onApprove,
  onFeature,
  userRole,
  canEdit = false,
  canDelete = false
}) => {
  const getTypeIcon = () => {
    switch (content.resourceType) {
      case ResourceType.VIDEO: return <Video className="h-4 w-4" />;
      case ResourceType.LINK: return <Link className="h-4 w-4" />;
      case ResourceType.IMAGE: return <Image className="h-4 w-4" />;
      case ResourceType.DOCUMENT: return <FileDown className="h-4 w-4" />;
      case ResourceType.AUDIO: return <FileText className="h-4 w-4" />;
      case ResourceType.TOOL: return <FileText className="h-4 w-4" />;
      case ResourceType.CONTACT: return <FileText className="h-4 w-4" />;
      case ResourceType.SERVICE: return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = () => {
    const statusConfig = {
      [ResourceStatus.DRAFT]: { color: 'bg-[var(--ppcc-gray)]', label: 'Draft' },
      [ResourceStatus.PENDING]: { color: 'bg-[var(--ppcc-orange)]', label: 'Pending' },
      [ResourceStatus.APPROVED]: { color: 'bg-[var(--ppcc-teal)]', label: 'Approved' },
      [ResourceStatus.FEATURED]: { color: 'bg-[var(--ppcc-blue)]', label: 'Featured' },
      [ResourceStatus.ARCHIVED]: { color: 'bg-[var(--ppcc-gray)]', label: 'Archived' },
      [ResourceStatus.REJECTED]: { color: 'bg-[var(--ppcc-pink)]', label: 'Rejected' }
    };

    // Check if this is a template
    const contentHasExternalMeta = (content as any).externalMeta;
    const isTemplateContent = contentHasExternalMeta?.isTemplate === true ||
      (content.visibility === ResourceVisibility.PUBLIC &&
       content.tags?.includes('advance-directives') &&
       content.status === ResourceStatus.APPROVED);

    return (
      <div className="flex flex-wrap gap-1.5 overflow-hidden">
        {/* Template badge - highest priority */}
        {isTemplateContent && (
          <Badge variant="secondary" className="bg-[hsl(var(--ppcc-purple)/0.1)] text-[hsl(var(--ppcc-purple))] border-[hsl(var(--ppcc-purple)/0.3)] flex items-center gap-1 text-xs">
            <ScrollText className="h-3 w-3" />
            Template
          </Badge>
        )}

        {/* General badges */}
        {content.isPinned && (
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            <Pin className="h-3 w-3" />
            Pinned
          </Badge>
        )}
        {content.isArchived && (
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <Archive className="h-3 w-3" />
            Archived
          </Badge>
        )}

        {/* Status badge - only show if not a template */}
        {!isTemplateContent && content.status && (
          <Badge className={`${statusConfig[content.status]?.color} text-white text-xs`}>
            {statusConfig[content.status]?.label}
          </Badge>
        )}
      </div>
    );
  };

  const getVisibilityBadge = () => {
    const visibilityConfig = {
      [ResourceVisibility.PRIVATE]: { color: 'bg-red-100 text-red-800', label: 'Private' },
      [ResourceVisibility.FAMILY]: { color: 'bg-blue-100 text-blue-800', label: 'Family' },
      [ResourceVisibility.SHARED]: { color: 'bg-green-100 text-green-800', label: 'Shared' },
      [ResourceVisibility.PUBLIC]: { color: 'bg-gray-100 text-gray-800', label: 'Public' }
    };

    const config = visibilityConfig[content.visibility];
    return (
      <Badge className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const renderRatingInfo = () => {
    if (!showRatings || !content.hasRatings) return null;

    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span>
          {content.rating ? `${content.rating.toFixed(1)}` : 'No ratings'}
          {content.ratingCount ? ` (${content.ratingCount})` : ''}
        </span>
      </div>
    );
  };

  const renderDocuments = () => {
    console.log('🔍 ContentCard Debug:', {
      contentId: content.id,
      showDocuments,
      documentsArray: content.documents,
      documentsLength: content.documents?.length,
      hasDocuments: !!content.documents?.length
    });

    if (!showDocuments || !content.documents?.length) return null;

    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Paperclip className="h-4 w-4" />
        <span>{content.documents.length} attachment{content.documents.length !== 1 ? 's' : ''}</span>
      </div>
    );
  };


  // Get comprehensive card colors based on content type or healthcare category
  const getCardColors = () => {
    // Priority 0: Templates (highest priority) - Use subtle styling for legibility
    // Check if this content has template metadata
    const contentHasExternalMeta = (content as any).externalMeta;
    const isTemplateContent = contentHasExternalMeta?.isTemplate === true ||
      (content.visibility === ResourceVisibility.PUBLIC &&
       content.tags?.includes('advance-directives') &&
       content.status === ResourceStatus.APPROVED);

    if (isTemplateContent) {
      return {
        border: 'border-l-[var(--ppcc-purple)]',
        background: 'bg-background dark:bg-background',
        hover: 'hover:bg-accent/50 dark:hover:bg-accent/50'
      };
    }

    // Priority 1: Healthcare tags
    if (content.tags && content.tags.length > 0) {
      const tag = content.tags[0].toLowerCase();
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
      if (tag.includes('equipment') || tag.includes('technology')) {
        return {
          border: 'border-l-[var(--healthcare-equipment)]',
          background: 'bg-blue-50 dark:bg-blue-950/20',
          hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
        };
      }
      if (tag.includes('basic') || tag.includes('resources')) {
        return {
          border: 'border-l-[var(--healthcare-basic)]',
          background: 'bg-orange-50 dark:bg-orange-950/20',
          hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
        };
      }
      if (tag.includes('education') || tag.includes('family')) {
        return {
          border: 'border-l-[var(--healthcare-education)]',
          background: 'bg-blue-50 dark:bg-blue-950/20',
          hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
        };
      }
    }

    // Priority 2: Content status (Resources)
    if (content.status === ResourceStatus.FEATURED) {
        return {
          border: 'border-l-[var(--ppcc-blue)]',
          background: 'bg-blue-50 dark:bg-blue-950/20',
          hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
        };
      }
      if (content.status === ResourceStatus.APPROVED) {
        return {
          border: 'border-l-[var(--ppcc-teal)]',
          background: 'bg-teal-50 dark:bg-teal-950/20',
          hover: 'hover:bg-teal-100 dark:hover:bg-teal-950/30'
        };
      }
      if (content.status === ResourceStatus.PENDING) {
        return {
          border: 'border-l-[var(--ppcc-orange)]',
          background: 'bg-orange-50 dark:bg-orange-950/20',
          hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
        };
      }
    // Draft/other resource statuses
    return {
      border: 'border-l-[var(--ppcc-purple)]',
      background: 'bg-purple-50 dark:bg-purple-950/20',
      hover: 'hover:bg-purple-100 dark:hover:bg-purple-950/30'
    };
  };

  // Default fallback styling function
  const getDefaultStyling = () => {
    return {
      border: 'border-l-[var(--ppcc-blue)]',
      background: 'bg-blue-50 dark:bg-blue-950/20',
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
    };
  };

  const renderActions = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="p-0 min-h-[44px] min-w-[44px]">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onView && (
            <DropdownMenuItem onClick={() => onView(content.id)}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
          )}

          {canEdit && onEdit && (
            <DropdownMenuItem onClick={() => onEdit(content.id)}>
              <FileText className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}

          {onShare && (
            <DropdownMenuItem onClick={() => onShare(content.id)}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
          )}

          {onPin && (
            <DropdownMenuItem onClick={() => onPin(content.id)}>
              <Pin className="mr-2 h-4 w-4" />
              {content.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
          )}

          {onArchive && (
            <DropdownMenuItem onClick={() => onArchive(content.id)}>
              <Archive className="mr-2 h-4 w-4" />
              {content.isArchived ? 'Unarchive' : 'Archive'}
            </DropdownMenuItem>
          )}

          {/* Rating actions */}
          {onRate && (
            <DropdownMenuItem onClick={() => onRate(content.id)}>
              <Star className="mr-2 h-4 w-4" />
              Rate Resource
            </DropdownMenuItem>
          )}

          {onApprove && userRole === 'ADMIN' && content.status === ResourceStatus.PENDING && (
            <DropdownMenuItem onClick={() => onApprove(content.id)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </DropdownMenuItem>
          )}

          {onFeature && userRole === 'ADMIN' && content.status === ResourceStatus.APPROVED && (
            <DropdownMenuItem onClick={() => onFeature(content.id)}>
              <Star className="mr-2 h-4 w-4" />
              Feature
            </DropdownMenuItem>
          )}

          {canDelete && onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(content.id)}
                className="text-red-600 focus:text-red-600"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const cardColors = getCardColors();

  return (
    <Card
      className={`w-full h-full flex flex-col transition-colors cursor-pointer overflow-hidden border-l-4 p-3 ${cardColors.border} ${cardColors.background} ${cardColors.hover}`}
      onClick={() => onView?.(content.id)}
    >
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="space-y-1">
          {/* Title Row with Icon, Title, Visibility Badge, and Actions */}
          <div className="flex items-start gap-2 w-full">
            <div className="text-gray-500 mt-0.5 flex-shrink-0">
              {getTypeIcon()}
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              {/* Title and Actions Row */}
              <div className="flex items-start justify-between gap-2 w-full mb-1">
                <h3 className="font-semibold text-base leading-tight hover:text-blue-600 transition-colors min-w-0 flex-1">
                  <span className="block truncate">{content.title}</span>
                </h3>
                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {renderActions()}
                </div>
              </div>

              {/* Visibility Badge Row */}
              <div className="flex items-center">
                {getVisibilityBadge()}
              </div>
            </div>
          </div>

          {/* Description */}
          {content.description && (
            <div className="text-sm text-gray-600 overflow-hidden pl-4">
              <p className="line-clamp-1 break-words">
                {content.description}
              </p>
            </div>
          )}

          {/* Status Info */}
          <div className="space-y-1 pl-4">
            {getStatusBadge()}
            {renderRatingInfo()}
            {renderDocuments()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-end">
        <div className="space-y-2">
          {/* Tags */}
          {content.tags && content.tags.length > 0 && (
            <div className="space-y-1 pl-4">
              <div className="flex flex-wrap gap-1">
                {content.tags.slice(0, 1).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs break-all">
                    {tag}
                  </Badge>
                ))}
                {content.tags.length > 1 && (
                  <Badge variant="outline" className="text-xs text-gray-500">
                    +{content.tags.length - 1} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Creator and Timestamp */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t min-h-0 pl-4">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Show "System" for system-generated templates, otherwise show creator */}
              {content.externalMeta?.systemGenerated ? (
                <>
                  <Avatar className="h-5 w-5 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                      SY
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate min-w-0 text-purple-700 font-medium">
                    System
                  </span>
                </>
              ) : content.creator && (
                <>
                  <Avatar className="h-5 w-5 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {(content.creator.firstName?.[0] || '') + (content.creator.lastName?.[0] || '')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate min-w-0">
                    {content.creator.firstName || content.creator.lastName
                      ? `${content.creator.firstName || ''} ${content.creator.lastName || ''}`.trim()
                      : content.creator.email
                    }
                  </span>
                </>
              )}
              {content.family && (
                <Badge variant="secondary" className="text-xs flex-shrink-0 truncate max-w-[60px]">
                  {content.family.name}
                </Badge>
              )}
            </div>

            <span
              className="flex-shrink-0 ml-2"
              title={content.createdAt.toLocaleString()}
            >
              {formatDistanceToNow(content.createdAt, { addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContentCard;