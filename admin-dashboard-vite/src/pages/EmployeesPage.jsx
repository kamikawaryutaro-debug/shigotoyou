import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, message, Space, Tag, Modal, Form, Input, Select, Popconfirm, Avatar,
} from 'antd';
import {
  UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, SearchOutlined, CheckCircleOutlined,
  CloseCircleOutlined, MessageOutlined, LockOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import API_BASE from '../api-config';

export default function EmployeesPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/users`);
      if (res.data.success) setUsers(res.data.data);
    } catch (error) {
      console.error('Fetch Users Error:', error);
      const errorMsg = error.response?.data?.error || '従業員データの取得に失敗しました';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setFormModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    form.setFieldsValue({
      employee_id: record.employee_id,
      last_name: record.last_name,
      first_name: record.first_name,
      email: record.email,
      phone: record.phone,
      department: record.department,
      position: record.position,
      status: record.status,
    });
    setFormModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        const res = await axios.put(`${API_BASE}/admin/users/${editingUser.id}`, values);
        if (res.data.success) {
          message.success('従業員情報を更新しました');
        }
      } else {
        const res = await axios.post(`${API_BASE}/admin/users`, values);
        if (res.data.success) {
          message.success('従業員を登録しました');
        }
      }
      setFormModalVisible(false);
      form.resetFields();
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Submit Error:', error);
      if (error.response?.data?.error) {
        const errorMsg = error.response.data.error;
        const detail = error.response.data.detail ? ` (${error.response.data.detail})` : '';
        message.error(`${errorMsg}${detail}`);
      } else if (error.response?.status === 500) {
        message.error('サーバーエラーが発生しました。バックエンドのログを確認してください。');
      } else if (!error.errorFields) {
        message.error('接続に失敗しました。サーバーが起動しているか確認してください。');
      }
    }
  };

  const handleDelete = async (record) => {
    try {
      const res = await axios.delete(`${API_BASE}/admin/users/${record.id}`);
      if (res.data.success) {
        message.success(res.data.message);
        fetchUsers();
      }
    } catch (error) {
      message.error('削除に失敗しました');
    }
  };

  const handleResetPassword = async (record) => {
    try {
      const res = await axios.post(`${API_BASE}/admin/users/${record.id}/reset-password`);
      if (res.data.success) {
        message.success(`${record.full_name} のパスワードをリセットしました。次回ログイン時に新しいパスワードを設定できます。`);
      }
    } catch (error) {
      message.error('パスワードリセットに失敗しました');
    }
  };

  const filteredUsers = users.filter(u =>
    !searchText ||
    u.full_name?.includes(searchText) ||
    u.employee_id?.toLowerCase().includes(searchText.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchText.toLowerCase()) ||
    u.department?.includes(searchText)
  );

  const columns = [
    {
      title: '従業員ID',
      dataIndex: 'employee_id',
      key: 'employee_id',
      width: 100,
      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
    },
    {
      title: '氏名',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 140,
      render: (text) => (
        <span>
          <Avatar style={{ backgroundColor: '#1890ff', marginRight: 6 }} icon={<UserOutlined />} size="small" />
          {text}
        </span>
      ),
    },
    {
      title: 'メール',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      width: 200,
    },
    {
      title: '部署',
      dataIndex: 'department',
      key: 'department',
      width: 100,
    },
    {
      title: '職位',
      dataIndex: 'position',
      key: 'position',
      width: 120,
    },
    {
      title: 'LINE連携',
      dataIndex: 'line_user_id',
      key: 'line_user_id',
      width: 100,
      align: 'center',
      render: (lineId) => lineId ? (
        <Tag color="#52c41a" icon={<MessageOutlined />}>連携済み</Tag>
      ) : (
        <Tag color="#d9d9d9">未連携</Tag>
      ),
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => status === 'active' ? (
        <Tag color="#52c41a" icon={<CheckCircleOutlined />}>有効</Tag>
      ) : (
        <Tag color="#ff4d4f" icon={<CloseCircleOutlined />}>無効</Tag>
      ),
    },
    {
      title: '最終ログイン',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 160,
      render: (text) => text ? new Date(text).toLocaleString('ja-JP') : '未ログイン',
    },
    {
      title: 'アクション',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} title="編集" />
          <Popconfirm
            title={`${record.full_name} のパスワードをリセットしますか？\n次回ログイン時に新しいパスワードを設定できます。`}
            onConfirm={() => handleResetPassword(record)}
            okText="リセット"
            cancelText="キャンセル"
            okType="primary"
          >
            <Button type="text" size="small" icon={<LockOutlined />} title="パスワードリセット" style={{ color: '#1890ff' }} />
          </Popconfirm>
          <Popconfirm
            title="この従業員を無効化しますか？"
            onConfirm={() => handleDelete(record)}
            okText="無効化"
            cancelText="キャンセル"
            okType="danger"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} title="無効化" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={<span><UserOutlined /> 従業員管理</span>}
        extra={
          <Space>
            <Input
              placeholder="検索..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchUsers}>更新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新規登録
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredUsers}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `全 ${total} 件` }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 従業員追加・編集モーダル */}
      <Modal
        title={editingUser ? '従業員編集' : '従業員新規登録'}
        open={formModalVisible}
        onCancel={() => { setFormModalVisible(false); form.resetFields(); setEditingUser(null); }}
        onOk={handleSubmit}
        okText={editingUser ? '更新' : '登録'}
        cancelText="キャンセル"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="employee_id"
            label="従業員ID"
            rules={[{ required: true, message: '従業員IDを入力してください' }]}
          >
            <Input placeholder="例: EMP001" />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }}>
            <Form.Item
              name="last_name"
              label="姓"
              rules={[{ required: true, message: '姓を入力してください' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="例: 田中" />
            </Form.Item>
            <Form.Item
              name="first_name"
              label="名"
              rules={[{ required: true, message: '名を入力してください' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="例: 太郎" />
            </Form.Item>
          </Space>

          <Form.Item
            name="email"
            label="メールアドレス"
            rules={[
              { type: 'email', message: '有効なメールアドレスを入力してください' }
            ]}
          >
            <Input placeholder="例: tanaka@example.com" />
          </Form.Item>

          <Form.Item name="phone" label="電話番号">
            <Input placeholder="例: 090-1234-5678" />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }}>
            <Form.Item name="department" label="部署" style={{ flex: 1 }}>
              <Input placeholder="例: 営業部" />
            </Form.Item>
            <Form.Item name="position" label="職位" style={{ flex: 1 }}>
              <Select placeholder="選択してください" allowClear>
                <Select.Option value="パートタイマー">パートタイマー</Select.Option>
                <Select.Option value="アルバイト">アルバイト</Select.Option>
                <Select.Option value="正社員">正社員</Select.Option>
                <Select.Option value="契約社員">契約社員</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          {editingUser && (
            <Form.Item name="status" label="ステータス">
              <Select>
                <Select.Option value="active">有効</Select.Option>
                <Select.Option value="inactive">無効</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
