'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search,
  Filter,
  X,
  Star,
  Eye,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  ResourceType,
  ResourceVisibility
} from '@prisma/client';
import { HEALTHCARE_CATEGORIES, ALL_HEALTHCARE_TAGS } from '@/lib/data/healthcare-tags';

export interface HealthcareContentFiltersState {
  // Basic filters
  search?: string;
  resourceType?: ResourceType[];
  visibility?: ResourceVisibility[];

  // Healthcare-specific filters
  healthcareCategories?: string[];
  healthcareTags?: string[];

  // Organization filters
  familyId?: string;
  categoryId?: string;

  // Feature filters
  hasCuration?: boolean;
  hasRatings?: boolean;
  isPinned?: boolean;
  isVerified?: boolean;

  // Rating filter
  minRating?: number;

  // Sort options
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'viewCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface HealthcareContentFiltersProps {
  filters: HealthcareContentFiltersState;
  availableFamilies?: Array<{ id: string; name: string }>;
  availableCategories?: Array<{ id: string; name: string; color?: string }>;
  onFiltersChange: (filters: HealthcareContentFiltersState) => void;
  onReset?: () => void;
  showAdvanced?: boolean;
}

const HealthcareContentFilters: React.FC<HealthcareContentFiltersProps> = ({
  filters = {},
  availableFamilies = [],
  availableCategories = [],
  onFiltersChange,
  onReset,
  showAdvanced = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const updateFilters = useCallback((updates: Partial<HealthcareContentFiltersState>) => {
    onFiltersChange({ ...filters, ...updates });
  }, [filters, onFiltersChange]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    updateFilters({ search: value });
  };

  const handleHealthcareCategoryToggle = (categoryName: string) => {
    const currentCategories = filters.healthcareCategories || [];
    const newCategories = currentCategories.includes(categoryName)
      ? currentCategories.filter(cat => cat !== categoryName)
      : [...currentCategories, categoryName];

    updateFilters({ healthcareCategories: newCategories });
  };

  const handleHealthcareTagToggle = (tagName: string) => {
    const currentTags = filters.healthcareTags || [];
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter(tag => tag !== tagName)
      : [...currentTags, tagName];

    updateFilters({ healthcareTags: newTags });
  };


  const clearAllFilters = () => {
    if (onReset) {
      onReset();
    } else {
      onFiltersChange({});
    }
    setSearchInput('');
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.healthcareCategories?.length) count++;
    if (filters.healthcareTags?.length) count++;
    if (filters.visibility?.length) count++;
    if (filters.familyId) count++;
    if (filters.categoryId) count++;
    if (filters.hasCuration || filters.hasRatings || filters.isPinned) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Card className="sticky top-4 z-10 shadow-md max-h-[calc(100vh-2rem)] flex flex-col w-full max-w-sm">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Filters</CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs h-6 px-2"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
            {showAdvanced && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs h-6 px-2"
              >
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 min-h-0 overflow-y-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search content..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>


        {/* Healthcare Categories */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Healthcare Categories</p>
          <div className="space-y-1.5">
            {HEALTHCARE_CATEGORIES.map((category) => {
              const isSelected = filters.healthcareCategories?.includes(category.name);
              return (
                <Button
                  key={category.name}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleHealthcareCategoryToggle(category.name)}
                  className="w-full justify-start text-xs p-2 h-auto"
                >
                  <span className="mr-2 flex-shrink-0">{category.icon}</span>
                  <div className="text-left min-w-0 flex-1">
                    <div className="font-medium truncate text-xs">{category.name}</div>
                    <div className={`text-xs ${isSelected ? "text-white/80" : "text-gray-500"}`}>
                      {category.tags.length} tags
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Selected Healthcare Tags */}
        {filters.healthcareTags && filters.healthcareTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Selected Tags</p>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {filters.healthcareTags.map(tagName => {
                const tag = ALL_HEALTHCARE_TAGS.find(t => t.name === tagName);
                return (
                  <Badge
                    key={tagName}
                    variant="outline"
                    className="text-xs flex items-center gap-1 px-1.5 py-0.5"
                    style={tag ? {
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      borderColor: tag.color
                    } : {}}
                  >
                    <span className="truncate max-w-[80px]">{tagName}</span>
                    <button
                      onClick={() => handleHealthcareTagToggle(tagName)}
                      className="hover:bg-red-100 hover:text-red-600 rounded-full p-0.5 ml-1 flex-shrink-0"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Tag Selection */}
        {filters.healthcareCategories && filters.healthcareCategories.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Quick Tag Selection</p>
            <div className="max-h-32 overflow-y-auto border rounded-md p-1.5">
              <div className="space-y-0.5">
                {ALL_HEALTHCARE_TAGS
                  .filter(tag => !filters.healthcareCategories || filters.healthcareCategories.includes(tag.category))
                  .map(tag => {
                    const isSelected = filters.healthcareTags?.includes(tag.name);
                    return (
                      <button
                        key={tag.name}
                        onClick={() => handleHealthcareTagToggle(tag.name)}
                        className="w-full text-xs px-2 py-1.5 rounded text-left hover:bg-gray-50 transition-colors border"
                        style={{
                          backgroundColor: isSelected ? `${tag.color}20` : 'white',
                          borderColor: isSelected ? tag.color : '#e5e7eb',
                          color: isSelected ? tag.color : '#374151'
                        }}
                      >
                        <span className="truncate text-xs">{tag.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="space-y-3 pt-2 border-t">
            {/* Visibility Filter */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Visibility</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(ResourceVisibility).map(visibility => (
                  <label key={visibility} className="flex items-center space-x-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={filters.visibility?.includes(visibility)}
                      onCheckedChange={(checked) => {
                        const currentVisibilities = filters.visibility || [];
                        const newVisibilities = checked
                          ? [...currentVisibilities, visibility]
                          : currentVisibilities.filter(v => v !== visibility);
                        updateFilters({ visibility: newVisibilities });
                      }}
                    />
                    <span className="capitalize text-xs">{visibility.toLowerCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Organization Filters */}
            {(availableFamilies.length > 0 || availableCategories.length > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Organization</p>
                <div className="grid grid-cols-1 gap-2">
                  {availableFamilies.length > 0 && (
                    <Select
                      value={filters.familyId || "none"}
                      onValueChange={(value) => updateFilters({ familyId: value === "none" ? undefined : value })}
                    >
                      <SelectTrigger className="text-xs h-8" suppressHydrationWarning>
                        <SelectValue placeholder="Any Family" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Any Family</SelectItem>
                        {availableFamilies.map(family => (
                          <SelectItem key={family.id} value={family.id}>
                            {family.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {availableCategories.length > 0 && (
                    <Select
                      value={filters.categoryId || "none"}
                      onValueChange={(value) => updateFilters({ categoryId: value === "none" ? undefined : value })}
                    >
                      <SelectTrigger className="text-xs h-8" suppressHydrationWarning>
                        <SelectValue placeholder="Any Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Any Category</SelectItem>
                        {availableCategories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* Feature Filters */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Features</p>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { key: 'hasCuration', label: 'Has Curation', icon: Star },
                  { key: 'hasRatings', label: 'Has Ratings', icon: Star },
                  { key: 'isPinned', label: 'Pinned', icon: Star }
                ].map(feature => (
                  <label key={feature.key} className="flex items-center space-x-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={filters[feature.key as keyof HealthcareContentFiltersState] as boolean}
                      onCheckedChange={(checked) => {
                        updateFilters({ [feature.key]: checked });
                      }}
                    />
                    <feature.icon className="h-3 w-3" />
                    <span className="text-xs">{feature.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Sort By</p>
              <div className="grid grid-cols-1 gap-2">
                <Select
                  value={filters.sortBy || "createdAt"}
                  onValueChange={(value: any) => updateFilters({ sortBy: value })}
                >
                  <SelectTrigger className="text-xs h-8" suppressHydrationWarning>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Date Created</SelectItem>
                    <SelectItem value="updatedAt">Date Updated</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="viewCount">Views</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.sortOrder || "desc"}
                  onValueChange={(value: any) => updateFilters({ sortOrder: value })}
                >
                  <SelectTrigger className="text-xs h-8" suppressHydrationWarning>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HealthcareContentFilters;