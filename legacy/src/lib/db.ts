import { PrismaClient } from "@prisma/client";
import { env } from "./env";

/**
 * Single Prisma instance. In dev, Next.js hot-reload would otherwise spawn
 * a new client on every change and exhaust DB connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
