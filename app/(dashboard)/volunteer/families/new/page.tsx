import Link from 'next/link'
import { FamilyForm } from '@/components/families/family-form'

export default function NewFamilyPage() {
  return (
    <div className="space-y-3">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/volunteer/families" className="hover:text-foreground">
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