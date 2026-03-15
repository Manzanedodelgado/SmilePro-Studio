
import React, { useState } from 'react';
import { type Cita } from './types';
import { type ColorMap, type EstudioRadiologico } from './services/imagen.service';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { type Area } from './types';
import { navigationItems } from './navigation';
import Dashboard from './views/Dashboard';
import Agenda from './views/Agenda';
import Pacientes from './views/Pacientes';
import IAAutomatizacion from './views/IAAutomatizacion';
import Gestoria from './views/Gestoria';
import Whatsapp from './views/Whatsapp';
import Inventario from './views/Inventario';
import Radiologia from './views/Radiologia';
import Login from './views/Login';
import QuestionnairePublicPage from './views/QuestionnairePublicPage';
import SignPage from './views/SignPage';
import { useAuth } from './context/AuthContext';
import { setupGlobalErrorHandler } from './components/ErrorBoundary';

// Instalar el manejador global de errores una sola vez al cargar la app
setupGlobalErrorHandler();

// Detectar si la URL contiene un token de cuestionario público (?token=...)
// Debe evaluarse UNA vez al cargar, antes de cualquier estado de auth.
const PUBLIC_QUESTIONNAIRE_TOKEN = new URLSearchParams(window.location.search).get('token');

// Detectar si la URL es una firma remota (#sign/:token)
const SIGN_TOKEN = (() => {
    const h = window.location.hash;
    if (h.startsWith('#sign/')) return h.slice('#sign/'.length);
    return null;
})();

