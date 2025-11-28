'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Filter,
  Search,
  FileText,
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { ResourceType, UserRole } from '@prisma/client';
import ContentCard from './content-card';
import HealthcareContentFilters, { type HealthcareContentFiltersState } from './healthcare-content-filters';
import { useToast } from '@/hooks/use-toast';

/**
 * Content Hub Page Component
 *
 * Main interface for the unified content system that provides:
 * - Unified content view (Notes and Resources combined)
 * - Advanced filtering and search
 * - Content creation and management
 * - Role-based feature access
 * - Assignment system integration (via dedicated Assignments page)
 * - Curation workflow (for admins)
 */

export interface ContentHubPageProps {
  userRole: UserRole;
  userId: string;
  availableFamilies: Array<{ id: string; name: string }>;
  availableCategories: Array<{ id: string; name: string; color?: string }>;

  // Page configuration
  title: string;
  description: string;
  showCurationQueue: boolean;
  showAllContent: boolean;
  enableContentCreation: boolean;
  enableCurationWorkflow: boolean;
}

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  resourceType: ResourceType;
  visibility: string;
  status?: string;
  viewCount: number;
  downloadCount?: number;
  shareCount?: number;
  rating?: number;
  ratingCount?: number;
  hasCuration?: boolean;
  hasRatings?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  isVerified?: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  creator?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  family?: {
    id: string;
    name: string;
  };
  category?: {
    id: string;
    name: string;
    color?: string;
  };
  documents?: Array<{
    id: string;
    document: {
      id: string;
      title: string;
      type: string;
      fileSize?: number;
    };
  }>;
}

