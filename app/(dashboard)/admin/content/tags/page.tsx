'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import HealthcareTagSelector from '@/components/content/healthcare-tag-selector';

function AdminContentTagSelector() {
  const { userId } = useAuth();
  const searchParams = useSearchParams();

  const returnUrl = searchParams.get('returnUrl') || '/admin/resources';
  const currentTags = searchParams.get('selectedTags')?.split(',').filter(Boolean) || [];

  if (!userId) {
    return <div>Please sign in to select tags.</div>;
  }

  return (
    <HealthcareTagSelector
      userRole="ADMIN"
      currentTags={currentTags}
      returnUrl={decodeURIComponent(returnUrl)}
    />
  );
}

export default function AdminContentTagsPage() {
  return (
    <Suspense fallback={<div>Loading tag selector...</div>}>
      <AdminContentTagSelector />
    </Suspense>
  );
}