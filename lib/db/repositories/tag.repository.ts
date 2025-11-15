import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export enum ResourceType {
  DOCUMENT = "DOCUMENT",
  MESSAGE = "MESSAGE",
  FAMILY = "FAMILY",
  USER = "USER",
  NOTIFICATION = "NOTIFICATION",
  CARE_PLAN = "CARE_PLAN",
  ACTIVITY = "ACTIVITY",
}

export interface Tag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  categoryId?: string | null;
  familyId?: string | null;
  isSystemTag: boolean;
  isActive: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  category?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  createdByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  family?: {
    id: string;
    name: string;
  } | null;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  parentId?: string | null;
  familyId?: string | null;
  isSystemCategory: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  family?: {
    id: string;
    name: string;
  } | null;
  parent?: Category | null;
  children?: Category[];
  tags?: Tag[];
}

export interface ResourceTag {
  id: string;
  resourceId: string;
  resourceType: ResourceType;
  tagId: string;
  createdBy: string;
  createdAt: Date;
  tag?: Tag;
}

export interface CreateTagInput {
  name: string;
  description?: string;
  color?: string;
  familyId?: string;
  createdBy: string;
  isSystemTag?: boolean;
  categoryId?: string;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  familyId?: string;
  parentId?: string;
  createdBy: string;
  isSystemCategory?: boolean;
}

export interface UpdateTagInput {
  name?: string;
  description?: string;
  color?: string;
  categoryId?: string | null;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  isActive?: boolean;
}

