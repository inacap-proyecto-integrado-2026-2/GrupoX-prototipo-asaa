import PDFDocument from 'pdfkit';

/**
 * Formats a date string (YYYY-MM-DD) into Chilean Spanish readable format.
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${parseInt(day, 10)} de ${months[parseInt(month, 10) - 1]} de ${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Generates an institutional ASAA PDF document for a given record or blank template.
 * @param {Object} record - The sanitized record data from Firestore or template object
 * @returns {Promise<Buffer>}
 */
export async function generateRecordPdf(record) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 38, bottom: 42, left: 42, right: 42 },
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const brandRed = '#d6001c';
      const ink = '#20242c';
      const muted = '#606773';
      const lineGray = '#e2e5e9';
      const bgCard = '#f7f8fa';
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // Header Bar
      doc.rect(doc.page.margins.left, 38, pageWidth, 5).fill(brandRed);
      doc.y = 50;

      // Helper to draw section header
      const drawSectionHeader = (title) => {
        if (doc.y > doc.page.height - 110) doc.addPage();
        doc.moveDown(0.4);
        const y = doc.y;
        doc.rect(doc.page.margins.left, y, 3, 14).fill(brandRed);
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(10.5).text(`  ${title}`, doc.page.margins.left + 6, y + 1.5);
        doc.moveDown(0.35);
      };

      // -------------------------------------------------------------
      // CASE A: BLANK TEMPLATE FOR TERRAIN / WORKSHOP WITHOUT INTERNET
      // -------------------------------------------------------------
      if (record.isTemplate) {
        doc.fillColor(brandRed).font('Helvetica-Bold').fontSize(9.5).text('INACAP · SEGURIDAD EN TALLERES Y LABORATORIOS', { characterSpacing: 1 });
        doc.fillColor(ink).fontSize(14).text('FICHA ASAA - FORMATO DE REGISTRO EN TERRENO (MODO SIN CONEXIÓN)', { characterSpacing: 0.5 });
        doc.fillColor(muted).font('Helvetica').fontSize(8.5).text('Formato oficial para registro manuscrito en zonas sin cobertura de internet. Transcribir a la plataforma al regresar.');
        doc.moveDown(0.5);

        // Banner
        const bannerY = doc.y;
        doc.rect(doc.page.margins.left, bannerY, pageWidth, 28).fillAndStroke(bgCard, lineGray);
        doc.fillColor(brandRed).font('Helvetica-Bold').fontSize(8.5)
          .text('DOCUMENTO PARA REGISTRO EN TERRENO Y TALLER', doc.page.margins.left + 12, bannerY + 9);
        doc.fillColor('#b45309').font('Helvetica-Bold').fontSize(8.5)
          .text('FORMATO EN BLANCO', doc.page.margins.left + pageWidth - 140, bannerY + 9, { width: 130, align: 'right' });
        doc.y = bannerY + 34;

        // Section 1: Datos Generales
        drawSectionHeader('1. DATOS GENERALES DE LA ACTIVIDAD (LLENAR EN TERRENO)');
        const fieldRows = [
          ['Actividad / Trabajo:', 'Docente Responsable:'],
          ['Asignatura / Sección:', 'Sede / Taller / Lugar:'],
          ['Fecha (DD/MM/AAAA):', 'Especialidad / Nivel:']
        ];
        fieldRows.forEach(row => {
          const startY = doc.y;
          const colW = (pageWidth - 20) / 2;
          doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text(row[0], doc.page.margins.left, startY);
          doc.rect(doc.page.margins.left + 95, startY + 9, colW - 95, 0.5).fill(lineGray);
          doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text(row[1], doc.page.margins.left + colW + 10, startY);
          doc.rect(doc.page.margins.left + colW + 10 + 105, startY + 9, colW - 105, 0.5).fill(lineGray);
          doc.y = startY + 16;
        });

        // Section 2: Análisis de Riesgos y Controles (con casillas)
        drawSectionHeader('2. VERIFICACIÓN DE RECURSOS, RIESGOS Y MEDIDAS DE CONTROL');
        const checklists = [
          { label: 'EQUIPOS / HERRAMIENTAS:', items: ['Herramientas manuales', 'Instrumentos de medición', 'Equipos energizados', 'Escalas / Andamios'] },
          { label: 'EPP REQUERIDO:', items: ['Casco dieléctrico / estándar', 'Lentes de seguridad', 'Guantes de cabritilla / dieléctricos', 'Calzado de seguridad', 'Protector auditivo'] },
          { label: 'RIESGOS IDENTIFICADOS:', items: ['Contacto eléctrico directo/indirecto', 'Caída a distinto nivel', 'Golpes / Cortes', 'Atrapamiento', 'Proyección de partículas'] },
          { label: 'MEDIDAS DE CONTROL:', items: ['Bloqueo y etiquetado (LOTO)', 'Inspección previa de herramientas', 'Charla de seguridad previa', 'Delimitación del área'] }
        ];

        checklists.forEach(group => {
          if (doc.y > doc.page.height - 45) doc.addPage();
          doc.fillColor(ink).font('Helvetica-Bold').fontSize(8).text(group.label, doc.page.margins.left);
          doc.moveDown(0.15);
          const itemBoxes = group.items.map(item => `[   ] ${item}`).join('     ');
          doc.fillColor(muted).font('Helvetica').fontSize(7.5).text(itemBoxes, doc.page.margins.left + 6, doc.y, { width: pageWidth - 12 });
          doc.moveDown(0.35);
        });

        // Section 3: Etapas del Trabajo
        drawSectionHeader('3. ETAPAS DEL TRABAJO PLANIFICADAS (PASO A PASO)');
        const stageThY = doc.y;
        doc.rect(doc.page.margins.left, stageThY, pageWidth, 16).fillAndStroke(bgCard, lineGray);
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.5);
        doc.text('PASO', doc.page.margins.left + 5, stageThY + 4, { width: 30 });
        doc.text('DESCRIPCIÓN DE LA TAREA', doc.page.margins.left + 40, stageThY + 4, { width: 230 });
        doc.text('RIESGOS ASOCIADOS', doc.page.margins.left + 280, stageThY + 4, { width: 110 });
        doc.text('MEDIDAS DE CONTROL', doc.page.margins.left + 400, stageThY + 4, { width: 110 });
        doc.y = stageThY + 18;

        for (let i = 1; i <= 4; i++) {
          const rowY = doc.y;
          doc.rect(doc.page.margins.left, rowY, pageWidth, 22).stroke(lineGray);
          doc.fillColor(brandRed).font('Helvetica-Bold').fontSize(8).text(String(i), doc.page.margins.left + 10, rowY + 7);
          doc.y = rowY + 25;
        }

        // Section 4: Charla de Seguridad
        drawSectionHeader('4. CHARLA DE SEGURIDAD (5 MINUTOS OBLIGATORIA)');
        const talkY = doc.y;
        doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('Tema tratado:', doc.page.margins.left, talkY);
        doc.rect(doc.page.margins.left + 65, talkY + 9, 230, 0.5).fill(lineGray);
        doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('Hora inicio:', doc.page.margins.left + 305, talkY);
        doc.rect(doc.page.margins.left + 360, talkY + 9, 45, 0.5).fill(lineGray);
        doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('Duración:', doc.page.margins.left + 415, talkY);
        doc.rect(doc.page.margins.left + 460, talkY + 9, 35, 0.5).fill(lineGray);
        doc.y = talkY + 16;

        // Section 5: Nómina y Toma de Conocimiento
        if (doc.y > doc.page.height - 200) doc.addPage();
        drawSectionHeader('5. NÓMINA DE ASISTENCIA Y TOMA DE CONOCIMIENTO');
        doc.fillColor(muted).font('Helvetica').fontSize(7.5).text('Los participantes declaran haber recibido la inducción de seguridad y disponer de su EPP reglamentario.');
        doc.moveDown(0.25);

        const thY = doc.y;
        doc.rect(doc.page.margins.left, thY, pageWidth, 16).fillAndStroke(bgCard, lineGray);
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.5);
        doc.text('N°', doc.page.margins.left + 5, thY + 4, { width: 20 });
        doc.text('NOMBRE COMPLETO DEL ESTUDIANTE', doc.page.margins.left + 30, thY + 4, { width: 220 });
        doc.text('MATRÍCULA / RUT', doc.page.margins.left + 260, thY + 4, { width: 90 });
        doc.text('ESTADO', doc.page.margins.left + 360, thY + 4, { width: 70 });
        doc.text('FIRMA CONFORMIDAD', doc.page.margins.left + 435, thY + 4, { width: 80 });
        doc.y = thY + 18;

        for (let i = 1; i <= 14; i++) {
          if (doc.y > doc.page.height - 35) doc.addPage();
          const rY = doc.y;
          doc.rect(doc.page.margins.left, rY, pageWidth, 16).stroke(lineGray);
          doc.fillColor(muted).font('Helvetica').fontSize(7.5).text(String(i), doc.page.margins.left + 7, rY + 4);
          doc.text('[ ] P   [ ] At   [ ] Aus', doc.page.margins.left + 360, rY + 4);
          doc.y = rY + 18;
        }

        // Section 6: Firmas de Responsabilidad
        if (doc.y > doc.page.height - 65) doc.addPage();
        doc.moveDown(0.5);
        const sigY = doc.y;
        const sigW = (pageWidth - 40) / 2;
        doc.rect(doc.page.margins.left + 20, sigY + 28, sigW - 40, 0.5).fill(ink);
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.5).text('Firma y Nombre Docente Responsable', doc.page.margins.left + 20, sigY + 33, { width: sigW - 40, align: 'center' });

        doc.rect(doc.page.margins.left + sigW + 40, sigY + 28, sigW - 40, 0.5).fill(ink);
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.5).text('Firma Pañolero / Supervisor de Taller', doc.page.margins.left + sigW + 40, sigY + 33, { width: sigW - 40, align: 'center' });

      } else {
        // -------------------------------------------------------------
        // CASE B: FILLED RECORD (OFFICIAL ASAA ARCHIVE)
        // -------------------------------------------------------------
        // Brand Title
        doc.fillColor(brandRed).font('Helvetica-Bold').fontSize(10).text('INACAP · SEGURIDAD EN TALLERES Y LABORATORIOS', { characterSpacing: 1 });
        doc.fillColor(ink).fontSize(16).text('FICHA DE ACTIVIDAD ACADÉMICA SEGURA (ASAA)', { characterSpacing: 0.5 });
        doc.fillColor(muted).font('Helvetica').fontSize(9).text('Registro institucional trazable de análisis de riesgos y participación académica.');
        doc.moveDown(0.6);

        // Status Pill & Code Banner
        const statusLabel = {
          open: 'EN CURSO',
          closed: 'CERRADA',
          correction_pending: 'CORRECCIÓN PENDIENTE',
          correction_open: 'CORRECCIÓN APROBADA',
        }[record.status] || (record.status || 'REGISTRADA').toUpperCase();

        const bannerY = doc.y;
        doc.rect(doc.page.margins.left, bannerY, pageWidth, 32).fillAndStroke(bgCard, lineGray);

        doc.fillColor(brandRed).font('Helvetica-Bold').fontSize(9)
          .text(`CÓDIGO: ${record.code || record.id}`, doc.page.margins.left + 12, bannerY + 11, { width: 340, lineBreak: false });

        doc.fillColor(record.status === 'closed' ? '#15804d' : '#b45309')
          .font('Helvetica-Bold').fontSize(9)
          .text(`ESTADO: ${statusLabel}`, doc.page.margins.left + pageWidth - 140, bannerY + 11, { width: 130, align: 'right' });

        doc.y = bannerY + 40;

        // Helper to draw two-column key-values
        const drawFieldGrid = (fields) => {
          const colWidth = (pageWidth - 10) / 2;
          for (let i = 0; i < fields.length; i += 2) {
            if (doc.y > doc.page.height - 65) doc.addPage();
            const startY = doc.y;
            const left = fields[i];
            const right = fields[i + 1];

            // Left col
            doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(left.label.toUpperCase(), doc.page.margins.left, startY, { width: colWidth });
            doc.fillColor(ink).font('Helvetica-Bold').fontSize(9).text(String(left.value || '—'), doc.page.margins.left, startY + 10, { width: colWidth });
            const leftEndY = doc.y;

            // Right col
            let rightEndY = startY;
            if (right) {
              doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(right.label.toUpperCase(), doc.page.margins.left + colWidth + 10, startY, { width: colWidth });
              doc.fillColor(ink).font('Helvetica-Bold').fontSize(9).text(String(right.value || '—'), doc.page.margins.left + colWidth + 10, startY + 10, { width: colWidth });
              rightEndY = doc.y;
            }

            doc.y = Math.max(leftEndY, rightEndY) + 5;
          }
        };

        // Helper for tag / item list
        const drawTagList = (label, items) => {
          if (doc.y > doc.page.height - 60) doc.addPage();
          doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(label.toUpperCase(), doc.page.margins.left);
          doc.moveDown(0.1);
          if (!items || !items.length) {
            doc.fillColor(ink).font('Helvetica-Oblique').fontSize(8.5).text('Ninguno seleccionado');
          } else {
            doc.fillColor(ink).font('Helvetica').fontSize(8.5).text(items.join('  •  '), { width: pageWidth });
          }
          doc.moveDown(0.4);
        };

        // SECTION 1: DATOS GENERALES
        drawSectionHeader('1. DATOS GENERALES DE LA ACTIVIDAD');
        drawFieldGrid([
          { label: 'Actividad o Trabajo', value: record.activity },
          { label: 'Tipo de Actividad', value: record.type },
          { label: 'Fecha de Realización', value: formatDate(record.date) },
          { label: 'Docente Responsable', value: record.docente },
          { label: 'Sede Institucional', value: record.sede || '—' },
          { label: 'Lugar / Taller / Laboratorio', value: record.place },
          { label: 'Especialidad', value: record.specialty || '—' },
          { label: 'Asignatura y Sección', value: record.section || 'Sin sección' },
          { label: 'Nivel Técnico', value: record.level || '—' },
          { label: 'Modo de Registro', value: record.paper ? 'Transcrita desde documento físico' : 'Registro Digital Directo' },
        ]);

        if (record.type === 'Práctica') {
          // SECTION 2: ANÁLISIS DE SEGURIDAD
          drawSectionHeader('2. ANÁLISIS DE RIESGOS Y MEDIDAS DE CONTROL');
          drawTagList('Equipos y Herramientas de Apoyo', record.equipment);
          drawTagList('Equipo de Protección Personal (EPP)', record.ppe);
          drawTagList('Condiciones Ambientales e Instalación', record.environment);
          drawTagList('Riesgos Asociados Identificados', record.risks);
          drawTagList('Medidas de Control Preventivo', record.controls);

          // Etapas de trabajo
          if (record.stages && record.stages.length) {
            if (doc.y > doc.page.height - 80) doc.addPage();
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(9).text('ETAPAS DEL TRABAJO PLANIFICADAS:');
            doc.moveDown(0.2);

            record.stages.forEach((stage, idx) => {
              if (doc.y > doc.page.height - 70) doc.addPage();
              const stageBoxY = doc.y;
              doc.rect(doc.page.margins.left, stageBoxY, pageWidth, 1).fill(lineGray);
              doc.y = stageBoxY + 4;
              doc.fillColor(brandRed).font('Helvetica-Bold').fontSize(8.5).text(`Paso ${idx + 1}: `, { continued: true });
              doc.fillColor(ink).font('Helvetica-Bold').fontSize(8.5).text(stage.description || 'Sin descripción');
              if (stage.risks?.length) {
                doc.fillColor(muted).font('Helvetica').fontSize(8).text(`   Riesgos: `, { continued: true });
                doc.fillColor(ink).text(stage.risks.join(', '));
              }
              if (stage.controls?.length) {
                doc.fillColor(muted).font('Helvetica').fontSize(8).text(`   Controles: `, { continued: true });
                doc.fillColor(ink).text(stage.controls.join(', '));
              }
              doc.moveDown(0.2);
            });
            doc.moveDown(0.4);
          }

          // LOTO, FAR, Observaciones
          drawFieldGrid([
            { label: 'Bloqueo y Etiquetado (LOTO)', value: record.loto ? 'SÍ APLICA' : 'NO APLICA' },
            { label: 'Estudiantes con Dificultad (FAR)', value: record.far ? `SÍ (N° lista: ${record.farList || 'por verificar'})` : 'NO' },
            { label: 'Personal Ejecutante', value: (record.executionStaff || []).join(', ') || 'No registrado' },
            { label: 'Observaciones de Seguridad', value: record.observations || 'Sin observaciones adicionales' },
          ]);

          // SECTION 3: CHARLA DE SEGURIDAD
          drawSectionHeader('3. CHARLA DE SEGURIDAD Y TOMA DE CONOCIMIENTO');
          drawFieldGrid([
            { label: 'Tema de la Charla', value: record.talkTopic || '—' },
            { label: 'Estado de la Charla', value: record.talkDone ? 'REALIZADA' : 'PENDIENTE / NO CONFIRMADA' },
            { label: 'Hora de Inicio', value: record.talkStart || '—' },
            { label: 'Duración Estimada', value: record.talkDuration ? `${record.talkDuration} minutos` : '—' },
          ]);

          // SECTION 4: NÓMINA DE PARTICIPACIÓN
          drawSectionHeader('4. NÓMINA Y REGISTRO DE PARTICIPANTES');
          const roster = record.attendance || [];
          const presentCount = roster.filter(p => p.state === 'Presente').length;
          const lateCount = roster.filter(p => p.state === 'Atraso').length;
          const absentCount = roster.filter(p => p.state === 'Ausente').length;
          const pendingCount = roster.filter(p => p.state === 'Pendiente').length;

          doc.fillColor(muted).font('Helvetica').fontSize(8.5)
            .text(`Resumen: ${roster.length} inscritos  |  ${presentCount} presentes  |  ${lateCount} atrasos  |  ${absentCount} ausentes  |  ${pendingCount} pendientes`);
          doc.moveDown(0.4);

          if (!roster.length) {
            doc.fillColor(muted).font('Helvetica-Oblique').fontSize(8.5).text('No se registraron participantes individuales en esta ficha.');
          } else {
            // Table Header
            if (doc.y > doc.page.height - 70) doc.addPage();
            const thY = doc.y;
            doc.rect(doc.page.margins.left, thY, pageWidth, 18).fillAndStroke(bgCard, lineGray);
            doc.fillColor(ink).font('Helvetica-Bold').fontSize(8);
            doc.text('ESTUDIANTE / PARTICIPANTE', doc.page.margins.left + 8, thY + 5, { width: 230 });
            doc.text('ESTADO', doc.page.margins.left + 245, thY + 5, { width: 90 });
            doc.text('MÉTODO DE REGISTRO', doc.page.margins.left + 340, thY + 5, { width: 100 });
            doc.text('HORA', doc.page.margins.left + 445, thY + 5, { width: 70, align: 'right' });
            doc.y = thY + 22;

            roster.forEach((person, idx) => {
              if (doc.y > doc.page.height - 45) {
                doc.addPage();
                const nextThY = doc.y;
                doc.rect(doc.page.margins.left, nextThY, pageWidth, 18).fillAndStroke(bgCard, lineGray);
                doc.fillColor(ink).font('Helvetica-Bold').fontSize(8);
                doc.text('ESTUDIANTE / PARTICIPANTE', doc.page.margins.left + 8, nextThY + 5, { width: 230 });
                doc.text('ESTADO', doc.page.margins.left + 245, nextThY + 5, { width: 90 });
                doc.text('MÉTODO DE REGISTRO', doc.page.margins.left + 340, nextThY + 5, { width: 100 });
                doc.text('HORA', doc.page.margins.left + 445, nextThY + 5, { width: 70, align: 'right' });
                doc.y = nextThY + 22;
              }
              const rowY = doc.y;
              if (idx % 2 === 1) {
                doc.rect(doc.page.margins.left, rowY - 2, pageWidth, 16).fill('#fbfcfd');
              }
              doc.fillColor(ink).font('Helvetica').fontSize(8);
              doc.text(
                person.name + (person.matricula ? ` (${person.matricula})` : ''),
                doc.page.margins.left + 8,
                rowY,
                { width: 230 }
              );

              const stateColor = person.state === 'Presente' ? '#15804d' : person.state === 'Atraso' ? '#b45309' : person.state === 'Ausente' ? '#b91c1c' : '#606773';
              doc.fillColor(stateColor).font('Helvetica-Bold').text(person.state || 'Pendiente', doc.page.margins.left + 245, rowY, { width: 90 });

              doc.fillColor(muted).font('Helvetica').text(person.method || 'Registro docente', doc.page.margins.left + 340, rowY, { width: 100 });
              const timeStr = person.time ? String(person.time).slice(11, 16) : '—';
              doc.text(timeStr, doc.page.margins.left + 445, rowY, { width: 70, align: 'right' });
              doc.y = rowY + 16;
            });
          }
        }

        // SECTION 5: FIRMA Y TRAZABILIDAD
        drawSectionHeader('5. VALIDEZ, TRAZABILIDAD Y CIERRE');
        const now = new Date();
        const exportTimestamp = now.toLocaleString('es-CL', { timeZone: 'America/Santiago' });
        drawFieldGrid([
          { label: 'Propietario / Creador', value: `${record.ownerName || 'Usuario'} (UID: ${record.ownerUid || '—'})` },
          { label: 'Fecha de Exportación PDF', value: `${exportTimestamp} (Hora de Chile)` },
          { label: 'Identificador Interno Firestore', value: record.id },
          { label: 'Cierre Institucional', value: record.closedAt ? 'Cerrada formalmente con bloqueo de edición' : 'Ficha en preparación' },
        ]);
      }

      // Add Footer & Page Numbers across all buffered pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const footerY = doc.page.height - 35;
        doc.rect(doc.page.margins.left, footerY - 5, pageWidth, 0.5).fill(lineGray);
        doc.fillColor(muted).font('Helvetica').fontSize(7.5);
        doc.text(
          record.isTemplate
            ? 'ASAA · Formato oficial para registro manuscrito en terreno · INACAP · Una vez finalizada la actividad, transcribir a la plataforma'
            : 'Documento oficial generado por la plataforma ASAA · INACAP · Todos los derechos reservados · Sujeto a auditoría inmutable',
          doc.page.margins.left,
          footerY,
          { width: pageWidth - 80 }
        );
        doc.text(
          `Página ${i + 1} de ${totalPages}`,
          doc.page.margins.left + pageWidth - 70,
          footerY,
          { width: 70, align: 'right' }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
