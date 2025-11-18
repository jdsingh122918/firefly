'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserRole } from '@prisma/client';
import { FamilyForm } from '@/components/families/family-form';

/**
 * Admin Family Edit Page
 *
 * Allows ADMIN users to edit family details:
 * - Edit family name and description
 * - Update family information
 * - Manage family settings
 */

interface AdminFamilyEditPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminFamilyEditPage({ params }: AdminFamilyEditPageProps) {
  const router = useRouter();
  const { userId, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const [familyToEdit, setFamilyToEdit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [familyId_param, setFamilyId_param] = useState<string | null>(null);

  // Extract id from params
  useEffect(() => {
    params.then(({ id }) => setFamilyId_param(id));
  }, [params]);

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

  // Fetch family data
  useEffect(() => {
    if (!familyId_param || !authLoaded || !userId) return;

    const fetchFamilyData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/families/${familyId_param}`);

        if (!response.ok) {
          if (response.status === 404) {
            router.push('/admin/families');
            return;
          }
          throw new Error('Failed to fetch family');
        }

        const familyData = await response.json();
        setFamilyToEdit(familyData.family);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchFamilyData();
  }, [familyId_param, authLoaded, userId, router]);

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

  // Show family not found
  if (!familyToEdit) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">Family not found</div>
      </div>
    );
  }

  // Transform the family data for the form
  const initialData = {
    id: familyToEdit.id,
    name: familyToEdit.name,
    description: familyToEdit.description || undefined,
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Edit Family</h1>
        <p className="text-muted-foreground mt-1">
          Update family information and details
        </p>
      </div>

      <FamilyForm
        mode="edit"
        initialData={initialData}
      />
    </div>
  );
}