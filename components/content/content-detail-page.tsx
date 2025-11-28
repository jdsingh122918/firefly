'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Star,
  Eye,
  Calendar,
  Tag,
  Users,
  Pin,
  Archive,
  FileText,
  Link,
  Download,
  Share,
  ThumbsUp,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send
} from 'lucide-react';
import { ResourceType, UserRole } from '@prisma/client';
import { formatTimeAgo } from '@/components/shared/format-utils';
import { useToast } from '@/hooks/use-toast';
import { MessageContentRenderer } from '@/components/chat/message-content-renderer';
import { AssignTemplateModal } from '@/components/resources/assign-template-modal';

/**
 * Content Detail Page Component
 *
 * Displays detailed view of a content item with:
 * - Content metadata and body
 * - Creator information
 * - Tags and categories
 * - Action buttons (edit, delete, rate)
 * - Assignment management
 * - Document attachments
 */

export interface ContentDetailPageProps {
  contentId: string;
  userRole: UserRole;
  userId: string;
  availableFamilies: Array<{ id: string; name: string }>;
  showEditButton: boolean;
  showDeleteButton: boolean;
  showCurationControls: boolean;
  allowRating: boolean;
}

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  body?: string;
  resourceType: ResourceType;
  visibility: string;
  status?: string;
  url?: string;
  targetAudience?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  isFeatured?: boolean;
  isSystemGenerated?: boolean;
  allowComments?: boolean;
  allowEditing?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;
  viewCount: number;
  downloadCount?: number;
  shareCount?: number;
  rating?: number;
  ratingCount?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    imageUrl?: string;
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
      filename: string;
      contentType: string;
      size: number;
    };
  }>;
  ratings?: Array<{
    id: string;
    rating: number;
    comment?: string;
    user: {
      id: string;
      firstName?: string;
      lastName?: string;
    };
  }>;
}

