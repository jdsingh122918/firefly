import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getGracefulUserData } from "@/lib/auth/graceful-user-fetch";
import ContentEditPage from "@/components/content/content-edit-page";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { TagRepository } from "@/lib/db/repositories/tag.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

interface Props {
  params: Promise<{ id: string }>;
}

const userRepository = new UserRepository();
const familyRepository = new FamilyRepository();
const tagRepository = new TagRepository();

export default async function VolunteerResourceEditPage({ params }: Props) {
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
  if (finalUserRole !== UserRole.VOLUNTEER) {
    redirect("/unauthorized");
  }

  // Get volunteer data and their families
  const volunteer = await userRepository.getUserByClerkId(userId);
  let families: any[] = [];

  if (volunteer) {
    // Volunteers can only access families they created
    families = await familyRepository.getFamiliesByCreator(volunteer.id);
  }

  // Get all categories
  const categories = await tagRepository.getCategories({});

  return (
    <ContentEditPage
      contentId={id}
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      availableCategories={categories.map(category => ({
        id: category.id,
        name: category.name,
        color: category.color ?? undefined
      }))}
      showFamilySelector={families.length > 0} // Only show if volunteer has families
      showAssignmentManagement={false} // Volunteers don't manage assignments
      showCurationControls={false} // Volunteers don't have curation controls
      allowContentTypeChange={true} // Volunteers can change content type
    />
  );
}