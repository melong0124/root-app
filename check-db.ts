import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

async function check() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const transactions = await prisma.transaction.findMany({
        include: {
            entries: {
                include: {
                    account: true
                }
            }
        }
    });

    console.log(JSON.stringify(transactions, null, 2));
    await prisma.$disconnect();
}

check().catch(console.error);
