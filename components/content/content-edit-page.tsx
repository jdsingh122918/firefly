'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ResourceType, UserRole } from '@prisma/client';
import { formatTimeAgo } from '@/components/shared/format-utils';
import { useToast } from '@/hooks/use-toast';
import PopularTagsQuickSelect from '@/components/content/popular-tags-quick-select';
import { ALL_HEALTHCARE_TAGS } from '@/lib/data/healthcare-tags';

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
  showCurationControls: boolean;
  allowContentTypeChange: boolean;
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
  allowComments?: boolean;
  allowEditing?: boolean;
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
  resourceType: ResourceType;
  url: string;
  visibility: string;
  familyId: string;
  categoryId: string;
  tags: string;
  targetAudience: string;
  isPinned: boolean;
  allowComments: boolean;
  allowEditing: boolean;
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
  showCurationControls,
  allowContentTypeChange
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    resourceType: ResourceType.DOCUMENT,
    url: '',
    visibility: 'PRIVATE',
    familyId: 'none',
    categoryId: 'none',
    tags: '',
    targetAudience: '',
    isPinned: false,
    allowComments: true,
    allowEditing: false,
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
        includeCategory: 'true',
        includeDocuments: 'true'
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
        const contentData = data.data;
        setContent(contentData);

        // Populate form with existing data
        setFormData({
          title: contentData.title || '',
          description: contentData.description || '',
          body: contentData.body || '',
          resourceType: contentData.resourceType || ResourceType.DOCUMENT,
          url: contentData.url || '',
          visibility: contentData.visibility || 'PRIVATE',
          familyId: contentData.familyId || 'none',
          categoryId: contentData.categoryId || 'none',
          tags: contentData.tags?.join(', ') || '',
          targetAudience: contentData.targetAudience?.join(', ') || '',
          isPinned: contentData.isPinned || false,
          allowComments: contentData.allowComments ?? true,
          allowEditing: contentData.allowEditing || false,
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

  // Extract param value outside useEffect to prevent infinite loop
  // (searchParams object reference changes on every render)
  const selectedTagsParam = searchParams.get('selectedTags');

  // Coordinated content fetch and tag application to prevent race condition
  useEffect(() => {
    if (selectedTagsParam) {
      // Tags from URL - fetch content first, then apply tags
      const tagsFromUrl = decodeURIComponent(selectedTagsParam).split(',').filter(Boolean);

      // Fetch content, then override tags with URL parameter
      fetchContent().then(() => {
        if (tagsFromUrl.length > 0) {
          setFormData(prev => ({ ...prev, tags: tagsFromUrl.join(', ') }));

          toast({
            title: 'Tags Applied',
            description: `${tagsFromUrl.length} tag${tagsFromUrl.length > 1 ? 's' : ''} applied successfully`,
          });
        }
      }).catch(error => {
        console.error('Error applying tags:', error);
        toast({
          title: 'Error',
          description: 'Failed to apply tags. Please try again.',
          variant: 'destructive',
        });
      });

      // Clean up URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('selectedTags');
      window.history.replaceState({}, '', url.toString());
    } else {
      // Normal content fetch without tag override
      fetchContent();
    }
  }, [selectedTagsParam, fetchContent, toast]);

  // Form handlers
  const handleInputChange = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }, [error]);

  // Tag management functions
  const handleTagToggle = useCallback((tagName: string) => {
    setFormData(prev => {
      const currentTags = prev.tags ? prev.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
      const tagIndex = currentTags.indexOf(tagName);

      let newTags: string[];
      if (tagIndex > -1) {
        // Remove tag
        newTags = currentTags.filter(tag => tag !== tagName);
      } else {
        // Add tag
        newTags = [...currentTags, tagName];
      }

      return { ...prev, tags: newTags.join(', ') };
    });
  }, []);

  const handleBrowseTags = useCallback(() => {
    const currentPath = window.location.pathname;
    const currentUrl = encodeURIComponent(currentPath);
    const currentTags = encodeURIComponent(formData.tags || '');

    // Determine the correct tags page based on resource type
    let tagsPagePath = `/${userRole.toLowerCase()}/resources/tags`;

    const url = `${tagsPagePath}?returnUrl=${currentUrl}&selectedTags=${currentTags}`;
    router.push(url);
  }, [formData.tags, userRole, router]);

  const getCurrentTagsArray = useCallback(() => {
    return formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
  }, [formData.tags]);

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
        resourceType: formData.resourceType,
        ...(formData.url.trim()
          ? { url: formData.url.trim() }
          : {}
        ),
        visibility: formData.visibility,
        familyId: formData.familyId === 'none' ? null : formData.familyId,
        categoryId: formData.categoryId === 'none' ? null : formData.categoryId,
        tags,
        targetAudience,
        isPinned: formData.isPinned,
        allowComments: formData.allowComments,
        allowEditing: formData.allowEditing,
        hasCuration: formData.hasCuration,
        hasRatings: formData.hasRatings,
        hasSharing: formData.hasSharing
      };

      const response = await fetch(`/api/resources/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    router.push(`/${rolePrefix}/resources/${contentId}`);
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
              <span>Editing Resource</span>
              <Badge variant="outline">{content.resourceType}</Badge>
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
              {(
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

              {/* Target Audience */}
              {(
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
                  value={formData.resourceType}
                  onValueChange={(value) =>
                    handleInputChange(
                      'resourceType',
                      value
                    )
                  }
                  disabled={isSubmitting || !allowContentTypeChange}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ResourceType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace('_', ' ')}
                      </SelectItem>
                    ))}
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

              {/* Tags - Hybrid Approach */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Tags & Categories</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseTags}
                    disabled={isSubmitting}
                    className="h-8 px-3 text-xs"
                  >
                    <TagIcon className="h-3 w-3 mr-1" />
                    Browse All Tags
                  </Button>
                </div>

                {/* Popular Tags Quick Select */}
                <PopularTagsQuickSelect
                  selectedTags={getCurrentTagsArray()}
                  onTagToggle={handleTagToggle}
                  className="mb-4"
                />

                {/* Selected Tags Display */}
                {formData.tags && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Selected Tags:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getCurrentTagsArray().map((tagName) => {
                        const healthcareTag = ALL_HEALTHCARE_TAGS.find(tag => tag.name === tagName);
                        return (
                          <Badge
                            key={tagName}
                            variant="secondary"
                            className="text-xs px-2 py-1 cursor-pointer backdrop-blur-sm border-2"
                            style={healthcareTag ? {
                              backgroundColor: `${healthcareTag.color}20`,
                              borderColor: healthcareTag.color,
                              color: healthcareTag.color
                            } : {}}
                            onClick={() => handleTagToggle(tagName)}
                          >
                            {tagName}
                            <button
                              type="button"
                              className="ml-1 hover:bg-red-100 hover:text-red-600 rounded-full p-0.5"
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Tag Input */}
                <div className="space-y-1">
                  <Label htmlFor="custom-tags" className="text-xs font-medium text-gray-600">
                    Add Custom Tags:
                  </Label>
                  <Input
                    id="custom-tags"
                    value={formData.tags}
                    onChange={(e) => handleInputChange('tags', e.target.value)}
                    placeholder="healthcare, grief, support..."
                    disabled={isSubmitting}
                    className="min-h-[44px] text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Separate multiple tags with commas. Use quick select above for common healthcare tags.
                  </p>
                </div>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default ContentEditPage;