const ContentDetailPage: React.FC<ContentDetailPageProps> = ({
  contentId,
  userRole,
  userId,
  availableFamilies,
  showEditButton,
  showDeleteButton,
  showCurationControls,
  allowRating
}) => {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [content, setContent] = useState<ContentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number>(0);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Check if user can assign templates
  const canAssignTemplate = userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER;

  // Fetch content data
  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        includeCreator: 'true',
        includeFamily: 'true',
        includeCategory: 'true',
        includeDocuments: 'true',
        includeRatings: 'true'
      });

      const response = await fetch(`/api/resources/${contentId}?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Content not found');
        }
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setContent(data.data);
      } else {
        setError(data.error || 'Failed to load content');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load content';
      setError(errorMessage);
      console.error('Error fetching content:', error);
    } finally {
      setIsLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Navigation handlers
  const handleBack = () => {
    const rolePrefix = userRole.toLowerCase();
    router.push(`/${rolePrefix}/content`);
  };

  const handleEdit = () => {
    const rolePrefix = userRole.toLowerCase();
    router.push(`/${rolePrefix}/content/${contentId}/edit`);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/resources/${contentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete content');
      }

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Content deleted successfully'
        });
        handleBack();
      } else {
        throw new Error(data.error || 'Failed to delete content');
      }
    } catch (error) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete content',
        variant: 'destructive'
      });
    }
  };

  const handleRate = async (rating: number) => {
    try {
      const response = await fetch(`/api/resources/${contentId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating })
      });

      if (!response.ok) {
        throw new Error('Failed to rate content');
      }

      const data = await response.json();
      if (data.success) {
        setUserRating(rating);
        await fetchContent(); // Refresh to get updated ratings
        toast({
          title: 'Success',
          description: 'Rating submitted successfully'
        });
      } else {
        throw new Error(data.error || 'Failed to rate content');
      }
    } catch (error) {
      console.error('Error rating content:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit rating',
        variant: 'destructive'
      });
    }
  };

  // Render helpers
  const getAuthorDisplay = (creator?: ContentItem['creator']) => {
    if (!creator) return { name: 'Unknown', initials: 'U' };

    const firstName = creator.firstName || '';
    const lastName = creator.lastName || '';
    const name = `${firstName} ${lastName}`.trim() || creator.email.split('@')[0];
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || name.charAt(0).toUpperCase();

    return { name, initials };
  };

  const renderStatusBadges = () => {
    if (!content) return null;

    const badges = [];

    if (content.resourceType) {
      badges.push(
        <Badge key="type" variant="outline" className="text-xs">
          {content.resourceType}
        </Badge>
      );
    }

    badges.push(
      <Badge key="visibility" variant="secondary" className="text-xs">
        {content.visibility}
      </Badge>
    );

    if (content.status) {
      badges.push(
        <Badge key="status" variant="outline" className="text-xs">
          {content.status}
        </Badge>
      );
    }

    if (content.isPinned) {
      badges.push(
        <Badge key="pinned" variant="secondary" className="flex items-center gap-1 text-xs">
          <Pin className="h-3 w-3" />
          Pinned
        </Badge>
      );
    }

    if (content.isArchived) {
      badges.push(
        <Badge key="archived" variant="outline" className="flex items-center gap-1 text-xs">
          <Archive className="h-3 w-3" />
          Archived
        </Badge>
      );
    }

    if (content.isFeatured) {
      badges.push(
        <Badge key="featured" variant="default" className="flex items-center gap-1 text-xs">
          <Star className="h-3 w-3" />
          Featured
        </Badge>
      );
    }

    return badges.length > 0 ? badges : null;
  };

  const renderRatingSection = () => {
    if (!content || !allowRating || !content.hasRatings) return null;

    return (
      <Card className="p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-gray-700" />
            <h3 className="font-medium text-gray-900">Rating</h3>
          </div>

          {content.rating && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${star <= (content.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-600">
                {content.rating?.toFixed(1)} ({content.ratingCount || 0})
              </span>
            </div>
          )}

          <div>
            <p className="text-xs font-medium mb-2">Rate this content:</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  className="transition-colors hover:scale-110"
                >
                  <Star
                    className={`h-4 w-4 ${star <= userRating ? 'text-yellow-400 fill-current' : 'text-gray-300 hover:text-yellow-300'}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Loading Content...</h1>
            <p className="text-gray-600">Please wait while we load the content</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !content) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Content Error</h1>
            <p className="text-gray-600">Unable to load content</p>
          </div>
        </div>
        <Card className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Failed to load content</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchContent} variant="outline">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { name: authorName, initials } = getAuthorDisplay(content.creator);

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{content.title}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Resource</span>
              {renderStatusBadges()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Assign button for system-generated templates */}
          {content.isSystemGenerated && canAssignTemplate && (
            <Button
              variant="outline"
              onClick={() => setShowAssignModal(true)}
              className="min-h-[44px] bg-[hsl(var(--ppcc-purple))/0.1] border-[hsl(var(--ppcc-purple))/0.3] hover:bg-[hsl(var(--ppcc-purple))/0.2] text-[hsl(var(--ppcc-purple))]"
            >
              <Send className="h-4 w-4 mr-2" />
              Assign
            </Button>
          )}
          {showEditButton && (
            <Button variant="outline" onClick={handleEdit} className="min-h-[44px]">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {showDeleteButton && (
            <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-700 min-h-[44px]">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area - Unified Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Primary Content - 3/4 width */}
        <div className="lg:col-span-3 space-y-3">
          {/* Content Body */}
          <Card className="p-3">
            {/* Description */}
            {content.description && (
              <div className="mb-3">
                <div className="text-gray-700 leading-relaxed">
                  <MessageContentRenderer content={content.description} />
                </div>
              </div>
            )}

            {/* Body Content */}
            {content.body && (
              <div className="mt-0 prose prose-sm max-w-none">
                <div className="leading-relaxed text-foreground">
                  <MessageContentRenderer content={content.body} />
                </div>
              </div>
            )}

            {/* Resource URL */}
            {content.url && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Link className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">External Resource</span>
                </div>
                <a
                  href={content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all text-sm"
                >
                  {content.url}
                </a>
              </div>
            )}

            {/* Tags and Target Audience - Horizontal Layout */}
            <div className="mt-3 space-y-2">
              {content.tags && content.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {content.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {content.targetAudience && content.targetAudience.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Audience:</span>
                  <div className="flex flex-wrap gap-1">
                    {content.targetAudience.map((audience, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{audience}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Documents - Compact Layout */}
          {content.documents && content.documents.length > 0 && (
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-gray-700" />
                <h3 className="font-medium text-gray-900">Attachments ({content.documents.length})</h3>
              </div>
              <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                {content.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.document.title}</p>
                        <p className="text-xs text-gray-600">
                          {(doc.document as any).mimeType || 'Unknown type'} • {(doc.document as any).fileSize ? ((doc.document as any).fileSize / 1024).toFixed(1) + ' KB' : 'Unknown size'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const downloadUrl = `/api/documents/${doc.document.id}/download`;
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.target = '_blank';
                        link.download = doc.document.filename || doc.document.title;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar - 1/4 width, Compact */}
        <div className="space-y-3">
          {/* Creator & Meta Info - Condensed */}
          <Card className="p-3">
            <div className="space-y-3">
              {/* Author */}
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={content.creator?.imageUrl} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{authorName}</p>
                  {content.creator?.email && (
                    <p className="text-xs text-gray-600 truncate">{content.creator.email}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Compact Stats */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created</span>
                  <span>{formatTimeAgo(content.createdAt)}</span>
                </div>

                {content.updatedAt !== content.createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Updated</span>
                    <span>{formatTimeAgo(content.updatedAt)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Views</span>
                  <span>{content.viewCount || 0}</span>
                </div>

                {content.downloadCount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Downloads</span>
                    <span>{content.downloadCount}</span>
                  </div>
                )}

                {content.shareCount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Shares</span>
                    <span>{content.shareCount}</span>
                  </div>
                )}
              </div>

              {/* Organization */}
              {(content.family || content.category) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {content.family && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Family</p>
                        <Badge variant="outline" className="text-xs">
                          {content.family.name}
                        </Badge>
                      </div>
                    )}

                    {content.category && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Category</p>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            backgroundColor: content.category.color ? `${content.category.color}20` : undefined,
                            borderColor: content.category.color || undefined
                          }}
                        >
                          {content.category.name}
                        </Badge>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Rating - Compact */}
          {renderRatingSection()}
        </div>
      </div>

      {/* Assign Template Modal */}
      {content.isSystemGenerated && canAssignTemplate && (
        <AssignTemplateModal
          open={showAssignModal}
          onOpenChange={setShowAssignModal}
          resourceId={contentId}
          resourceTitle={content.title}
          resourceDescription={content.description}
          onSuccess={() => {
            toast({
              title: 'Success',
              description: 'Template assigned successfully'
            });
          }}
        />
      )}
    </div>
  );
};

export default ContentDetailPage;