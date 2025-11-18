'use client';

import Link from 'next/link'
import { FamilyForm } from '@/components/families/family-form'

export default function NewFamilyPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/admin/families" className="hover:text-foreground">
          Families
        </Link>
        <span>/</span>
        <span>New Family</span>
      </nav>

      {/* Main Content */}
      <div className="flex justify-center">
        <FamilyForm mode="create" />
      </div>
    </div>
  )
}