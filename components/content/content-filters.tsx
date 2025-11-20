'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Video,
  Link,
  Image,
  Star,
  CheckCircle
} from 'lucide-react';
import {
  ResourceType,
  ResourceStatus,
  ResourceVisibility
} from '@prisma/client';

/**
 * Unified Content Filters Component
 *
 * Provides filtering capabilities for both NOTE and RESOURCE content:
 * - Content type selection (NOTE/RESOURCE)
 * - Type-specific filters (noteType, resourceType, status)
 * - Common filters (visibility, tags, search)
 * - Advanced filters (ratings, features, curation)
 */

export interface ContentFiltersProps {
  // Current filter state
  resourceType?: ResourceType[];
  status?: ResourceStatus[];
  visibility?: ResourceVisibility[];
  search?: string;
  tags?: string[];
  hasAssignments?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  featured?: boolean;
  verified?: boolean;
  minRating?: number;
  familyId?: string;
  categoryId?: string;

  // Filter options
  showContentTypeFilter?: boolean;
  showTypeSpecificFilters?: boolean;
  showVisibilityFilter?: boolean;
  showStatusFilter?: boolean;
  showAdvancedFilters?: boolean;
  showFamilyFilter?: boolean;
  showCategoryFilter?: boolean;

  // Available options (for dropdowns)
  availableFamilies?: Array<{ id: string; name: string }>;
  availableCategories?: Array<{ id: string; name: string }>;
  availableTags?: string[];

  // Callbacks
  onFiltersChange: (filters: ContentFiltersState) => void;
  onReset?: () => void;
}

