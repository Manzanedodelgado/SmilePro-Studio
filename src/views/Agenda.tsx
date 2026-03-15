
import React, { useEffect, useRef, useState, useMemo } from 'react';
import ConfiguracionAgenda from './ConfiguracionAgenda';
import { type Cita, type EstadoCita, type TratamientoCategoria } from '../types';
import {
    Activity,
    X,
    Search,
    Filter,
    MoreVertical,
    ChevronLeft,
    ChevronRight as ChevronRightIcon,
    ChevronDown,
    Lock,
    Unlock,
    Settings,
    User,
    Check,
    Plus,
    MessageCircle
} from 'lucide-react';
import {
    getCitasByFecha, updateCita, updateEstadoCita, createCita, deleteCita,
    isDbConfigured as isDbCfg, dateToISO, getIdUsuFromCitaId, nombreAgendaByIdUsu
} from '../services/citas.service';
import { searchPacientes, getPaciente } from '../services/pacientes.service';
import { crearContacto } from '../services/contactos.service';
import { generateId } from '../services/db';
import { logger } from '../services/logger';
import { sendTextMessage, isEvolutionConfigured } from '../services/evolution.service';
import { type Paciente } from '../types';
import {
    loadAgendaConfig, type TratamientoAgenda, type EstadoCitaAgenda, type DoctorAgenda
} from '../services/agenda-config.service';
import { getConfigAgenda, type AgendaConfig } from '../services/config-agenda.service';

interface AgendaProps {
    activeSubArea?: string;
    initialCita?: Partial<Cita>;
}

const PALETTE: Record<string, { bg: string; border: string; text: string; pill: string }> = {
    'Primera Visita': { bg: 'linear-gradient(135deg,#FF4B68CC,#FF8099CC)', border: '#FF4B68', text: '#fff', pill: '#FF4B68' },
    'Revisión': { bg: 'linear-gradient(135deg,#118DF0CC,#5BB4F5CC)', border: '#118DF0', text: '#fff', pill: '#118DF0' },
    'Limpieza': { bg: 'linear-gradient(135deg,#1D4ED8CC,#2563EBCC)', border: '#1D4ED8', text: '#fff', pill: '#1D4ED8' },
    'Higiene Dental': { bg: 'linear-gradient(135deg,#1D4ED8CC,#2563EBCC)', border: '#1D4ED8', text: '#fff', pill: '#1D4ED8' },
    'Empaste': { bg: 'linear-gradient(135deg,#3B82F6CC,#60A5FACC)', border: '#3B82F6', text: '#fff', pill: '#3B82F6' },
    'Endodoncia': { bg: 'linear-gradient(135deg,#004182CC,#118DF0CC)', border: '#004182', text: '#fff', pill: '#004182' },
    'Extracción': { bg: 'linear-gradient(135deg,#60A5FACC,#93C5FDCC)', border: '#60A5FA', text: '#fff', pill: '#60A5FA' },
    'Ortodoncia': { bg: 'linear-gradient(135deg,#FF4B68CC,#FF8099CC)', border: '#FF4B68', text: '#fff', pill: '#FF4B68' },
    'Implante': { bg: 'linear-gradient(135deg,#051650CC,#004182CC)', border: '#051650', text: '#fff', pill: '#051650' },
    'Blanqueamiento': { bg: 'linear-gradient(135deg,#FBFFA3CC,#FEFDE8CC)', border: '#FBFFA3', text: '#051650', pill: '#FBFFA3' },
    'Prótesis': { bg: 'linear-gradient(135deg,#118DF0CC,#5BB4F5CC)', border: '#118DF0', text: '#fff', pill: '#118DF0' },
    'Prótesis Fija': { bg: 'linear-gradient(135deg,#118DF0CC,#5BB4F5CC)', border: '#118DF0', text: '#fff', pill: '#118DF0' },
    'Periodoncia': { bg: 'linear-gradient(135deg,#3B82F6CC,#60A5FACC)', border: '#3B82F6', text: '#fff', pill: '#3B82F6' },
    'Control': { bg: 'linear-gradient(135deg,#93C5FDCC,#BFDBFECC)', border: '#93C5FD', text: '#051650', pill: '#93C5FD' },
    'Urgencia': { bg: 'linear-gradient(135deg,#FF4B68CC,#FF8099CC)', border: '#FF4B68', text: '#fff', pill: '#FF4B68' },
};
const getPalette = (tto: string) => PALETTE[tto] ?? { bg: 'linear-gradient(135deg,#00418299,#0056b3AA)', border: '#004182', text: '#fff', pill: '#004182' };

