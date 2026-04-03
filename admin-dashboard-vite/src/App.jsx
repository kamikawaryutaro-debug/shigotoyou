import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import './App.css';

// Pages
import DashboardPage from './pages/DashboardPage';
import ContractsPage from './pages/ContractsPage';
import SignaturesPage from './pages/SignaturesPage';
import EmployeesPage from './pages/EmployeesPage';

const { Header, Sider, Content, Footer } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'ダッシュボード' },
  { key: '/contracts', icon: <FileTextOutlined />, label: '契約書管理' },
  { key: '/signatures', icon: <CheckCircleOutlined />, label: '署名管理' },
  { key: '/employees', icon: <UserOutlined />, label: '従業員管理' },
];

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  // 現在のパスに基づいてメニューのselectedKeysを設定
  const selectedKey = menuItems.find(item => 
    item.key === location.pathname || 
    (item.key !== '/' && location.pathname.startsWith(item.key))
  )?.key || '/';

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
          selectedKeys={[selectedKey]}
          onClick={handleMenuClick}
          items={menuItems}
        />
      </Sider>

      {/* メインコンテンツ */}
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
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

        {/* ルーティング */}
        <Content style={{ margin: '24px 16px', padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 160px)' }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/signatures" element={<SignaturesPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
          </Routes>
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
    </Layout>
  );
}
