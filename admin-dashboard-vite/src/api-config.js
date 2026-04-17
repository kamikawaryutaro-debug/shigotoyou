// Admin Dashboard API Configuration
const API_BASE = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : 'http://192.168.2.105:5000/api'); // 自宅PCのIPをデフォルトに
export default API_BASE;
