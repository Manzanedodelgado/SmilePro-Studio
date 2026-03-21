import React, { useState, useEffect, useRef } from 'react';
import {
    Search, Send, Phone,
    CheckCheck, Bot, Wifi, WifiOff,
    QrCode, RefreshCw, Tag, CheckCircle2, Paperclip,
    AlertCircle, UserRound, PlusCircle, X, Pause,
    Copy, CornerUpLeft, Smile, Zap,
    Info, MessageSquare, ShieldAlert, Heart, Pill,
    Droplets, FileText, BriefcaseMedical, Receipt,
} from 'lucide-react';
import { searchPacientes } from '../services/pacientes.service';
import {
    type ConversacionUI, type MensajeUI, type InstanceStatus, type PatientContext,
    isEvolutionConfigured, isChatwootConfigured,
    getInstanceStatus, getQRCode,
    getChatwootConversaciones, getChatwootMensajes,
    sendChatwootMessage, sendTextMessage, sendMediaBase64,
    labelConversation, resolveConversation, deleteConversation, markConversationRead,
    connectWhatsAppSocket, disconnectWhatsAppSocket, onWhatsAppMessage, onConversationUpdated,
    onWhatsAppUrgency, getPatientContext,
} from '../services/evolution.service';
import { getIAStatus, pauseIA, resumeIA } from '../services/ia-control.service';
import { BudgetModal } from '../components/BudgetModal';


// ── No mock data. When unconfigured, show empty state ─────────────────────────

type FilterStatus = 'all' | 'open' | 'pending' | 'resolved';
const STATUS_COLOR: Record<string, string> = {
    open: 'bg-blue-500', pending: 'bg-[#FBFFA3]', resolved: 'bg-slate-300', online: 'bg-blue-500', offline: 'bg-slate-300'
};

interface IAControlState { active: boolean; minutesLeft: number | null; }

// ── Emojis por categoría ────────────────────────────────────────────────────
const EMOJI_CATS: Record<string, string[]> = {
    '😀': ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😅', '😆', '😉', '😋', '🙂', '🤗', '🫶', '❤️', '💙', '💚', '💛', '🧡', '🤍', '🖤'],
    '👋': ['👋', '🤝', '👍', '👎', '👏', '🙌', '🤜', '🤛', '✌️', '🤞', '🫂', '💪', '🦷', '🪥', '💊', '🩺', '🏥', '⭐', '✨', '🔥', '💯', '🎉', '🎊', '📅', '⏰'],
    '🌿': ['🌸', '🌺', '🌻', '🌼', '🍀', '🌿', '🌱', '🦋', '🐝', '☀️', '🌙', '⭐', '🌈', '❄️', '🌊', '🍎', '🍊', '🍋', '🍇', '🫐', '🥝', '🍓'],
};

// ── Plantillas rápidas dentales (fallback si backend no disponible) ──────────
const QUICK_TEMPLATES_DEFAULT = [
    { label: 'Cita confirmada', icon: '📅', text: 'Le confirmamos su cita para el {fecha} a las {hora}. Por favor, llegue 5 minutos antes. ¡Le esperamos! 😊' },
    { label: 'Recordatorio cita', icon: '⏰', text: 'Le recordamos que mañana tiene cita en Rubio García Dental a las {hora}. Si necesita cancelar, contáctenos con antelación.' },
    { label: 'Cita cancelada', icon: '❌', text: 'Lamentamos informarle que su cita del {fecha} ha sido cancelada. Contacte con nosotros para reagendar. Disculpe las molestias.' },
    { label: 'Bienvenida', icon: '🌟', text: '¡Bienvenido/a a Rubio García Dental! Nos alegra tenerle como paciente. Si tiene cualquier duda, estamos a su disposición.' },
    { label: 'Presupuesto listo', icon: '💊', text: 'Su presupuesto ya está disponible. Puede pasarse por la clínica o le lo explicamos por aquí si lo prefiere. 😊' },
    { label: 'Resultados OK', icon: '✅', text: 'Sus resultados son perfectos. ¡Siga con la misma rutina de higiene! Le esperamos en su próxima revisión.' },
    { label: 'Instrucciones post', icon: '📋', text: 'Tras su tratamiento de hoy: evite alimentos duros las próximas 24h, no fume y tome el analgésico pautado si siente molestias. Cualquier duda, escríbanos.' },
];

const ICON_MAP: Record<string, string> = {
    'Recordatorios': '⏰', 'Seguimiento': '💙', 'Bienvenida': '🌟', 'Presupuesto': '💊',
    'Post-quirúrgico': '🦷', 'Citas': '📅', 'Cancelación': '❌', 'Resultados': '✅',
};

const API_BASE_WA = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

// ── Helpers de tiempo ───────────────────────────────────────────────────────
const relativeTime = (ts: number): string => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'ahora';
    if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)}min`;
    if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)}h`;
    return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};
