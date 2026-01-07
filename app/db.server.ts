import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

let prisma: PrismaClient;

declare global {
    var __db__: PrismaClient | undefined;
}

const getPrisma = () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
};

if (process.env.NODE_ENV === "production") {
    prisma = getPrisma();
} else {
    if (!global.__db__) {
        global.__db__ = getPrisma();
    }
    prisma = global.__db__;
}

export { prisma };
