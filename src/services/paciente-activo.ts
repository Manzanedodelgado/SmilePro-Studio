// Mini-store para compartir el paciente activo entre módulos
// sin necesidad de prop drilling por App.tsx.
// Pacientes.tsx escribe → DocumentosClinica.tsx lee.

export interface PacienteActivoBasico {
    nombre?: string;
    apellidos?: string;
    dni?: string;
    telefono?: string;
    fechaNacimiento?: string;
    doctor?: string;
}

let _pacienteActivo: PacienteActivoBasico | null = null;

export const setPacienteActivo = (p: PacienteActivoBasico | null): void => {
    _pacienteActivo = p;
};

export const getPacienteActivo = (): PacienteActivoBasico | null => _pacienteActivo;