export interface ContentFiltersState {
  resourceType?: ResourceType[];
  status?: ResourceStatus[];
  visibility?: ResourceVisibility[];
  search?: string;
  tags?: string[];
  hasAssignments?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  featured?: boolean;
  verified?: boolean;
  minRating?: number;
  familyId?: string;
  categoryId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'viewCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

const ContentFilters: React.FC<ContentFiltersProps> = ({
  resourceType = [],
  status = [],
  visibility = [],
  search = '',
  tags = [],
  hasAssignments,
  hasCuration,
  hasRatings,
  featured,
  verified,
  minRating,
  familyId,
  categoryId,
  showContentTypeFilter = true,
  showTypeSpecificFilters = true,
  showVisibilityFilter = true,
  showStatusFilter = true,
  showAdvancedFilters = true,
  showFamilyFilter = false,
  showCategoryFilter = false,
  availableFamilies = [],
  availableCategories = [],
  availableTags = [],
  onFiltersChange,
  onReset
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [tagInput, setTagInput] = useState('');

  // Since everything is now a resource, always show resource filters when enabled
  const showResourceFilters = showTypeSpecificFilters;

  const handleResourceTypeChange = (type: ResourceType, checked: boolean) => {
    const newResourceType = checked
      ? [...resourceType, type]
      : resourceType.filter(t => t !== type);

    onFiltersChange({ resourceType: newResourceType });
  };

  const handleStatusChange = (newStatus: ResourceStatus, checked: boolean) => {
    const newStatuses = checked
      ? [...status, newStatus]
      : status.filter(s => s !== newStatus);

    onFiltersChange({ status: newStatuses });
  };

  const handleVisibilityChange = (newVisibility: ResourceVisibility, checked: boolean) => {
    const newVisibilities = checked
      ? [...visibility, newVisibility]
      : visibility.filter(v => v !== newVisibility);

    onFiltersChange({ visibility: newVisibilities });
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    onFiltersChange({ search: value });
  };

  const handleTagAdd = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      onFiltersChange({ tags: [...tags, tag.trim()] });
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    onFiltersChange({ tags: tags.filter(tag => tag !== tagToRemove) });
  };

  const handleReset = () => {
    setSearchInput('');
    setTagInput('');
    onReset?.();
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (resourceType.length > 0) count++;
    if (status.length > 0) count++;
    if (visibility.length > 0) count++;
    if (search) count++;
    if (tags.length > 0) count++;
    if (hasAssignments) count++;
    if (hasCuration) count++;
    if (hasRatings) count++;
    if (featured) count++;
    if (verified) count++;
    if (minRating && minRating > 0) count++;
    if (familyId) count++;
    if (categoryId) count++;
    return count;
  };

  const renderContentTypeFilters = () => {
    if (!showContentTypeFilter) return null;

    // All content is now unified as resources - no content type selection needed
    return null;
  };

  const renderNoteFilters = () => {
    // Notes no longer exist - everything is unified as resources
    return null;
  };

  const renderResourceFilters = () => {
    if (!showResourceFilters) return null;

    const resourceTypes = [
      { value: ResourceType.DOCUMENT, label: 'Document', icon: FileText },
      { value: ResourceType.LINK, label: 'Link', icon: Link },
      { value: ResourceType.VIDEO, label: 'Video', icon: Video },
      { value: ResourceType.IMAGE, label: 'Image', icon: Image },
      { value: ResourceType.AUDIO, label: 'Audio', icon: FileText },
      { value: ResourceType.TOOL, label: 'Tool', icon: FileText },
      { value: ResourceType.CONTACT, label: 'Contact', icon: FileText },
      { value: ResourceType.SERVICE, label: 'Service', icon: FileText }
    ];

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Resource Types</Label>
        <div className="grid grid-cols-2 gap-2">
          {resourceTypes.map((type) => (
            <div key={type.value} className="flex items-center space-x-2">
              <Checkbox
                id={`resource-type-${type.value}`}
                checked={resourceType.includes(type.value)}
                onCheckedChange={(checked) => handleResourceTypeChange(type.value, checked as boolean)}
              />
              <Label htmlFor={`resource-type-${type.value}`} className="flex items-center gap-1 text-sm">
                <type.icon className="h-3 w-3" />
                {type.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStatusFilter = () => {
    if (!showStatusFilter) return null;

    const statuses = [
      { value: ResourceStatus.DRAFT, label: 'Draft' },
      { value: ResourceStatus.PENDING, label: 'Pending Review' },
      { value: ResourceStatus.APPROVED, label: 'Approved' },
      { value: ResourceStatus.FEATURED, label: 'Featured' },
      { value: ResourceStatus.ARCHIVED, label: 'Archived' }
    ];

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Status</Label>
        <div className="grid grid-cols-2 gap-2">
          {statuses.map((statusItem) => (
            <div key={statusItem.value} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${statusItem.value}`}
                checked={status.includes(statusItem.value)}
                onCheckedChange={(checked) => handleStatusChange(statusItem.value, checked as boolean)}
              />
              <Label htmlFor={`status-${statusItem.value}`} className="text-sm">
                {statusItem.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderVisibilityFilter = () => {
    if (!showVisibilityFilter) return null;

    const visibilities = [
      { value: ResourceVisibility.PUBLIC, label: 'Public' },
      { value: ResourceVisibility.FAMILY, label: 'Family' },
      { value: ResourceVisibility.SHARED, label: 'Shared' },
      { value: ResourceVisibility.PRIVATE, label: 'Private' }
    ];

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Visibility</Label>
        <div className="grid grid-cols-2 gap-2">
          {visibilities.map((vis) => (
            <div key={vis.value} className="flex items-center space-x-2">
              <Checkbox
                id={`visibility-${vis.value}`}
                checked={visibility.includes(vis.value)}
                onCheckedChange={(checked) => handleVisibilityChange(vis.value, checked as boolean)}
              />
              <Label htmlFor={`visibility-${vis.value}`} className="text-sm">
                {vis.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAdvancedFilters = () => {
    if (!showAdvancedFilters) return null;

    return (
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Advanced Filters
              {getActiveFilterCount() > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </span>
            {isAdvancedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 pt-2">
          {/* Feature Flags - all content is now resources */}
          <div className="space-y-3">
            {/* Assignment feature (for all resources) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assignment Features</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-assignments"
                  checked={hasAssignments || false}
                  onCheckedChange={(checked) =>
                    onFiltersChange({ hasAssignments: checked as boolean })
                  }
                />
                <Label htmlFor="has-assignments" className="text-sm">
                  Has Assignments
                </Label>
              </div>
            </div>

            {/* Resource features */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Resource Features</Label>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-curation"
                    checked={hasCuration || false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ hasCuration: checked as boolean })
                    }
                  />
                  <Label htmlFor="has-curation" className="text-sm">
                    Requires Curation
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-ratings"
                    checked={hasRatings || false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ hasRatings: checked as boolean })
                    }
                  />
                  <Label htmlFor="has-ratings" className="text-sm">
                    Has Ratings
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="featured"
                    checked={featured || false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ featured: checked as boolean })
                    }
                  />
                  <Label htmlFor="featured" className="text-sm">
                    Featured Content
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="verified"
                    checked={verified || false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ verified: checked as boolean })
                    }
                  />
                  <Label htmlFor="verified" className="flex items-center gap-1 text-sm">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </Label>
                </div>
              </div>

              {/* Minimum Rating */}
              <div className="space-y-2">
                <Label htmlFor="min-rating" className="text-sm font-medium">
                  Minimum Rating
                </Label>
                <Select
                  value={minRating?.toString() || ''}
                  onValueChange={(value) =>
                    onFiltersChange({ minRating: value ? parseFloat(value) : undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any rating</SelectItem>
                    <SelectItem value="4">4+ stars</SelectItem>
                    <SelectItem value="3">3+ stars</SelectItem>
                    <SelectItem value="2">2+ stars</SelectItem>
                    <SelectItem value="1">1+ stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Family Filter */}
          {showFamilyFilter && availableFamilies.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="family-filter" className="text-sm font-medium">
                Family
              </Label>
              <Select
                value={familyId || ''}
                onValueChange={(value) => onFiltersChange({ familyId: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All families" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All families</SelectItem>
                  {availableFamilies.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category Filter */}
          {showCategoryFilter && availableCategories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="category-filter" className="text-sm font-medium">
                Category
              </Label>
              <Select
                value={categoryId || ''}
                onValueChange={(value) => onFiltersChange({ categoryId: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search" className="text-sm font-medium">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              placeholder="Search content..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tags</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                {tag}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-red-500"
                  onClick={() => handleTagRemove(tag)}
                />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTagAdd(tagInput);
                }
              }}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTagAdd(tagInput)}
              disabled={!tagInput.trim()}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Basic Filters */}
        {renderContentTypeFilters()}
        {renderNoteFilters()}
        {renderResourceFilters()}
        {renderStatusFilter()}
        {renderVisibilityFilter()}

        {/* Advanced Filters */}
        {renderAdvancedFilters()}

        {/* Reset Button */}
        {getActiveFilterCount() > 0 && (
          <Button variant="outline" onClick={handleReset} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Reset Filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ContentFilters;