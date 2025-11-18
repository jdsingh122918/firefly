'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserRole } from '@prisma/client';
import { UserForm } from '@/components/users/user-form';

/**
 * Admin User Edit Page
 *
 * Allows ADMIN users to edit user details:
 * - Edit user profile information
 * - Modify role assignments
 * - Update family associations
 * - Change contact information
 */

interface AdminUserEditPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminUserEditPage({ params }: AdminUserEditPageProps) {
  const router = useRouter();
  const { userId, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const [userToEdit, setUserToEdit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId_param, setUserId_param] = useState<string | null>(null);

  // Extract id from params
  useEffect(() => {
    params.then(({ id }) => setUserId_param(id));
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

  // Fetch user data
  useEffect(() => {
    if (!userId_param || !authLoaded || !userId) return;

    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${userId_param}`);

        if (!response.ok) {
          if (response.status === 404) {
            router.push('/admin/users');
            return;
          }
          throw new Error('Failed to fetch user');
        }

        const userData = await response.json();
        setUserToEdit(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId_param, authLoaded, userId, router]);

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

  // Show user not found
  if (!userToEdit) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">User not found</div>
      </div>
    );
  }

  // Transform the user data for the form
  const initialData = {
    id: userToEdit.id,
    email: userToEdit.email,
    firstName: userToEdit.firstName || undefined,
    lastName: userToEdit.lastName || undefined,
    role: userToEdit.role,
    familyId: userToEdit.familyId || undefined,
    phoneNumber: userToEdit.phoneNumber || undefined,
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Edit User</h1>
        <p className="text-muted-foreground mt-1">
          Update user information and settings
        </p>
      </div>

      <UserForm
        mode="edit"
        initialData={initialData}
      />
    </div>
  );
}