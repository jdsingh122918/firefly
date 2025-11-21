'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import HealthcareTagSelector from '@/components/content/healthcare-tag-selector';

function MemberResourceTagSelector() {
  const { userId } = useAuth();
  const searchParams = useSearchParams();

  const returnUrl = searchParams.get('returnUrl') || '/member/resources';
  const currentTags = searchParams.get('selectedTags')?.split(',').filter(Boolean) || [];

  if (!userId) {
    return <div>Please sign in to select tags.</div>;
  }

  return (
    <HealthcareTagSelector
      userRole="MEMBER"
      currentTags={currentTags}
      returnUrl={decodeURIComponent(returnUrl)}
    />
  );
}

export default function MemberResourceTagsPage() {
  return (
    <Suspense fallback={<div>Loading tag selector...</div>}>
      <MemberResourceTagSelector />
    </Suspense>
  );
}