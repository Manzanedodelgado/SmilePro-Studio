import React from 'react';
import { usePermission } from '../hooks/usePermission';
import { Zap, Sparkles } from 'lucide-react';
import { AccessDenied } from '../components/UI';
import { IAConfig } from './ia/IAConfig';
import { AutomationRules } from './ia/AutomationRules';
import { FlowsView } from './ia/FlowsView';
import { AutomationEditor } from './ia/AutomationEditor';
import { Plantillas } from './ia/Plantillas';
import { IADashboard } from './ia/IADashboard';
import { DocumentosClinica } from './ia/DocumentosClinica';

interface IAAutomatizacionProps { activeSubArea?: string; onSubNavigate?: (area: string) => void; }


const IAAutomatizacion: React.FC<IAAutomatizacionProps> = ({ activeSubArea, onSubNavigate }) => {
    // VLN-012 FIX: Solo admin y dentista acceden a IA
    const canView = usePermission('view_ia');
    if (!canView) return (
        <AccessDenied
            icon={Sparkles}
            message="El panel de IA dental solo es accesible para administradores y médicos."
        />
    );

    const renderContent = () => {
        switch (activeSubArea) {
            case 'Panel IA': return <IADashboard onNavigate={onSubNavigate ?? (() => { })} />;
            case 'IA Dental ✦': return <IAConfig />;
            case 'Automatizaciones': return <AutomationRules />;
            case 'Flujos Conversacionales': return <FlowsView />;
            case 'Editor': return <AutomationEditor />;
            case 'Plantillas': return <Plantillas />;
            case 'Documentos Clínicos': return <DocumentosClinica />;
            default: return <IADashboard onNavigate={onSubNavigate ?? (() => { })} />;
        }
    };

    return (
        <div className="pb-12 animate-in fade-in duration-500 space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#0056b3]" />
                    <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">
                        {activeSubArea ?? 'Panel IA'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#051650]">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Motor activo
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

export default IAAutomatizacion;

