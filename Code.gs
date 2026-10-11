/**
 * UEH Camas · API para la vista móvil
 * Planilla: "Listado pacientes U EH 2"
 *
 * Instalación (una sola vez):
 *  1. Abrir la planilla → Extensiones → Apps Script. Pegar este archivo completo.
 *  2. Ejecutar la función `configurarClave` (menú ▶). Autorizar con la cuenta dueña.
 *     Antes, cambiar el texto CAMBIAR_ESTA_CLAVE por la clave del equipo.
 *  3. Implementar → Nueva implementación → Tipo: Aplicación web
 *       Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier persona
 *  4. Copiar la URL /exec y pegarla en CONFIG.API_URL de index.html.
 *
 * La página no guarda datos: los lee y escribe aquí, en la planilla.
 */

const HOJA_CAMAS = 'S. Urgencia';
const HOJA_RESUMEN = 'Resumen hospitalizados';
const HOJA_TELEFONOS = 'Numeros teléfono';
const HOJA_GES = 'GES';
const HOJA_REGISTRO = 'Registro app'; // se crea sola con el primer cambio
const REGISTRAR_CAMBIOS = true;

// col = columna del BOX (1 = A). Completo: BOX, FI, Estada, Destino, Diagnóstico.
const SECTORES = [
  { id: 'P3',  nombre: 'Pasillo 3',  col: 1,  desde: 2,  hasta: 12, tipo: 'completo' },
  { id: 'P2',  nombre: 'Pasillo 2',  col: 6,  desde: 2,  hasta: 13, tipo: 'completo' },
  { id: 'P1',  nombre: 'Pasillo 1',  col: 11, desde: 2,  hasta: 8,  tipo: 'completo' },
  { id: 'CR',  nombre: 'Críticos',   col: 16, desde: 2,  hasta: 16, tipo: 'completo' },
  { id: 'EX',  nombre: 'Extensión',  col: 21, desde: 2,  hasta: 25, tipo: 'completo' },
  { id: 'PA',  nombre: 'PreAlta',    col: 26, desde: 2,  hasta: 7,  tipo: 'completo' },
  // Boxes de urgencia que habitualmente no tienen hospitalizados: solo BOX + Diagnóstico
  { id: 'C34', nombre: 'Hospitalizados en C3-4', col: 14, desde: 13, hasta: 24, tipo: 'simple' }
];

// Leyenda "Significado colores" de la planilla (relleno manual de la celda Diagnóstico)
const MARCAS = {
  reevaluar:  { nombre: 'Reevaluar',            hex: '#ff0000' },
  asignada:   { nombre: 'Cama asignada o alta', hex: '#93c47d' },
  pendientes: { nombre: 'Pendientes',           hex: '#ffff00' },
  trasladar:  { nombre: 'Por trasladar',        hex: '#8e7cc3' },
  ley:        { nombre: 'Ley de Urgencia',      hex: '#a4c2f4' }
};

// Celdas sueltas que alimentan el resumen (ver fórmula VALECH)
const CONTADORES = {
  capc:   { nombre: 'CAPC',  a1: 'K21' },
  dosydos:{ nombre: '2 y 2', a1: 'K22' }
};

function configurarClave() {
  PropertiesService.getScriptProperties().setProperty('CLAVE', 'CAMBIAR_ESTA_CLAVE');
}

/* ---------------- HTTP ---------------- */

