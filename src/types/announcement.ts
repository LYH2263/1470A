export type AnnouncementLevel = 'normal' | 'important' | 'urgent';

export interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  level: AnnouncementLevel;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  level: AnnouncementLevel;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

export interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  level?: AnnouncementLevel;
  startTime?: Date;
  endTime?: Date;
  isActive?: boolean;
}

export interface MaintenanceMode {
  enabled: boolean;
  message: string;
  startTime?: Date;
  endTime?: Date;
  exemptPaths: string[];
}

export interface SystemStatus {
  maintenance: MaintenanceMode;
  announcements: SystemAnnouncement[];
}

export const ANNOUNCEMENT_LEVELS: { value: AnnouncementLevel; label: string; color: string }[] = [
  { value: 'normal', label: '普通', color: 'blue' },
  { value: 'important', label: '重要', color: 'orange' },
  { value: 'urgent', label: '紧急', color: 'red' },
];

export const LEVEL_PRIORITY: Record<AnnouncementLevel, number> = {
  normal: 1,
  important: 2,
  urgent: 3,
};
