import React from 'react';
import { ArrowUpRight, ArrowDownRight, ShieldAlert, LucideIcon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
//  AccessDenied — M-03 FIX: Componente compartido para eliminar
//  las 5 copias duplicadas en Inventario, Gestoria, Pacientes, IA.
// ─────────────────────────────────────────────────────────────────
interface AccessDeniedProps {
    message?: string;
    icon?: LucideIcon;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ message, icon: Icon = ShieldAlert }) => (
    <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-12 bg-white rounded-[2rem] border-2 border-rose-100 shadow-xl max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF0F3] flex items-center justify-center mx-auto mb-6">
                <Icon className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-[#002855] mb-2">Acceso Restringido</h2>
            <p className="text-sm text-slate-500 font-medium">
                {message ?? 'No tienes permisos para acceder a esta sección.'}
            </p>
        </div>
    </div>
);


interface StatCardProps {
    icon: LucideIcon;
    title: React.ReactNode;
    value: React.ReactNode;
    trend?: string;
    isPositive?: boolean;
    color: string;
    description?: string;
    onClick?: () => void;
}

/**
 * Premium StatCard following the "Nivel 3: Gestión Avanzada" standard.
 */
export const StatCard: React.FC<StatCardProps> = ({
    icon: Icon,
    title,
    value,
    trend,
    isPositive = true,
    color,
    description,
    onClick
}) => (
    <div
        onClick={onClick}
        className={`bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md transition-all group relative overflow-hidden ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
    >
        <div className="flex justify-between items-start mb-3 relative z-10">
            <div className={`p-2.5 rounded-md ${color} bg-opacity-10`}>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            {trend && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${isPositive ? 'bg-blue-50 text-[#051650]' : 'bg-[#FFF0F3] text-[#E03555]'}`}>
                    {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {trend}
                </div>
            )}
        </div>
        <div className="relative z-10">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 tracking-tight">{value}</h3>
            {description && <p className="text-[13px] text-slate-500 mt-1 font-medium">{description}</p>}
        </div>
    </div>
);

interface PremiumContainerProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

/**
 * High-Density Container for main views.
 */
export const PremiumContainer: React.FC<PremiumContainerProps> = ({
    children,
    title,
    subtitle,
    actions,
    footer,
    className = ""
}) => (
    <div className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col ${className}`}>
        {(title || actions) && (
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50">
                <div>
                    {title && <h3 className="text-sm font-semibold text-slate-700 dark:text-white tracking-tight uppercase">{title}</h3>}
                    {subtitle && <p className="text-[13px] text-slate-500 font-medium">{subtitle}</p>}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
        )}
        <div className="p-6 flex-1">
            {children}
        </div>
        {footer && (
            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/30">
                {footer}
            </div>
        )}
    </div>
);

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'blue' | 'emerald' | 'rose' | 'amber' | 'slate';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'slate', className = "" }) => {
    const variants = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        emerald: 'bg-blue-50 text-[#051650] border-blue-100',
        rose: 'bg-[#FFF0F3] text-[#E03555] border-rose-100',
        amber: 'bg-[#FEFDE8] text-[#051650] border-amber-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100',
    };

    return (
        <span className={`px-2 py-0.5 rounded border text-[12px] font-semibold uppercase tracking-wider ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};
