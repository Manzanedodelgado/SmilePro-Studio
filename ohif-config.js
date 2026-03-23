// ─── OHIF Viewer — Configuración SmilePro Studio ─────────────────────────────
// Conecta con Orthanc local via DICOMweb (WADO-RS / QIDO-RS)
// ─────────────────────────────────────────────────────────────────────────────

window.config = {
  routerBasename: '/',
  showStudyList: true,
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: false,
  showLoadingIndicator: true,
  strictZSpacingForVolumeViewport: true,

  maxNumberOfWebWorkers: 3,

  // Idioma
  i18n: {
    initOptions: { lng: 'es' },
  },

  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'SmilePro — Orthanc Local',
        name: 'orthanc',

        wadoUriRoot:  'http://localhost:8042/wado',
        qidoRoot:     'http://localhost:8042/dicom-web',
        wadoRoot:     'http://localhost:8042/dicom-web',

        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        omitQuotationForMultipartRequest: true,
      },
    },
  ],

  defaultDataSourceName: 'dicomweb',

  // Herramientas activas por defecto
  hotkeys: [],
};
