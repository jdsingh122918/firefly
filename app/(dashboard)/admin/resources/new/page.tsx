import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getGracefulUserData } from "@/lib/auth/graceful-user-fetch";
import { ResourceCreationPage } from "@/components/resources/resource-creation-page";

export default async function AdminCreateResourcePage() {
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

  // Role-based access control - only ADMIN and VOLUNTEER can create resources
  if (finalUserRole !== UserRole.ADMIN) {
    redirect("/unauthorized");
  }

  return (
    <ResourceCreationPage
      userRole={finalUserRole}
      userId={userId}
    />
  );
}