const ContentHubPage: React.FC<ContentHubPageProps> = ({
  userRole,
  userId,
  availableFamilies,
  availableCategories,
  title,
  description,
  showCurationQueue,
  showAllContent,
  enableContentCreation,
  enableCurationWorkflow
}) => {
  const router = useRouter();

  // State management
  const [content, setContent] = useState<ContentItem[]>([]);
  const [filteredContent, setFilteredContent] = useState<ContentItem[]>([]);
  const [curationQueue, setCurationQueue] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Content filters
  const [filters, setFilters] = useState<HealthcareContentFiltersState>({
    healthcareTags: [],
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const { toast } = useToast();

  // Fetch content data
  const fetchContent = useCallback(async () => {
    if (error) return; // Don't retry if there's a persistent error

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        includeCreator: 'true',
        includeFamily: 'true',
        includeCategory: 'true',
        includeDocuments: 'true',
        includeRatings: 'true',
        sortBy: filters.sortBy || 'createdAt',
        sortOrder: filters.sortOrder || 'desc',
        ...(searchTerm && { search: searchTerm })
      });

      // Note: Content type filter removed - everything is now unified as resources
      if (filters.resourceType?.length) {
        params.set('resourceType', filters.resourceType.join(','));
      }
      if (filters.visibility?.length) {
        params.set('visibility', filters.visibility.join(','));
      }
      if (filters.healthcareCategories?.length) {
        params.set('healthcareCategories', filters.healthcareCategories.join(','));
      }
      if (filters.healthcareTags?.length) {
        params.set('healthcareTags', filters.healthcareTags.join(','));
      }
      if (filters.familyId) {
        params.set('familyId', filters.familyId);
      }
      if (filters.categoryId) {
        params.set('categoryId', filters.categoryId);
      }
      if (filters.hasCuration !== undefined) {
        params.set('hasCuration', String(filters.hasCuration));
      }
      if (filters.hasRatings !== undefined) {
        params.set('hasRatings', String(filters.hasRatings));
      }
      if (filters.isPinned !== undefined) {
        params.set('isPinned', String(filters.isPinned));
      }
      if (filters.isVerified !== undefined) {
        params.set('isVerified', String(filters.isVerified));
      }
      if (filters.minRating) {
        params.set('minRating', String(filters.minRating));
      }
      if (filters.search && filters.search !== searchTerm) {
        params.set('search', filters.search);
      }

      // Include documents to show attachments in content cards
      params.set('includeDocuments', 'true');
      params.set('includeCreator', 'true');
      params.set('includeFamily', 'true');
      params.set('includeCategory', 'true');

      const response = await fetch(`/api/resources?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      if (data.resources) {
        console.log('🔍 ContentHub API Response:', {
          totalItems: data.resources?.length,
          firstItem: data.resources?.[0],
          itemsWithDocuments: data.resources?.filter((item: any) => item.documents?.length > 0).length,
          sampleDocuments: data.resources?.find((item: any) => item.documents?.length > 0)?.documents
        });

        const items = data.resources.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt).toISOString(),
          updatedAt: new Date(item.updatedAt).toISOString()
        }));
        setContent(items);
        setFilteredContent(items);
      } else {
        setError(data.error || 'Failed to load content');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load content';
      setError(errorMessage);
      console.error('Error fetching content:', error);
      // Only show toast once to prevent spam
      if (!error) {
        toast({
          title: 'Error',
          description: 'Failed to load content. Please refresh the page.',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, sortBy, sortOrder, filters, error]);

  // Fetch curation queue for admins
  const fetchCurationQueue = useCallback(async () => {
    if (!showCurationQueue) return;

    try {
      const response = await fetch('/api/resources?hasCuration=true&status=PENDING&includeDocuments=true&includeCreator=true&includeFamily=true&includeCategory=true', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCurationQueue(data.data.content || []);
        } else {
          console.error('Curation queue API error:', data.error);
          setCurationQueue([]);
        }
      } else {
        console.error('Curation queue fetch failed:', response.status, response.statusText);
        setCurationQueue([]);
      }
    } catch (error) {
      console.error('Error fetching curation queue:', error);
      setCurationQueue([]);
    }
  }, [showCurationQueue]);

  // Set filtered content directly from content
  useEffect(() => {
    setFilteredContent(content);
  }, [content]);

  // Initial data fetch - only run once on mount
  useEffect(() => {
    fetchContent();
    fetchCurationQueue();
  }, []); // Empty dependency array to run only once

  // Re-fetch when filters change
  useEffect(() => {
    if (!isLoading && !error) { // Only re-fetch if not currently loading or in error state
      fetchContent();
    }
  }, [searchTerm, sortBy, sortOrder, filters]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContent();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchContent]);

  // Navigation actions
  const handleCreateContent = () => {
    const rolePrefix = userRole.toLowerCase();
    router.push(`/${rolePrefix}/content/new`);
  };

  const handleContentView = (contentId: string) => {
    // Navigate to content detail page
    window.location.href = `/${userRole.toLowerCase()}/content/${contentId}`;
  };

  const handleContentEdit = (contentId: string) => {
    // Navigate to content edit page
    window.location.href = `/${userRole.toLowerCase()}/content/${contentId}/edit`;
  };

  const handleContentDelete = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const response = await fetch(`/api/resources/${contentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to delete content');

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Content deleted successfully'
        });
        await fetchContent();
      }
    } catch (error) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete content',
        variant: 'destructive'
      });
    }
  };

  const handleContentApprove = async (contentId: string) => {
    try {
      const response = await fetch(`/api/resources/${contentId}/approve`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to approve content');

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Content approved successfully'
        });
        await fetchContent();
        await fetchCurationQueue();
      }
    } catch (error) {
      console.error('Error approving content:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve content',
        variant: 'destructive'
      });
    }
  };

  const handleContentFeature = async (contentId: string) => {
    try {
      const response = await fetch(`/api/resources/${contentId}/feature`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to feature content');

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Content featured successfully'
        });
        await fetchContent();
      }
    } catch (error) {
      console.error('Error featuring content:', error);
      toast({
        title: 'Error',
        description: 'Failed to feature content',
        variant: 'destructive'
      });
    }
  };


  const renderCurationQueue = () => {
    if (!showCurationQueue || curationQueue.length === 0) return null;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Curation Queue
            <Badge variant="secondary">{curationQueue.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {curationQueue.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-gray-500">
                    <Star className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-gray-600">
                      {item.creator?.firstName} {item.creator?.lastName} • {item.resourceType}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleContentApprove(item.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleContentView(item.id)}
                  >
                    Review
                  </Button>
                </div>
              </div>
            ))}
            {curationQueue.length > 3 && (
              <Button variant="outline" className="w-full">
                View all {curationQueue.length} pending items
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderToolbar = () => (
    <div className="space-y-3">
      {/* Compact Search and Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search content and tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sort Controls */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[140px]" suppressHydrationWarning>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Date Created</SelectItem>
            <SelectItem value="updatedAt">Last Updated</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="rating">Rating</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          className="min-h-[44px]"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </Button>

        {/* Advanced Filters Toggle */}
        <Button
          variant="outline"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="flex items-center gap-2 min-h-[44px]"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {((filters.healthcareTags && filters.healthcareTags.length > 0) || filters.visibility?.length || filters.familyId || filters.categoryId) && (
            <Badge variant="secondary" className="ml-1">
              Active
            </Badge>
          )}
        </Button>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchContent}
            disabled={isLoading}
            className="min-h-[44px]"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {enableContentCreation && (
            <Button
              onClick={handleCreateContent}
              className="flex items-center gap-2 min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const renderContentGrid = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="text-red-600 text-center mb-4">
            <p className="font-medium">Failed to load content</p>
            <p className="text-sm text-gray-600 mt-1">{error}</p>
          </div>
          <Button
            onClick={() => {
              setError(null);
              fetchContent();
            }}
            variant="outline"
          >
            Retry
          </Button>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded mb-4"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </Card>
          ))}
        </div>
      );
    }

    if (filteredContent.length === 0) {
      return (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm
              ? 'Try adjusting your search terms or filters.'
              : 'Create your first piece of content to get started.'
            }
          </p>
          {enableContentCreation && !searchTerm && (
            <Button onClick={handleCreateContent}>
              <Plus className="h-4 w-4 mr-2" />
              Create Content
            </Button>
          )}
        </Card>
      );
    }

    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr max-w-7xl mx-auto">
        {filteredContent.map((item) => (
          <div key={item.id} className="min-w-0">
            <ContentCard
              content={{
                ...item,
                createdAt: new Date(item.createdAt),
                updatedAt: new Date(item.updatedAt)
              } as any}
              showRatings={true}
              showCuration={true}
              showDocuments={true}
              onView={handleContentView}
              onEdit={handleContentEdit}
              onDelete={handleContentDelete}
              onApprove={enableCurationWorkflow ? handleContentApprove : undefined}
              onFeature={enableCurationWorkflow ? handleContentFeature : undefined}
              userRole={userRole}
              canEdit={true}
              canDelete={userRole === UserRole.ADMIN || item.creator?.id === userId}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      {/* Curation Queue */}
      {renderCurationQueue()}

      {/* Main Content Area with Sidebar */}
      <div className={`flex gap-6 ${isFiltersOpen ? 'flex-col lg:flex-row' : ''}`}>
        {/* Healthcare Filters Sidebar */}
        {isFiltersOpen && (
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <HealthcareContentFilters
              filters={filters}
              availableFamilies={availableFamilies}
              availableCategories={availableCategories}
              onFiltersChange={(newFilters) => setFilters(newFilters)}
              onReset={() => setFilters({ healthcareTags: [], sortBy: 'createdAt', sortOrder: 'desc' })}
              showAdvanced={true}
            />
          </div>
        )}

        {/* Content Management */}
        <div className="flex-1 space-y-6 min-w-0 overflow-hidden">
          {renderToolbar()}
          {renderContentGrid()}
        </div>
      </div>

    </div>
  );
};

export default ContentHubPage;