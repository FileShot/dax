import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0A0A0A',
          color: '#FF6B00',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '40px',
        }}>
          <div style={{ maxWidth: 600, textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, marginBottom: 16 }}>Something went wrong</h1>
            <p style={{ color: '#999', fontSize: 14, marginBottom: 24 }}>
              Dax encountered an unexpected error. Try restarting the app.
            </p>
            <details style={{
              textAlign: 'left',
              background: '#111',
              borderRadius: 8,
              padding: 16,
              fontSize: 12,
              color: '#888',
              border: '1px solid #333',
            }}>
              <summary style={{ cursor: 'pointer', color: '#ccc', marginBottom: 8 }}>
                Error details
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 24,
                background: '#FF6B00',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 24px',
                fontSize: 14,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
