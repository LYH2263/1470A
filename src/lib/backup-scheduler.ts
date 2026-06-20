import { prisma } from './prisma';
import { createBackup, applyRetentionPolicy } from './backup';

let schedulerInstance: BackupScheduler | null = null;
let schedulerInitialized = false;

interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

function parseCron(expression: string): CronParts {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) {
    throw new Error('Invalid cron expression: need at least 5 fields');
  }
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

function matchCronField(value: number, field: string, min: number, max: number): boolean {
  if (field === '*') return true;

  const parts = field.split(',');
  for (const part of parts) {
    if (part === '*') return true;

    let step = 1;
    let rangePart = part;

    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      step = parseInt(stepStr, 10);
      rangePart = range;
    }

    if (rangePart === '*') {
      if (value % step === 0) return true;
      continue;
    }

    if (rangePart.includes('-')) {
      const [startStr, endStr] = rangePart.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (value >= start && value <= end && (value - start) % step === 0) {
        return true;
      }
    } else {
      const num = parseInt(rangePart, 10);
      if (num === value) return true;
    }
  }

  return false;
}

function shouldRun(cron: CronParts, date: Date): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  return (
    matchCronField(minute, cron.minute, 0, 59) &&
    matchCronField(hour, cron.hour, 0, 23) &&
    matchCronField(dayOfMonth, cron.dayOfMonth, 1, 31) &&
    matchCronField(month, cron.month, 1, 12) &&
    matchCronField(dayOfWeek, cron.dayOfWeek, 0, 6)
  );
}

export class BackupScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastRunMinute: number = -1;
  private isRunning: boolean = false;

  start() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[backup-scheduler] 调度执行出错:', err);
      });
    }, 30 * 1000);

    console.log('[backup-scheduler] 定时备份调度器已启动');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[backup-scheduler] 定时备份调度器已停止');
    }
  }

  private async tick() {
    if (this.isRunning) return;

    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    if (currentMinute === this.lastRunMinute) {
      return;
    }

    try {
      const schedule = await prisma.backupSchedule.findFirst();

      if (!schedule || !schedule.enabled) {
        this.lastRunMinute = currentMinute;
        return;
      }

      const cron = parseCron(schedule.cronExpression);

      if (shouldRun(cron, now)) {
        this.isRunning = true;
        console.log('[backup-scheduler] 触发定时备份...');

        try {
          await createBackup('scheduled', undefined, undefined, '定时自动备份');

          await prisma.backupSchedule.update({
            where: { id: schedule.id },
            data: { lastRunAt: now },
          });

          await applyRetentionPolicy(schedule.retentionDays, schedule.retentionCount);

          console.log('[backup-scheduler] 定时备份完成');
        } catch (err) {
          console.error('[backup-scheduler] 定时备份失败:', err);
        }
      }
    } catch (err) {
      console.error('[backup-scheduler] 检查调度配置失败:', err);
    } finally {
      this.lastRunMinute = currentMinute;
      this.isRunning = false;
    }
  }
}

export function getBackupScheduler(): BackupScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new BackupScheduler();
  }
  return schedulerInstance;
}

export function initBackupScheduler(): void {
  if (schedulerInitialized) return;

  if (typeof window !== 'undefined') {
    return;
  }

  schedulerInitialized = true;
  const scheduler = getBackupScheduler();
  scheduler.start();
}
