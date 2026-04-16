/**
 * 契約書内容確認画面
 * スクロール完了を検知して署名ボタンを有効にする
 * PDF表示対応
 */
import { getContractDetail } from '../api.js';
import { navigateTo, showToast } from '../main.js';

let currentSheetId = null;
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let viewMode = 'pdf'; // 'pdf' or 'html'
let isScrolled = false;

export function renderContractView(sheetId) {
  currentSheetId = sheetId;
  isScrolled = false;
  viewMode = 'pdf';
  
  return `
    <header class="app-header">
      <button class="app-header__back" id="backBtn">← 戻る</button>
      <div class="app-header__title">契約書確認</div>
      <div style="width: 60px;"></div>
    </header>
    <div class="page">
      <div id="contractContent">
        <div class="loading-page">
          <div class="spinner"></div>
          <div class="loading-text">契約書を読み込み中...</div>
        </div>
      </div>
    </div>
  `;
}

export async function initContractView() {
  document.getElementById('backBtn').addEventListener('click', () => {
    navigateTo('/contracts');
  });

  try {
    const result = await getContractDetail(currentSheetId);
    const data = result.data;
    const isSigned = data.status === 'signed' || data.status === 'completed';

    const contentEl = document.getElementById('contractContent');

    // PDF表示への試行
    let pdfUrl = null;
    const API_HOST = window.location.hostname || 'localhost';
    const token = localStorage.getItem('auth_token');
    pdfUrl = `http://${API_HOST}:5000/api/employee/contracts/${currentSheetId}/pdf?token=${token}`;

    // HTTPテストを実施（ファイアウォール回避など）
    let pdfAvailable = false;
    try {
      const headResponse = await fetch(pdfUrl, { method: 'HEAD' });
      pdfAvailable = headResponse.ok;
    } catch (e) {
      console.warn('⚠️ PDF取得テスト失敗:', e.message);
      pdfAvailable = false;
    }

    const downloadUrl = `http://${API_HOST}:5000/api/employee/contracts/${currentSheetId}/download?token=${token}`;

    const statusBadge = isSigned
      ? '<span class="tag tag--signed">✅ 署名済み</span>'
      : '<span class="tag tag--pending">📝 署名待ち</span>';

    contentEl.innerHTML = `
      <div class="card" style="cursor:default;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="word-break: break-all;">${escapeHtml(data.sheet_name)}</h3>
          ${statusBadge}
        </div>
        <div style="font-size:0.8125rem; color:var(--text-muted); margin-bottom: 12px;">
          アップロード日: ${data.uploaded_at ? new Date(data.uploaded_at).toLocaleDateString('ja-JP') : '-'}
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="${downloadUrl}" class="btn btn--outline btn--sm" download>
            ⬇️ Excelファイルをダウンロード
          </a>
          ${pdfAvailable ? '<button id="toggleViewBtn" class="btn btn--outline btn--sm">📄 表示形式を変更</button>' : ''}
        </div>
      </div>

      ${!isSigned ? `<div id="scrollNotice" class="contract-view__scroll-notice">
        ⬇️ 内容を最後までスクロールしてください
      </div>` : ''}

      <div id="viewContainer">
        ${pdfAvailable ? `
          <div id="pdfViewerContainer" style="display: none;">
            <div id="pdfControls" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <button id="pdfPrevBtn" class="btn btn--sm btn--outline">← 前ページ</button>
              <span id="pdfPageInfo" style="font-size: 0.875rem; min-width: 100px; text-align: center; color: var(--text-muted);">-</span>
              <button id="pdfNextBtn" class="btn btn--sm btn--outline">次ページ →</button>
            </div>
            <div id="pdfCanvas" style="text-align: center; overflow-x: auto; max-width: 100%;">
              <canvas id="contractPdfCanvas" style="max-width: 100%; border: 1px solid var(--border-color); border-radius: 4px; background: white;"></canvas>
            </div>
          </div>
        ` : ''}
        
        <div id="htmlViewContainer" class="contract-view__content" style="display: ${pdfAvailable ? 'none' : 'block'};">
          ${buildContentHtml(data)}
        </div>
      </div>

      ${isSigned ? `
        <div class="card card--glow-green" style="text-align:center; cursor:default;">
          <div style="font-size:2rem; margin-bottom:8px;">✅</div>
          <div style="font-weight:600; color:var(--accent-green);">署名完了</div>
          <div style="font-size:0.8125rem; color:var(--text-muted); margin-top:4px;">
            署名日時: ${data.signed_at ? new Date(data.signed_at).toLocaleString('ja-JP') : '-'}
          </div>
        </div>
      ` : `
        <button class="btn btn--primary" id="goSignBtn" ${pdfAvailable ? 'disabled' : ''}>
          🔒 署名するには最後までスクロールしてください
        </button>
      `}
    `;

    // PDF表示の初期化
    if (pdfAvailable) {
      await initPdfViewer(pdfUrl, isSigned);
      
      // トグルボタンの処理
      const toggleBtn = document.getElementById('toggleViewBtn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          toggleViewMode();
        });
      }
    }

    // スクロール検知（HTML表示モード対応）
    if (!isSigned && !pdfAvailable) {
      const htmlContainer = document.getElementById('htmlViewContainer');
      const signBtn = document.getElementById('goSignBtn');
      const notice = document.getElementById('scrollNotice');

      const checkScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = htmlContainer;
        if (scrollHeight <= clientHeight + 10) {
          enableSignButton();
          return;
        }
        if (scrollTop + clientHeight >= scrollHeight - 20) {
          enableSignButton();
        }
      };

      function enableSignButton() {
        signBtn.disabled = false;
        signBtn.innerHTML = '✍️ 署名に進む';
        notice.classList.add('contract-view__scroll-done');
        notice.innerHTML = '✅ 内容を確認しました';
      }

      htmlContainer.addEventListener('scroll', checkScroll);
      setTimeout(checkScroll, 300);

      signBtn.addEventListener('click', () => {
        navigateTo(`/sign/${currentSheetId}`);
      });
    } else if (!isSigned && pdfAvailable) {
      // PDF表示モード: PDFの最後のページを見たら署名可能
      const signBtn = document.getElementById('goSignBtn');
      signBtn?.addEventListener('click', () => {
        navigateTo(`/sign/${currentSheetId}`);
      });
    }

  } catch (error) {
    document.getElementById('contractContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__text">読み込みに失敗しました: ${escapeHtml(error.message)}</div>
      </div>
    `;
  }
}

/**
 * PDFビューアーの初期化
 */
async function initPdfViewer(pdfUrl, isSigned) {
  try {
    // PDF.jsの準備
    if (!window.pdfjsLib) {
      console.error('❌ PDF.js ライブラリが読み込まれていません');
      return;
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    console.log('📄 PDFを取得中:', pdfUrl);

    // ArrayBufferとしてPDFを取得
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`PDF取得失敗: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfDoc.numPages;

    console.log(`✅ PDF読み込み完了: ${totalPages} ページ`);

    // 最初のページを表示
    await renderPdfPage(1);

    // ページネーションボタン
    document.getElementById('pdfPrevBtn').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderPdfPage(currentPage);
      }
    });

    document.getElementById('pdfNextBtn').addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderPdfPage(currentPage);
      }
    });

    // スクロール検知（PDF表示時）
    if (!isSigned) {
      const signBtn = document.getElementById('goSignBtn');
      
      const updateSignButtonState = () => {
        if (currentPage === totalPages) {
          signBtn.disabled = false;
          signBtn.innerHTML = '✍️ 署名に進む';
          const notice = document.getElementById('scrollNotice');
          if (notice) {
            notice.classList.add('contract-view__scroll-done');
            notice.innerHTML = '✅ 最後のページを確認しました';
          }
        }
      };

      document.getElementById('pdfNextBtn').addEventListener('click', updateSignButtonState);
      document.getElementById('pdfPrevBtn').addEventListener('click', updateSignButtonState);
    }

  } catch (error) {
    console.error('❌ PDF読み込みエラー:', error);
    showToast(`PDF読み込みエラー: ${error.message}`, 'error');
    // HTMLビューにフォールバック
    viewMode = 'html';
    toggleViewMode();
  }
}

