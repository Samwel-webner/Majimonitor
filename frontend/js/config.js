// Use the local backend when the page is opened from this computer (e.g. VS Code Go Live),
// and the deployed Render backend everywhere else.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const API_BASE_URL = IS_LOCAL
    ? 'http://localhost:5000/api'
    : 'https://majimonitor.onrender.com/api';