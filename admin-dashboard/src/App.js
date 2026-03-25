import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Button,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Upload,
  Modal,
  message,
  Tabs,
  Badge,
  Space,
  Avatar,
  Tag,
} from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  UploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import './App.css';
import API_BASE from './api-config';

const { Header, Sider, Content, Footer } = Layout;

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [activeKey, setActiveKey] = useState('1');

  // ダミーデータ：契約書一覧
  const contractsData = [
    {
      key: '1',
      id: 'CTR-001',
      name: '田中太郎',
      position: 'パートタイマー',
      uploadDate: '2026-03-15',
      status: 'completed',
      statusText: '署名完了',
      signedDate: '2026-03-16',
    },
    {
      key: '2',
      id: 'CTR-002',
      name: '鈴木花子',
      position: 'アルバイト',
      uploadDate: '2026-03-15',
      status: 'pending',
      statusText: '署名待ち',
      signedDate: '-',
    },
    {
      key: '3',
      id: 'CTR-003',
      name: '佐藤次郎',
      position: 'パートタイマー',
      uploadDate: '2026-03-14',
      status: 'completed',
      statusText: '署名完了',
      signedDate: '2026-03-15',
    },
    {
      key: '4',
      id: 'CTR-004',
      name: '高橋美咲',
      position: 'アルバイト',
      uploadDate: '2026-03-14',
      status: 'pending',
      statusText: '署名待ち',
      signedDate: '-',
    },
    {
      key: '5',
      id: 'CTR-005',
      name: '山田一郎',
      position: 'パートタイマー',
      uploadDate: '2026-03-13',
      status: 'completed',
      statusText: '署名完了',
      signedDate: '2026-03-14',
    },
  ];

  const columns = [
    {
      title: '契約書ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '従業員名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text) => (
        <span>
          <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} size="small" />
          {' '}
          {text}
        </span>
      ),
    },
    {
      title: '職位',
      dataIndex: 'position',
      key: 'position',
      width: 100,
    },
    {
      title: 'アップロード日',
      dataIndex: 'uploadDate',
      key: 'uploadDate',
      width: 110,
    },
    {
      title: '署名ステータス',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status, record) => (
        <Tag
          color={status === 'completed' ? '#52c41a' : '#faad14'}
          icon={status === 'completed' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
        >
          {record.statusText}
        </Tag>
      ),
    },
    {
      title: '署名日時',
      dataIndex: 'signedDate',
      key: 'signedDate',
      width: 110,
    },
    {
      title: 'アクション',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} title="詳細表示" />
          <Button type="text" size="small" icon={<DownloadOutlined />} title="ダウンロード" />
          <Button type="text" danger size="small" icon={<DeleteOutlined />} title="削除" />
        </Space>
      ),
    },
  ];

  const handleUploadChange = (info) => {
    if (info.file.status === 'done') {
      message.success(`${info.file.name} アップロード成功`);
      setUploadModalVisible(false);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} アップロード失敗`);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* サイドバー */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: '#001529',
        }}
      >
        <div className="logo" style={{ padding: '16px', textAlign: 'center', color: '#fff' }}>
          {collapsed ? '📋' : '📋 契約承認システム'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['1']}
          items={[
            {
              key: '1',
              icon: <DashboardOutlined />,
              label: 'ダッシュボード',
            },
            {
              key: '2',
              icon: <FileTextOutlined />,
              label: '契約書管理',
            },
            {
              key: '3',
              icon: <CheckCircleOutlined />,
              label: '署名管理',
            },
            {
              key: '4',
              icon: <UserOutlined />,
              label: '従業員管理',
            },
          ]}
        />
      </Sider>

      {/* メインコンテンツ */}
      <Layout style={{ marginLeft: collapsed ? 80 : 200 }}>
        {/* ヘッダー */}
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            position: 'sticky',
            top: 0,
            zIndex: 999,
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#001529' }}>
            契約書電子承認システム - 管理画面
          </div>
          <Button
            type="text"
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px' }}
          >
            {collapsed ? '≫' : '≪'}
          </Button>
        </Header>

        {/* コンテンツ */}
        <Content style={{ margin: '24px 16px', padding: 24, background: '#f5f5f5' }}>
          <Tabs activeKey={activeKey} onChange={setActiveKey}>
            {/* ダッシュボード */}
            <Tabs.TabPane label="📊 ダッシュボード" key="1">
              <div style={{ marginBottom: '24px' }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="総契約書数"
                        value={52}
                        prefix={<FileTextOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="署名完了"
                        value={38}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="署名待ち"
                        value={14}
                        prefix={<ClockCircleOutlined />}
                        valueStyle={{ color: '#faad14' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="完了率"
                        value={73}
                        suffix="%"
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* Excel アップロード */}
              <Card
                title="📁 Excel 契約書アップロード"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setUploadModalVisible(true)}
                  >
                    新規アップロード
                  </Button>
                }
                style={{ marginBottom: '24px' }}
              >
                <div style={{ padding: '40px', textAlign: 'center', background: '#fafafa' }}>
                  <UploadOutlined style={{ fontSize: '36px', color: '#1890ff', marginBottom: '16px' }} />
                  <p style={{ fontSize: '14px', color: '#999' }}>
                    ドラッグ & ドロップでファイルをアップロード、または下のボタンをクリック
                  </p>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => setUploadModalVisible(true)}
                  >
                    ファイルを選択
                  </Button>
                </div>
              </Card>

              {/* 最近の契約書一覧 */}
              <Card title="📋 最近の契約書（署名状況）">
                <Table
                  dataSource={contractsData}
                  columns={columns}
                  pagination={{ pageSize: 5 }}
                  scroll={{ x: 1000 }}
                />
              </Card>
            </Tabs.TabPane>

            {/* 署名済み一覧 */}
            <Tabs.TabPane label="✅ 署名済み契約書" key="2">
              <Card>
                <Table
                  dataSource={contractsData.filter((d) => d.status === 'completed')}
                  columns={columns}
                  pagination={{ pageSize: 5 }}
                  scroll={{ x: 1000 }}
                />
              </Card>
            </Tabs.TabPane>

            {/* 署名待ち一覧 */}
            <Tabs.TabPane label="⏳ 署名待ち契約書" key="3">
              <Card>
                <Table
                  dataSource={contractsData.filter((d) => d.status === 'pending')}
                  columns={columns}
                  pagination={{ pageSize: 5 }}
                  scroll={{ x: 1000 }}
                />
              </Card>
            </Tabs.TabPane>
          </Tabs>
        </Content>

        {/* フッター */}
        <Footer style={{ textAlign: 'center' }}>
          <div style={{ color: '#999' }}>
            契約書電子承認システム © 2026 | v1.0.0
          </div>
          <div style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
            完全無料で運営中 (PostgreSQL on Render + Netlify)
          </div>
        </Footer>
      </Layout>

      {/* Upload Modal */}
      <Modal
        title="Excel 契約書をアップロード"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
      >
        <Upload
          name="file"
          action={`${API_BASE}/contracts/upload`}
          accept=".xlsx,.xls"
          maxCount={1}
          onChange={handleUploadChange}
          listType="text"
        >
          <Button icon={<UploadOutlined />}>ファイルを選択</Button>
        </Upload>
        <p style={{ marginTop: '16px', fontSize: '12px', color: '#999' }}>
          • 対応形式: Excel (.xlsx, .xls)<br />
          • 最大ファイルサイズ: 10MB<br />
          • テンプレート: パートタイム雇用契約書に対応
        </p>
      </Modal>
    </Layout>
  );
}
