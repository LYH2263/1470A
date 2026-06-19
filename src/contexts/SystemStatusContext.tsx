import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/lib/api';
import type { SystemAnnouncement, MaintenanceMode } from '@/types/announcement';

interface SystemStatusContextType {
  announcements: SystemAnnouncement[];
  maintenance: MaintenanceMode | null;
  dismissedAnnouncements: string[];
  dismissAnnouncement: (id: string) => void;
  refreshStatus: () => Promise<void>;
  isLoading: boolean;
}

const SystemStatusContext = createContext<SystemStatusContextType | undefined>(undefined);

const STORAGE_KEY = 'dismissed_announcements';
const POLL_INTERVAL = 30000;

export function SystemStatusProvider({ children }: { children: React.ReactNode }) {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceMode | null>(null);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setDismissedAnnouncements(JSON.parse(stored));
      } catch {
        setDismissedAnnouncements([]);
      }
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('/api/system/status');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAnnouncements(result.data.announcements || []);
          setMaintenance(result.data.maintenance);
        }
      }
    } catch (error) {
      console.error('刷新系统状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dismissAnnouncement = useCallback((id: string) => {
    setDismissedAnnouncements(prev => {
      const updated = [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    refreshStatus();
    pollRef.current = setInterval(refreshStatus, POLL_INTERVAL);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [refreshStatus]);

  const visibleAnnouncements = announcements.filter(
    a => !dismissedAnnouncements.includes(a.id)
  );

  return (
    <SystemStatusContext.Provider
      value={{
        announcements: visibleAnnouncements,
        maintenance,
        dismissedAnnouncements,
        dismissAnnouncement,
        refreshStatus,
        isLoading,
      }}
    >
      {children}
    </SystemStatusContext.Provider>
  );
}

export function useSystemStatus() {
  const context = useContext(SystemStatusContext);
  if (context === undefined) {
    throw new Error('useSystemStatus must be used within a SystemStatusProvider');
  }
  return context;
}
