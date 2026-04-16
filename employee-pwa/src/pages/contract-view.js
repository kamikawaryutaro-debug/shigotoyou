/**
 * 契約書内容確認画面
 * スクロール完了を検知して署名ボタンを有効にする
 * 画像表示対応（PNG スクリーンショット）
 */
import { getContractDetail } from '../api.js';
import { navigateTo, showToast } from '../main.js';

let currentSheetId = null;
let contractImages = [];
let currentImagePage = 1;
let isScrolled = false;
let viewMode = 'image'; // 'image' or 'html'

export function renderContractView(sheetId) {
  currentSheetId = sheetId;
  isScrolled = false;
  viewMode = 'image';
  contractImages = [];
  currentImagePage = 1;
  
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

    // 画像表示への試行
    let imageUrl = null;
    const API_HOST = window.location.hostname || 'localhost';
    const token = localStorage.getItem('auth_token');
    imageUrl = `http://${API_HOST}:5000/api/employee/contracts/${currentSheetId}/images?token=${token}`;

    // 画像取得テスト
    let imageAvailable = false;
    try {
      const headResponse = await fetch(imageUrl, { method: 'HEAD' });
      imageAvailable = headResponse.ok;
    } catch (e) {
      console.warn('⚠️ 画像取得テスト失敗:', e.message);
      imageAvailable = false;
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
          ${imageAvailable ? '<button id="toggleViewBtn" class="btn btn--outline btn--sm">📄 表示形式を変更</button>' : ''}
        </div>
      </div>

      ${!isSigned ? `<div id="scrollNotice" class="contract-view__scroll-notice">
        ⬇️ 全ページをご確認ください
      </div>` : ''}

      <div id="viewContainer">
        ${imageAvailable ? `
          <div id="imageViewerContainer">
            <div id="imageControls" style="margin: 12px 0; display: flex; align-items: center; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <button id="imagePrevBtn" class="btn btn--sm btn--outline">← 前ページ</button>
              <span id="imagePageInfo" style="font-size: 0.875rem; min-width: 120px; text-align: center; color: var(--text-muted);">読み込み中...</span>
              <button id="imageNextBtn" class="btn btn--sm btn--outline">次ページ →</button>
            </div>
            <div id="imageCanvas" style="text-align: center; overflow-x: auto; max-width: 100%; margin-bottom: 12px;">
              <img id="contractImage" src="" alt="契約書" style="max-width: 100%; border: 1px solid var(--border-color); border-radius: 4px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
            </div>
          </div>
        ` : ''}
        
        <div id="htmlViewContainer" style="display: ${imageAvailable ? 'none' : 'block'};">
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
        <button class="btn btn--primary" id="goSignBtn" ${imageAvailable ? 'disabled' : ''}>
          🔒 最後のページを確認してから署名してください
        </button>
      `}
    `;

    // 画像表示の初期化
    if (imageAvailable) {
      await initImageViewer(imageUrl, isSigned);
      
      // トグルボタンの処理
      const toggleBtn = document.getElementById('toggleViewBtn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          toggleViewMode();
        });
      }
    } else if (!isSigned) {
      // HTML表示モードの場合、スクロール検知を設定
      const htmlContainer = document.getElementById('htmlViewContainer');
      const signBtn = document.getElementById('goSignBtn');

      if (htmlContainer) {
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
          const notice = document.getElementById('scrollNotice');
          if (notice) {
            notice.classList.add('contract-view__scroll-done');
            notice.innerHTML = '✅ 内容を確認しました';
          }
        }

        htmlContainer.addEventListener('scroll', checkScroll);
        setTimeout(checkScroll, 300);
      }

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
 * 画像ビューアーの初期化
 */
