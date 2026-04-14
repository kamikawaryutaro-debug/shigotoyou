// Admin Dashboard API Configuration
const API_BASE = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : 'https://shigotoyou-backend.onrender.com/api');
export default API_BASE;
