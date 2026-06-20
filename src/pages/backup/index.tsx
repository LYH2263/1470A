import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Tag,
  Popconfirm,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Upload,
  Alert,
  Statistic,
  Row,
  Col,
  Tooltip,
  Tabs,
  Divider,
} from 'antd';
import {
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { fetchWithAuth } from '@/lib/api';

interface BackupRecord {
  id: string;
  type: string;
  status: string;
  filename: string;
  fileSize: number;
  articleCount: number;
  operatorName?: string | null;
  note?: string | null;
  createdAt: string;
}

interface BackupStats {
  totalBackups: number;
  totalSize: number;
  latestBackup: string | null;
  scheduleEnabled: boolean;
  maintenanceMode: boolean;
}

interface ScheduleConfig {
  id: string;
  enabled: boolean;
  cronExpression: string;
  retentionDays: number;
  retentionCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    manual: '手动备份',
    scheduled: '定时备份',
    snapshot: '快照',
  };
  return map[type] || type;
}

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    manual: 'blue',
    scheduled: 'green',
    snapshot: 'orange',
  };
  return map[type] || 'default';
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    creating: '创建中',
    completed: '已完成',
    failed: '失败',
    restoring: '恢复中',
    restored: '已恢复',
  };
  return map[status] || status;
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    creating: 'processing',
    completed: 'success',
    failed: 'error',
    restoring: 'processing',
    restored: 'success',
  };
  return map[status] || 'default';
}

