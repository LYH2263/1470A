import React, { useState } from 'react';
import { Alert } from 'antd';
import { CloseOutlined, BellOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import DOMPurify from 'isomorphic-dompurify';
import { useSystemStatus } from '@/contexts/SystemStatusContext';
import type { AnnouncementLevel } from '@/types/announcement';
import { ANNOUNCEMENT_LEVELS } from '@/types/announcement';

const LEVEL_CONFIG: Record<AnnouncementLevel, { type: 'success' | 'info' | 'warning' | 'error'; icon: React.ReactNode; banner: boolean }> = {
  normal: { type: 'info', icon: <InfoCircleOutlined />, banner: true },
  important: { type: 'warning', icon: <WarningOutlined />, banner: true },
  urgent: { type: 'error', icon: <BellOutlined />, banner: true },
};

export default function AnnouncementBar() {
  const { announcements, dismissAnnouncement } = useSystemStatus();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (announcements.length === 0) {
    return null;
  }

  const getLevelInfo = (level: AnnouncementLevel) => {
    return ANNOUNCEMENT_LEVELS.find(l => l.value === level) || ANNOUNCEMENT_LEVELS[0];
  };

  const handleToggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div style={{ width: '100%' }}>
      {announcements.map((announcement, index) => {
        const config = LEVEL_CONFIG[announcement.level as AnnouncementLevel];
        const levelInfo = getLevelInfo(announcement.level as AnnouncementLevel);
        const isExpanded = expandedIndex === index || announcements.length === 1;
        const sanitizedContent = DOMPurify.sanitize(announcement.content);

        return (
          <div
            key={announcement.id}
            style={{
              position: 'relative',
              borderBottom: index < announcements.length - 1 ? '1px solid #f0f0f0' : 'none',
            }}
          >
            <Alert
              message={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {config.icon}
                  <span style={{ fontWeight: 500 }}>
                    [{levelInfo.label}] {announcement.title}
                  </span>
                  {announcements.length > 1 && (
                    <span
                      style={{
                        cursor: 'pointer',
                        color: '#1890ff',
                        fontSize: 12,
                        marginLeft: 8,
                      }}
                      onClick={() => handleToggleExpand(index)}
                    >
                      {isExpanded ? '收起' : '展开'}
                    </span>
                  )}
                </div>
              }
              description={
                isExpanded ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                    style={{ marginTop: 8 }}
                  />
                ) : null
              }
              type={config.type}
              showIcon={false}
              closable
              closeIcon={<CloseOutlined />}
              onClose={() => dismissAnnouncement(announcement.id)}
              style={{
                borderRadius: 0,
                marginBottom: 0,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
