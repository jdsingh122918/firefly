'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Search,
  Tag,
  Check,
  X,
  Hash,
  Filter
} from 'lucide-react';
import { HEALTHCARE_CATEGORIES, ALL_HEALTHCARE_TAGS } from '@/lib/data/healthcare-tags';
import { useToast } from '@/hooks/use-toast';

interface HealthcareTagSelectorProps {
  userRole: 'ADMIN' | 'VOLUNTEER' | 'MEMBER';
  currentTags: string[];
  returnUrl: string;
}

const HealthcareTagSelector: React.FC<HealthcareTagSelectorProps> = ({
  userRole,
  currentTags = [],
  returnUrl
}) => {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Filter tags based on search query and category filter
  const filteredHealthcareTags = ALL_HEALTHCARE_TAGS.filter(tag => {
    const matchesSearch = searchQuery === '' ||
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategoryFilter === null ||
      tag.category === selectedCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Group tags by category for display
  const groupedTags = filteredHealthcareTags.reduce((groups, tag) => {
    if (!groups[tag.category]) {
      groups[tag.category] = [];
    }
    groups[tag.category].push(tag);
    return groups;
  }, {} as Record<string, typeof ALL_HEALTHCARE_TAGS>);

  const handleTagToggle = useCallback((tagName: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagName)) {
        return prev.filter(t => t !== tagName);
      } else {
        return [...prev, tagName];
      }
    });
  }, []);

  const handleCategoryToggle = useCallback((categoryName: string) => {
    const category = HEALTHCARE_CATEGORIES.find(cat => cat.name === categoryName);
    if (!category) return;

    const categoryTags = category.tags;
    const allCategoryTagsSelected = categoryTags.every(tag => selectedTags.includes(tag));

    if (allCategoryTagsSelected) {
      // Remove all category tags
      setSelectedTags(prev => prev.filter(tag => !categoryTags.includes(tag)));
    } else {
      // Add all category tags (if not already selected)
      setSelectedTags(prev => {
        const newTags = [...prev];
        categoryTags.forEach(tag => {
          if (!newTags.includes(tag)) {
            newTags.push(tag);
          }
        });
        return newTags;
      });
    }
  }, [selectedTags]);

  const handleApplySelection = async () => {
    setIsApplying(true);

    try {
      const encodedTags = encodeURIComponent(selectedTags.join(','));
      const separator = returnUrl.includes('?') ? '&' : '?';
      const newUrl = `${returnUrl}${separator}selectedTags=${encodedTags}`;

      // Show feedback for applying tags
      if (selectedTags.length > 0) {
        toast({
          title: 'Applying Tags',
          description: `${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''} will be applied to your content.`,
        });
      }

      router.push(newUrl);
    } catch (error) {
      console.error('Error applying tags:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply tags. Please try again.',
        variant: 'destructive',
      });
      setIsApplying(false);
    }
  };

  const handleCancel = () => {
    router.push(returnUrl);
  };

  const clearAllTags = () => {
    setSelectedTags([]);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="mt-1"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Healthcare Tags</h1>
          </div>
          <p className="text-sm text-gray-600">
            Browse and select healthcare tags to organize your content. Tags help users find relevant information quickly.
          </p>
        </div>

        <div className="text-right">
          <div className="text-sm font-medium">
            {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
          </div>
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllTags}
              className="text-xs mt-1"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search healthcare tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCategoryFilter || ''}
                onChange={(e) => setSelectedCategoryFilter(e.target.value || null)}
                className="px-3 py-2 border rounded-md text-sm min-w-[200px]"
              >
                <option value="">All Categories</option>
                {HEALTHCARE_CATEGORIES.map(category => (
                  <option key={category.name} value={category.name}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Categories ({HEALTHCARE_CATEGORIES.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {HEALTHCARE_CATEGORIES.map((category) => {
              const categoryTags = category.tags;
              const selectedCount = categoryTags.filter(tag => selectedTags.includes(tag)).length;
              const allSelected = selectedCount === categoryTags.length;

              return (
                <div
                  key={category.name}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  style={{ borderColor: `${category.color}40` }}
                  onClick={() => handleCategoryToggle(category.name)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{category.icon}</span>
                      <span className="font-medium text-sm">{category.name}</span>
                    </div>
                    {allSelected && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {categoryTags.length} tags • {selectedCount} selected
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${(selectedCount / categoryTags.length) * 100}%`,
                        backgroundColor: category.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Individual Tags */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Individual Tags
              {selectedCategoryFilter && (
                <span className="text-sm font-normal text-gray-600">
                  • {selectedCategoryFilter} ({filteredHealthcareTags.length} tags)
                </span>
              )}
            </CardTitle>
            {selectedCategoryFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategoryFilter(null)}
                className="text-xs"
              >
                Show All Categories
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredHealthcareTags.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No tags found</p>
              <p className="text-sm">
                {searchQuery ? 'Try adjusting your search terms' : 'Select a category to browse tags'}
              </p>
            </div>
          ) : selectedCategoryFilter === null ? (
            // Group by category when showing all
            <div className="space-y-6">
              {Object.entries(groupedTags).map(([categoryName, tags]) => {
                const category = HEALTHCARE_CATEGORIES.find(cat => cat.name === categoryName);
                if (!category) return null;

                return (
                  <div key={categoryName}>
                    <div className="flex items-center gap-2 mb-3">
                      <span>{category.icon}</span>
                      <h3 className="font-medium text-gray-800">{categoryName}</h3>
                      <span className="text-xs text-gray-500">({tags.length} tags)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {tags.map(tag => (
                        <button
                          key={tag.name}
                          onClick={() => handleTagToggle(tag.name)}
                          className="text-xs px-3 py-2 rounded border text-left hover:opacity-80 transition-all min-h-[40px] flex items-center justify-between"
                          style={{
                            backgroundColor: selectedTags.includes(tag.name) ? `${tag.color}20` : 'white',
                            borderColor: selectedTags.includes(tag.name) ? tag.color : '#e5e7eb',
                            color: selectedTags.includes(tag.name) ? tag.color : '#374151'
                          }}
                        >
                          <span className="truncate">{tag.name}</span>
                          {selectedTags.includes(tag.name) && (
                            <Check className="h-3 w-3 flex-shrink-0 ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Simple grid when filtering by category
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {filteredHealthcareTags.map(tag => (
                <button
                  key={tag.name}
                  onClick={() => handleTagToggle(tag.name)}
                  className="text-xs px-3 py-2 rounded border text-left hover:opacity-80 transition-all min-h-[40px] flex items-center justify-between"
                  style={{
                    backgroundColor: selectedTags.includes(tag.name) ? `${tag.color}20` : 'white',
                    borderColor: selectedTags.includes(tag.name) ? tag.color : '#e5e7eb',
                    color: selectedTags.includes(tag.name) ? tag.color : '#374151'
                  }}
                >
                  <span className="truncate">{tag.name}</span>
                  {selectedTags.includes(tag.name) && (
                    <Check className="h-3 w-3 flex-shrink-0 ml-1" />
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Tags Preview */}
      {selectedTags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Selected Tags ({selectedTags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedTags.map(tagName => {
                const tag = ALL_HEALTHCARE_TAGS.find(t => t.name === tagName);
                return (
                  <Badge
                    key={tagName}
                    variant="outline"
                    className="flex items-center gap-1"
                    style={tag ? {
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      borderColor: tag.color
                    } : {}}
                  >
                    {tagName}
                    <button
                      onClick={() => handleTagToggle(tagName)}
                      className="ml-1 hover:bg-red-100 hover:text-red-600 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="sticky bottom-6 bg-background/95 backdrop-blur-sm border-2 border-primary/20 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">
              {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
            </p>
            {selectedTags.length > 0 && (
              <p className="text-sm text-gray-600">
                These tags will be applied to your content
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isApplying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApplySelection}
              disabled={isApplying}
            >
              {isApplying ? 'Applying...' : 'Apply Tags'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthcareTagSelector;