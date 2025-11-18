'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserRole, ContentType } from '@prisma/client';
import ContentCreationPage from '@/components/content/content-creation-page';
import { DatabaseErrorBoundary } from '@/components/errors/database-error-boundary';

/**
 * Member Content Creation Page
 *
 * Dedicated page for creating new content (Notes or Resources) as a MEMBER:
 * - Can create content for their own family
 * - Basic feature set
 * - Resources require curation by default
 * - Simple assignment management within family scope
 */

export default function MemberContentCreationPage() {
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

    // Check if user is MEMBER
    const userRole = user?.publicMetadata?.role as UserRole | undefined;
    if (userRole !== UserRole.MEMBER) {
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

        // Fetch user's family and categories
        const [userResponse, categoriesResponse] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/categories?active=true&orderBy=name')
        ]);

        if (!userResponse.ok || !categoriesResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const [userData, categoriesData] = await Promise.all([
          userResponse.json(),
          categoriesResponse.json()
        ]);

        // Set families (just the user's family)
        const userFamilies = userData.user?.family ? [userData.user.family] : [];
        setFamilies(userFamilies);

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
        showAdvancedFeatures={false}
        canManageCuration={false}
        backUrl="/member/content"
      />
    </DatabaseErrorBoundary>
  );
}