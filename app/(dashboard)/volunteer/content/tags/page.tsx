'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import HealthcareTagSelector from '@/components/content/healthcare-tag-selector';

function VolunteerContentTagSelector() {
  const { userId } = useAuth();
  const searchParams = useSearchParams();

  const returnUrl = searchParams.get('returnUrl') || '/volunteer/resources';
  const currentTags = searchParams.get('selectedTags')?.split(',').filter(Boolean) || [];

  if (!userId) {
    return <div>Please sign in to select tags.</div>;
  }

  return (
    <HealthcareTagSelector
      userRole="VOLUNTEER"
      currentTags={currentTags}
      returnUrl={decodeURIComponent(returnUrl)}
    />
  );
}

export default function VolunteerContentTagsPage() {
  return (
    <Suspense fallback={<div>Loading tag selector...</div>}>
      <VolunteerContentTagSelector />
    </Suspense>
  );
}