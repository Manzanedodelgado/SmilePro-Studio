import React, { useState, useRef, useEffect } from 'react';
import { getPacienteActivo } from '../../services/paciente-activo';
import { FileText, Printer, Download, Search, ChevronRight, X, Edit3, Clipboard, Shield, Receipt, Heart } from 'lucide-react';

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type DocCat = 'consentimiento' | 'cuestionario' | 'presupuesto' | 'instrucciones' | 'lopd' | 'interno';
interface DocTemplate { id: string; title: string; cat: DocCat; tags: string[]; content: string; vars: string[] }

// ─── Catálogo de documentos ────────────────────────────────────────────────────
const DOCS: DocTemplate[] = [
    // ── CONSENTIMIENTOS ──
    {
        id: 'ci-implante', title: 'Consentimiento Implante Dental', cat: 'consentimiento',
        tags: ['implante', 'cirugía', 'CI'],
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{doctor}}', '{{posicion}}', '{{telefono}}'],
        content: `CONSENTIMIENTO INFORMADO — IMPLANTE DENTAL
Rubio García Dental · CIF: B-00000000

Paciente: {{nombre}}  DNI: {{dni}}  Fecha: {{fecha}}
Médico responsable: Dr./Dra. {{doctor}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESCRIPCIÓN DEL PROCEDIMIENTO
Se colocará un implante de titanio en la posición {{posicion}} para reponer la pieza ausente.
El proceso consta de: cirugía de colocación → periodo de osteointegración (3-6 meses) → fase protésica.

BENEFICIOS
• Rehabilitación funcional y estética fija
• Preservación del hueso alveolar
• Sin desgaste de dientes adyacentes
• Resultado con apariencia natural

RIESGOS Y COMPLICACIONES
• Infección postoperatoria
• Fracaso de osteointegración (3-5% casos)
• Lesión de nervio o vasos próximos (transitoria o permanente)
• Sinusitis maxilar (implantes superiores posteriores)
• Pérdida tardía por periimplantitis

ALTERNATIVAS
• Prótesis parcial removible
• Puente fijo sobre dientes naturales
• No tratamiento (con riesgo de pérdida ósea progresiva)

CUIDADOS POSTOPERATORIOS
Ver documento "Instrucciones Post-Quirúrgicas" adjunto.
En caso de urgencia: {{telefono}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El/La abajo firmante declara haber sido informado/a de forma comprensible sobre el procedimiento descrito, sus riesgos, beneficios y alternativas, y OTORGA SU CONSENTIMIENTO para su realización.

Firma del paciente: _______________________

Fecha: {{fecha}}

Firma del profesional: _______________________`
    },
    {
        id: 'ci-extraccion', title: 'Consentimiento Extracción Dental', cat: 'consentimiento',
        tags: ['extracción', 'CI', 'exodoncia'],
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{pieza}}', '{{doctor}}'],
        content: `CONSENTIMIENTO INFORMADO — EXTRACCIÓN DENTAL
Rubio García Dental

Paciente: {{nombre}}  DNI: {{dni}}  Fecha: {{fecha}}
Médico: Dr./Dra. {{doctor}}

PROCEDIMIENTO: Extracción de pieza dental {{pieza}}

INDICACIÓN: Pieza no restaurable / foco infeccioso / indicación ortodóncica

RIESGOS
• Sangrado post-extracción (normal las primeras horas)
• Alveolitis seca (5% casos, mayor riesgo en fumadores)
• Comunicación orosinusal (zona posterior superior)
• Parestesia transitoria del nervio dentario
• Infección del alveolo

ALTERNATIVAS: Endodoncia + restauración (si la pieza lo permite)

CUIDADOS: Morder gasa 30 min · No enjuagar 24h · Ibuprofeno 600mg si dolor · Dieta blanda y fría

He sido informado/a y CONSIENTO la extracción.

Firma paciente: _______________________  Fecha: {{fecha}}`
    },
    {
        id: 'ci-endodoncia', title: 'Consentimiento Endodoncia', cat: 'consentimiento',
        tags: ['endodoncia', 'CI', 'nervio'],
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{pieza}}', '{{doctor}}'],
        content: `CONSENTIMIENTO INFORMADO — TRATAMIENTO ENDODÓNTICO
Rubio García Dental

Paciente: {{nombre}}  DNI: {{dni}}  Fecha: {{fecha}}  Pieza: {{pieza}}

DESCRIPCIÓN: Extirpación de la pulpa dental enferma, limpieza, conformación y obturación de los conductos radiculares.

RIESGOS
• Fractura de instrumento en conducto (se intentará recuperar o se derivará)
• Perforación radicular
• Fractura radicular tardía
• Persistencia de la infección → retratamiento o extracción
• Molestia post-tratamiento (normal 2-5 días)

ALTERNATIVAS: Extracción dental

IMPORTANTE: Tras la endodoncia se recomienda corona para proteger la pieza.

He sido informado/a y CONSIENTO el tratamiento.

Firma: _______________________  Fecha: {{fecha}}`
    },
    {
        id: 'ci-ortodoncia', title: 'Consentimiento Ortodoncia', cat: 'consentimiento',
        tags: ['ortodoncia', 'brackets', 'alineadores', 'CI'],
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{tipo_ortodoncia}}', '{{duracion}}', '{{revision}}', '{{doctor}}'],
        content: `CONSENTIMIENTO INFORMADO — TRATAMIENTO ORTODÓNCICO
Rubio García Dental

Paciente (o tutor legal): {{nombre}}  DNI: {{dni}}  Fecha: {{fecha}}
Tratamiento: {{tipo_ortodoncia}}  Duración estimada: {{duracion}}
Revisiones cada: {{revision}} semanas  Dr./Dra.: {{doctor}}

RIESGOS
• Descalcificación y caries si la higiene es deficiente
• Reabsorción radicular leve
• Molestias los primeros días y tras ajustes
• Recidiva si no se usa el retenedor post-tratamiento

COMPROMISOS DEL PACIENTE
✓ Mantener higiene bucal exhaustiva
✓ Acudir a todas las revisiones pactadas
✓ Usar el retenedor de forma indefinida tras el tratamiento
✓ Evitar alimentos duros, pegajosos o fibrosos (ortodoncia fija)

He sido informado/a y CONSIENTO el tratamiento.

Firma: _______________________  Fecha: {{fecha}}  Tutor (si menor): _______________________`
    },
    {
        id: 'ci-blanqueamiento', title: 'Consentimiento Blanqueamiento', cat: 'consentimiento',
        tags: ['blanqueamiento', 'estética', 'CI'],
        vars: ['{{nombre}}', '{{fecha}}', '{{concentracion}}', '{{sesiones}}'],
        content: `CONSENTIMIENTO INFORMADO — BLANQUEAMIENTO DENTAL
Rubio García Dental

Paciente: {{nombre}}  Fecha: {{fecha}}
Producto: Peróxido de hidrógeno {{concentracion}}%  Sesiones: {{sesiones}}

EFECTOS SECUNDARIOS
• Sensibilidad dental temporal (días/semanas)
• Irritación gingival transitoria
• Las restauraciones (coronas, carillas, composite) NO cambian de color

CONTRAINDICACIONES: Embarazo, lactancia, alergia al peróxido, hipersensibilidad severa, pacientes menores sin autorización del tutor.

RESULTADOS: Variables según el color base. No garantizamos un tono específico.

He sido informado/a y CONSIENTO el tratamiento.

Firma: _______________________  Fecha: {{fecha}}`
    },
    {
        id: 'ci-periodoncia', title: 'Consentimiento Periodoncia / RAR', cat: 'consentimiento',
        tags: ['periodoncia', 'RAR', 'encías', 'CI'],
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{doctor}}'],
        content: `CONSENTIMIENTO INFORMADO — TRATAMIENTO PERIODONTAL
Rubio García Dental

Paciente: {{nombre}}  DNI: {{dni}}  Fecha: {{fecha}}

PROCEDIMIENTO: Raspado y alisado radicular (RAR) con/sin anestesia local en los cuadrantes necesarios.

OBJETIVO: Eliminar el cálculo subgingival y el biofilm bacteriano para detener la progresión de la enfermedad periodontal.

RIESGOS
• Sensibilidad dental post-tratamiento (semanas)
• Recesión gingival aparente (encía inflamada se retrae al sanar)
• Puede requerirse cirugía periodontal si la respuesta es insuficiente

MANTENIMIENTO: Control periodontal semestral de por vida para evitar la recidiva.

He sido informado/a y CONSIENTO el tratamiento.

Firma: _______________________  Fecha: {{fecha}}`
    },
    // ── CUESTIONARIOS ──
    {
        id: 'quest-anamnesis', title: 'Anamnesis — Primera Visita', cat: 'cuestionario',
        tags: ['primera visita', 'historia clínica', 'anamnesis'],
        vars: [],
        content: `CUESTIONARIO DE SALUD — PRIMERA VISITA
Rubio García Dental

DATOS PERSONALES
Nombre y apellidos: ___________________________________
Fecha de nacimiento: ________________  DNI: ________________
Teléfono: ________________  Email: ________________________________
Dirección: ___________________________________
Médico de cabecera: ___________________________________

¿CÓMO NOS CONOCIÓ?
□ Google  □ Redes sociales  □ Familiar/amigo  □ Ya era paciente  □ Otro: _______

━━━━━━━━━━━━━━━━━━━━━━━

SALUD GENERAL
¿Está actualmente en tratamiento médico?  □ No  □ Sí → ________________________
¿Toma medicación habitual?  □ No  □ Sí → ¿Cuál/es? ________________________
¿Es alérgico/a a algún medicamento o material?  □ No  □ Sí → ________________________
¿Ha tenido reacciones a la anestesia local?  □ No  □ Sí → ________________________

ENFERMEDADES (marque las que correspondan)
□ Diabetes  □ Hipertensión  □ Cardiopatía / Marcapasos
□ Anticoagulantes (Sintrom, Adiro, Eliquis…)
□ Osteoporosis / Bifosfonatos (Fosamax, Prolia…)
□ Hepatitis B/C  □ VIH  □ Tuberculosis
□ Cáncer (activo o en remisión): ________________________
□ Enfermedades autoinmunes: ________________________
□ Embarazo (semanas: ___)  □ Lactancia

HÁBITOS
□ Fumador/a (cigarrillos/día: ___)  □ Exfumador  □ No fumador
□ Bruxismo / apriete  □ Respiración bucal  □ Ronquidos / apnea

━━━━━━━━━━━━━━━━━━━━━━━

SALUD DENTAL
¿Cuándo fue su última visita al dentista? ________________________
¿Ha tenido tratamientos previos? □ Empastes  □ Endodoncias  □ Implantes  □ Ortodoncia  □ Prótesis
¿Motivo de consulta hoy? ___________________________________

DOLOR ACTUAL (0-10): ___  Localización: ________________________

━━━━━━━━━━━━━━━━━━━━━━━

AUTORIZO el tratamiento de mis datos conforme a la política de privacidad de Rubio García Dental (LOPD/RGPD).

Firma: _______________________  Fecha: _________________`
    },
    {
        id: 'quest-pediatrico', title: 'Cuestionario Pediátrico (hasta 14 años)', cat: 'cuestionario',
        tags: ['niño', 'pediátrico', 'tutor'],
        vars: [],
        content: `CUESTIONARIO PEDIÁTRICO — RUBIO GARCÍA DENTAL

DATOS DEL MENOR
Nombre: ___________________________________  Fecha de nacimiento: ________________
Nombre del padre/madre/tutor: ___________________________________
Teléfono de contacto: ________________  Relación: ________________

SALUD GENERAL DEL MENOR
¿Padece alguna enfermedad crónica? □ No  □ Sí → ________________________
¿Toma medicación? □ No  □ Sí → ________________________
¿Tiene alergias? □ No  □ Sí → ________________________
¿Ha tenido reacciones con anestesias previas? □ No  □ Sí → ________________________
¿Ha sido operado/a anteriormente? □ No  □ Sí → ________________________

SALUD DENTAL
¿Utiliza chupete actualmente? □ No  □ Sí (edad inicio: ___)
¿Se chupa el dedo? □ No  □ Sí
¿Bebe biberón de noche? □ No  □ Sí
¿Come muchos dulces/bebidas azucaradas? □ Poco  □ Moderado  □ Mucho
¿Cepilla los dientes? □ Solo  □ Con ayuda adulto  □ Frecuencia: ___/día
¿Usa pasta fluorada? □ Sí  □ No

Última visita al dentista: ________________
Tratamientos previos: □ Selladores  □ Empastes  □ Extracciones  □ Ortodoncia  □ Ninguno
Motivo de consulta: ___________________________________

El tutor/a firmante AUTORIZA el tratamiento odontológico y el tratamiento de datos del menor:

Firma tutor: _______________________  DNI: ________________  Fecha: ________________`
    },
    {
        id: 'quest-satisfaccion', title: 'Encuesta de Satisfacción Post-Visita', cat: 'cuestionario',
        tags: ['satisfacción', 'encuesta', 'NPS'],
        vars: ['{{nombre}}', '{{fecha}}', '{{doctor}}', '{{tratamiento}}'],
        content: `ENCUESTA DE SATISFACCIÓN
Rubio García Dental

Paciente: {{nombre}}  |  Fecha de visita: {{fecha}}
Tratamiento: {{tratamiento}}  |  Dr./Dra.: {{doctor}}

━━━━━━━━━━━━━━━━━━━━━━━

1. EXPERIENCIA GENERAL (1 = muy mala · 5 = excelente)
   □ 1  □ 2  □ 3  □ 4  □ 5

2. TIEMPO DE ESPERA
   □ Ninguno  □ Menos de 10 min  □ 10-20 min  □ Más de 20 min (motivo: _______)

3. ATENCIÓN RECEPCIÓN
   □ Excelente  □ Buena  □ Mejorable  □ Deficiente

4. ATENCIÓN CLÍNICA (explicación del tratamiento, amabilidad)
   □ Excelente  □ Buena  □ Mejorable  □ Deficiente

5. INSTALACIONES (limpieza, confort, equipamiento)
   □ Excelente  □ Buenas  □ Mejorables  □ Deficientes

6. RESULTADO CLÍNICO
   □ Muy satisfecho/a  □ Satisfecho/a  □ Poco satisfecho/a  □ No satisfecho/a

7. ¿RECOMENDARÍAS RUBIO GARCÍA DENTAL? (NPS 0-10)
   0  1  2  3  4  5  6  7  8  9  10

8. COMENTARIOS Y SUGERENCIAS:
   _____________________________________________
   _____________________________________________

Gracias por tu tiempo. Tu opinión nos ayuda a mejorar cada día.`
    },
    {
        id: 'quest-dolor', title: 'Cuestionario de Dolor y Urgencias', cat: 'cuestionario',
        tags: ['dolor', 'urgencia', 'EVA'],
        vars: ['{{nombre}}', '{{fecha}}'],
        content: `CUESTIONARIO DE DOLOR / URGENCIA
Rubio García Dental  — {{nombre}}  Fecha: {{fecha}}

1. LOCALIZACIÓN DEL DOLOR (marque en el diagrama o describa):
   Superior derecho □  Superior izquierdo □  Inferior derecho □  Inferior izquierdo □
   Toda la boca □  Cara/mandíbula □  Otro: _______

2. INTENSIDAD (Escala Visual Analógica):
   Sin dolor  [0]—[1]—[2]—[3]—[4]—[5]—[6]—[7]—[8]—[9]—[10]  Insoportable
   Valor actual: ___

3. TIPO DE DOLOR:
   □ Pulsátil (latidos)  □ Continuo  □ Al morder  □ Al frío  □ Al calor  □ Espontáneo  □ Al tacto

4. INICIO: □ Hoy  □ Ayer  □ Hace ___días  □ Hace semanas  — ¿Qué lo desencadenó? _______

5. ALIVIA CON: □ Ibuprofeno  □ Paracetamol  □ Frío  □ Calor  □ Nada lo alivia

6. ¿TIENE HINCHAZÓN O FIEBRE?  □ No  □ Sí — Temperatura: ___°C

7. ¿HA HABIDO TRAUMATISMO PREVIO?  □ No  □ Sí → ________________________

8. ¿TOMA ANTICOAGULANTES O ANTIAGREGANTES?  □ No  □ Sí → ________________________

Firma: _______________________  Fecha: {{fecha}}`
    },
    {
        id: 'quest-bruxismo', title: 'Cuestionario Bruxismo / ATM', cat: 'cuestionario',
        tags: ['bruxismo', 'ATM', 'férula', 'rechinado'],
        vars: ['{{nombre}}', '{{fecha}}'],
        content: `CUESTIONARIO BRUXISMO Y TRASTORNOS DE ATM
Rubio García Dental — {{nombre}}  Fecha: {{fecha}}

SÍNTOMAS (marque lo que le ocurre)
□ Rechino los dientes durante el sueño (me lo han dicho)
□ Aprieto los dientes durante el día
□ Me despierto con dolor de mandíbula o cabeza
□ Oigo "clic" o "crac" al abrir/cerrar la boca
□ Tengo limitación para abrir la boca ampliamente
□ Dolor en los músculos de la masticación (mejillas, sienes)
□ Desgaste visible en las puntas de los dientes
□ Sensibilidad generalizada en varios dientes sin causa aparente
□ Descascarillado o fractura de dientes o restauraciones frecuente

FACTORES ASOCIADOS
□ Alto nivel de estrés o ansiedad
□ Trabajo con pantalla prolongado
□ Dormo mal con frecuencia
□ Consumo de cafeína (>3 al día): ___  □ Tabaco  □ Alcohol

¿LLEVA ACTUALMENTE FÉRULA OCLUSAL?  □ No  □ Sí → ¿Cuándo la usa? _______
¿Le han diagnosticado antes?  □ No  □ Sí → ¿Tratamiento? _______

DOLOR ATM ACTUAL (EVA 0-10): ___

Firma: _______________________  Fecha: {{fecha}}`
    },
    {
        id: 'quest-estetica', title: 'Cuestionario Estética Dental / Smile Design', cat: 'cuestionario',
        tags: ['estética', 'smile design', 'carillas', 'expectativas'],
        vars: ['{{nombre}}', '{{fecha}}'],
        content: `CUESTIONARIO ESTÉTICA DENTAL — SMILE DESIGN
Rubio García Dental — {{nombre}}  Fecha: {{fecha}}

¿QUÉ ASPECTOS DE SU SONRISA LE GUSTARÍA MEJORAR?
□ Color (blanqueamiento)     □ Forma de los dientes     □ Tamaño de los dientes
□ Espacios / diastemas       □ Dientes chuecos          □ Encías que se ven mucho
□ Dientes rotos o desgastados □ Otro: _______

¿TIENE REFERENCIAS DE CÓMO LE GUSTARÍA QUE QUEDARA?
□ No tengo idea, me FÍO del profesional
□ Sí — Descripción / foto aportada: _______

EXPECTATIVAS (1=bajo, 5=muy alto): ___

¿HA TENIDO TRATAMIENTOS ESTÉTICOS ANTES?
□ No  □ Sí → ¿Cuál? _______  ¿Quedó satisfecho/a? □ Sí  □ No  Motivo: _______

¿ACTIVIDAD ORAL ESPECIAL?
□ Instrumento musical de viento  □ Cantante/actor  □ Deporte de contacto
□ Trabajo con exposición pública frecuente

PRESUPUESTO APROXIMADO DISPONIBLE:
□ <1.000€  □ 1.000-3.000€  □ 3.000-6.000€  □ Sin límite definido

¿TIENE FECHA LÍMITE PARA EL TRATAMIENTO?
□ No  □ Sí → Fecha deseada: _______  Motivo: _______

Firma: _______________________  Fecha: {{fecha}}`
    },
    // ── PRESUPUESTOS ──
    {
        id: 'presupuesto-implante', title: 'Presupuesto Implante + Prótesis', cat: 'presupuesto',
        tags: ['presupuesto', 'implante', 'prótesis'],
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{doctor}}', '{{posicion}}', '{{marca_implante}}', '{{precio_implante}}', '{{precio_corona}}', '{{total}}', '{{forma_pago}}'],
        content: `PRESUPUESTO ACEPTADO — IMPLANTE DENTAL
Rubio García Dental · CIF: B-00000000
C/ Ejemplo 123 · Madrid · Tel: 912 345 678

Paciente: {{nombre}}  DNI: {{dni}}  Fecha: {{fecha}}
Dr./Dra.: {{doctor}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONCEPTO                                          PRECIO
─────────────────────────────────────────────────
Implante {{marca_implante}} pieza {{posicion}}    {{precio_implante}} €
Cirugía de colocación + anestesia                 Incluida
Corona de porcelana/zirconio                      {{precio_corona}} €
Pilar protésico + tornillo                        Incluido
Revisiones post-implante (12 meses)               Incluido
─────────────────────────────────────────────────
TOTAL (IVA incluido)                              {{total}} €

FORMA DE PAGO ACORDADA: {{forma_pago}}

VALIDEZ DEL PRESUPUESTO: 60 días desde la fecha de emisión.
GARANTÍA: 5 años en el implante · 2 años en la prótesis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El paciente acepta el presupuesto y las condiciones de tratamiento.

Firma paciente: _______________________  Fecha: {{fecha}}
Firma profesional: _______________________`
    },
    {
        id: 'presupuesto-ortodoncia', title: 'Presupuesto Ortodoncia', cat: 'presupuesto',
        tags: ['presupuesto', 'ortodoncia', 'brackets', 'alineadores'],
        vars: ['{{nombre}}', '{{fecha}}', '{{doctor}}', '{{tipo_ortodoncia}}', '{{duracion}}', '{{total}}', '{{entrada}}', '{{cuota}}', '{{meses}}'],
        content: `PRESUPUESTO ACEPTADO — ORTODONCIA
Rubio García Dental

Paciente: {{nombre}}  Fecha: {{fecha}}  Dr./Dra.: {{doctor}}

Modalidad: {{tipo_ortodoncia}}
Duración estimada: {{duracion}}

CONCEPTO                                          PRECIO
─────────────────────────────────────────────────
Estudio ortodóncico + planificación digital       Incluido
Aparatología + colocación                         Incluido
Visitas de seguimiento cada 4-8 semanas           Incluido
Retenedor superior + inferior (al finalizar)      Incluido
─────────────────────────────────────────────────
TOTAL TRATAMIENTO                                 {{total}} €

FINANCIACIÓN APROBADA:
Entrada inicial: {{entrada}} €
+ {{meses}} cuotas de {{cuota}} €/mes (sin intereses)

Firma paciente: _______________________  Fecha: {{fecha}}`
    },
    // ── INSTRUCCIONES ──
    {
        id: 'inst-postop-general', title: 'Instrucciones Post-Operatorias (General)', cat: 'instrucciones',
        tags: ['postoperatorio', 'instrucciones', 'cuidados'],
        vars: ['{{nombre}}', '{{fecha}}', '{{tratamiento}}', '{{medicacion}}', '{{telefono}}'],
        content: `INSTRUCCIONES POST-OPERATORIAS
Rubio García Dental · Tel urgencias: {{telefono}}

Paciente: {{nombre}}  Fecha intervención: {{fecha}}
Procedimiento: {{tratamiento}}

✅ LO QUE DEBE HACER
• Morder la gasa indicada durante 30-45 minutos
• Aplicar frío externo las primeras 6 horas (20 min ON / 20 min OFF)
• Reposo el día de la intervención — actividad ligera los 2 días siguientes
• Dieta blanda y fría las primeras 24-48 h (yogur, puré, batidos fríos)
• Tomar la medicación prescrita: {{medicacion}}
• Cepillar con suavidad, evitando la zona operada
• Enjuagar suavemente con clorhexidina 0,12% desde el DÍA 2

❌ LO QUE DEBE EVITAR
• Enjuagarse vigorosamente las primeras 24 h
• Fumar o consumir alcohol durante al menos 72 h
• Actividad física intensa durante 48-72 h
• Aspirar con pajita o hacer maniobras de succión
• Alimentos duros, calientes o picantes
• Tocar la herida con la lengua o los dedos

🚨 LLAME AL {{telefono}} SI PRESENTA
• Sangrado abundante que no cede tras 30 min de presión
• Fiebre superior a 38 °C
• Dolor muy intenso que no mejora con la medicación
• Hinchazón que AUMENTA (no disminuye) a partir del 3er día
• Sensación de mal sabor u olor intenso persistente`
    },
    {
        id: 'inst-blanqueamiento', title: 'Instrucciones Blanqueamiento', cat: 'instrucciones',
        tags: ['blanqueamiento', 'instrucciones', 'cuidados'],
        vars: ['{{nombre}}', '{{fecha}}'],
        content: `INSTRUCCIONES BLANQUEAMIENTO DENTAL
Rubio García Dental — {{nombre}}  Fecha: {{fecha}}

DURANTE EL TRATAMIENTO
• Aplique el gel SOLO en las cubetas durante el tiempo indicado (máx. 2 h si es domiciliario)
• No ingerir comida, bebida ni fumar durante la aplicación
• Enjuague bien la boca al finalizar y aclare las cubetas con agua fría

LOS 5 DÍAS SIGUIENTES (dieta blanca)
EVITAR: café, té, vino tinto, refrescos de cola, salsas de color (soja, tomate, curry), frutos del bosque, tabaco, clorhexidina coloreada.
PERMITIDO: pollo, pescado, arroz, pasta sin salsa roja, leche, queso blanco, agua, manzana.

SENSIBILIDAD: es NORMAL y desaparece 2-5 días tras el tratamiento.
→ Use pasta dental para dientes sensibles (Sensodyne, Colgate Sensitive Pro-Alivio)
→ Si es intensa: aplique gel de flúor en las cubetas 20 min

MANTENIMIENTO: toque-up 1-2 noches cada 6-12 meses para mantener el resultado.

IMPORTANTE: Las restauraciones (empastes, coronas, carillas) NO se aclaran.`
    },
    {
        id: 'inst-ortodoncia', title: 'Instrucciones Ortodoncia Fija', cat: 'instrucciones',
        tags: ['ortodoncia', 'brackets', 'instrucciones', 'higiene'],
        vars: ['{{nombre}}', '{{fecha}}'],
        content: `INSTRUCCIONES DE HIGIENE — ORTODONCIA FIJA
Rubio García Dental — {{nombre}}  Fecha colocación: {{fecha}}

HIGIENE OBLIGATORIA (3 veces al día mínimo)
1. Cepillo ORTODÓNCICO en ángulo de 45° sobre los brackets
2. Cepillo INTERPROXIMAL entre áreas y por debajo del arco
3. Seda dental con enhebrador interdental
4. Enjuague con flúor ANTES de dormir

ALIMENTOS PROHIBIDOS
× Duros: frutos secos enteros, palomitas, corteza de pan, huesos
× Pegajosos: caramelos, chicle, toffee, gominolas
× Fibrosos: masticar carne directamente (córtela pequeña)
× Mordiscos: manzana, zanahoria, baguette (córtelos primero)

MOLESTIAS INICIALES
Los primeros días son normales: Ibuprofeno 400mg si hay dolor. Dieta blanda. Si un bracket se suelta o el arco pincha: llámenos.

EMERGENCIAS: {{telefono}} — No use cera de ortodoncia indefinidamente, avísenos.`
    },
    // ── LOPD / LEGAL ──
    {
        id: 'lopd-contrato', title: 'Claúsula LOPD / RGPD — Consentimiento Datos', cat: 'lopd',
        tags: ['LOPD', 'RGPD', 'protección de datos', 'privacidad'],
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}'],
        content: `INFORMACIÓN SOBRE PROTECCIÓN DE DATOS (RGPD / LOPD-GDD)
Rubio García Dental · CIF: B-00000000

RESPONSABLE DEL TRATAMIENTO: Rubio García Dental · C/ Ejemplo 123 · Madrid · clínica@rubiogarcia.es

FINALIDAD: Gestión de la historia clínica, citas, facturación y comunicaciones relacionadas con la atención sanitaria.

BASE LEGAL: Artículo 9.2.h RGPD (tratamiento de datos de salud necesario para la asistencia sanitaria) y consentimiento explícito del interesado.

CONSERVACIÓN: Los datos de historia clínica se conservarán durante el mínimo legal (5 años en España) y los fiscales 6 años.

DESTINATARIOS: No se cederán datos a terceros, excepto obligación legal o gestores autorizados bajo acuerdo de confidencialidad.

DERECHOS: Puede ejercer sus derechos de acceso, rectificación, supresión, portabilidad, limitación u oposición escribiendo a: clínica@rubiogarcia.es, adjuntando copia del DNI.

RECLAMACIÓN: Agencia Española de Protección de Datos (www.aepd.es).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D./Dña. {{nombre}}, con DNI {{dni}}, CONSIENTO expresamente el tratamiento de mis datos de salud para la prestación de asistencia sanitaria por parte de Rubio García Dental.

□ CONSIENTO recibir comunicaciones de seguimiento y recaptación por WhatsApp / Email.
□ NO deseo recibir comunicaciones comerciales.

Firma: _______________________  Fecha: {{fecha}}`
    },
    {
        id: 'lopd-menor', title: 'Autorización Tutor Legal + LOPD Menor', cat: 'lopd',
        tags: ['LOPD', 'menor', 'tutor', 'autorización'],
        vars: ['{{nombre_menor}}', '{{fecha_nacimiento}}', '{{nombre_tutor}}', '{{dni_tutor}}', '{{fecha}}'],
        content: `AUTORIZACIÓN TUTOR LEGAL + PROTECCIÓN DE DATOS
Rubio García Dental

Yo, D./Dña. {{nombre_tutor}}, con DNI {{dni_tutor}}, en calidad de padre/madre/tutor legal de:

Menor: {{nombre_menor}}  Fecha nacimiento: {{fecha_nacimiento}}

DECLARO:
1. Autorizo la exploración, diagnóstico y tratamiento odontológico del menor indicado.
2. He sido informado/a del plan de tratamiento propuesto y sus alternativas.
3. CONSIENTO el tratamiento de los datos de salud del menor para la gestión de su historial clínico.
4. Asumo la responsabilidad del seguimiento de las indicaciones y cuidados prescritos.

Firma tutor: _______________________  DNI: {{dni_tutor}}  Fecha: {{fecha}}`
    },
    // ── INTERNO ──
    {
        id: 'int-traspaso-guardia', title: 'Informe de Traspaso de Guardia (Interno)', cat: 'interno',
        tags: ['interno', 'traspaso', 'guardia', 'clínico'],
        vars: ['{{fecha}}', '{{doctor_saliente}}', '{{doctor_entrante}}'],
        content: `INFORME TRASPASO DE GUARDIA — INTERNO
Rubio García Dental

Fecha: {{fecha}}
Dr./Dra. saliente: {{doctor_saliente}} → Dr./Dra. entrante: {{doctor_entrante}}

PACIENTES PENDIENTES DE SEGUIMIENTO:
1. Nombre: _____________  Tratamiento: _____________  Indicación: _____________
2. Nombre: _____________  Tratamiento: _____________  Indicación: _____________
3. Nombre: _____________  Tratamiento: _____________  Indicación: _____________

INCIDENCIAS DEL DÍA:
_________________________________________________

MATERIAL / STOCK QUE REQUIERE REPOSICIÓN:
_________________________________________________

OBSERVACIONES GENERALES:
_________________________________________________

Firma saliente: _______________________  Firma entrante: _______________________`
    },
    {
        id: 'int-derivacion', title: 'Informe de Derivación a Especialista', cat: 'interno',
        tags: ['derivación', 'especialista', 'informe clínico'],
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{doctor}}', '{{especialista}}', '{{motivo}}', '{{antecedentes}}'],
        content: `INFORME DE DERIVACIÓN
Rubio García Dental

Fecha: {{fecha}}
Médico remitente: Dr./Dra. {{doctor}}
Especialista: {{especialista}}

DATOS DEL PACIENTE
Nombre: {{nombre}}  DNI: {{dni}}

MOTIVO DE DERIVACIÓN: {{motivo}}

ANTECEDENTES RELEVANTES: {{antecedentes}}

TRATAMIENTOS REALIZADOS EN NUESTRA CLÍNICA:
_________________________________________________

RADIOGRAFÍAS ADJUNTAS: □ Sí (OPG / periapical / CBCT)  □ No

URGENCIA: □ Ordinaria  □ Preferente  □ Urgente

Quedo a disposición para ampliación de información.

Firma: Dr./Dra. {{doctor}}  _______________________`
    },
];