/**
 * PDFページをキャンバスに描画
 */
async function renderPdfPage(pageNumber) {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: window.innerWidth < 768 ? 1 : 1.5 });

    const canvas = document.getElementById('contractPdfCanvas');
    const context = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    
    // ページ情報を更新
    document.getElementById('pdfPageInfo').textContent = `${pageNumber} / ${totalPages}`;
    
    // ボタン状態を更新
    document.getElementById('pdfPrevBtn').disabled = pageNumber === 1;
    document.getElementById('pdfNextBtn').disabled = pageNumber === totalPages;

    console.log(`📄 ページ ${pageNumber} を描画完了`);
  } catch (error) {
    console.error('❌ PDFページ描画エラー:', error);
    showToast('ページ描画に失敗しました', 'error');
  }
}

/**
 * 表示形式の切り替え（PDF ↔ HTML）
 */
function toggleViewMode() {
  const pdfContainer = document.getElementById('pdfViewerContainer');
  const htmlContainer = document.getElementById('htmlViewContainer');
  const toggleBtn = document.getElementById('toggleViewBtn');
  const signBtn = document.getElementById('goSignBtn');

  if (viewMode === 'pdf') {
    // HTML表示に切り替え
    viewMode = 'html';
    pdfContainer.style.display = 'none';
    htmlContainer.style.display = 'block';
    if (toggleBtn) toggleBtn.innerHTML = '📄 PDF表示に戻す';
    if (signBtn) signBtn.disabled = false; // HTMLモードでは無効化しない
  } else {
    // PDF表示に切り替え
    viewMode = 'pdf';
    pdfContainer.style.display = 'block';
    htmlContainer.style.display = 'none';
    if (toggleBtn) toggleBtn.innerHTML = '📄 HTML表示に変更';
    if (signBtn) signBtn.disabled = true; // PDF表示中は無効化（最後まで見るまで）
  }
}

