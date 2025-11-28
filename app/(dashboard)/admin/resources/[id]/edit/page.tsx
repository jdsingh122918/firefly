import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getGracefulUserData } from "@/lib/auth/graceful-user-fetch";
import ContentEditPage from "@/components/content/content-edit-page";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { TagRepository } from "@/lib/db/repositories/tag.repository";

interface Props {
  params: Promise<{ id: string }>;
}

const familyRepository = new FamilyRepository();
const tagRepository = new TagRepository();

export default async function AdminResourceEditPage({ params }: Props) {
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
  if (finalUserRole !== UserRole.ADMIN) {
    redirect("/unauthorized");
  }

  // Fetch required data for ContentEditPage
  const [families, categories] = await Promise.all([
    familyRepository.getAllFamilies(), // Admin can access all families
    tagRepository.getCategories({}), // Get all categories
  ]);

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
      showFamilySelector={true} // Admin can change family assignment
      showCurationControls={true} // Admin has curation controls
      allowContentTypeChange={true} // Admin can change content type
    />
  );
}