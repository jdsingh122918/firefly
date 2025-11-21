'use client';

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Tag } from 'lucide-react';
import { ALL_HEALTHCARE_TAGS } from '@/lib/data/healthcare-tags';

interface PopularTagsQuickSelectProps {
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onShowAllTags?: () => void;
  className?: string;
}

// Define the most commonly used healthcare tags across categories
const POPULAR_TAG_NAMES = [
  'Grief/Bereavement Support',
  'Pain & Symptom Management',
  'Palliative & Hospice Care',
  'Mental Health & Wellness',
  'Emergency Care',
  'Medications/Pharmacy',
  'Medical Decision-Making',
  'Family Support/Programs'
];

const PopularTagsQuickSelect: React.FC<PopularTagsQuickSelectProps> = ({
  selectedTags,
  onTagToggle,
  onShowAllTags,
  className = ''
}) => {
  // Get the full tag objects for popular tags
  const popularTags = useMemo(() => {
    return POPULAR_TAG_NAMES.map(tagName =>
      ALL_HEALTHCARE_TAGS.find(tag => tag.name === tagName)
    ).filter(Boolean);
  }, []);

  const handleTagClick = (tagName: string) => {
    onTagToggle(tagName);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-gray-900">Quick Select Popular Tags</h3>
        </div>
        {onShowAllTags && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onShowAllTags}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            Browse All Tags
          </Button>
        )}
      </div>

      {/* Popular Tags Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {popularTags.map((tag) => {
          if (!tag) return null;

          const isSelected = selectedTags.includes(tag.name);

          return (
            <button
              key={tag.name}
              type="button"
              onClick={() => handleTagClick(tag.name)}
              className={`
                text-left p-3 rounded-lg border-2 transition-all duration-200 text-sm
                backdrop-blur-sm hover:shadow-md
                ${isSelected
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-background/60 border-border hover:border-primary/20 hover:bg-accent/50'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate pr-2">{tag.name}</span>
                <div className="flex items-center gap-1">
                  {isSelected ? (
                    <div
                      className="w-3 h-3 rounded-full bg-current opacity-60"
                      style={{ backgroundColor: tag.color }}
                    />
                  ) : (
                    <Plus className="h-3 w-3 opacity-40" />
                  )}
                </div>
              </div>
              <div className="mt-1 text-xs opacity-70 truncate">
                {tag.category}
              </div>
            </button>
          );
        })}
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-500">
        Click tags to add/remove them. Use "Browse All Tags" for comprehensive selection.
      </p>
    </div>
  );
};

export default PopularTagsQuickSelect;