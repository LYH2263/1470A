import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Space,
  Tag,
  Popconfirm,
  message,
  Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchWithAuth } from '@/lib/api';
import RichTextEditor from '@/components/common/RichTextEditor';
import type { SystemAnnouncement, AnnouncementLevel } from '@/types/announcement';
import { ANNOUNCEMENT_LEVELS } from '@/types/announcement';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface FormValues {
  title: string;
  content: string;
  level: AnnouncementLevel;
  timeRange: [dayjs.Dayjs, dayjs.Dayjs];
  isActive: boolean;
}

export default function AnnouncementManagement() {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/announcements?all=true');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAnnouncements(result.data);
        }
      }
    } catch (error) {
      message.error('获取公告列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      level: 'normal',
      isActive: true,
      timeRange: [dayjs(), dayjs().add(7, 'day')],
    });
    setModalVisible(true);
  };

  const handleEdit = (record: SystemAnnouncement) => {
    setEditingId(record.id);
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      level: record.level as AnnouncementLevel,
      isActive: record.isActive,
      timeRange: [dayjs(record.startTime), dayjs(record.endTime)],
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetchWithAuth(`/api/announcements/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        message.success('删除成功');
        fetchAnnouncements();
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: FormValues) => {
    try {
      const data = {
        title: values.title,
        content: values.content,
        level: values.level,
        startTime: values.timeRange[0].toDate(),
        endTime: values.timeRange[1].toDate(),
        isActive: values.isActive,
      };

      let response;
      if (editingId) {
        response = await fetchWithAuth(`/api/announcements/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        response = await fetchWithAuth('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }

      if (response.ok) {
        message.success(editingId ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchAnnouncements();
      } else {
        const result = await response.json();
        message.error(result.error?.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getLevelTag = (level: string) => {
    const info = ANNOUNCEMENT_LEVELS.find(l => l.value === level);
    if (!info) return null;
    const colorMap: Record<string, string> = {
      blue: 'blue',
      orange: 'orange',
      red: 'red',
    };
    return <Tag color={colorMap[info.color] || 'default'}>{info.label}</Tag>;
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => getLevelTag(level),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '生效时间',
      key: 'timeRange',
      width: 300,
      render: (_: unknown, record: SystemAnnouncement) => (
        <div>
          <div>开始: {new Date(record.startTime).toLocaleString('zh-CN')}</div>
          <div>结束: {new Date(record.endTime).toLocaleString('zh-CN')}</div>
        </div>
      ),
    },
    {
      title: '创建人',
      key: 'createdBy',
      width: 120,
      render: (_: unknown, record: SystemAnnouncement) => record.createdBy?.name || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: Date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: SystemAnnouncement) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条公告吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="系统公告管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建公告
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={announcements}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingId ? '编辑公告' : '新建公告'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="公告标题"
            rules={[{ required: true, message: '请输入公告标题' }]}
          >
            <Input placeholder="请输入公告标题" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="level"
            label="公告级别"
            rules={[{ required: true, message: '请选择公告级别' }]}
          >
            <Select>
              {ANNOUNCEMENT_LEVELS.map(level => (
                <Select.Option key={level.value} value={level.value}>
                  {level.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="生效时间范围"
            rules={[{ required: true, message: '请选择生效时间范围' }]}
          >
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="立即启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="content"
            label="公告内容"
            rules={[{ required: true, message: '请输入公告内容' }]}
          >
            <RichTextEditor
              value={form.getFieldValue('content')}
              onChange={(value) => form.setFieldValue('content', value)}
              placeholder="请输入公告内容（支持富文本）"
              height={300}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingId ? '更新' : '发布'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
