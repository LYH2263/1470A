import { useEffect, useState } from 'react';
import {
  Card, Descriptions, Button, Spin, Tag, message, Space,
  Modal, Form, Switch, Input, Select, Slider, Radio, Row, Col,
  Divider, Tooltip, Dropdown, MenuProps,
} from 'antd';
import {
  DownloadOutlined, FilePdfOutlined, FileTextOutlined,
  SettingOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import MainLayout from '@/components/layout/MainLayout';
import type { Article } from '@/types/article';
import { formatDate, importanceMap, sanitizeRichContent } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';
import type { ExportConfig } from '@/lib/export-utils';
import { DEFAULT_EXPORT_CONFIG } from '@/lib/export-utils';

const EXPORT_CONFIG_KEY = 'article_export_config';

function loadExportConfig(): ExportConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_EXPORT_CONFIG };
  try {
    const saved = localStorage.getItem(EXPORT_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_EXPORT_CONFIG,
        ...parsed,
        header: { ...DEFAULT_EXPORT_CONFIG.header, ...(parsed.header || {}) },
        footer: { ...DEFAULT_EXPORT_CONFIG.footer, ...(parsed.footer || {}) },
        cover: { ...DEFAULT_EXPORT_CONFIG.cover, ...(parsed.cover || {}) },
        watermark: { ...DEFAULT_EXPORT_CONFIG.watermark, ...(parsed.watermark || {}) },
        margin: parsed.margin || DEFAULT_EXPORT_CONFIG.margin,
      };
    }
  } catch (_) { /* noop */ }
  return { ...DEFAULT_EXPORT_CONFIG };
}

function saveExportConfig(config: ExportConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EXPORT_CONFIG_KEY, JSON.stringify(config));
  } catch (_) { /* noop */ }
}

