// ─── Swagger/OpenAPI Configuration ──────────────────────
// Auto-generates API documentation from JSDoc annotations in route files.
// Serves interactive Swagger UI at /api/docs.
import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'SmilePro Studio API',
            version: '2.1.0',
            description: `
API backend para SmilePro Studio — plataforma SaaS de gestión integral para clínicas dentales.

**Autenticación:** Bearer JWT (access token de 15min + refresh token de 7 días).

**Rate Limiting:** 1000 req/15min por IP en producción.

**CORS:** Configurado para el frontend en \`CORS_ORIGIN\`.
            `.trim(),
            contact: {
                name: 'SmilePro Studio',
                url: 'https://gestion.rubiogarciadental.com',
            },
        },
        servers: [
            {
                url: '/api',
                description: 'API Base',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT access token obtenido de POST /auth/login',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                code: { type: 'string' },
                            },
                        },
                    },
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'dr@rubiogarciadental.com' },
                        password: { type: 'string', example: '********' },
                    },
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        data: {
                            type: 'object',
                            properties: {
                                accessToken: { type: 'string' },
                                refreshToken: { type: 'string' },
                                csrfToken: { type: 'string' },
                                user: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string', format: 'uuid' },
                                        email: { type: 'string' },
                                        name: { type: 'string' },
                                        role: { type: 'string', enum: ['admin', 'dentist', 'reception', 'hygienist', 'auxiliary', 'manager'] },
                                    },
                                },
                            },
                        },
                    },
                },
                Patient: {
                    type: 'object',
                    properties: {
                        IdPac: { type: 'integer' },
                        NumPac: { type: 'string', example: '00001234' },
                        Nombre: { type: 'string' },
                        Apellidos: { type: 'string' },
                        NIF: { type: 'string' },
                        TelMovil: { type: 'string' },
                        Email: { type: 'string' },
                    },
                },
                AuditLog: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        userId: { type: 'string', format: 'uuid' },
                        userEmail: { type: 'string' },
                        action: { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE'] },
                        entity: { type: 'string' },
                        entityId: { type: 'string' },
                        dataBefore: { type: 'object', nullable: true },
                        dataAfter: { type: 'object', nullable: true },
                        ipAddress: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.routes.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
