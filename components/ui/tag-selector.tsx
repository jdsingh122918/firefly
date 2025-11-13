import React, { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Tag as TagType, Category } from "@/lib/types/index";
import { useTags, useCategories } from "@/hooks/use-tags";
import { Tag, TagList, CategoryBadge } from "./tag";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";
import { Badge } from "./badge";
import { ScrollArea } from "./scroll-area";
import { Check, Plus, Tag as TagIcon, Folder } from "lucide-react";

// Tag selector props
interface TagSelectorProps {
  selectedTags?: TagType[];
  onTagsChange?: (tags: TagType[]) => void;
  onTagSelect?: (tag: TagType) => void;
  onTagRemove?: (tag: TagType) => void;
  placeholder?: string;
  maxTags?: number;
  allowCreateNew?: boolean;
  onCreateTag?: (name: string, categoryId?: string) => Promise<TagType>;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "compact";
  showCategories?: boolean;
  categoryFilter?: string;
}

export function TagSelector({
  selectedTags = [],
  onTagsChange,
  onTagSelect,
  onTagRemove,
  placeholder = "Search tags...",
  maxTags,
  allowCreateNew = false,
  onCreateTag,
  disabled = false,
  className,
  variant = "default",
  showCategories = true,
  categoryFilter,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    categoryFilter
  );

  // Fetch tags and categories
  const { tags, loading: tagsLoading } = useTags({
    search,
    categoryId: selectedCategoryId,
    includeSystemTags: true,
    includeUsageCount: true,
    autoFetch: true,
  });

  const { categories } = useCategories({
    includeSystemCategories: true,
    includeTagCount: true,
    autoFetch: showCategories,
  });

  // Filter out already selected tags
  const availableTags = useMemo(() => {
    const selectedIds = new Set(selectedTags.map(tag => tag.id));
    return tags.filter(tag => !selectedIds.has(tag.id));
  }, [tags, selectedTags]);

  // Handle tag selection
  const handleTagSelect = useCallback((tag: TagType) => {
    if (maxTags && selectedTags.length >= maxTags) return;

    const newTags = [...selectedTags, tag];
    onTagsChange?.(newTags);
    onTagSelect?.(tag);
    setSearch("");
  }, [selectedTags, onTagsChange, onTagSelect, maxTags]);

  // Handle tag removal
  const handleTagRemove = useCallback((tag: TagType) => {
    const newTags = selectedTags.filter(t => t.id !== tag.id);
    onTagsChange?.(newTags);
    onTagRemove?.(tag);
  }, [selectedTags, onTagsChange, onTagRemove]);

  // Handle creating new tag
  const handleCreateTag = useCallback(async () => {
    if (!allowCreateNew || !onCreateTag || !search.trim()) return;

    try {
      const newTag = await onCreateTag(search.trim(), selectedCategoryId);
      handleTagSelect(newTag);
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  }, [allowCreateNew, onCreateTag, search, selectedCategoryId, handleTagSelect]);

  // Check if we can create a new tag with the current search
  const canCreateNewTag = allowCreateNew &&
    !!search.trim() &&
    !availableTags.some(tag => tag.name.toLowerCase() === search.trim().toLowerCase());

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {selectedTags.length > 0 && (
          <TagList
            tags={selectedTags}
            size="sm"
            removable={!disabled}
            onRemove={handleTagRemove}
            maxDisplayed={3}
          />
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || (maxTags ? selectedTags.length >= maxTags : false)}
              className="h-7"
            >
              <Plus className="h-3 w-3" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <TagSelectorContent
              search={search}
              setSearch={setSearch}
              availableTags={availableTags}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              setSelectedCategoryId={setSelectedCategoryId}
              onTagSelect={handleTagSelect}
              canCreateNewTag={canCreateNewTag}
              onCreateTag={handleCreateTag}
              tagsLoading={tagsLoading}
              showCategories={showCategories}
              placeholder={placeholder}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div>
          <Label className="text-sm font-medium">Selected Tags</Label>
          <div className="mt-1">
            <TagList
              tags={selectedTags}
              removable={!disabled}
              onRemove={handleTagRemove}
            />
          </div>
        </div>
      )}

      {/* Tag selector */}
      <div>
        <Label className="text-sm font-medium">Add Tags</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="mt-1">
              <Input
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={disabled || (maxTags ? selectedTags.length >= maxTags : false)}
                className="cursor-pointer"
                readOnly
                onClick={() => setOpen(true)}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <TagSelectorContent
              search={search}
              setSearch={setSearch}
              availableTags={availableTags}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              setSelectedCategoryId={setSelectedCategoryId}
              onTagSelect={handleTagSelect}
              canCreateNewTag={canCreateNewTag}
              onCreateTag={handleCreateTag}
              tagsLoading={tagsLoading}
              showCategories={showCategories}
              placeholder={placeholder}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Tag limit indicator */}
      {maxTags && (
        <p className="text-xs text-muted-foreground">
          {selectedTags.length} of {maxTags} tags selected
        </p>
      )}
    </div>
  );
}

