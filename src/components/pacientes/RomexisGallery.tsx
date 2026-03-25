/**
 * RomexisGallery — Miniaturas RX del paciente desde el agente Romexis local.
 *
 * Llama a GET http://127.0.0.1:7893/images/:patientId
 * El agente consulta SQL Server y devuelve las imágenes como base64 JPEG 200x200.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ScanLine, RefreshCw, AlertCircle, X, ZoomIn } from 'lucide-react';

const AGENT_URL = 'http://127.0.0.1:7893';

interface RxImage {
    id:          string | number;
    fileName:    string;
    date:        string | null;
    type:        string | null;
    description: string | null;
    thumb:       string; // data:image/jpeg;base64,...
}

interface Props {
    /** ID del paciente (numPac o dni) */
    patientId?: string;
}

const RomexisGallery: React.FC<Props> = ({ patientId }) => {
    const [images,  setImages]  = useState<RxImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<RxImage | null>(null);

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${AGENT_URL}/images/${encodeURIComponent(patientId)}`,
                { signal: AbortSignal.timeout(12000) },
            );
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d?.error ?? `HTTP ${res.status}`);
            }
            const data = await res.json();
            setImages(data.data ?? []);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => { load(); }, [load]);

    // ── Sin patientId ──
    if (!patientId) return null;

    return (
        <div className="mt-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-[#002147]" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                        Imágenes Romexis
                    </span>
                    {images.length > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">
                            {images.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    title="Recargar imágenes"
                    className="p-1 rounded-lg text-slate-400 hover:text-[#002147] hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Estados */}
            {loading && (
                <div className="flex items-center gap-2 text-[11px] text-slate-400 py-4 justify-center">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Consultando Romexis…
                </div>
            )}

            {!loading && error && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-[10px] text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <div>
                        <strong className="font-black">Agente Romexis no disponible</strong>
                        <p className="mt-0.5 opacity-80">{error}</p>
                        <p className="mt-1 opacity-70">Asegúrate de que <code className="font-mono bg-amber-100 px-1 rounded">romexis-agent</code> está corriendo en el PC con Romexis (puerto 7893).</p>
                    </div>
                </div>
            )}

            {!loading && !error && images.length === 0 && (
                <div className="text-center py-6 text-[11px] text-slate-400">
                    Sin imágenes en Romexis para este paciente.
                </div>
            )}

            {/* Grid miniaturas */}
            {!loading && images.length > 0 && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                    {images.map(img => (
                        <button
                            key={img.id}
                            onClick={() => setLightbox(img)}
                            title={img.description ?? img.fileName}
                            className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-[#002147] transition-all duration-150 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#002147]"
                        >
                            <img
                                src={img.thumb}
                                alt={img.description ?? img.fileName}
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay hover */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-150 flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {/* Fecha */}
                            {img.date && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 pb-0.5 pt-2">
                                    <p className="text-[8px] text-white/90 font-mono truncate">
                                        {new Date(img.date).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                                    </p>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightbox(null)}
                >
                    <div
                        className="relative max-w-2xl w-full bg-[#001030] rounded-xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header lightbox */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-[#002147]">
                            <div>
                                <p className="text-[11px] font-black text-white uppercase tracking-widest truncate">
                                    {lightbox.description ?? lightbox.fileName}
                                </p>
                                <p className="text-[9px] text-blue-300 font-mono">
                                    {lightbox.type ?? ''}{lightbox.date ? ` · ${new Date(lightbox.date).toLocaleDateString('es-ES')}` : ''}
                                </p>
                            </div>
                            <button
                                onClick={() => setLightbox(null)}
                                className="text-white/60 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Imagen */}
                        <div className="flex items-center justify-center p-4 bg-black min-h-[300px]">
                            <img
                                src={lightbox.thumb}
                                alt={lightbox.description ?? lightbox.fileName}
                                className="max-h-[60vh] max-w-full object-contain"
                            />
                        </div>
                        {/* Footer lightbox */}
                        <div className="px-4 py-2 bg-[#001030] text-center">
                            <a
                                href={`${AGENT_URL}/image-file/${encodeURIComponent(lightbox.fileName)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-300 hover:text-white font-mono underline"
                            >
                                Abrir imagen original ↗
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RomexisGallery;
