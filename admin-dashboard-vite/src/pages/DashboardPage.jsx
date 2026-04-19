import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Table, Upload, Modal, Button, message, Space, Avatar, Tag,
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  UserOutlined, UploadOutlined, EyeOutlined, DownloadOutlined,
  DeleteOutlined, PlusOutlined, TeamOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import API_BASE from '../api-config';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, contractsRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/stats`),
        axios.get(`${API_BASE}/contracts`)
      ]);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (contractsRes.data.success) setContracts(contractsRes.data.data);
    } catch (error) {
      console.error('データ取得エラー:', error);
      message.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const customUpload = async (options) => {
    const { onSuccess, onError, file, onProgress } = options;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/contracts/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          onProgress({ percent: (event.loaded / event.total) * 100 });
        }
      });
      if (res.data.success) {
        message.success(`${file.name} アップロード成功`);
        onSuccess("ok");
        setUploadModalVisible(false);
        fetchData();
      } else {
        message.error(`エラー: ${res.data.error || 'アップロード失敗'}`);
        onError(new Error(res.data.error));
      }
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.error || 'サーバーとの通信に失敗しました';
      message.error(`${file.name} アップロード失敗: ${errorMsg}`);
      onError(err);
    }
  };

  const columns = [
    {
      title: '契約書ID',
      dataIndex: 'contract_id',
      key: 'contract_id',
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text}</span>,
    },
    {
      title: 'ファイル名',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
    },
    {
      title: '従業員名',
      dataIndex: 'name',
      key: 'name',
      width: 130,
      render: (text) => text ? (
        <span>
          <Avatar style={{ backgroundColor: '#1890ff', marginRight: 6 }} icon={<UserOutlined />} size="small" />
          {text}
        </span>
      ) : <Tag color="default">未マッチ</Tag>,
    },
    {
      title: '職位',
      dataIndex: 'position',
      key: 'position',
      width: 110,
    },
    {
      title: 'アップロード日',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      width: 170,
      render: (text) => text ? new Date(text).toLocaleString('ja-JP') : '-',
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => {
        const map = {
          'in_progress': { text: '進行中', color: '#faad14', icon: <ClockCircleOutlined /> },
          'completed': { text: '完了', color: '#52c41a', icon: <CheckCircleOutlined /> },
        };
        const s = map[status] || { text: status, color: '#999' };
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
      },
    },
    {
      title: '進捗',
      key: 'progress',
      width: 90,
      render: (_, record) => `${record.completed_sheets || 0}/${record.total_sheets || 0}`,
    },
  ];

  return (
    <div>
      {/* 統計カード */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="総契約書数"
              value={stats?.total_contracts || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="署名完了"
              value={stats?.signed_sheets || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="署名待ち"
              value={stats?.pending_sheets || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="完了率"
              value={stats?.completion_rate || 0}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Excelアップロード */}
      <Card
        title="📁 Excel 契約書アップロード"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadModalVisible(true)}>
            新規アップロード
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <div style={{ padding: 40, textAlign: 'center', background: '#fafafa', borderRadius: 8 }}>
          <UploadOutlined style={{ fontSize: 36, color: '#1890ff', marginBottom: 16 }} />
          <p style={{ fontSize: 14, color: '#999' }}>
            ドラッグ & ドロップでファイルをアップロード、または下のボタンをクリック
          </p>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>
            ファイルを選択
          </Button>
        </div>
      </Card>

      {/* 最近の契約書 */}
      <Card title="📋 最近の契約書">
        <Table
          dataSource={contracts}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Upload Modal */}
      <Modal
        title="Excel 契約書をアップロード"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
      >
        <Upload
          name="file"
          customRequest={customUpload}
          accept=".xlsx,.xls"
          maxCount={1}
          listType="text"
        >
          <Button icon={<UploadOutlined />}>ファイルを選択</Button>
        </Upload>
        <p style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
          • 対応形式: Excel (.xlsx, .xls)<br />
          • 最大ファイルサイズ: 10MB<br />
          • テンプレート: パートタイム雇用契約書に対応
        </p>
      </Modal>
    </div>
  );
}
