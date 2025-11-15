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
  Archive
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContentType, NoteType, ResourceContentType, ResourceStatus, AssignmentStatus, NoteVisibility } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';

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
    contentType: ContentType;
    noteType?: NoteType;
    resourceType?: ResourceContentType;
    visibility: NoteVisibility;
    status?: ResourceStatus;

    // Engagement metrics
    viewCount: number;
    downloadCount?: number;
    shareCount?: number;
    rating?: number;
    ratingCount?: number;

    // Flags
    hasAssignments?: boolean;
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
    assignments?: Array<{
      id: string;
      title: string;
      status: AssignmentStatus;
      priority: string;
      dueDate?: Date;
    }>;
    documents?: Array<{
      id: string;
      document: {
        id: string;
        title: string;
        type: string;
        fileSize?: number;
      };
    }>;
  };

  // Display options
  showAssignments?: boolean;
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
  onAssign?: (contentId: string) => void; // NOTE only
  onRate?: (contentId: string) => void; // RESOURCE only
  onApprove?: (contentId: string) => void; // RESOURCE only
  onFeature?: (contentId: string) => void; // RESOURCE only

  // User context
  userRole?: 'ADMIN' | 'VOLUNTEER' | 'MEMBER';
  canEdit?: boolean;
  canDelete?: boolean;
}

