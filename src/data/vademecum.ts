// src/data/vademecum.ts
// Catálogo básico de medicamentos de uso habitual en clínica dental.
// Se utiliza para el autocompletado del perfil de medicación del paciente.

export interface Medicamento {
    nombre: string;
    categoria: string;
    importante: boolean;
    nota?: string;
}

const VADEMECUM: Medicamento[] = [
    // Anticoagulantes / Antiagregantes
    { nombre: 'Acenocumarol (Sintrom)', categoria: 'Anticoagulante', importante: true, nota: 'Controlar INR antes de cirugía' },
    { nombre: 'Warfarina', categoria: 'Anticoagulante', importante: true, nota: 'Controlar INR antes de cirugía' },
    { nombre: 'Apixabán (Eliquis)', categoria: 'Anticoagulante NACO', importante: true, nota: 'No requiere monitorización; suspender si se indica' },
    { nombre: 'Rivaroxabán (Xarelto)', categoria: 'Anticoagulante NACO', importante: true },
    { nombre: 'Dabigatrán (Pradaxa)', categoria: 'Anticoagulante NACO', importante: true },
    { nombre: 'Ácido acetilsalicílico (Aspirina)', categoria: 'Antiagregante', importante: true, nota: 'No suspender sin autorización médica' },
    { nombre: 'Clopidogrel (Plavix)', categoria: 'Antiagregante', importante: true },
    { nombre: 'Ticagrelor (Brilique)', categoria: 'Antiagregante', importante: true },

    // Bisfosfonatos — riesgo de ONM
    { nombre: 'Alendronato (Fosamax)', categoria: 'Bisfosfonato', importante: true, nota: '⚠️ Riesgo de Osteonecrosis de Mandíbula (ONM)' },
    { nombre: 'Risedronato', categoria: 'Bisfosfonato', importante: true, nota: '⚠️ Riesgo ONM' },
    { nombre: 'Ibandronato (Bonviva)', categoria: 'Bisfosfonato', importante: true, nota: '⚠️ Riesgo ONM' },
    { nombre: 'Zoledronato (Zometa)', categoria: 'Bisfosfonato IV', importante: true, nota: '⚠️ Alto riesgo ONM — IV oncológico' },
    { nombre: 'Denosumab (Prolia)', categoria: 'Antirresortivo', importante: true, nota: '⚠️ Riesgo ONM similar a bisfosfonatos' },

    // Corticoides
    { nombre: 'Prednisona', categoria: 'Corticoide', importante: true, nota: 'Inmunosupresor — valorar profilaxis antibiótica' },
    { nombre: 'Dexametasona', categoria: 'Corticoide', importante: false },
    { nombre: 'Metilprednisolona (Urbason)', categoria: 'Corticoide', importante: true },

    // Inmunosupresores / Oncología
    { nombre: 'Metotrexato', categoria: 'Inmunosupresor', importante: true, nota: 'Riesgo infeccioso elevado' },
    { nombre: 'Azatioprina', categoria: 'Inmunosupresor', importante: true },
    { nombre: 'Ciclosporina', categoria: 'Inmunosupresor', importante: true, nota: 'Puede causar hiperplasia gingival' },
    { nombre: 'Tacrolimus', categoria: 'Inmunosupresor', importante: true },

    // Antihipertensivos
    { nombre: 'Amlodipino', categoria: 'Antihipertensivo', importante: false, nota: 'BCC — puede causar hiperplasia gingival' },
    { nombre: 'Nifedipino', categoria: 'Antihipertensivo', importante: false, nota: 'BCC — puede causar hiperplasia gingival' },
    { nombre: 'Enalapril', categoria: 'IECA', importante: false },
    { nombre: 'Ramipril', categoria: 'IECA', importante: false },
    { nombre: 'Lisinopril', categoria: 'IECA', importante: false },
    { nombre: 'Losartán', categoria: 'ARA-II', importante: false },
    { nombre: 'Valsartán', categoria: 'ARA-II', importante: false },
    { nombre: 'Atenolol', categoria: 'Betabloqueante', importante: false },
    { nombre: 'Bisoprolol', categoria: 'Betabloqueante', importante: false },
    { nombre: 'Metoprolol', categoria: 'Betabloqueante', importante: false },
    { nombre: 'Furosemida', categoria: 'Diurético', importante: false },
    { nombre: 'Hidroclorotiazida', categoria: 'Diurético', importante: false },

    // Hipoglucemiantes
    { nombre: 'Metformina', categoria: 'Hipoglucemiante', importante: false, nota: 'Diabetes tipo 2 — riesgo en ayuno prolongado' },
    { nombre: 'Insulina (varias)', categoria: 'Insulina', importante: true, nota: 'Control glucémico preprocedimiento' },
    { nombre: 'Sitagliptina (Januvia)', categoria: 'Hipoglucemiante', importante: false },
    { nombre: 'Empagliflozina (Jardiance)', categoria: 'SGLT-2', importante: false },

    // AINES / Analgésicos
    { nombre: 'Ibuprofeno', categoria: 'AINE', importante: false },
    { nombre: 'Naproxeno', categoria: 'AINE', importante: false },
    { nombre: 'Diclofenaco', categoria: 'AINE', importante: false },
    { nombre: 'Paracetamol', categoria: 'Analgésico', importante: false },
    { nombre: 'Tramadol', categoria: 'Opioide suave', importante: false },
    { nombre: 'Metamizol (Nolotil)', categoria: 'Analgésico', importante: false },

    // Antibióticos
    { nombre: 'Amoxicilina', categoria: 'Antibiótico', importante: false },
    { nombre: 'Amoxicilina + Clavulánico', categoria: 'Antibiótico', importante: false },
    { nombre: 'Azitromicina', categoria: 'Antibiótico', importante: false },
    { nombre: 'Clindamicina', categoria: 'Antibiótico', importante: false },
    { nombre: 'Metronidazol', categoria: 'Antibiótico', importante: false },
    { nombre: 'Doxiciclina', categoria: 'Antibiótico', importante: false },

    // Anticolinérgicos / Psicotrópicos
    { nombre: 'Omeprazol', categoria: 'IBP', importante: false },
    { nombre: 'Pantoprazol', categoria: 'IBP', importante: false },
    { nombre: 'Levotiroxina', categoria: 'Hormona tiroidea', importante: false },
    { nombre: 'Atorvastatina', categoria: 'Estatina', importante: false },
    { nombre: 'Simvastatina', categoria: 'Estatina', importante: false },
    { nombre: 'Lorazepam', categoria: 'Benzodiacepina', importante: false },
    { nombre: 'Diazepam', categoria: 'Benzodiacepina', importante: false },
    { nombre: 'Alprazolam', categoria: 'Benzodiacepina', importante: false },
    { nombre: 'Sertralina', categoria: 'ISRS', importante: false },
    { nombre: 'Fluoxetina', categoria: 'ISRS', importante: false },
    { nombre: 'Escitalopram', categoria: 'ISRS', importante: false },
    { nombre: 'Venlafaxina', categoria: 'IRSN', importante: false },
];

/**
 * Busca medicamentos en el vademecum local.
 * @param query Texto de búsqueda. Si está vacío devuelve todos.
 * @param limit Número máximo de resultados (default 15).
 */
export const searchVademecum = (query: string, limit = 15): Medicamento[] => {
    if (!query.trim()) return VADEMECUM.slice(0, limit);
    const q = query.toLowerCase().trim();
    return VADEMECUM.filter(m =>
        m.nombre.toLowerCase().includes(q) ||
        m.categoria.toLowerCase().includes(q)
    ).slice(0, limit);
};

export default VADEMECUM;
