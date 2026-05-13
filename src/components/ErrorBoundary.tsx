import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "./Card";
import { Button } from "./inputs/Button";

interface Props {
    children: ReactNode;
    resetKey?: string;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public componentDidUpdate(prevProps: Props) {
        const { resetKey } = this.props;
        const { hasError } = this.state;

        if (resetKey !== prevProps.resetKey && hasError) {
            this.setState({ hasError: false, error: undefined });
        }
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined });
        window.location.href = "/";
    };

    public render() {
        const { hasError, error } = this.state;
        const { children } = this.props;

        if (hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                    <Card className="max-w-2xl w-full">
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-bold text-text-primary mb-2">
                                    Unexpected Application Error
                                </h1>
                                <p className="text-text-muted">
                                    Something went wrong. Please try refreshing the page or return to the home page.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                    <p className="text-sm font-mono text-red-400">{error.message}</p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button variant="primary" onClick={() => window.location.reload()}>
                                    Refresh Page
                                </Button>
                                <Button variant="secondary" onClick={this.handleReset}>
                                    Return Home
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            );
        }

        return children;
    }
}