function BackupCenterPage() {
  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoreFile, setRestoreFile] = useState<UploadFile | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleForm] = Form.useForm();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [reloadModalVisible, setReloadModalVisible] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');

  useEffect(() => {
    let pollTimer: NodeJS.Timeout | null = null;

    const pollMaintenance = async () => {
      try {
        const res = await fetchWithAuth('/api/system/status');
        const data = await res.json();
        if (data.success) {
          setMaintenanceMode(data.data.maintenance.enabled);
          setMaintenanceMessage(data.data.maintenance.message || '');
        }
      } catch {
        // ignore poll errors
      }
    };

    pollMaintenance();
    pollTimer = setInterval(pollMaintenance, 5000);

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetchWithAuth('/api/backup/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
        setMaintenanceMode(data.data.maintenanceMode);
      }
    } catch (error: any) {
      message.error('获取备份统计失败');
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filterType) params.set('type', filterType);
      const res = await fetchWithAuth(`/api/backup/list?${params}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data.data);
        setTotal(data.data.total);
      }
    } catch (error: any) {
      message.error('获取备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async () => {
    try {
      const res = await fetchWithAuth('/api/backup/schedule');
      const data = await res.json();
      if (data.success && data.data) {
        setSchedule(data.data);
      }
    } catch (error: any) {
      // schedule may not exist yet
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSchedule();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [page, pageSize, filterType]);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetchWithAuth('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: '手动触发全量备份' }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(`备份创建成功，文件: ${data.data.filename}`);
        fetchRecords();
        fetchStats();
      } else {
        message.error(data.error || '创建备份失败');
      }
    } catch (error: any) {
      message.error('创建备份失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (record: BackupRecord) => {
    const token = localStorage.getItem('auth_token');
    const url = `/api/backup/download?filename=${encodeURIComponent(record.filename)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = record.filename;
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          a.href = blobUrl;
          a.click();
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => message.error('下载备份失败'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/backup/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        message.success('删除成功');
        fetchRecords();
        fetchStats();
      } else {
        message.error(data.error || '删除失败');
      }
    } catch (error: any) {
      message.error('删除失败');
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      message.warning('请选择要恢复的备份文件');
      return;
    }
    setRestoring(true);
    try {
      const file = restoreFile.originFileObj || restoreFile;
      const formData = new FormData();
      formData.append('file', file as File);

      const res = await fetchWithAuth('/api/backup/restore', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        message.success('数据恢复成功');
        setRestoreModalVisible(false);
        setRestoreFile(null);
        if (data.data?.needsReload) {
          setReloadModalVisible(true);
        }
        fetchRecords();
        fetchStats();
      } else {
        message.error(data.error || '恢复失败');
      }
    } catch (error: any) {
      message.error('恢复失败');
    } finally {
      setRestoring(false);
    }
  };

  const handleToggleMaintenance = async (enabled: boolean) => {
    try {
      const res = await fetchWithAuth('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setMaintenanceMode(enabled);
        setMaintenanceMessage(data.data.message || '');
        message.success(enabled ? '已进入维护模式' : '已退出维护模式');
        fetchStats();
      } else {
        message.error(data.error?.message || '操作失败');
      }
    } catch (error: any) {
      message.error('操作失败');
    }
  };

  const handleScheduleSave = async () => {
    try {
      const values = await scheduleForm.validateFields();
      const res = await fetchWithAuth('/api/backup/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        message.success('定时备份配置已更新');
        setScheduleModalVisible(false);
        fetchSchedule();
        fetchStats();
      } else {
        message.error(data.error || '更新配置失败');
      }
    } catch (error: any) {
      message.error('更新配置失败');
    }
  };

  const openScheduleModal = () => {
    if (schedule) {
      scheduleForm.setFieldsValue({
        enabled: schedule.enabled,
        cronExpression: schedule.cronExpression,
        retentionDays: schedule.retentionDays,
        retentionCount: schedule.retentionCount,
      });
    } else {
      scheduleForm.setFieldsValue({
        enabled: true,
        cronExpression: '0 2 * * *',
        retentionDays: 7,
        retentionCount: 10,
      });
    }
    setScheduleModalVisible(true);
  };

  const columns: ColumnsType<BackupRecord> = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: true,
      width: 280,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>{getTypeLabel(type)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '文章数',
      dataIndex: 'articleCount',
      key: 'articleCount',
      width: 80,
    },
    {
      title: '操作者',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 100,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      width: 150,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="下载备份">
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            />
          </Tooltip>
          {record.type !== 'snapshot' && (
            <Popconfirm
              title="确定要删除此备份吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const statsCards = stats && (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="备份总数"
            value={stats.totalBackups}
            prefix={<DatabaseOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="备份总大小"
            value={formatFileSize(stats.totalSize)}
            prefix={<SafetyCertificateOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="最近备份"
            value={stats.latestBackup ? new Date(stats.latestBackup).toLocaleString('zh-CN') : '暂无'}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ fontSize: 16 }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="维护模式"
            value={maintenanceMode ? '已开启' : '已关闭'}
            prefix={<WarningOutlined />}
            valueStyle={{ color: maintenanceMode ? '#ff4d4f' : '#52c41a', fontSize: 20 }}
          />
        </Card>
      </Col>
    </Row>
  );

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        <h1 style={{ marginBottom: '24px' }}>
          <SafetyCertificateOutlined style={{ marginRight: 8 }} />
          备份恢复中心
        </h1>

        {maintenanceMode && (
          <Alert
            message="系统维护中"
            description={maintenanceMessage || '系统当前处于维护模式，所有写入操作已被中断。请在完成恢复操作后关闭维护模式。'}
            type="warning"
            showIcon
            closable={false}
            style={{ marginBottom: 16 }}
            action={
              <Button
                size="small"
                type="primary"
                danger
                onClick={() => handleToggleMaintenance(false)}
              >
                退出维护模式
              </Button>
            }
          />
        )}

        {statsCards}

        <Tabs
          defaultActiveKey="backups"
          items={[
            {
              key: 'backups',
              label: '备份管理',
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Space wrap>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreateBackup}
                        loading={creating}
                        disabled={maintenanceMode}
                      >
                        手动全量备份
                      </Button>
                      <Button
                        icon={<CloudUploadOutlined />}
                        onClick={() => {
                          setRestoreFile(null);
                          setRestoreModalVisible(true);
                        }}
                      >
                        上传恢复
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                          fetchRecords();
                          fetchStats();
                        }}
                      >
                        刷新
                      </Button>
                      <Select
                        placeholder="备份类型"
                        value={filterType}
                        onChange={(val) => setFilterType(val)}
                        style={{ width: 120 }}
                        allowClear
                      >
                        <Select.Option value="manual">手动备份</Select.Option>
                        <Select.Option value="scheduled">定时备份</Select.Option>
                        <Select.Option value="snapshot">快照</Select.Option>
                      </Select>
                      <Popconfirm
                        title="确定要开启维护模式吗？开启后所有写入操作将被中断。"
                        onConfirm={() => handleToggleMaintenance(true)}
                        okText="确定"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          danger
                          icon={<WarningOutlined />}
                          disabled={maintenanceMode}
                        >
                          进入维护模式
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>

                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={records}
                    loading={loading}
                    pagination={{
                      current: page,
                      pageSize,
                      total,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (t) => `共 ${t} 条`,
                      onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                      },
                    }}
                  />
                </>
              ),
            },
            {
              key: 'schedule',
              label: '定时备份策略',
              children: (
                <Card
                  title="定时备份配置"
                  extra={
                    <Button
                      type="primary"
                      icon={<SettingOutlined />}
                      onClick={openScheduleModal}
                    >
                      配置
                    </Button>
                  }
                >
                  {schedule ? (
                    <Row gutter={[24, 16]}>
                      <Col span={12}>
                        <p>
                          <strong>状态：</strong>
                          <Tag color={schedule.enabled ? 'success' : 'default'}>
                            {schedule.enabled ? '已启用' : '已禁用'}
                          </Tag>
                        </p>
                        <p>
                          <strong>Cron 表达式：</strong>
                          <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                            {schedule.cronExpression}
                          </code>
                        </p>
                        <p>
                          <strong>保留天数：</strong>
                          {schedule.retentionDays} 天
                        </p>
                        <p>
                          <strong>保留份数：</strong>
                          至少保留 {schedule.retentionCount} 份
                        </p>
                        {schedule.lastRunAt && (
                          <p>
                            <strong>上次执行：</strong>
                            {new Date(schedule.lastRunAt).toLocaleString('zh-CN')}
                          </p>
                        )}
                        {schedule.nextRunAt && (
                          <p>
                            <strong>下次执行：</strong>
                            {new Date(schedule.nextRunAt).toLocaleString('zh-CN')}
                          </p>
                        )}
                      </Col>
                      <Col span={12}>
                        <Alert
                          message="使用说明"
                          description={
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              <li>内建调度器会根据配置自动执行定时备份</li>
                              <li>Cron 表达式格式：分 时 日 月 周（如 0 2 * * * 表示每天凌晨 2 点）</li>
                              <li>超出保留天数的定时备份将被自动清理</li>
                              <li>清理时至少保留指定份数的备份</li>
                              <li>调度器在访问本页面后自动启动</li>
                            </ul>
                          }
                          type="info"
                          showIcon
                        />
                      </Col>
                    </Row>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px' }}>
                      <p>尚未配置定时备份策略</p>
                      <Button type="primary" onClick={openScheduleModal}>
                        立即配置
                      </Button>
                    </div>
                  )}
                </Card>
              ),
            },
          ]}
        />

        <Modal
          title="上传备份文件恢复"
          open={restoreModalVisible}
          onOk={handleRestore}
          onCancel={() => setRestoreModalVisible(false)}
          okText="开始恢复"
          cancelText="取消"
          confirmLoading={restoring}
          width={600}
          okButtonProps={{ danger: true }}
        >
          <Alert
            message="恢复操作说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>恢复前系统将自动创建当前数据快照</li>
                <li>恢复期间系统将自动进入维护模式</li>
                <li>恢复完成后维护模式将自动关闭</li>
                <li>仅支持 .db 格式的 SQLite 备份文件</li>
              </ul>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Upload
            accept=".db"
            beforeUpload={() => false}
            maxCount={1}
            onChange={(info) => {
              setRestoreFile(info.fileList[0] || null);
            }}
            onRemove={() => setRestoreFile(null)}
            fileList={restoreFile ? [restoreFile] : []}
          >
            <Button icon={<UploadOutlined />}>选择备份文件</Button>
          </Upload>
        </Modal>

        <Modal
          title="定时备份策略配置"
          open={scheduleModalVisible}
          onOk={handleScheduleSave}
          onCancel={() => setScheduleModalVisible(false)}
          okText="保存"
          cancelText="取消"
        >
          <Form form={scheduleForm} layout="vertical">
            <Form.Item
              name="enabled"
              label="启用定时备份"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            <Form.Item
              name="cronExpression"
              label="Cron 表达式"
              rules={[{ required: true, message: '请输入 cron 表达式' }]}
              extra="格式：分 时 日 月 周，例如 0 2 * * * 表示每天凌晨 2 点"
            >
              <Input placeholder="0 2 * * *" />
            </Form.Item>
            <Form.Item
              name="retentionDays"
              label="保留天数"
              rules={[{ required: true, message: '请输入保留天数' }]}
              extra="超出此天数的定时备份将被自动清理"
            >
              <InputNumber min={1} max={365} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="retentionCount"
              label="保留份数"
              rules={[{ required: true, message: '请输入保留份数' }]}
              extra="清理时至少保留此份数的备份"
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="恢复完成"
          open={reloadModalVisible}
          onOk={() => window.location.reload()}
          onCancel={() => setReloadModalVisible(false)}
          okText="立即刷新"
          cancelText="稍后刷新"
          okButtonProps={{ type: 'primary' }}
          maskClosable={false}
          closable={false}
        >
          <Alert
            message="数据恢复成功"
            description={
              <div>
                <p>数据库已恢复到备份状态，已自动创建恢复前快照。</p>
                <p style={{ marginBottom: 0 }}>
                  <strong>为确保数据一致性，请刷新页面后再进行操作。</strong>
                </p>
              </div>
            }
            type="success"
            showIcon
          />
        </Modal>
      </div>
    </MainLayout>
  );
}

export default function BackupCenterPageWithAuth() {
  return (
    <ProtectedRoute>
      <BackupCenterPage />
    </ProtectedRoute>
  );
}