const EC: Record<string, { label: string; dot: string; cls: string }> = {
    confirmada: { label: 'Confirmada', dot: '#118DF0', cls: 'bg-blue-50 text-[#004182] border-blue-200' },
    espera: { label: 'En espera', dot: '#FBFFA3', cls: 'bg-[#FEFDE8] text-[#051650] border-[#FBFFA3]' },
    gabinete: { label: 'En gabinete', dot: '#004182', cls: 'bg-blue-100 text-[#051650] border-blue-300' },
    finalizada: { label: 'Finalizada', dot: '#93C5FD', cls: 'bg-[#F0F8FF] text-[#004182] border-[#BFDBFE]' },
    anulada: { label: 'Anulada', dot: '#FF4B68', cls: 'bg-[#FFF0F3] text-[#FF4B68] border-[#FFC0CB]' },
    cancelada: { label: 'Cancelada', dot: '#FF4B68', cls: 'bg-[#FFF0F3] text-[#FF4B68] border-[#FFC0CB]' },
    fallada: { label: 'Fallada', dot: '#FF4B68', cls: 'bg-[#FFF0F3] text-[#FF4B68] border-[#FFC0CB]' },
    planificada: { label: 'Planif.', dot: '#3B82F6', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};
const ec = (e: string) => EC[e] ?? { label: e, dot: '#93C5FD', cls: 'bg-[#F0F8FF] text-[#004182] border-[#BFDBFE]' };

const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;



const Agenda: React.FC<AgendaProps> = ({ activeSubArea, initialCita }) => {


    // V-010: Catálogos dinámicos desde FDW
    const [agendaTratamientos, setAgendaTratamientos] = useState<TratamientoAgenda[]>([]);
    const [agendaEstados, setAgendaEstados] = useState<EstadoCitaAgenda[]>([]);
    const [agendaDoctores, setAgendaDoctores] = useState<DoctorAgenda[]>([]);

    useEffect(() => {
        loadAgendaConfig().then(({ tratamientos, estados, doctores }) => {
            setAgendaTratamientos(tratamientos);
            setAgendaEstados(estados);
            setAgendaDoctores(doctores);
        });
    }, []);
    const scrollContainerRef = useRef<HTMLDivElement>(null);


    const [agendaConfigStore, setAgendaConfigStore] = useState<AgendaConfig | null>(null);

    useEffect(() => {
        getConfigAgenda().then(cfg => {
            if (cfg) setAgendaConfigStore(cfg);
        });
    }, []);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cita: Cita } | null>(null);
    const [statusMenu, setStatusMenu] = useState<{ x: number; y: number; cita: Cita } | null>(null);
    const [clipboard, setClipboard] = useState<{ cita: Cita; action: 'copy' | 'cut' } | null>(null);
    const [altaCargaQuirurgica, setAltaCargaQuirurgica] = useState(false);
    const [citas, setCitas] = useState<Cita[]>([]);
    const [loadingCitas, setLoadingCitas] = useState(true);
    const [citasError, setCitasError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
    const [showDoctorsMenu, setShowDoctorsMenu] = useState(false);
    // ── Estado para formulario de contacto (Primera Visita) ─────────
    const [contactoForm, setContactoForm] = useState({ nombre: '', apellidos: '', telefono: '', email: '' });
    const [contactoSaving, setContactoSaving] = useState(false);
    const [contactoError, setContactoError] = useState<string | null>(null);
    // Menor de edad
    const [esMenorForm, setEsMenorForm] = useState(false);
    const [tutorForm, setTutorForm] = useState({ nombre: '', apellidos: '', telefono: '', email: '', relacion: '' });
    // Checkbox Primera Visita (independiente del tratamiento seleccionado)
    const [isPrimeraVisita, setIsPrimeraVisita] = useState(false);
    const [vistaTemporal, setVistaTemporal] = useState<'dia' | 'semana'>('dia');
    // Modal justificante editable
    const [justificanteModal, setJustificanteModal] = useState<{
        paciente: string;
        telefono: string;
        fecha: string;
        hora: string;
        tratamiento: string;
        doctor: string;
        texto: string;
    } | null>(null);
    const [editingCita, setEditingCita] = useState<Cita | null>(
        initialCita ? {
            id: generateId(),
            gabinete: 'G1',
            pacienteNumPac: initialCita.pacienteNumPac ?? '',
            nombrePaciente: initialCita.nombrePaciente ?? '',
            horaInicio: '09:00',
            duracionMinutos: 30,
            tratamiento: 'Control',
            categoria: 'Diagnostico' as TratamientoCategoria,
            estado: 'planificada' as EstadoCita,
            doctor: agendaConfigStore?.doctores?.[0]?.nombre || 'Dr. Mario Rubio',
            alertasMedicas: [],
            alertasLegales: [],
            alertasFinancieras: false,
            notas: '',
            ...initialCita,
        } : null
    );

    const [vistaGabinete, setVistaGabinete] = useState<'ALL' | 'G1' | 'G2'>('ALL');
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showConfiguracion, setShowConfiguracion] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [blockForm, setBlockForm] = useState({ gabinete: 'G1', hora: '10:00', duracion: 30, motivo: 'Bioseguridad' });

    // Patient search state for edit modal
    const [patientQuery, setPatientQuery] = useState('');
    const [patientResults, setPatientResults] = useState<Paciente[]>([]);
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const patientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const toggleDoctor = (doc: string) => {
        setSelectedDoctors(prev => prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]);
    };

    const goDay = (delta: number) => setSelectedDate(prev => {
        const d = new Date(prev); d.setDate(d.getDate() + delta); return d;
    });
    const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setSelectedDate(d); };
    const isToday = selectedDate.toDateString() === new Date().toDateString();
    const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const toggleVista = () => setVistaGabinete(prev => prev === 'ALL' ? 'G1' : (prev === 'G1' ? 'G2' : 'ALL'));
    const blockSlots = () => {
        setBlockForm(prev => ({ ...prev, gabinete: vistaGabinete === 'G2' ? 'G2' : 'G1' }));
        setShowBlockModal(true);
    };
    const confirmBlockSlots = () => {
        const newBio: Cita = {
            id: String(Math.random()),
            pacienteNumPac: 'bio',
            nombrePaciente: blockForm.motivo || 'Bioseguridad',
            doctor: 'Sistema',
            tratamiento: 'Bloqueo Agenda',
            categoria: 'Diagnostico',
            horaInicio: blockForm.hora,
            duracionMinutos: blockForm.duracion,
            estado: 'bloqueo_bio',
            gabinete: blockForm.gabinete as 'G1' | 'G2',
            alertasMedicas: [],
            alertasLegales: [],
            alertasFinancieras: false
        };
        createCita(newBio, selectedDate).then(saved => {
            if (saved) setCitas(prev => [...prev, saved]);
            setShowBlockModal(false);
        });
    };
    const unblockSlots = () => {
        const bios = citas.filter(c => c.estado === 'bloqueo_bio');
        bios.forEach(b => deleteCita(b.id));
        setCitas(prev => prev.filter(c => c.estado !== 'bloqueo_bio'));
    };

    // ── Working hours — mañana 09:00-14:00, tarde 16:00-20:00 ────────────────
    const workingSegments: [number, number][] = [[10, 14], [16, 20]];


    // pxPerHour eliminado (constante no usada tras simplificación)

    // Helper: deshabilitado (no usado actualmente)
    // const timeToGridRow = ...

    // Helper minutesToPx: deshabilitado (no usado actualmente)
    // const minutesToPx = ...


    // ── Cargar citas reales por fecha ────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const safetyTimer = setTimeout(() => {
            if (!cancelled) setLoadingCitas(false);
        }, 8000);

        if (isDbCfg()) {
            setLoadingCitas(true);
            if (vistaTemporal === 'dia') {
                getCitasByFecha(selectedDate).then(dbCitas => {
                    if (cancelled) return;
                    setCitas(dbCitas);
                    const minCir = dbCitas.filter(c => c.categoria === 'Cirugía' && c.estado !== 'bloqueo_bio').reduce((a, c) => a + c.duracionMinutos, 0);
                    setAltaCargaQuirurgica((minCir / 300) > 0.4);
                }).catch(err => {
                    if (cancelled) return;
                    console.warn('[Agenda] Error al cargar citas dia:', err?.message ?? err);
                    setCitas([]);
                }).finally(() => {
                    clearTimeout(safetyTimer);
                    if (!cancelled) setLoadingCitas(false);
                });
            } else {
                // Semana: De Lunes a Sábado de la semana de selectedDate
                const d = new Date(selectedDate);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar al lunes
                const monday = new Date(d.setDate(diff));
                
                const promises = [];
                for (let i = 0; i < 6; i++) {
                    const curr = new Date(monday);
                    curr.setDate(monday.getDate() + i);
                    promises.push(getCitasByFecha(curr));
                }
                Promise.all(promises).then(resultados => {
                    if (cancelled) return;
                    const allCitas = resultados.flat();
                    setCitas(allCitas);
                    setAltaCargaQuirurgica(false); // Desactiva la alerta local para simplificar la vista semanal
                }).catch(err => {
                    if (cancelled) return;
                    console.warn('[Agenda] Error al cargar citas semana:', err?.message ?? err);
                    setCitas([]);
                }).finally(() => {
                    clearTimeout(safetyTimer);
                    if (!cancelled) setLoadingCitas(false);
                });
            }
        } else {
            setCitas([]);
            setLoadingCitas(false);
            clearTimeout(safetyTimer);
        }
        return () => { cancelled = true; clearTimeout(safetyTimer); };
    }, [selectedDate, vistaTemporal]);

    // ── State actions ─────────────────────────────────────────────────────────
    const updateCitaEstado = async (estado: EstadoCita, citaId?: string) => {
        const id = citaId ?? contextMenu?.cita.id;
        if (!id) return;
        setCitas(prev => prev.map(c => c.id === id ? { ...c, estado } : c));
        setContextMenu(null);
        await updateEstadoCita(id, estado);
    };

    const handleAction = async (action: string) => {
        if (!contextMenu) return;
        const cita = contextMenu.cita;         // captura local antes de cualquier await
        setContextMenu(null);                  // cierra el menú inmediatamente
        switch (action) {
            case 'copy': setClipboard({ cita, action: 'copy' }); break;
            case 'cut': setClipboard({ cita, action: 'cut' }); break;
            case 'paste':
                if (clipboard) {
                    const newCita: Cita = { ...clipboard.cita, id: String(Math.random()), horaInicio: cita.horaInicio, gabinete: cita.gabinete };
                    setCitas(prev => {
                        const next = [...prev, newCita];
                        return clipboard.action === 'cut' ? next.filter(c => c.id !== clipboard.cita.id) : next;
                    });
                    // Persistir en BD
                    createCita(newCita, selectedDate).then(saved => {
                        if (saved) setCitas(prev => prev.map(c => c.id === newCita.id ? saved : c));
                    });
                    if (clipboard.action === 'cut') deleteCita(clipboard.cita.id);
                    setClipboard(null);
                }
                break;
            case 'cancel': updateCitaEstado('fallada'); return;
            case 'delete': 
                if (window.confirm(`¿Estás seguro de que quieres borrar la cita de ${cita.nombrePaciente}?`)) {
                    await deleteCita(cita.id);
                    setCitas(prev => prev.filter(c => c.id !== cita.id));
                }
                break;
            case 'print': window.print(); break;
            case 'justificante': {
                const fechaStr = selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                // Intentar obtener teléfono del paciente
                let telefono = '';
                try {
                    if (cita.pacienteNumPac) {
                        const pac = await getPaciente(cita.pacienteNumPac);
                        telefono = pac?.telefono ?? '';
                    }
                } catch { }
                setJustificanteModal({
                    paciente: cita.nombrePaciente,
                    telefono,
                    fecha: fechaStr,
                    hora: cita.horaInicio,
                    tratamiento: cita.tratamiento,
                    doctor: cita.doctor,
                    texto: 'El/La paciente arriba indicado/a ha asistido a la consulta dental en la fecha y hora especificados. Este documento acredita dicha asistencia a efectos laborales, escolares o de cualquier otra índole.',
                });
                break;
            }
            case 'whatsapp': {
                const fecha = selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                const txt = `👋 Hola ${cita.nombrePaciente.split(',')[0].trim()}, te confirmamos tu cita en Rubio García Dental:\n\n📅 ${fecha}\n⏰ ${cita.horaInicio} h\n🦷 ${cita.tratamiento}\n👨‍⚕️ ${cita.doctor}\n\n¿Necesitas cambiarla? Respóndenos a este mensaje. ¡Hasta pronto! 😊`;
                
                // Abrir ventana inmediatamente de forma síncrona si no usamos api en segundo plano
                let waWindow: Window | null = null;
                if (!isEvolutionConfigured()) {
                    waWindow = window.open('about:blank', '_blank');
                    if (!waWindow) {
                        alert('Por favor, permite ventanas emergentes en tu navegador.');
                        break;
                    }
                }

                let tel = '';
                try {
                    if (cita.pacienteNumPac) {
                        const pac = await getPaciente(cita.pacienteNumPac);
                        tel = pac?.telefono ?? '';
                    }
                } catch { }
                
                if (!tel) { 
                    if (waWindow) waWindow.close();
                    alert('No hay teléfono registrado para este paciente'); 
                    break; 
                }
                
                if (isEvolutionConfigured()) {
                    await sendTextMessage(tel, txt);
                } else if (waWindow) {
                    waWindow.location.href = `https://wa.me/${tel.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`;
                }
                break;
            }
        }
        setContextMenu(null);
    };

    // Close context menu and settings menu on outside click
    useEffect(() => {
        const close = (e: MouseEvent) => {
            // No cerrar si el click fue DENTRO del menú contextual
            if ((e.target as Element)?.closest('[data-context-menu]')) return;
            setContextMenu(null);
            setStatusMenu(null);
            setShowSettingsMenu(false);
            setShowDoctorsMenu(false);
        };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    // ── Filtrado y asignación de columnas (solapamientos) ─────────────────────
    const term = searchTerm.trim().toLowerCase();
    const filteredCitas = citas.filter(c =>
        (!term ||
            c.nombrePaciente.toLowerCase().includes(term) ||
            c.tratamiento.toLowerCase().includes(term) ||
            c.doctor.toLowerCase().includes(term))
        && (selectedDoctors.length === 0 || selectedDoctors.includes(c.doctor) || c.estado === 'bloqueo_bio')
    );

    // ── Doctor/agenda principal del día por gabinete (TUsuAgd via IdUsu) ───────
    const dominantAgendaLabel = (gab: 'G1' | 'G2'): string => {
        const real = filteredCitas.filter(c =>
            c.gabinete === gab && c.estado !== 'bloqueo_bio'
        );
        if (real.length === 0) return '';
        // Contar por IdUsu (extraido del prefijo del id "IdUsu-IdOrden")
        const counts = new Map<number, number>();
        for (const c of real) {
            const idUsu = getIdUsuFromCitaId(c.id);
            counts.set(idUsu, (counts.get(idUsu) ?? 0) + 1);
        }
        // IdUsu con más citas → nombre de agenda
        const [topIdUsu] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        return nombreAgendaByIdUsu(topIdUsu);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const g1DoctorLabel = useMemo(() => dominantAgendaLabel('G1') || agendaConfigStore?.doctores?.[0]?.nombre || 'Gabinete 1', [filteredCitas, agendaConfigStore]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const g2DoctorLabel = useMemo(() => dominantAgendaLabel('G2') || 'Auxiliar', [filteredCitas]);

    const getTimeRange = (c: typeof citas[0]) => {
        const [hh, mm] = c.horaInicio.split(':').map(Number);
        const startMin = hh * 60 + mm;
        return { start: startMin, end: startMin + c.duracionMinutos };
    };
    const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
        a.start < b.end && b.start < a.end;

    const colAssignment = new Map<string, { col: number; totalCols: number }>();
    ['G1', 'G2'].forEach(gab => {
        const gabCitas = filteredCitas.filter(c => c.gabinete === gab && c.estado !== 'bloqueo_bio');
        const ranges = gabCitas.map(c => ({ id: c.id, ...getTimeRange(c) }));
        const cols: { id: string; start: number; end: number }[][] = [];
        ranges.forEach(r => {
            let placed = false;
            for (let ci = 0; ci < cols.length; ci++) {
                if (!cols[ci].some(ex => overlaps(ex, r))) {
                    cols[ci].push(r);
                    colAssignment.set(r.id, { col: ci, totalCols: 0 });
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                cols.push([r]);
                colAssignment.set(r.id, { col: cols.length - 1, totalCols: 0 });
            }
        });
        ranges.forEach(r => {
            const assignment = colAssignment.get(r.id)!;
            let maxCols = 0;
            for (let ci = 0; ci < cols.length; ci++) {
                if (cols[ci].some(ex => overlaps(ex, r))) maxCols++;
            }
            assignment.totalCols = maxCols;
        });
    });

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('citaId', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = async (e: React.DragEvent, gab: 'G1' | 'G2', timeStr: string) => {
        e.preventDefault();
        const citaId = e.dataTransfer.getData('citaId');
        if (!citaId) return;

        const citaToMove = citas.find(c => c.id === citaId);
        if (!citaToMove || (citaToMove.gabinete === gab && citaToMove.horaInicio === timeStr)) return;

        const originalGab = citaToMove.gabinete;
        const originalTime = citaToMove.horaInicio;

        setCitas(prev => prev.map(c => c.id === citaId ? { ...c, gabinete: gab as any, horaInicio: timeStr } : c));

        try {
            await updateCita(citaId, { gabinete: gab, horaInicio: timeStr });
        } catch (err) {
            setCitas(prev => prev.map(c => c.id === citaId ? { ...c, gabinete: originalGab, horaInicio: originalTime } : c));
            console.error("Error moviendo cita", err);
            setCitasError("Error al mover la cita. Se ha restaurado su posición.");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const renderFreeSlot = (gab: 'G1'|'G2', min: number) => {
        const timeStr = toHHMM(min);

        return (
            <div 
                key={`free-${gab}-${timeStr}`} 
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const docG1 = agendaConfigStore?.doctores?.[0]?.nombre || 'Dr. Mario Rubio';
                    const docG2 = 'Tec. Juan Antonio Manzanedo';
                    const doc = gab === 'G1' ? docG1 : docG2;
                    setEditingCita({ id: generateId(), gabinete: gab, pacienteNumPac: '', nombrePaciente: '', horaInicio: timeStr, duracionMinutos: 30, tratamiento: 'Control', categoria: 'Diagnostico', estado: 'planificada', doctor: doc, alertasMedicas: [], alertasLegales: [], alertasFinancieras: false, notas: '' });
                }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, gab, timeStr)}
                className="flex items-center px-6 h-9 border-b border-slate-200 hover:bg-white cursor-pointer group transition-all"
            >
                <div className="w-[4.5rem] flex-shrink-0 text-center leading-none mt-0 pr-3 border-r border-slate-200/50 h-full flex items-center justify-center">
                    <span className="text-[13px] font-bold text-blue-700 bg-white border border-blue-700 shadow-sm px-2.5 py-1 rounded-md transition-colors">{timeStr}</span>
                </div>
                <div className="flex-1 flex items-center justify-end h-full pl-3 pr-4">
                    <div className="flex-shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 bg-white px-2.5 py-0.5 rounded-md shadow-sm border border-blue-100 h-6">
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Cita Libre</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderListCita = (cita: Cita) => {
        const safeDuration = Math.min(cita.duracionMinutos || 30, 240);
        const heightPx = (Math.max(15, safeDuration) / 15) * 36;
        
        if (cita.estado === 'bloqueo_bio') {
            return (
                <div 
                    key={cita.id} 
                    className="flex items-center px-6 bg-slate-100/50 border-b border-slate-200 cursor-move" 
                    style={{ height: `${heightPx}px` }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, cita.id!)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, cita.gabinete as 'G1'|'G2', cita.horaInicio)}
                >
                    <div className="w-[4.5rem] flex-shrink-0 text-center leading-none mt-0 pr-3 border-r border-slate-200/50 h-[36px] flex items-center justify-center">
                        <span className="text-[13px] font-bold text-white bg-blue-700 shadow-sm px-2.5 py-1 rounded-md">{cita.horaInicio}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center rounded border border-dashed border-slate-300 h-[calc(100%-8px)] ml-3" style={{ background: 'repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5 4px,#ebebeb 4px,#ebebeb 8px)' }}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bioseguridad</span>
                    </div>
                    <button onClick={async (e) => { e.stopPropagation(); await deleteCita(cita.id); setCitas(prev => prev.filter(c => c.id !== cita.id)); }} className="p-1 text-slate-300 hover:text-red-500 transition-colors ml-2"><X className="w-4 h-4" /></button>
                </div>
            );
        }

        const pal = getPalette(cita.tratamiento);
        const cfg = ec(cita.estado);
        const isEditing = editingCita?.id === cita.id;
        return (
            <div 
                key={cita.id} 
                className="px-6 transition-all cursor-move group flex items-center border-b border-slate-200 hover:bg-white/40"
                style={{ height: `${heightPx}px` }}
                draggable
                onDragStart={(e) => handleDragStart(e, cita.id!)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, cita.gabinete as 'G1'|'G2', cita.horaInicio)}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.pageX, y: e.pageY, cita }); }}
            >
                <div className="w-[4.5rem] flex-shrink-0 text-center leading-none mt-0 pr-3 border-r border-slate-200/50 h-[36px] flex items-center justify-center">
                    <span className="text-[13px] font-bold text-white bg-blue-700 shadow-sm px-2.5 py-1 rounded-md transition-colors">{cita.horaInicio}</span>
                </div>
                
                <div className={`relative flex-1 ml-3 flex items-center gap-3 pl-3 pr-4 h-[calc(100%-8px)] rounded-md border ${isEditing ? 'border-blue-400 bg-blue-50/50 shadow-md shadow-blue-500/10 z-10' : 'border-slate-200/80 bg-white shadow-sm hover:border-blue-300 hover:shadow-md transition-all'}`}>
                    <div className="w-1 h-3/5 min-h-[20px] rounded-full flex-shrink-0 shadow-sm" style={{ background: pal.border }} />
                    <div className="flex-shrink-0 text-center leading-none flex items-center justify-center mt-0">
                        <span className="text-[12px] font-bold text-[#051650]">{cita.pacienteNumPac || '****'}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 min-w-0 mt-0 pl-2 border-l border-slate-100">
                        <p className="text-[13px] font-bold text-[#051650] shrink-0">{cita.nombrePaciente || 'Sin datos'}</p>
                        <span className="text-slate-200 shrink-0">|</span>
                        <p className="text-[12px] font-bold truncate" style={{ color: pal.border }}>{cita.tratamiento}</p>
                        {cita.notas && (
                            <>
                                <span className="text-slate-300 text-[10px] shrink-0">●</span>
                                <p className="text-[11px] text-slate-500 italic truncate">{cita.notas}</p>
                            </>
                        )}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (!cita.pacienteNumPac) {
                                    alert('La cita no tiene un paciente asignado.');
                                    return;
                                }
                                
                                const newWindow = window.open('about:blank', '_blank');
                                if (!newWindow) {
                                    alert('Por favor, permite ventanas emergentes en tu navegador.');
                                    return;
                                }

                                try {
                                    newWindow.document.write('Cargando chat...');
                                    const p = await getPaciente(cita.pacienteNumPac);
                                    if (p?.telefono) {
                                        const phone = p.telefono.replace(/\D/g, '');
                                        newWindow.location.href = `https://wa.me/34${phone}`;
                                    } else {
                                        newWindow.close();
                                        alert('Este paciente no tiene teléfono registrado.');
                                    }
                                } catch (e) { 
                                    newWindow.close();
                                }
                            }}
                            className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-md hover:bg-slate-100 flex-shrink-0"
                            title="Escribir por WhatsApp"
                        >
                            <MessageCircle className="w-4 h-4" />
                        </button>
                        <div 
                            className={`flex items-center gap-1.5 px-3 h-6 rounded-md border text-[11px] font-bold flex-shrink-0 shadow-sm mt-0 cursor-pointer hover:opacity-80 transition-opacity ${cfg.cls}`}
                            onClick={e => { e.stopPropagation(); setStatusMenu({ x: e.pageX, y: e.pageY, cita }); }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                            {cfg.label}
                        </div>
                    </div>
                </div>
            </div>
        );
    };


    const renderGabineteList = (gab: 'G1' | 'G2') => {
        let elements = [];
        const citasGab = filteredCitas.filter(c => c.gabinete === gab).sort((a,b) => {
            const aMin = parseTime(a.horaInicio);
            const bMin = parseTime(b.horaInicio);
            return aMin - bMin;
        });

        for (const [startH, endH] of workingSegments) {
            const segStart = startH * 60;
            const segEnd = endH * 60;
            
            if (startH >= 15) {
                elements.push(
                    <div key={`seg-${gab}-${startH}-pausa`} className="bg-[#051650] py-1.5 px-6 shadow-sm border-y border-[#051650]/80 sticky top-0 z-20 flex justify-center items-center gap-3">
                        <svg width="10" height="10" viewBox="0 0 14 14" className="flex-shrink-0 rounded-[2px] overflow-hidden opacity-90">
                            <rect x="0" y="0" width="7" height="7" fill="#FF4B68" />
                            <rect x="7" y="0" width="7" height="7" fill="#FBFFA3" />
                            <rect x="0" y="7" width="7" height="7" fill="#118DF0" />
                            <rect x="7" y="7" width="7" height="7" fill="#004182" />
                        </svg>
                        <span className="text-[11px] font-bold uppercase tracking-widest leading-none bg-gradient-to-r from-[#D4F5F5] to-[#FBFFA3] bg-clip-text text-transparent transform translate-y-[1px]">Pausa</span>
                        <svg width="10" height="10" viewBox="0 0 14 14" className="flex-shrink-0 rounded-[2px] overflow-hidden opacity-90">
                            <rect x="0" y="0" width="7" height="7" fill="#FF4B68" />
                            <rect x="7" y="0" width="7" height="7" fill="#FBFFA3" />
                            <rect x="0" y="7" width="7" height="7" fill="#118DF0" />
                            <rect x="7" y="7" width="7" height="7" fill="#004182" />
                        </svg>
                    </div>
                );
            }

            let currentMin = segStart;

            const segmentCitas = citasGab.filter(c => {
                const t = parseTime(c.horaInicio);
                return t >= segStart && t < segEnd; 
            });

            for (const cita of segmentCitas) {
                const cStart = parseTime(cita.horaInicio);
                
                while (currentMin + 15 <= cStart) {
                    elements.push(renderFreeSlot(gab, currentMin));
                    currentMin += 15;
                }
                
                elements.push(renderListCita(cita));
                // Redondear duracion al alza a los 15 min más cercanos para continuar
                const safeDuration = Math.min(cita.duracionMinutos || 30, 240);
                const durRounded = Math.ceil(safeDuration / 15) * 15;
                currentMin = Math.max(currentMin, cStart + durRounded);
            }

            while (currentMin + 15 <= segEnd) {
                 elements.push(renderFreeSlot(gab, currentMin));
                 currentMin += 15;
            }
        }
        return elements;
    };


    if (activeSubArea === 'Gestión de Citas' || showConfiguracion) {
        return (
            <div className="flex flex-col h-full bg-gradient-to-br from-[#0c2a80] to-[#051650] relative">
                {showConfiguracion && (
                    <div className="px-4 pt-4 pb-0 flex justify-start flex-shrink-0">
                        <button
                            onClick={() => setShowConfiguracion(false)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-[13px] font-bold uppercase"
                        >
                            <ChevronLeft className="w-4 h-4" /> Volver a Agenda
                        </button>
                    </div>
                )}
                {/* FIX: overflow-y-auto + padding para que ConfiguracionAgenda tenga scroll */}
                <div className="flex-1 overflow-y-auto relative">
                    <div className="px-4 py-4 bg-[#f8fafc] min-h-full rounded-t-2xl">
                        <ConfiguracionAgenda />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-3 p-4 relative overflow-hidden bg-[#f8f9fa]">

            {/* Floating Status Menu */}
            {statusMenu && (
                <div
                    data-context-menu="true"
                    className="fixed z-[200] bg-white border border-slate-200 shadow-2xl rounded-xl py-1.5 w-44 select-none"
                    style={{ top: statusMenu.y, left: statusMenu.x }}
                >
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 rounded-t-xl mb-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cambiar Estado</p>
                        <p className="text-[12px] font-bold text-[#051650] truncate">{statusMenu.cita.nombrePaciente}</p>
                    </div>

                    {Object.entries(EC).map(([id, cfg]) => (
                        <button
                            key={id}
                            className={`w-full text-left px-4 py-2 text-[12px] font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors ${statusMenu.cita.estado === id ? 'bg-blue-50/50' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                updateCitaEstado(id as any, statusMenu.cita.id);
                                setStatusMenu(null);
                            }}
                        >
                            <span className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{ background: cfg.dot }} />
                            <span className="text-slate-700">{cfg.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Floating Context Menu */}
            {contextMenu && (
                <div
                    data-context-menu="true"
                    className="fixed z-[200] bg-white border border-slate-200 shadow-2xl rounded-xl py-1.5 w-52 select-none"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Acciones</p>
                        <p className="text-[12px] font-bold text-slate-800 truncate">{contextMenu.cita.nombrePaciente}</p>
                    </div>
                    <div className="px-1">
                        <button onClick={() => { setEditingCita(contextMenu.cita); setContextMenu(null); }} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 text-[12px] font-bold text-blue-600 mb-1">✏️ Editar Cita</button>
                        <div className="my-1 border-t border-slate-100" />
                        {[
                            { label: 'Copiar', key: 'copy', hint: '⌘C' },
                            { label: 'Cortar', key: 'cut', hint: '⌘X' },
                        ].map(({ label, key, hint }) => (
                            <button key={key} onClick={() => handleAction(key)} className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 text-[12px] font-medium text-slate-700">
                                {label}<span className="text-[13px] text-slate-400 font-mono">{hint}</span>
                            </button>
                        ))}
                        <button onClick={() => handleAction('paste')} disabled={!clipboard} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[12px] font-medium text-slate-700 ${clipboard ? 'hover:bg-slate-50' : 'opacity-30 cursor-not-allowed'}`}>
                            Pegar<span className="text-[13px] text-slate-400 font-mono">⌘V</span>
                        </button>

                        <div className="my-1 border-t border-slate-100" />

                        {/* Estado submenu */}
                        <div className="group/sub relative">
                            <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 text-[12px] font-medium text-slate-700">
                                Cambiar Estado <MoreVertical className="w-3 h-3 text-slate-400" />
                            </button>
                            <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:flex flex-col bg-white border border-slate-200 shadow-xl rounded-xl py-1 w-36 z-10">
                                {(['confirmada', 'espera', 'gabinete', 'finalizada', 'planificada', 'anulada', 'cancelada', 'fallada'] as EstadoCita[]).map(e => (
                                    <button 
                                        key={e} 
                                        onClick={() => updateCitaEstado(e)} 
                                        className={`text-left px-3 py-1.5 hover:bg-slate-50 text-[13px] font-bold uppercase capitalize ${['anulada', 'cancelada', 'fallada'].includes(e) ? 'text-[#E03555] hover:bg-[#FFF0F3]' : 'text-slate-600'}`}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="my-1 border-t border-slate-100" />
                        
                        <button onClick={() => handleAction('print')} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 text-[12px] font-medium text-slate-700">Imprimir Cita</button>
                        <button onClick={() => handleAction('justificante')} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 text-[12px] font-medium text-slate-700">Justificante</button>
                        <button onClick={() => handleAction('whatsapp')} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#25D366]/10 text-[12px] font-medium text-[#25D366]">&#128172; Enviar por WhatsApp</button>

                        <div className="my-1 border-t border-slate-100" />
                        <button onClick={() => handleAction('delete')} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-50 text-[12px] font-bold text-red-600 mt-1">🗑️ Borrar Cita</button>
                    </div>
                </div>
            )}

            {/* Single Unified Toolbar Row */}
            <header className="flex items-center justify-between rounded-xl p-3 shadow-md flex-shrink-0 bg-white border-[1.5px] border-[#051650] w-full relative gap-4">

                {/* Left: Date Nav */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    {/* "Hoy" Button */}
                    <button
                        onClick={!isToday ? goToday : undefined}
                        className={`text-[13px] font-bold px-4 py-1.5 rounded-md transition-all text-white shadow-sm bg-blue-700 ${isToday ? 'cursor-default opacity-90' : 'hover:bg-blue-800 hover:shadow-md'}`}
                    >
                        Hoy
                    </button>

                    <div className="h-5 w-px bg-slate-200 mx-1" />

                    {/* DATE NAV PILLS ENGLOBADOS */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 shadow-sm">
                        <button
                            onClick={() => goDay(-1)}
                            className="w-7 h-7 flex items-center justify-center text-slate-500 bg-white hover:bg-slate-100 rounded-md transition-all shadow-sm"
                            title="Día Anterior"
                        >
                            <ChevronLeft className="w-4 h-4 ml-[-1px]" />
                        </button>
                        
                        <div className="flex items-center justify-center px-2 relative min-w-[120px]">
                            <input
                                type="date"
                                value={dateToISO(selectedDate)}
                                onChange={e => {
                                    if (e.target.value) {
                                        const d = new Date(e.target.value + 'T00:00:00');
                                        setSelectedDate(d);
                                    }
                                }}
                                className="bg-transparent text-[13px] font-bold text-[#051650] tracking-wide focus:outline-none focus:ring-0 cursor-pointer w-full text-center outline-none border-none border-0"
                                title="Seleccionar día"
                                style={{ border: 'none', outline: 'none', boxShadow: 'none', backgroundColor: 'transparent' }}
                            />
                        </div>
                        
                        <button
                            onClick={() => goDay(1)}
                            className="w-7 h-7 flex items-center justify-center text-slate-500 bg-white hover:bg-slate-100 rounded-md transition-all shadow-sm"
                            title="Día Siguiente"
                        >
                            <ChevronRightIcon className="w-4 h-4 mr-[-1px]" />
                        </button>
                    </div>
                </div>

                {/* Center: Search */}
                <div className="flex-1 flex justify-center w-full min-w-[200px] max-w-4xl">
                    <div className="flex items-center w-full bg-[#D4F5F5] rounded-lg px-4 pt-2 pb-2 shadow-inner focus-within:ring-2 focus-within:ring-teal-400 focus-within:bg-[#C2EDED] transition-all">
                        <Search className="w-4 h-4 text-[#051650] opacity-60 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar paciente o cita..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent text-[14px] font-bold text-[#051650] placeholder-[#051650]/60 w-full ml-3 focus:outline-none focus:ring-0 outline-none border-none p-0"
                        />
                    </div>
                </div>

                {/* Right: Actions, Filters & Alert */}
                <div className="flex items-center justify-end gap-3 flex-shrink-0">
                    {/* ALARM */}
                    {altaCargaQuirurgica && (
                        <div className="flex items-center gap-2 bg-[#FFF0F3] text-[#E03555] px-3 py-1.5 rounded-lg border border-rose-100 animate-in fade-in zoom-in duration-300 shadow-sm mr-2">
                            <Activity className="w-3.5 h-3.5 animate-pulse shrink-0" />
                            <span className="text-[13px] font-bold uppercase tracking-wider hidden xl:inline">Carga Quirúrgica &gt;40%</span>
                            <button onClick={() => setAltaCargaQuirurgica(false)} className="ml-1 hover:bg-[#FFC0CB]/50 rounded-full p-0.5"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    )}

                    {/* VIEW TABS - Day/Week */}
                    <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                        <button
                            onClick={() => setVistaTemporal('dia')}
                            className={`text-[13px] font-bold px-3 py-1.5 rounded-md transition-all ${vistaTemporal === 'dia' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            style={vistaTemporal === 'dia' ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' } : {}}
                        >
                            Día
                        </button>
                        <button
                            onClick={() => setVistaTemporal('semana')}
                            className={`text-[13px] font-bold px-3 py-1.5 rounded-md transition-all ${vistaTemporal === 'semana' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            style={vistaTemporal === 'semana' ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' } : {}}
                        >
                            Semana
                        </button>
                    </div>

                    <div className="relative isolate z-[100]">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowDoctorsMenu(prev => !prev); }}
                            className="flex items-center gap-1.5 text-[13px] font-bold uppercase px-3 py-1.5 rounded-lg text-slate-600 transition-all bg-slate-50 border border-slate-200 hover:bg-slate-100"
                        >
                            <User className="w-3.5 h-3.5" /> Doctores <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {showDoctorsMenu && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-200 py-2 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                <div className="px-3 pb-2 mb-1 border-b border-slate-100">
                                    <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Filtrar por Especialista</p>
                                </div>
                                {(Array.from(new Set(citas.filter(c => c.doctor).map(c => c.doctor))) as string[])
                                    .sort((a, b) => a.localeCompare(b))
                                    .map(doc => {
                                        const isSelected = selectedDoctors.includes(doc);
                                        return (
                                            <button
                                                key={doc}
                                                onClick={() => toggleDoctor(doc)}
                                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                                            >
                                                <span className={`text-[12px] font-bold ${isSelected ? 'text-[#051650]' : 'text-slate-600'}`}>{doc}</span>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                            </button>
                                        );
                                    })}
                                {selectedDoctors.length > 0 && (
                                    <div className="px-3 pt-2 mt-1 border-t border-slate-100">
                                        <button onClick={() => setSelectedDoctors([])} className="text-[13px] font-bold text-red-500 hover:text-[#E03555] uppercase w-full text-center">Limpiar Filtros</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="h-5 w-px bg-slate-200" />

                    {/* TOOLS - CONFIGURACIÓN CENTRALIZADA */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(prev => !prev); }}
                            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${showSettingsMenu ? 'bg-[#051650] text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                            title="Opciones de Agenda"
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {/* Settings Dropdown */}
                        {showSettingsMenu && (
                            <div
                                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-[100] overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-slate-400" />
                                    <span className="text-[13px] font-bold text-[#051650] uppercase tracking-wide">Opciones Agenda</span>
                                </div>

                                <button
                                    onClick={() => { setShowConfiguracion(true); setShowSettingsMenu(false); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors group"
                                >
                                    <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors"><Settings className="w-3.5 h-3.5" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-bold text-slate-700 leading-none">Gestión de Citas</span>
                                        <span className="text-[13px] text-slate-400 font-medium">Configurar horarios y reglas</span>
                                    </div>
                                </button>

                                <div className="h-px bg-slate-100 my-1 mx-2" />

                                <button
                                    onClick={() => { toggleVista(); setShowSettingsMenu(false); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors group"
                                >
                                    <div className="w-6 h-6 rounded-md bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors"><Filter className="w-3.5 h-3.5" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-bold text-slate-700 leading-none">Vistas: {vistaGabinete === 'ALL' ? 'Todos Doctores' : (vistaGabinete === 'G1' ? 'Dr. Rubio' : 'Dra. García')}</span>
                                        <span className="text-[13px] text-slate-400 font-medium">Alternar agendas visibles</span>
                                    </div>
                                </button>

                                <div className="h-px bg-slate-100 my-1 mx-2" />

                                <button
                                    onClick={() => { blockSlots(); setShowSettingsMenu(false); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors group"
                                >
                                    <div className="w-6 h-6 rounded-md bg-[#FFF0F3] text-[#E03555] flex items-center justify-center shrink-0 group-hover:bg-[#FFE0E6] transition-colors"><Lock className="w-3.5 h-3.5" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-bold text-slate-700 leading-none">Bloquear Tramos</span>
                                        <span className="text-[13px] text-slate-400 font-medium">Insertar bloqueo selectivo</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => { unblockSlots(); setShowSettingsMenu(false); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors group"
                                >
                                    <div className="w-6 h-6 rounded-md bg-blue-50 text-[#051650] flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors"><Unlock className="w-3.5 h-3.5" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-bold text-slate-700 leading-none">Desbloquear Tramos</span>
                                        <span className="text-[13px] text-slate-400 font-medium">Liberar bloqueos (bio)</span>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header >

            <main className="flex-1 overflow-hidden" style={{ background: '#f1f5f9' }}> {/* slightly darker background to make white columns pop */}

                <div ref={scrollContainerRef} className="h-full overflow-y-auto relative p-3">
                    {loadingCitas && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm gap-3 rounded-2xl border border-slate-200 shadow-sm m-6">
                            <div className="w-8 h-8 border-4 border-[#051650]/20 border-t-[#051650] rounded-full animate-spin" />
                            <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Cargando agenda...</p>
                        </div>
                    )}

                    {citasError && !loadingCitas && (
                        <div className="mb-4 z-50 flex items-center gap-3 bg-[#FFF0F3] border border-[#FFC0CB] rounded-xl px-4 py-3 shadow">
                            <span className="text-lg">⚠️</span>
                            <p className="text-[12px] font-semibold text-[#C02040] flex-1">{citasError}</p>
                            <button onClick={() => setCitasError(null)} className="text-[#FF4B68] hover:text-[#E03555] text-[13px] font-bold">✕</button>
                        </div>
                    )}

                    {vistaTemporal === 'dia' ? (
                        <div className={`grid gap-8 ${vistaGabinete === 'ALL' ? 'grid-cols-2' : 'grid-cols-1'} h-fit mx-auto`}>
                            { (vistaGabinete === 'ALL' || vistaGabinete === 'G1') && (
                                <div className="bg-white rounded-xl shadow-2xl shadow-slate-300/50 border-[1.5px] border-[#051650] overflow-hidden flex flex-col h-fit">
                                    {/* GAB 1 HEADER */}
                                    <div className="bg-[#051650] text-white px-6 py-2 flex items-center justify-between sticky top-0 z-30 shadow-md">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)] animate-pulse" />
                                            <h3 className="text-[14px] font-bold tracking-wide">{g1DoctorLabel}</h3>
                                        </div>
                                        <span className="text-[10px] font-bold bg-[#FBFFA3] px-2 py-0.5 rounded-md uppercase tracking-widest text-[#051650] border border-[#FBFFA3]/50">Gabinete 1</span>
                                    </div>
                                    {/* GAB 1 LIST */}
                                    <div className="flex-1 bg-slate-50/80" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '4px 4px' }}>
                                        {renderGabineteList('G1')}
                                    </div>
                                </div>
                            )}
                            
                            { (vistaGabinete === 'ALL' || vistaGabinete === 'G2') && (
                                <div className="bg-white rounded-xl shadow-2xl shadow-slate-300/50 border-[1.5px] border-[#051650] overflow-hidden flex flex-col h-fit">
                                    {/* GAB 2 HEADER */}
                                    <div className="bg-[#051650] text-white px-6 py-2 flex items-center justify-between sticky top-0 z-30 shadow-md">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-300 shadow-[0_0_10px_rgba(147,197,253,0.8)] animate-pulse" />
                                            <h3 className="text-[14px] font-bold tracking-wide">{g2DoctorLabel}</h3>
                                        </div>
                                        <span className="text-[10px] font-bold bg-[#FBFFA3] px-2 py-0.5 rounded-md uppercase tracking-widest text-[#051650] border border-[#FBFFA3]/50">Espacio auxiliar</span>
                                    </div>
                                    {/* GAB 2 LIST */}
                                    <div className="flex-1 bg-slate-50/80" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '4px 4px' }}>
                                        {renderGabineteList('G2')}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex gap-4 overflow-x-auto pb-4 h-fit w-full">
                            {Array.from({length: 6}, (_, i) => {
                                const d = new Date(selectedDate);
                                const day = d.getDay();
                                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                const monday = new Date(d.setDate(diff));
                                const current = new Date(monday);
                                current.setDate(monday.getDate() + i);
                                const dateStr = dateToISO(current);
                                
                                const dayCitas = filteredCitas
                                    .filter(c => c.fecha === dateStr && (vistaGabinete === 'ALL' || c.gabinete === vistaGabinete))
                                    .sort((a,b) => parseTime(a.horaInicio) - parseTime(b.horaInicio));
                                    
                                return (
                                    <div key={dateStr} className="bg-white rounded-xl shadow-md border-[1.5px] border-[#051650] flex flex-col min-w-[320px] max-w-[350px] overflow-hidden flex-1">
                                        <div className="bg-[#051650] text-white px-4 py-3 text-center sticky top-0 z-30 shadow-md flex justify-between items-center">
                                            <h3 className="text-[13px] font-bold tracking-wide uppercase">{DIAS_ES[current.getDay()]} {current.getDate()}</h3>
                                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">{dayCitas.length} citas</span>
                                        </div>
                                        <div className="flex-1 bg-slate-50/80 space-y-2 pb-6 min-h-[400px] p-2" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '4px 4px' }}>
                                            {dayCitas.length > 0 ? (
                                                dayCitas.map(c => (
                                                    <div key={c.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden" style={{ minHeight: '60px' }}>
                                                        {renderListCita(c)}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-32 text-slate-400 mt-10">
                                                    <span className="text-[12px] font-bold uppercase tracking-widest text-[#051650]/40">Sin citas</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>


            {/* Modal Justificante EDITABLE */}
            {justificanteModal && (
                <div className="fixed inset-0 z-[400] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setJustificanteModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-[#051650] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-bold text-sm tracking-tight">📄 Justificante de Asistencia</h3>
                                <p className="text-blue-300 text-[13px] mt-0.5">Edita los campos antes de imprimir</p>
                            </div>
                            <button onClick={() => setJustificanteModal(null)} className="text-slate-300 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Paciente</label>
                                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#051650]/20"
                                        value={justificanteModal.paciente}
                                        onChange={e => setJustificanteModal({ ...justificanteModal, paciente: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
                                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#051650]/20"
                                        value={justificanteModal.fecha}
                                        onChange={e => setJustificanteModal({ ...justificanteModal, fecha: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hora</label>
                                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#051650]/20"
                                        value={justificanteModal.hora}
                                        onChange={e => setJustificanteModal({ ...justificanteModal, hora: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tratamiento</label>
                                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#051650]/20"
                                        value={justificanteModal.tratamiento}
                                        onChange={e => setJustificanteModal({ ...justificanteModal, tratamiento: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Doctor/a</label>
                                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#051650]/20"
                                        value={justificanteModal.doctor}
                                        onChange={e => setJustificanteModal({ ...justificanteModal, doctor: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Texto del documento</label>
                                    <textarea rows={3}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#051650]/20 resize-none"
                                        value={justificanteModal.texto}
                                        onChange={e => setJustificanteModal({ ...justificanteModal, texto: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="px-5 pb-5 flex gap-3">
                            <button onClick={() => setJustificanteModal(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const jm = justificanteModal;
                                    const w = window.open('', '_blank', 'width=700,height=900');
                                    if (!w) { alert('Activa las ventanas emergentes para imprimir el justificante'); return; }
                                    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Justificante de Asistencia</title>
                                    <style>
                                      body { font-family: Arial, sans-serif; padding: 60px; color: #1e293b; }
                                      h1 { color: #051650; font-size: 22px; margin: 0 0 4px; }
                                      .sub { color: #64748b; font-size: 13px; margin-bottom: 40px; }
                                      .box { border: 2px solid #e2e8f0; border-radius: 12px; padding: 28px; margin: 24px 0; }
                                      .label { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; }
                                      .value { font-size: 15px; font-weight: 700; color: #0f172a; }
                                      .firma { margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 24px; display: flex; justify-content: space-between; }
                                      .firma-box { width: 200px; text-align: center; }
                                      .firma-line { border-top: 1px solid #94a3b8; margin-bottom: 8px; height: 50px; }
                                      @media print { body { padding: 30px; } }
                                    </style></head><body>
                                    <h1>RUBIO GARCÍA DENTAL</h1>
                                    <p class="sub">Clínica Dental · CIF: B12345678 · Tel. 943 000 000 · Donostia-San Sebastián</p>
                                    <hr style="border:1px solid #e2e8f0; margin-bottom:32px">
                                    <h2 style="font-size:18px;color:#051650;text-align:center;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:32px">Justificante de Asistencia a Consulta Médica</h2>
                                    <div class="box">
                                      <div class="label">Paciente</div>
                                      <div class="value">${jm.paciente}</div>
                                    </div>
                                    <div class="box">
                                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                                        <div><div class="label">Fecha</div><div class="value">${jm.fecha}</div></div>
                                        <div><div class="label">Hora</div><div class="value">${jm.hora} h</div></div>
                                        <div><div class="label">Tratamiento</div><div class="value">${jm.tratamiento}</div></div>
                                        <div><div class="label">Doctor/a</div><div class="value">${jm.doctor}</div></div>
                                      </div>
                                    </div>
                                    <p style="font-size:13px;color:#64748b;margin-top:24px">${jm.texto}</p>
                                    <div class="firma">
                                      <div class="firma-box">
                                        <div class="firma-line"></div>
                                        <p style="font-size:11px;color:#94a3b8">Firma del/la Doctor/a</p>
                                        <p style="font-size:12px;font-weight:700">${jm.doctor}</p>
                                      </div>
                                      <div style="text-align:right;font-size:11px;color:#94a3b8">
                                        <p>Donostia, ${new Date().toLocaleDateString('es-ES')}</p>
                                        <p style="margin-top:8px;font-size:10px">Sello de la clínica</p>
                                        <div style="border:1px solid #e2e8f0;width:120px;height:60px;margin-left:auto;margin-top:4px;border-radius:8px"></div>
                                      </div>
                                    </div>
                                    </body></html>`);
                                    w.document.close();
                                    w.print();
                                    setJustificanteModal(null);
                                }}
                                className="flex-1 py-2.5 bg-[#051650] text-white rounded-xl text-sm font-bold hover:bg-[#0056b3] transition-all flex items-center justify-center gap-2">
                                🖨️ Imprimir
                            </button>
                        </div>
                        {/* WhatsApp */}
                        {justificanteModal.telefono && (
                            <div className="px-5 pb-4">
                                <button
                                    onClick={() => {
                                        const jm = justificanteModal;
                                        const txt = `📄 Justificante de asistencia\n\nPaciente: ${jm.paciente}\nFecha: ${jm.fecha}\nHora: ${jm.hora} h\nTratamiento: ${jm.tratamiento}\nDoctor/a: ${jm.doctor}\n\n${jm.texto}\n\n— Rubio García Dental`;
                                        if (isEvolutionConfigured()) {
                                            sendTextMessage(jm.telefono, txt);
                                        } else {
                                            window.open(`https://wa.me/${jm.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`, '_blank');
                                        }
                                        setJustificanteModal(null);
                                    }}
                                    className="w-full py-2 bg-[#25D366] text-white rounded-xl text-sm font-bold hover:bg-[#1ebe5a] transition-all flex items-center justify-center gap-2">
                                    💬 Enviar por WhatsApp
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Block Modal */}
            {
                showBlockModal && (
                    <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-[#051650] px-5 py-4 flex items-center justify-between pointer-events-none">
                                <h3 className="text-white font-bold text-[14px] flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-[#FF4B68]" />
                                    Bloquear Tramo
                                </h3>
                                <button onClick={() => setShowBlockModal(false)} className="text-slate-300 hover:text-white transition-colors pointer-events-auto">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-5 flex flex-col gap-4">
                                <div>
                                    <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Doctor / Agenda</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        value={blockForm.gabinete}
                                        onChange={e => setBlockForm({ ...blockForm, gabinete: e.target.value })}
                                    >
                                        <option value="G1">Gabinete 1 ({agendaConfigStore?.doctores?.[0]?.nombre || 'Dr. Mario Rubio'})</option>
                                        <option value="G2">Espacio auxiliar (Tec. Juan Antonio Manzanedo)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Hora Inicio</label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={blockForm.hora}
                                            onChange={e => setBlockForm({ ...blockForm, hora: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Duración</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={blockForm.duracion}
                                            onChange={e => setBlockForm({ ...blockForm, duracion: Number(e.target.value) })}
                                        >
                                            <option value={15}>15 minutos</option>
                                            <option value={30}>30 minutos</option>
                                            <option value={45}>45 minutos</option>
                                            <option value={60}>1 hora</option>
                                            <option value={120}>2 horas</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Motivo / Etiqueta</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 font-medium"
                                        placeholder="Ej: Bioseguridad, Mantenimiento..."
                                        value={blockForm.motivo}
                                        onChange={e => setBlockForm({ ...blockForm, motivo: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex gap-2 justify-end mt-2">
                                <button
                                    onClick={() => setShowBlockModal(false)}
                                    className="px-4 py-2 rounded-lg text-[12px] font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmBlockSlots}
                                    className="px-5 py-2 rounded-lg text-[12px] font-bold text-white bg-red-500 hover:bg-[#E03555] shadow-lg shadow-rose-500/30 transition-all flex items-center gap-2"
                                >
                                    <Lock className="w-3.5 h-3.5" />
                                    Insertar Bloqueo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Quick Edit Modal Placeholder */}
            {
                editingCita && (
                    <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="bg-[#051650] px-5 py-4 flex items-center justify-between pointer-events-none">
                                <h3 className="text-white font-bold text-[14px]">Detalle de Cita</h3>
                                <button onClick={() => setEditingCita(null)} className="text-slate-300 hover:text-white transition-colors pointer-events-auto">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {/* Banner Primera Visita check */}
                            <div className="pointer-events-auto px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="pv-check"
                                        type="checkbox"
                                        checked={isPrimeraVisita}
                                        onChange={e => {
                                            setIsPrimeraVisita(e.target.checked);
                                            if (e.target.checked) {
                                                setEditingCita({ ...editingCita, tratamiento: 'Primera Visita' });
                                                setEsMenorForm(false);
                                                setContactoForm({ nombre: '', apellidos: '', telefono: '', email: '' });
                                                setTutorForm({ nombre: '', apellidos: '', telefono: '', email: '', relacion: '' });
                                            }
                                        }}
                                        className="w-4 h-4 rounded accent-pink-500 cursor-pointer"
                                    />
                                    <label htmlFor="pv-check" className="text-[12px] font-bold text-slate-700 cursor-pointer select-none">
                                        🏥 Primera Visita
                                        <span className="ml-1 text-[13px] font-normal text-slate-400">— sin NumPac en GELITE</span>
                                    </label>
                                </div>
                                {isPrimeraVisita && (
                                    <span className="text-[13px] font-bold text-pink-600 bg-pink-50 border border-pink-200 rounded-full px-2 py-0.5">🔴 CITA ROSA</span>
                                )}
                            </div>
                            <div className="p-5">
                                {/* ── PRIMERA VISITA: Formulario de Contacto ───────────────── */}
                                {(isPrimeraVisita || editingCita.tratamiento === 'Primera Visita') ? (
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
                                            <span className="text-orange-500 text-lg">👤</span>
                                            <div>
                                                <p className="text-[13px] font-bold text-orange-700 uppercase tracking-wide">Contacto Nuevo — Sin NumPac</p>
                                                <p className="text-[13px] text-orange-500">El paciente no tiene expediente en GELITE todavía. Se asignará NumPac al acudir.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre <span className="text-[#FF4B68]">*</span></label>
                                                <input
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-orange-300 focus:outline-none"
                                                    placeholder="Juan"
                                                    value={contactoForm.nombre}
                                                    onChange={e => setContactoForm(p => ({ ...p, nombre: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Apellidos</label>
                                                <input
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-orange-300 focus:outline-none"
                                                    placeholder="García López"
                                                    value={contactoForm.apellidos}
                                                    onChange={e => setContactoForm(p => ({ ...p, apellidos: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Teléfono <span className="text-[#FF4B68]">*</span></label>
                                                <input
                                                    type="tel"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-orange-300 focus:outline-none"
                                                    placeholder="+34 600 000 000"
                                                    value={contactoForm.telefono}
                                                    onChange={e => setContactoForm(p => ({ ...p, telefono: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
                                                <input
                                                    type="email"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-orange-300 focus:outline-none"
                                                    placeholder="juan@ejemplo.com"
                                                    value={contactoForm.email}
                                                    onChange={e => setContactoForm(p => ({ ...p, email: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        {/* Toggle menor */}
                                        <div className="mt-3 flex items-center gap-2">
                                            <input
                                                id="menor-check"
                                                type="checkbox"
                                                checked={esMenorForm}
                                                onChange={e => setEsMenorForm(e.target.checked)}
                                                className="w-4 h-4 rounded accent-blue-500"
                                            />
                                            <label htmlFor="menor-check" className="text-[13px] font-bold text-slate-600 cursor-pointer select-none">
                                                👶 Es menor de edad — datos del tutor requeridos
                                            </label>
                                        </div>
                                        {/* Datos tutor */}
                                        {esMenorForm && (
                                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                                <p className="text-[13px] font-bold text-blue-700 uppercase tracking-wide mb-2">👨‍👦 Datos del Tutor Legal</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[13px] font-bold text-blue-600 mb-1">Nombre tutor <span className="text-[#FF4B68]">*</span></label>
                                                        <input className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[#051650] focus:ring-1 focus:ring-blue-300 focus:outline-none"
                                                            placeholder="María" value={tutorForm.nombre}
                                                            onChange={e => setTutorForm(p => ({ ...p, nombre: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[13px] font-bold text-blue-600 mb-1">Apellidos tutor</label>
                                                        <input className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[#051650] focus:ring-1 focus:ring-blue-300 focus:outline-none"
                                                            placeholder="García" value={tutorForm.apellidos}
                                                            onChange={e => setTutorForm(p => ({ ...p, apellidos: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[13px] font-bold text-blue-600 mb-1">Teléfono tutor <span className="text-[#FF4B68]">*</span></label>
                                                        <input type="tel" className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[#051650] focus:ring-1 focus:ring-blue-300 focus:outline-none"
                                                            placeholder="+34 600 000 000" value={tutorForm.telefono}
                                                            onChange={e => setTutorForm(p => ({ ...p, telefono: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[13px] font-bold text-blue-600 mb-1">Email tutor</label>
                                                        <input type="email" className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[#051650] focus:ring-1 focus:ring-blue-300 focus:outline-none"
                                                            placeholder="maria@ejemplo.com" value={tutorForm.email}
                                                            onChange={e => setTutorForm(p => ({ ...p, email: e.target.value }))} />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-[13px] font-bold text-blue-600 mb-1">Relación</label>
                                                        <select className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[#051650] focus:ring-1 focus:ring-blue-300 focus:outline-none"
                                                            value={tutorForm.relacion} onChange={e => setTutorForm(p => ({ ...p, relacion: e.target.value }))}>
                                                            <option value="">Seleccionar...</option>
                                                            <option value="padre">Padre</option>
                                                            <option value="madre">Madre</option>
                                                            <option value="tutor_legal">Tutor legal</option>
                                                            <option value="otro">Otro</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {contactoError && <p className="text-[13px] text-red-500 mt-2">⚠️ {contactoError}</p>}
                                    </div>
                                ) : (
                                    <div className="mb-4 relative">
                                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Paciente</label>
                                        <div className="flex gap-2 mb-1">
                                            <div className="flex-1 relative">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                    placeholder="Buscar por nombre, ID, teléfono..."
                                                    value={patientQuery || editingCita.nombrePaciente}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setPatientQuery(val);
                                                        setEditingCita({ ...editingCita, nombrePaciente: val });
                                                        if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
                                                        patientSearchTimer.current = setTimeout(async () => {
                                                            if (val.trim().length >= 2) {
                                                                const results = await searchPacientes(val.trim());
                                                                setPatientResults(results);
                                                                setShowPatientDropdown(true);
                                                            } else {
                                                                setPatientResults([]);
                                                                setShowPatientDropdown(false);
                                                            }
                                                        }, 300);
                                                    }}
                                                    onFocus={async () => {
                                                        if (patientQuery.trim().length >= 2) {
                                                            setShowPatientDropdown(true);
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div className="w-20">
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                    placeholder="ID"
                                                    value={editingCita.pacienteNumPac}
                                                    onChange={e => setEditingCita({ ...editingCita, pacienteNumPac: e.target.value })}
                                                    title="NumPac / ID del paciente"
                                                />
                                            </div>
                                        </div>
                                        {/* Dropdown de resultados */}
                                        {showPatientDropdown && patientResults.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mt-1">
                                                {patientResults.map(p => (
                                                    <button
                                                        key={p.numPac}
                                                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0"
                                                        onClick={() => {
                                                            setEditingCita({
                                                                ...editingCita,
                                                                nombrePaciente: `${p.apellidos}, ${p.nombre}`.trim(),
                                                                pacienteNumPac: p.numPac,
                                                            });
                                                            setPatientQuery('');
                                                            setShowPatientDropdown(false);
                                                        }}
                                                    >
                                                        <span className="text-[13px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>{p.numPac}</span>
                                                        <span className="text-[12px] font-bold text-slate-800 truncate">{p.apellidos}, {p.nombre}</span>
                                                        {p.telefono && <span className="text-[13px] text-slate-400 ml-auto shrink-0">📞 {p.telefono}</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {showPatientDropdown && patientResults.length === 0 && patientQuery.trim().length >= 2 && (
                                            <div className="absolute left-0 right-0 top-full z-50 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 p-3 text-center">
                                                <p className="text-[13px] text-slate-400">Sin resultados</p>
                                                <button
                                                    className="text-[13px] font-bold text-blue-600 mt-1 hover:underline"
                                                    onClick={() => {
                                                        setEditingCita({ ...editingCita, nombrePaciente: patientQuery, pacienteNumPac: '' });
                                                        setShowPatientDropdown(false);
                                                    }}
                                                >
                                                    + Paciente nuevo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )} {/* End Primera Visita / Paciente conditional */}

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tratamiento</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={editingCita.tratamiento}
                                            onChange={e => setEditingCita({ ...editingCita, tratamiento: e.target.value })}
                                        >
                                            {agendaTratamientos.map(t => <option key={t.idIcono} value={t.descripcion}>{t.descripcion}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Doctor</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={editingCita.doctor}
                                            onChange={e => setEditingCita({ ...editingCita, doctor: e.target.value })}
                                        >
                                            {agendaDoctores.map(d => <option key={d.idUsu} value={d.nombre}>{d.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Hora Inicio</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={editingCita.horaInicio}
                                            onChange={e => setEditingCita({ ...editingCita, horaInicio: e.target.value })}
                                        >
                                            {Array.from({ length: 14 * 4 }, (_, i) => {
                                                const h = Math.floor(i / 4) + 8;
                                                const m = (i % 4) * 15;
                                                const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                                return <option key={val} value={val}>{val}</option>;
                                            })}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Duración</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={editingCita.duracionMinutos}
                                            onChange={e => setEditingCita({ ...editingCita, duracionMinutos: Number(e.target.value) })}
                                        >
                                            {[15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180].map(m => (
                                                <option key={m} value={m}>{m} minutos</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Situación Cita</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        value={editingCita.estado}
                                        onChange={e => setEditingCita({ ...editingCita, estado: e.target.value as any })}
                                    >
                                        {agendaEstados.map(e => (
                                            <option key={e.idSitC} value={e.descripcion.toLowerCase()}>{e.descripcion}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Notas / Observaciones</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-[#051650] focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                                        rows={3}
                                        placeholder="Notas libres sobre la cita..."
                                        value={editingCita.notas || ''}
                                        onChange={e => setEditingCita({ ...editingCita, notas: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-4">
                                    <button onClick={() => setEditingCita(null)} className="px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
                                    <button onClick={async () => {
                                        // Primera Visita: crear contacto primero
                                        if (isPrimeraVisita || editingCita.tratamiento === 'Primera Visita') {
                                            if (!contactoForm.nombre.trim() || !contactoForm.telefono.trim()) {
                                                setContactoError('Nombre y teléfono son obligatorios');
                                                return;
                                            }
                                            if (esMenorForm && (!tutorForm.nombre.trim() || !tutorForm.telefono.trim())) {
                                                setContactoError('Nombre y teléfono del tutor son obligatorios para menores');
                                                return;
                                            }
                                            setContactoSaving(true);
                                            setContactoError(null);
                                            try {
                                                const fechaCita = new Date(`${dateToISO(selectedDate)}T${editingCita.horaInicio}`);
                                                // Detectar si la cita es en menos de 24h
                                                const horasHastaCita = (fechaCita.getTime() - Date.now()) / 36e5;
                                                const esUrgente = horasHastaCita < 24;
                                                const { contacto, linkCuestionario } = await crearContacto({
                                                    nombre: contactoForm.nombre,
                                                    apellidos: contactoForm.apellidos,
                                                    telefono: contactoForm.telefono,
                                                    email: contactoForm.email,
                                                    fechaCita,
                                                    doctorAsignado: editingCita.doctor,
                                                    tratamientoAdicional: editingCita.tratamiento !== 'Primera Visita' ? editingCita.tratamiento : undefined,
                                                    esMenor: esMenorForm,
                                                    nombreTutor: esMenorForm ? tutorForm.nombre : undefined,
                                                    apellidosTutor: esMenorForm ? tutorForm.apellidos : undefined,
                                                    telefonoTutor: esMenorForm ? tutorForm.telefono : undefined,
                                                    emailTutor: esMenorForm ? tutorForm.email : undefined,
                                                    relacionTutor: esMenorForm ? tutorForm.relacion : undefined,
                                                    canalEntrada: 'recepcion',
                                                });
                                                logger.info('[Agenda] Contacto creado:', contacto.id, '| Urgente:', esUrgente, '| Link cuest:', linkCuestionario);
                                                // Color rosa para Primera Visita
                                                const citaConContacto = {
                                                    ...editingCita,
                                                    tratamiento: 'Primera Visita',
                                                    nombrePaciente: `👤 ${[contactoForm.nombre, contactoForm.apellidos].filter(Boolean).join(' ')}`,
                                                    pacienteNumPac: `CTX-${contacto.id.substring(0, 8)}`,
                                                };
                                                setCitas(prev => [...prev.filter(c => c.id !== editingCita.id), citaConContacto]);
                                                await createCita(citaConContacto, selectedDate);
                                                setContactoForm({ nombre: '', apellidos: '', telefono: '', email: '' });
                                                setTutorForm({ nombre: '', apellidos: '', telefono: '', email: '', relacion: '' });
                                                setEsMenorForm(false);
                                                setIsPrimeraVisita(false);
                                                setEditingCita(null);
                                            } catch (e) {
                                                setContactoError(e instanceof Error ? e.message : 'Error al crear contacto');
                                            } finally {
                                                setContactoSaving(false);
                                            }
                                            return;
                                        }
                                        // Paciente existente: flujo normal
                                        setCitas(prev => prev.map(c => c.id === editingCita.id ? editingCita : c));
                                        updateCita(editingCita.id, editingCita, selectedDate);
                                        setEditingCita(null);
                                    }} className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50" disabled={contactoSaving}>
                                        {contactoSaving ? '⏳ Guardando...' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Agenda;
