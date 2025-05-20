require('dotenv').config();
const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 10000;

// 1. Configuración de Seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.REACT_APP_API_URL]
    }
  },
  crossOriginResourcePolicy: { policy: "same-site" }
}));

// 2. Configuración CORS
const allowedOrigins = [
  'https://www.regpropiedadpvm.gob.ec',
  'https://regpropiedadpvm.gob.ec',
  process.env.REACT_APP_API_URL
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:3000');
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 3. Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes desde esta IP'
  }
});

app.use(apiLimiter);

// 4. Middlewares
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 5. Funciones para generación de PDFs
const handlePdfGeneration = async (req, res, templateName, fieldsConfig, filename) => {
  try {
    const templatePath = path.join(__dirname, 'pdfs', templateName);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error('Plantilla PDF no encontrada');
    }

    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPages()[0];

    // Aplicar configuración de campos
    Object.entries(fieldsConfig(req.body)).forEach(([key, value]) => {
      if (value?.x !== undefined && value?.y !== undefined) {
        page.drawText(value.text || '', { 
          x: value.x, 
          y: value.y, 
          size: value.size || 12 
        });
      }
    });

    const modifiedPdfBytes = await pdfDoc.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(modifiedPdfBytes);

  } catch (error) {
    console.error(`Error generando PDF (${filename}):`, error);
    throw error;
  }
};

// 6. Configuración de campos para Gravamen
const gravamenFields = (body) => {
  const fechaActual = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const fields = {
    // Datos de facturación
    nombre: { x: 95, y: 700, text: body.nombre },
    cedulaFacturacion: { x: 300, y: 670, text: body.cedulaFacturacion },
    direccion: { x: 80, y: 650, text: body.direccion },
    correo: { x: 135, y: 625, text: body.correo || '' },
    telefono: { x: 440, y: 625, text: body.telefono },
    
    // Datos de certificación
    apellidos: { x: 95, y: 570, text: body.apellidos },
    cedulaCertificacion: { x: 390, y: 540, text: body.cedulaCertificacion },
    estadoCivil: { x: 140, y: 525, text: body.estadoCivil || '' },
    lugarInmueble: { x: 95, y: 510, text: body.lugarInmueble },
    libro: { x: 150, y: 450, text: body.libro || '' },
    numeroInscripcion: { x: 320, y: 450, text: body.numeroInscripcion || '' },
    fechaInscripcion: { x: 473, y: 455, text: body.fechaInscripcion || '' },
    tomo: { x: 150, y: 420, text: body.tomo || '' },
    repertorio: { x: 320, y: 420, text: body.repertorio || '' },
    fichaRegistral: { x: 490, y: 420, text: body.fichaRegistral || '' },
    otro: { x: 260, y: 395, text: body.otro || 'N/A' },
    especifiqueUso: { x: 140, y: 150, text: body.especifiqueUso || 'N/A' },
    lugar: { x: 400, y: 225, text: 'Pedro Vicente Maldonado' },
    fechaActual: { x: 340, y: 210, text: fechaActual },
    cedulaSolicitante: { x: 400, y: 120, text: body.cedulaSolicitante }
  };

  // Opciones de uso
  const opcionesUso = {
    'Tramites Judiciales': { x: 220, y: 296 },
    'Instituciones Bancarias': { x: 220, y: 260 },
    'Instituciones Publicas': { x: 220, y: 221 },
    'Otro': { x: 220, y: 180 }
  };

  if (opcionesUso[body.usoCertificacion]) {
    fields.marcarUso = {
      x: opcionesUso[body.usoCertificacion].x,
      y: opcionesUso[body.usoCertificacion].y,
      text: 'X'
    };
  }

  // Recepción de documento
  if (body.recepcionDocumento === 'Presencial') {
    fields.marcarRecepcion = { x: 398, y: 308, text: 'X' };
  } else if (body.recepcionDocumento === 'Electrónico') {
    fields.marcarRecepcion = { x: 398, y: 280, text: 'X' };
    fields.correoRecepcion = { x: 360, y: 260, text: body.correoRecepcion || '' };
  }

  return fields;
};

// 7. Configuración de campos para Búsqueda
const busquedaFields = (body) => {
  const fechaActual = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const fields = {
    // Datos de facturación
    nombre: { x: 95, y: 665, text: body.nombre },
    cedulaFacturacion: { x: 300, y: 635, text: body.cedulaFacturacion },
    direccion: { x: 80, y: 612, text: body.direccion },
    correo: { x: 135, y: 590, text: body.correo || '' },
    telefono: { x: 440, y: 590, text: body.telefono },
    
    // Datos de búsqueda
    nombresCompletos: { x: 95, y: 520, text: body.nombresCompletos },
    cedula: { x: 270, y: 488, text: body.cedula },
    estadoCivil: { x: 460, y: 488, text: body.estadoCivil },
    nombresSolicitante: { x: 180, y: 440, text: body.nombresSolicitante },
    cedulaSolicitante: { x: 390, y: 410, text: body.cedulaSolicitante },
    estadoCivilSolicitante: { x: 140, y: 388, text: body.estadoCivilSolicitante },
    declaracionUso: { x: 110, y: 366, text: body.declaracionUso },
    lugar: { x: 390, y: 222, text: 'Pedro Vicente Maldonado' },
    fechaActual: { x: 340, y: 200, text: fechaActual }
  };

  // Recepción de documento
  if (body.recepcionDocumento === 'Presencial') {
    fields.marcarRecepcion = { x: 161, y: 183, text: 'X' };
  } else if (body.recepcionDocumento === 'Electrónico') {
    fields.marcarRecepcion = { x: 161, y: 143, text: 'X' };
    fields.correoRecepcion = { x: 80, y: 107, text: body.correoRecepcion || '' };
  }

  return fields;
};

// 8. Rutas
app.post('/generar-pdf', async (req, res) => {
  try {
    const requiredFields = [
      'nombre', 'cedulaFacturacion', 'direccion', 'telefono',
      'apellidos', 'cedulaCertificacion', 'lugarInmueble',
      'usoCertificacion', 'especifiqueUso', 'recepcionDocumento',
      'cedulaSolicitante'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      throw new Error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
    }

    await handlePdfGeneration(req, res, '2.pdf', gravamenFields, 'Formulario_Gravamen.pdf');
  } catch (error) {
    res.status(400).json({ 
      success: false,
      message: error.message
    });
  }
});

app.post('/generar-pdf-busqueda', async (req, res) => {
  try {
    const requiredFields = [
      'nombre', 'cedulaFacturacion', 'direccion', 'telefono',
      'nombresCompletos', 'cedula', 'estadoCivil', 'nombresSolicitante',
      'cedulaSolicitante', 'estadoCivilSolicitante', 'declaracionUso',
      'recepcionDocumento'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      throw new Error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
    }

    await handlePdfGeneration(req, res, '1.pdf', busquedaFields, 'Formulario_Busqueda.pdf');
  } catch (error) {
    res.status(400).json({ 
      success: false,
      message: error.message
    });
  }
});

// 9. Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    apiVersion: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      generarGravamen: '/generar-pdf',
      generarBusqueda: '/generar-pdf-busqueda'
    }
  });
});

// 10. Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// 11. Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en puerto ${port}`);
  console.log(`🔒 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 Orígenes permitidos: ${allowedOrigins.join(', ')}`);
  console.log(`🔗 Endpoint API: ${process.env.REACT_APP_API_URL}`);
});