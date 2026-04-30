/**
 * 契約書内容確認画面
 * スクロール完了を検知して署名ボタンを有効にする
 * 高品質な画像プレビュー（LibreOffice + Ghostscript）対応版
 */
import { getContractDetail, API_BASE } from '../api.js';
import { navigateTo, showToast } from '../main.js';

let currentSheetId = null;
let currentImagePage = 1;
let contractImages = [];
let viewMode = 'image'; // 'image' or 'html'

export function renderContractView(sheetId) {
  currentSheetId = sheetId;
  contractImages = [];
  viewMode = 'html';

  return `
    <header class="app-header">
      <button class="app-header__back" id="backBtn">← 戻る</button>
      <div class="app-header__title">契約書確認</div>
      <div style="width: 60px;"></div>
    </header>
    <div class="page page--wide">
      <div id="contractContent">
        <div class="loading-page">
          <div class="spinner"></div>
          <div class="loading-text">契約書を読み込んでいます...</div>
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
    const downloadUrl = `${API_BASE}/employee/contracts/${currentSheetId}/download?token=${localStorage.getItem('auth_token')}`;
    const imageUrl = `${API_BASE}/employee/contracts/${currentSheetId}/images?token=${localStorage.getItem('auth_token')}`;

    const statusBadge = isSigned
      ? '<span class="tag tag--signed">✅ 署名済み</span>'
      : '<span class="tag tag--pending">📝 署名待ち</span>';

    contentEl.innerHTML = `
      <div class="card" style="padding: 12px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="font-size: 1rem; margin-bottom: 0;">${escapeHtml(data.sheet_name)}</h3>
          ${statusBadge}
        </div>

        <div id="scrollNotice" class="contract-view__scroll-notice">
          <span>👇 内容を最後まで確認してください</span>
        </div>

        <!-- 契約書プレビュー -->
        <div id="htmlViewContainer" class="contract-view__content excel-grid" style="display: block; height: 75vh; overflow: auto; -webkit-overflow-scrolling: touch; background: white; border-radius: 8px; border: 1px solid #e0e0e0; padding: 0;">
          ${data.is_direct_pdf ? `
            <iframe src="${API_BASE}/employee/contracts/${currentSheetId}/pdf?token=${localStorage.getItem('auth_token')}" style="width: 100%; height: 100%; border: none;"></iframe>
          ` : (data.sheet_data && data.sheet_data.html ? `
            ${data.sheet_data.html}
          ` : '<p style="padding: 20px; text-align: center; color: #999;">表示可能なデータがありません</p>')}
        </div>

        <div style="margin-top: 16px; text-align: center;">
          <a href="${data.is_direct_pdf ? `${API_BASE}/employee/contracts/${currentSheetId}/pdf?token=${localStorage.getItem('auth_token')}` : downloadUrl}" class="btn btn--ghost btn--sm" style="width: auto;" download>
            ⬇️ オリジナル(${data.is_direct_pdf ? 'PDF' : 'Excel'})をダウンロード
          </a>
        </div>
      </div>

      ${isSigned ? `
        <div class="card card--glow-green" style="text-align:center; cursor:default; margin-top: 24px;">
          <div style="font-size:2rem; margin-bottom:8px;">✅</div>
          <div style="font-weight:600; color:var(--accent-green);">署名完了</div>
          <div style="margin-top:4px; font-size:0.8125rem; color:var(--text-muted);">
            ${data.signed_at ? new Date(data.signed_at).toLocaleString('ja-JP') : '-'}
          </div>
          <button class="btn btn--secondary" id="downloadSignedPdfBtn" style="margin-top: 16px; width: 100%;">
            📄 署名済みPDFをダウンロード
          </button>
        </div>
      ` : `
        <div style="margin-top: 24px;">
          <button class="btn" id="goSignBtn" style="background-color: var(--accent-green); color: white; border: none; width: 100%; opacity: 0.5;" disabled>
            🔒 最後まで確認すると署名できます
          </button>
        </div>
      `}
      `;

    // 署名済みPDFダウンロードのリスナー
    if (isSigned) {
      document.getElementById('downloadSignedPdfBtn').addEventListener('click', async () => {
        const btn = document.getElementById('downloadSignedPdfBtn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '⌛ 生成中...';
        let container = null;

        try {
          // html2pdfの設定用コンテナ
          container = document.createElement('div');
          // 画面に一瞬表示されるのを防ぎつつ、サイズだけ正しく計算させる
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
          contentDiv.style.fontFamily = 'sans-serif';
          contentDiv.style.color = 'black';

          contentDiv.innerHTML = `
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; width: 100%;">
              <h1 style="font-size: 1.2rem; margin: 0;">${data.file_name}</h1>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 0.8rem;">署名済み控え (管理番号: ${data.contract_id})</p>
            </div>
            <div style="font-size: 10pt; padding-bottom: 20px;">
              ${data.sheet_data.html}

              <!-- サインを表の下（右寄せ）に静的配置（絶対配置を廃止） -->
              ${data.signature_data ? `
              <div style="text-align: right; margin-top: 15px;">
                <div style="display: inline-block; text-align: center; border: 2px solid #b30000; padding: 10px; background-color: #ffffff; min-width: 200px;">
                  <div style="color: #b30000; font-size: 14px; font-weight: bold; margin-bottom: 5px;">【電子署名済】</div>
                  <img src="${data.signature_data}" style="max-width: 200px; max-height: 80px; display: block; margin: 0 auto;" />
                  <div style="color: #333; font-size: 11px; margin-top: 5px; text-align: right;">日付: ${new Date(data.signed_at).toLocaleDateString('ja-JP')}</div>
                </div>
              </div>
              ` : ''}
            </div>
          `;

          container.appendChild(contentDiv);
          document.body.appendChild(container);

          // 1枚に確実に収めるためのサイズ計算（A4横: 297x210, マージン各5mm、安全マージン2%）
          const pdfInnerWidth = 297 - 10; // 287mm
          const pdfInnerHeight = 210 - 10; // 200mm
          const targetRatio = (pdfInnerWidth / pdfInnerHeight) * 1.02; // 安全マージンを加味して縦にはみ出ないようにする

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

          // 画像のロード完了を待つ
          const images = Array.from(container.querySelectorAll('img'));
          await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }));

          await new Promise(resolve => setTimeout(resolve, 300));

          // html2canvasを手動で実行し、生成されたCanvasに直接画像を合成する
          const canvas = await window.html2canvas(container, {
            scale: 2, 
            useCORS: true, 
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

            const absoluteImages = images.filter(img => img.style.position === 'absolute');
            for (const img of absoluteImages) {
              const left = parseFloat(img.style.left) || 0;
              const top = parseFloat(img.style.top) || 0;
              
              let drawWidth = parseFloat(img.style.width) || img.naturalWidth;
              let drawHeight = parseFloat(img.style.height) || img.naturalHeight;
              
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
              ctx.globalAlpha = 1.0;
            }
          }

          const opt = {
            margin: [5, 5],
            filename: `signed_${data.file_name.replace('.xlsx', '.pdf')}`,
            image: { type: 'jpeg', quality: 0.98 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } // 横向き
          };

          // 合成済みのCanvasから直接PDFを生成
          await window.html2pdf().set(opt).from(canvas).save();
          showToast('PDFをダウンロードしました');
        } catch (error) {
          console.error(error);
          showToast('PDFの作成に失敗しました');
        } finally {
          // 処理完了後にコンテナを削除
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
          btn.disabled = false;
          btn.innerText = originalText;
        }
      });
    }

    // 3. Excel テーブルのスケール調整（画面幅に合わせて縮小表示）
    if (!data.is_direct_pdf) {
      const htmlContainer = document.getElementById('htmlViewContainer');
      const table = document.getElementById('contract-table');
      if (table && htmlContainer) {
        // テーブルの自然な幅を取得
        const tableWidth = table.scrollWidth;
        const containerWidth = htmlContainer.clientWidth;
        if (tableWidth > containerWidth && tableWidth > 0) {
          const scale = containerWidth / tableWidth;
          const previewContainer = table.closest('.excel-preview-container');
          if (previewContainer) {
            previewContainer.style.transform = `scale(${scale})`;
            previewContainer.style.transformOrigin = 'top left';
            // コンテナの高さを縮小後に合わせる
            previewContainer.style.width = `${tableWidth}px`;
            const tableHeight = previewContainer.scrollHeight;
            htmlContainer.style.height = `${Math.ceil(tableHeight * scale) + 20}px`;
          }
        }
      }
    }

    // 4. 署名ボタン (HTMLモード用スクロール検知も兼ねる)
    if (!isSigned) {
      const signBtn = document.getElementById('goSignBtn');
      signBtn.addEventListener('click', () => {
        if (!signBtn.disabled) {
          navigateTo(`/sign/${currentSheetId}`);
        }
      });

      const htmlContainer = document.getElementById('htmlViewContainer');
      htmlContainer.addEventListener('scroll', () => {
        if (viewMode === 'html') {
          const isBottom = htmlContainer.scrollHeight - htmlContainer.scrollTop <= htmlContainer.clientHeight + 50;
          if (isBottom) {
            enableSignButton();
          }
        }
      });
    }

  } catch (error) {
    document.getElementById('contractContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__text">読み込み失敗: ${escapeHtml(error.message)}</div>
      </div>
    `;
  }
}

function enableSignButton(msg = '✍️ 内容を確認したので署名に進む') {
  const signBtn = document.getElementById('goSignBtn');
  const notice = document.getElementById('scrollNotice');
  if (signBtn) {
    signBtn.disabled = false;
    signBtn.style.opacity = '1';
    signBtn.innerHTML = msg;
  }
  if (notice) {
    notice.classList.add('contract-view__scroll-done');
    notice.innerHTML = '✨ 確認完了。下のボタンから署名してください。';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