function buildContentHtml(data) {
  let contentHtml = '';
  if (data.sheet_data && data.sheet_data.html) {
    contentHtml = `<div style="overflow-x: auto; max-width: 100%;">${data.sheet_data.html}</div>`;
  } else if (data.sheet_data && data.sheet_data.data) {
    contentHtml = buildSheetTable(data.sheet_data.data);
  } else {
    contentHtml = `
      <div style="padding: 24px; text-align: center; color: #666;">
        <p style="font-size: 1.25rem; margin-bottom: 8px;">📄 ${escapeHtml(data.sheet_name)}</p>
        <p>契約書の内容は管理者から配布されたファイルをご確認ください。</p>
      </div>
    `;
  }
  return contentHtml;
}

function buildSheetTable(data) {
  if (!data || data.length === 0) return '<p>データがありません</p>';
  
  let html = '<div style="overflow-x: auto; max-width: 100%;"><table class="contract-view__table" style="white-space: pre-wrap; word-break: break-all; min-width: max-content;">';
  data.forEach((row, i) => {
    html += '<tr>';
    if (Array.isArray(row)) {
      row.forEach(cell => {
        let val = cell;
        if (val && typeof val === 'object') {
          if (val.result !== undefined) val = val.result;
          else if (val.text !== undefined) val = val.text;
          else val = JSON.stringify(val);
        }
        
        const isEmpty = val === null || val === undefined || String(val).trim() === '';
        const style = isEmpty ? 'border-color: transparent; background: transparent;' : '';
        const tag = i === 0 ? 'th' : 'td';
        
        html += `<${tag} style="${style}">${escapeHtml(String(val ?? ''))}</${tag}>`;
      });
    }
    html += '</tr>';
  });
  html += '</table></div>';
  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
