import { Card, Tabs, Empty, Alert } from 'antd';
import type { ArticleDiffPreview } from '@/types/article';
import { truncateForPreview } from '@/lib/batch-utils';

interface DiffPreviewProps {
  previews: ArticleDiffPreview[];
  warnings?: string[];
}

export default function DiffPreview({ previews, warnings = [] }: DiffPreviewProps) {
  const changedPreviews = previews.filter(p => p.hasChange);

  const renderHtmlPreview = (oldValue: string, newValue: string) => {
    const oldTruncated = truncateForPreview(oldValue, 300);
    const newTruncated = truncateForPreview(newValue, 300);

    return (
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>修改前</div>
          <div
            style={{
              padding: '8px 12px',
              background: '#fff1f0',
              border: '1px solid #ffa39e',
              borderRadius: '4px',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: '200px',
              overflow: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: oldTruncated.text }}
          />
          {oldTruncated.truncated && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>内容已截断...</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>修改后</div>
          <div
            style={{
              padding: '8px 12px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '4px',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: '200px',
              overflow: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: newTruncated.text }}
          />
          {newTruncated.truncated && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>内容已截断...</div>
          )}
        </div>
      </div>
    );
  };

  const renderTextPreview = (oldValue: string, newValue: string) => {
    return (
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>修改前</div>
          <div
            style={{
              padding: '8px 12px',
              background: '#fff1f0',
              border: '1px solid #ffa39e',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            {oldValue || '(空)'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>修改后</div>
          <div
            style={{
              padding: '8px 12px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            {newValue || '(空)'}
          </div>
        </div>
      </div>
    );
  };

  if (previews.length === 0) {
    return <Empty description="没有预览数据" />;
  }

  const tabItems = [
    {
      key: 'changed',
      label: `有变更 (${changedPreviews.length})`,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {changedPreviews.length === 0 ? (
            <Empty description="所有文章均无变更" />
          ) : (
            changedPreviews.map((preview) => (
              <Card
                key={preview.articleId}
                size="small"
                title={
                  <span style={{ fontSize: '14px' }}>
                  {preview.articleTitle}
                </span>
                }
              >
                {preview.field === 'content'
                  ? renderHtmlPreview(preview.oldValue, preview.newValue)
                  : renderTextPreview(preview.oldValue, preview.newValue)}
              </Card>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'all',
      label: `全部 (${previews.length})`,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {previews.map((preview) => (
            <Card
              key={preview.articleId}
              size="small"
              title={
                <span style={{ fontSize: '14px' }}>
                  {preview.articleTitle}
                  {!preview.hasChange && (
                    <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                      (无变更)
                    </span>
                  )}
                </span>
              }
            >
              {preview.field === 'content'
                ? renderHtmlPreview(preview.oldValue, preview.newValue)
                : renderTextPreview(preview.oldValue, preview.newValue)}
            </Card>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {warnings.length > 0 && (
        <Alert
          type="warning"
          message={`检测到 ${warnings.length} 个风险提示`}
          description={
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {warnings.length > 5 && (
                <li>... 还有 {warnings.length - 5} 条提示</li>
              )}
            </ul>
          }
          showIcon
        />
      )}
      <Tabs defaultActiveKey="changed" items={tabItems} />
    </div>
  );
}
