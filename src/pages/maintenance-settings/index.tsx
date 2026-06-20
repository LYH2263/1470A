import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Switch,
  Input,
  Button,
  DatePicker,
  Space,
  Alert,
  message,
  Tag,
  Divider,
} from 'antd';
import { SettingOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchWithAuth } from '@/lib/api';
import { emitSystemStatusChange } from '@/lib/system-status-events';
import type { MaintenanceMode } from '@/types/announcement';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface FormValues {
  enabled: boolean;
  message: string;
  timeRange?: [dayjs.Dayjs, dayjs.Dayjs];
  exemptPaths: string;
}

export default function MaintenanceSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [currentMode, setCurrentMode] = useState<MaintenanceMode | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/maintenance');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const mode = result.data as MaintenanceMode;
          setCurrentMode(mode);
          form.setFieldsValue({
            enabled: mode.enabled,
            message: mode.message,
            exemptPaths: mode.exemptPaths.join('\n'),
            timeRange: mode.startTime && mode.endTime
              ? [dayjs(mode.startTime), dayjs(mode.endTime)]
              : undefined,
          });
        }
      }
    } catch (error) {
      message.error('获取维护模式设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const data: Partial<MaintenanceMode> = {
        enabled: values.enabled,
        message: values.message,
        exemptPaths: values.exemptPaths
          .split('\n')
          .map(p => p.trim())
          .filter(p => p.length > 0),
      };

      if (values.timeRange) {
        data.startTime = values.timeRange[0].toDate();
        data.endTime = values.timeRange[1].toDate();
      }

      const response = await fetchWithAuth('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentMode(result.data);
        emitSystemStatusChange();
        message.success('设置保存成功');
      } else {
        const result = await response.json();
        message.error(result.error?.message || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestHealthCheck = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        message.success('健康检查接口正常');
      } else {
        message.error('健康检查接口异常');
      }
    } catch (error) {
      message.error('健康检查接口调用失败');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <SettingOutlined />
            维护模式设置
          </Space>
        }
        loading={loading}
      >
        {currentMode?.enabled && (
          <Alert
            message="维护模式已开启"
            description="当前系统处于维护模式，非管理员用户将被重定向到维护页面。"
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="enabled"
            label="启用维护模式"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </Form.Item>

          <Form.Item
            name="message"
            label="维护提示信息"
            rules={[{ required: true, message: '请输入维护提示信息' }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入维护期间显示给用户的提示信息"
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="维护时间范围（可选）"
            help="设置预计的维护开始和结束时间，将在维护页面显示"
          >
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="exemptPaths"
            label="例外路径（每行一个）"
            help="这些路径在维护模式下仍然可以访问，支持 * 通配符"
          >
            <TextArea
              rows={6}
              placeholder={"/api/health\n/api/auth/login\n/login\n/public/*"}
            />
          </Form.Item>

          <Divider />

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                保存设置
              </Button>
              <Button onClick={handleTestHealthCheck}>
                测试健康检查接口
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {currentMode && (
          <div style={{ marginTop: 24 }}>
            <h4>当前状态</h4>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                状态：
                {currentMode.enabled ? (
                  <Tag color="red">已启用</Tag>
                ) : (
                  <Tag color="green">已关闭</Tag>
                )}
              </div>
              <div>
                例外路径：{currentMode.exemptPaths.length} 个
                <div style={{ marginTop: 8 }}>
                  {currentMode.exemptPaths.map((path, index) => (
                    <Tag key={index} style={{ marginBottom: 4 }}>{path}</Tag>
                  ))}
                </div>
              </div>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
}
