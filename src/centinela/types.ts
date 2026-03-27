/**
 * centinela/types.ts — Tipos del motor de monitorización Centinela
 * Migrado desde SmileStudio/src/centinela/types.ts
 */

export type Severity = 'critical' | 'error' | 'warning' | 'info';

export type CentinelaModule =
    | 'Agenda' | 'Pacientes' | 'SOAPEditor' | 'Odontograma'
    | 'Whatsapp' | 'IA' | 'Inventario' | 'Gestoría'
    | 'Radiología' | 'Auth' | 'Backend' | 'Unknown';

export interface CentinelaError {
    id:          string;
    fingerprint: string;
    message:     string;
    stack?:      string;
    url?:        string;
    module:      CentinelaModule;
    severity:    Severity;
    count:       number;           // veces que se ha visto este error
    firstSeen:   string;           // ISO
    lastSeen:    string;           // ISO
    resolved:    boolean;
    tags:        string[];
    userAgent?:  string;
    extra?:      Record<string, unknown>;
}

export interface UptimeRecord {
    module:    CentinelaModule;
    checks:    number;
    failures:  number;
    lastCheck: string;
}

export interface CentinelaState {
    errors:  CentinelaError[];
    uptime:  UptimeRecord[];
}
