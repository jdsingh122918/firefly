'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ContentType,
  NoteType,
  ResourceContentType,
  NoteVisibility
} from '@prisma/client';
import { HEALTHCARE_CATEGORIES, ALL_HEALTHCARE_TAGS } from '@/lib/data/healthcare-tags';
import {
  FileText,
  Star,
  X,
  Plus,
  Save,
  Eye,
  Users,
  Lock,
  Globe,
  Upload,
  Link as LinkIcon,
  Tag
} from 'lucide-react';
import { DocumentAttachmentManager } from '@/components/notes/document-attachment-manager';

/**
 * Unified Content Form Component
 *
 * Handles creation and editing of both NOTE and RESOURCE content:
 * - Dynamic form fields based on content type
 * - Type-specific validation and options
 * - Document attachment support
 * - Feature flag management (assignments, ratings, curation)
 */

export interface ContentFormProps {
  // Content data for editing (optional)
  initialData?: {
    id?: string;
    title?: string;
    description?: string;
    body?: string;
    contentType: ContentType;
    noteType?: NoteType;
    resourceType?: ResourceContentType;
    visibility?: NoteVisibility;
    familyId?: string;
    categoryId?: string;
    tags?: string[];
    url?: string;
    targetAudience?: string[];
    isPinned?: boolean;
    allowComments?: boolean;
    allowEditing?: boolean;
    hasAssignments?: boolean;
    hasCuration?: boolean;
    hasRatings?: boolean;
    hasSharing?: boolean;
    externalMeta?: any;
  };

  // Form configuration
  mode: 'create' | 'edit';
  contentType?: ContentType; // For create mode
  enableTypeSelection?: boolean; // Allow switching between NOTE/RESOURCE

  // Available options
  availableFamilies?: Array<{ id: string; name: string }>;
  availableCategories?: Array<{ id: string; name: string }>;

  // User context
  userRole?: 'ADMIN' | 'VOLUNTEER' | 'MEMBER';
  userId?: string;

  // Callbacks
  onSubmit: (data: ContentFormData) => Promise<void>;
  onCancel?: () => void;
  onPreview?: (data: ContentFormData) => void;

  // State
  isLoading?: boolean;
  errors?: Record<string, string>;
}

export interface ContentFormData {
  title: string;
  description?: string;
  body?: string;
  contentType: ContentType;
  noteType?: NoteType;
  resourceType?: ResourceContentType;
  visibility: NoteVisibility;
  familyId?: string;
  categoryId?: string;
  tags: string[];
  url?: string;
  targetAudience: string[];
  isPinned?: boolean;
  allowComments?: boolean;
  allowEditing?: boolean;
  hasAssignments?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;
  externalMeta?: any;
  documentIds?: string[];
}

