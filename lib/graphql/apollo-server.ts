import { ApolloServer } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { GraphQLContext } from "./context";

// Create the executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Create Apollo Server instance
export const apolloServer = new ApolloServer<GraphQLContext>({
  schema,
  // Enable GraphQL Playground in development
  introspection: process.env.NODE_ENV !== "production",
  // Custom error formatting
  formatError: (err) => {
    // Log the error for debugging (in development)
    if (process.env.NODE_ENV === "development") {
      console.error("GraphQL Error:", err);
    }

    // Return sanitized error to client
    return {
      message: err.message,
      // Include error code if available
      extensions: {
        code: err.extensions?.code || "INTERNAL_ERROR",
      },
      // Include path and locations for debugging
      ...(process.env.NODE_ENV === "development" && {
        locations: err.locations,
        path: err.path,
      }),
    };
  },
});
