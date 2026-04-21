import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// BASE_URL is e.g. /lab_live/ on GitHub Pages so routes like /live-trade-view work under /lab_live/live-trade-view
const basename = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
  ? import.meta.env.BASE_URL.replace(/\/$/, '')
  : '';

// Fix GitHub Pages: if app is under a base path but user opened e.g. loveleet.github.io/chart-grid (no base), redirect to correct URL
const redirectingToBase = typeof window !== 'undefined' && basename && !window.location.pathname.startsWith(basename);
if (redirectingToBase) {
  const path = window.location.pathname === '/' ? '' : window.location.pathname;
  window.location.replace(basename + path + window.location.search + window.location.hash);
}

class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[App] Render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 600 }}>
          <h1 style={{ color: '#b91c1c' }}>Something went wrong</h1>
          <pre style={{ background: '#f3f4f6', padding: 16, overflow: 'auto', fontSize: 12 }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Check the browser console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

if (!redirectingToBase) {
  createRoot(document.getElementById('root')).render(
    <AppErrorBoundary>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}