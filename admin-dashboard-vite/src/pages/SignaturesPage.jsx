import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tabs, Button, message, Space, Tag, Modal, Descriptions, Avatar, Empty,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EyeOutlined,
  UserOutlined, ReloadOutlined, EditOutlined, DownloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import API_BASE from '../api-config';

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState(null);

  const handleDownloadPdf = async (sheetId) => {
    const hide = message.loading('PDFを生成中...', 0);
    let container = null;
    try {
      const res = await axios.get(`${API_BASE}/admin/signatures/${sheetId}`);
      if (!res.data.success || !res.data.data.htmlContent) {
        throw new Error('契約書データの取得に失敗しました');
      }

      const { sheet, htmlContent } = res.data.data;

      // PDF生成用の臨時コンテナ
      container = document.createElement('div');
      container.id = 'pdf-temp-container';
      
      // html2canvasが描画できるように表示状態にするが、z-indexで背面に隠して見えないようにする
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.zIndex = '-9999';
      container.style.background = 'white';
      container.style.visibility = 'visible';

      const contentDiv = document.createElement('div');
      contentDiv.style.width = 'max-content';
      contentDiv.style.padding = '20px';
      contentDiv.style.background = 'white';
      contentDiv.style.fontFamily = 'serif';
      contentDiv.style.color = 'black';

      // バックエンドが署名画像を含むHTMLを返すため、そのまま使用する
      contentDiv.innerHTML = `
        <div style="margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; width: 100%;">
          <h1 style="font-size: 18px; margin: 0;">${sheet.file_name}</h1>
          <p style="margin: 5px 0 0 0; color: #666;">署名済みドキュメント (管理番号: ${sheet.contract_id})</p>
        </div>
        <div class="pdf-content" style="padding-bottom: 20px;">
          ${htmlContent}
        </div>
        <div style="margin-top: 20px; font-size: 9px; color: #aaa; text-align: center; width: 100%;">
          このドキュメントは「電子承認システム」によって生成されました。
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
        // 高さがオーバーする場合は、横幅を左右paddingで広げてA4比率にし、1ページに強制フィットさせる
        finalWidth = actualHeight * targetRatio;
        const padX = (finalWidth - actualWidth) / 2;
        contentDiv.style.marginLeft = `${padX}px`;
        contentDiv.style.marginRight = `${padX}px`;
      }
      
      container.style.width = `${finalWidth}px`;

      // html2canvasが確実に画像をキャプチャできるよう、すべての画像のロード完了を待つ
      const images = Array.from(container.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve; // エラーでも止まらないようにする
        });
      }));

      // html2pdfが処理を完了するまで少し待機（DOMのレンダリング完了待ち）
      await new Promise(resolve => setTimeout(resolve, 300));

      // html2canvasを手動で実行し、生成されたCanvasに直接画像を合成する（html2canvasの絶対配置バグ回避のため）
      const canvas = await window.html2canvas(container, {
        scale: 2, 
        useCORS: true, 
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.ceil(finalWidth),
        width: Math.ceil(finalWidth),
        windowHeight: Math.ceil(actualHeight),
        height: Math.ceil(actualHeight)
      });

      const ctx = canvas.getContext('2d');
      const previewContainer = container.querySelector('.excel-preview-container');
      
      if (previewContainer) {
        const rectContainer = container.getBoundingClientRect();
        const rectPreview = previewContainer.getBoundingClientRect();
        const offsetX = rectPreview.left - rectContainer.left;
        const offsetY = rectPreview.top - rectContainer.top;

        // 絶対配置されている画像（ハンコや署名）を抽出してCanvasに上書き描画
        const absoluteImages = images.filter(img => img.style.position === 'absolute');
        for (const img of absoluteImages) {
          const left = parseFloat(img.style.left) || 0;
          const top = parseFloat(img.style.top) || 0;
          
          let drawWidth = parseFloat(img.style.width) || img.naturalWidth;
          let drawHeight = parseFloat(img.style.height) || img.naturalHeight;
          
          // object-fit: contain や max-height の反映
          if (img.style.maxHeight && img.style.height === '') {
            const maxH = parseFloat(img.style.maxHeight);
            const ratio = img.naturalWidth / img.naturalHeight;
            if (img.naturalHeight > maxH) {
              drawHeight = maxH;
              drawWidth = maxH * ratio;
            } else {
              drawHeight = img.naturalHeight;
              drawWidth = img.naturalWidth;
            }
          }
          
          const finalX = (offsetX + left) * 2;
          const finalY = (offsetY + top) * 2;
          
          ctx.globalAlpha = parseFloat(img.style.opacity) || 1.0;
          ctx.drawImage(img, finalX, finalY, drawWidth * 2, drawHeight * 2);
          ctx.globalAlpha = 1.0; // リセット
        }
      }

      const opt = {
        margin: [10, 10],
        filename: `signed_${sheet.full_name || 'contract'}_${sheet.sheet_name}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      // 合成済みのCanvasから直接PDFを生成
      await window.html2pdf().set(opt).from(canvas).save();
      message.success('PDFが保存されました');
    } catch (error) {
      console.error(error);
      message.error(`エラー: ${error.response?.data?.error || error.message || '不明なエラー'}`);
    } finally {
      // 処理完了後にコンテナを確実に削除
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      hide();
    }
  };

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
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            閉じる
          </Button>,
          selectedSignature?.sheet?.status === 'signed' && (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadPdf(selectedSignature.sheet.id)}
            >
              署名した内容のPDFダウンロード
            </Button>
          )
        ]}
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