export class TagRepository {
  /**
   * Create a new tag
   */
  async createTag(data: CreateTagInput): Promise<Tag> {
    try {
      // Check if tag with same name already exists for this family
      const existingTag = await prisma.tag.findFirst({
        where: {
          name: { equals: data.name, mode: Prisma.QueryMode.insensitive },
          familyId: data.familyId,
        },
      });

      if (existingTag) {
        throw new Error(
          `Tag "${data.name}" already exists for this family`,
        );
      }

      const tag = await prisma.tag.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim(),
          color: data.color,
          familyId: data.familyId,
          createdBy: data.createdBy,
          isSystemTag: data.isSystemTag || false,
          categoryId: data.categoryId,
          usageCount: 0,
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log("🏷️ Tag created:", {
        id: tag.id,
        name: tag.name,
        familyId: tag.familyId,
      });

      return tag as Tag;
    } catch (error) {
      console.error("❌ Failed to create tag:", error);
      throw error;
    }
  }

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryInput): Promise<Category> {
    try {
      // Check if category with same name already exists for this family/resourceType
      const existingCategory = await prisma.category.findFirst({
        where: {
          name: { equals: data.name, mode: Prisma.QueryMode.insensitive },
          familyId: data.familyId,
          parentId: data.parentId,
        },
      });

      if (existingCategory) {
        throw new Error(
          `Category "${data.name}" already exists in this location`,
        );
      }

      // Validate parent category exists and has same resource type
      if (data.parentId) {
        const parentCategory = await prisma.category.findUnique({
          where: { id: data.parentId },
        });

        if (!parentCategory) {
          throw new Error("Parent category not found");
        }

        // NOTE: resourceType field doesn't exist in schema - disabled check
        // if (parentCategory.resourceType !== data.resourceType) {
        //   throw new Error("Parent category must have the same resource type");
        // }
      }

      const category = await prisma.category.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim(),
          color: data.color,
          icon: data.icon,
          familyId: data.familyId,
          parentId: data.parentId,
          createdBy: data.createdBy,
          isSystemCategory: data.isSystemCategory || false,
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          parent: true,
        },
      });

      console.log("📁 Category created:", {
        id: category.id,
        name: category.name,
        // resourceType: category.resourceType, // Field doesn't exist in schema
        parentId: category.parentId,
      });

      return category as Category;
    } catch (error) {
      console.error("❌ Failed to create category:", error);
      throw error;
    }
  }

  /**
   * Get tags with filtering
   */
  async getTags(
    filters: {
      familyId?: string;
      search?: string;
      isSystem?: boolean;
      minUsageCount?: number;
    } = {},
    options: {
      includeCategory?: boolean;
      includeUsageCount?: boolean;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
  ): Promise<Tag[]> {
    try {
      const where: Prisma.TagWhereInput = {};

      // if (filters.resourceType) where.resourceType = filters.resourceType; // Field doesn't exist in schema
      if (filters.familyId) where.familyId = filters.familyId;
      if (filters.isSystem !== undefined) where.isSystemTag = filters.isSystem;
      if (filters.minUsageCount !== undefined) {
        where.usageCount = { gte: filters.minUsageCount };
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        ];
      }

      // Build include object based on options
      const include: {
        createdByUser: {
          select: {
            id: boolean;
            firstName: boolean;
            lastName: boolean;
            email: boolean;
          };
        };
        family: {
          select: {
            id: boolean;
            name: boolean;
          };
        };
        category?: boolean;
      } = {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
          },
        },
      };

      if (options.includeCategory) {
        include.category = true;
      }

      // Build orderBy based on options
      const orderBy: Array<Record<string, string>> = [];
      if (options.sortBy) {
        orderBy.push({ [options.sortBy]: options.sortOrder || "asc" });
      } else {
        orderBy.push({ usageCount: "desc" }, { name: "asc" });
      }

      const tags = await prisma.tag.findMany({
        where,
        include,
        orderBy,
      });

      return tags as Tag[];
    } catch (error) {
      console.error("❌ Failed to get tags:", error);
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(
    id: string,
    options: {
      includeTags?: boolean;
      includeChildren?: boolean;
    } = {},
  ): Promise<Category | null> {
    try {
      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          tags: options.includeTags || false,
          children: options.includeChildren || false,
          parent: true,
        },
      });

      return category as Category | null;
    } catch (error) {
      console.error("❌ Failed to get category by ID:", error);
      throw error;
    }
  }

  /**
   * Check if setting a parent would create a circular reference
   */
  async wouldCreateCircularReference(
    categoryId: string,
    newParentId: string,
  ): Promise<boolean> {
    try {
      // Can't set a category as its own parent
      if (categoryId === newParentId) {
        return true;
      }

      // Check if the new parent is a descendant of the current category
      const checkDescendant = async (parentId: string): Promise<boolean> => {
        if (parentId === categoryId) {
          return true;
        }

        const parent = await prisma.category.findUnique({
          where: { id: parentId },
          select: { parentId: true },
        });

        if (parent?.parentId) {
          return checkDescendant(parent.parentId);
        }

        return false;
      };

      return await checkDescendant(newParentId);
    } catch (error) {
      console.error("❌ Failed to check circular reference:", error);
      throw error;
    }
  }

  /**
   * Get the depth of a category in the hierarchy
   */
  async getCategoryDepth(categoryId: string): Promise<number> {
    try {
      let depth = 0;
      let currentId: string | null = categoryId;

      while (currentId) {
        const category: { parentId: string | null } | null = await prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });

        if (category?.parentId) {
          depth++;
          currentId = category.parentId;
        } else {
          currentId = null;
        }
      }

      return depth;
    } catch (error) {
      console.error("❌ Failed to get category depth:", error);
      throw error;
    }
  }

  /**
   * Check if a category has child categories
   */
  async categoryHasChildren(categoryId: string): Promise<boolean> {
    try {
      const childCount = await prisma.category.count({
        where: { parentId: categoryId },
      });
      return childCount > 0;
    } catch (error) {
      console.error("❌ Failed to check category children:", error);
      throw error;
    }
  }

  /**
   * Get count of tags in a category
   */
  async getCategoryTagCount(categoryId: string): Promise<number> {
    try {
      const tagCount = await prisma.tag.count({
        where: { categoryId },
      });
      return tagCount;
    } catch (error) {
      console.error("❌ Failed to get category tag count:", error);
      throw error;
    }
  }

  /**
   * Get tag by ID
   */
  async getTagById(id: string): Promise<Tag | null> {
    try {
      const tag = await prisma.tag.findUnique({
        where: { id },
        include: {
          category: true,
        },
      });
      return tag as Tag | null;
    } catch (error) {
      console.error("❌ Failed to get tag by ID:", error);
      throw error;
    }
  }

  /**
   * Get categories with hierarchical structure
   */
  async getCategoriesHierarchy(
    filters: {
      familyId?: string;
      search?: string;
      isSystem?: boolean;
    } = {},
    options: {
      includeTagCount?: boolean;
    } = {},
  ): Promise<Category[]> {
    try {
      // Get all matching categories
      const categories = await this.getCategories(filters);

      // Build hierarchy
      const rootCategories: Category[] = [];
      const categoryMap = new Map<string, Category>();

      // First pass: create map
      categories.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] });
      });

      // Second pass: build tree
      categories.forEach(cat => {
        const category = categoryMap.get(cat.id)!;
        if (!cat.parentId) {
          rootCategories.push(category);
        } else {
          const parent = categoryMap.get(cat.parentId);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(category);
          }
        }
      });

      // Add tag counts if requested
      if (options.includeTagCount) {
        for (const cat of categoryMap.values()) {
          const tagCount = await this.getCategoryTagCount(cat.id);
          Object.assign(cat, { tagCount });
        }
      }

      return rootCategories;
    } catch (error) {
      console.error("❌ Failed to get categories hierarchy:", error);
      throw error;
    }
  }

  /**
   * Get categories with hierarchical structure
   */
  async getCategories(
    filters: {
      familyId?: string;
      parentId?: string | null;
      search?: string;
      isSystem?: boolean;
    } = {},
  ): Promise<Category[]> {
    try {
      const where: Prisma.CategoryWhereInput = {};

      // if (filters.resourceType) where.resourceType = filters.resourceType; // Field doesn't exist in schema
      if (filters.familyId) where.familyId = filters.familyId;
      if (filters.parentId !== undefined) where.parentId = filters.parentId;
      if (filters.isSystem !== undefined) where.isSystemCategory = filters.isSystem;

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        ];
      }

      const categories = await prisma.category.findMany({
        where,
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          parent: true,
          children: {
            // orderBy: { sortOrder: "asc" }, // Field doesn't exist in schema
          },
        },
        // orderBy: { sortOrder: "asc" }, // Field doesn't exist in schema
      });

      return categories as Category[];
    } catch (error) {
      console.error("❌ Failed to get categories:", error);
      throw error;
    }
  }

  /**
   * Tag a resource
   */
  async tagResource(
    resourceId: string,
    resourceType: ResourceType,
    tagId: string,
    createdBy: string,
  ): Promise<ResourceTag> {
    try {
      // Check if resource is already tagged with this tag
      const existingTag = await prisma.resourceTag.findFirst({
        where: {
          resourceId,
          resourceType,
          tagId,
        },
      });

      if (existingTag) {
        throw new Error("Resource is already tagged with this tag");
      }

      // Create resource tag
      const resourceTag = await prisma.resourceTag.create({
        data: {
          resourceId,
          resourceType,
          tagId,
          createdBy,
        },
        include: {
          tag: {
            include: {
              createdByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Increment tag usage count
      await prisma.tag.update({
        where: { id: tagId },
        data: { usageCount: { increment: 1 } },
      });

      console.log("🏷️ Resource tagged:", {
        resourceId,
        resourceType,
        tagId,
      });

      return resourceTag as ResourceTag;
    } catch (error) {
      console.error("❌ Failed to tag resource:", error);
      throw error;
    }
  }

  /**
   * Remove tag from resource
   */
  async untagResource(
    resourceId: string,
    resourceType: ResourceType,
    tagId: string,
  ): Promise<void> {
    try {
      const deletedTag = await prisma.resourceTag.deleteMany({
        where: {
          resourceId,
          resourceType,
          tagId,
        },
      });

      if (deletedTag.count > 0) {
        // Decrement tag usage count
        await prisma.tag.update({
          where: { id: tagId },
          data: { usageCount: { decrement: 1 } },
        });

        console.log("🏷️ Resource untagged:", {
          resourceId,
          resourceType,
          tagId,
        });
      }
    } catch (error) {
      console.error("❌ Failed to untag resource:", error);
      throw error;
    }
  }

  /**
   * Get tags for a specific resource
   */
  async getResourceTags(
    resourceId: string,
    resourceType: ResourceType,
  ): Promise<ResourceTag[]> {
    try {
      const resourceTags = await prisma.resourceTag.findMany({
        where: {
          resourceId,
          resourceType,
        },
        include: {
          tag: {
            include: {
              createdByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          tag: { name: "asc" },
        },
      });

      return resourceTags as ResourceTag[];
    } catch (error) {
      console.error("❌ Failed to get resource tags:", error);
      throw error;
    }
  }

  /**
   * Get resources by tag
   */
  async getResourcesByTag(
    tagId: string,
    resourceType?: ResourceType,
  ): Promise<ResourceTag[]> {
    try {
      const where: Record<string, unknown> = { tagId };
      if (resourceType) where.resourceType = resourceType;

      const resourceTags = await prisma.resourceTag.findMany({
        where,
        include: {
          tag: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return resourceTags as ResourceTag[];
    } catch (error) {
      console.error("❌ Failed to get resources by tag:", error);
      throw error;
    }
  }

  /**
   * Update tag
   */
  async updateTag(id: string, data: UpdateTagInput): Promise<Tag> {
    try {
      const tag = await prisma.tag.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name.trim() }),
          ...(data.description !== undefined && {
            description: data.description?.trim(),
          }),
          ...(data.color && { color: data.color }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          updatedAt: new Date(),
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log("🏷️ Tag updated:", { id, changes: Object.keys(data) });

      return tag as Tag;
    } catch (error) {
      console.error("❌ Failed to update tag:", error);
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    data: UpdateCategoryInput,
  ): Promise<Category> {
    try {
      const category = await prisma.category.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name.trim() }),
          ...(data.description !== undefined && {
            description: data.description?.trim(),
          }),
          ...(data.color && { color: data.color }),
          ...(data.icon && { icon: data.icon }),
          ...(data.parentId !== undefined && { parentId: data.parentId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          updatedAt: new Date(),
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          parent: true,
          children: {
            // orderBy: { sortOrder: "asc" }, // Field doesn't exist in schema
          },
        },
      });

      console.log("📁 Category updated:", { id, changes: Object.keys(data) });

      return category as Category;
    } catch (error) {
      console.error("❌ Failed to update category:", error);
      throw error;
    }
  }

  /**
   * Get tag usage count
   */
  async getTagUsageCount(tagId: string): Promise<number> {
    try {
      const count = await prisma.resourceTag.count({
        where: { tagId },
      });
      return count;
    } catch (error) {
      console.error("❌ Failed to get tag usage count:", error);
      throw error;
    }
  }

  /**
   * Delete tag and all its resource associations
   */
  async deleteTag(id: string): Promise<void> {
    try {
      // Delete all resource tags first
      await prisma.resourceTag.deleteMany({
        where: { tagId: id },
      });

      // Delete the tag
      await prisma.tag.delete({
        where: { id },
      });

      console.log("🗑️ Tag deleted:", id);
    } catch (error) {
      console.error("❌ Failed to delete tag:", error);
      throw error;
    }
  }

  /**
   * Delete category and optionally reassign children
   */
  async deleteCategory(
    id: string,
    reassignChildrenToParent = true,
  ): Promise<void> {
    try {
      const category = await prisma.category.findUnique({
        where: { id },
        include: { children: true },
      });

      if (!category) {
        throw new Error("Category not found");
      }

      if (reassignChildrenToParent && category.children.length > 0) {
        // Reassign children to this category's parent
        await prisma.category.updateMany({
          where: { parentId: id },
          data: { parentId: category.parentId },
        });
      }

      // Delete the category
      await prisma.category.delete({
        where: { id },
      });

      console.log("🗑️ Category deleted:", id);
    } catch (error) {
      console.error("❌ Failed to delete category:", error);
      throw error;
    }
  }

  /**
   * Get tag and category statistics
   */
  async getTaggingStats(
    filters: {
      familyId?: string;
    } = {},
  ): Promise<{
    totalTags: number;
    totalCategories: number;
    totalResourceTags: number;
    mostUsedTags: Array<{ tag: Tag; usageCount: number }>;
    tagsByResourceType: Record<ResourceType, number>;
    categoriesByResourceType: Record<ResourceType, number>;
  }> {
    try {
      const where: Record<string, unknown> = {};
      // if (filters.resourceType) where.resourceType = filters.resourceType; // Field doesn't exist in schema
      if (filters.familyId) where.familyId = filters.familyId;

      const [tags, categories, resourceTags] = await Promise.all([
        prisma.tag.findMany({ where }),
        prisma.category.findMany({ where }),
        prisma.resourceTag.findMany(),
      ]);

      // Calculate statistics
      const stats = {
        totalTags: tags.length,
        totalCategories: categories.length,
        totalResourceTags: resourceTags.length,
        mostUsedTags: tags
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 10)
          .map((tag) => ({ tag: tag as Tag, usageCount: tag.usageCount })),
        tagsByResourceType: {} as Record<ResourceType, number>,
        categoriesByResourceType: {} as Record<ResourceType, number>,
      };

      // Initialize counters
      Object.values(ResourceType).forEach((type) => {
        stats.tagsByResourceType[type] = 0;
        stats.categoriesByResourceType[type] = 0;
      });

      // Count by resource type - DISABLED: resourceType field doesn't exist in schema
      // tags.forEach((tag) => {
      //   stats.tagsByResourceType[tag.resourceType]++;
      // });

      // categories.forEach((category) => {
      //   stats.categoriesByResourceType[category.resourceType]++;
      // });

      return stats;
    } catch (error) {
      console.error("❌ Failed to get tagging statistics:", error);
      throw error;
    }
  }

  /**
   * Bulk create categories - for seeding system categories
   */
  async createManyCategories(categories: CreateCategoryInput[]): Promise<Category[]> {
    try {
      const createdCategories: Category[] = [];

      // Create categories one by one to ensure proper validation and relationships
      for (const categoryData of categories) {
        try {
          // Check if category already exists
          const existingCategory = await prisma.category.findFirst({
            where: {
              name: { equals: categoryData.name, mode: Prisma.QueryMode.insensitive },
              familyId: categoryData.familyId,
              isSystemCategory: categoryData.isSystemCategory
            }
          });

          if (!existingCategory) {
            const category = await this.createCategory(categoryData);
            createdCategories.push(category);
            console.log(`✅ Created category: ${category.name}`);
          } else {
            console.log(`⏭️ Category already exists: ${categoryData.name}`);
            createdCategories.push(existingCategory as Category);
          }
        } catch (error) {
          console.error(`❌ Failed to create category "${categoryData.name}":`, error);
          // Continue with other categories
        }
      }

      return createdCategories;
    } catch (error) {
      console.error("❌ Failed to bulk create categories:", error);
      throw error;
    }
  }

  /**
   * Bulk create tags - for seeding system tags
   */
  async createManyTags(tags: CreateTagInput[]): Promise<Tag[]> {
    try {
      const createdTags: Tag[] = [];

      // Create tags one by one to ensure proper validation
      for (const tagData of tags) {
        try {
          // Check if tag already exists
          const existingTag = await prisma.tag.findFirst({
            where: {
              name: { equals: tagData.name, mode: Prisma.QueryMode.insensitive },
              familyId: tagData.familyId,
              isSystemTag: tagData.isSystemTag
            }
          });

          if (!existingTag) {
            const tag = await this.createTag(tagData);
            createdTags.push(tag);
            console.log(`✅ Created tag: ${tag.name}`);
          } else {
            console.log(`⏭️ Tag already exists: ${tagData.name}`);
            createdTags.push(existingTag as Tag);
          }
        } catch (error) {
          console.error(`❌ Failed to create tag "${tagData.name}":`, error);
          // Continue with other tags
        }
      }

      return createdTags;
    } catch (error) {
      console.error("❌ Failed to bulk create tags:", error);
      throw error;
    }
  }

  /**
   * Initialize healthcare system tags and categories
   */
  async initializeHealthcareTags(systemUserId: string): Promise<{
    categories: Category[];
    tags: Tag[];
  }> {
    try {
      console.log("🏥 Initializing healthcare system tags...");

      // Import healthcare data
      const { HEALTHCARE_CATEGORIES } = await import("@/lib/data/healthcare-tags");

      // Create system categories first
      const categoryInputs: CreateCategoryInput[] = HEALTHCARE_CATEGORIES.map(cat => ({
        name: cat.name,
        description: cat.description,
        color: cat.color,
        icon: cat.icon,
        createdBy: systemUserId,
        isSystemCategory: true,
        // No familyId for system categories (global)
      }));

      const categories = await this.createManyCategories(categoryInputs);

      // Create a map of category name to category for tag creation
      const categoryMap = new Map<string, Category>();
      categories.forEach(cat => categoryMap.set(cat.name, cat));

      // Create system tags
      const tagInputs: CreateTagInput[] = [];

      HEALTHCARE_CATEGORIES.forEach(categoryConfig => {
        const category = categoryMap.get(categoryConfig.name);

        categoryConfig.tags.forEach(tagName => {
          tagInputs.push({
            name: tagName,
            description: `Healthcare service: ${tagName}`,
            color: categoryConfig.color,
            categoryId: category?.id,
            createdBy: systemUserId,
            isSystemTag: true,
            // No familyId for system tags (global)
          });
        });
      });

      const tags = await this.createManyTags(tagInputs);

      console.log(`🏥 Healthcare system initialization complete:`);
      console.log(`   📁 Categories: ${categories.length}`);
      console.log(`   🏷️ Tags: ${tags.length}`);

      return { categories, tags };
    } catch (error) {
      console.error("❌ Failed to initialize healthcare tags:", error);
      throw error;
    }
  }
}
