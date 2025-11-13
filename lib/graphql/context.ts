import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { AuthContext } from "@/lib/types";

export interface GraphQLContext extends AuthContext {
  userRepository: UserRepository;
  familyRepository: FamilyRepository;
}

export async function createGraphQLContext(): Promise<GraphQLContext> {
  const { userId: clerkUserId } = await auth();

  // Initialize repositories
  const userRepository = new UserRepository();
  const familyRepository = new FamilyRepository();

  let user = null;
  let userId = undefined;

  // If user is authenticated, get their full user record from database
  if (clerkUserId) {
    try {
      user = await userRepository.getUserByClerkId(clerkUserId);
      userId = user?.id;
    } catch (error) {
      console.error("Error fetching user in GraphQL context:", error);
      // Continue without user data if database is unavailable
    }
  }

  return {
    userId,
    user: user || undefined,
    clerkUserId: clerkUserId || undefined,
    userRepository,
    familyRepository,
  };
}
