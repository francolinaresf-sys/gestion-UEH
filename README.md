# UEH Camas · vista móvil

Vista para celular de la planilla **Listado pacientes U EH 2**. Muestra el resumen de ocupación, los boxes que requieren atención y la lista de boxes por sector. Permite editar el diagnóstico, los pendientes, el destino, la fecha de ingreso y la marca de color.

La página no guarda datos de pacientes. En cada uso los lee y los escribe directamente en la planilla de Google, a través de un puente de Apps Script protegido con una clave del equipo.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página que se publica en GitHub Pages |
| `Code.gs` | El puente entre la página y la planilla (va en Apps Script) |

## Instalación (una vez, unos 10 minutos)

### 1. Puente en la planilla
1. Abrir la planilla → **Extensiones → Apps Script**.
2. Borrar el contenido de `Código.gs` y pegar el contenido de `Code.gs`.
3. En la función `configurarClave`, reemplazar `CAMBIAR_ESTA_CLAVE` por la clave del equipo.
4. Elegir `configurarClave` en el selector de funciones → **Ejecutar**. Autorizar con la cuenta dueña de la planilla.
5. **Implementar → Nueva implementación** → tipo **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
6. Copiar la URL que termina en `/exec`.

### 2. Página en GitHub
1. En `index.html`, pegar esa URL en `CONFIG.API_URL` (cerca del inicio del `<script>`).
2. Subir `index.html` al repositorio → **Settings → Pages** → rama `main`, carpeta raíz.
3. Compartir el enlace de GitHub Pages con los coordinadores, junto con la clave.

> No subas `Code.gs` con la clave real escrita. Después de ejecutar `configurarClave`, la clave queda guardada en las propiedades del script, así que puedes volver a dejar el texto `CAMBIAR_ESTA_CLAVE` en el código.

### 3. Cambiar la clave
Edita el texto en `configurarClave`, ejecútala de nuevo y avisa al equipo. Las sesiones abiertas con la clave anterior piden ingresar otra vez.

### 4. Si modificas `Code.gs`
**Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión.** Así se conserva la misma URL.

## Cómo se mapea la planilla

| En la app | En la planilla |
|---|---|
| Diagnóstico | Columna Diagnóstico del sector |
| Pendientes | **Nota** de la celda Diagnóstico (triángulo negro en la esquina) |
| Destino / cama que necesita | Columna con la lista desplegable (UTI, SALA - M, …) |
| Fecha de ingreso | Columna FI. La Estada sigue calculándose con la fórmula de la planilla |
| Marca | Color de relleno de la celda Diagnóstico, según la leyenda "Significado colores" |
| CAPC y 2 y 2 | Celdas K21 y K22, que suma la fórmula VALECH |
| Liberar box | Borra diagnóstico, pendientes, marca y FI, y deja el destino en LIBRE |

- Todos los números del resumen provienen de las fórmulas de la hoja "Resumen hospitalizados". La ocupación se calcula sobre 74 camillas.
- Cada cambio queda registrado en la hoja **Registro app** (fecha, coordinador y cambio). La hoja se crea sola con el primer cambio.
- Si dos coordinadores editan el mismo box al mismo tiempo, el segundo recibe un aviso y ve los datos nuevos antes de volver a guardar. Así nadie sobrescribe sin darse cuenta.
- La página se actualiza sola cada 60 segundos, y también al volver a abrirla.

## Seguridad
- Con la configuración "Cualquier persona", el acceso queda protegido solo por la clave. Cualquiera que tenga la URL `/exec` y la clave puede leer y editar.
- Si la organización usa Google Workspace, puedes cambiar el acceso a "Cualquier persona de [organización]". En ese caso, la página alojada en GitHub no podrá conectarse, y la alternativa es servir el HTML desde el mismo Apps Script.
