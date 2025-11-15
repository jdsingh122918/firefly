'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Pin,
  Archive,
  Eye,
  Calendar,
  Tag as TagIcon,
  FileText,
} from 'lucide-react';
import { ContentType, NoteType, ResourceContentType, UserRole } from '@prisma/client';
import { formatTimeAgo } from '@/components/shared/format-utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Content Edit Page Component
 *
 * Provides editing interface for content items with:
 * - Basic content fields (title, description, body)
 * - Type-specific fields (noteType, resourceType, URL)
 * - Organizational fields (family, category, tags)
 * - Feature flags (assignments, ratings, sharing)
 * - Role-based field access control
 */

export interface ContentEditPageProps {
  contentId: string;
  userRole: UserRole;
  userId: string;
  availableFamilies: Array<{ id: string; name: string }>;
  availableCategories: Array<{ id: string; name: string; color?: string }>;
  showFamilySelector: boolean;
  showAssignmentManagement: boolean;
  showCurationControls: boolean;
  allowContentTypeChange: boolean;
}

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  body?: string;
  contentType: ContentType;
  noteType?: NoteType;
  resourceType?: ResourceContentType;
  visibility: string;
  status?: string;
  url?: string;
  targetAudience?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  isFeatured?: boolean;
  allowComments?: boolean;
  allowEditing?: boolean;
  hasAssignments?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;
  tags?: string[];
  familyId?: string;
  categoryId?: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
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
}

interface FormData {
  title: string;
  description: string;
  body: string;
  noteType: NoteType;
  resourceType: ResourceContentType;
  url: string;
  visibility: string;
  familyId: string;
  categoryId: string;
  tags: string;
  targetAudience: string;
  isPinned: boolean;
  allowComments: boolean;
  allowEditing: boolean;
  hasAssignments: boolean;
  hasCuration: boolean;
  hasRatings: boolean;
  hasSharing: boolean;
}

