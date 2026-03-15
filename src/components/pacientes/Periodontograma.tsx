
import React from 'react';

const DataInput: React.FC = () => (
    <div className="w-6 h-5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-sm flex items-center justify-center text-[13px] text-gray-400">
        ...
    </div>
);

const MetricRow: React.FC<{ label: string, reversed?: boolean }> = ({ label, reversed }) => (
    <div className={`flex items-center gap-2 text-[13px] ${reversed ? 'flex-row-reverse' : ''}`}>
        <span className="font-semibold text-gray-600 dark:text-gray-300 w-32 text-right">{label}</span>
        <div className="flex-1 grid grid-cols-16 gap-x-1">
            {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="flex justify-center gap-px">
                    <DataInput />
                    <DataInput />
                    <DataInput />
                </div>
            ))}
        </div>
    </div>
);

const DienteGraficoPeriodoncia: React.FC<{ numero: string }> = ({ numero }) => (
    <div className="flex flex-col items-center">
        <img src={`/diente-perio-${numero}.png`} alt={`diente ${numero}`} className="h-12" />
    </div>
);

const NumeroSelectorPeriodoncia: React.FC<{ numero: string }> = ({ numero }) => (
    <div className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-all font-bold text-sm bg-secondary/10 text-secondary hover:bg-secondary/20">
        {numero}
    </div>
);

const ArcadaSection: React.FC<{ title: string, top: boolean }> = ({ title, top }) => {
    const cuadrante1 = ['18', '17', '16', '15', '14', '13', '12', '11'];
    const cuadrante2 = ['21', '22', '23', '24', '25', '26', '27', '28'];
    const arcada = [...cuadrante1, ...cuadrante2];
    
    const metricas = ['Furcas', 'Placa', 'Sangrado', 'Pérdida de Inserción', 'Bolsa Periodontal', 'Recesión Gingival'];
    const caraLabel = top ? 'CARA VESTIBULAR' : 'CARA PALATINA';

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
            <h3 className="bg-secondary text-white font-bold py-1 px-3 mb-4 rounded-md inline-block">{title}</h3>
            <div className="space-y-2">
                {metricas.slice(0, 3).map(m => <MetricRow key={m} label={m} />)}
            </div>

            <div className="my-4 text-center text-sm font-bold text-gray-500 dark:text-gray-400">{caraLabel}</div>

            <div className="flex justify-center gap-1.5 my-2">
                {arcada.map(num => <DienteGraficoPeriodoncia key={num} numero={num} />)}
            </div>

            <div className="flex justify-center gap-2 my-3">
                {arcada.map(num => <NumeroSelectorPeriodoncia key={num} numero={num} />)}
            </div>

            <div className="my-4 text-center text-sm font-bold text-gray-500 dark:text-gray-400">{!top ? 'CARA VESTIBULAR' : 'CARA PALATINA'}</div>
            
            <div className="space-y-2">
                {metricas.slice(3, 6).map(m => <MetricRow key={m} label={m} />)}
                 <MetricRow label="Sangrado" />
                 <MetricRow label="Placa" />
                 <MetricRow label="Furcas" />
            </div>
        </div>
    );
};

const Periodontograma: React.FC = () => {
    return (
        <div className="space-y-6">
            <ArcadaSection title="Maxilar Superior" top={true} />
            <ArcadaSection title="Maxilar Inferior" top={false} />
        </div>
    );
};

export default Periodontograma;
