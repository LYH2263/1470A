import { prisma } from './prisma';
import { cache, CACHE_KEYS, CACHE_TTL } from './cache';
import type {
  SystemAnnouncement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  MaintenanceMode,
  AnnouncementLevel,
} from '@/types/announcement';
import { LEVEL_PRIORITY } from '@/types/announcement';

const DEFAULT_MAINTENANCE_MODE: MaintenanceMode = {
  enabled: false,
  message: '系统正在维护中，请稍后访问。',
  exemptPaths: ['/api/health', '/api/auth/login', '/login'],
};

function invalidateAllCaches() {
  cache.invalidateAll();
}

export async function getActiveAnnouncements(): Promise<SystemAnnouncement[]> {
  const cached = cache.get<SystemAnnouncement[]>(CACHE_KEYS.ANNOUNCEMENTS_ACTIVE);
  if (cached) return cached;

  const now = new Date();
  const announcements = await prisma.systemAnnouncement.findMany({
    where: {
      isActive: true,
      startTime: { lte: now },
      endTime: { gte: now },
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
  });

  const sorted = sortAnnouncementsByPriority(announcements as SystemAnnouncement[]);
  cache.set(CACHE_KEYS.ANNOUNCEMENTS_ACTIVE, sorted, CACHE_TTL.MEDIUM);
  return sorted;
}

export async function getAllAnnouncements(): Promise<SystemAnnouncement[]> {
  const announcements = await prisma.systemAnnouncement.findMany({
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });
  return announcements as SystemAnnouncement[];
}

export async function getAnnouncementById(id: string): Promise<SystemAnnouncement | null> {
  const announcement = await prisma.systemAnnouncement.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });
  return announcement as SystemAnnouncement | null;
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  userId: string
): Promise<SystemAnnouncement> {
  const announcement = await prisma.systemAnnouncement.create({
    data: {
      ...input,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  invalidateAllCaches();
  return announcement as SystemAnnouncement;
}

export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput
): Promise<SystemAnnouncement | null> {
  const announcement = await prisma.systemAnnouncement.update({
    where: { id },
    data: input,
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  invalidateAllCaches();
  return announcement as SystemAnnouncement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await prisma.systemAnnouncement.delete({ where: { id } });
  invalidateAllCaches();
}

export async function getMaintenanceMode(): Promise<MaintenanceMode> {
  const cached = cache.get<MaintenanceMode>(CACHE_KEYS.MAINTENANCE_MODE);
  if (cached) return cached;

  const config = await prisma.systemConfig.findUnique({
    where: { key: 'maintenance_mode' },
  });

  if (config) {
    try {
      const parsed = JSON.parse(config.value) as MaintenanceMode;
      const result = { ...DEFAULT_MAINTENANCE_MODE, ...parsed };
      cache.set(CACHE_KEYS.MAINTENANCE_MODE, result, CACHE_TTL.LONG);
      return result;
    } catch {
      return DEFAULT_MAINTENANCE_MODE;
    }
  }

  return DEFAULT_MAINTENANCE_MODE;
}

export async function setMaintenanceMode(mode: Partial<MaintenanceMode>): Promise<MaintenanceMode> {
  const current = await getMaintenanceMode();
  const updated = { ...current, ...mode };

  await prisma.systemConfig.upsert({
    where: { key: 'maintenance_mode' },
    create: {
      key: 'maintenance_mode',
      value: JSON.stringify(updated),
    },
    update: {
      value: JSON.stringify(updated),
    },
  });

  invalidateAllCaches();
  return updated;
}

export async function getSystemStatus(): Promise<{
  maintenance: MaintenanceMode;
  announcements: SystemAnnouncement[];
  version: number;
}> {
  const [maintenance, announcements] = await Promise.all([
    getMaintenanceMode(),
    getActiveAnnouncements(),
  ]);

  const version = Date.now();
  return { maintenance, announcements, version };
}

export async function getMaintenanceExemptPaths(): Promise<string[]> {
  const mode = await getMaintenanceMode();
  return mode.exemptPaths;
}

export function isPathExempt(path: string, exemptPaths: string[]): boolean {
  return exemptPaths.some(exempt => {
    if (exempt.endsWith('*')) {
      const prefix = exempt.slice(0, -1);
      return path.startsWith(prefix);
    }
    return path === exempt || path.startsWith(exempt + '/');
  });
}

function sortAnnouncementsByPriority(
  announcements: SystemAnnouncement[]
): SystemAnnouncement[] {
  return [...announcements].sort((a, b) => {
    const priorityDiff = LEVEL_PRIORITY[b.level as AnnouncementLevel] - LEVEL_PRIORITY[a.level as AnnouncementLevel];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
