/**
 * API通信モジュール
 * JWTトークン付きfetchラッパー
 */

// API の URL を決定
// localStorage または URLパラメータ (?api=...) で一時的に接続先を変更できるように調整
const getApiBase = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paramApi = urlParams.get('api');
  // IPアドレス（192.168.x.x 等）でアクセスされている場合、そのIPの5000番ポートを自動的に見に行くように調整
  const hostname = window.location.hostname;
  const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);
  if (isIP) {
    return `http://${hostname}:5000/api`;
  }

  // ローカル環境（localhost）
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:5000/api`;
  }
  
  // それ以外（Netlifyなどの本番URL）の場合、Renderのバックエンドサーバーを見に行く
  return 'https://shigotoyou-backend.onrender.com/api';
};

export const API_BASE = getApiBase();

// ローカルストレージからトークンを取得
function getToken() {
  return localStorage.getItem('auth_token');
}

// トークンを保存
export function setToken(token) {
  localStorage.setItem('auth_token', token);
}

// トークンを削除（ログアウト）
export function clearToken() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
}

// ユーザー情報を保存
export function setUserInfo(user) {
  localStorage.setItem('user_info', JSON.stringify(user));
}

// ユーザー情報を取得
export function getUserInfo() {
  try {
    return JSON.parse(localStorage.getItem('user_info'));
  } catch {
    return null;
  }
}

// 認証済みかチェック
export function isAuthenticated() {
  return !!getToken();
}

/**
 * 認証付きfetchリクエスト
 */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  // 401の場合はログアウト（ただしログインエンドポイントは除外）
  if (response.status === 401 && endpoint !== '/auth/login') {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('セッションが期限切れです');
  }

  if (!response.ok) {
    throw new Error(data.error || `サーバー接続エラー (HTTP ${response.status})`);
  }

  return data;
}

// === 認証API ===
export async function login(employeeId, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId, password })
  });
  if (data.success) {
    setToken(data.data.token);
    setUserInfo(data.data.user);
  }
  return data;
}

export async function getMe() {
  return apiFetch('/auth/me');
}

// === 従業員API ===
export async function getContracts() {
  return apiFetch('/employee/contracts');
}

export async function getLineLoginUrl() {
  return apiFetch('/line/login-url', { cache: 'no-store' });
}

export async function getContractDetail(sheetId) {
  return apiFetch(`/employee/contracts/${sheetId}`);
}

export async function signContract(sheetId, signatureData) {
  return apiFetch(`/employee/contracts/${sheetId}/sign`, {
    method: 'POST',
    body: JSON.stringify({
      signature_data: signatureData,
      device_os: navigator.userAgent
    })
  });
}

// === プッシュ通知API ===
export async function getVapidPublicKey() {
  return apiFetch('/push/vapid-public-key');
}

export async function subscribePush(subscription) {
  return apiFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription })
  });
}

export default {
  login, getMe, getContracts, getContractDetail, signContract,
  getVapidPublicKey, subscribePush,
  isAuthenticated, clearToken, getUserInfo
};