const ContentEditPage: React.FC<ContentEditPageProps> = ({
  contentId,
  userRole,
  userId,
  availableFamilies,
  availableCategories,
  showFamilySelector,
  showAssignmentManagement,
  showCurationControls,
  allowContentTypeChange
}) => {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [content, setContent] = useState<ContentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    body: '',
    noteType: NoteType.JOURNAL,
    resourceType: ResourceContentType.DOCUMENT,
    url: '',
    visibility: 'PRIVATE',
    familyId: 'none',
    categoryId: 'none',
    tags: '',
    targetAudience: '',
    isPinned: false,
    allowComments: true,
    allowEditing: false,
    hasAssignments: false,
    hasCuration: false,
    hasRatings: true,
    hasSharing: true
  });

  // Fetch content data
  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        includeCreator: 'true',
        includeFamily: 'true',
        includeCategory: 'true'
      });

      const response = await fetch(`/api/content/${contentId}?${params}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Content not found');
        }
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        const contentData = data.data;
        setContent(contentData);

        // Populate form with existing data
        setFormData({
          title: contentData.title || '',
          description: contentData.description || '',
          body: contentData.body || '',
          noteType: contentData.noteType || NoteType.JOURNAL,
          resourceType: contentData.resourceType || ResourceContentType.DOCUMENT,
          url: contentData.url || '',
          visibility: contentData.visibility || 'PRIVATE',
          familyId: contentData.familyId || 'none',
          categoryId: contentData.categoryId || 'none',
          tags: contentData.tags?.join(', ') || '',
          targetAudience: contentData.targetAudience?.join(', ') || '',
          isPinned: contentData.isPinned || false,
          allowComments: contentData.allowComments ?? true,
          allowEditing: contentData.allowEditing || false,
          hasAssignments: contentData.hasAssignments || false,
          hasCuration: contentData.hasCuration || false,
          hasRatings: contentData.hasRatings ?? true,
          hasSharing: contentData.hasSharing ?? true
        });
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

  // Form handlers
  const handleInputChange = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }, [error]);

  const handleSave = async () => {
    if (!content) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Process tags and target audience
      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const targetAudience = formData.targetAudience
        .split(',')
        .map(audience => audience.trim())
        .filter(audience => audience.length > 0);

      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        body: formData.body.trim() || null,
        ...(content.contentType === ContentType.NOTE
          ? { noteType: formData.noteType }
          : { resourceType: formData.resourceType }
        ),
        ...(content.contentType === ContentType.RESOURCE && formData.url.trim()
          ? { url: formData.url.trim() }
          : {}
        ),
        visibility: formData.visibility,
        familyId: formData.familyId === 'none' ? null : formData.familyId,
        categoryId: formData.categoryId === 'none' ? null : formData.categoryId,
        tags,
        ...(content.contentType === ContentType.RESOURCE ? { targetAudience } : {}),
        isPinned: formData.isPinned,
        allowComments: formData.allowComments,
        allowEditing: formData.allowEditing,
        hasAssignments: formData.hasAssignments,
        hasCuration: formData.hasCuration,
        hasRatings: formData.hasRatings,
        hasSharing: formData.hasSharing
      };

      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update content');
      }

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Content updated successfully'
        });
        handleBack();
      } else {
        throw new Error(data.error || 'Failed to update content');
      }
    } catch (error) {
      console.error('Error updating content:', error);
      setError(error instanceof Error ? error.message : 'Failed to update content');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigation
  const handleBack = () => {
    const rolePrefix = userRole.toLowerCase();
    router.push(`/${rolePrefix}/content/${contentId}`);
  };

  const handleCancel = () => {
    handleBack();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Loading Content...</h1>
            <p className="text-sm text-gray-600">Please wait while we load the content</p>
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
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Content Error</h1>
            <p className="text-sm text-gray-600">Unable to load content</p>
          </div>
        </div>
        <Card className="p-3">
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

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Edit {content.title}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Editing {content.contentType === ContentType.NOTE ? 'Note' : 'Resource'}</span>
              <Badge variant="outline">{content.contentType}</Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="min-h-[44px]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="min-h-[44px]">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Area - Unified Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Primary Content - 3/4 width */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="p-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-gray-700" />
                <h3 className="font-medium text-gray-900">Content Details</h3>
              </div>
              {/* Title */}
              <div className="space-y-1">
                <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter content title..."
                  disabled={isSubmitting}
                  className="min-h-[44px]"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter a brief description..."
                  disabled={isSubmitting}
                  rows={3}
                  className="resize-y"
                />
              </div>

              {/* Body Content */}
              <div className="space-y-1">
                <Label htmlFor="body" className="text-sm font-medium">Content</Label>
                <Textarea
                  id="body"
                  value={formData.body}
                  onChange={(e) => handleInputChange('body', e.target.value)}
                  placeholder="Enter the main content..."
                  disabled={isSubmitting}
                  rows={8}
                  className="resize-y min-h-[300px]"
                />
              </div>

              {/* Resource URL */}
              {content.contentType === ContentType.RESOURCE && (
                <div className="space-y-1">
                  <Label htmlFor="url" className="text-sm font-medium">Resource URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => handleInputChange('url', e.target.value)}
                    placeholder="https://example.com/resource"
                    disabled={isSubmitting}
                    className="min-h-[44px]"
                  />
                </div>
              )}

              {/* Target Audience (Resources only) */}
              {content.contentType === ContentType.RESOURCE && (
                <div className="space-y-1">
                  <Label htmlFor="targetAudience" className="text-sm font-medium">Target Audience</Label>
                  <Input
                    id="targetAudience"
                    value={formData.targetAudience}
                    onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                    placeholder="families, caregivers, healthcare providers..."
                    disabled={isSubmitting}
                    className="min-h-[44px]"
                  />
                  <p className="text-xs text-gray-600">Separate multiple audiences with commas</p>
                </div>
              )}
            </div>
          </Card>

          {/* Content Information */}
          <Card className="p-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-gray-700" />
                <h3 className="font-medium text-gray-900">Content Information</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>Created {formatTimeAgo(content.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>Last updated {formatTimeAgo(content.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  <span>{content.viewCount || 0} views</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar - 1/4 width */}
        <div className="space-y-3">
          {/* Content Settings */}
          <Card className="p-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <TagIcon className="h-4 w-4 text-gray-700" />
                <h3 className="font-medium text-gray-900">Settings</h3>
              </div>
              {/* Content Type */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Type</Label>
                <Select
                  value={content.contentType === ContentType.NOTE ? formData.noteType : formData.resourceType}
                  onValueChange={(value) =>
                    handleInputChange(
                      content.contentType === ContentType.NOTE ? 'noteType' : 'resourceType',
                      value
                    )
                  }
                  disabled={isSubmitting || !allowContentTypeChange}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {content.contentType === ContentType.NOTE ? (
                      Object.values(NoteType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace('_', ' ')}
                        </SelectItem>
                      ))
                    ) : (
                      Object.values(ResourceContentType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace('_', ' ')}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Visibility */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => handleInputChange('visibility', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                    <SelectItem value="FAMILY">Family</SelectItem>
                    <SelectItem value="SHARED">Shared</SelectItem>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Family */}
              {showFamilySelector && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Family</Label>
                  <Select
                    value={formData.familyId}
                    onValueChange={(value) => handleInputChange('familyId', value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No family</SelectItem>
                      {availableFamilies.map((family) => (
                        <SelectItem key={family.id} value={family.id}>
                          {family.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Category */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Category</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => handleInputChange('categoryId', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <Label htmlFor="tags" className="text-sm font-medium">Tags</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  placeholder="healthcare, grief, support..."
                  disabled={isSubmitting}
                  className="min-h-[44px]"
                />
                <p className="text-xs text-gray-600">Separate with commas</p>
              </div>
            </div>
          </Card>

          {/* Feature Options */}
          <Card className="p-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Pin className="h-4 w-4 text-gray-700" />
                <h3 className="font-medium text-gray-900">Options</h3>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPinned"
                  checked={formData.isPinned}
                  onCheckedChange={(checked) => handleInputChange('isPinned', checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="isPinned" className="text-sm">
                  Pin this content
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowComments"
                  checked={formData.allowComments}
                  onCheckedChange={(checked) => handleInputChange('allowComments', checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="allowComments" className="text-sm">
                  Allow comments
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasRatings"
                  checked={formData.hasRatings}
                  onCheckedChange={(checked) => handleInputChange('hasRatings', checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="hasRatings" className="text-sm">
                  Enable ratings
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasSharing"
                  checked={formData.hasSharing}
                  onCheckedChange={(checked) => handleInputChange('hasSharing', checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="hasSharing" className="text-sm">
                  Allow sharing
                </Label>
              </div>

              {showAssignmentManagement && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasAssignments"
                    checked={formData.hasAssignments}
                    onCheckedChange={(checked) => handleInputChange('hasAssignments', checked === true)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="hasAssignments" className="text-sm">
                    Enable assignments
                  </Label>
                </div>
              )}

              {showCurationControls && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasCuration"
                    checked={formData.hasCuration}
                    onCheckedChange={(checked) => handleInputChange('hasCuration', checked === true)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="hasCuration" className="text-sm">
                    Require curation
                  </Label>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ContentEditPage;