async function initImageViewer(imageUrl, isSigned) {
  try {
    console.log('📄 契約書画像を取得中:', imageUrl);

    // 画像データを取得
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`画像取得失敗: HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error('画像データが取得できませんでした。');
    }

    contractImages = result.data;
    console.log(`✅ ${contractImages.length} ページを読み込み完了`);

    // 最初のページを表示
    await renderImagePage(1);

    // ページネーションボタン
    document.getElementById('imagePrevBtn').addEventListener('click', () => {
      if (currentImagePage > 1) {
        currentImagePage--;
        renderImagePage(currentImagePage);
      }
    });

    document.getElementById('imageNextBtn').addEventListener('click', () => {
      if (currentImagePage < contractImages.length) {
        currentImagePage++;
        renderImagePage(currentImagePage);
      }
    });

    // スクロール検知（画像表示時）
    if (!isSigned) {
      const signBtn = document.getElementById('goSignBtn');
      
      const updateSignButtonState = () => {
        if (currentImagePage === contractImages.length) {
          signBtn.disabled = false;
          signBtn.innerHTML = '✍️ 署名に進む';
          const notice = document.getElementById('scrollNotice');
          if (notice) {
            notice.classList.add('contract-view__scroll-done');
            notice.innerHTML = '✅ 最後のページを確認しました';
          }
        }
      };

      document.getElementById('imageNextBtn').addEventListener('click', updateSignButtonState);
      
      signBtn?.addEventListener('click', () => {
        navigateTo(`/sign/${currentSheetId}`);
      });
    }

  } catch (error) {
    console.error('❌ 画像読み込みエラー:', error);
    showToast(`画像読み込みエラー: ${error.message}`, 'error');
    // HTMLビューにフォールバック
    viewMode = 'html';
    toggleViewMode();
  }
}

/**
 * 画像ページをレンダリング
 */
async function renderImagePage(pageNumber) {
  try {
    if (pageNumber < 1 || pageNumber > contractImages.length) {
      return;
    }

    const imageData = contractImages[pageNumber - 1];
    const img = document.getElementById('contractImage');
    
    // Base64をDataURLに変換して表示
    img.src = `data:${imageData.mimeType};base64,${imageData.base64}`;
    
    // ページ情報を更新
    document.getElementById('imagePageInfo').textContent = `${pageNumber} / ${contractImages.length}`;
    
    // ボタン状態を更新
    document.getElementById('imagePrevBtn').disabled = pageNumber === 1;
    document.getElementById('imageNextBtn').disabled = pageNumber === contractImages.length;

    console.log(`📄 ページ ${pageNumber} を表示`);
  } catch (error) {
    console.error('❌ ページ表示エラー:', error);
    showToast('ページ表示に失敗しました', 'error');
  }
}

/**
 * 表示形式の切り替え（画像 ↔ HTML）
 */
function toggleViewMode() {
  const imageContainer = document.getElementById('imageViewerContainer');
  const htmlContainer = document.getElementById('htmlViewContainer');
  const toggleBtn = document.getElementById('toggleViewBtn');
  const signBtn = document.getElementById('goSignBtn');

  if (viewMode === 'image') {
    // HTML表示に切り替え
    viewMode = 'html';
    imageContainer.style.display = 'none';
    htmlContainer.style.display = 'block';
    if (toggleBtn) toggleBtn.innerHTML = '📄 画像表示に戻す';
    if (signBtn) signBtn.disabled = false; // HTMLモードでは無効化しない
  } else {
    // 画像表示に切り替え
    viewMode = 'image';
    imageContainer.style.display = 'block';
    htmlContainer.style.display = 'none';
    if (toggleBtn) toggleBtn.innerHTML = '📄 HTML表示に変更';
    if (signBtn) signBtn.disabled = true; // 画像表示中は無効化（最後まで見るまで）
  }
}

function buildContentHtml(data) {
  let contentHtml = '';
  if (data.sheet_data && data.sheet_data.html) {
    contentHtml = `<div style="overflow-x: auto; max-width: 100%; padding: 12px; background: #f5f5f5; border-radius: 4px;">${data.sheet_data.html}</div>`;
  } else if (data.sheet_data && data.sheet_data.data) {
    contentHtml = buildSheetTable(data.sheet_data.data);
  } else {
    contentHtml = `
      <div style="padding: 24px; text-align: center; color: #666;">
        <p style="font-size: 1.25rem; margin-bottom: 8px;">📄 ${escapeHtml(data.sheet_name)}</p>
        <p>契約書の内容は上記の画像をご確認ください。</p>
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
