import React, { useState, useEffect } from 'react';
import {
  Card, Table, Upload, Modal, Button, message, Space, Tag, Input, Popconfirm, Descriptions, List,
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  UploadOutlined, EyeOutlined, DeleteOutlined, PlusOutlined,
  SearchOutlined, ReloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import API_BASE from '../api-config';

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractDetail, setContractDetail] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/contracts`);
      if (res.data.success) setContracts(res.data.data);
    } catch (error) {
      message.error('契約書の取得に失敗しました');
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
        fetchContracts();
      } else {
        message.error(`エラー: ${res.data.error || 'アップロード失敗'}`);
        onError(new Error(res.data.error));
      }
    } catch (err) {
      console.error(err);
      message.error(`${file.name} アップロード失敗`);
      onError(err);
    }
  };

  const handleViewDetail = async (record) => {
    try {
      const res = await axios.get(`${API_BASE}/contracts/${record.id}`);
      if (res.data.success) {
        setContractDetail(res.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('契約書詳細の取得に失敗しました');
    }
  };

  const handleDelete = async (record) => {
    try {
      const res = await axios.delete(`${API_BASE}/admin/contracts/${record.id}`);
      if (res.data.success) {
        message.success(res.data.message);
        fetchContracts();
      }
    } catch (error) {
      message.error('削除に失敗しました');
    }
  };

  const filteredContracts = contracts.filter(c =>
    !searchText ||
    c.file_name?.toLowerCase().includes(searchText.toLowerCase()) ||
    c.contract_id?.toLowerCase().includes(searchText.toLowerCase()) ||
    c.name?.includes(searchText)
  );

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
      title: 'シート数',
      dataIndex: 'total_sheets',
      key: 'total_sheets',
      width: 90,
      align: 'center',
    },
    {
      title: '署名進捗',
      key: 'progress',
      width: 110,
      render: (_, record) => {
        const completed = record.completed_sheets || 0;
        const total = record.total_sheets || 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return (
          <span>
            {completed}/{total}
            <span style={{ color: '#999', marginLeft: 4, fontSize: 12 }}>({pct}%)</span>
          </span>
        );
      },
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
      title: 'アップロード日',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      width: 170,
      render: (text) => text ? new Date(text).toLocaleString('ja-JP') : '-',
    },
    {
      title: 'アクション',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} title="詳細表示" />
          <Popconfirm
            title="この契約書を削除しますか？"
            description="関連する署名データも全て削除されます"
            onConfirm={() => handleDelete(record)}
            okText="削除"
            cancelText="キャンセル"
            okType="danger"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} title="削除" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={<span><FileTextOutlined /> 契約書管理</span>}
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
            <Button icon={<ReloadOutlined />} onClick={fetchContracts}>更新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadModalVisible(true)}>
              新規アップロード
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredContracts}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `全 ${total} 件` }}
          scroll={{ x: 1000 }}
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

      {/* Detail Modal */}
      <Modal
        title={`契約書詳細: ${contractDetail?.contract?.file_name || ''}`}
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setContractDetail(null); }}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>閉じる</Button>]}
        width={700}
      >
        {contractDetail && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="契約書ID">{contractDetail.contract.contract_id}</Descriptions.Item>
              <Descriptions.Item label="ファイル名">{contractDetail.contract.file_name}</Descriptions.Item>
              <Descriptions.Item label="アップロード日">{new Date(contractDetail.contract.uploaded_at).toLocaleString('ja-JP')}</Descriptions.Item>
              <Descriptions.Item label="ステータス">
                <Tag color={contractDetail.contract.status === 'completed' ? '#52c41a' : '#faad14'}>
                  {contractDetail.contract.status === 'completed' ? '完了' : '進行中'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="進捗" span={2}>
                {contractDetail.progress.completed} / {contractDetail.progress.total} ({contractDetail.progress.percentage}%)
              </Descriptions.Item>
            </Descriptions>

            <h4>📋 シート一覧</h4>
            <List
              dataSource={contractDetail.sheets}
              renderItem={(sheet) => (
                <List.Item>
                  <List.Item.Meta
                    title={sheet.full_name || sheet.sheet_name}
                    description={`シート名: ${sheet.sheet_name}`}
                  />
                  <Tag color={sheet.status === 'signed' ? '#52c41a' : '#faad14'}>
                    {sheet.status === 'signed' ? '署名完了' : '署名待ち'}
                  </Tag>
                  {sheet.signed_at && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                      {new Date(sheet.signed_at).toLocaleString('ja-JP')}
                    </span>
                  )}
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
