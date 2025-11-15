import Link from 'next/link'
import { UserForm } from '@/components/users/user-form'

export default function NewUserPage() {
  return (
    <div className="space-y-3">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/admin/users" className="hover:text-foreground">
          Users
        </Link>
        <span>/</span>
        <span>New User</span>
      </nav>

      {/* Main Content */}
      <div className="flex justify-center">
        <UserForm mode="create" />
      </div>
    </div>
  )
}