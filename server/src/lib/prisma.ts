import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env, isProduction } from "../config/env";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prismaSingleton = global.prisma ?? new PrismaClient({
  adapter,
  errorFormat: "minimal",
  log: isProduction ? ["error"] : ["warn", "error"],
});

if (!isProduction) {
  global.prisma = prismaSingleton;
}

export const prisma = prismaSingleton;
