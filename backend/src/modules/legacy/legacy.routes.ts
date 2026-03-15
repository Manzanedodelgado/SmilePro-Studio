import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';

const router = Router();

// Mocks for legacy backend RPC functions
router.post('/rpc/asignar_numpac', (req, res) => {
    logger.info(`[LEGACY RPC] asignar_numpac called with:`, req.body);
    res.status(200).json(`SP-999${Math.floor(Math.random() * 1000)}`);
});

router.post('/rpc/vincular_numpac_gelite', (req, res) => {
    logger.info(`[LEGACY RPC] vincular_numpac_gelite called with:`, req.body);
    res.status(200).json(true);
});

// A generic proxy to allow the frontend to seamlessly migrate without rewriting every single `dbSelect` instantly
router.get('/:model', async (req, res) => {
    try {
        const model = req.params.model;
        // Case-insensitive match for prisma models (to handle things like 'NV_CabFactura' vs 'nV_CabFactura')
        const prismaModelName = Object.keys(prisma).find(k => k.toLowerCase() === model.toLowerCase());
        
        if (!prismaModelName) {
            logger.warn(`[LEGACY GET] Model [${model}] not found. Returning empty array to prevent UI crash.`);
            return res.json([]);
        }
        
        const args: any = { where: {} };
        const query = req.query as Record<string, string>;
        
        for (const [key, value] of Object.entries(query)) {
            if (key === 'limit') {
                args.take = parseInt(value);
            } else if (key === 'offset') {
                args.skip = parseInt(value);
            } else if (key === 'order') {
                // E.g 'Fecha.desc,IdPac.asc'
                const parts = value.split(',');
                args.orderBy = parts.map(p => {
                    const [field, dir] = p.split('.');
                    return { [field]: dir || 'asc' };
                });
            } else if (key === 'select') {
                args.select = {};
                value.split(',').forEach(k => args.select[k] = true);
            } else {
                // Where clause parsing (e.g., 'eq.123', 'gte.40')
                let op = 'eq';
                let valStr = value;
                
                const dotIdx = value.indexOf('.');
                if (dotIdx > 0 && ['eq','gte','lte','gt','lt','neq','ilike','like', 'in'].includes(value.substring(0, dotIdx))) {
                    op = value.substring(0, dotIdx);
                    valStr = value.substring(dotIdx + 1);
                }

                let val: any = valStr;
                
                // Auto-cast strings
                if (valStr.toLowerCase() === 'null') val = null;
                else if (valStr.toLowerCase() === 'true') val = true;
                else if (valStr.toLowerCase() === 'false') val = false;
                else if (/^-?\d+(\.\d+)?$/.test(valStr)) val = Number(valStr);

                // Build Prisma where
                if (op === 'eq') args.where[key] = val;
                else if (op === 'gte') args.where[key] = { gte: val };
                else if (op === 'lte') args.where[key] = { lte: val };
                else if (op === 'gt') args.where[key] = { gt: val };
                else if (op === 'lt') args.where[key] = { lt: val };
                else if (op === 'neq') args.where[key] = { not: val };
                else if (op === 'ilike') args.where[key] = { contains: String(val), mode: 'insensitive' };
                else if (op === 'like') args.where[key] = { contains: String(val) };
                else if (op === 'in') {
                    // in.(1,2,3)
                    let items = valStr.replace(/^\(/, '').replace(/\)$/, '').split(',');
                    args.where[key] = { in: items.map(i => (/^-?\d+(\.\d+)?$/.test(i) ? Number(i) : i)) };
                }
            }
        }
        
        // Execute the dynamically built query
        const data = await (prisma as any)[prismaModelName].findMany(args);
        res.json(data);
    } catch (e: any) {
        logger.error(`[LEGACY GET] ${req.params.model} Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

router.post('/:model', async (req, res) => {
    try {
        const model = req.params.model;
        const prismaModelName = Object.keys(prisma).find(k => k.toLowerCase() === model.toLowerCase());
        if (!prismaModelName) {
            logger.warn(`[LEGACY POST] Model not found: ${model}. Returning mock object.`);
            return res.status(201).json([req.body]);
        }
        
        let dataToInsert = req.body;
        
        // Clean up id generation for FDW tables (id might be an internal trigger or auto-inc)
        // If frontend generated a UUID but the local DB uses Int, delete it:
        if (dataToInsert.id && isNaN(Number(dataToInsert.id))) {
            delete dataToInsert.id;
        }

        const data = await (prisma as any)[prismaModelName].create({ data: dataToInsert });
        res.status(201).json([data]);
    } catch (e: any) {
        logger.error(`[LEGACY POST] Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:model', async (req, res) => {
    try {
        const model = req.params.model;
        const prismaModelName = Object.keys(prisma).find(k => k.toLowerCase() === model.toLowerCase());
        if (!prismaModelName) {
            logger.warn(`[LEGACY PATCH] Model not found: ${model}. Gracing mock.`);
            return res.json([req.body]);
        }

        const query = req.query as Record<string, string>;
        const whereArgs: any = {};
        for (const [key, value] of Object.entries(query)) {
            const [op, ...rest] = value.split('.');
            if (op === 'eq') {
                const valStr = rest.join('.');
                whereArgs[key] = /^-?\d+(\.\d+)?$/.test(valStr) ? Number(valStr) : valStr;
            }
        }

        await (prisma as any)[prismaModelName].updateMany({
            where: whereArgs,
            data: req.body
        });
        
        const updated = await (prisma as any)[prismaModelName].findMany({ where: whereArgs });
        res.json(updated);
    } catch (e: any) {
        logger.error(`[LEGACY PATCH] Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:model', async (req, res) => {
    try {
        const model = req.params.model;
        const prismaModelName = Object.keys(prisma).find(k => k.toLowerCase() === model.toLowerCase());
        if (!prismaModelName) {
            logger.warn(`[LEGACY DELETE] Model not found: ${model}. Gracing mock.`);
            return res.status(204).send();
        }

        const query = req.query as Record<string, string>;
        const whereArgs: any = {};
        for (const [key, value] of Object.entries(query)) {
            const [op, ...rest] = value.split('.');
            if (op === 'eq') {
                const valStr = rest.join('.');
                whereArgs[key] = /^-?\d+(\.\d+)?$/.test(valStr) ? Number(valStr) : valStr;
            }
        }

        await (prisma as any)[prismaModelName].deleteMany({ where: whereArgs });
        res.status(204).send();
    } catch (e: any) {
        logger.error(`[LEGACY DELETE] Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

export default router;
