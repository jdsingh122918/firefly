import { ForumCreationPage } from '@/components/forums/forum-creation-page'

export default function VolunteerForumCreationPage() {
  return <ForumCreationPage />
}

export async function generateMetadata() {
  return {
    title: 'Create New Forum | Firefly Volunteer',
    description: 'Create a new forum for discussions and conversations',
  }
}