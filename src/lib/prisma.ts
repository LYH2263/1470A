import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export let prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export async function resetPrismaClient(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect errors
  }

  prisma = new PrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
  }
}
