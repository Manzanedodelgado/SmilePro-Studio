
import { type MenuItem } from './types';

export const navigationItems: MenuItem[] = [
    {
        name: 'CLÍNICA',
        icon: 'dashboard',
        title: 'Cuadro de Mando',
        children: [
            { name: 'Hoy en Clínica', icon: 'today' },
            { name: 'Rendimiento', icon: 'analytics' },
        ]
    },
    {
        name: 'Agenda',
        icon: 'calendar_today',
        title: 'Agenda Clínica',
        children: []
    },
    {
        name: 'Pacientes',
        icon: 'people',
        title: 'Ficha de Paciente',
        children: [
            { name: 'Historia Clínica', icon: 'medical_information' },
            { name: 'Anamnesis', icon: 'assignment' },
            { name: 'Odontograma 3D', icon: 'grid_view' },
            { name: 'Sondaje Periodontal', icon: 'sick' },
            { name: 'Documentos y Consentimientos', icon: 'description' },
            { name: 'Cuenta Corriente', icon: 'payments' },
            { name: 'Presupuestos', icon: 'request_quote' },
        ]
    },
    {
        name: 'Radiología',
        icon: 'image_search',
        title: 'Radiología & Imagen',
        children: []
    },
    {
        name: 'Whatsapp',
        icon: 'chat',
        title: 'Centro de Mensajería',
        children: [
            { name: 'Conversaciones', icon: 'inbox' },
        ]
    },
    {
        name: 'IA & Automatización',
        icon: 'psychology',
        title: 'Cerebro Digital',
        children: [
            { name: 'Panel IA', icon: 'smart_toy' },
            { name: 'IA Dental ✶', icon: 'auto_awesome' },
            { name: 'Automatizaciones', icon: 'bolt' },
            { name: 'Flujos Conversacionales', icon: 'account_tree' },
            { name: 'Editor', icon: 'edit_note' },
            { name: 'Plantillas', icon: 'fact_check' },
            { name: 'Documentos Clínicos', icon: 'description' },
        ]
    },
    {
        name: 'Inventario',
        icon: 'inventory_2',
        title: 'Smart Inventory',
        children: [
            { name: 'Panel de Stock', icon: 'grid_view' },
            { name: 'Trazabilidad por QR', icon: 'qr_code_scanner' },
            { name: 'Reposición con IA', icon: 'shopping_cart' },
        ]
    },
    {
        name: 'Gestoría',
        icon: 'business_center',
        title: 'Gestoría Inteligente',
        children: [
            { name: 'Visión Financiera', icon: 'analytics' },
            { name: 'Facturación', icon: 'receipt_long' },
            { name: 'Banco y Conciliación', icon: 'account_balance' },
            { name: 'Declaraciones Fiscales', icon: 'request_page' },
            { name: 'Informes de Gestión', icon: 'bar_chart' },
        ]
    },
];
