import React from 'react';
import * as Sentry from "@sentry/react";
import { withTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button, Card } from './ui';

class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send to Sentry
    if (import.meta.env.PROD) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    const { t } = this.props;

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#0a0a0a] p-4 transition-colors">
          <Card className="max-w-md w-full p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-error-50 dark:bg-error-900/20 rounded-full">
                <AlertCircle className="w-12 h-12 text-error-600 dark:text-error-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                {t('error.boundaryTitle')}
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400">
                {t('error.boundaryDescription')}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={this.handleReset}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                {t('actions.retry')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.reload()}
              >
                {t('actions.refresh')}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation('common')(ErrorBoundaryInner);
