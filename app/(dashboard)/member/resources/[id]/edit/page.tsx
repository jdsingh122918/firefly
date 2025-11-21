import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getGracefulUserData } from "@/lib/auth/graceful-user-fetch";
import ContentEditPage from "@/components/content/content-edit-page";
import { TagRepository } from "@/lib/db/repositories/tag.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

interface Props {
  params: Promise<{ id: string }>;
}

const userRepository = new UserRepository();
const tagRepository = new TagRepository();

export default async function MemberResourceEditPage({ params }: Props) {
  const { id } = await params;
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Dual-path authentication with graceful fallback
  const metadata = sessionClaims?.metadata as { role?: UserRole } | undefined;
  const userRole = metadata?.role;
  let finalUserRole = userRole;

  // Database fallback for resilience
  if (!userRole) {
    const userData = await getGracefulUserData();
    if (userData?.user?.role) {
      finalUserRole = userData.user.role as UserRole;
    }
  }

  // Role-based access control
  if (finalUserRole !== UserRole.MEMBER) {
    redirect("/unauthorized");
  }

  // Get member data
  const member = await userRepository.getUserByClerkId(userId);
  let memberFamily = null;

  if (member?.familyId) {
    // Members can only see their own family
    memberFamily = member.family;
  }

  // Get all categories
  const categories = await tagRepository.getCategories({});

  return (
    <ContentEditPage
      contentId={id}
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={memberFamily ? [memberFamily] : []} // Only their own family
      availableCategories={categories.map(category => ({
        id: category.id,
        name: category.name,
        color: category.color ?? undefined
      }))}
      showFamilySelector={false} // Members can't change family assignment
      showAssignmentManagement={false} // Members don't manage assignments
      showCurationControls={false} // Members don't have curation controls
      allowContentTypeChange={false} // Members have limited content type changes
    />
  );
}