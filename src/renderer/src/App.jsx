import ErrorBoundary from './components/ErrorBoundary';
import ThemeProvider from './components/ThemeProvider';
import Layout from './components/Layout';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Layout />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
