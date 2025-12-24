'use client';

import { AlertCircle } from 'lucide-react';
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * MDX 内容错误边界组件
 * 捕获 MDX 渲染过程中的错误，防止整个页面崩溃
 */
export class MDXErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 在开发环境记录详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('MDX rendering error:', error);
      console.error('Error info:', errorInfo);
    } else {
      // 生产环境只记录基本信息
      console.error('MDX rendering failed:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <div className="my-8 p-6 border border-destructive/50 bg-destructive/10 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-destructive mb-2">
                Content Rendering Error
              </h3>
              <p className="text-sm text-muted-foreground">
                Sorry, we encountered an error while rendering this content.
                Please try refreshing the page or contact support if the problem
                persists.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-destructive hover:underline">
                    View Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 p-3 bg-background rounded text-xs overflow-x-auto">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
