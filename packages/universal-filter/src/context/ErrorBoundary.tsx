import React, {
  Component,
  type ReactNode,
  type ErrorInfo,
  startTransition,
} from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * 自定义重置逻辑的钩子
   */
  onReset?: () => void;
  /**
   * 重置键 - 当此值改变时，自动重置错误状态
   */
  resetKeys?: Array<string | number>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * FilterErrorBoundary - Filter 专用错误边界
 *
 * 使用 React 18 最佳实践实现的错误边界组件
 *
 * 特性：
 * - 支持 startTransition 优化重置体验
 * - 支持 resetKeys 自动重置
 * - 支持自定义重置钩子
 * - 开发/生产环境适配
 */
export class FilterErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // React 18: 这里返回的状态会立即更新
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 保存错误信息
    this.setState({
      error,
      errorInfo,
    });

    // 调用外部错误回调
    this.props.onError?.(error, errorInfo);

    // 在开发环境打印详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 FilterProvider 捕获到错误');
      console.error('错误对象:', error);
      console.error('组件栈:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // React 18: 支持通过 resetKeys 自动重置错误状态
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && resetKeys && haveResetKeysChanged(prevProps.resetKeys, resetKeys)) {
      this.handleReset();
    }
  }

  handleReset = (): void => {
    // 调用自定义重置钩子
    this.props.onReset?.();

    // 重置错误状态
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      const info = errorInfo ?? { componentStack: '' };

      // 如果提供了自定义 fallback，使用自定义的
      if (fallback) {
        return fallback(error, info, this.handleReset);
      }

      // 否则使用默认的错误展示
      return <DefaultErrorFallback error={error} errorInfo={info} reset={this.handleReset} />;
    }

    return children;
  }
}

function haveResetKeysChanged(
  prevKeys: Array<string | number> | undefined,
  nextKeys: Array<string | number>
): boolean {
  if (!prevKeys) {
    return true;
  }

  if (prevKeys.length !== nextKeys.length) {
    return true;
  }

  for (let i = 0; i < nextKeys.length; i++) {
    if (Object.is(prevKeys[i], nextKeys[i]) === false) {
      return true;
    }
  }

  return false;
}

/**
 * 默认错误回退组件
 *
 * 使用 React 18 的 startTransition 优化重置体验
 */
function DefaultErrorFallback({
  error,
  errorInfo,
  reset,
}: {
  error: Error;
  errorInfo: ErrorInfo;
  reset: () => void;
}): ReactNode {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // React 18: 使用 startTransition 包装重置操作，提升用户体验
  const handleReset = () => {
    startTransition(() => {
      reset();
    });
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        padding: '20px',
        margin: '10px',
        border: '2px solid #ff4d4f',
        borderRadius: '8px',
        backgroundColor: '#fff2f0',
        color: '#000',
      }}
    >
      <h3
        style={{ margin: '0 0 10px 0', color: '#ff4d4f' }}
        id="error-title"
      >
        ⚠️ {isDevelopment ? 'Filter 渲染发生错误' : '渲染发生错误'}
      </h3>

      {isDevelopment ? (
        <>
          <div style={{ marginBottom: '10px' }}>
            <strong>错误信息:</strong>
            <pre
              style={{
                margin: '5px 0',
                padding: '10px',
                backgroundColor: '#fff',
                border: '1px solid #ffccc7',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {error.message}
            </pre>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <strong>错误栈:</strong>
            <pre
              style={{
                margin: '5px 0',
                padding: '10px',
                backgroundColor: '#fff',
                border: '1px solid #ffccc7',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '11px',
                maxHeight: '200px',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {error.stack}
            </pre>
          </div>

          <details style={{ marginBottom: '10px' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: 'bold',
                marginBottom: '5px',
                userSelect: 'none',
              }}
            >
              组件栈 ▼
            </summary>
            <pre
              style={{
                margin: '5px 0',
                padding: '10px',
                backgroundColor: '#fff',
                border: '1px solid #ffccc7',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '11px',
                maxHeight: '200px',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {errorInfo.componentStack}
            </pre>
          </details>
        </>
      ) : (
        <p style={{ margin: '10px 0', fontSize: '14px' }}>
          抱歉，页面渲染出现问题，请刷新页面重试。
        </p>
      )}

      <button
        onClick={handleReset}
        aria-label={isDevelopment ? '重置错误状态' : '重试'}
        style={{
          padding: '8px 16px',
          backgroundColor: '#ff4d4f',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'background-color 0.2s ease',
        }}
      >
        {isDevelopment ? '重置错误状态' : '重试'}
      </button>
    </div>
  );
}

