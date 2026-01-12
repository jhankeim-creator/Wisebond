import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4">
          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Something went wrong</h3>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                This page crashed while loading. Please refresh.
              </p>
              <div className="flex gap-2">
                <Button
                  className="btn-primary"
                  onClick={() => window.location.reload()}
                >
                  Refresh page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => this.setState({ hasError: false, error: null })}
                >
                  Try again
                </Button>
              </div>
              {this.state.error ? (
                <pre className="text-xs bg-stone-50 dark:bg-stone-800 p-3 rounded-lg overflow-auto max-h-40">
                  {String(this.state.error?.message || this.state.error)}
                </pre>
              ) : null}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

