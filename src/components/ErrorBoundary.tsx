// ─────────────────────────────────────────────────────────────────
//  components/ErrorBoundary.tsx
//  Error Boundary real usando React.Component
// ─────────────────────────────────────────────────────────────────
import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isProd = !(import.meta as any).env?.DEV;

/** Pantalla de error de fallback cuando el Error Boundary captura un error */
export function ErrorBoundaryFallback({ onReset }: { onReset: () => void }) {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
            <div className="max-w-md w-full">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
                        <span className="material-icons text-[#FF4B68] text-3xl">error_outline</span>
                    </div>
                </div>
                <h1 className="text-white text-2xl font-bold text-center mb-2">Algo salió mal</h1>
                <p className="text-slate-400 text-sm text-center mb-6">
                    Ha ocurrido un error inesperado. Tu trabajo puede haberse guardado automáticamente.
                </p>
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ErrorBoundary extends (React.Component as any) {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).state = { hasError: false, error: null } as ErrorBoundaryState;
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: { componentStack?: string }) {
        console.error('[ErrorBoundary] Uncaught error:', error, info);
        // Log silencioso en producción (solo consola — no hay endpoint de error_logs activo)
        if (isProd) {
            console.error('[ErrorBoundary][PROD]', error.message, info.componentStack?.slice(0, 500));
        }
    }

    render() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const self = this as any;
        if (self.state?.hasError) {
            return (
                <ErrorBoundaryFallback
                    onReset={() => {
                        self.setState({ hasError: false, error: null });
                        self.props?.onReset?.();
                    }}
                />
            );
        }
        return self.props?.children ?? null;
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
