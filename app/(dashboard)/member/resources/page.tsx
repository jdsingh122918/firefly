import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getGracefulUserData } from "@/lib/auth/graceful-user-fetch";
import { ResourcesPageContent } from "@/components/resources/resources-page-content";

export default async function MemberResourcesPage() {
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

  return (
    <ResourcesPageContent
      userRole={finalUserRole}
      userId={userId}
    />
  );
}