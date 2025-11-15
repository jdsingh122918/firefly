import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getGracefulUserData } from "@/lib/auth/graceful-user-fetch";
import { ResourceDetailPage } from "@/components/resources/resource-detail-page";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VolunteerResourceDetailPage({ params }: Props) {
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

  return (
    <ResourceDetailPage
      resourceId={id}
      userRole={finalUserRole}
      userId={userId}
    />
  );
}