const ContentForm: React.FC<ContentFormProps> = ({
  initialData,
  mode,
  contentType: initialContentType,
  enableTypeSelection = true,
  availableFamilies = [],
  availableCategories = [],
  userRole,
  userId,
  onSubmit,
  onCancel,
  onPreview,
  isLoading = false,
  errors = {}
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Form state
  const initialFormData: ContentFormData = {
    title: initialData?.title || '',
    description: initialData?.description || '',
    body: initialData?.body || '',
    contentType: initialData?.contentType || initialContentType || ContentType.NOTE,
    noteType: initialData?.noteType || NoteType.TEXT,
    resourceType: initialData?.resourceType || ResourceContentType.DOCUMENT,
    visibility: initialData?.visibility || NoteVisibility.PRIVATE,
    familyId: initialData?.familyId || 'none',
    categoryId: initialData?.categoryId || 'none',
    tags: initialData?.tags || [],
    url: initialData?.url || '',
    targetAudience: initialData?.targetAudience || [],
    isPinned: initialData?.isPinned || false,
    allowComments: initialData?.allowComments || false,
    allowEditing: initialData?.allowEditing || false,
    hasAssignments: initialData?.hasAssignments || false,
    hasCuration: initialData?.hasCuration || (userRole !== 'ADMIN'),
    hasRatings: initialData?.hasRatings || ((initialData?.contentType || initialContentType || ContentType.NOTE) === ContentType.RESOURCE),
    hasSharing: initialData?.hasSharing || false,
    externalMeta: initialData?.externalMeta,
    documentIds: []
  };

  const [formData, setFormData] = useState<ContentFormData>(initialFormData);

  const [tagInput, setTagInput] = useState('');
  const [audienceInput, setAudienceInput] = useState('');

  const isNote = formData.contentType === ContentType.NOTE;
  const isResource = formData.contentType === ContentType.RESOURCE;
  const requiresUrl = isResource && ['LINK', 'VIDEO'].includes(formData.resourceType as string);

  // Listen for tags from URL parameters (when returning from tag selection page)
  useEffect(() => {
    const selectedTagsParam = searchParams.get('selectedTags');
    if (selectedTagsParam && mode === 'create') {
      const tagsFromUrl = decodeURIComponent(selectedTagsParam).split(',').filter(Boolean);
      if (tagsFromUrl.length > 0) {
        setFormData(prev => ({
          ...prev,
          tags: tagsFromUrl
        }));
        // Clean up URL parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('selectedTags');
        router.replace(newUrl.pathname + newUrl.search);
      }
    }
  }, [searchParams, mode, router]);

  // Update resource-specific defaults when content type changes
  useEffect(() => {
    if (isResource && mode === 'create') {
      setFormData(prev => ({
        ...prev,
        hasRatings: true,
        hasCuration: userRole !== 'ADMIN',
        visibility: NoteVisibility.PUBLIC
      }));
    } else if (isNote && mode === 'create') {
      setFormData(prev => ({
        ...prev,
        hasRatings: false,
        hasCuration: false,
        visibility: NoteVisibility.PRIVATE
      }));
    }
  }, [formData.contentType, mode, userRole, isResource, isNote]);

  const handleInputChange = (field: keyof ContentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTagAdd = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      handleInputChange('tags', [...formData.tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const handleAudienceAdd = (audience: string) => {
    const trimmedAudience = audience.trim();
    if (trimmedAudience && !formData.targetAudience.includes(trimmedAudience)) {
      handleInputChange('targetAudience', [...formData.targetAudience, trimmedAudience]);
      setAudienceInput('');
    }
  };

  const handleAudienceRemove = (audienceToRemove: string) => {
    handleInputChange('targetAudience', formData.targetAudience.filter(audience => audience !== audienceToRemove));
  };


  const handleDocumentChange = (documentIds: string[]) => {
    handleInputChange('documentIds', documentIds);
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      return false;
    }

    if (isResource && !formData.resourceType) {
      return false;
    }

    if (requiresUrl && !formData.url?.trim()) {
      return false;
    }

    if (requiresUrl && formData.url?.trim() && !isValidUrl(formData.url)) {
      return false;
    }

    return true;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      // Convert "none" values to null for ObjectId compatibility
      // Use body content as description for backward compatibility
      const submitData = {
        ...formData,
        description: formData.body, // Map body to description for API
        familyId: formData.familyId === 'none' ? null : formData.familyId,
        categoryId: formData.categoryId === 'none' ? null : formData.categoryId
      };
      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handlePreview = () => {
    if (!validateForm()) return;
    // Convert "none" values to empty strings for preview compatibility
    // Use body content as description for backward compatibility
    const previewData = {
      ...formData,
      description: formData.body, // Map body to description for preview
      familyId: formData.familyId === 'none' ? '' : formData.familyId,
      categoryId: formData.categoryId === 'none' ? '' : formData.categoryId
    };
    onPreview?.(previewData);
  };

  const getVisibilityIcon = (visibility: NoteVisibility) => {
    switch (visibility) {
      case NoteVisibility.PRIVATE: return <Lock className="h-4 w-4" />;
      case NoteVisibility.FAMILY: return <Users className="h-4 w-4" />;
      case NoteVisibility.SHARED: return <Users className="h-4 w-4" />;
      case NoteVisibility.PUBLIC: return <Globe className="h-4 w-4" />;
      default: return <Lock className="h-4 w-4" />;
    }
  };

  const renderBasicFields = () => (
    <div className="space-y-3">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-sm font-medium">
          Title *
        </Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => handleInputChange('title', e.target.value)}
          placeholder="Enter content title..."
          className="min-h-[44px]"
        />
        {errors.title && (
          <p className="text-sm text-red-600">{errors.title}</p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="body" className="text-sm font-medium">
          Content
        </Label>
        <Textarea
          id="body"
          value={formData.body}
          onChange={(e) => handleInputChange('body', e.target.value)}
          placeholder="Write your content here... (supports Markdown)"
          rows={6}
          className="resize-none"
        />
        {errors.body && (
          <p className="text-sm text-red-600">{errors.body}</p>
        )}
      </div>
    </div>
  );

  const renderTypeSpecificFields = () => (
    <div className="space-y-3">
      {/* Note Type */}
      {isNote && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Note Type</Label>
          <Select
            value={formData.noteType}
            onValueChange={(value) => handleInputChange('noteType', value as NoteType)}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NoteType.TEXT}>Text Note</SelectItem>
              <SelectItem value={NoteType.CHECKLIST}>Checklist</SelectItem>
              <SelectItem value={NoteType.JOURNAL}>Journal Entry</SelectItem>
              <SelectItem value={NoteType.MEETING}>Meeting Notes</SelectItem>
              <SelectItem value={NoteType.CARE_PLAN}>Care Plan</SelectItem>
              <SelectItem value={NoteType.RESOURCE}>Resource</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Resource Type */}
      {isResource && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Resource Type *</Label>
          <Select
            value={formData.resourceType}
            onValueChange={(value) => handleInputChange('resourceType', value as ResourceContentType)}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ResourceContentType.DOCUMENT}>Document</SelectItem>
              <SelectItem value={ResourceContentType.LINK}>External Link</SelectItem>
              <SelectItem value={ResourceContentType.VIDEO}>Video</SelectItem>
              <SelectItem value={ResourceContentType.AUDIO}>Audio</SelectItem>
              <SelectItem value={ResourceContentType.IMAGE}>Image</SelectItem>
              <SelectItem value={ResourceContentType.TOOL}>Tool</SelectItem>
              <SelectItem value={ResourceContentType.CONTACT}>Contact</SelectItem>
              <SelectItem value={ResourceContentType.SERVICE}>Service</SelectItem>
            </SelectContent>
          </Select>
          {errors.resourceType && (
            <p className="text-sm text-red-600">{errors.resourceType}</p>
          )}
        </div>
      )}

      {/* URL for Resources */}
      {isResource && requiresUrl && (
        <div className="space-y-2">
          <Label htmlFor="url" className="text-sm font-medium flex items-center gap-1">
            <LinkIcon className="h-4 w-4" />
            URL *
          </Label>
          <Input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => handleInputChange('url', e.target.value)}
            placeholder="https://example.com"
            className="min-h-[44px]"
          />
          {errors.url && (
            <p className="text-sm text-red-600">{errors.url}</p>
          )}
        </div>
      )}

      {/* Target Audience for Resources */}
      {isResource && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Target Audience</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.targetAudience.map((audience) => (
              <Badge key={audience} variant="secondary" className="flex items-center gap-1">
                {audience}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-red-500"
                  onClick={() => handleAudienceRemove(audience)}
                />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Caregivers, Family members..."
              value={audienceInput}
              onChange={(e) => setAudienceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAudienceAdd(audienceInput);
                }
              }}
              className="flex-1 min-h-[44px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAudienceAdd(audienceInput)}
              disabled={!audienceInput.trim()}
              className="min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderOrganizationFields = () => (
    <div className="space-y-4">
      {/* Content Type Specific Fields */}
      {isNote && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Note Type</Label>
          <Select
            value={formData.noteType}
            onValueChange={(value) => handleInputChange('noteType', value as NoteType)}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NoteType.TEXT}>Text Note</SelectItem>
              <SelectItem value={NoteType.CHECKLIST}>Checklist</SelectItem>
              <SelectItem value={NoteType.MEETING}>Meeting Notes</SelectItem>
              <SelectItem value={NoteType.CARE_PLAN}>Care Plan</SelectItem>
              <SelectItem value={NoteType.JOURNAL}>Journal Entry</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isResource && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Resource Type</Label>
            <Select
              value={formData.resourceType}
              onValueChange={(value) => handleInputChange('resourceType', value as ResourceContentType)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ResourceContentType.DOCUMENT}>Document</SelectItem>
                <SelectItem value={ResourceContentType.LINK}>Link</SelectItem>
                <SelectItem value={ResourceContentType.VIDEO}>Video</SelectItem>
                <SelectItem value={ResourceContentType.IMAGE}>Image</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {requiresUrl && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Resource URL *</Label>
              <Input
                type="url"
                placeholder="https://example.com/resource"
                value={formData.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
                className="min-h-[44px]"
              />
              {errors.url && (
                <p className="text-sm text-red-600">{errors.url}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Audience</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.targetAudience.map((audience) => (
                <Badge key={audience} variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {audience}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-red-500"
                    onClick={() => handleAudienceRemove(audience)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="families, caregivers, healthcare providers..."
                value={audienceInput}
                onChange={(e) => setAudienceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAudienceAdd(audienceInput);
                  }
                }}
                className="flex-1 min-h-[44px]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAudienceAdd(audienceInput)}
                disabled={!audienceInput.trim()}
                className="min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Visibility and Family */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Visibility</Label>
          <Select
            value={formData.visibility}
            onValueChange={(value) => handleInputChange('visibility', value as NoteVisibility)}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NoteVisibility.PRIVATE}>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span>Private (Only me)</span>
                </div>
              </SelectItem>
              <SelectItem value={NoteVisibility.FAMILY}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Family</span>
                </div>
              </SelectItem>
              <SelectItem value={NoteVisibility.SHARED}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Shared</span>
                </div>
              </SelectItem>
              <SelectItem value={NoteVisibility.PUBLIC}>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Public</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {availableFamilies.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Family</Label>
            <Select
              value={formData.familyId}
              onValueChange={(value) => handleInputChange('familyId', value)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Select family (optional)" />
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
      </div>

      {/* Unified Tags and Categories Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Tags & Categories</Label>
          <span className="text-xs text-gray-500">Organize your content for easy discovery</span>
        </div>

        {/* Healthcare Tags - Navigate to Selection Page */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">Healthcare Tags:</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => {
                const currentPath = window.location.pathname;
                const currentUrl = encodeURIComponent(currentPath);
                const currentTags = encodeURIComponent(formData.tags.join(','));

                let tagsPagePath = '/admin/content/tags';
                if (userRole === 'VOLUNTEER') {
                  tagsPagePath = '/volunteer/content/tags';
                } else if (userRole === 'MEMBER') {
                  tagsPagePath = '/member/content/tags';
                }

                const url = `${tagsPagePath}?returnUrl=${currentUrl}&selectedTags=${currentTags}`;
                router.push(url);
              }}
            >
              <Tag className="h-3 w-3 mr-1" />
              Browse Tags
            </Button>
          </div>
        </div>

        {/* Selected Tags */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Selected Tags:</p>
          <div className="flex flex-wrap gap-2 min-h-[2rem] p-2 border rounded-lg bg-gray-50">
            {formData.tags.length > 0 ? (
              formData.tags.map((tag) => {
                const healthcareTag = ALL_HEALTHCARE_TAGS.find(ht => ht.name === tag);
                return (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                    style={healthcareTag ? { backgroundColor: `${healthcareTag.color}20`, color: healthcareTag.color, borderColor: healthcareTag.color } : {}}
                  >
                    {tag}
                    <button
                      type="button"
                      className="ml-1 p-1 rounded hover:bg-red-100 hover:text-red-600 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTagRemove(tag);
                      }}
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })
            ) : (
              <span className="text-sm text-gray-500">No tags selected</span>
            )}
          </div>
        </div>

        {/* Custom Tag Input */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Add Custom Tags:</p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter custom tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTagAdd(tagInput);
                }
              }}
              className="flex-1 min-h-[44px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTagAdd(tagInput)}
              disabled={!tagInput.trim()}
              className="min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFeatureSettings = () => (
    <div className="space-y-3">
      {/* Note-specific features */}
      {isNote && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Note Features</h4>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Pin Note</Label>
              <p className="text-xs text-gray-600">Pin to the top of your notes</p>
            </div>
            <Switch
              checked={formData.isPinned}
              onCheckedChange={(checked) => handleInputChange('isPinned', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Allow Comments</Label>
              <p className="text-xs text-gray-600">Let others comment on this note</p>
            </div>
            <Switch
              checked={formData.allowComments}
              onCheckedChange={(checked) => handleInputChange('allowComments', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Allow Editing</Label>
              <p className="text-xs text-gray-600">Let others edit this note</p>
            </div>
            <Switch
              checked={formData.allowEditing}
              onCheckedChange={(checked) => handleInputChange('allowEditing', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Assignments</Label>
              <p className="text-xs text-gray-600">Allow tasks to be assigned from this note</p>
            </div>
            <Switch
              checked={formData.hasAssignments}
              onCheckedChange={(checked) => handleInputChange('hasAssignments', checked)}
            />
          </div>
        </div>
      )}

      {/* Resource-specific features */}
      {isResource && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Resource Features</h4>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Ratings</Label>
              <p className="text-xs text-gray-600">Allow users to rate this resource</p>
            </div>
            <Switch
              checked={formData.hasRatings}
              onCheckedChange={(checked) => handleInputChange('hasRatings', checked)}
            />
          </div>

          {userRole === 'ADMIN' && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Requires Curation</Label>
                <p className="text-xs text-gray-600">Needs admin approval before publishing</p>
              </div>
              <Switch
                checked={formData.hasCuration}
                onCheckedChange={(checked) => handleInputChange('hasCuration', checked)}
              />
            </div>
          )}
        </div>
      )}

      {/* Shared features */}
      <div className="space-y-3 pt-3 border-t">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Enable Sharing</Label>
            <p className="text-xs text-gray-600">Track when this content is shared</p>
          </div>
          <Switch
            checked={formData.hasSharing}
            onCheckedChange={(checked) => handleInputChange('hasSharing', checked)}
          />
        </div>
      </div>
    </div>
  );

  const renderDocumentAttachments = () => (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-1">
        <Upload className="h-4 w-4" />
        Document Attachments
      </Label>
      <DocumentAttachmentManager
        noteId={initialData?.id || 'new-content'}
        attachments={[]} // TODO: Implement document attachments
        onAttachmentsChange={(attachments) => {
          const documentIds = attachments.map(att => att.document.id);
          handleDocumentChange(documentIds);
        }}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Basic Information */}
      <div className="space-y-3">
        {renderBasicFields()}
      </div>

      {/* Combined Organization & Details */}
      <div className="space-y-3 pt-3 border-t">
        <h3 className="text-xl font-semibold text-gray-900">Organization & Details</h3>
        {renderOrganizationFields()}
      </div>

      {/* Document Attachments */}
      <div className="space-y-3 pt-3 border-t">
        <h3 className="text-xl font-semibold text-gray-900">Attachments</h3>
        {renderDocumentAttachments()}
      </div>

      {/* Features */}
      <div className="space-y-3 pt-3 border-t">
        <h3 className="text-xl font-semibold text-gray-900">Features</h3>
        {renderFeatureSettings()}
      </div>

      {/* Form Actions */}
      <div className="flex items-center gap-3 pt-3 border-t">
        {onPreview && (
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={isLoading || !formData.title.trim()}
            className="flex items-center gap-2 min-h-[44px]"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        )}

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !formData.title.trim()}
          className="flex items-center gap-2 min-h-[44px]"
        >
          <Save className="h-4 w-4" />
          {isLoading ? 'Saving...' : mode === 'create' ? 'Create' : 'Save Changes'}
        </Button>

        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

export default ContentForm;