// ─── Config visual por categoría ───────────────────────────────────────────────
const CAT_CFG: Record<DocCat, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    consentimiento: { label: 'Consentimientos', icon: Shield, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    cuestionario: { label: 'Cuestionarios', icon: Clipboard, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
    presupuesto: { label: 'Presupuestos', icon: Receipt, color: 'text-[#051650]', bg: 'bg-[#FEFDE8] border-[#FBFFA3]' },
    instrucciones: { label: 'Instrucciones Post-Tx', icon: Heart, color: 'text-[#C02040]', bg: 'bg-[#FFF0F3] border-[#FFC0CB]' },
    lopd: { label: 'Legal / RGPD', icon: Shield, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
    interno: { label: 'Documentos Internos', icon: FileText, color: 'text-[#051650]', bg: 'bg-blue-50 border-blue-200' },
};

// ─── Editor de variables para preview/impresión ────────────────────────────────
const PREVIEW_DEFAULTS: Record<string, string> = {
    '{{nombre}}': 'Juan García López',
    '{{dni}}': '12345678A',
    '{{fecha}}': new Date().toLocaleDateString('es-ES'),
    '{{doctor}}': 'Dra. Rubio García',
    '{{posicion}}': '36 (molar inferior izquierdo)',
    '{{pieza}}': '26',
    '{{marca_implante}}': 'Nobel Biocare Active',
    '{{precio_implante}}': '800',
    '{{precio_corona}}': '600',
    '{{total}}': '1.400',
    '{{forma_pago}}': '3 cuotas de 466€ sin intereses',
    '{{telefono}}': '912 345 678',
    '{{medicacion}}': 'Ibuprofeno 600mg (8h) + Amoxicilina 500mg (8h)',
    '{{tratamiento}}': 'Extracción molar inferior',
    '{{concentracion}}': '35',
    '{{sesiones}}': '1 sesión en clínica + 2 semanas domiciliaria',
    '{{tipo_ortodoncia}}': 'Ortodoncia de Alineadores (Invisalign)',
    '{{duracion}}': '18 meses',
    '{{revision}}': '6-8',
    '{{total_ort}}': '4.500',
    '{{entrada}}': '500',
    '{{cuota}}': '250',
    '{{meses}}': '16',
    '{{doctor_saliente}}': 'Dr. Martínez',
    '{{doctor_entrante}}': 'Dra. Rubio García',
    '{{especialista}}': 'Periodoncista — Clínica Sonría',
    '{{motivo}}': 'Periimplantitis grado III con pérdida ósea',
    '{{antecedentes}}': 'Paciente diabético tipo 2, buen control glucémico',
    '{{nombre_menor}}': 'Lucas García Pérez',
    '{{fecha_nacimiento}}': '15/04/2015',
    '{{nombre_tutor}}': 'Ana Pérez Martín',
    '{{dni_tutor}}': '87654321B',
};

const applyVars = (text: string, overrides: Record<string, string>) => {
    let out = text;
    const merged = { ...PREVIEW_DEFAULTS, ...overrides };
    Object.entries(merged).forEach(([k, v]) => { out = out.split(k).join(v); });
    return out;
};

// ─── Componente principal ──────────────────────────────────────────────────────
export interface PacienteBasico {
    nombre?: string; apellidos?: string; dni?: string;
    telefono?: string; fechaNacimiento?: string; doctor?: string;
}

export const DocumentosClinica: React.FC<{ paciente?: PacienteBasico }> = ({ paciente }) => {
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState<DocCat | 'all'>('all');
    const [selected, setSelected] = useState<DocTemplate | null>(null);
    const [varOverrides, setVarOverrides] = useState<Record<string, string>>({});
    const printRef = useRef<HTMLPreElement>(null);

    // Auto-rellenar variables: usa prop paciente o, si no hay, el último paciente activo del store
    useEffect(() => {
        const source = paciente ?? getPacienteActivo();
        if (!source) return;
        const nombreCompleto = [source.nombre, source.apellidos].filter(Boolean).join(' ');
        const fill: Record<string, string> = {};
        if (nombreCompleto) fill['{{nombre}}'] = nombreCompleto;
        if (source.dni) fill['{{dni}}'] = source.dni;
        if (source.telefono) fill['{{telefono}}'] = source.telefono;
        if (source.doctor) fill['{{doctor}}'] = source.doctor;
        if (source.fechaNacimiento) fill['{{fecha_nacimiento}}'] = source.fechaNacimiento;
        fill['{{fecha}}'] = new Date().toLocaleDateString('es-ES');
        setVarOverrides(fill);
    }, [paciente?.nombre, paciente?.apellidos, paciente?.dni]);

    const filtered = DOCS.filter(d =>
        (catFilter === 'all' || d.cat === catFilter) &&
        (!search || d.title.toLowerCase().includes(search.toLowerCase()) || d.tags.some(t => t.includes(search.toLowerCase())))
    );

    const grouped = (Object.keys(CAT_CFG) as DocCat[]).map(cat => ({
        cat, items: filtered.filter(d => d.cat === cat)
    })).filter(g => g.items.length > 0);

    const handlePrint = () => {
        if (!selected) return;
        const content = applyVars(selected.content, varOverrides);
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<html><head><title>${selected.title} — Rubio García Dental</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:32px;white-space:pre-wrap;line-height:1.6}
      h1{font-size:14px;font-weight:bold;margin-bottom:16px}</style></head>
      <body><h1>${selected.title}</h1><pre>${content}</pre></body></html>`);
        win.document.close();
        win.focus();
        win.print();
    };

    const handleDownload = () => {
        if (!selected) return;
        const content = applyVars(selected.content, varOverrides);
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selected.id}_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex gap-6 h-full">
            {/* Lista */}
            <div className="w-80 flex-shrink-0 space-y-3">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar documento..." className="bg-transparent outline-none text-[13px] text-slate-700 placeholder-slate-400 w-full" />
                </div>
                <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setCatFilter('all')}
                        className={`px-2 py-1 rounded-lg text-[12px] font-bold uppercase transition-all ${catFilter === 'all' ? 'bg-[#051650] text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>
                        Todos ({DOCS.length})
                    </button>
                    {(Object.entries(CAT_CFG) as [DocCat, typeof CAT_CFG[DocCat]][]).map(([cat, cfg]) => {
                        const count = DOCS.filter(d => d.cat === cat).length;
                        return (
                            <button key={cat} onClick={() => setCatFilter(cat)}
                                className={`px-2 py-1 rounded-lg text-[12px] font-bold uppercase transition-all ${catFilter === cat ? 'bg-[#051650] text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>
                                {cfg.label} ({count})
                            </button>
                        );
                    })}
                </div>

                <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 custom-scrollbar">
                    {grouped.map(({ cat, items }) => {
                        const cfg = CAT_CFG[cat];
                        const Icon = cfg.icon;
                        return (
                            <div key={cat}>
                                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <Icon className={`w-3 h-3 ${cfg.color}`} />{cfg.label}
                                </p>
                                <div className="space-y-1.5">
                                    {items.map(doc => (
                                        <button key={doc.id} onClick={() => { setSelected(doc); setVarOverrides({}); }}
                                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-start gap-2 ${selected?.id === doc.id ? 'bg-[#051650] text-white border-[#051650]' : `bg-white ${cfg.bg} hover:shadow-sm`}`}>
                                            <ChevronRight className={`w-3 h-3 mt-0.5 flex-shrink-0 ${selected?.id === doc.id ? 'text-white' : cfg.color}`} />
                                            <span className={`text-[13px] font-bold leading-snug ${selected?.id === doc.id ? 'text-white' : 'text-slate-700'}`}>{doc.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Vista previa */}
            <div className="flex-1 min-w-0">
                {!selected ? (
                    <div className="h-full flex items-center justify-center text-center">
                        <div>
                            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                            <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Selecciona un documento</p>
                            <p className="text-[12px] text-slate-300 mt-1">{DOCS.length} documentos disponibles</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 h-full flex flex-col">
                        {/* Cabecera */}
                        <div className="flex items-start gap-4 bg-white rounded-2xl border-2 border-[#051650] p-4">
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-[#051650] uppercase tracking-tight">{selected.title}</h3>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                    {selected.tags.map(t => (
                                        <span key={t} className="text-[12px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-[#051650] text-white rounded-xl text-[12px] font-bold uppercase hover:bg-blue-800 transition-all">
                                    <Printer className="w-3.5 h-3.5" />Imprimir
                                </button>
                                <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-[12px] font-bold uppercase hover:bg-slate-50 transition-all">
                                    <Download className="w-3.5 h-3.5" />Descargar
                                </button>
                                <button onClick={() => setSelected(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Variables rellenables */}
                        {selected.vars.length > 0 && (
                            <div className="bg-[#FEFDE8] border border-[#FBFFA3] rounded-2xl p-4">
                                <p className="text-[12px] font-bold text-[#051650] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Edit3 className="w-3 h-3" />Variables del documento — rellena para personalizar
                                </p>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {selected.vars.map(v => (
                                        <div key={v}>
                                            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">{v}</label>
                                            <input
                                                value={varOverrides[v] ?? ''}
                                                onChange={e => setVarOverrides(prev => ({ ...prev, [v]: e.target.value }))}
                                                placeholder={PREVIEW_DEFAULTS[v] ?? v.replace(/[{}]/g, '')}
                                                className="w-full bg-white border border-[#FBFFA3] rounded-lg px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:ring-2 focus:ring-amber-300 placeholder-slate-400"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-auto">
                            <pre ref={printRef} className="p-6 text-[13px] text-slate-700 font-mono leading-relaxed whitespace-pre-wrap">
                                {applyVars(selected.content, varOverrides)}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentosClinica;