// Internal component for the tag selector content
interface TagSelectorContentProps {
  search: string;
  setSearch: (search: string) => void;
  availableTags: TagType[];
  categories: Category[];
  selectedCategoryId?: string;
  setSelectedCategoryId: (id?: string) => void;
  onTagSelect: (tag: TagType) => void;
  canCreateNewTag: boolean;
  onCreateTag: () => void;
  tagsLoading: boolean;
  showCategories: boolean;
  placeholder: string;
}

function TagSelectorContent({
  search,
  setSearch,
  availableTags,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
  onTagSelect,
  canCreateNewTag,
  onCreateTag,
  tagsLoading,
  showCategories,
  placeholder,
}: TagSelectorContentProps) {
  return (
    <Command className="w-full">
      <CommandInput
        placeholder={placeholder}
        value={search}
        onValueChange={setSearch}
        className="h-9"
      />
      <CommandList>
        <CommandEmpty>
          {tagsLoading ? "Loading..." : "No tags found."}
        </CommandEmpty>

        {/* Create new tag option */}
        {canCreateNewTag && (
          <CommandGroup>
            <CommandItem onSelect={onCreateTag} className="text-primary">
              <Plus className="mr-2 h-4 w-4" />
              Create &quot;{search}&quot;
              {selectedCategoryId && (
                <Badge variant="secondary" className="ml-2">
                  {categories.find(c => c.id === selectedCategoryId)?.name}
                </Badge>
              )}
            </CommandItem>
          </CommandGroup>
        )}

        {/* Category filter */}
        {showCategories && categories.length > 0 && (
          <>
            <CommandGroup heading="Categories">
              <CommandItem
                onSelect={() => setSelectedCategoryId(undefined)}
                className={cn(!selectedCategoryId && "bg-accent")}
              >
                <TagIcon className="mr-2 h-4 w-4" />
                All Categories
              </CommandItem>
              {categories.map((category) => (
                <CommandItem
                  key={category.id}
                  onSelect={() => setSelectedCategoryId(category.id)}
                  className={cn(selectedCategoryId === category.id && "bg-accent")}
                >
                  <Folder className="mr-2 h-4 w-4" />
                  {category.name}
                  {category.tagCount !== undefined && (
                    <Badge variant="secondary" className="ml-auto">
                      {category.tagCount}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Available tags */}
        {availableTags.length > 0 && (
          <CommandGroup heading="Available Tags">
            <ScrollArea className="h-60">
              {availableTags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  onSelect={() => onTagSelect(tag)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    <span>{tag.name}</span>
                    {tag.category && (
                      <CategoryBadge
                        category={tag.category}
                        size="sm"
                        className="ml-2"
                      />
                    )}
                  </div>
                  {tag.usageCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {tag.usageCount}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </ScrollArea>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

// Quick tag picker for inline use
interface QuickTagPickerProps {
  onTagSelect: (tag: TagType) => void;
  selectedTagIds?: string[];
  className?: string;
  limit?: number;
}

export function QuickTagPicker({
  onTagSelect,
  selectedTagIds = [],
  className,
  limit = 10,
}: QuickTagPickerProps) {
  const { tags } = useTags({
    includeUsageCount: true,
    sortBy: "usageCount",
    sortOrder: "desc",
    autoFetch: true,
  });

  const availableTags = useMemo(() => {
    const selectedIds = new Set(selectedTagIds);
    return tags
      .filter(tag => !selectedIds.has(tag.id))
      .slice(0, limit);
  }, [tags, selectedTagIds, limit]);

  if (availableTags.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">Quick Add</Label>
      <div className="flex flex-wrap gap-1">
        {availableTags.map((tag) => (
          <Tag
            key={tag.id}
            tag={tag}
            size="sm"
            variant="outline"
            interactive
            onClick={() => onTagSelect(tag)}
            className="cursor-pointer hover:border-primary"
          />
        ))}
      </div>
    </div>
  );
}