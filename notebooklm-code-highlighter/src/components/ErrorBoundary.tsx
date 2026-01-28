import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CodeBlock error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div
          style={{
            padding: '12px',
            background: 'rgba(255, 0, 0, 0.1)',
            borderRadius: '6px',
            color: '#b31d28',
            fontSize: '13px',
            fontFamily: 'monospace',
          }}
        >
          Failed to render code block
        </div>
      );
    }

    return this.props.children;
  }
}
