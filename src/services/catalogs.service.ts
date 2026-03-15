const API_URL = ((import.meta as any).env?.VITE_API_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? 'http://localhost:3000') as string;

export const getSpecialties = async () => {
    try {
        const res = await fetch(`${API_URL}/api/catalogs/specialties`);
        if (!res.ok) throw new Error('Network response was not ok');
        const json = await res.json();
        return json.data;
    } catch (error) {
        console.error('Error fetching specialties:', error);
        return [
            { IdEspec: 1, Especialidad: 'Odontología General' },
            { IdEspec: 2, Especialidad: 'Ortodoncia' },
            { IdEspec: 3, Especialidad: 'Implantología' }
        ];
    }
};

export const getTaxes = async () => {
    try {
        const res = await fetch(`${API_URL}/api/catalogs/taxes`);
        if (!res.ok) throw new Error('Network response was not ok');
        const json = await res.json();
        return json.data;
    } catch (error) {
        console.error('Error fetching taxes:', error);
        return [
            { IdTipoIVA: 1, label: 'Exento (0%)', PjeIVA: 0 },
            { IdTipoIVA: 2, label: 'General (21%)', PjeIVA: 21 },
            { IdTipoIVA: 3, label: 'Reducido (10%)', PjeIVA: 10 }
        ];
    }
};
