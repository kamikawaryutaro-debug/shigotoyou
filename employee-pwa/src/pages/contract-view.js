/**
 * 契約書内容確認画面
 * スクロール完了を検知して署名ボタンを有効にする
 */
import { getContractDetail } from '../api.js';
import { navigateTo, showToast } from '../main.js';

let currentSheetId = null;

export function renderContractView(sheetId) {
  currentSheetId = sheetId;
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

    // エクセルの画面プレビュー（崩れる原因）を削除
    const API_HOST = window.location.hostname || 'localhost';
    const downloadUrl = `http://${API_HOST}:5000/api/employee/contracts/${currentSheetId}/download?token=${localStorage.getItem('auth_token')}`;

    const statusBadge = isSigned
      ? '<span class="tag tag--signed">✅ 署名済み</span>'
      : '<span class="tag tag--pending">📝 署名待ち</span>';

    contentEl.innerHTML = `
      <div class="card" style="cursor:default; text-align: center; padding: 32px 16px;">
        <div style="font-size: 3.5rem; margin-bottom: 16px;">📄</div>
        <h3 style="word-break: break-all; margin-bottom: 12px; font-size: 1.25rem;">${escapeHtml(data.sheet_name)}</h3>
        <div style="margin-bottom: 24px;">${statusBadge}</div>
        
        <p style="font-size: 0.9375rem; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.6;">
          正確なレイアウトで内容を確認するため、以下のボタンから元のファイルを開いてご確認ください。
        </p>

        <a href="${downloadUrl}" id="downloadLink" class="btn btn--primary" style="display: block; width: 100%; padding: 16px; font-size: 1.1rem; box-shadow: 0 4px 12px rgba(13, 110, 253, 0.2); margin-bottom: 16px;" download>
          ⬇️ 契約書ファイルを開く
        </a>
        <div style="font-size:0.75rem; color:var(--text-muted);">
          アップロード日: ${data.uploaded_at ? new Date(data.uploaded_at).toLocaleDateString('ja-JP') : '-'}
        </div>
      </div>

      ${isSigned ? `
        <div class="card card--glow-green" style="text-align:center; cursor:default; margin-top: 24px;">
          <div style="font-size:2rem; margin-bottom:8px;">✅</div>
          <div style="font-weight:600; color:var(--accent-green);">署名完了</div>
          <div style="font-size:0.8125rem; color:var(--text-muted); margin-top:4px;">
            署名日時: ${data.signed_at ? new Date(data.signed_at).toLocaleString('ja-JP') : '-'}
          </div>
        </div>
      ` : `
        <div style="margin-top: 24px;">
          <button class="btn" id="goSignBtn" style="background-color: var(--accent-green); color: white; border: none; width: 100%; opacity: 0.5;" disabled>
            🔒 ファイルを開くと署名できます
          </button>
        </div>
      `}
    `;

    // 署名ボタンの制御（ファイルを開いた後に有効化）
    if (!isSigned) {
      const signBtn = document.getElementById('goSignBtn');
      const downloadLink = document.getElementById('downloadLink');

      downloadLink.addEventListener('click', () => {
        // タップ後、少し遅延させてボタンを有効化（スマホの挙動対応）
        setTimeout(() => {
          signBtn.disabled = false;
          signBtn.style.opacity = '1';
          signBtn.innerHTML = '✍️ 内容を確認して署名に進む';
        }, 1000);
      });

      signBtn.addEventListener('click', () => {
        if (!signBtn.disabled) {
          navigateTo(`/sign/${currentSheetId}`);
        }
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
