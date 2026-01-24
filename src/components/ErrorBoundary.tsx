import React, { Component, ReactNode, ErrorInfo, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';

// Enhanced error boundary interfaces following TypeScript guidelines
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  reset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Memoized default fallback component
const DefaultFallback: React.FC<ErrorBoundaryFallbackProps> = ({ error, reset }) => {
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <Box sx={{ 
      p: 3, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      minHeight: '200px',
      textAlign: 'center'
    }}>
      <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      <Typography variant="h6" gutterBottom color="error">
        Oops! Something went wrong
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {import.meta.env.DEV ? error.message : 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
      </Typography>
      <Button 
        variant="contained" 
        onClick={handleReset}
        sx={{ mt: 2 }}
      >
        Try Again
      </Button>
    </Box>
  );
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });
    
    // Enhanced error logging
    console.group('🚨 ErrorBoundary caught an error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.groupEnd();
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Report to error service in production
    if (!import.meta.env.DEV) {
      // reportError(error, errorInfo);
    }
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultFallback;
      
      return (
        <FallbackComponent 
          error={this.state.error!}
          errorInfo={this.state.errorInfo!}
          reset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// Enhanced HOC for easy usage with better typing
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>
): React.ComponentType<P> => {
  const WrappedComponent = (props: P): ReactNode => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};