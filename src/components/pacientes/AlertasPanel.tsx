import React, { useState, useEffect } from 'react';

interface AlertasPanelProps {
    initialAlerts: {
        alergias: string[];
        deuda: boolean;
    };
    onAlertsChange: (newAlerts: { alergias: string[]; deuda: boolean }) => void;
    showToast: (message: string) => void;
}

const AlertasPanel: React.FC<AlertasPanelProps> = ({ initialAlerts, onAlertsChange, showToast }) => {
    const [tieneDeuda, setTieneDeuda] = useState(initialAlerts.deuda);
    const [alergias, setAlergias] = useState(initialAlerts.alergias);
    const [newAlergiaInput, setNewAlergiaInput] = useState('');

    useEffect(() => {
        setTieneDeuda(initialAlerts.deuda);
        setAlergias(initialAlerts.alergias);
    }, [initialAlerts]);

    const handleAddAlergia = () => {
        const valor = newAlergiaInput.trim();
        if (valor && !alergias.find(a => a.toLowerCase() === valor.toLowerCase())) {
            setAlergias([...alergias, valor]);
            setNewAlergiaInput('');
        }
    };
    
    const handleRemoveAlergia = (alergiaToRemove: string) => {
        setAlergias(alergias.filter(a => a !== alergiaToRemove));
    };

    const handleSaveChanges = () => {
        onAlertsChange({ alergias, deuda: tieneDeuda });
    };

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm border border-border-light dark:border-border-dark">
            <div className="bg-red-500/10 dark:bg-red-500/20 p-3 flex justify-between items-center border-b border-[#FF4B68]/20 dark:border-[#FF4B68]/30">
                <h3 className="font-bold text-[#E03555] dark:text-[#FF4B68] flex items-center gap-2">
                    <span className="material-icons-outlined">shield</span>
                    Seguridad y Estado Financiero
                </h3>
            </div>
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">Marcar con Deuda Pendiente</span>
                    <label className="switch">
                        <input 
                            type="checkbox" 
                            checked={tieneDeuda}
                            onChange={(e) => setTieneDeuda(e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
                
                <hr className="border-border-light dark:border-border-dark" />

                <div>
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">Alergias Críticas</span>
                     <div className="flex items-center gap-2 mt-2">
                        <input 
                            type="text" 
                            id="input-alergia" 
                            placeholder="Añadir alergia (ej: Látex)..."
                            value={newAlergiaInput}
                            onChange={(e) => setNewAlergiaInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAlergia()}
                            className="flex-grow p-2 text-sm border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-secondary focus:ring focus:ring-secondary/20 bg-white dark:bg-gray-800"
                        />
                        <button onClick={handleAddAlergia} className="p-2 bg-secondary text-white rounded-md hover:bg-secondary/90 transition-colors">
                            <span className="material-icons-outlined">add</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[40px]">
                     {alergias.map(alergia => (
                        <span key={alergia} className="tag-alergia animate-fade-in">
                            <span className="material-icons-outlined text-sm mr-1.5">warning</span>
                            {alergia} 
                            <button className="btn-borrar-tag" onClick={() => handleRemoveAlergia(alergia)}>
                                <span className="material-icons-outlined text-base">close</span>
                            </button>
                        </span>
                     ))}
                </div>

                <button 
                    onClick={handleSaveChanges}
                    className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-md transition-colors shadow flex items-center justify-center gap-2 mt-2"
                >
                    <span className="material-icons-outlined">save</span>
                    Guardar Cambios de Alertas
                </button>
            </div>
        </div>
    );
};

export default AlertasPanel;