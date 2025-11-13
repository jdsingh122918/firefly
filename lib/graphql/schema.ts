import { gql } from "graphql-tag";

export const typeDefs = gql`
  # Scalars
  scalar DateTime

  # Enums
  enum UserRole {
    ADMIN
    VOLUNTEER
    MEMBER
  }

  # Types
  type User {
    id: ID!
    clerkId: String!
    email: String!
    firstName: String
    lastName: String
    fullName: String # Computed field
    role: UserRole!
    familyId: String
    family: Family
    createdById: String
    createdBy: User
    phoneNumber: String
    phoneVerified: Boolean!
    emailVerified: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Family {
    id: ID!
    name: String!
    description: String
    createdById: String!
    createdBy: User!
    members: [User!]!
    memberCount: Int! # Computed field
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Statistics types
  type UserStats {
    total: Int!
    admins: Int!
    volunteers: Int!
    members: Int!
  }

  type FamilyStats {
    total: Int!
    totalMembers: Int!
    averageMembersPerFamily: Float!
  }

  # Input types
  input CreateUserInput {
    email: String!
    firstName: String
    lastName: String
    targetRole: UserRole!
    familyId: String
  }

  input UpdateUserInput {
    firstName: String
    lastName: String
    role: UserRole
    familyId: String
    phoneNumber: String
  }

  input CreateFamilyInput {
    name: String!
    description: String
  }

  input UpdateFamilyInput {
    name: String
    description: String
  }

  input SignUpWithEmailInput {
    email: String!
    verificationCode: String!
  }

  # Filter inputs
  input UserFilters {
    role: UserRole
    familyId: String
    createdById: String
  }

  # Response types for mutations
  type AuthPayload {
    user: User!
    success: Boolean!
    message: String
  }

  type CreateUserPayload {
    user: User!
    success: Boolean!
    message: String
  }

  type CreateFamilyPayload {
    family: Family!
    success: Boolean!
    message: String
  }

  # Root Query type
  type Query {
    # Auth queries
    currentUser: User

    # User queries
    user(id: ID!): User
    users(filters: UserFilters): [User!]!
    userStats: UserStats!

    # Family queries
    family(id: ID!): Family
    families: [Family!]!
    myFamilies: [Family!]! # Families created by current user
    familyStats: FamilyStats!
  }

  # Root Mutation type
  type Mutation {
    # Auth mutations
    signUpWithEmail(input: SignUpWithEmailInput!): AuthPayload!

    # User mutations
    createUser(input: CreateUserInput!): CreateUserPayload!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!
    assignFamily(userId: ID!, familyId: ID!): User!

    # Family mutations
    createFamily(input: CreateFamilyInput!): CreateFamilyPayload!
    updateFamily(id: ID!, input: UpdateFamilyInput!): Family!
    deleteFamily(id: ID!): Boolean!
  }
`;
