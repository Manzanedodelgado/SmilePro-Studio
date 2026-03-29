// ─────────────────────────────────────────────────────────────────
//  services/workflow-engine.service.ts
//  Motor post-SOAP — analiza el Plan del evolutivo y genera acciones:
//  presupuesto, receta, nueva cita, mensajes post-tratamiento.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { searchTratamientos, type Tratamiento } from './tratamientos.service';

// ═══════════════════════════════════════════════════════════════════
//  1. DICCIONARIO DE TRATAMIENTOS DENTALES — mapping natural → catálogo
// ═══════════════════════════════════════════════════════════════════

interface TreatmentMapping {
    keywords: string[];          // palabras clave que activan este tratamiento
    catalogSearch: string;       // término de búsqueda para el catálogo real
    defaultPrice: number;        // precio orientativo si no hay catálogo
    defaultDuration: number;     // duración en minutos para cita
    tipoAplicacion: 'pieza' | 'arcada' | 'cuadrante' | 'boca';
    category: string;
}

const TREATMENT_MAPPINGS: TreatmentMapping[] = [
    // ── Conservadora ──────────────────────────────────────
    { keywords: ['empaste', 'obturación', 'composite', 'empaste composite'], catalogSearch: 'Empaste', defaultPrice: 90, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Conservadora' },
    { keywords: ['empaste 2 caras', 'obturación 2 caras', 'composite 2 caras', 'empaste dos caras'], catalogSearch: 'Empaste 2 caras', defaultPrice: 120, defaultDuration: 40, tipoAplicacion: 'pieza', category: 'Conservadora' },
    { keywords: ['empaste 3 caras', 'obturación 3 caras', 'composite 3 caras'], catalogSearch: 'Empaste 3 caras', defaultPrice: 150, defaultDuration: 45, tipoAplicacion: 'pieza', category: 'Conservadora' },
    { keywords: ['incrustación', 'inlay', 'onlay'], catalogSearch: 'Incrustación', defaultPrice: 450, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Conservadora' },
    { keywords: ['reconstrucción', 'reco', 'reconstrucción con perno', 'reco con perno'], catalogSearch: 'Reconstrucción', defaultPrice: 180, defaultDuration: 45, tipoAplicacion: 'pieza', category: 'Conservadora' },
    { keywords: ['sellador', 'sellante', 'sellado de fisuras'], catalogSearch: 'Sellador', defaultPrice: 35, defaultDuration: 15, tipoAplicacion: 'pieza', category: 'Conservadora' },

    // ── Endodoncia ─────────────────────────────────────────
    { keywords: ['endodoncia', 'endo', 'tratamiento de conductos'], catalogSearch: 'Endodoncia', defaultPrice: 300, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Endodoncia' },
    { keywords: ['endodoncia molar', 'endo molar'], catalogSearch: 'Endodoncia molar', defaultPrice: 420, defaultDuration: 90, tipoAplicacion: 'pieza', category: 'Endodoncia' },
    { keywords: ['endodoncia premolar', 'endo premolar'], catalogSearch: 'Endodoncia premolar', defaultPrice: 350, defaultDuration: 75, tipoAplicacion: 'pieza', category: 'Endodoncia' },
    { keywords: ['endodoncia anterior', 'endo anterior', 'endo incisivo'], catalogSearch: 'Endodoncia anterior', defaultPrice: 280, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Endodoncia' },
    { keywords: ['reendodoncia', 'retratamiento endodóntico', 'retratamiento de conductos'], catalogSearch: 'Reendodoncia', defaultPrice: 450, defaultDuration: 90, tipoAplicacion: 'pieza', category: 'Endodoncia' },
    { keywords: ['apicoectomía', 'apicectomía'], catalogSearch: 'Apicoectomía', defaultPrice: 350, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Endodoncia' },
    { keywords: ['perno', 'perno muñón', 'poste', 'perno de fibra', 'poste de fibra'], catalogSearch: 'Perno muñón', defaultPrice: 120, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Endodoncia' },

    // ── Prótesis fija ─────────────────────────────────────
    { keywords: ['corona', 'funda', 'corona cerámica', 'corona zirconio', 'corona metal-cerámica'], catalogSearch: 'Corona', defaultPrice: 700, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Prótesis' },
    { keywords: ['corona metal-cerámica', 'corona metalcerámica'], catalogSearch: 'Corona metal-cerámica', defaultPrice: 580, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Prótesis' },
    { keywords: ['corona zirconio', 'corona de zirconio'], catalogSearch: 'Corona zirconio', defaultPrice: 850, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Prótesis' },
    { keywords: ['puente', 'puente fijo', 'puente dental'], catalogSearch: 'Puente', defaultPrice: 2100, defaultDuration: 90, tipoAplicacion: 'pieza', category: 'Prótesis' },
    { keywords: ['carilla', 'carilla porcelana', 'carilla cerámica', 'veneer'], catalogSearch: 'Carilla', defaultPrice: 500, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Prótesis' },
    { keywords: ['carilla composite', 'carilla de composite'], catalogSearch: 'Carilla composite', defaultPrice: 250, defaultDuration: 45, tipoAplicacion: 'pieza', category: 'Prótesis' },
    { keywords: ['provisional', 'corona provisional', 'funda provisional'], catalogSearch: 'Provisional', defaultPrice: 60, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Prótesis' },

    // ── Prótesis removible ────────────────────────────────
    { keywords: ['prótesis completa', 'dentadura completa', 'prótesis total'], catalogSearch: 'Prótesis completa', defaultPrice: 800, defaultDuration: 60, tipoAplicacion: 'arcada', category: 'Prótesis' },
    { keywords: ['prótesis parcial', 'prótesis parcial removible', 'ppr', 'esquelético'], catalogSearch: 'Prótesis parcial', defaultPrice: 650, defaultDuration: 60, tipoAplicacion: 'arcada', category: 'Prótesis' },
    { keywords: ['prótesis', 'removible'], catalogSearch: 'Prótesis', defaultPrice: 700, defaultDuration: 60, tipoAplicacion: 'arcada', category: 'Prótesis' },
    { keywords: ['rebase', 'rebase prótesis'], catalogSearch: 'Rebase', defaultPrice: 150, defaultDuration: 30, tipoAplicacion: 'boca', category: 'Prótesis' },
    { keywords: ['reparación prótesis', 'reparar prótesis'], catalogSearch: 'Reparación prótesis', defaultPrice: 80, defaultDuration: 20, tipoAplicacion: 'boca', category: 'Prótesis' },

    // ── Implantología ─────────────────────────────────────
    { keywords: ['implante', 'implante dental', 'implante titanio', 'implante osteointegrado'], catalogSearch: 'Implante dental', defaultPrice: 1200, defaultDuration: 90, tipoAplicacion: 'pieza', category: 'Implantología' },
    { keywords: ['cirugía implante', 'inserción implante', 'colocación implante'], catalogSearch: 'Cirugía implante', defaultPrice: 350, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Implantología' },
    { keywords: ['corona sobre implante', 'prótesis sobre implante'], catalogSearch: 'Corona sobre implante', defaultPrice: 900, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Implantología' },
    { keywords: ['elevación de seno', 'elevación seno maxilar', 'sinus lift'], catalogSearch: 'Elevación de seno', defaultPrice: 1500, defaultDuration: 120, tipoAplicacion: 'pieza', category: 'Implantología' },
    { keywords: ['regeneración ósea', 'injerto óseo', 'injerto hueso'], catalogSearch: 'Regeneración ósea', defaultPrice: 800, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Implantología' },
    { keywords: ['membrana', 'membrana reabsorbible'], catalogSearch: 'Membrana', defaultPrice: 300, defaultDuration: 0, tipoAplicacion: 'pieza', category: 'Implantología' },
    { keywords: ['pilar', 'pilar protésico', 'pilar implante'], catalogSearch: 'Pilar protésico', defaultPrice: 350, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Implantología' },
    { keywords: ['all on four', 'all on 4', 'all-on-4'], catalogSearch: 'All-on-4', defaultPrice: 12000, defaultDuration: 240, tipoAplicacion: 'arcada', category: 'Implantología' },
    { keywords: ['sobredentadura', 'sobredentadura sobre implantes'], catalogSearch: 'Sobredentadura', defaultPrice: 4500, defaultDuration: 120, tipoAplicacion: 'arcada', category: 'Implantología' },

    // ── Cirugía oral ───────────────────────────────────────
    { keywords: ['extracción', 'exodoncia', 'exo'], catalogSearch: 'Extracción', defaultPrice: 80, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Cirugía' },
    { keywords: ['extracción quirúrgica', 'extracción compleja', 'exodoncia quirúrgica'], catalogSearch: 'Extracción quirúrgica', defaultPrice: 180, defaultDuration: 45, tipoAplicacion: 'pieza', category: 'Cirugía' },
    { keywords: ['extracción cordal', 'extracción muela juicio', 'extracción tercer molar', 'cordal'], catalogSearch: 'Extracción cordal', defaultPrice: 200, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Cirugía' },
    { keywords: ['cordal incluida', 'muela juicio incluida', 'cordal impactada'], catalogSearch: 'Extracción cordal incluida', defaultPrice: 350, defaultDuration: 90, tipoAplicacion: 'pieza', category: 'Cirugía' },
    { keywords: ['frenectomía', 'frenillo'], catalogSearch: 'Frenectomía', defaultPrice: 200, defaultDuration: 30, tipoAplicacion: 'boca', category: 'Cirugía' },
    { keywords: ['biopsia', 'biopsia oral'], catalogSearch: 'Biopsia', defaultPrice: 150, defaultDuration: 30, tipoAplicacion: 'boca', category: 'Cirugía' },
    { keywords: ['drenaje', 'drenaje absceso', 'incisión y drenaje'], catalogSearch: 'Drenaje absceso', defaultPrice: 90, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Cirugía' },
    { keywords: ['sutura', 'puntos'], catalogSearch: 'Sutura', defaultPrice: 50, defaultDuration: 15, tipoAplicacion: 'pieza', category: 'Cirugía' },
    { keywords: ['retirada de puntos', 'quitar puntos'], catalogSearch: 'Retirada puntos', defaultPrice: 0, defaultDuration: 10, tipoAplicacion: 'boca', category: 'Cirugía' },
    { keywords: ['alveoloplastia', 'regularización ósea'], catalogSearch: 'Alveoloplastia', defaultPrice: 200, defaultDuration: 45, tipoAplicacion: 'arcada', category: 'Cirugía' },
    { keywords: ['quistectomía', 'enucleación quiste'], catalogSearch: 'Quistectomía', defaultPrice: 400, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Cirugía' },

    // ── Periodoncia ────────────────────────────────────────
    { keywords: ['limpieza', 'limpieza dental', 'tartrectomía', 'profilaxis', 'higiene dental', 'higiene'], catalogSearch: 'Tartrectomía', defaultPrice: 80, defaultDuration: 45, tipoAplicacion: 'boca', category: 'Periodoncia' },
    { keywords: ['limpieza profunda', 'raspado', 'alisado', 'raspado y alisado', 'rar', 'curetaje'], catalogSearch: 'Raspado y alisado', defaultPrice: 120, defaultDuration: 60, tipoAplicacion: 'cuadrante', category: 'Periodoncia' },
    { keywords: ['cirugía periodontal', 'colgajo'], catalogSearch: 'Cirugía periodontal', defaultPrice: 400, defaultDuration: 90, tipoAplicacion: 'cuadrante', category: 'Periodoncia' },
    { keywords: ['injerto encía', 'injerto gingival', 'injerto tejido conectivo'], catalogSearch: 'Injerto gingival', defaultPrice: 500, defaultDuration: 60, tipoAplicacion: 'pieza', category: 'Periodoncia' },
    { keywords: ['ferulización', 'ferulizar', 'férula periodontal'], catalogSearch: 'Ferulización', defaultPrice: 150, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Periodoncia' },
    { keywords: ['mantenimiento periodontal', 'mantenimiento perio'], catalogSearch: 'Mantenimiento periodontal', defaultPrice: 90, defaultDuration: 45, tipoAplicacion: 'boca', category: 'Periodoncia' },

    // ── Ortodoncia ─────────────────────────────────────────
    { keywords: ['ortodoncia', 'brackets', 'aparatología fija'], catalogSearch: 'Ortodoncia', defaultPrice: 3500, defaultDuration: 60, tipoAplicacion: 'boca', category: 'Ortodoncia' },
    { keywords: ['ortodoncia invisible', 'invisalign', 'alineadores', 'alineadores invisibles'], catalogSearch: 'Ortodoncia invisible', defaultPrice: 4500, defaultDuration: 45, tipoAplicacion: 'boca', category: 'Ortodoncia' },
    { keywords: ['retenedor', 'retenedor fijo', 'retención'], catalogSearch: 'Retenedor', defaultPrice: 150, defaultDuration: 30, tipoAplicacion: 'arcada', category: 'Ortodoncia' },
    { keywords: ['revisión ortodoncia', 'control ortodoncia', 'ajuste ortodoncia'], catalogSearch: 'Revisión ortodoncia', defaultPrice: 50, defaultDuration: 20, tipoAplicacion: 'boca', category: 'Ortodoncia' },
    { keywords: ['expansor', 'disyuntor', 'expansor palatino'], catalogSearch: 'Expansor palatino', defaultPrice: 400, defaultDuration: 45, tipoAplicacion: 'boca', category: 'Ortodoncia' },

    // ── Estética ────────────────────────────────────────────
    { keywords: ['blanqueamiento', 'blanqueamiento dental', 'blanqueo'], catalogSearch: 'Blanqueamiento', defaultPrice: 350, defaultDuration: 90, tipoAplicacion: 'boca', category: 'Estética' },
    { keywords: ['blanqueamiento interno', 'blanqueamiento endodóntico'], catalogSearch: 'Blanqueamiento interno', defaultPrice: 150, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Estética' },
    { keywords: ['contorneado', 'contorneado estético', 'ameloplastia'], catalogSearch: 'Contorneado estético', defaultPrice: 50, defaultDuration: 15, tipoAplicacion: 'pieza', category: 'Estética' },
    { keywords: ['gingivectomía', 'gingivoplastia', 'remodelado gingival'], catalogSearch: 'Gingivectomía', defaultPrice: 200, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Estética' },

    // ── Odontopediatría ───────────────────────────────────
    { keywords: ['pulpotomía', 'pulpotomía temporal'], catalogSearch: 'Pulpotomía', defaultPrice: 120, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Odontopediatría' },
    { keywords: ['corona preformada', 'corona acero', 'corona infantil'], catalogSearch: 'Corona preformada', defaultPrice: 120, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Odontopediatría' },
    { keywords: ['mantenedor espacio', 'mantenedor de espacio'], catalogSearch: 'Mantenedor de espacio', defaultPrice: 150, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Odontopediatría' },
    { keywords: ['fluorización', 'aplicación flúor', 'fluoruro', 'barniz de flúor'], catalogSearch: 'Fluorización', defaultPrice: 30, defaultDuration: 15, tipoAplicacion: 'boca', category: 'Odontopediatría' },

    // ── ATM / Oclusión ─────────────────────────────────────
    { keywords: ['férula de descarga', 'placa de descarga', 'férula michigan', 'férula miorrelajante'], catalogSearch: 'Férula de descarga', defaultPrice: 350, defaultDuration: 45, tipoAplicacion: 'boca', category: 'ATM' },
    { keywords: ['ajuste oclusal', 'tallado selectivo', 'equilibrado oclusal'], catalogSearch: 'Ajuste oclusal', defaultPrice: 80, defaultDuration: 30, tipoAplicacion: 'boca', category: 'ATM' },
    { keywords: ['registros oclusales', 'articulador', 'montaje articulador'], catalogSearch: 'Registros oclusales', defaultPrice: 100, defaultDuration: 30, tipoAplicacion: 'boca', category: 'ATM' },

    // ── Diagnóstico ────────────────────────────────────────
    { keywords: ['revisión', 'exploración', 'primera visita', 'revisión dental'], catalogSearch: 'Revisión', defaultPrice: 40, defaultDuration: 30, tipoAplicacion: 'boca', category: 'Diagnóstico' },
    { keywords: ['radiografía', 'rx', 'periapical', 'rx periapical'], catalogSearch: 'Radiografía periapical', defaultPrice: 15, defaultDuration: 5, tipoAplicacion: 'pieza', category: 'Diagnóstico' },
    { keywords: ['panorámica', 'ortopantomografía', 'pano', 'ortopanto'], catalogSearch: 'Ortopantomografía', defaultPrice: 40, defaultDuration: 10, tipoAplicacion: 'boca', category: 'Diagnóstico' },
    { keywords: ['tac', 'cbct', 'escáner', 'cone beam'], catalogSearch: 'CBCT', defaultPrice: 120, defaultDuration: 15, tipoAplicacion: 'boca', category: 'Diagnóstico' },
    { keywords: ['estudio ortodóntico', 'cefalometría', 'telerradiografía'], catalogSearch: 'Estudio ortodóntico', defaultPrice: 80, defaultDuration: 30, tipoAplicacion: 'boca', category: 'Diagnóstico' },
    { keywords: ['modelos', 'impresiones', 'escáner intraoral'], catalogSearch: 'Modelos', defaultPrice: 60, defaultDuration: 20, tipoAplicacion: 'boca', category: 'Diagnóstico' },

    // ── Urgencias ───────────────────────────────────────────
    { keywords: ['urgencia', 'urgencia dental'], catalogSearch: 'Urgencia', defaultPrice: 60, defaultDuration: 30, tipoAplicacion: 'boca', category: 'Urgencia' },
    { keywords: ['cementado', 'recementado', 'recementar', 'recementar corona'], catalogSearch: 'Recementado', defaultPrice: 40, defaultDuration: 15, tipoAplicacion: 'pieza', category: 'Urgencia' },
    { keywords: ['reimplante', 'reimplantación', 'reimplante dental'], catalogSearch: 'Reimplante', defaultPrice: 150, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Urgencia' },
    { keywords: ['ferulización traumática', 'férula traumática'], catalogSearch: 'Ferulización traumática', defaultPrice: 120, defaultDuration: 30, tipoAplicacion: 'pieza', category: 'Urgencia' },
];

// ═══════════════════════════════════════════════════════════════════
//  2. DICCIONARIO DE MEDICAMENTOS — con posología por defecto
// ═══════════════════════════════════════════════════════════════════

export interface Medicamento {
    nombre: string;
    presentacion: string;
    posologia: string;
    duracion: string;
    via: string;
    notas: string;
}

interface MedMapping {
    keywords: string[];
    medicamento: Medicamento;
}

const MEDICATION_MAPPINGS: MedMapping[] = [
    // ── Antibióticos ──────────────────────────────────────
    {
        keywords: ['amoxicilina', 'amoxicilina 750', 'amoxi'],
        medicamento: { nombre: 'Amoxicilina', presentacion: '750 mg cápsulas', posologia: '1 cápsula cada 8 horas', duracion: '7 días', via: 'oral', notas: 'Tomar con alimentos' },
    },
    {
        keywords: ['amoxicilina 500'],
        medicamento: { nombre: 'Amoxicilina', presentacion: '500 mg cápsulas', posologia: '1 cápsula cada 8 horas', duracion: '7 días', via: 'oral', notas: 'Tomar con alimentos' },
    },
    {
        keywords: ['augmentine', 'amoxicilina clavulánico', 'amoxicilina/ácido clavulánico', 'clavulánico'],
        medicamento: { nombre: 'Amoxicilina/Ác. Clavulánico (Augmentine)', presentacion: '875/125 mg comprimidos', posologia: '1 comprimido cada 8 horas', duracion: '7 días', via: 'oral', notas: 'Tomar al inicio de las comidas' },
    },
    {
        keywords: ['metronidazol', 'flagyl'],
        medicamento: { nombre: 'Metronidazol (Flagyl)', presentacion: '500 mg comprimidos', posologia: '1 comprimido cada 8 horas', duracion: '7 días', via: 'oral', notas: 'No mezclar con alcohol. Tomar con alimentos' },
    },
    {
        keywords: ['clindamicina', 'dalacin'],
        medicamento: { nombre: 'Clindamicina (Dalacin)', presentacion: '300 mg cápsulas', posologia: '1 cápsula cada 6 horas', duracion: '7 días', via: 'oral', notas: 'Para alérgicos a penicilinas. Tomar con agua abundante' },
    },
    {
        keywords: ['azitromicina', 'zitromax'],
        medicamento: { nombre: 'Azitromicina (Zitromax)', presentacion: '500 mg comprimidos', posologia: '1 comprimido al día', duracion: '3 días', via: 'oral', notas: 'Tomar 1h antes o 2h después de comer' },
    },
    {
        keywords: ['espiramicina', 'rhodogil'],
        medicamento: { nombre: 'Espiramicina + Metronidazol (Rhodogil)', presentacion: '1.5MUI/250mg comprimidos', posologia: '1 comprimido cada 6-8 horas', duracion: '7-10 días', via: 'oral', notas: 'No mezclar con alcohol' },
    },

    // ── Analgésicos ───────────────────────────────────────
    {
        keywords: ['ibuprofeno', 'ibuprofeno 600', 'ibuprofen'],
        medicamento: { nombre: 'Ibuprofeno', presentacion: '600 mg comprimidos', posologia: '1 comprimido cada 8 horas', duracion: '3-5 días', via: 'oral', notas: 'Tomar con alimentos. No en ayunas' },
    },
    {
        keywords: ['ibuprofeno 400'],
        medicamento: { nombre: 'Ibuprofeno', presentacion: '400 mg comprimidos', posologia: '1 comprimido cada 6-8 horas', duracion: '3-5 días', via: 'oral', notas: 'Tomar con alimentos' },
    },
    {
        keywords: ['paracetamol', 'paracetamol 1g', 'apiretal'],
        medicamento: { nombre: 'Paracetamol', presentacion: '1 g comprimidos', posologia: '1 comprimido cada 8 horas', duracion: 'Si dolor', via: 'oral', notas: 'Máximo 3g/día. No mezclar con alcohol' },
    },
    {
        keywords: ['paracetamol 650'],
        medicamento: { nombre: 'Paracetamol', presentacion: '650 mg comprimidos', posologia: '1 comprimido cada 6-8 horas', duracion: 'Si dolor', via: 'oral', notas: 'Máximo 4g/día' },
    },
    {
        keywords: ['nolotil', 'metamizol'],
        medicamento: { nombre: 'Metamizol (Nolotil)', presentacion: '575 mg cápsulas', posologia: '1 cápsula cada 8 horas', duracion: '3-5 días si dolor intenso', via: 'oral', notas: 'Alternativa si paracetamol insuficiente. Riesgo de agranulocitosis (raro)' },
    },
    {
        keywords: ['dexketoprofeno', 'enantyum'],
        medicamento: { nombre: 'Dexketoprofeno (Enantyum)', presentacion: '25 mg comprimidos', posologia: '1 comprimido cada 8 horas', duracion: '3-5 días', via: 'oral', notas: 'Tomar con alimentos. AINE potente' },
    },
    {
        keywords: ['diclofenaco', 'voltaren'],
        medicamento: { nombre: 'Diclofenaco (Voltaren)', presentacion: '50 mg comprimidos', posologia: '1 comprimido cada 8 horas', duracion: '3-5 días', via: 'oral', notas: 'Tomar con alimentos. Protector gástrico recomendado' },
    },
    {
        keywords: ['tramadol'],
        medicamento: { nombre: 'Tramadol', presentacion: '50 mg cápsulas', posologia: '1 cápsula cada 8 horas', duracion: 'Máximo 3 días', via: 'oral', notas: 'Solo dolor severo. Puede causar somnolencia. No conducir' },
    },

    // ── Antiinflamatorios / Corticoides ────────────────────
    {
        keywords: ['dexametasona'],
        medicamento: { nombre: 'Dexametasona', presentacion: '4 mg comprimidos', posologia: '1 comprimido al día por la mañana', duracion: '3 días', via: 'oral', notas: 'Corticoide. Pre/post cirugía para reducir inflamación' },
    },
    {
        keywords: ['prednisona', 'dacortín'],
        medicamento: { nombre: 'Prednisona (Dacortín)', presentacion: '30 mg comprimidos', posologia: '1 comprimido al día por la mañana', duracion: '3-5 días en pauta descendente', via: 'oral', notas: 'Tomar en desayuno. Pauta descendente' },
    },

    // ── Colutorios / Tópicos ──────────────────────────────
    {
        keywords: ['clorhexidina', 'enjuague clorhexidina', 'colutorio'],
        medicamento: { nombre: 'Clorhexidina 0.12%', presentacion: 'Colutorio 250ml', posologia: 'Enjuague 15ml durante 30 segundos, 2 veces al día', duracion: '14 días', via: 'tópica', notas: 'No enjuagar con agua después. Esperar 30min antes de comer. Puede teñir dientes temporalmente' },
    },
    {
        keywords: ['clorhexidina gel', 'gel clorhexidina', 'periogel'],
        medicamento: { nombre: 'Clorhexidina gel 0.2%', presentacion: 'Gel bioadhesivo', posologia: 'Aplicar en encías 2-3 veces al día', duracion: '14 días', via: 'tópica', notas: 'Aplicar con dedo limpio o cepillo suave sobre la zona' },
    },
    {
        keywords: ['ácido hialurónico gel', 'gengigel', 'aftasone'],
        medicamento: { nombre: 'Ácido hialurónico gel oral (Gengigel)', presentacion: 'Gel oral', posologia: 'Aplicar 3-4 veces al día sobre la zona', duracion: '7-14 días', via: 'tópica', notas: 'Para aftas, heridas quirúrgicas, mucositis' },
    },

    // ── Protector gástrico ────────────────────────────────
    {
        keywords: ['omeprazol', 'protector gástrico', 'protector estómago'],
        medicamento: { nombre: 'Omeprazol', presentacion: '20 mg cápsulas', posologia: '1 cápsula al día en ayunas', duracion: 'Mientras tome AINEs', via: 'oral', notas: 'Tomar 30min antes del desayuno. Protector gástrico al prescribir AINEs' },
    },

    // ── Antifúngicos ──────────────────────────────────────
    {
        keywords: ['nistatina', 'mycostatin'],
        medicamento: { nombre: 'Nistatina (Mycostatin)', presentacion: 'Suspensión oral 100.000 UI/ml', posologia: '1-2ml (enjuagar y tragar) cada 6 horas', duracion: '14 días', via: 'oral/tópica', notas: 'Mantener en boca 1-2 minutos antes de tragar' },
    },
    {
        keywords: ['fluconazol'],
        medicamento: { nombre: 'Fluconazol', presentacion: '50 mg cápsulas', posologia: '1 cápsula al día', duracion: '7-14 días', via: 'oral', notas: 'Para candidiasis oral persistente' },
    },

    // ── Antivirales ───────────────────────────────────────
    {
        keywords: ['aciclovir', 'zovirax'],
        medicamento: { nombre: 'Aciclovir (Zovirax)', presentacion: '200 mg comprimidos / crema 5%', posologia: '1 comprimido 5 veces al día (cada 4h) o crema 5 veces al día', duracion: '5-7 días', via: 'oral/tópica', notas: 'Para herpes labial. Iniciar al primer síntoma' },
    },
    {
        keywords: ['valaciclovir'],
        medicamento: { nombre: 'Valaciclovir', presentacion: '500 mg comprimidos', posologia: '1 comprimido cada 12 horas', duracion: '5 días', via: 'oral', notas: 'Para herpes. Más cómodo que aciclovir' },
    },

    // ── Hemostáticos / Otros ──────────────────────────────
    {
        keywords: ['ácido tranexámico', 'amchafibrin'],
        medicamento: { nombre: 'Ácido Tranexámico (Amchafibrin)', presentacion: '500 mg comprimidos', posologia: '1 comprimido cada 8 horas', duracion: '3-5 días post-extracción', via: 'oral', notas: 'Antifibrinolítico. Para pacientes con tendencia al sangrado' },
    },
    {
        keywords: ['vitamina c', 'ascórbico'],
        medicamento: { nombre: 'Vitamina C', presentacion: '1000 mg comprimidos efervescentes', posologia: '1 comprimido al día', duracion: '30 días', via: 'oral', notas: 'Complemento para cicatrización y salud gingival' },
    },
];

// ═══════════════════════════════════════════════════════════════════
//  3. MENSAJES POST-TRATAMIENTO
// ═══════════════════════════════════════════════════════════════════

interface PostTreatmentMessage {
    treatmentKeywords: string[];
    asunto: string;
    mensaje: string;
}

const POST_TREATMENT_MESSAGES: PostTreatmentMessage[] = [
    {
        treatmentKeywords: ['extracción', 'exodoncia', 'exo'],
        asunto: 'Instrucciones post-extracción',
        mensaje: `Instrucciones post-extracción:\n• Morder la gasa 30-45 min\n• No escupir ni enjuagar las primeras 24h\n• Dieta blanda y fría las primeras horas\n• No fumar ni beber con pajita\n• Si sangra mucho: morder gasa nueva otros 30min\n• Tomar la medicación pautada\n• Si fiebre o dolor intenso que no cede: contacte con la clínica`,
    },
    {
        treatmentKeywords: ['implante'],
        asunto: 'Instrucciones post-implante',
        mensaje: `Instrucciones post-implante:\n• Aplicar frío las primeras 24-48h (10min sí, 10min no)\n• Dieta blanda 1 semana\n• No fumar mínimo 2 semanas\n• Enjuagues suaves con clorhexidina desde las 24h\n• Cepillado suave sin tocar la zona\n• Tomar la medicación pautada\n• Acudir a la revisión programada`,
    },
    {
        treatmentKeywords: ['endodoncia', 'endo'],
        asunto: 'Instrucciones post-endodoncia',
        mensaje: `Instrucciones post-endodoncia:\n• Puede sentir molestias 2-3 días (normal)\n• Evitar masticar con esa pieza hasta la restauración definitiva\n• Tomar la medicación pautada\n• Si dolor intenso o inflamación que aumenta: contacte con la clínica\n• Es imprescindible la corona/reconstrucción definitiva`,
    },
    {
        treatmentKeywords: ['cirugía', 'colgajo', 'injerto'],
        asunto: 'Instrucciones post-cirugía',
        mensaje: `Instrucciones post-cirugía:\n• Aplicar frío las primeras 24-48h (10min sí, 10min no)\n• Dieta blanda y fría 48-72h\n• No fumar mínimo 1 semana\n• Dormir con cabeza elevada\n• Enjuagues suaves con clorhexidina desde las 24h\n• No cepillar la zona intervenida 1 semana\n• Acudir a retirada de puntos según lo indicado`,
    },
    {
        treatmentKeywords: ['raspado', 'curetaje', 'alisado', 'limpieza profunda'],
        asunto: 'Instrucciones post-raspado',
        mensaje: `Instrucciones post-raspado:\n• Sensibilidad dental es normal 1-2 semanas\n• Enjuagues con clorhexidina 2 semanas\n• Cepillado suave con cepillo quirúrgico\n• Puede haber leve sangrado las primeras 24h\n• Dieta blanda el día del tratamiento`,
    },
    {
        treatmentKeywords: ['blanqueamiento'],
        asunto: 'Instrucciones post-blanqueamiento',
        mensaje: `Instrucciones post-blanqueamiento:\n• Dieta blanca 48h (evitar café, té, vino, tabaco, colorantes)\n• Sensibilidad es normal 24-48h\n• Si molestias: aplicar gel desensibilizante\n• Mantener higiene diaria estricta\n• Evitar bebidas muy frías o calientes 48h`,
    },
    {
        treatmentKeywords: ['corona', 'puente', 'carilla', 'funda'],
        asunto: 'Instrucciones post-prótesis fija',
        mensaje: `Instrucciones post-prótesis fija:\n• Evitar alimentos muy duros o pegajosos las primeras 24h\n• Sensibilidad al frío/calor es normal los primeros días\n• Use seda dental e irrigador diariamente\n• Si siente la mordida alta: contacte con la clínica\n• Revisión de control según lo indicado`,
    },
];

// ═══════════════════════════════════════════════════════════════════
//  4. EXTRACCIÓN DE PIEZAS DENTALES DEL TEXTO
// ═══════════════════════════════════════════════════════════════════

function extractPiezas(text: string): string[] {
    const lower = text.toLowerCase();
    const piezas: string[] = [];

    // Patrón 1: "pieza 36", "piezas 36 y 46", "pieza 36, 46"
    const piezaMatch = lower.matchAll(/(?:pieza|piezas?)\s+([\d,\s]+(?:y\s+\d+)?)/gi);
    for (const m of piezaMatch) {
        const nums = m[1].replace(/y/g, ',').split(/[,\s]+/).map(n => n.trim()).filter(n => /^\d{2}$/.test(n));
        piezas.push(...nums);
    }

    // Patrón 2: "en 36 y 46", "en el 36"
    const enMatch = lower.matchAll(/\ben\s+(?:el\s+)?(\d{2})(?:\s*[,y]\s*(\d{2}))*/gi);
    for (const m of enMatch) {
        const fragment = m[0];
        const nums = fragment.match(/\d{2}/g);
        if (nums) piezas.push(...nums.filter(n => parseInt(n) >= 11 && parseInt(n) <= 48));
    }

    // Patrón 3: "del 36", "la 36"
    const delMatch = lower.matchAll(/(?:del|la|el)\s+(\d{2})\b/gi);
    for (const m of delMatch) {
        const n = m[1];
        if (parseInt(n) >= 11 && parseInt(n) <= 48) piezas.push(n);
    }

    // Deduplicar
    return [...new Set(piezas)];
}

// ═══════════════════════════════════════════════════════════════════
//  5. MOTOR PRINCIPAL — ANÁLISIS POST-SOAP
// ═══════════════════════════════════════════════════════════════════

export interface DetectedTreatment {
    mapping: TreatmentMapping;
    matchedKeyword: string;
    piezas: string[];
    catalogMatch?: Tratamiento;      // del catálogo real si se encuentra
}

export interface DetectedMedication {
    medicamento: Medicamento;
    matchedKeyword: string;
}

export interface DetectedMessage {
    asunto: string;
    mensaje: string;
}

export interface PostSOAPResult {
    treatments: DetectedTreatment[];
    medications: DetectedMedication[];
    messages: DetectedMessage[];
    suggestNewCita: boolean;
    suggestPresupuesto: boolean;
    suggestReceta: boolean;
}

/**
 * Analiza los campos SOAP y devuelve las acciones sugeridas.
 * Se ejecuta al firmar el evolutivo.
 */
export async function analyzePostSOAP(
    soapData: { subjetivo: string; objetivo: string; analisis: string; plan: string },
    _numPac?: string,
): Promise<PostSOAPResult> {
    const planLower = soapData.plan.toLowerCase();
    const fullText = `${soapData.subjetivo} ${soapData.objetivo} ${soapData.analisis} ${soapData.plan}`.toLowerCase();

    // ── Extraer piezas del texto completo ──────────────────
    const piezas = extractPiezas(fullText);

    // ── Detectar tratamientos ─────────────────────────────
    const treatments: DetectedTreatment[] = [];
    const usedKeywords = new Set<string>();

    // Ordenar mappings por keywords más largos primero (para evitar match parcial)
    const sortedMappings = [...TREATMENT_MAPPINGS].sort(
        (a, b) => Math.max(...b.keywords.map(k => k.length)) - Math.max(...a.keywords.map(k => k.length))
    );

    for (const mapping of sortedMappings) {
        for (const kw of mapping.keywords) {
            if (planLower.includes(kw) && !usedKeywords.has(kw)) {
                // Evitar duplicados por keywords solapados
                const isSubset = [...usedKeywords].some(used => used.includes(kw) || kw.includes(used));
                if (isSubset && treatments.some(t => t.mapping.category === mapping.category)) continue;

                usedKeywords.add(kw);

                // Intentar buscar en catálogo real
                let catalogMatch: Tratamiento | undefined;
                try {
                    const results = await searchTratamientos(mapping.catalogSearch);
                    catalogMatch = results[0];
                } catch { /* sin catálogo, usamos defaults */ }

                treatments.push({
                    mapping,
                    matchedKeyword: kw,
                    piezas: mapping.tipoAplicacion === 'pieza' ? piezas : [],
                    catalogMatch,
                });
                break; // Solo un keyword por mapping
            }
        }
    }

    // ── Detectar medicamentos ─────────────────────────────
    const medications: DetectedMedication[] = [];
    const usedMeds = new Set<string>();

    for (const med of MEDICATION_MAPPINGS) {
        for (const kw of med.keywords) {
            if (planLower.includes(kw) && !usedMeds.has(med.medicamento.nombre)) {
                usedMeds.add(med.medicamento.nombre);
                medications.push({ medicamento: med.medicamento, matchedKeyword: kw });
                break;
            }
        }
    }

    // ── Detectar mensajes post-tratamiento ─────────────────
    // SOLO se envían si el texto indica que el procedimiento fue REALIZADO
    // (verbos en pasado / completados), NO si es un plan futuro.
    const messages: DetectedMessage[] = [];
    const usedMsgs = new Set<string>();

    // Verbos que indican acción YA REALIZADA
    const COMPLETED_VERBS = [
        'se realizó', 'se realizaron', 'se hizo', 'se hicieron',
        'se colocó', 'se colocaron', 'se extrajo', 'se extrajeron',
        'realizada', 'realizadas', 'realizado', 'realizados',
        'extraída', 'extraídas', 'extraído', 'extraídos',
        'colocada', 'colocadas', 'colocado', 'colocados',
        'hecha', 'hechas', 'hecho', 'hechos',
        'completada', 'completado', 'finalizada', 'finalizado',
        'procedemos a', 'procedimos a', 'se procede a',
        'se efectúa', 'se efectuó', 'se lleva a cabo', 'se llevó a cabo',
    ];

    // Verbos que indican PLAN FUTURO → NO enviar instrucciones post-tto
    const PLANNING_VERBS = [
        'necesita', 'necesitan', 'precisa', 'requiere', 'requieren',
        'planificamos', 'planificar', 'programar', 'programamos',
        'valorar', 'valoramos', 'estudiar', 'estudiamos',
        'proponemos', 'proponer', 'sugerimos', 'sugerir',
        'pendiente', 'pendientes', 'damos cita', 'dar cita',
        'derivar', 'derivamos', 'remitir', 'remitimos',
    ];

    /**
     * Comprueba si un keyword de tratamiento aparece en un contexto
     * de acción completada (no planificada).
     */
    const isProcedureCompleted = (text: string, keyword: string): boolean => {
        const idx = text.indexOf(keyword);
        if (idx === -1) return false;

        // Ventana de contexto: 80 chars antes y 40 después del keyword
        const ctxStart = Math.max(0, idx - 80);
        const ctxEnd = Math.min(text.length, idx + keyword.length + 40);
        const context = text.slice(ctxStart, ctxEnd);

        const hasCompleted = COMPLETED_VERBS.some(v => context.includes(v));
        const hasPlanning = PLANNING_VERBS.some(v => context.includes(v));

        // Si tiene verbo de completado y NO de planificación → fue realizado
        if (hasCompleted && !hasPlanning) return true;
        // Si tiene verbo de planificación → NO fue realizado
        if (hasPlanning) return false;
        // Sin verbos claros → asumir que NO fue realizado (safe default)
        return false;
    };

    for (const msg of POST_TREATMENT_MESSAGES) {
        for (const kw of msg.treatmentKeywords) {
            if (planLower.includes(kw) && !usedMsgs.has(msg.asunto)) {
                if (isProcedureCompleted(planLower, kw)) {
                    usedMsgs.add(msg.asunto);
                    messages.push({ asunto: msg.asunto, mensaje: msg.mensaje });
                    break;
                }
            }
        }
    }

    // ── Detectar si se sugiere nueva cita ──────────────────
    const citaKeywords = ['cita', 'próxima cita', 'próxima visita', 'siguiente visita', 'volver', 'revisión', 'control', 'seguimiento'];
    const suggestNewCita = citaKeywords.some(kw => planLower.includes(kw));

    return {
        treatments,
        medications,
        messages,
        suggestNewCita,
        suggestPresupuesto: treatments.length > 0,
        suggestReceta: medications.length > 0,
    };
}

// ═══════════════════════════════════════════════════════════════════
//  6. HELPERS — Crear presupuesto desde detección
// ═══════════════════════════════════════════════════════════════════

import { createPresupuesto, type LineaPresupuesto, type Presupuesto } from './presupuestos.service';

export async function createPresupuestoFromDetection(
    numPac: string,
    treatments: DetectedTreatment[],
    pacienteNombre?: string,
): Promise<Presupuesto> {
    const lineas: LineaPresupuesto[] = [];
    let lineaId = 1;

    for (const t of treatments) {
        const precio = t.catalogMatch?.precio ?? t.mapping.defaultPrice;

        if (t.mapping.tipoAplicacion === 'pieza' && t.piezas.length > 0) {
            // Una línea por pieza
            for (const pieza of t.piezas) {
                lineas.push({
                    id: `auto-${lineaId++}`,
                    idPre: 0,
                    descripcion: t.catalogMatch?.nombre ?? t.mapping.catalogSearch,
                    pieza,
                    cantidad: 1,
                    precioPresupuesto: precio,
                    precioUnitario: precio,
                    descuento: 0,
                    importeLinea: precio,
                    importeCobrado: 0,
                    estado: 'Pendiente',
                });
            }
        } else {
            lineas.push({
                id: `auto-${lineaId++}`,
                idPre: 0,
                descripcion: t.catalogMatch?.nombre ?? t.mapping.catalogSearch,
                cantidad: 1,
                precioPresupuesto: precio,
                precioUnitario: precio,
                descuento: 0,
                importeLinea: precio,
                importeCobrado: 0,
                estado: 'Pendiente',
            });
        }
    }

    const pres = await createPresupuesto({
        idPac: numPac,
        pacienteNombre,
        lineas,
        importeTotal: 0,
        importeCobrado: 0,
        importePendiente: 0,
        lineasPendientes: 0,
        lineasFinalizadas: 0,
        estado: 'Borrador',
        fecha: new Date().toISOString().slice(0, 10),
        notas: 'Generado automáticamente desde Escucha Activa (SOAP)',
    });

    logger.info(`[WORKFLOW] Presupuesto #${pres.id} creado con ${lineas.length} líneas para paciente ${numPac}`);
    return pres;
}

/**
 * Envía un resumen del presupuesto al paciente vía WhatsApp.
 */
export async function sendPresupuestoWhatsApp(
    phone: string,
    treatments: DetectedTreatment[],
    pacienteNombre: string,
    clinicaNombre: string = 'SmilePro Studio',
): Promise<boolean> {
    if (!isEvolutionConfigured()) {
        logger.warn('[WORKFLOW] WhatsApp no configurado — presupuesto no enviado');
        return false;
    }

    const nombre = pacienteNombre.split(' ')[0];
    const lineas = treatments.map(t => {
        const precio = t.catalogMatch?.precio ?? t.mapping.defaultPrice;
        const desc = t.catalogMatch?.nombre ?? t.mapping.catalogSearch;
        const piezaStr = t.piezas.length > 0 ? ` (pieza${t.piezas.length > 1 ? 's' : ''} ${t.piezas.join(', ')})` : '';
        const mult = t.mapping.tipoAplicacion === 'pieza' && t.piezas.length > 0 ? t.piezas.length : 1;
        return `• ${desc}${piezaStr} — ${(precio * mult).toLocaleString('es-ES')} €`;
    });

    const total = treatments.reduce((sum, t) => {
        const precio = t.catalogMatch?.precio ?? t.mapping.defaultPrice;
        const mult = t.mapping.tipoAplicacion === 'pieza' && t.piezas.length > 0 ? t.piezas.length : 1;
        return sum + precio * mult;
    }, 0);

    const mensaje =
        `Hola ${nombre} 👋\n\n` +
        `Desde ${clinicaNombre} te enviamos el presupuesto de tu tratamiento:\n\n` +
        lineas.join('\n') + '\n\n' +
        `💰 *Total estimado: ${total.toLocaleString('es-ES')} €*\n\n` +
        `📌 Este presupuesto es orientativo. El precio final puede variar tras la revisión.\n` +
        `Si tienes alguna duda, escríbenos.\n\n` +
        `— ${clinicaNombre}`;

    const sent = await sendTextMessage(normalizePhone(phone), mensaje);
    if (sent) {
        logger.info(`[WORKFLOW] Presupuesto enviado por WhatsApp a ${nombre} (${phone})`);
    }
    return sent;
}

// ═══════════════════════════════════════════════════════════════════
//  7. HELPERS — Crear cita desde detección
// ═══════════════════════════════════════════════════════════════════

import { createCita, dateToISO } from './citas.service';
import type { Cita } from '../types';

export interface SuggestedCita {
    tratamiento: string;
    duracionMinutos: number;
    piezas: string[];
}

/** Calcula la cita sugerida a partir de los tratamientos detectados */
export function getSuggestedCita(treatments: DetectedTreatment[]): SuggestedCita | null {
    if (treatments.length === 0) return null;

    // El tratamiento principal = el de mayor duración
    const main = [...treatments].sort((a, b) => b.mapping.defaultDuration - a.mapping.defaultDuration)[0];

    // Duración: suma de todos los tratamientos (con mínimo 30min, máximo 180min)
    const totalDuration = treatments.reduce((sum, t) => sum + t.mapping.defaultDuration, 0);
    const duration = Math.max(30, Math.min(180, totalDuration));

    // Piezas de todos los tratamientos
    const allPiezas = [...new Set(treatments.flatMap(t => t.piezas))];

    const piezaStr = allPiezas.length > 0 ? ` (${allPiezas.join(', ')})` : '';

    return {
        tratamiento: `${main.catalogMatch?.nombre ?? main.mapping.catalogSearch}${piezaStr}`,
        duracionMinutos: duration,
        piezas: allPiezas,
    };
}

/**
 * @deprecated El doctor no crea citas directamente.
 * Solo indica tratamiento y duración en PostSOAPActions,
 * y recepción recupera esos datos para dar la nueva cita.
 * Se mantiene por compatibilidad pero no se usa en el flujo principal.
 */
export async function createCitaFromSOAP(
    numPac: string,
    nombrePaciente: string,
    treatments: DetectedTreatment[],
    fecha?: Date,
    hora?: string,
    gabinete?: string,
): Promise<Cita | null> {
    const suggested = getSuggestedCita(treatments);
    if (!suggested) return null;

    const targetDate = fecha ?? getNextWorkday();

    const cita = await createCita({
        pacienteNumPac: numPac,
        nombrePaciente,
        gabinete: gabinete ?? 'G1',
        horaInicio: hora ?? '10:00',
        duracionMinutos: suggested.duracionMinutos,
        tratamiento: suggested.tratamiento,
        categoria: 'Diagnostico',
        estado: 'planificada',
        doctor: '',
        alertasMedicas: [],
        alertasLegales: [],
        alertasFinancieras: false,
        notas: `Cita generada por Escucha Activa — ${treatments.map(t => t.mapping.catalogSearch).join(', ')}`,
    }, targetDate);

    if (cita) {
        logger.info(`[WORKFLOW] Cita creada: ${suggested.tratamiento} el ${dateToISO(targetDate)} para ${numPac}`);
    }
    return cita;
}

/** Siguiente día laborable (L-V) */
function getNextWorkday(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
    }
    return d;
}

// ═══════════════════════════════════════════════════════════════════
//  8. HELPERS — Enviar mensajes post-tratamiento vía WhatsApp
// ═══════════════════════════════════════════════════════════════════

import { sendTextMessage, isEvolutionConfigured, normalizePhone } from './evolution.service';

export interface MessageSendResult {
    asunto: string;
    sent: boolean;
    error?: string;
}

/**
 * Envía los mensajes post-tratamiento al paciente vía WhatsApp.
 * @param phone Teléfono del paciente (con o sin prefijo)
 * @param messages Mensajes a enviar
 * @param pacienteNombre Nombre del paciente para personalizar
 * @param clinicaNombre Nombre de la clínica
 */
export async function sendPostTreatmentMessages(
    phone: string,
    messages: DetectedMessage[],
    pacienteNombre: string,
    clinicaNombre: string = 'SmilePro Studio',
): Promise<MessageSendResult[]> {
    const results: MessageSendResult[] = [];

    if (!isEvolutionConfigured()) {
        logger.warn('[WORKFLOW] WhatsApp no configurado — mensajes no enviados');
        return messages.map(m => ({ asunto: m.asunto, sent: false, error: 'WhatsApp no configurado' }));
    }

    for (const msg of messages) {
        const texto = `Hola ${pacienteNombre.split(' ')[0]} 👋\n\n` +
            `Desde ${clinicaNombre} te enviamos las instrucciones tras tu tratamiento:\n\n` +
            msg.mensaje + '\n\n' +
            `Si tienes cualquier duda, no dudes en escribirnos. ¡Un saludo! 😊\n` +
            `— ${clinicaNombre}`;

        try {
            const sent = await sendTextMessage(phone, texto);
            results.push({ asunto: msg.asunto, sent });
            if (sent) {
                logger.info(`[WORKFLOW] Mensaje "${msg.asunto}" enviado al ${phone}`);
            }
        } catch (e) {
            results.push({ asunto: msg.asunto, sent: false, error: String(e) });
        }
    }

    return results;
}

// ═══════════════════════════════════════════════════════════════════
//  9. FASE 0-1 — Mensaje al paciente al crear cita
// ═══════════════════════════════════════════════════════════════════

/**
 * Envía mensaje WhatsApp al paciente notificando que su cita fue creada.
 * Se llama tanto al crear cita manual (recepción) como automática (post-SOAP).
 */
export async function sendCitaCreatedMessage(
    phone: string,
    pacienteNombre: string,
    fecha: string,
    hora: string,
    tratamiento: string,
    doctor: string,
    clinicaNombre: string = 'SmilePro Studio',
    clinicaDireccion?: string,
): Promise<boolean> {
    if (!isEvolutionConfigured()) {
        logger.warn('[WORKFLOW] WhatsApp no configurado — mensaje cita no enviado');
        return false;
    }

    const nombre = pacienteNombre.split(' ')[0];
    const mensaje =
        `Hola ${nombre} 👋\n\n` +
        `Tu cita ha sido programada en ${clinicaNombre}:\n\n` +
        `📅 Fecha: ${fecha}\n` +
        `🕐 Hora: ${hora}\n` +
        `🦷 Tratamiento: ${tratamiento}\n` +
        `👨‍⚕️ Doctor/a: ${doctor}\n` +
        (clinicaDireccion ? `📍 ${clinicaDireccion}\n` : '') +
        `\nTe enviaremos un recordatorio antes de tu cita.\n` +
        `Si necesitas cambiar o cancelar, escríbenos aquí.\n\n` +
        `— ${clinicaNombre}`;

    const sent = await sendTextMessage(normalizePhone(phone), mensaje);
    if (sent) {
        logger.info(`[WORKFLOW] Mensaje "cita creada" enviado a ${nombre} (${phone})`);
    }
    return sent;
}

// ═══════════════════════════════════════════════════════════════════
//  10. FASE 6E — Auto-finalizar cita al firmar SOAP
// ═══════════════════════════════════════════════════════════════════

import { updateEstadoCita, getCitasByFecha, getCitasByPaciente } from './citas.service';

/**
 * Al firmar un SOAP, busca la cita activa del paciente hoy
 * (estado 'consulta' o 'espera') y la marca como 'finalizada'.
 */
export async function autoFinalizeCitaOnSOAPSign(numPac: string): Promise<string | null> {
    try {
        const today = new Date();
        const citasHoy = await getCitasByFecha(today);
        
        // Buscar la cita de este paciente que esté en consulta o espera
        const citaActiva = citasHoy.find(c =>
            c.pacienteNumPac === numPac &&
            (c.estado === 'consulta' || c.estado === 'espera')
        );

        if (!citaActiva) {
            logger.info(`[WORKFLOW] No se encontró cita activa hoy para ${numPac} — no se auto-finaliza`);
            return null;
        }

        const ok = await updateEstadoCita(citaActiva.id, 'finalizada');
        if (ok) {
            logger.info(`[WORKFLOW] Cita ${citaActiva.id} auto-finalizada al firmar SOAP (${numPac})`);
            return citaActiva.id;
        }
        return null;
    } catch (e) {
        logger.error('[WORKFLOW] Error auto-finalizando cita:', e);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
//  11. FASE 7 — Seguimiento post-tratamiento (24h después)
// ═══════════════════════════════════════════════════════════════════

interface FollowUpTemplate {
    id: string;
    treatmentKeywords: string[];
    mensaje: (nombre: string, tratamiento: string) => string;
}

const FOLLOWUP_TEMPLATES: FollowUpTemplate[] = [
    {
        id: 'followup_cirugia',
        treatmentKeywords: ['extracción', 'exodoncia', 'implante', 'cirugía', 'colgajo', 'injerto', 'cordal'],
        mensaje: (nombre, tto) =>
            `Hola ${nombre} 👋\n\n` +
            `Han pasado 24h desde tu ${tto}. ¿Cómo te encuentras?\n\n` +
            `Es normal sentir:\n` +
            `• Algo de inflamación\n` +
            `• Molestias leves\n` +
            `• Ligero sangrado (en caso de extracción)\n\n` +
            `⚠️ Contacta con nosotros si tienes:\n` +
            `• Dolor intenso que no cede con la medicación\n` +
            `• Fiebre superior a 38°C\n` +
            `• Sangrado abundante\n` +
            `• Inflamación que va a más\n\n` +
            `Recuerda seguir las instrucciones que te enviamos. ¡Ánimo! 💪`,
    },
    {
        id: 'followup_endodoncia',
        treatmentKeywords: ['endodoncia', 'endo'],
        mensaje: (nombre, tto) =>
            `Hola ${nombre} 👋\n\n` +
            `Han pasado 24h desde tu ${tto}. ¿Cómo te encuentras?\n\n` +
            `Es normal sentir molestias al morder los primeros días.\n` +
            `⚠️ Evita masticar con esa pieza hasta la restauración definitiva.\n\n` +
            `Si el dolor es intenso o aparece inflamación, contáctanos.\n` +
            `¡Un saludo! 😊`,
    },
    {
        id: 'followup_general',
        treatmentKeywords: [],       // fallback para cualquier procedimiento
        mensaje: (nombre, tto) =>
            `Hola ${nombre} 👋\n\n` +
            `Han pasado 24h desde tu tratamiento (${tto}). ¿Cómo te encuentras?\n\n` +
            `Si tienes alguna molestia o duda, no dudes en escribirnos.\n` +
            `¡Un saludo! 😊`,
    },
];

/**
 * Envía mensaje de seguimiento 24h post-tratamiento.
 * Selecciona la plantilla según el tipo de tratamiento realizado.
 */
export async function sendFollowUp24h(
    phone: string,
    pacienteNombre: string,
    tratamiento: string,
    clinicaNombre: string = 'SmilePro Studio',
): Promise<boolean> {
    if (!isEvolutionConfigured()) {
        logger.warn('[WORKFLOW] WhatsApp no configurado — follow-up no enviado');
        return false;
    }

    const nombre = pacienteNombre.split(' ')[0];
    const ttoLower = tratamiento.toLowerCase();

    // Buscar template específico por tratamiento
    let template = FOLLOWUP_TEMPLATES.find(t =>
        t.treatmentKeywords.length > 0 &&
        t.treatmentKeywords.some(kw => ttoLower.includes(kw))
    );

    // Fallback al general
    if (!template) {
        template = FOLLOWUP_TEMPLATES.find(t => t.id === 'followup_general')!;
    }

    const texto = template.mensaje(nombre, tratamiento) + `\n\n— ${clinicaNombre}`;

    const sent = await sendTextMessage(normalizePhone(phone), texto);
    if (sent) {
        logger.info(`[WORKFLOW] Follow-up 24h (${template.id}) enviado a ${nombre}`);
    }
    return sent;
}

// ═══════════════════════════════════════════════════════════════════
//  12. FASE 4 — Verificar consentimientos al llegar paciente
// ═══════════════════════════════════════════════════════════════════

import { getDocumentosByPaciente, type PatientDocument as DocType } from './documentos.service';

export interface PendingConsentCheck {
    totalNecesarios: number;
    firmados: number;
    pendientes: string[];            // Títulos de CI sin firmar
    todoFirmado: boolean;
}

/**
 * Comprueba qué consentimientos tiene firmados el paciente
 * y cuáles le faltan según el tratamiento de la cita.
 * Se usa cuando el paciente llega a recepción.
 */
export async function checkPendingConsents(
    numPac: string,
    tratamiento: string,
): Promise<PendingConsentCheck> {
    const ttoLower = tratamiento.toLowerCase();

    // Mapeo de keywords → CI necesarios
    const CONSENT_MAP: { keywords: string[]; titulo: string }[] = [
        { keywords: ['implante'], titulo: 'CI Implantología' },
        { keywords: ['extracción', 'exodoncia', 'cordal'], titulo: 'CI Extracción dental' },
        { keywords: ['endodoncia', 'endo'], titulo: 'CI Endodoncia' },
        { keywords: ['cirugía', 'colgajo', 'injerto', 'biopsia', 'frenectomía'], titulo: 'CI Cirugía oral' },
        { keywords: ['ortodoncia', 'brackets', 'invisalign'], titulo: 'CI Ortodoncia' },
        { keywords: ['blanqueamiento'], titulo: 'CI Blanqueamiento' },
        { keywords: ['prótesis', 'corona', 'puente', 'carilla'], titulo: 'CI Prótesis' },
        { keywords: ['sedación'], titulo: 'CI Sedación' },
        { keywords: ['raspado', 'curetaje', 'periodontal'], titulo: 'CI Periodoncia' },
        { keywords: ['radiografía', 'tac', 'cbct', 'rx'], titulo: 'CI Radiodiagnóstico' },
    ];

    // Detectar CI necesarios
    const necesarios: string[] = ['RGPD']; // Siempre
    for (const entry of CONSENT_MAP) {
        if (entry.keywords.some(kw => ttoLower.includes(kw))) {
            necesarios.push(entry.titulo);
        }
    }

    // Comprobar firmados
    const docs = await getDocumentosByPaciente(numPac);
    const firmados = new Set(
        docs.filter((d: DocType) => d.estado === 'Firmado').map((d: DocType) => d.titulo)
    );

    const pendientes = necesarios.filter(ci => !firmados.has(ci));

    return {
        totalNecesarios: necesarios.length,
        firmados: necesarios.length - pendientes.length,
        pendientes,
        todoFirmado: pendientes.length === 0,
    };
}

// ═══════════════════════════════════════════════════════════════════
//  13. FASE 6F — Envíos al paciente cuando Recepción finaliza la cita
// ═══════════════════════════════════════════════════════════════════

/** Estructura guardada en cita.notas.soapPostData por PostSOAPActions */
interface SoapPostData {
    instruccionesProxCita?: {
        tratamiento: string;
        duracionMin: number;
    };
    mensajesPostTto?: DetectedMessage[];
}

function parseSoapPostData(notas?: string): SoapPostData {
    try {
        const obj = JSON.parse(notas ?? '');
        return (obj.soapPostData as SoapPostData) ?? {};
    } catch {
        return {};
    }
}

/**
 * Se ejecuta cuando Recepción marca la cita como "finalizada".
 * Envía al paciente por WhatsApp:
 *  - Datos de la próxima cita reservada (si existe)
 *  - Instrucciones/consejos post-tratamiento (si el doctor las guardó)
 *  - Aviso para solicitar justificante de pago
 */
export async function onCitaFinalizada(
    cita: Cita,
    pacienteTelefono: string,
    pacienteNombre: string,
    clinicaNombre: string = 'SmilePro Studio',
): Promise<void> {
    if (!pacienteTelefono || !isEvolutionConfigured()) return;

    const soapData = parseSoapPostData(cita.notas);

    // Si no hay nada que enviar, salir sin ruido
    if (!soapData.mensajesPostTto?.length && !soapData.instruccionesProxCita) return;

    const parts: string[] = [];

    // 1. Próxima cita reservada (buscar la siguiente del paciente)
    try {
        const todasCitas = await getCitasByPaciente(cita.pacienteNumPac);
        const hoy = new Date().toISOString().slice(0, 10);
        const proxima = todasCitas
            .filter((c: Cita) => c.fecha && c.fecha > hoy && !['anulada', 'cancelada', 'fallada'].includes(c.estado))
            .sort((a: Cita, b: Cita) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))[0];

        if (proxima) {
            const fechaStr = new Date(proxima.fecha!).toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long',
            });
            parts.push(
                `📅 *Tu próxima cita*\n` +
                `${fechaStr} a las ${proxima.horaInicio} h\n` +
                `_${proxima.tratamiento}_`
            );
        }
    } catch { /* sin acceso a citas futuras */ }

    // 2. Instrucciones post-tratamiento
    if (soapData.mensajesPostTto?.length) {
        for (const msg of soapData.mensajesPostTto) {
            parts.push(msg.mensaje);
        }
    }

    // 3. Justificante de pago
    parts.push(`🧾 Puedes solicitar tu justificante de pago en ${clinicaNombre}.\n¡Gracias por tu confianza! 😊`);

    const nombre = pacienteNombre.split(' ')[0];
    const texto =
        `Hola ${nombre} 👋\n\n` +
        parts.join('\n\n──────────────\n\n') +
        `\n\n— ${clinicaNombre}`;

    const sent = await sendTextMessage(normalizePhone(pacienteTelefono), texto);
    if (sent) {
        logger.info(`[WORKFLOW] Mensaje post-finalización enviado a ${pacienteTelefono}`);
    }
}
