// Admin Dashboard API Configuration
const API_BASE = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : 'https://contract-approval-sys-backend.fly.dev/api'); // Fly.io本番サーバー
export default API_BASE;
