import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  Tag,
  Category,
  ResourceTag,
  ApiResponse,
} from "@/lib/types/index";
import { ResourceType } from "@/lib/types/index";

// Tag hook options
interface UseTagsOptions {
  categoryId?: string;
  search?: string;
  includeSystemTags?: boolean;
  includeUsageCount?: boolean;
  isActive?: boolean;
  sortBy?: "name" | "usageCount" | "createdAt";
  sortOrder?: "asc" | "desc";
  autoFetch?: boolean;
}

// Hook for managing tags
export function useTags(options: UseTagsOptions = {}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    categoryId,
    search,
    includeSystemTags = true,
    includeUsageCount = false,
    isActive,
    sortBy = "name",
    sortOrder = "asc",
    autoFetch = true,
  } = options;

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (categoryId) params.set("categoryId", categoryId);
    if (search) params.set("search", search);
    if (includeSystemTags) params.set("includeSystemTags", "true");
    if (includeUsageCount) params.set("includeUsageCount", "true");
    if (isActive !== undefined) params.set("isActive", isActive.toString());
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    return params.toString();
  }, [
    categoryId,
    search,
    includeSystemTags,
    includeUsageCount,
    isActive,
    sortBy,
    sortOrder,
  ]);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags?${queryParams}`);
      const data: ApiResponse<Tag[]> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch tags");
      }

      setTags(data.data || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch tags";
      setError(errorMessage);
      console.error("Failed to fetch tags:", err);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchTags();
    }
  }, [fetchTags, autoFetch]);

  // Create a new tag
  const createTag = useCallback(
    async (tagData: {
      name: string;
      description?: string;
      color?: string;
      categoryId?: string;
    }) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/tags", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(tagData),
        });

        const data: ApiResponse<Tag> = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create tag");
        }

        // Add the new tag to the list
        setTags((prevTags) => [...prevTags, data.data!]);
        return data.data!;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create tag";
        setError(errorMessage);
        console.error("Failed to create tag:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Update a tag
  const updateTag = useCallback(
    async (
      tagId: string,
      updates: {
        name?: string;
        description?: string;
        color?: string;
        categoryId?: string;
        isActive?: boolean;
      },
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/tags/${tagId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        const data: ApiResponse<Tag> = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update tag");
        }

        // Update the tag in the list
        setTags((prevTags) =>
          prevTags.map((tag) => (tag.id === tagId ? data.data! : tag)),
        );
        return data.data!;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update tag";
        setError(errorMessage);
        console.error("Failed to update tag:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Delete a tag
  const deleteTag = useCallback(async (tagId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: "DELETE",
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete tag");
      }

      // Remove the tag from the list
      setTags((prevTags) => prevTags.filter((tag) => tag.id !== tagId));
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete tag";
      setError(errorMessage);
      console.error("Failed to delete tag:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    tags,
    loading,
    error,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    refetch: fetchTags,
  };
}

// Category hook options
interface UseCategoriesOptions {
  parentId?: string;
  includeSystemCategories?: boolean;
  includeTagCount?: boolean;
  isActive?: boolean;
  hierarchical?: boolean;
  autoFetch?: boolean;
}

// Hook for managing categories
export function useCategories(options: UseCategoriesOptions = {}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    parentId,
    includeSystemCategories = true,
    includeTagCount = false,
    isActive,
    hierarchical = false,
    autoFetch = true,
  } = options;

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (parentId) params.set("parentId", parentId);
    if (includeSystemCategories) params.set("includeSystemCategories", "true");
    if (includeTagCount) params.set("includeTagCount", "true");
    if (isActive !== undefined) params.set("isActive", isActive.toString());
    if (hierarchical) params.set("hierarchical", "true");
    return params.toString();
  }, [
    parentId,
    includeSystemCategories,
    includeTagCount,
    isActive,
    hierarchical,
  ]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories?${queryParams}`);
      const data: ApiResponse<Category[]> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch categories");
      }

      setCategories(data.data || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch categories";
      setError(errorMessage);
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchCategories();
    }
  }, [fetchCategories, autoFetch]);

  // Create a new category
  const createCategory = useCallback(
    async (categoryData: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      parentId?: string;
    }) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/categories", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(categoryData),
        });

        const data: ApiResponse<Category> = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create category");
        }

        // Add the new category to the list
        setCategories((prevCategories) => [...prevCategories, data.data!]);
        return data.data!;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create category";
        setError(errorMessage);
        console.error("Failed to create category:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Update a category
  const updateCategory = useCallback(
    async (
      categoryId: string,
      updates: {
        name?: string;
        description?: string;
        color?: string;
        icon?: string;
        parentId?: string;
        isActive?: boolean;
      },
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/categories/${categoryId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        const data: ApiResponse<Category> = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update category");
        }

        // Update the category in the list
        setCategories((prevCategories) =>
          prevCategories.map((category) =>
            category.id === categoryId ? data.data! : category,
          ),
        );
        return data.data!;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update category";
        setError(errorMessage);
        console.error("Failed to update category:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Delete a category
  const deleteCategory = useCallback(async (categoryId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      // Remove the category from the list
      setCategories((prevCategories) =>
        prevCategories.filter((category) => category.id !== categoryId),
      );
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete category";
      setError(errorMessage);
      console.error("Failed to delete category:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: fetchCategories,
  };
}

// Resource tagging hook options
interface UseResourceTagsOptions {
  resourceId: string;
  resourceType: ResourceType;
  autoFetch?: boolean;
}

// Hook for managing resource tags
export function useResourceTags(options: UseResourceTagsOptions) {
  const [resourceTags, setResourceTags] = useState<ResourceTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { resourceId, resourceType, autoFetch = true } = options;

  // Fetch resource tags
  const fetchResourceTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/resources/${resourceType}/${resourceId}/tags`,
      );
      const data: ApiResponse<ResourceTag[]> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch resource tags");
      }

      setResourceTags(data.data || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch resource tags";
      setError(errorMessage);
      console.error("Failed to fetch resource tags:", err);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchResourceTags();
    }
  }, [fetchResourceTags, autoFetch]);

  // Add tags to resource
  const addTags = useCallback(
    async (tagIds: string[]) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/resources/${resourceType}/${resourceId}/tags`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tagIds }),
          },
        );

        const data: ApiResponse<ResourceTag[]> = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to add tags to resource");
        }

        // Refresh resource tags
        await fetchResourceTags();
        return data.data!;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to add tags to resource";
        setError(errorMessage);
        console.error("Failed to add tags to resource:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [resourceType, resourceId, fetchResourceTags],
  );

  // Remove tags from resource
  const removeTags = useCallback(
    async (tagIds: string[]) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/resources/${resourceType}/${resourceId}/tags`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tagIds }),
          },
        );

        const data: ApiResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to remove tags from resource");
        }

        // Refresh resource tags
        await fetchResourceTags();
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to remove tags from resource";
        setError(errorMessage);
        console.error("Failed to remove tags from resource:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [resourceType, resourceId, fetchResourceTags],
  );

  // Get just the tag objects (without ResourceTag wrapper)
  const tags = useMemo(() => {
    return resourceTags.map((rt) => rt.tag!).filter(Boolean);
  }, [resourceTags]);

  return {
    resourceTags,
    tags,
    loading,
    error,
    fetchResourceTags,
    addTags,
    removeTags,
    refetch: fetchResourceTags,
  };
}
