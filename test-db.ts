import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function verifyConnection() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log("Attempting to connect to the database...");
        await prisma.$connect();
        console.log("Successfully connected to the database! 🚀");

        // Check if we can query (even if empty)
        const userCount = await prisma.user.count();
        console.log(`Current user count: ${userCount}`);

        await prisma.$disconnect();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error("Failed to connect to the database:");
        console.error(error);
        process.exit(1);
    }
}

verifyConnection();
