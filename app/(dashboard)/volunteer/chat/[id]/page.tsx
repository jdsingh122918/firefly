import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getGracefulUserData } from "@/lib/auth/graceful-user-fetch";
import { ConversationDetailPage } from "@/components/chat/conversation-detail-page";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VolunteerConversationDetailPage({ params }: Props) {
  const { id } = await params;
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Dual-path authentication with graceful fallback
  const metadata = sessionClaims?.metadata as { role?: UserRole } | undefined;
  const userRole = metadata?.role;
  let finalUserRole = userRole;
  let databaseUserId: string | null = null;

  // Get user data from database to get the database user ID
  const userData = await getGracefulUserData();
  if (userData?.user) {
    databaseUserId = userData.user.id || null;
    if (!userRole && userData.user.role) {
      finalUserRole = userData.user.role as UserRole;
    }
  }

  // Role-based access control
  if (finalUserRole !== UserRole.VOLUNTEER) {
    redirect("/unauthorized");
  }

  if (!databaseUserId) {
    redirect("/unauthorized");
  }

  return (
    <ConversationDetailPage
      conversationId={id}
      userRole={finalUserRole}
      userId={databaseUserId}
    />
  );
}