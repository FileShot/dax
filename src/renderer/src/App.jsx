import ErrorBoundary from './components/ErrorBoundary';
import ThemeProvider from './components/ThemeProvider';
import GuidedTourProvider from './components/GuidedTour';
import Layout from './components/Layout';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GuidedTourProvider>
          <Layout />
        </GuidedTourProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
