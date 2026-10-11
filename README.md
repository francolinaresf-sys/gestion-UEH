# UEH Camas · vista móvil

Vista para celular de la planilla **Listado pacientes U EH 2**. Muestra el resumen de ocupación, los boxes que requieren atención y la lista de boxes por sector. Permite editar el diagnóstico, los pendientes, el destino, la fecha de ingreso y la marca de color.

La página no guarda datos de pacientes: en cada uso los lee y escribe directamente en la planilla de Google mediante un puente de Apps Script. **No pide usuario ni clave**: quien abre el enlace entra directo.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página que se publica en GitHub Pages |
| `Code.gs` | El puente entre la página y la planilla (va en Apps Script) |

## Instalación (una vez, unos 10 minutos)

### 1. Puente en la planilla
1. Abrir la planilla → **Extensiones → Apps Script**.
2. Borrar el contenido de `Código.gs` y pegar el de `Code.gs`. Guardar.
3. Elegir la función `probar` → **Ejecutar** → autorizar con la cuenta dueña de la planilla.
4. **Implementar → Nueva implementación** → tipo **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
5. Copiar la URL que termina en `/exec`.

### 2. Página en GitHub
1. En `index.html`, pegar esa URL en `CONFIG.API_URL` (inicio del `<script>`).
2. Subir el cambio. GitHub Pages publica en `https://francolinaresf-sys.github.io/gestion-UEH/`.

### 3. Si modificas `Code.gs`
**Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión.** Así se conserva la misma URL.

## Cómo se mapea la planilla

| En la app | En la planilla |
|---|---|
| Diagnóstico | Columna Diagnóstico del sector |
| Pendientes | **Nota** de la celda Diagnóstico (triángulo negro en la esquina) |
| Destino / cama que necesita | Columna con la lista desplegable (UTI, SALA - M, …) |
| Fecha de ingreso | Columna FI. La Estada sigue calculándose con la fórmula de la planilla |
| Marca | Color de relleno de la celda Diagnóstico, según la leyenda "Significado colores" |
| CAPC | Celda K21, que suma la fórmula VALECH |
| Liberar box | Borra diagnóstico, pendientes, marca y FI, y deja el destino en LIBRE |

- Todos los números del resumen provienen de las fórmulas de la hoja "Resumen hospitalizados". La ocupación se calcula sobre 74 camillas.
- Cada cambio queda registrado en la hoja **Registro app** (fecha y cambio). La hoja se crea sola con el primer cambio.
- Si dos coordinadores editan el mismo box al mismo tiempo, el segundo recibe un aviso y ve los datos nuevos antes de volver a guardar. Así nadie sobrescribe sin darse cuenta.
- La página se actualiza sola cada 60 segundos, y también al volver a abrirla.

## Seguridad
- El acceso es abierto: cualquiera que tenga el enlace de la página (o la URL `/exec`) puede leer y editar el tablero. No anotes nombres, RUT ni otros datos que identifiquen a pacientes.
- Para volver a exigir una clave: en Apps Script, cambiar el texto de `configurarClave` y ejecutarla. La página mostrará el aviso correspondiente.
