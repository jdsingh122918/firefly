import { mergeResolvers } from "@graphql-tools/merge";
import { GraphQLScalarType, Kind, ValueNode } from "graphql";
import { GraphQLError } from "graphql";
import { userResolvers } from "./user.resolvers";
import { familyResolvers } from "./family.resolvers";

// Custom DateTime scalar resolver
const dateTimeResolver = new GraphQLScalarType({
  name: "DateTime",
  description: "Date custom scalar type",
  serialize(value: unknown) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    throw new GraphQLError(`Value is not an instance of Date: ${value}`);
  },
  parseValue(value: unknown) {
    if (typeof value === "string") {
      return new Date(value);
    }
    throw new GraphQLError(`Value is not a valid DateTime: ${value}`);
  },
  parseLiteral(ast: ValueNode) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    throw new GraphQLError(
      `Can only parse strings to DateTime but got a: ${ast.kind}`,
    );
  },
});

// Base resolvers for custom scalars
const baseResolvers = {
  DateTime: dateTimeResolver,
};

// Merge all resolvers
export const resolvers = mergeResolvers([
  baseResolvers,
  userResolvers,
  familyResolvers,
]);
