import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { Tag as TagType, Category } from "@/lib/types/index";
import { useTags, useCategories } from "@/hooks/use-tags";
import { Tag, CategoryBadge } from "./tag";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Badge } from "./badge";
import { Alert, AlertDescription } from "./alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Textarea } from "./textarea";
import {
  MoreHorizontal,
  Plus,
  Edit,
  Trash2,
  Search,
  Folder,
  FolderPlus,
  Tag as TagIcon,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

// Color options for tags and categories
const colorOptions = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#eab308", // yellow
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#64748b", // slate
];

// Tag manager component
interface TagManagerProps {
  className?: string;
}

export function TagManager({ className }: TagManagerProps) {
  const [activeTab, setActiveTab] = useState("tags");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Hooks for tags and categories
  const {
    tags,
    loading: tagsLoading,
    error: tagsError,
    createTag,
    updateTag,
    deleteTag,
    refetch: refetchTags,
  } = useTags({
    search: searchQuery,
    categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
    includeUsageCount: true,
    autoFetch: true,
  });

  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: refetchCategories,
  } = useCategories({
    includeTagCount: true,
    autoFetch: true,
  });

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tag Manager</h2>
          <p className="text-muted-foreground">
            Organize your tags and categories for better resource management
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tags">
            <TagIcon className="mr-2 h-4 w-4" />
            Tags ({tags.length})
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Folder className="mr-2 h-4 w-4" />
            Categories ({categories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tags" className="space-y-4">
          <TagsTab
            tags={tags}
            categories={categories}
            loading={tagsLoading}
            error={tagsError}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            createTag={createTag}
            updateTag={updateTag}
            deleteTag={deleteTag}
            refetch={refetchTags}
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <CategoriesTab
            categories={categories}
            loading={categoriesLoading}
            error={categoriesError}
            createCategory={createCategory}
            updateCategory={updateCategory}
            deleteCategory={deleteCategory}
            refetch={refetchCategories}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Tags tab component
interface TagsTabProps {
  tags: TagType[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  createTag: (data: { name: string; description?: string; color?: string; categoryId?: string }) => Promise<TagType>;
  updateTag: (id: string, data: { name?: string; description?: string; color?: string; categoryId?: string; isActive?: boolean }) => Promise<TagType>;
  deleteTag: (id: string) => Promise<boolean>;
  refetch: () => void;
}

function TagsTab({
  tags,
  categories,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  createTag,
  updateTag,
  deleteTag,
}: TagsTabProps) {
  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="">No Category</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name} ({category.tagCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CreateTagDialog categories={categories} onCreateTag={createTag} />
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tags list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading tags...</p>
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-8">
            <TagIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No tags found</p>
            <p className="text-muted-foreground">
              {searchQuery || selectedCategory !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first tag to get started"}
            </p>
          </div>
        ) : (
          tags.map((tag) => (
            <TagItem
              key={tag.id}
              tag={tag}
              categories={categories}
              onUpdate={(data) => updateTag(tag.id, data)}
              onDelete={() => deleteTag(tag.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Categories tab component
interface CategoriesTabProps {
  categories: Category[];
  loading: boolean;
  error: string | null;
  createCategory: (data: { name: string; description?: string; color?: string; icon?: string; parentId?: string }) => Promise<Category>;
  updateCategory: (id: string, data: { name?: string; description?: string; color?: string; icon?: string; parentId?: string; isActive?: boolean }) => Promise<Category>;
  deleteCategory: (id: string) => Promise<boolean>;
  refetch: () => void;
}

function CategoriesTab({
  categories,
  loading,
  error,
  createCategory,
  updateCategory,
  deleteCategory,
}: CategoriesTabProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Organize your tags into categories for better management
        </p>
        <CreateCategoryDialog
          categories={categories}
          onCreateCategory={createCategory}
        />
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Categories list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8">
            <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No categories found</p>
            <p className="text-muted-foreground">
              Create your first category to organize your tags
            </p>
          </div>
        ) : (
          categories.map((category) => (
            <CategoryItem
              key={category.id}
              category={category}
              categories={categories}
              onUpdate={(data) => updateCategory(category.id, data)}
              onDelete={() => deleteCategory(category.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Tag item component
interface TagItemProps {
  tag: TagType;
  categories: Category[];
  onUpdate: (data: { name?: string; description?: string; color?: string; categoryId?: string; isActive?: boolean }) => Promise<TagType>;
  onDelete: () => Promise<boolean>;
}

function TagItem({ tag, categories, onUpdate, onDelete }: TagItemProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <Tag tag={tag} />
        {tag.category && (
          <CategoryBadge category={tag.category} size="sm" />
        )}
        {tag.usageCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {tag.usageCount} uses
          </Badge>
        )}
        {tag.isSystemTag && (
          <Badge variant="outline" className="text-xs">
            System
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive"
              disabled={tag.isSystemTag}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit dialog */}
      {isEditing && (
        <EditTagDialog
          tag={tag}
          categories={categories}
          open={isEditing}
          onClose={() => setIsEditing(false)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// Category item component
interface CategoryItemProps {
  category: Category;
  categories: Category[];
  onUpdate: (data: { name?: string; description?: string; color?: string; icon?: string; parentId?: string; isActive?: boolean }) => Promise<Category>;
  onDelete: () => Promise<boolean>;
}

function CategoryItem({ category, categories, onUpdate, onDelete }: CategoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <CategoryBadge category={category} />
        {category.tagCount !== undefined && category.tagCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {category.tagCount} tags
          </Badge>
        )}
        {category.isSystemCategory && (
          <Badge variant="outline" className="text-xs">
            System
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive"
              disabled={category.isSystemCategory}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit dialog */}
      {isEditing && (
        <EditCategoryDialog
          category={category}
          categories={categories}
          open={isEditing}
          onClose={() => setIsEditing(false)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// Create tag dialog
interface CreateTagDialogProps {
  categories: Category[];
  onCreateTag: (data: { name: string; description?: string; color?: string; categoryId?: string }) => Promise<TagType>;
}

function CreateTagDialog({ categories, onCreateTag }: CreateTagDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [color, setColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onCreateTag({
        name: name.trim(),
        description: description.trim() || undefined,
        categoryId: categoryId || undefined,
        color: color || undefined,
      });
      setOpen(false);
      setName("");
      setDescription("");
      setCategoryId("");
      setColor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Tag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Tag</DialogTitle>
          <DialogDescription>
            Add a new tag to organize your resources
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tag name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this tag is for"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="category">Category (optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="color">Color (optional)</Label>
            <div className="flex gap-2 mt-2">
              {colorOptions.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  className={cn(
                    "w-6 h-6 rounded-full border-2",
                    color === colorOption ? "border-foreground" : "border-muted",
                  )}
                  style={{ backgroundColor: colorOption }}
                  onClick={() => setColor(colorOption)}
                />
              ))}
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || loading}>
            {loading ? "Creating..." : "Create Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit tag dialog (similar structure to create)
interface EditTagDialogProps {
  tag: TagType;
  categories: Category[];
  open: boolean;
  onClose: () => void;
  onUpdate: (data: { name?: string; description?: string; color?: string; categoryId?: string; isActive?: boolean }) => Promise<TagType>;
}

function EditTagDialog({ tag, categories, open, onClose, onUpdate }: EditTagDialogProps) {
  const [name, setName] = useState(tag.name);
  const [description, setDescription] = useState(tag.description || "");
  const [categoryId, setCategoryId] = useState(tag.categoryId || "");
  const [color, setColor] = useState(tag.color || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onUpdate({
        name: name.trim(),
        description: description.trim() || undefined,
        categoryId: categoryId || undefined,
        color: color || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tag");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tag</DialogTitle>
          <DialogDescription>
            Update the tag details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tag name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this tag is for"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="category">Category (optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="color">Color (optional)</Label>
            <div className="flex gap-2 mt-2">
              {colorOptions.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  className={cn(
                    "w-6 h-6 rounded-full border-2",
                    color === colorOption ? "border-foreground" : "border-muted",
                  )}
                  style={{ backgroundColor: colorOption }}
                  onClick={() => setColor(colorOption)}
                />
              ))}
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || loading}>
            {loading ? "Updating..." : "Update Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create category dialog
interface CreateCategoryDialogProps {
  categories: Category[];
  onCreateCategory: (data: { name: string; description?: string; color?: string; icon?: string; parentId?: string }) => Promise<Category>;
}

function CreateCategoryDialog({ categories, onCreateCategory }: CreateCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [color, setColor] = useState("");
  const [icon, setIcon] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onCreateCategory({
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || undefined,
        color: color || undefined,
        icon: icon || undefined,
      });
      setOpen(false);
      setName("");
      setDescription("");
      setParentId("");
      setColor("");
      setIcon("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FolderPlus className="h-4 w-4 mr-2" />
          Create Category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>
            Add a new category to organize your tags
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this category is for"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="parent">Parent Category (optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a parent category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Parent</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="icon">Icon (optional)</Label>
              <Input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📁"
              />
            </div>
            <div>
              <Label htmlFor="color">Color (optional)</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.slice(0, 5).map((colorOption) => (
                  <button
                    key={colorOption}
                    type="button"
                    className={cn(
                      "w-6 h-6 rounded-full border-2",
                      color === colorOption ? "border-foreground" : "border-muted",
                    )}
                    style={{ backgroundColor: colorOption }}
                    onClick={() => setColor(colorOption)}
                  />
                ))}
              </div>
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || loading}>
            {loading ? "Creating..." : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit category dialog (similar structure to create)
interface EditCategoryDialogProps {
  category: Category;
  categories: Category[];
  open: boolean;
  onClose: () => void;
  onUpdate: (data: { name?: string; description?: string; color?: string; icon?: string; parentId?: string; isActive?: boolean }) => Promise<Category>;
}

function EditCategoryDialog({ category, categories, open, onClose, onUpdate }: EditCategoryDialogProps) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || "");
  const [parentId, setParentId] = useState(category.parentId || "");
  const [color, setColor] = useState(category.color || "");
  const [icon, setIcon] = useState(category.icon || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out the current category and its descendants from parent options
  const availableParents = categories.filter(cat => cat.id !== category.id);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onUpdate({
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || undefined,
        color: color || undefined,
        icon: icon || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update the category details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this category is for"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="parent">Parent Category (optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a parent category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Parent</SelectItem>
                {availableParents.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="icon">Icon (optional)</Label>
              <Input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📁"
              />
            </div>
            <div>
              <Label htmlFor="color">Color (optional)</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.slice(0, 5).map((colorOption) => (
                  <button
                    key={colorOption}
                    type="button"
                    className={cn(
                      "w-6 h-6 rounded-full border-2",
                      color === colorOption ? "border-foreground" : "border-muted",
                    )}
                    style={{ backgroundColor: colorOption }}
                    onClick={() => setColor(colorOption)}
                  />
                ))}
              </div>
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || loading}>
            {loading ? "Updating..." : "Update Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}