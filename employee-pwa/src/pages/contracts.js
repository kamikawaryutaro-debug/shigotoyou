/**
 * 契約書一覧画面
 */
import { getContracts, getUserInfo, clearToken } from '../api.js';
import { navigateTo, showToast } from '../main.js';

export function renderContracts() {
  const user = getUserInfo();
  const name = user ? user.full_name : '';
  const initial = name ? name.charAt(0) : '?';

  return `
    <header class="app-header">
      <div class="app-header__title">📋 契約書一覧</div>
      <div class="app-header__user" style="display:flex; align-items:center;">
        <button id="lineLinkBtn" class="btn btn--secondary btn--sm" style="margin-right:8px; padding:6px 10px; font-size:12px; background-color:#06C755; color:white; border:none; border-radius:4px; font-weight:bold;">LINE連携</button>
        <div class="app-header__avatar">${initial}</div>
        <button class="btn btn--ghost btn--sm" id="logoutBtn" style="width:auto; padding:6px 12px; margin-left:8px;">ログアウト</button>
      </div>
    </header>
    <div class="page">
      <div class="stats-row" id="statsRow">
        <div class="stat-card">
          <div class="stat-card__value stat-card__value--orange" id="statPending">-</div>
          <div class="stat-card__label">署名待ち</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value stat-card__value--green" id="statSigned">-</div>
          <div class="stat-card__label">署名済み</div>
        </div>
      </div>
      
      <div class="section-title">あなたの契約書</div>
      <div id="contractList">
        <div class="loading-page">
          <div class="spinner"></div>
          <div class="loading-text">読み込み中...</div>
        </div>
      </div>
    </div>
  `;
}

export async function initContracts() {
  // URLパラメータチェック（LINE連携結果）
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('line_success')) {
    setTimeout(() => showToast('LINEアカウントの連携が完了しました！', 'success'), 500);
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('line_error')) {
    setTimeout(() => showToast('LINE連携に失敗しました', 'error'), 500);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // ログアウトボタン
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    navigateTo('/login');
  });

  // LINE連携ボタン
  const lineLinkBtn = document.getElementById('lineLinkBtn');
  if (lineLinkBtn) {
    lineLinkBtn.addEventListener('click', async () => {
      try {
        lineLinkBtn.classList.add('btn--loading');
        const { getLineLoginUrl } = await import('../api.js');
        const data = await getLineLoginUrl();
        if (data.success && data.url) {
          window.location.href = data.url;
        } else {
          showToast('LINE画面の表示に失敗しました', 'error');
          lineLinkBtn.classList.remove('btn--loading');
        }
      } catch (e) {
        showToast('エラーが発生しました', 'error');
        lineLinkBtn.classList.remove('btn--loading');
      }
    });
  }

  // 契約書一覧を取得
  try {
    const result = await getContracts();
    const contracts = result.data || [];
    
    // 統計更新
    const pending = contracts.filter(c => c.status !== 'signed' && c.status !== 'completed').length;
    const signed = contracts.filter(c => c.status === 'signed' || c.status === 'completed').length;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statSigned').textContent = signed;

    // リスト描画
    const listEl = document.getElementById('contractList');

    if (contracts.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📄</div>
          <div class="empty-state__text">契約書はまだありません</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = contracts.map(contract => {
      const isSigned = contract.status === 'signed' || contract.status === 'completed';
      const icon = isSigned ? '✅' : '📄';
      const iconClass = isSigned ? 'contract-item__icon--signed' : 'contract-item__icon--pending';
      const date = contract.uploaded_at
        ? new Date(contract.uploaded_at).toLocaleDateString('ja-JP')
        : '';

      return `
        <div class="contract-item" data-sheet-id="${contract.sheet_id}">
          <div class="contract-item__icon ${iconClass}">${icon}</div>
          <div class="contract-item__info">
            <div class="contract-item__name">${escapeHtml(contract.sheet_name || contract.file_name)}</div>
            <div class="contract-item__date">
              ${date}
              <span class="tag tag--${isSigned ? 'signed' : 'pending'}" style="margin-left: 8px;">
                ${contract.status_text || (isSigned ? '署名完了' : '署名待ち')}
              </span>
            </div>
          </div>
          <div class="contract-item__arrow">›</div>
        </div>
      `;
    }).join('');

    // クリックイベント
    listEl.querySelectorAll('.contract-item').forEach(item => {
      item.addEventListener('click', () => {
        const sheetId = item.dataset.sheetId;
        navigateTo(`/contracts/${sheetId}`);
      });
    });

  } catch (error) {
    document.getElementById('contractList').innerHTML = `
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
