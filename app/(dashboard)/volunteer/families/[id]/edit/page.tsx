'use client'

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { FamilyForm } from '@/components/families/family-form';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Volunteer Family Edit Page
 *
 * Allows VOLUNTEER users to edit families they created:
 * - Edit family name and description
 * - Update family information
 * - Volunteers can only edit families they created
 */

interface FamilyData {
  id: string;
  name: string;
  description?: string;
}

export default function VolunteerFamilyEditPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const familyId = params.id as string;

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    const fetchFamily = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/families/${familyId}`);

        if (!response.ok) {
          if (response.status === 403) {
            // Permission denied - volunteer trying to edit family they didn't create
            router.push('/volunteer/families');
            return;
          }
          if (response.status === 404) {
            // Family not found
            router.push('/volunteer/families');
            return;
          }
          throw new Error('Failed to fetch family');
        }

        const data = await response.json();
        setFamily(data.family);
      } catch (err) {
        console.error('Error fetching family:', err);
        setError('Failed to load family. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchFamily();
  }, [isLoaded, isSignedIn, familyId, router]);

  if (!isLoaded || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Family not found</p>
        </div>
      </div>
    );
  }

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
        initialData={family}
      />
    </div>
  );
}