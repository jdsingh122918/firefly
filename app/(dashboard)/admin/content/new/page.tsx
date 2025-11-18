'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserRole, ContentType } from '@prisma/client';
import ContentCreationPage from '@/components/content/content-creation-page';
import { DatabaseErrorBoundary } from '@/components/errors/database-error-boundary';

/**
 * Admin Content Creation Page
 *
 * Dedicated page for creating new content (Notes or Resources) as an ADMIN:
 * - Full access to all content types and features
 * - Can create content for any family
 * - Access to all organizational tools
 * - Advanced feature configuration
 */

export default function AdminContentCreationPage() {
  const router = useRouter();
  const { userId, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const [families, setFamilies] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth and permission check
  useEffect(() => {
    if (!authLoaded) return;

    if (!userId) {
      router.push('/sign-in');
      return;
    }

    // Check if user is ADMIN
    const userRole = user?.publicMetadata?.role as UserRole | undefined;
    if (userRole !== UserRole.ADMIN) {
      router.push('/unauthorized');
      return;
    }
  }, [authLoaded, userId, user, router]);

  // Fetch data
  useEffect(() => {
    if (!authLoaded || !userId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch families and categories
        const [familiesResponse, categoriesResponse] = await Promise.all([
          fetch('/api/families?orderBy=name'),
          fetch('/api/categories?active=true&orderBy=name')
        ]);

        if (!familiesResponse.ok || !categoriesResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const [familiesData, categoriesData] = await Promise.all([
          familiesResponse.json(),
          categoriesResponse.json()
        ]);

        setFamilies(familiesData.families || []);

        // Transform categories to handle null vs undefined for color
        const transformedCategories = (categoriesData.categories || []).map((category: any) => ({
          ...category,
          color: category.color ?? undefined
        }));
        setCategories(transformedCategories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoaded, userId]);

  // Show loading state
  if (!authLoaded || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center text-red-600">Error: {error}</div>
      </div>
    );
  }

  const userRole = user?.publicMetadata?.role as UserRole;

  // Ensure userId is available before rendering
  if (!userId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">Loading authentication...</div>
      </div>
    );
  }

  return (
    <DatabaseErrorBoundary
      fallback={
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center text-red-600">
            <h2 className="text-xl font-semibold mb-2">Error Loading Content Creation</h2>
            <p>There was an error loading the content creation form. Please try refreshing the page.</p>
          </div>
        </div>
      }
    >
      <ContentCreationPage
        userRole={userRole}
        userId={userId}
        availableFamilies={families}
        availableCategories={categories}
        enableTypeSelection={true}
        defaultContentType={ContentType.NOTE} // Default to NOTE type
        showAdvancedFeatures={true}
        canManageCuration={true}
        backUrl="/admin/content"
      />
    </DatabaseErrorBoundary>
  );
}