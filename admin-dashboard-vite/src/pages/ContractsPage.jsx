import React, { useState, useEffect } from 'react';
import {
  Card, Table, Upload, Modal, Button, message, Space, Tag, Input, Popconfirm, Descriptions, List,
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  UploadOutlined, EyeOutlined, DeleteOutlined, PlusOutlined,
  SearchOutlined, ReloadOutlined, DownloadOutlined,
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

  const handleDownloadPdf = async (sheetId) => {
    const hide = message.loading('PDFを生成中...', 0);
    try {
      // 署名情報を取得（HTML内容を含む）
      const res = await axios.get(`${API_BASE}/admin/signatures/${sheetId}`);
      if (!res.data.success || !res.data.data.htmlContent) {
        throw new Error('契約書データの取得に失敗しました');
      }

      const { sheet, signature, htmlContent } = res.data.data;

      // PDF生成用の臨時コンテナ
      const container = document.createElement('div');
      // 画面に一瞬表示されるのを防ぎつつ、サイズだけ正しく計算させる
      container.style.position = 'absolute';
      container.style.visibility = 'hidden';
      container.style.zIndex = '-9999';
      container.style.top = '0';
      container.style.left = '0';
      container.style.background = 'white';

      const contentDiv = document.createElement('div');
      contentDiv.style.width = 'max-content';
      contentDiv.style.padding = '20px';
      contentDiv.style.background = 'white';
      contentDiv.style.fontFamily = 'serif';
      contentDiv.style.color = 'black';

      contentDiv.innerHTML = `
        <div style="margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; width: 100%;">
          <h1 style="font-size: 18px; margin: 0;">${sheet.file_name}</h1>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">署名済み控え (管理番号: ${sheet.contract_id})</p>
        </div>
        <div class="pdf-content" style="padding-bottom: 20px;">
          ${htmlContent}
          
          <!-- サインを表の下（右寄せ）に静的配置（絶対配置を廃止） -->
          ${signature && signature.signature_data ? `
          <div style="text-align: right; margin-top: 15px;">
            <div style="display: inline-block; text-align: center; border: 2px solid #b30000; padding: 10px; background-color: #ffffff; min-width: 200px;">
              <div style="color: #b30000; font-size: 14px; font-weight: bold; margin-bottom: 5px;">【電子署名済】</div>
              <img src="${signature.signature_data}" style="max-width: 200px; max-height: 80px; display: block; margin: 0 auto;" />
              <div style="color: #333; font-size: 11px; margin-top: 5px; text-align: right;">日付: ${new Date(sheet.signed_at).toLocaleDateString('ja-JP')}</div>
            </div>
          </div>
          ` : ''}
        </div>
        <div style="margin-top: 20px; font-size: 9px; color: #aaa; text-align: center; width: 100%;">
          本ドキュメントは「電子承認システム」にて正式に署名・合意されたものです。
        </div>
      `;

      container.appendChild(contentDiv);
      document.body.appendChild(container);

      // 1枚に確実に収めるためのサイズ計算（A4横: 297x210, マージン各10mm、安全マージン2%）
      const pdfInnerWidth = 297 - 20; // 277mm
      const pdfInnerHeight = 210 - 20; // 190mm
      const targetRatio = (pdfInnerWidth / pdfInnerHeight) * 1.02;

      const rect = contentDiv.getBoundingClientRect();
      const actualWidth = rect.width;
      const actualHeight = rect.height;
      const currentRatio = actualWidth / actualHeight;

      let finalWidth = actualWidth;

      if (currentRatio < targetRatio) {
        // 高さがオーバーする場合は、横幅を広げてA4比率にし、1ページに強制フィットさせる
        finalWidth = actualHeight * targetRatio;
        const padX = (finalWidth - actualWidth) / 2;
        contentDiv.style.marginLeft = `${padX}px`;
        contentDiv.style.marginRight = `${padX}px`;
      }
      
      container.style.width = `${finalWidth}px`;

      // 元の安定した方式（DOMから切り離す）に戻す
      container.style.position = 'static';
      container.style.visibility = 'visible';
      container.style.zIndex = 'auto';

      document.body.removeChild(container);

      const opt = {
        margin: [10, 10],
        filename: `signed_${sheet.full_name || 'contract'}_${sheet.sheet_name}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          windowWidth: Math.ceil(finalWidth),
          width: Math.ceil(finalWidth),
          windowHeight: Math.ceil(actualHeight),
          height: Math.ceil(actualHeight)
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } // 横向き
      };

      await window.html2pdf().set(opt).from(container).save();
      message.success('PDFをダウンロードしました');
    } catch (error) {
      console.error(error);
      message.error('PDF生成に失敗しました');
    } finally {
      // 処理完了後にコンテナを削除
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      hide();
    }
  };

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
    // If using default multiple upload, options.file is the current file. To upload all at once, 
    // it's better to intercept beforeUpload and handle custom fetch. 
    // But since Ant Design's Upload calls customRequest per file by default, 
    // we should override it to do a batch upload, OR just let it send multiple requests.
    // For PDF folders, sending one big request is best. We will capture fileList on beforeUpload.
    // Wait, modifying customUpload for antd to batch is tricky. Let's just create a simple batch function instead.
  };

  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleBatchUpload = async () => {
    if (fileList.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    // If it's a single Excel file
    if (fileList.length === 1 && !fileList[0].name.toLowerCase().endsWith('.pdf')) {
      formData.append('file', fileList[0]);
    } else {
      // Loop files
      fileList.forEach(f => formData.append('files', f));
    }

    try {
      const res = await axios.post(`${API_BASE}/contracts/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        message.success('一括アップロード成功');
        setUploadModalVisible(false);
        setFileList([]);
        fetchContracts();
      } else {
        message.error(`エラー: ${res.data.error || 'アップロード失敗'}`);
      }
    } catch (err) {
      console.error(err);
      message.error(`アップロード失敗`);
    } finally {
      setUploading(false);
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
        title="契約書（Excel / PDFフォルダ）をアップロード"
        open={uploadModalVisible}
        onCancel={() => { setUploadModalVisible(false); setFileList([]); }}
        footer={[
          <Button key="cancel" onClick={() => { setUploadModalVisible(false); setFileList([]); }}>キャンセル</Button>,
          <Button key="upload" type="primary" onClick={handleBatchUpload} loading={uploading} disabled={fileList.length === 0}>
            アップロード実行
          </Button>
        ]}
      >
        <Upload
          beforeUpload={(file) => {
            setFileList(prev => [...prev, file]);
            return false; // Prevent auto upload
          }}
          onRemove={(file) => {
            setFileList(prev => prev.filter(f => f.uid !== file.uid));
          }}
          fileList={fileList}
          accept=".xlsx,.xls,.pdf"
          multiple={true}
          directory={true}
          listType="text"
        >
          <Button icon={<UploadOutlined />}>ファイルまたはフォルダを選択</Button>
        </Upload>
        <p style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
          • 対応形式1: Excel (.xlsx, .xls) の単一ファイル<br />
          • 対応形式2: 複数の PDFファイル（ファイル名を「従業員名.pdf」にしてフォルダごとの選択も可能）<br />
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
                  {sheet.status === 'signed' && (
                    <Button
                      type="link"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownloadPdf(sheet.id)}
                      title="署名済みPDFをダウンロード"
                    />
                  )}
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
