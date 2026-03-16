/**
 * cornerstone.init.ts — Inicialización singleton de Cornerstone3D
 *
 * Llama a initCornerstone() una sola vez antes de usar cualquier viewport DICOM.
 * Seguro de llamar múltiples veces (idempotente).
 */

import { init as initCore, metaData } from '@cornerstonejs/core';
import { init as initTools, addTool,
    WindowLevelTool, ZoomTool, PanTool,
    LengthTool, AngleTool, CobbAngleTool,
    RectangleROITool, EllipticalROITool, CircleROITool,
    ArrowAnnotateTool, MagnifyTool, StackScrollTool,
    ProbeTool,
} from '@cornerstonejs/tools';
import { init as initDicomLoader, wadouri } from '@cornerstonejs/dicom-image-loader';

let initialized = false;

export async function initCornerstone(): Promise<void> {
    if (initialized) return;
    initialized = true;

    // 1. Core
    await initCore();

    // 2. DICOM Image Loader
    initDicomLoader({ maxWebWorkers: 2 });

    // 3. Metadata provider (necesario para que cornerstone lea tags DICOM)
    metaData.addProvider(
        (type: string, imageId: string) =>
            wadouri.metaData.metaDataProvider(type, imageId),
        10000
    );

    // 4. Tools — registrar todas las herramientas
    initTools();
    addTool(WindowLevelTool);
    addTool(ZoomTool);
    addTool(PanTool);
    addTool(LengthTool);
    addTool(AngleTool);
    addTool(CobbAngleTool);
    addTool(RectangleROITool);
    addTool(EllipticalROITool);
    addTool(CircleROITool);
    addTool(ArrowAnnotateTool);
    addTool(MagnifyTool);
    addTool(StackScrollTool);
    addTool(ProbeTool);
}