function doGet(e) {
  try {
    if (!claveValida_(e.parameter.clave)) return json_({ ok: false, error: 'clave' });
    return json_({ ok: true, estado: leerEstado_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const req = JSON.parse(e.postData.contents);
    if (!claveValida_(req.clave)) return json_({ ok: false, error: 'clave' });
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(HOJA_CAMAS);
    let detalle = '';

    if (req.accion === 'box') {
      detalle = editarBox_(sh, req);
      if (detalle && detalle.conflicto) {
        return json_({ ok: false, error: 'conflicto', estado: leerEstado_() });
      }
    } else if (req.accion === 'contador') {
      const c = CONTADORES[req.id];
      if (!c) throw new Error('Contador desconocido');
      const n = Math.max(0, Math.round(Number(req.valor) || 0));
      sh.getRange(c.a1).setValue(n);
      detalle = c.nombre + ' = ' + n;
    } else {
      throw new Error('Acción desconocida');
    }

    SpreadsheetApp.flush();
    registrar_(ss, req.autor, detalle);
    return json_({ ok: true, estado: leerEstado_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ---------------- Lectura ---------------- */

function leerEstado_() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const sh = ss.getSheetByName(HOJA_CAMAS);
  const rango = sh.getRange(1, 1, 26, 30);
  const val = rango.getValues();
  const txt = rango.getDisplayValues();
  const bg = rango.getBackgrounds();
  const notas = rango.getNotes();

  const sectores = SECTORES.map(function (s) {
    const c = s.col - 1;
    const cDx = s.tipo === 'completo' ? c + 4 : c + 1;
    const cDest = c + 3;
    const boxes = [];
    for (let f = s.desde; f <= s.hasta; f++) {
      const r = f - 1;
      const box = String(txt[r][c]).trim();
      if (!box) continue;
      const item = {
        fila: f,
        box: box,
        dx: limpiar_(txt[r][cDx]),
        nota: notas[r][cDx] || '',
        marca: marcaDeColor_(bg[r][cDx]) || (s.tipo === 'completo' ? marcaDeColor_(bg[r][cDest]) : '')
      };
      if (s.tipo === 'completo') {
        item.fi = fechaIso_(val[r][c + 1], tz);
        item.fiTexto = limpiar_(txt[r][c + 1]);
        item.destino = limpiar_(txt[r][cDest]);
      }
      boxes.push(item);
    }
    return { id: s.id, nombre: s.nombre, tipo: s.tipo, boxes: boxes };
  });

  // Resumen: se usan los valores calculados por la propia planilla
  const res = ss.getSheetByName(HOJA_RESUMEN).getRange('A2:B13').getDisplayValues();
  const resumen = {};
  res.forEach(function (fila) { if (fila[0]) resumen[String(fila[0]).trim()] = fila[1]; });

  const extras = {
    extensionables: txt[20][17],   // R21
    chuapeables: txt[21][17],      // R22
    disponiblesExtPa: txt[13][29]  // AD14
  };
  const contadores = {};
  Object.keys(CONTADORES).forEach(function (k) {
    contadores[k] = { nombre: CONTADORES[k].nombre, valor: Number(sh.getRange(CONTADORES[k].a1).getValue()) || 0 };
  });

  // Opciones de destino tomadas de la validación de la planilla
  let opciones = [];
  const dv = sh.getRange('D2').getDataValidation();
  if (dv) opciones = (dv.getCriteriaValues()[0] || []).map(String);

  const telefonos = ss.getSheetByName(HOJA_TELEFONOS).getRange('A1:F30').getDisplayValues();
  const ges = ss.getSheetByName(HOJA_GES).getRange('B2').getDisplayValue();

  return {
    leido: new Date().toISOString(),
    hoy: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
    sectores: sectores,
    resumen: resumen,
    extras: extras,
    contadores: contadores,
    opciones: opciones,
    marcas: MARCAS,
    telefonos: telefonos,
    ges: ges
  };
}

/* ---------------- Escritura ---------------- */

function editarBox_(sh, req) {
  const s = SECTORES.filter(function (x) { return x.id === req.sector; })[0];
  if (!s) throw new Error('Sector desconocido');
  const f = Number(req.fila);
  if (!(f >= s.desde && f <= s.hasta)) throw new Error('Fila fuera del sector');

  const c = s.col;
  const cDx = s.tipo === 'completo' ? c + 4 : c + 1;
  const cDest = c + 3;
  const celDx = sh.getRange(f, cDx);
  const celDest = s.tipo === 'completo' ? sh.getRange(f, cDest) : null;
  const box = String(sh.getRange(f, c).getDisplayValue()).trim();

  // Control de concurrencia: si otro coordinador cambió el box, no se sobrescribe
  const esperado = req.esperado || {};
  if (limpiar_(celDx.getDisplayValue()) !== (esperado.dx || '')) return { conflicto: true };
  if (celDest && limpiar_(celDest.getDisplayValue()) !== (esperado.destino || '')) return { conflicto: true };

  const cambios = req.cambios || {};
  const log = [];

  if (req.liberar) {
    celDx.clearContent().clearNote().setBackground(null);
    if (celDest) {
      celDest.setValue('LIBRE');
      if (marcaDeColor_(celDest.getBackground())) celDest.setBackground(null);
      sh.getRange(f, c + 1).clearContent();
    }
    return s.nombre + ' box ' + box + ': liberado';
  }

  if ('dx' in cambios) { celDx.setValue(String(cambios.dx)); log.push('dx'); }
  if ('nota' in cambios) {
    if (cambios.nota) celDx.setNote(String(cambios.nota)); else celDx.clearNote();
    log.push('pendientes');
  }
  if ('marca' in cambios) {
    const m = MARCAS[cambios.marca];
    celDx.setBackground(m ? m.hex : null);
    if (celDest && marcaDeColor_(celDest.getBackground())) celDest.setBackground(null);
    log.push('marca=' + (m ? m.nombre : 'sin marca'));
  }
  if (celDest && 'destino' in cambios) { celDest.setValue(String(cambios.destino)); log.push('destino=' + cambios.destino); }
  if (s.tipo === 'completo' && 'fi' in cambios) {
    const cel = sh.getRange(f, c + 1);
    if (cambios.fi) {
      const p = String(cambios.fi).split('-').map(Number);
      cel.setValue(new Date(p[0], p[1] - 1, p[2])).setNumberFormat('dd/mm/yyyy');
    } else {
      cel.clearContent();
    }
    log.push('FI');
  }
  return s.nombre + ' box ' + box + ': ' + log.join(', ');
}

function registrar_(ss, autor, detalle) {
  if (!REGISTRAR_CAMBIOS || !detalle) return;
  let h = ss.getSheetByName(HOJA_REGISTRO);
  if (!h) {
    h = ss.insertSheet(HOJA_REGISTRO);
    h.appendRow(['Fecha y hora', 'Coordinador', 'Cambio']);
    h.setFrozenRows(1);
  }
  h.appendRow([new Date(), String(autor || 'sin nombre').slice(0, 60), String(detalle)]);
}

/* ---------------- Utilidades ---------------- */

function claveValida_(clave) {
  const k = PropertiesService.getScriptProperties().getProperty('CLAVE');
  return !!k && clave === k;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function limpiar_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function fechaIso_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return '';
  let y = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (y < 100) y += 2000;
  return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

// Clasifica el color de relleno según la leyenda (tolera tonos parecidos)
function marcaDeColor_(hex) {
  if (!hex || hex.length !== 7) return '';
  const r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 40) return ''; // blancos y grises: sin marca
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 20 || h >= 340) return 'reevaluar';
  if (h >= 40 && h < 70) return 'pendientes';
  if (h >= 70 && h < 170) return 'asignada';
  if (h >= 190 && h < 235) return 'ley';
  if (h >= 235 && h < 300) return 'trasladar';
  return '';
}
