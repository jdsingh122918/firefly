import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Tag as TagType } from "@/lib/types/index";
import { ResourceType } from "@/lib/types/index";
import { useResourceTags, useTags } from "@/hooks/use-tags";
import { TagSelector, QuickTagPicker } from "./tag-selector";
import { TagList } from "./tag";
import { Button } from "./button";
import { Label } from "./label";
import { Alert, AlertDescription } from "./alert";
import { Separator } from "./separator";
import { Loader2, Tag as TagIcon, AlertTriangle } from "lucide-react";

// Resource tagger props
interface ResourceTaggerProps {
  resourceId: string;
  resourceType: ResourceType;
  className?: string;
  variant?: "full" | "compact" | "minimal";
  allowQuickAdd?: boolean;
  allowCreate?: boolean;
  maxTags?: number;
  readOnly?: boolean;
  showLabel?: boolean;
  onTagsChange?: (tags: TagType[]) => void;
}

export function ResourceTagger({
  resourceId,
  resourceType,
  className,
  variant = "full",
  allowQuickAdd = true,
  allowCreate = false,
  maxTags = 10,
  readOnly = false,
  showLabel = true,
  onTagsChange,
}: ResourceTaggerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resource tags hook
  const {
    tags: resourceTags,
    loading: resourceTagsLoading,
    error: resourceTagsError,
    addTags,
    removeTags,
  } = useResourceTags({
    resourceId,
    resourceType,
    autoFetch: true,
  });

  // All tags hook for creating new ones
  const { createTag } = useTags({ autoFetch: false });

  // Handle adding tags to resource
  const handleAddTags = useCallback(
    async (tags: TagType[]) => {
      if (tags.length === 0) return;

      setError(null);
      try {
        await addTags(tags.map((tag) => tag.id));
        onTagsChange?.(resourceTags);
        setIsAdding(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add tags");
      }
    },
    [addTags, onTagsChange, resourceTags],
  );

  // Handle removing tag from resource
  const handleRemoveTag = useCallback(
    async (tag: TagType) => {
      setError(null);
      try {
        await removeTags([tag.id]);
        onTagsChange?.(resourceTags.filter((t) => t.id !== tag.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove tag");
      }
    },
    [removeTags, onTagsChange, resourceTags],
  );

  // Handle quick tag selection
  const handleQuickTagSelect = useCallback(
    async (tag: TagType) => {
      await handleAddTags([tag]);
    },
    [handleAddTags],
  );

  // Handle creating new tag
  const handleCreateTag = useCallback(
    async (name: string, categoryId?: string) => {
      try {
        const newTag = await createTag({ name, categoryId });
        return newTag;
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : "Failed to create tag",
        );
      }
    },
    [createTag],
  );

  // Loading state
  if (resourceTagsLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading tags...</span>
      </div>
    );
  }

  // Error state
  if (resourceTagsError && !resourceTags) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{resourceTagsError}</AlertDescription>
      </Alert>
    );
  }

  // Minimal variant - just show tags with optional remove
  if (variant === "minimal") {
    return (
      <div className={cn(className)}>
        {resourceTags.length > 0 ? (
          <TagList
            tags={resourceTags}
            size="sm"
            removable={!readOnly}
            onRemove={handleRemoveTag}
            maxDisplayed={5}
          />
        ) : (
          <span className="text-sm text-muted-foreground">No tags</span>
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        {showLabel && (
          <Label className="text-sm font-medium">Tags</Label>
        )}

        {/* Current tags */}
        {resourceTags.length > 0 && (
          <TagList
            tags={resourceTags}
            size="sm"
            removable={!readOnly}
            onRemove={handleRemoveTag}
          />
        )}

        {/* Add button */}
        {!readOnly && !isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={maxTags ? resourceTags.length >= maxTags : false}
            className="h-7"
          >
            <TagIcon className="h-3 w-3 mr-1" />
            Add Tag
          </Button>
        )}

        {/* Tag selector */}
        {isAdding && !readOnly && (
          <div className="border rounded-md p-3 bg-muted/50">
            <TagSelector
              variant="compact"
              selectedTags={resourceTags}
              onTagSelect={handleQuickTagSelect}
              maxTags={maxTags}
              allowCreateNew={allowCreate}
              onCreateTag={handleCreateTag}
              placeholder="Search and add tags..."
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn("space-y-4", className)}>
      {showLabel && (
        <div>
          <Label className="text-sm font-medium">Tags</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Add tags to organize and find this resource easily
          </p>
        </div>
      )}

      {/* Current tags */}
      {resourceTags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Current Tags</Label>
          <TagList
            tags={resourceTags}
            removable={!readOnly}
            onRemove={handleRemoveTag}
          />
        </div>
      )}

      {!readOnly && (
        <>
          <Separator />

          {/* Quick add popular tags */}
          {allowQuickAdd && (
            <QuickTagPicker
              onTagSelect={handleQuickTagSelect}
              selectedTagIds={resourceTags.map((tag) => tag.id)}
              limit={8}
            />
          )}

          {allowQuickAdd && <Separator />}

          {/* Full tag selector */}
          <TagSelector
            selectedTags={resourceTags}
            onTagSelect={handleQuickTagSelect}
            maxTags={maxTags}
            allowCreateNew={allowCreate}
            onCreateTag={handleCreateTag}
            placeholder="Search for tags..."
            showCategories={true}
          />
        </>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tag limit indicator */}
      {maxTags && resourceTags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {resourceTags.length} of {maxTags} tags used
        </p>
      )}
    </div>
  );
}

// Inline resource tagger for use in lists/cards
interface InlineResourceTaggerProps {
  resourceId: string;
  resourceType: ResourceType;
  className?: string;
  maxDisplayed?: number;
  allowAdd?: boolean;
  onTagsChange?: (tags: TagType[]) => void;
}

export function InlineResourceTagger({
  resourceId,
  resourceType,
  className,
  maxDisplayed = 3,
  allowAdd = true,
  onTagsChange,
}: InlineResourceTaggerProps) {
  const [showSelector, setShowSelector] = useState(false);

  const {
    tags: resourceTags,
    loading,
    addTags,
    removeTags,
  } = useResourceTags({
    resourceId,
    resourceType,
    autoFetch: true,
  });

  const { createTag } = useTags({ autoFetch: false });

  const handleAddTag = useCallback(
    async (tag: TagType) => {
      try {
        await addTags([tag.id]);
        onTagsChange?.(resourceTags);
        setShowSelector(false);
      } catch (error) {
        console.error("Failed to add tag:", error);
      }
    },
    [addTags, onTagsChange, resourceTags],
  );

  const handleRemoveTag = useCallback(
    async (tag: TagType) => {
      try {
        await removeTags([tag.id]);
        onTagsChange?.(resourceTags.filter((t) => t.id !== tag.id));
      } catch (error) {
        console.error("Failed to remove tag:", error);
      }
    },
    [removeTags, onTagsChange, resourceTags],
  );

  const handleCreateTag = useCallback(
    async (name: string, categoryId?: string) => {
      return await createTag({ name, categoryId });
    },
    [createTag],
  );

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {/* Display tags */}
      <TagList
        tags={resourceTags}
        size="sm"
        variant="secondary"
        removable={allowAdd}
        onRemove={handleRemoveTag}
        maxDisplayed={maxDisplayed}
      />

      {/* Add tag button */}
      {allowAdd && !showSelector && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSelector(true)}
          className="h-5 px-2 text-xs"
        >
          <TagIcon className="h-3 w-3" />
        </Button>
      )}

      {/* Inline tag selector */}
      {showSelector && allowAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg p-4 w-96 max-h-[80vh] overflow-auto">
            <TagSelector
              selectedTags={resourceTags}
              onTagSelect={handleAddTag}
              allowCreateNew={true}
              onCreateTag={handleCreateTag}
              variant="default"
            />
            <div className="flex justify-end mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSelector(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}