const App: React.FC = () => {
    const { isAuthenticated, loading } = useAuth();
    const [activeArea, setActiveArea] = useState<Area>('Agenda');
    const [activeSubArea, setActiveSubArea] = useState<string>('Jornada de Hoy');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [pendingCita, setPendingCita] = useState<Partial<Cita> | null>(null);
    const pendingWhatsappRef = React.useRef<{ phone: string; name: string } | null>(null);

    // ─ Estado IA de Radiología (compartido entre Sidebar y Radiologia) ─
    const [radBrightness, setRadBrightness] = useState(0);
    const [radContrast, setRadContrast] = useState(0);
    const [radSharpness, setRadSharpness] = useState(0);
    const [radColorMap, setRadColorMap] = useState<ColorMap>('grayscale');
    const [radSelectedStudy, setRadSelectedStudy] = useState<EstudioRadiologico | null>(null);

    // Paciente persistido para restauración al volver + señal de selección externa (ej: desde Dashboard)
    const [requestedNumPac, setRequestedNumPac] = useState<string | null>(null);
    const persistedSubAreaRef = React.useRef<string>('Historia Clínica');

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleNavigation = (area: Area, subArea: string) => {
        setActiveArea(area);
        setActiveSubArea(subArea);
    };

    const renderContent = () => {
        switch (activeArea) {
            case 'Agenda': {
                const cita = pendingCita;
                if (cita) setTimeout(() => setPendingCita(null), 100);
                return <Agenda activeSubArea={activeSubArea} initialCita={cita ?? undefined} />;
            }
            // Pacientes se maneja fuera del switch — siempre montado para preservar estado
            case 'Pacientes': return null;
            case 'Radiología':
                return <Radiologia
                    activeSubArea={activeSubArea}
                    brightness={radBrightness}
                    contrast={radContrast}
                    sharpness={radSharpness}
                    colorMap={radColorMap}
                    onBrightnessChange={setRadBrightness}
                    onContrastChange={setRadContrast}
                    onSharpnessChange={setRadSharpness}
                    onColorMapChange={setRadColorMap}
                    onStudySelect={setRadSelectedStudy}
                />;
            case 'IA & Automatización':
                return <IAAutomatizacion
                    activeSubArea={activeSubArea}
                    onSubNavigate={(area) => setActiveSubArea(area)}
                />;
            case 'Gestoría':
                return <Gestoria activeSubArea={activeSubArea} />;
            case 'Inventario':
                return <Inventario activeSubArea={activeSubArea} />;
            case 'Whatsapp': {
                // Usamos el ref para leer el valor más reciente, evitando la race condition
                // entre setActiveArea y setPendingWhatsapp que podría montar Whatsapp con phone=undefined
                const wa = pendingWhatsappRef.current;
                return <Whatsapp
                    activeSubArea={activeSubArea}
                    initialPhone={wa?.phone}
                    initialName={wa?.name}
                    onNavigate={(area, subArea, phoneOrNumPac) => {
                        setActiveArea(area as import('./types').Area);
                        if (subArea) setActiveSubArea(subArea);
                        // Si viene con teléfono/numPac, decirle a Pacientes que abra esa ficha
                        if (phoneOrNumPac) setRequestedNumPac(phoneOrNumPac);
                    }}
                />;
            }
            case 'CLÍNICA':
            default:
                return <Dashboard
                    activeSubArea={activeSubArea}
                    onNavigate={(area, subArea, numPac) => {
                        setActiveArea(area as Area);
                        if (subArea) setActiveSubArea(subArea);
                        // Le dice a Pacientes (siempre montado) que abra este paciente
                        if (numPac) setRequestedNumPac(numPac);
                    }}
                />;
        }
    };

    // Ruta pública: cuestionario de primera visita accedido desde enlace WhatsApp
    if (PUBLIC_QUESTIONNAIRE_TOKEN) {
        return <QuestionnairePublicPage token={PUBLIC_QUESTIONNAIRE_TOKEN} />;
    }

    // Ruta pública: firma remota de documento accedida desde enlace WhatsApp
    if (SIGN_TOKEN) {
        return <SignPage token={SIGN_TOKEN} />;
    }

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-clinical-soft">
                <div className="w-12 h-12 border-4 border-[#002855]/20 border-t-[#002855] rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login />;
    }

    const currentMenuItem = navigationItems.find(item => item.name === activeArea);
    const showSidebar = !!currentMenuItem?.children;

    return (
        <div className="flex flex-col h-screen bg-clinical-soft dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans overflow-hidden">
            {toastMessage && (
                <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[5000] flex items-center gap-3 animate-fade-in border border-white/10">
                    <span className="material-icons text-[#118DF0]">check_circle</span>
                    <span className="text-xs font-black uppercase tracking-widest">{toastMessage}</span>
                </div>
            )}

            <Header activeArea={activeArea} onNavigate={handleNavigation} />

            <div className="flex flex-1 overflow-hidden">
                {showSidebar && (
                    <div className="hidden lg:flex flex-shrink-0">
                        <Sidebar
                            activeArea={activeArea}
                            activeSubArea={activeSubArea}
                            onNavigate={handleNavigation}
                            radControls={activeArea === 'Radiología' ? {
                                brightness: radBrightness, contrast: radContrast,
                                sharpness: radSharpness, colorMap: radColorMap,
                                onBrightness: setRadBrightness, onContrast: setRadContrast,
                                onSharpness: setRadSharpness, onColorMap: setRadColorMap,
                                selectedStudy: radSelectedStudy,
                            } : undefined}
                        />
                    </div>
                )}
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    {/* PACIENTES: siempre montado, oculto con CSS cuando no es activo — preserva estado del paciente */}
                    <div style={{ display: activeArea === 'Pacientes' ? 'contents' : 'none' }}
                        className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar bg-clinical-soft/30">
                        <div className="max-w-[1600px] mx-auto">
                            <Pacientes
                                activeSubArea={activeArea === 'Pacientes' ? activeSubArea : persistedSubAreaRef.current}
                                requestedNumPac={requestedNumPac}
                                onRequestedHandled={() => setRequestedNumPac(null)}
                                onSubAreaChange={(subArea) => {
                                    setActiveSubArea(subArea);
                                    persistedSubAreaRef.current = subArea;
                                }}
                                onPatientChange={(_p) => {}}
                                onNavigate={(area: Area, subArea?: string, citaData?: Partial<Cita>, waData?: { phone: string; name: string }) => {
                                    // Guardar en ref ANTES de setActiveArea para que esté disponible
                                    // en el primer render del componente Whatsapp (evita race condition)
                                    if (waData) { pendingWhatsappRef.current = waData; }
                                    setActiveArea(area);
                                    if (subArea) setActiveSubArea(subArea);
                                    if (citaData) setPendingCita(citaData);
                                }}
                                showToast={showToast}
                            />
                        </div>
                    </div>

                    {/* Resto de áreas: montaje/desmontaje normal */}
                    {activeArea !== 'Pacientes' && (
                        (activeArea === 'Agenda' || activeArea === 'Whatsapp' || activeArea === 'Radiología')
                            ? (activeArea === 'Whatsapp'
                                ? <div className="flex-1 flex flex-col overflow-hidden p-4 min-h-0">{renderContent()}</div>
                                : renderContent())
                            : (
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar bg-clinical-soft/30">
                                    <div className="max-w-[1600px] mx-auto animate-fade-in">
                                        {renderContent()}
                                    </div>
                                </div>
                            )
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
