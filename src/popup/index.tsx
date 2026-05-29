import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App/App';
import PrivilegesPage from './PrivilegesPage/PrivilegesPage';

// The same bundle backs both the side panel (App) and the full-tab privileges
// review page, selected by the ?view= query param on index.html.
const view = new URLSearchParams(window.location.search).get('view');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    {view === 'privileges' ? <PrivilegesPage /> : <App />}
  </React.StrictMode>
);