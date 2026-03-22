// ─────────────────────────────────────────────────────────────────
//  components/ErrorBoundary.tsx
//  Error Boundary real usando React.Component
// ─────────────────────────────────────────────────────────────────
import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isProd = !(import.meta as any).env?.DEV;

/** Pantalla de error de fallback cuando el Error Boundary captura un error */
export function ErrorBoundaryFallback({ onReset, error }: { onReset: () => void; error?: Error | null }) {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
            <div className="max-w-xl w-full">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
                        <span className="material-icons text-[#FF4B68] text-3xl">error_outline</span>
                    </div>
                </div>
                <h1 className="text-white text-2xl font-bold text-center mb-2">Algo salió mal</h1>
                <p className="text-slate-400 text-sm text-center mb-4">
                    Ha ocurrido un error inesperado. Tu trabajo puede haberse guardado automáticamente.
                </p>
                {error && (
                    <div style={{ background: '#0f172a', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, overflowX: 'auto' }}>
                        <p style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, margin: '0 0 4px', fontFamily: 'monospace' }}>
                            {error.name}: {error.message}
                        </p>
                        {error.stack && (
                            <pre style={{ color: '#64748b', fontSize: 10, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                {error.stack.slice(0, 800)}
                            </pre>
                        )}
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <button onClick={onReset}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
                        Volver al inicio
                    </button>
                    <button onClick={() => window.location.reload()}
                        className="w-full py-3 border border-slate-700 text-slate-400 rounded-xl text-sm font-bold hover:border-slate-600 hover:text-white transition-all">
                        Recargar página
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    onReset?: () => void;
}

/** Error Boundary real — captura errores de render de React */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, info);
        if (isProd) {
            console.error('[ErrorBoundary][PROD]', error.message, info.componentStack?.slice(0, 500));
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <ErrorBoundaryFallback
                    error={this.state.error}
                    onReset={() => {
                        this.setState({ hasError: false, error: null });
                        this.props.onReset?.();
                    }}
                />
            );
        }
        return this.props.children;
    }
}

/** Configura el manejador global de errores de la aplicación */
export const setupGlobalErrorHandler = (): void => {
    const originalOnError = window.onerror;

    window.onerror = (message, source, lineno, colno, error) => {
        if (isProd) {
            console.error('[GlobalError]', message, source, lineno, colno, error);
        }
        if (typeof originalOnError === 'function') {
            return originalOnError(message, source, lineno, colno, error);
        }
        return false;
    };

    // También capturar promesas rechazadas no manejadas
    window.addEventListener('unhandledrejection', (event) => {
        if (isProd) {
            const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
            console.error('[UnhandledRejection]', reason.message, reason.stack?.slice(0, 500));
        }
    });
};
