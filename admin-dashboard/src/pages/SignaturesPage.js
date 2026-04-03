import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tabs, Button, message, Space, Tag, Modal, Descriptions, Avatar, Empty,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EyeOutlined,
  UserOutlined, ReloadOutlined, EditOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import API_BASE from '../api-config';

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState(null);

  useEffect(() => {
    fetchSignatures(activeTab);
  }, [activeTab]);

  const fetchSignatures = async (status) => {
    setLoading(true);
    try {
      const params = status !== 'all' ? `?status=${status}` : '';
      const res = await axios.get(`${API_BASE}/admin/signatures${params}`);
      if (res.data.success) setSignatures(res.data.data);
    } catch (error) {
      message.error('署名データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (record) => {
    try {
      const res = await axios.get(`${API_BASE}/admin/signatures/${record.sheet_id}`);
      if (res.data.success) {
        setSelectedSignature(res.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('署名詳細の取得に失敗しました');
    }
  };

  const columns = [
    {
      title: '従業員名',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 140,
      render: (text) => (
        <span>
          <Avatar style={{ backgroundColor: '#1890ff', marginRight: 6 }} icon={<UserOutlined />} size="small" />
          {text || '不明'}
        </span>
      ),
    },
    {
      title: '従業員ID',
      dataIndex: 'employee_id',
      key: 'employee_id',
      width: 100,
    },
    {
      title: '契約書ID',
      dataIndex: 'contract_id',
      key: 'contract_id',
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text}</span>,
    },
    {
      title: 'シート名',
      dataIndex: 'sheet_name',
      key: 'sheet_name',
      ellipsis: true,
    },
    {
      title: '職位',
      dataIndex: 'position',
      key: 'position',
      width: 110,
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status, record) => (
        <Tag
          color={record.status_color}
          icon={status === 'signed' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
        >
          {record.status_text}
        </Tag>
      ),
    },
    {
      title: '署名日時',
      dataIndex: 'signed_at',
      key: 'signed_at',
      width: 170,
      render: (text) => text ? new Date(text).toLocaleString('ja-JP') : '-',
    },
    {
      title: 'アクション',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
          title="詳細表示"
        />
      ),
    },
  ];

  const tabItems = [
    {
      key: 'all',
      label: `📋 全て (${signatures.length})`,
    },
    {
      key: 'signed',
      label: `✅ 署名完了`,
    },
    {
      key: 'pending',
      label: `⏳ 署名待ち`,
    },
  ];

  return (
    <div>
      <Card
        title={<span><EditOutlined /> 署名管理</span>}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => fetchSignatures(activeTab)}>更新</Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
        <Table
          dataSource={signatures}
          columns={columns}
          rowKey="sheet_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `全 ${total} 件` }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* Signature Detail Modal */}
      <Modal
        title="署名詳細"
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedSignature(null); }}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>閉じる</Button>]}
        width={700}
      >
        {selectedSignature && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="従業員名">{selectedSignature.sheet.full_name}</Descriptions.Item>
              <Descriptions.Item label="従業員ID">{selectedSignature.sheet.employee_id}</Descriptions.Item>
              <Descriptions.Item label="メール">{selectedSignature.sheet.email}</Descriptions.Item>
              <Descriptions.Item label="職位">{selectedSignature.sheet.position}</Descriptions.Item>
              <Descriptions.Item label="部署">{selectedSignature.sheet.department}</Descriptions.Item>
              <Descriptions.Item label="契約書ID">{selectedSignature.sheet.contract_id}</Descriptions.Item>
              <Descriptions.Item label="ファイル名" span={2}>{selectedSignature.sheet.file_name}</Descriptions.Item>
              <Descriptions.Item label="シート名">{selectedSignature.sheet.sheet_name}</Descriptions.Item>
              <Descriptions.Item label="ステータス">
                <Tag color={selectedSignature.sheet.status === 'signed' ? '#52c41a' : '#faad14'}>
                  {selectedSignature.sheet.status === 'signed' ? '署名完了' : '署名待ち'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="閲覧日時">
                {selectedSignature.sheet.viewed_at ? new Date(selectedSignature.sheet.viewed_at).toLocaleString('ja-JP') : '未閲覧'}
              </Descriptions.Item>
              <Descriptions.Item label="署名日時">
                {selectedSignature.sheet.signed_at ? new Date(selectedSignature.sheet.signed_at).toLocaleString('ja-JP') : '-'}
              </Descriptions.Item>
            </Descriptions>

            {selectedSignature.signature ? (
              <>
                <h4 style={{ marginBottom: 12 }}>🖊️ 署名データ</h4>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Descriptions size="small" column={2}>
                    <Descriptions.Item label="署名ID">
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{selectedSignature.signature.id}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="署名日時">
                      {new Date(selectedSignature.signature.signed_at).toLocaleString('ja-JP')}
                    </Descriptions.Item>
                    <Descriptions.Item label="IPアドレス">{selectedSignature.signature.ip_address || '-'}</Descriptions.Item>
                    <Descriptions.Item label="OS">{selectedSignature.signature.device_os || '-'}</Descriptions.Item>
                    <Descriptions.Item label="ブラウザ" span={2}>
                      <span style={{ fontSize: 11, wordBreak: 'break-all' }}>
                        {selectedSignature.signature.browser_user_agent || '-'}
                      </span>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* 署名画像プレビュー */}
                {selectedSignature.signature.signature_data && (
                  <div style={{ textAlign: 'center', padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <h4>署名画像</h4>
                    <img
                      src={selectedSignature.signature.signature_data}
                      alt="署名"
                      style={{ maxWidth: '100%', maxHeight: 200, border: '1px solid #e8e8e8', borderRadius: 4 }}
                    />
                  </div>
                )}
              </>
            ) : (
              <Empty description="まだ署名されていません" />
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