const ContentCard: React.FC<ContentCardProps> = ({
  content,
  showAssignments = true,
  showRatings = true,
  showCuration = true,
  showDocuments = true,
  onView,
  onEdit,
  onDelete,
  onShare,
  onPin,
  onArchive,
  onAssign,
  onRate,
  onApprove,
  onFeature,
  userRole,
  canEdit = false,
  canDelete = false
}) => {
  const isNote = content.contentType === ContentType.NOTE;
  const isResource = content.contentType === ContentType.RESOURCE;

  const getTypeIcon = () => {
    if (isNote) {
      switch (content.noteType) {
        case NoteType.CHECKLIST: return <CheckCircle className="h-4 w-4" />;
        case NoteType.MEETING: return <Calendar className="h-4 w-4" />;
        case NoteType.CARE_PLAN: return <FileText className="h-4 w-4" />;
        case NoteType.JOURNAL: return <FileText className="h-4 w-4" />;
        default: return <FileText className="h-4 w-4" />;
      }
    }

    if (isResource) {
      switch (content.resourceType) {
        case ResourceContentType.VIDEO: return <Video className="h-4 w-4" />;
        case ResourceContentType.LINK: return <Link className="h-4 w-4" />;
        case ResourceContentType.IMAGE: return <Image className="h-4 w-4" />;
        case ResourceContentType.DOCUMENT: return <FileDown className="h-4 w-4" />;
        default: return <FileText className="h-4 w-4" />;
      }
    }

    return <FileText className="h-4 w-4" />;
  };

  const getStatusBadge = () => {
    if (isNote) {
      return (
        <div className="flex flex-wrap gap-1.5 overflow-hidden">
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
          {content.hasAssignments && (
            <Badge variant="default" className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Tasks
            </Badge>
          )}
        </div>
      );
    }

    if (isResource && content.status) {
      const statusConfig = {
        [ResourceStatus.DRAFT]: { color: 'bg-gray-500', label: 'Draft' },
        [ResourceStatus.PENDING]: { color: 'bg-yellow-500', label: 'Pending' },
        [ResourceStatus.APPROVED]: { color: 'bg-green-500', label: 'Approved' },
        [ResourceStatus.FEATURED]: { color: 'bg-blue-500', label: 'Featured' },
        [ResourceStatus.ARCHIVED]: { color: 'bg-gray-500', label: 'Archived' },
        [ResourceStatus.REJECTED]: { color: 'bg-red-500', label: 'Rejected' }
      };

      const config = statusConfig[content.status];

      return (
        <div className="flex flex-wrap gap-1.5 overflow-hidden">
          <Badge className={`${config.color} text-white text-xs`}>
            {config.label}
          </Badge>
          {content.isVerified && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <CheckCircle className="h-3 w-3" />
              Verified
            </Badge>
          )}
        </div>
      );
    }

    return null;
  };

  const getVisibilityBadge = () => {
    const visibilityConfig = {
      [NoteVisibility.PRIVATE]: { color: 'bg-red-100 text-red-800', label: 'Private' },
      [NoteVisibility.FAMILY]: { color: 'bg-blue-100 text-blue-800', label: 'Family' },
      [NoteVisibility.SHARED]: { color: 'bg-green-100 text-green-800', label: 'Shared' },
      [NoteVisibility.PUBLIC]: { color: 'bg-gray-100 text-gray-800', label: 'Public' }
    };

    const config = visibilityConfig[content.visibility];
    return (
      <Badge className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const renderAssignmentInfo = () => {
    if (!isNote || !showAssignments || !content.assignments?.length) return null;

    const pendingAssignments = content.assignments.filter(a =>
      a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.IN_PROGRESS
    );

    if (pendingAssignments.length === 0) return null;

    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <AlertCircle className="h-4 w-4" />
        <span>{pendingAssignments.length} pending task{pendingAssignments.length === 1 ? '' : 's'}</span>
      </div>
    );
  };

  const renderRatingInfo = () => {
    if (!isResource || !showRatings || !content.hasRatings) return null;

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


  const renderActions = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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

          {/* NOTE-specific actions */}
          {isNote && onAssign && userRole !== 'MEMBER' && (
            <DropdownMenuItem onClick={() => onAssign(content.id)}>
              <User className="mr-2 h-4 w-4" />
              Assign Task
            </DropdownMenuItem>
          )}

          {isNote && onPin && (
            <DropdownMenuItem onClick={() => onPin(content.id)}>
              <Pin className="mr-2 h-4 w-4" />
              {content.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
          )}

          {isNote && onArchive && (
            <DropdownMenuItem onClick={() => onArchive(content.id)}>
              <Archive className="mr-2 h-4 w-4" />
              {content.isArchived ? 'Unarchive' : 'Archive'}
            </DropdownMenuItem>
          )}

          {/* RESOURCE-specific actions */}
          {isResource && onRate && (
            <DropdownMenuItem onClick={() => onRate(content.id)}>
              <Star className="mr-2 h-4 w-4" />
              Rate Resource
            </DropdownMenuItem>
          )}

          {isResource && onApprove && userRole === 'ADMIN' && content.status === ResourceStatus.PENDING && (
            <DropdownMenuItem onClick={() => onApprove(content.id)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </DropdownMenuItem>
          )}

          {isResource && onFeature && userRole === 'ADMIN' && content.status === ResourceStatus.APPROVED && (
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

  return (
    <Card
      className="w-full h-full flex flex-col hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
      onClick={() => onView?.(content.id)}
    >
      <CardHeader className="p-3 pb-2 flex-shrink-0">
        <div className="space-y-2">
          {/* Title Row with Icon, Title, Visibility Badge, and Actions */}
          <div className="flex items-start gap-2 w-full">
            <div className="text-gray-500 mt-0.5 flex-shrink-0">
              {getTypeIcon()}
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              {/* Title and Actions Row */}
              <div className="flex items-start justify-between gap-2 w-full mb-1">
                <h3 className="font-semibold text-lg leading-tight hover:text-blue-600 transition-colors min-w-0 flex-1">
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
            <div className="text-sm text-gray-600 overflow-hidden pl-6">
              <p className="line-clamp-2 break-words">
                {content.description}
              </p>
            </div>
          )}

          {/* Status and Assignment Info */}
          <div className="space-y-2 pl-6">
            {getStatusBadge()}
            {renderAssignmentInfo()}
            {renderRatingInfo()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0 flex-1 flex flex-col justify-end">
        <div className="space-y-3">
          {/* Tags */}
          {content.tags && content.tags.length > 0 && (
            <div className="space-y-1 pl-6">
              <div className="flex flex-wrap gap-1">
                {content.tags.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs break-all">
                    {tag}
                  </Badge>
                ))}
                {content.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs text-gray-500">
                    +{content.tags.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Creator and Timestamp */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t min-h-0 pl-6">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {content.creator && (
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