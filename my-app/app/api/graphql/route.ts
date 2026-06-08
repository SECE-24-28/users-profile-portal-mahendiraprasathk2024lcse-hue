import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import type { NextRequest } from "next/server";
import { resolvers, typeDefs } from "../../../graphql";
import { prisma } from "../../../lib/prisma";
import { verifyToken } from "../../../lib/auth";

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const graphqlHandler = startServerAndCreateNextHandler(server, {
  context: async (req) => {
    const request = req as unknown as Request;
    const authorization = request.headers.get("authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return { user: null };
    }

    const token = authorization.slice(7);

    try {
      const payload = verifyToken(token);

      if (typeof payload !== "object" || payload === null || typeof payload.id !== "number") {
        return { user: null };
      }

      const user = await prisma.user.findUnique({
        where: {
          id: payload.id,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      });

      return { user };
    } catch {
      return { user: null };
    }
  },
});

export async function GET(request: NextRequest) {
  return graphqlHandler(request as never) as Promise<Response>;
}

export async function POST(request: NextRequest) {
  return graphqlHandler(request as never) as Promise<Response>;
}