const dateSeparator = (ts: number): string => {
    const d = new Date(ts);
    const today = new Date();
    const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

interface WhatsappProps {
    activeSubArea?: string;
    initialPhone?: string;
    initialName?: string;
    /** area, subArea, phoneOrNumPac (cuando va a Pacientes pasa el teléfono para abrir la ficha) */
    onNavigate?: (area: string, subArea?: string, phoneOrNumPac?: string) => void;
}

const Whatsapp: React.FC<WhatsappProps> = ({ initialPhone, initialName, onNavigate }) => {
    const [convs, setConvs] = useState<ConversacionUI[]>([]);
    const [active, setActive] = useState<ConversacionUI | null>(null);
    const [msgs, setMsgs] = useState<MensajeUI[]>([]);
    const [input, setInput] = useState('');
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [instanceStatus, setInstanceStatus] = useState<InstanceStatus | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const isMock = !isEvolutionConfigured() && !isChatwootConfigured();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    // Estado IA por conversación
    const [iaState, setIaState] = useState<IAControlState>({ active: true, minutesLeft: null });
    const iaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Búsqueda de paciente para nueva conversación
    const [showPatientSearch, setShowPatientSearch] = useState(false);
    const [patientQuery, setPatientQuery] = useState('');
    const [patientResults, setPatientResults] = useState<Awaited<ReturnType<typeof searchPacientes>>>([]);
    const [searchingPac, setSearchingPac] = useState(false);

    // Urgency alert
    const [urgencyAlert, setUrgencyAlert] = useState<{ phone: string; text: string; time: string } | null>(null);
    // Patient context for showInfo panel
    const [patientCtx, setPatientCtx] = useState<PatientContext | null>(null);
    const [loadingCtx, setLoadingCtx] = useState(false);
    // Info panel visibility (moved up to allow useEffect dependency)
    const [showInfo, setShowInfo] = useState(false);
    // Budget modal
    const [showBudget, setShowBudget] = useState(false);
    // Plantillas rápidas — se sincronizan con el módulo Plantillas del backend
    const [quickTemplates, setQuickTemplates] = useState(QUICK_TEMPLATES_DEFAULT);

    const handlePatientSearch = async (q: string) => {
        setPatientQuery(q);
        if (q.trim().length < 2) { setPatientResults([]); return; }
        setSearchingPac(true);
        const r = await searchPacientes(q.trim());
        setPatientResults(r);
        setSearchingPac(false);
    };

    const handleStartConvFromPatient = (pac: { nombre?: string; apellidos?: string; telefono?: string }) => {
        const phone = pac.telefono ?? '';
        const name = `${pac.nombre ?? ''} ${pac.apellidos ?? ''}`.trim();
        if (!phone) { alert('Este paciente no tiene teléfono registrado'); return; }
        const existing = convs.find(c =>
            c.phone?.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '').slice(-9))
        );
        if (existing) {
            setActive(existing);
        } else {
            const nueva: ConversacionUI = {
                id: `new-${Date.now()}`,
                name,
                phone,
                lastMessage: 'Nueva conversación',
                lastMessageAt: Date.now(),
                unread: 0,
                status: 'open',
                avatar: name.charAt(0).toUpperCase(),
                type: 'patient',
                tags: [],
            };
            setConvs(prev => [nueva, ...prev]);
            setActive(nueva);
            setMsgs([]);
        }
        setShowPatientSearch(false);
        setPatientQuery('');
        setPatientResults([]);
    };

    // Cargar plantillas WhatsApp desde el módulo Plantillas del backend
    useEffect(() => {
        fetch(`${API_BASE_WA}/api/ai/templates?type=whatsapp`)
            .then(r => r.ok ? r.json() : null)
            .then(json => {
                const rows: any[] = json?.data ?? [];
                if (rows.length === 0) return;
                setQuickTemplates(rows.map((t: any) => ({
                    label: t.name ?? t.id,
                    icon: ICON_MAP[t.category] ?? '💬',
                    text: t.content ?? '',
                })));
            })
            .catch(() => { /* mantener fallback */ });
    }, []);

    // Cargar estado IA al cambiar de conversación
    useEffect(() => {
        if (!active?.chatwootId) { setIaState({ active: true, minutesLeft: null }); return; }
        getIAStatus(active.chatwootId).then(s => setIaState({ active: s.iaActive, minutesLeft: s.minutesLeft }));
        // Polling del estado IA cada 30s (para detectar auto-reanudación)
        const t = setInterval(() => {
            if (!active?.chatwootId) return;
            getIAStatus(active.chatwootId).then(s => setIaState({ active: s.iaActive, minutesLeft: s.minutesLeft }));
        }, 30000);
        return () => clearInterval(t);
    }, [active?.chatwootId]);

    // Cuenta regresiva del timer de pausa (actualizar minutesLeft cada min)
    useEffect(() => {
        if (iaTimerRef.current) clearInterval(iaTimerRef.current);
        if (!iaState.active && iaState.minutesLeft) {
            iaTimerRef.current = setInterval(() => {
                setIaState(prev => {
                    const newMin = prev.minutesLeft ? prev.minutesLeft - 1 : null;
                    if (newMin !== null && newMin <= 0) {
                        clearInterval(iaTimerRef.current!);
                        return { active: true, minutesLeft: null };
                    }
                    return { ...prev, minutesLeft: newMin };
                });
            }, 60000);
        }
        return () => { if (iaTimerRef.current) clearInterval(iaTimerRef.current); };
    }, [iaState.active, iaState.minutesLeft]);

    const handleToggleIA = async () => {
        if (!active?.chatwootId) return;
        if (iaState.active) {
            await pauseIA(active.chatwootId, 'manual');
            setIaState({ active: false, minutesLeft: 5 });
        } else {
            await resumeIA(active.chatwootId);
            setIaState({ active: true, minutesLeft: null });
        }
    };

    const handleGoToPatient = () => {
        if (!active || !onNavigate) return;
        // Navegar a Pacientes pasando el teléfono limpio para que abra la ficha directamente
        const cleanPhone = active.phone?.replace(/\D/g, '').slice(-9) ?? '';
        onNavigate('Pacientes', 'Historia Clínica', cleanPhone || undefined);
    };

    // Load conversations — merge para no destruir conversaciones virtuales
    useEffect(() => {
        const mergeConvs = (prev: ConversacionUI[], incoming: ConversacionUI[]): ConversacionUI[] => {
            const byId = new Map(prev.map(c => [String(c.chatwootId ?? c.id), c]));
            incoming.forEach(d => byId.set(String(d.chatwootId ?? d.id), d));
            // Eliminar virtuales que ya tienen equivalente real por teléfono
            const result: ConversacionUI[] = [];
            const realPhones = new Set(
                incoming.map(d => d.phone?.replace(/\D/g, '').slice(-9)).filter(Boolean)
            );
            for (const [, c] of byId) {
                if (!c.chatwootId) {
                    // Conv virtual: solo mantener si no hay equivalente real por teléfono
                    const phone9 = c.phone?.replace(/\D/g, '').slice(-9);
                    if (phone9 && realPhones.has(phone9)) continue; // ya existe real
                }
                result.push(c);
            }
            return result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        };

        const loadConvs = async () => {
            setLoading(true);
            if (isChatwootConfigured()) {
                const data = await getChatwootConversaciones();
                setConvs(prev => mergeConvs(prev, data));
                // Auto-upgrade active virtual → real si hay coincidencia
                setActive(prev => {
                    if (!prev || prev.chatwootId) return prev;
                    const phone9 = prev.phone?.replace(/\D/g, '').slice(-9);
                    const real = data.find(d =>
                        d.chatwootId && phone9 && d.phone?.replace(/\D/g, '').endsWith(phone9)
                    );
                    return real ?? prev;
                });
                // Si no hay activa aún, seleccionar la primera
                setActive(prev => {
                    if (prev) return prev;
                    return data[0] ?? null;
                });
            }
            setLoading(false);
        };
        loadConvs();
        // Polling cada 15s
        const pollConvs = setInterval(async () => {
            if (isChatwootConfigured()) {
                const data = await getChatwootConversaciones();
                setConvs(prev => mergeConvs(prev, data));
                setActive(prev => {
                    if (!prev || prev.chatwootId) return prev;
                    const phone9 = prev.phone?.replace(/\D/g, '').slice(-9);
                    const real = data.find(d =>
                        d.chatwootId && phone9 && d.phone?.replace(/\D/g, '').endsWith(phone9)
                    );
                    return real ?? prev;
                });
            }
        }, 15000);
        return () => clearInterval(pollConvs);
    }, []);

    // Si se abre desde la ficha de un paciente, activar o crear la conversación
    useEffect(() => {
        if (!initialPhone) return;
        // Buscar si ya existe una conversación con ese teléfono
        const cleaned = initialPhone.replace(/\D/g, '').slice(-9);
        const existing = convs.find(c =>
            c.phone?.replace(/\D/g, '').endsWith(cleaned)
        );
        if (existing) {
            setActive(existing);
        } else {
            // Crear conversación virtual para iniciar chat
            const nueva: ConversacionUI = {
                id: `new-${Date.now()}`,
                name: initialName ?? initialPhone,
                phone: initialPhone,
                lastMessage: 'Nueva conversación',
                lastMessageAt: Date.now(),
                unread: 0,
                status: 'open',
                avatar: (initialName ?? initialPhone).charAt(0).toUpperCase(),
                type: 'patient',
                tags: [],
            };
            setConvs(prev => [nueva, ...prev]);
            setActive(nueva);
            setMsgs([]);
        }
    }, [initialPhone, convs.length]);

    // Cuando cargan conversaciones reales de Chatwoot, upgrade automático de virtual → real
    // Esto ocurre cuando el botón WhatsApp de Pacientes se pulsó antes de que Chatwoot cargase
    useEffect(() => {
        if (!active || active.chatwootId) return; // solo para conversaciones virtuales
        const phone = active.phone?.replace(/\D/g, '').slice(-9);
        if (!phone) return;
        const real = convs.find(c =>
            c.chatwootId && c.phone?.replace(/\D/g, '').endsWith(phone)
        );
        if (real) setActive(real);
    }, [convs]);

    // Load messages + polling cada 5s para respuestas del paciente
    useEffect(() => {
        setMsgs([]);
        if (!active?.chatwootId) return;
        let mounted = true;

        const loadMsgs = async () => {
            if (!isChatwootConfigured() || !active.chatwootId) return;
            const data = await getChatwootMensajes(active.chatwootId);
            if (mounted) {
                setMsgs(prev => {
                    // Conservar mensajes optimistas (envíados que aún no tienen id de Chatwoot)
                    const optimistic = prev.filter(m => m.status === 'sent' && !data.find(d => d.id === m.id));
                    const merged = [...data, ...optimistic];
                    merged.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
                    return merged;
                });
            }
        };

        loadMsgs();
        const poll = setInterval(loadMsgs, 5000);
        return () => { mounted = false; clearInterval(poll); };
    }, [active]);

    // Check Evolution instance status
    useEffect(() => {
        if (!isEvolutionConfigured()) return;
        getInstanceStatus().then(s => setInstanceStatus(s));
        const interval = setInterval(() => getInstanceStatus().then(s => setInstanceStatus(s)), 30000);
        return () => clearInterval(interval);
    }, []);

    // Fetch patient context when info panel opens
    useEffect(() => {
        if (!showInfo || !active?.phone) { setPatientCtx(null); return; }
        setLoadingCtx(true);
        getPatientContext(active.phone)
            .then(ctx => setPatientCtx(ctx))
            .finally(() => setLoadingCtx(false));
    }, [showInfo, active?.phone]);

    // ── Socket.io — real-time WhatsApp events ─────────────────────────────────
    useEffect(() => {
        connectWhatsAppSocket();

        // Incoming / outgoing message from webhook
        const offMsg = onWhatsAppMessage((payload) => {
            setActive(prev => {
                if (!prev) return prev;
                const phone9 = prev.phone?.replace(/\D/g, '').slice(-9);
                const incomingPhone9 = payload.phone?.replace(/\D/g, '').slice(-9);
                if (phone9 !== incomingPhone9) return prev;
                // Append message to current conversation
                const msg: MensajeUI = {
                    id: payload.id,
                    sender: payload.fromMe ? 'me' : 'them',
                    text: payload.text,
                    time: payload.time,
                    status: 'delivered',
                };
                setMsgs(p => {
                    // Avoid duplicates
                    if (p.find(m => m.id === payload.id)) return p;
                    return [...p, msg];
                });
                return prev;
            });
        });

        // Conversation list refresh
        const offConv = onConversationUpdated(() => {
            if (isChatwootConfigured()) {
                getChatwootConversaciones().then(data => {
                    setConvs(prev => {
                        const byId = new Map(prev.map(c => [String(c.chatwootId ?? c.id), c]));
                        data.forEach(d => byId.set(String(d.chatwootId ?? d.id), d));
                        return [...byId.values()].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
                    });
                });
            }
        });

        // Urgency alerts from server
        const offUrgency = onWhatsAppUrgency((payload) => {
            setUrgencyAlert(payload);
            // Auto-dismiss after 30 seconds
            setTimeout(() => setUrgencyAlert(prev => prev?.phone === payload.phone ? null : prev), 30_000);
        });

        return () => {
            offMsg();
            offConv();
            offUrgency();
            disconnectWhatsAppSocket();
        };
    }, []);

    // Seleccionar conversación: resetea badge unread al instante
    const handleSelectConv = (conv: ConversacionUI) => {
        setActive(conv);
        if (conv.unread > 0) {
            setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
            if (conv.chatwootId) markConversationRead(conv.chatwootId);
        }
    };

    // Auto-scroll messages
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

    const handleSend = async () => {
        if (!input.trim() || !active) return;
        const text = input.trim();
        const replyPreview = replyTo?.text ?? undefined;
        const optimistic: MensajeUI = {
            id: Date.now().toString(),
            sender: 'me',
            text,
            time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            status: 'sent',
            replyTo: replyPreview,
        };
        setMsgs(p => [...p, optimistic]);
        setInput('');
        const replyChatwootId = replyTo?.id ? parseInt(replyTo.id) : undefined;
        setReplyTo(null);
        setSending(true);

        try {
            if (isChatwootConfigured() && active.chatwootId) {
                const ok = await sendChatwootMessage(active.chatwootId, text, replyChatwootId);
                if (!ok) throw new Error();
            } else if (isEvolutionConfigured()) {
                const ok = await sendTextMessage(active.phone, text);
                if (!ok) throw new Error();
            }
            setMsgs(p => p.map(m => m.id === optimistic.id ? { ...m, status: 'delivered' } : m));
        } catch {
            setMsgs(p => p.map(m => m.id === optimistic.id ? { ...m, status: 'failed' } : m));
        } finally {
            setSending(false);
        }
    };

    const handleGetQR = async () => {
        const code = await getQRCode();
        setQr(code);
    };

    const filteredConvs = convs
        .filter(c => filterStatus === 'all' || c.status === filterStatus)
        .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

    const connectionBadge = () => {
        if (isMock) return { text: 'Modo demo', color: 'bg-[#FEFDE8] text-[#051650] border-[#FBFFA3]', icon: AlertCircle };
        if (isEvolutionConfigured() && instanceStatus?.state === 'open') return { text: 'WhatsApp conectado', color: 'bg-blue-50 text-[#051650] border-blue-200', icon: Wifi };
        if (isEvolutionConfigured() && instanceStatus?.state === 'connecting') return { text: 'Conectando...', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: RefreshCw };
        if (isEvolutionConfigured()) return { text: 'WhatsApp desconectado', color: 'bg-[#FFF0F3] text-[#C02040] border-[#FFC0CB]', icon: WifiOff };
        if (isChatwootConfigured()) return { text: 'Chatwoot conectado', color: 'bg-blue-50 text-[#051650] border-blue-200', icon: Wifi };
        return { text: 'Sin configurar', color: 'bg-slate-50 text-slate-500 border-slate-200', icon: WifiOff };
    };
    const badge = connectionBadge();
    const BadgeIcon = badge.icon;

    // ── Extra UI state ────────────────────────────────────────────────────
    const [showEmoji, setShowEmoji] = useState(false);
    const [emojiCat, setEmojiCat] = useState('😀');
    const [showTemplates, setShowTemplates] = useState(false);
    const [replyTo, setReplyTo] = useState<MensajeUI | null>(null);
    const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Simulate typing indicator when messages arrive
    useEffect(() => {
        if (!active?.chatwootId) return;
        setIsTyping(true);
        const t = setTimeout(() => setIsTyping(false), 2000);
        return () => clearTimeout(t);
    }, [msgs.length]);

    const insertEmoji = (emoji: string) => {
        setInput(p => p + emoji);
        setShowEmoji(false);
        textareaRef.current?.focus();
    };
    const insertTemplate = (text: string) => {
        setInput(text);
        setShowTemplates(false);
        textareaRef.current?.focus();
    };
    const copyMsg = (text: string) => navigator.clipboard.writeText(text);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };
    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    };

    // Group messages by date for separators
    const msgGroups: { date: string; messages: MensajeUI[] }[] = [];
    msgs.forEach(msg => {
        const ts = parseInt(msg.id) || Date.now();
        const label = dateSeparator(ts);
        const last = msgGroups[msgGroups.length - 1];
        if (!last || last.date !== label) msgGroups.push({ date: label, messages: [msg] });
        else last.messages.push(msg);
    });

    // KPIs para el header
    const kpiOpen = convs.filter(c => c.status === 'open').length;
    const kpiPending = convs.filter(c => c.status === 'pending').length;
    const kpiResolved = convs.filter(c => c.status === 'resolved').length;

    return (
        <>
        <div className="flex flex-col h-full gap-3 min-h-0 overflow-hidden">

            {/* ── Channel Header ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
                {/* Top row: identity + connection + actions */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        {/* WhatsApp icon */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
                            <MessageSquare className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                        </div>
                        <div>
                            <p className="text-[14px] font-black text-[#051650] leading-tight">WhatsApp Business</p>
                            <p className="text-[11px] text-slate-400 font-medium">Rubio García Dental</p>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wider ml-2 ${badge.color}`}>
                            <BadgeIcon className="w-3 h-3" />
                            {badge.text}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEvolutionConfigured() && instanceStatus?.state !== 'open' && (
                            <button onClick={handleGetQR} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white rounded-xl text-[12px] font-bold uppercase hover:bg-[#1ebe5a] transition-all shadow-sm">
                                <QrCode className="w-3.5 h-3.5" />Conectar
                            </button>
                        )}
                        <button onClick={async () => { const d = await getChatwootConversaciones(); if (d.length) setConvs(d); }}
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all" title="Actualizar">
                            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                    </div>
                </div>
                {/* KPI strip */}
                <div className="grid grid-cols-4 divide-x divide-slate-100">
                    {[
                        { label: 'Total', value: convs.length, color: 'text-[#051650]', bg: '', active: filterStatus === 'all', key: 'all' },
                        { label: 'Abiertos', value: kpiOpen, color: 'text-blue-600', bg: 'group-hover:bg-blue-50', active: filterStatus === 'open', key: 'open' },
                        { label: 'Pendientes', value: kpiPending, color: 'text-amber-600', bg: 'group-hover:bg-amber-50', active: filterStatus === 'pending', key: 'pending' },
                        { label: 'Resueltos', value: kpiResolved, color: 'text-slate-400', bg: 'group-hover:bg-slate-50', active: filterStatus === 'resolved', key: 'resolved' },
                    ].map(k => (
                        <button key={k.key} onClick={() => setFilterStatus(k.key as FilterStatus)}
                            className={`group flex flex-col items-center py-2.5 transition-all ${k.active ? 'bg-slate-50' : ''} ${k.bg}`}>
                            <span className={`text-[20px] font-black leading-none ${k.color}`}>{k.value}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{k.label}</span>
                            {k.active && <div className="w-6 h-0.5 bg-[#0056b3] rounded-full mt-1.5" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Urgency Alert Banner ─────────────────────────────────────────── */}
            {urgencyAlert && (
                <div className="flex items-start gap-3 px-4 py-3 bg-[#FFF0F3] border border-[#FFC0CB] rounded-xl shadow-lg animate-in slide-in-from-top-2 duration-300">
                    <div className="w-8 h-8 rounded-xl bg-[#E03555] flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-[13px] font-black text-[#C02040] uppercase tracking-wider">¡Urgencia detectada!</p>
                            <span className="text-[11px] text-[#C02040]/70 font-bold">{urgencyAlert.time}</span>
                        </div>
                        <p className="text-[12px] text-[#C02040] mt-0.5">
                            <span className="font-bold">{urgencyAlert.phone}</span> — {urgencyAlert.text.slice(0, 120)}{urgencyAlert.text.length > 120 ? '…' : ''}
                        </p>
                    </div>
                    <button onClick={() => setUrgencyAlert(null)} className="p-1 hover:bg-[#FFD6DC] rounded-lg transition-all shrink-0">
                        <X className="w-3.5 h-3.5 text-[#C02040]" />
                    </button>
                </div>
            )}

            {/* QR Modal */}
            {qr && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={() => setQr(null)}>
                    <div className="bg-white rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <p className="text-base font-bold text-[#051650] uppercase tracking-widest mb-4 text-center">Escanea con WhatsApp</p>
                        <img src={`data:image/png;base64,${qr}`} alt="QR Code" className="w-64 h-64 rounded-xl" />
                        <p className="text-[12px] text-slate-400 text-center mt-3">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                    </div>
                </div>
            )}

            {/* Main chat UI */}
            <div className="flex-1 flex bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-0">

                {/* Left: Conversation List */}
                <div className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white">
                    <div className="p-4 border-b border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[15px] font-bold text-[#051650] uppercase tracking-tighter">Mensajes</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{convs.length}</span>
                                <button
                                    onClick={() => setShowPatientSearch(v => !v)}
                                    title="Nueva conversación con paciente"
                                    className={`p-1.5 rounded-lg transition-all ${showPatientSearch ? 'bg-[#051650] text-white' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-[#0056b3]'}`}>
                                    <PlusCircle className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {/* Buscador de pacientes para nueva conversación */}
                        {showPatientSearch && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                    <input
                                        autoFocus
                                        value={patientQuery}
                                        onChange={e => handlePatientSearch(e.target.value)}
                                        placeholder="Nombre o teléfono del paciente..."
                                        className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20"
                                    />
                                </div>
                                {searchingPac && <p className="text-[12px] text-slate-400 text-center py-2">Buscando...</p>}
                                {!searchingPac && patientResults.length === 0 && patientQuery.length >= 2 && (
                                    <p className="text-[12px] text-slate-400 text-center py-2">Sin resultados</p>
                                )}
                                {patientResults.slice(0, 5).map(p => (
                                    <button key={p.numPac}
                                        onClick={() => handleStartConvFromPatient(p)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white transition-all text-left">
                                        <div className="w-6 h-6 rounded-lg bg-[#051650] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                                            {(p.nombre ?? '?').charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-bold text-slate-800 truncate">{p.nombre} {p.apellidos}</p>
                                            <p className="text-[13px] text-slate-400">{p.telefono ?? 'Sin teléfono'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20" />
                        </div>
                        <div className="flex gap-1">
                            {(['all', 'open', 'pending', 'resolved'] as FilterStatus[]).map(s => (
                                <button key={s} onClick={() => setFilterStatus(s)} className={`flex-1 py-1 rounded-lg text-[13px] font-bold uppercase transition-all ${filterStatus === s ? 'bg-[#0056b3] text-white' : 'bg-slate-50 text-slate-400 border border-slate-200 hover:border-[#0056b3]/30'}`}>
                                    {s === 'all' ? 'Todos' : s === 'open' ? 'Abiertos' : s === 'pending' ? 'Pendientes' : 'Resueltos'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-[13px] text-slate-400">Cargando conversaciones...</div>
                        ) : filteredConvs.length === 0 ? (
                            <div className="p-4 text-center text-[13px] text-slate-400">No hay conversaciones</div>
                        ) : (
                            filteredConvs.map(conv => {
                                const isAct = active?.id === conv.id;
                                const statusDot: Record<string,string> = { open:'bg-[#25D366]', pending:'bg-amber-400', resolved:'bg-slate-300' };
                                return (
                                    <div key={conv.id} onClick={() => handleSelectConv(conv)}
                                        className={`relative px-3 py-2.5 flex items-start gap-2.5 cursor-pointer border-b border-slate-50/80 transition-all ${isAct ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}>
                                        {isAct && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#1d4ed8] rounded-r" />}
                                        <div className="relative shrink-0 mt-0.5">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shadow-sm ${isAct ? 'bg-gradient-to-br from-[#1d4ed8] to-[#0ea5e9] text-white' : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600'}`}>
                                                {conv.avatar}
                                            </div>
                                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot[conv.status] ?? 'bg-slate-300'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                                <p className={`text-[13px] font-bold truncate ${isAct ? 'text-[#1d4ed8]' : 'text-[#051650]'}`}>{conv.name}</p>
                                                <span className="text-[10px] text-slate-400 font-medium shrink-0">{relativeTime(conv.lastMessageAt)}</span>
                                            </div>
                                            <p className="text-[12px] text-slate-400 truncate leading-tight">{conv.lastMessage}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="flex items-center gap-1">
                                                    {conv.tags.slice(0, 2).map(t => <span key={t} className="text-[10px] font-bold text-[#0056b3] bg-[#0056b3]/10 px-1.5 py-0.5 rounded-full">{t}</span>)}
                                                </div>
                                                {conv.unread > 0 && (
                                                    <span className="min-w-[18px] h-[18px] bg-[#25D366] text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shrink-0">{conv.unread}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right: Chat window */}
                <div className="flex-1 flex min-h-0" style={{ minWidth: 0 }}>
                    <div className="flex-1 flex flex-col min-h-0">
                        {!active ? (
                            <div className="flex-1 flex items-center justify-center bg-slate-50/50">
                                <div className="text-center space-y-5 max-w-sm px-6">
                                    {/* Icon */}
                                    <div className="relative mx-auto w-fit">
                                        <div className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center shadow-2xl" style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
                                            <MessageSquare className="w-9 h-9 text-white" />
                                        </div>
                                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#051650] flex items-center justify-center">
                                            <Bot className="w-3 h-3 text-[#FBFFA3]" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-[18px] font-black text-[#051650] tracking-tight">Canal WhatsApp Business</h3>
                                        <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">Selecciona una conversación para chatear o usa el <strong className="text-[#051650]">+</strong> para iniciar una con un paciente.</p>
                                    </div>
                                    {/* Feature pills */}
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {['IA dental activa','Recordatorios auto','Presupuestos','Ficha clínica'].map(f => (
                                            <span key={f} className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 py-1 px-3 rounded-full shadow-sm">{f}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* ── Chat Header ─────────────────────────────────────── */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white/95 backdrop-blur-md shrink-0 z-10 shadow-sm relative">
                                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setShowInfo(v => !v)}>
                                        <div className="relative">
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg bg-gradient-to-br from-[#1d4ed8] to-[#0ea5e9] text-white shadow-md group-hover:shadow-lg transition-all">{active.avatar}</div>
                                            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-white ${STATUS_COLOR[active.status] ?? 'bg-slate-300'}`} />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-bold text-[#051650] leading-tight">{active.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {isTyping
                                                    ? <span className="text-[13px] text-blue-500 font-bold animate-pulse">escribiendo...</span>
                                                    : <><span className="text-[13px] text-slate-400 font-bold">{active.phone}</span>
                                                        {active.assignedAgent && <span className="text-[13px] text-slate-500">· {active.assignedAgent}</span>}</>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={handleToggleIA} title={iaState.active ? 'Pausar IA 5 min' : 'Reactivar IA'}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[13px] font-bold uppercase border transition-all ${iaState.active ? 'bg-blue-50 border-blue-200 text-[#051650] hover:bg-[#FFF0F3] hover:border-[#FFC0CB] hover:text-[#E03555]'
                                                : 'bg-[#FEFDE8] border-[#FBFFA3] text-[#051650] hover:bg-blue-50 hover:border-blue-200 hover:text-[#051650]'}`}>
                                            {iaState.active
                                                ? <><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /><Bot className="w-3 h-3" />IA</>
                                                : <><Pause className="w-3 h-3" />{iaState.minutesLeft ? `${iaState.minutesLeft}min` : 'Pausada'}</>}
                                        </button>
                                        <button onClick={handleGoToPatient} className="p-2 hover:bg-slate-50 rounded-xl transition-all" title="Ver ficha"><UserRound className="w-4 h-4 text-slate-400" /></button>
                                        <button onClick={() => active?.phone && window.open(`tel:${active.phone.replace(/\s/g,'')}`)} className="p-2 hover:bg-slate-50 rounded-xl transition-all" title="Llamar"><Phone className="w-4 h-4 text-slate-400" /></button>
                                        <button onClick={async () => { if (active.chatwootId) { await labelConversation(active.chatwootId, ['Revisado']); } }} className="p-2 hover:bg-slate-50 rounded-xl transition-all" title="Etiquetar"><Tag className="w-4 h-4 text-slate-400" /></button>
                                        <button onClick={async () => { if (active.chatwootId) { await resolveConversation(active.chatwootId); setConvs(p => p.map(c => c.id === active.id ? { ...c, status: 'resolved' } : c)); } }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-[#051650] rounded-xl text-[13px] font-bold uppercase hover:bg-blue-100 transition-all">
                                            <CheckCircle2 className="w-3.5 h-3.5" />Resolver
                                        </button>
                                        <button onClick={async () => {
                                            if (!active.chatwootId) return;
                                            if (!confirm(`¿Eliminar la conversación con ${active.name}? Esta acción no se puede deshacer.`)) return;
                                            const ok = await deleteConversation(active.chatwootId);
                                            if (ok) {
                                                setConvs(p => p.filter(c => c.id !== active.id));
                                                setActive(null);
                                                setMsgs([]);
                                            }
                                        }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#FFF0F3] border border-[#FFC0CB] text-[#E03555] rounded-xl text-[13px] font-bold uppercase hover:bg-[#FFE0E6] transition-all"
                                            title="Eliminar conversación">
                                            <X className="w-3.5 h-3.5" />Eliminar
                                        </button>
                                        <button onClick={() => setShowInfo(v => !v)} className={`p-2 rounded-xl transition-all ${showInfo ? 'bg-[#051650] text-white' : 'hover:bg-slate-50 text-slate-400'}`} title="Info contacto">
                                            <Info className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* ── Messages ─────────────────────────────────────── */}
                                <div className="flex-1 p-6 overflow-y-auto space-y-2 min-h-0 relative" style={{ backgroundColor: '#f0f4f8', backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                                    {msgGroups.map(group => (
                                        <div key={group.date}>
                                            {/* Date separator */}
                                            <div className="flex items-center justify-center my-6">
                                                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 bg-white/80 backdrop-blur-sm border border-slate-200/60 px-3 py-1.5 rounded-lg shadow-sm">{group.date}</span>
                                            </div>
                                            {group.messages.map(msg => {
                                                const isMe = msg.sender === 'me';
                                                const isBot = msg.sender === 'bot';
                                                const isThem = msg.sender === 'them';
                                                const isHovered = hoveredMsg === msg.id;
                                                return (
                                                    <div key={msg.id} className={`flex mb-2 group ${!isThem ? 'justify-end' : 'justify-start'}`}
                                                        onMouseEnter={() => setHoveredMsg(msg.id)}
                                                        onMouseLeave={() => setHoveredMsg(null)}>

                                                        {/* Message actions - LEFT for outgoing */}
                                                        {!isThem && isHovered && (
                                                            <div className="flex items-center gap-1 mr-2 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => setReplyTo(msg)} className="p-1.5 bg-white/80 backdrop-blur border border-slate-200 rounded-full hover:bg-white hover:shadow-sm text-slate-400 hover:text-blue-500 transition-all" title="Responder"><CornerUpLeft className="w-3.5 h-3.5" /></button>
                                                                <button onClick={() => copyMsg(msg.text)} className="p-1.5 bg-white/80 backdrop-blur border border-slate-200 rounded-full hover:bg-white hover:shadow-sm text-slate-400 hover:text-blue-500 transition-all" title="Copiar"><Copy className="w-3.5 h-3.5" /></button>
                                                            </div>
                                                        )}

                                                        {/* Bubble */}
                                                        <div className={`max-w-[72%] rounded-2xl shadow-sm relative ${
                                                            isBot ? 'bg-gradient-to-br from-[#051650] to-[#0a2360] rounded-tr-sm text-white border border-[#051650]' :
                                                            isMe ? 'bg-gradient-to-br from-[#1d4ed8] to-[#0ea5e9] rounded-tr-sm text-white border border-[#1d4ed8]/20' :
                                                                'bg-white border border-slate-200 rounded-tl-sm text-slate-800'
                                                            }`}>
                                                            {/* Replied-to preview */}
                                                            {msg.replyTo && (
                                                                <div className={`mx-1.5 mt-1.5 mb-1 px-3 py-1.5 rounded-xl border-l-[3px] ${isMe || isBot ? 'border-white/50 bg-black/10' : 'border-[#1d4ed8] bg-blue-50/50'}`}>
                                                                    <p className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${isMe || isBot ? 'text-white/90' : 'text-[#1d4ed8]'}`}>↩ Respuesta a {String(msg.replyTo).split(' ')[0]}</p>
                                                                    <p className={`text-[12px] truncate opacity-90 ${isMe || isBot ? 'text-white' : 'text-slate-600'}`}>{String(msg.replyTo)}</p>
                                                                </div>
                                                            )}
                                                            <div className="px-4 py-2 relative">
                                                                {isBot && (
                                                                    <div className="flex items-center gap-1.5 mb-1.5 border-b border-white/10 pb-1.5">
                                                                        <Bot className="w-3.5 h-3.5 text-blue-300" />
                                                                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#FBFFA3]">IA Dental Automática</span>
                                                                    </div>
                                                                )}
                                                                <span className="text-[14px] leading-relaxed whitespace-pre-wrap break-words inline-block align-top mr-12">{msg.text}</span>
                                                                
                                                                <div className="float-right -mb-1 mt-2 ml-2 flex items-center gap-1 opacity-80" style={{ shapeOutside: 'inset(calc(100% - 20px) 0 0 calc(100% - 50px))' }}>
                                                                    <span className="text-[10px] font-medium tracking-tight mt-0.5">{msg.time}</span>
                                                                    {!isThem && <CheckCheck className={`w-3.5 h-3.5 ${msg.status === 'read' ? 'text-cyan-300' : msg.status === 'failed' ? 'text-red-400' : 'text-white'}`} />}
                                                                    {msg.status === 'failed' && <span className="text-[10px] font-bold text-red-400">Error</span>}
                                                                </div>
                                                                <div className="clear-both"></div>
                                                            </div>
                                                        </div>

                                                        {/* Message actions - RIGHT for incoming */}
                                                        {isThem && isHovered && (
                                                            <div className="flex items-center gap-1 ml-2 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => setReplyTo(msg)} className="p-1.5 bg-white/80 backdrop-blur border border-slate-200 rounded-full hover:bg-white hover:shadow-sm text-slate-400 hover:text-blue-500 transition-all" title="Responder"><CornerUpLeft className="w-3.5 h-3.5" /></button>
                                                                <button onClick={() => copyMsg(msg.text)} className="p-1.5 bg-white/80 backdrop-blur border border-slate-200 rounded-full hover:bg-white hover:shadow-sm text-slate-400 hover:text-blue-500 transition-all" title="Copiar"><Copy className="w-3.5 h-3.5" /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                    {/* Typing indicator */}
                                    {isTyping && msgs.length > 0 && msgs[msgs.length - 1]?.sender === 'them' && (
                                        <div className="flex justify-start">
                                            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* ── Input Area ───────────────────────────────────── */}
                                <div className="border-t border-slate-200 bg-white/95 backdrop-blur-md shrink-0 relative z-10 p-2">
                                    {/* Reply preview */}
                                    {replyTo && (
                                        <div className="flex items-center gap-2 px-4 pt-2 pb-1 border-l-4 border-[#0056b3] bg-blue-50/50">
                                            <CornerUpLeft className="w-3 h-3 text-[#0056b3] flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-bold text-[#0056b3] uppercase tracking-wider">Respondiendo a {replyTo.sender === 'me' ? 'ti mismo' : active.name.split(' ')[0]}</p>
                                                <p className="text-[12px] text-slate-500 truncate">{replyTo.text}</p>
                                            </div>
                                            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-slate-200 rounded-lg transition-all"><X className="w-3 h-3 text-slate-400" /></button>
                                        </div>
                                    )}

                                    {/* Emoji picker */}
                                    {showEmoji && (
                                        <div className="absolute bottom-24 left-4 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 w-72">
                                            <div className="flex gap-1 mb-2 border-b border-slate-100 pb-2">
                                                {Object.keys(EMOJI_CATS).map(cat => (
                                                    <button key={cat} onClick={() => setEmojiCat(cat)}
                                                        className={`px-2 py-1 rounded-lg text-sm transition-all ${emojiCat === cat ? 'bg-[#0056b3]/10' : 'hover:bg-slate-50'}`}>{cat}</button>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-8 gap-0.5">
                                                {EMOJI_CATS[emojiCat].map(e => (
                                                    <button key={e} onClick={() => insertEmoji(e)}
                                                        className="w-8 h-8 text-lg hover:bg-slate-100 rounded-lg transition-all flex items-center justify-center">{e}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Templates picker */}
                                    {showTemplates && (
                                        <div className="absolute bottom-24 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-80">
                                            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                                <p className="text-[12px] font-bold text-[#051650] uppercase tracking-wider">Plantillas rápidas</p>
                                                <button onClick={() => setShowTemplates(false)}><X className="w-3.5 h-3.5 text-slate-400" /></button>
                                            </div>
                                            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                                                {quickTemplates.map(t => (
                                                    <button key={t.label} onClick={() => insertTemplate(t.text)}
                                                        className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-all text-left">
                                                        <span className="text-lg flex-shrink-0 mt-0.5">{t.icon}</span>
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-bold text-[#051650]">{t.label}</p>
                                                            <p className="text-[13px] text-slate-400 truncate">{t.text.substring(0, 55)}...</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Input row */}
                                    <div className="flex items-end gap-2 p-2">
                                        <label className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0 cursor-pointer" title="Adjunto">
                                            <Paperclip className="w-5 h-5" />
                                            <input type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={async e => {
                                                const file = e.target.files?.[0];
                                                e.target.value = '';
                                                if (!file || !active) return;
                                                if (!isEvolutionConfigured()) {
                                                    alert('Los adjuntos requieren Evolution API configurada.');
                                                    return;
                                                }
                                                setSending(true);
                                                const reader = new FileReader();
                                                reader.onload = async () => {
                                                    const dataUrl = reader.result as string;
                                                    // Strip the "data:<mime>;base64," prefix
                                                    const base64 = dataUrl.split(',')[1] ?? '';
                                                    const optimistic: MensajeUI = {
                                                        id: Date.now().toString(),
                                                        sender: 'me',
                                                        text: `📎 ${file.name}`,
                                                        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                                                        status: 'sent',
                                                        attachments: [{ type: file.type.startsWith('image/') ? 'image' : 'document', url: dataUrl, name: file.name }],
                                                    };
                                                    setMsgs(p => [...p, optimistic]);
                                                    const ok = await sendMediaBase64(active.phone, base64, file.type, file.name);
                                                    setMsgs(p => p.map(m => m.id === optimistic.id ? { ...m, status: ok ? 'delivered' : 'failed' } : m));
                                                    setSending(false);
                                                };
                                                reader.readAsDataURL(file);
                                            }} />
                                        </label>
                                        <button onClick={() => { setShowEmoji(v => !v); setShowTemplates(false); }}
                                            className={`p-2 rounded-full transition-colors flex-shrink-0 ${showEmoji ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`} title="Emojis">
                                            <Smile className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => { setShowTemplates(v => !v); setShowEmoji(false); }}
                                            className={`p-2 rounded-full transition-colors flex-shrink-0 ${showTemplates ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`} title="Plantillas rápidas">
                                            <Zap className="w-5 h-5" />
                                        </button>
                                        <textarea
                                            ref={textareaRef}
                                            value={input}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            placeholder={`Escribe a ${active.name.split(' ')[0]}... (Shift+Enter para nueva línea)`}
                                            rows={1}
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-[20px] px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none leading-relaxed transition-all shadow-sm"
                                            style={{ maxHeight: 120 }}
                                        />
                                        <button onClick={handleSend} disabled={!input.trim() || sending}
                                            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 transition-all active:scale-95 mb-0.5"
                                            style={{ background: input.trim() ? 'linear-gradient(135deg,#1d4ed8,#0ea5e9)' : '#cbd5e1' }}>
                                            {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 pr-0.5" />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {/* ── Info panel ──────────────────────────────────────────── */}
                    {showInfo && active && (
                        <div className="w-72 border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto">
                            {/* Header */}
                            <div className="p-4 text-center border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#0056b3] flex items-center justify-center text-white font-bold text-2xl mx-auto mb-2.5 shadow-lg">{active.avatar}</div>
                                <p className="text-[15px] font-black text-[#051650] leading-tight">{patientCtx ? `${patientCtx.firstName} ${patientCtx.lastName}` : active.name}</p>
                                {patientCtx?.age && <p className="text-[12px] text-slate-400 mt-0.5">{patientCtx.age} años</p>}
                                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{active.phone}</p>
                                <div className="flex items-center justify-center gap-2 mt-2.5">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${active.status === 'open' ? 'bg-teal-50 text-teal-700 border border-teal-200' : active.status === 'pending' ? 'bg-[#FEFCC4] text-[#713f12] border border-[#FBFFA3]' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${active.status === 'open' ? 'bg-[#25D366]' : active.status === 'pending' ? 'bg-amber-400' : 'bg-slate-300'}`} />{active.status === 'open' ? 'Abierto' : active.status === 'pending' ? 'Pendiente' : 'Resuelto'}
                                    </div>
                                    {active.assignedAgent && (
                                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full truncate max-w-[100px]">{active.assignedAgent}</span>
                                    )}
                                </div>
                            </div>

                            {/* Clinical data */}
                            <div className="p-4 space-y-3">
                                {loadingCtx && (
                                    <p className="text-[12px] text-slate-400 text-center animate-pulse">Cargando ficha...</p>
                                )}
                                {!loadingCtx && patientCtx && (
                                    <>
                                        {patientCtx.allergies && (
                                            <div className="bg-[#FFF0F3] border border-[#FFC0CB] rounded-xl p-3">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Heart className="w-3 h-3 text-[#E03555]" />
                                                    <p className="text-[11px] font-black text-[#C02040] uppercase tracking-widest">Alergias</p>
                                                </div>
                                                <p className="text-[12px] text-[#C02040] leading-snug">{patientCtx.allergies}</p>
                                            </div>
                                        )}
                                        {patientCtx.medications && (
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Pill className="w-3 h-3 text-blue-500" />
                                                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Medicación</p>
                                                </div>
                                                <p className="text-[12px] text-blue-700 leading-snug">{patientCtx.medications}</p>
                                            </div>
                                        )}
                                        {patientCtx.bloodType && (
                                            <div className="flex items-center gap-2">
                                                <Droplets className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                                <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Grupo sanguíneo</span>
                                                <span className="ml-auto text-[13px] font-black text-[#051650]">{patientCtx.bloodType}</span>
                                            </div>
                                        )}
                                        {patientCtx.medicalNotes && (
                                            <div className="bg-white border border-slate-200 rounded-xl p-3">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <FileText className="w-3 h-3 text-slate-400" />
                                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Notas médicas</p>
                                                </div>
                                                <p className="text-[12px] text-slate-600 leading-snug">{patientCtx.medicalNotes}</p>
                                            </div>
                                        )}
                                        {patientCtx.email && (
                                            <div className="flex items-center gap-2 text-[12px] text-slate-500">
                                                <span className="font-bold text-slate-400 uppercase tracking-widest text-[11px]">Email</span>
                                                <span className="ml-auto truncate max-w-[140px]">{patientCtx.email}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                {!loadingCtx && !patientCtx && (
                                    <div className="bg-slate-100 rounded-xl p-3 text-center">
                                        <BriefcaseMedical className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                                        <p className="text-[12px] text-slate-400">No encontrado en base de datos de pacientes</p>
                                    </div>
                                )}

                                {/* Conversation info */}
                                {active.tags.length > 0 && (
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Etiquetas</p>
                                        <div className="flex flex-wrap gap-1">{active.tags.map(t => <span key={t} className="text-[12px] font-bold text-[#0056b3] bg-[#0056b3]/10 px-2 py-0.5 rounded-full border border-[#0056b3]/20">{t}</span>)}</div>
                                    </div>
                                )}
                                {active.assignedAgent && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Agente</span>
                                        <span className="ml-auto text-[12px] font-bold text-slate-700">{active.assignedAgent}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Último msg</span>
                                    <span className="ml-auto text-[12px] text-slate-500">{relativeTime(active.lastMessageAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Mensajes</span>
                                    <span className="ml-auto text-[13px] font-black text-[#051650]">{msgs.length}</span>
                                </div>
                            </div>

                            <div className="p-4 mt-auto border-t border-slate-100 space-y-2 bg-slate-50/60">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Acciones rápidas</p>
                                <button onClick={handleGoToPatient}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-[#051650] hover:bg-[#051650] hover:text-white hover:border-[#051650] transition-all shadow-sm">
                                    <UserRound className="w-4 h-4 shrink-0" /> Ver ficha paciente
                                </button>
                                <button onClick={() => setShowBudget(true)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-bold text-[#051650] transition-all shadow-sm border"
                                    style={{ background: 'linear-gradient(135deg,#FEFDE8,#FFFBCC)', borderColor: '#FBFFA3' }}>
                                    <Receipt className="w-4 h-4 shrink-0 text-amber-500" /> Generar presupuesto
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={async () => { if (active.chatwootId) { await resolveConversation(active.chatwootId); setConvs(p => p.map(c => c.id === active.id ? { ...c, status: 'resolved' } : c)); } }}
                                        className="flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-all">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Resolver
                                    </button>
                                    <button onClick={async () => { if (active.chatwootId) { await labelConversation(active.chatwootId, ['Revisado']); } }}
                                        className="flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-all">
                                        <Tag className="w-3.5 h-3.5 shrink-0" /> Etiquetar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* ── Budget Modal ─────────────────────────────────────────────────── */}
        {showBudget && active && (
            <BudgetModal
                phone={active.phone}
                patientName={patientCtx ? `${patientCtx.firstName} ${patientCtx.lastName}` : active.name}
                onClose={() => setShowBudget(false)}
            />
        )}
        </>
    );
};

export default Whatsapp;
