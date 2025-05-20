require('dotenv').config();
const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 5002;

// Configuración de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Limitar peticiones
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de peticiones por IP
});
app.use(limiter);

// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ruta de health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Ruta para generar PDF de Gravamen
app.post('/generar-pdf', async (req, res) => {
  try {
    // Validación de campos requeridos
    const requiredFields = [
      'nombre', 'cedulaFacturacion', 'direccion', 'telefono',
      'apellidos', 'cedulaCertificacion', 'lugarInmueble',
      'usoCertificacion', 'especifiqueUso', 'recepcionDocumento',
      'cedulaSolicitante'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Campos requeridos faltantes',
        missing: missingFields
      });
    }

    if (req.body.recepcionDocumento === 'Electrónico' && !req.body.correoRecepcion) {
      return res.status(400).json({ message: 'Correo electrónico requerido para recepción electrónica' });
    }

    // Ruta al archivo PDF
    const pdfPath = path.join(__dirname, 'pdfs', '2.pdf');
    if (!fs.existsSync(pdfPath)) {
      console.error('Archivo PDF no encontrado');
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    // Procesamiento del PDF
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const [page] = pdfDoc.getPages();

    // Función segura para dibujar texto
    const drawSafeText = (text, x, y, size = 12) => {
      if (text) page.drawText(String(text), { x, y, size });
    };

    // Rellenar campos
    drawSafeText(req.body.nombre, 95, 700);
    drawSafeText(req.body.cedulaFacturacion, 300, 670);
    drawSafeText(req.body.direccion, 80, 650);
    drawSafeText(req.body.correo, 135, 625);
    drawSafeText(req.body.telefono, 440, 625);
    drawSafeText(req.body.apellidos, 95, 570);
    drawSafeText(req.body.cedulaCertificacion, 390, 540);
    drawSafeText(req.body.estadoCivil, 140, 525);
    drawSafeText(req.body.lugarInmueble, 95, 510);
    drawSafeText(req.body.libro, 150, 450);
    drawSafeText(req.body.numeroInscripcion, 320, 450);
    drawSafeText(req.body.fechaInscripcion, 473, 455);
    drawSafeText(req.body.tomo, 150, 420);
    drawSafeText(req.body.repertorio, 320, 420);
    drawSafeText(req.body.fichaRegistral, 490, 420);
    drawSafeText(req.body.otro || 'N/A', 260, 395);

    // Marcar opción seleccionada
    const opciones = {
      'Tramites Judiciales': { x: 220, y: 296 },
      'Instituciones Bancarias': { x: 220, y: 260 },
      'Instituciones Publicas': { x: 220, y: 221 },
      'Otro': { x: 220, y: 180 },
    };

    if (opciones[req.body.usoCertificacion]) {
      page.drawText('X', opciones[req.body.usoCertificacion]);
    }

    drawSafeText(req.body.especifiqueUso || 'N/A', 140, 150);

    // Recepción del documento
    if (req.body.recepcionDocumento === 'Presencial') {
      page.drawText('X', { x: 398, y: 308, size: 12 });
    } else if (req.body.recepcionDocumento === 'Electrónico') {
      page.drawText('X', { x: 398, y: 280, size: 12 });
      drawSafeText(req.body.correoRecepcion, 360, 260);
    }

    // Fecha y lugar
    const fechaActual = new Date().toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    drawSafeText('Pedro Vicente Maldonado', 400, 225);
    drawSafeText(fechaActual, 340, 210);
    drawSafeText(req.body.cedulaSolicitante, 400, 120);

    // Generar y enviar PDF
    const modifiedPdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Formulario_Gravamen.pdf');
    res.send(modifiedPdfBytes);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ message: 'Error al generar el PDF' });
  }
});

// Ruta para generar PDF de Búsqueda
app.post('/generar-pdf-busqueda', async (req, res) => {
  try {
    // Validación de campos requeridos
    const requiredFields = [
      'nombre', 'cedulaFacturacion', 'direccion', 'telefono',
      'nombresCompletos', 'cedula', 'estadoCivil',
      'nombresSolicitante', 'cedulaSolicitante', 'estadoCivilSolicitante',
      'declaracionUso', 'recepcionDocumento'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Campos requeridos faltantes',
        missing: missingFields
      });
    }

    if (req.body.recepcionDocumento === 'Electrónico' && !req.body.correoRecepcion) {
      return res.status(400).json({ message: 'Correo electrónico requerido para recepción electrónica' });
    }

    // Ruta al archivo PDF
    const pdfPath = path.join(__dirname, 'pdfs', '1.pdf');
    if (!fs.existsSync(pdfPath)) {
      console.error('Archivo PDF no encontrado');
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    // Procesamiento del PDF
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const [page] = pdfDoc.getPages();

    // Función segura para dibujar texto
    const drawSafeText = (text, x, y, size = 12) => {
      if (text) page.drawText(String(text), { x, y, size });
    };

    // Rellenar campos
    drawSafeText(req.body.nombre, 95, 665);
    drawSafeText(req.body.cedulaFacturacion, 300, 635);
    drawSafeText(req.body.direccion, 80, 612);
    drawSafeText(req.body.correo, 135, 590);
    drawSafeText(req.body.telefono, 440, 590);
    drawSafeText(req.body.nombresCompletos, 95, 520);
    drawSafeText(req.body.cedula, 270, 488);
    drawSafeText(req.body.estadoCivil, 460, 488);
    drawSafeText(req.body.nombresSolicitante, 180, 440);
    drawSafeText(req.body.cedulaSolicitante, 390, 410);
    drawSafeText(req.body.estadoCivilSolicitante, 140, 388);
    drawSafeText(req.body.declaracionUso, 110, 366);

    // Recepción del documento
    if (req.body.recepcionDocumento === 'Presencial') {
      page.drawText('X', { x: 161, y: 183, size: 12 });
    } else if (req.body.recepcionDocumento === 'Electrónico') {
      page.drawText('X', { x: 161, y: 143, size: 12 });
      drawSafeText(req.body.correoRecepcion, 80, 107);
    }

    // Fecha y lugar
    const fechaActual = new Date().toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    drawSafeText('Pedro Vicente Maldonado', 390, 222);
    drawSafeText(fechaActual, 340, 200);

    // Generar y enviar PDF
    const modifiedPdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Formulario_Busqueda.pdf');
    res.send(modifiedPdfBytes);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ message: 'Error al generar el PDF' });
  }
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor backend escuchando en el puerto ${port}`);
});