export default function ArticleDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<Article | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>(() => loadExportConfig());
  const [exporting, setExporting] = useState(false);
  const [configForm] = Form.useForm();

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        const response = await fetchWithAuth(`/api/articles/${id}`);
        const result = await response.json();

        if (result.success) {
          setArticle(result.data);
        } else {
          message.error(result.error || '获取文章失败');
        }
      } catch (error) {
        console.error('获取文章失败:', error);
        message.error('获取文章失败');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const handleExport = async (type: 'pdf' | 'html', download = true) => {
    if (!id || !article) return;
    setExporting(true);

    try {
      const endpoint = type === 'pdf'
        ? `/api/articles/${id}/export/pdf`
        : `/api/articles/${id}/export/html`;

      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: exportConfig, download }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `导出失败 (${response.status})`);
      }

      if (type === 'html' && !download) {
        const htmlContent = await response.text();
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(htmlContent);
          win.document.close();
        } else {
          message.error('无法打开预览窗口，请允许弹出窗口');
        }
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${article.title}.${type}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/i)
          || contentDisposition.match(/filename="?([^"]+)"?/i);
        if (match?.[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(`${type.toUpperCase()} 导出成功`);
      setExportModalOpen(false);
    } catch (error) {
      console.error('导出失败:', error);
      message.error(error instanceof Error ? error.message : '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const handleConfigSave = (values: any) => {
    const newConfig: ExportConfig = {
      ...exportConfig,
      pageSize: values.pageSize,
      orientation: values.orientation,
      stripDarkStyles: values.stripDarkStyles,
      header: {
        enabled: values.headerEnabled,
        left: values.headerLeft,
        center: values.headerCenter,
        right: values.headerRight,
        fontSize: values.headerFontSize,
      },
      footer: {
        enabled: values.footerEnabled,
        left: values.footerLeft,
        center: values.footerCenter,
        right: values.footerRight,
        fontSize: values.footerFontSize,
      },
      cover: {
        enabled: values.coverEnabled,
        title: values.coverTitle,
        subtitle: values.coverSubtitle,
        showLogo: values.coverShowLogo,
        showExportDate: values.coverShowExportDate,
        showAuthor: values.coverShowAuthor,
      },
      watermark: {
        enabled: values.watermarkEnabled,
        text: values.watermarkText,
        opacity: values.watermarkOpacity / 100,
        fontSize: values.watermarkFontSize,
        rotation: values.watermarkRotation,
      },
    };
    setExportConfig(newConfig);
    saveExportConfig(newConfig);
    message.success('导出配置已保存');
  };

  const resetExportConfig = () => {
    setExportConfig({ ...DEFAULT_EXPORT_CONFIG });
    saveExportConfig({ ...DEFAULT_EXPORT_CONFIG });
    message.success('已恢复默认配置');
  };

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: '快速导出 PDF',
      onClick: () => handleExport('pdf'),
    },
    {
      key: 'html',
      icon: <FileTextOutlined />,
      label: '快速导出 HTML',
      onClick: () => handleExport('html'),
    },
    {
      key: 'preview',
      icon: <EyeOutlined />,
      label: '预览打印版 HTML',
      onClick: () => handleExport('html', false),
    },
    { type: 'divider' },
    {
      key: 'config',
      icon: <SettingOutlined />,
      label: '高级导出设置...',
      onClick: () => {
        configForm.setFieldsValue({
          pageSize: exportConfig.pageSize,
          orientation: exportConfig.orientation,
          stripDarkStyles: exportConfig.stripDarkStyles,
          headerEnabled: exportConfig.header.enabled,
          headerLeft: exportConfig.header.left,
          headerCenter: exportConfig.header.center,
          headerRight: exportConfig.header.right,
          headerFontSize: exportConfig.header.fontSize,
          footerEnabled: exportConfig.footer.enabled,
          footerLeft: exportConfig.footer.left,
          footerCenter: exportConfig.footer.center,
          footerRight: exportConfig.footer.right,
          footerFontSize: exportConfig.footer.fontSize,
          coverEnabled: exportConfig.cover.enabled,
          coverTitle: exportConfig.cover.title,
          coverSubtitle: exportConfig.cover.subtitle,
          coverShowLogo: exportConfig.cover.showLogo,
          coverShowExportDate: exportConfig.cover.showExportDate,
          coverShowAuthor: exportConfig.cover.showAuthor,
          watermarkEnabled: exportConfig.watermark.enabled,
          watermarkText: exportConfig.watermark.text,
          watermarkOpacity: Math.round((exportConfig.watermark.opacity ?? 0.08) * 100),
          watermarkFontSize: exportConfig.watermark.fontSize,
          watermarkRotation: exportConfig.watermark.rotation,
        });
        setExportModalOpen(true);
      },
    },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </MainLayout>
    );
  }

  if (!article) {
    return (
      <MainLayout>
        <div style={{ padding: '24px' }}>
          <Card>
            <p>文章不存在</p>
            <Button onClick={() => router.back()}>返回</Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const importanceConfig = importanceMap[article.importance];
  const isDraft = article.status === 'draft';

  // 使用扩展白名单的 DOMPurify 清理 HTML 内容，支持表格和视频
  const sanitizedContent = sanitizeRichContent(article.content);

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        <Card
          title={
            <Space>
              文章详情
              {isDraft && <Tag color="orange">草稿</Tag>}
            </Space>
          }
          extra={
            <Space>
              <Dropdown
                menu={{ items: exportMenuItems }}
                placement="bottomRight"
                trigger={['click']}
              >
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={exporting}
                >
                  导出
                </Button>
              </Dropdown>
              <Button onClick={() => router.push(`/articles/${id}/edit`)}>编辑</Button>
              <Button onClick={() => router.back()}>返回</Button>
            </Space>
          }
        >
          <div style={{ position: 'relative' }}>
            {isDraft && (
              <div className="draft-watermark">
                未发布
              </div>
            )}
            <Descriptions bordered column={2}>
              <Descriptions.Item label="标题" span={2}>
                {article.title}
              </Descriptions.Item>
              <Descriptions.Item label="作者">
                {article.author}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDate(article.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="重要性">
                <Tag color={importanceConfig.color}>{importanceConfig.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {isDraft ? (
                  <Tag color="orange">草稿</Tag>
                ) : (
                  <Tag color="green">已发布</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="分类">
                {article.category ? (
                  <Tag color="blue">{article.category.name}</Tag>
                ) : (
                  <Tag color="default">未分类</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="阅读数">{article.views}</Descriptions.Item>
              <Descriptions.Item label="内容" span={2}>
                <div
                  className="article-content"
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Card>
      </div>

      <Modal
        title={
          <Space>
            <SettingOutlined />
            导出配置
          </Space>
        }
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        width={800}
        destroyOnClose
        footer={
          <Space>
            <Button onClick={resetExportConfig}>恢复默认</Button>
            <Button onClick={() => setExportModalOpen(false)}>取消</Button>
            <Button
              icon={<FilePdfOutlined />}
              loading={exporting}
              onClick={() => {
                configForm.validateFields()
                  .then((values) => {
                    handleConfigSave(values);
                    handleExport('pdf');
                  })
                  .catch(() => {});
              }}
            >
              保存并导出 PDF
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              loading={exporting}
              onClick={() => {
                configForm.validateFields()
                  .then((values) => {
                    handleConfigSave(values);
                    handleExport('html');
                  })
                  .catch(() => {});
              }}
            >
              保存并导出 HTML
            </Button>
          </Space>
        }
      >
        <Form
          form={configForm}
          layout="vertical"
          initialValues={{
            pageSize: exportConfig.pageSize,
            orientation: exportConfig.orientation,
            stripDarkStyles: exportConfig.stripDarkStyles,
            headerEnabled: exportConfig.header.enabled,
            headerLeft: exportConfig.header.left,
            headerCenter: exportConfig.header.center,
            headerRight: exportConfig.header.right,
            headerFontSize: exportConfig.header.fontSize,
            footerEnabled: exportConfig.footer.enabled,
            footerLeft: exportConfig.footer.left,
            footerCenter: exportConfig.footer.center,
            footerRight: exportConfig.footer.right,
            footerFontSize: exportConfig.footer.fontSize,
            coverEnabled: exportConfig.cover.enabled,
            coverTitle: exportConfig.cover.title,
            coverSubtitle: exportConfig.cover.subtitle,
            coverShowLogo: exportConfig.cover.showLogo,
            coverShowExportDate: exportConfig.cover.showExportDate,
            coverShowAuthor: exportConfig.cover.showAuthor,
            watermarkEnabled: exportConfig.watermark.enabled,
            watermarkText: exportConfig.watermark.text,
            watermarkOpacity: Math.round((exportConfig.watermark.opacity ?? 0.08) * 100),
            watermarkFontSize: exportConfig.watermark.fontSize,
            watermarkRotation: exportConfig.watermark.rotation,
          }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="纸张大小" name="pageSize">
                <Select
                  options={[
                    { label: 'A4 (210 × 297 mm)', value: 'A4' },
                    { label: 'Letter (215.9 × 279.4 mm)', value: 'Letter' },
                    { label: 'Legal (215.9 × 355.6 mm)', value: 'Legal' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="方向" name="orientation">
                <Radio.Group>
                  <Radio.Button value="portrait">纵向</Radio.Button>
                  <Radio.Button value="landscape">横向</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="stripDarkStyles"
            label="自动剥离暗色主题样式（防止打印时文字看不清）"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider style={{ textAlign: 'left', margin: '16px 0' }}>页眉设置</Divider>

          <Form.Item
            name="headerEnabled"
            label="启用页眉"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="左侧内容" name="headerLeft">
                <Input placeholder="例如：文章管理系统" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="中间内容" name="headerCenter">
                <Input placeholder="留空表示不显示" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="右侧内容" name="headerRight">
                <Tooltip title="可用变量：{title} {author} {exportUser} {exportDate} {createDate}">
                  <Input placeholder="例如：{title}" />
                </Tooltip>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="页脚字号 (px)" name="headerFontSize">
            <Slider min={6} max={20} />
          </Form.Item>

          <Divider style={{ textAlign: 'left', margin: '16px 0' }}>页脚设置</Divider>

          <Form.Item
            name="footerEnabled"
            label="启用页脚"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Tooltip title="可用变量：{title} {author} {exportUser} {exportDate} {createDate} {pageNumber} {totalPages}">
                <Form.Item label="左侧内容" name="footerLeft">
                  <Input placeholder="例如：{exportUser}" />
                </Form.Item>
              </Tooltip>
            </Col>
            <Col span={8}>
              <Form.Item label="中间内容" name="footerCenter">
                <Input placeholder="留空表示不显示" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Tooltip title="可用变量：{title} {author} {exportUser} {exportDate} {createDate} {pageNumber} {totalPages}">
                <Form.Item label="右侧内容" name="footerRight">
                  <Input placeholder="例如：第 {pageNumber} 页 / 共 {totalPages} 页" />
                </Form.Item>
              </Tooltip>
            </Col>
          </Row>

          <Form.Item label="页脚字号 (px)" name="footerFontSize">
            <Slider min={6} max={20} />
          </Form.Item>

          <Divider style={{ textAlign: 'left', margin: '16px 0' }}>封面设置</Divider>

          <Form.Item
            name="coverEnabled"
            label="启用封面页（导出时首页显示封面）"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="封面标题" name="coverTitle">
                <Input placeholder="留空则使用文章标题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="封面副标题" name="coverSubtitle">
                <Input placeholder="可选的副标题文字" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="coverShowLogo"
                label="显示 Logo"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="coverShowAuthor"
                label="显示作者信息"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="coverShowExportDate"
                label="显示导出信息"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ textAlign: 'left', margin: '16px 0' }}>水印设置</Divider>

          <Form.Item
            name="watermarkEnabled"
            label="启用水印（显示当前用户名和导出时间）"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item label="自定义水印文字" name="watermarkText">
            <Input placeholder="留空则默认使用：用户名 + 导出时间" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="不透明度 (%)" name="watermarkOpacity">
                <Slider min={1} max={50} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="字号 (px)" name="watermarkFontSize">
                <Slider min={10} max={40} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="旋转角度 (°)" name="watermarkRotation">
                <Slider min={-60} max={60} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </MainLayout>
  );
}
