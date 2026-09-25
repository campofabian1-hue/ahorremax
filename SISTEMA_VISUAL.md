# Sistema visual de Ahorremax

Esta versión rediseña los tres retos actuales. La persona elige un método, define para qué ahorra y dónde guardará el dinero, registra aportes manualmente y revisa su avance. Presupuestos, viajes y proyectos quedan para versiones futuras. El rediseño conserva el logo original, la autenticación, las reglas de ahorro y el historial.

## Dirección

La identidad combina el violeta del logo de Ahorremax con menta para el avance. El fondo marfil y las superficies blancas dejan descansar la vista durante el trabajo. Cada reto tiene un color y un objeto tridimensional propio: azul para las 26 semanas, verde para las 200 casillas flexibles y coral para los 40 días. Las cifras y la siguiente acción tienen prioridad sobre la decoración.

| Función | Valor | Uso |
| --- | --- | --- |
| Marca | `#6032BD` | Acción principal, foco, selección y progreso |
| Marca profunda | `#402183` | Texto y controles sobre fondos claros |
| Avance | `#23B88E` | Progreso y acentos positivos |
| Texto | `#28233D` | Cifras, títulos y contenido principal |
| Texto secundario | `#675F76` | Ayudas y etiquetas |
| Lienzo | `#F8F7F4` | Fondo de la aplicación |
| Semanal | `#4169BF` | Reto de 26 semanas |
| Flexible | `#117E69` | Reto de 200 casillas |
| Diario | `#A95432` | Reto de 40 días |

La tipografía combina Manrope para títulos y cifras con la fuente de lectura ya incorporada en la aplicación. Los tokens de color, radio, sombra y movimiento están centralizados en `app/studio.css` (en el ZIP, `studio.css`). Las tarjetas usan una iluminación suave, bordes tenues y sombras de contacto consistentes. Los botones principales tienen profundidad moderada y respuesta de presión.

## Recursos

El logo entregado por el propietario permanece en `app/assets/ahorremax-logo.png`. No se redibujó ni se sustituyó.

Cada reto cuenta con un icono individual generado para esta aplicación, sin nombre incrustado. Los archivos de alta resolución y con transparencia se conservan en `app/assets/icons/original/` (en el ZIP, `recursos-originales/`). Las versiones PNG reducidas a un máximo de 512 px, utilizadas en la interfaz y precargadas por el servicio sin conexión, están en `app/assets/icons/` (en el ZIP, `assets/icons/`).

| Reto | Metáfora visual | Recurso optimizado |
| --- | --- | --- |
| 26 semanas | Agenda de cerámica azul, monedas y marca de avance | `app/assets/icons/weekly.png` |
| 200 casillas | Bandeja de cerámica menta y monedas | `app/assets/icons/flexible.png` |
| 40 días | Agenda de cerámica coral y monedas ascendentes | `app/assets/icons/daily.png` |

## Comportamiento y adaptación

Los accesos a retos muestran estados de reposo, elevación al pasar el cursor, presión, foco de teclado y reto activo. Los controles de aportes conservan selección, completado y deshabilitado; el formulario conserva validación nativa. El sistema contiene estilos para un estado de carga mediante `aria-busy` o `.is-loading`, disponible para un futuro ajuste de la capa de interacción. La versión actual mantiene su bloqueo de operaciones duplicadas en la lógica existente, pero no añade un indicador visual de progreso durante el guardado.

Los movimientos son breves. La aparición de tarjetas comunica el cambio de pantalla sin retrasar formularios ni registros. `prefers-reduced-motion` elimina las animaciones no esenciales. La navegación inferior y la cabecera se mantienen visibles en móvil; el contenido usa dos o tres columnas según el ancho y una sola columna en teléfonos. Se conservan los textos editables y las etiquetas accesibles del código existente.

## Configuración y publicación

Ejecuta `python3 scripts/package_web.py` desde la carpeta del proyecto. El ZIP resultante queda en `entregables/Ahorremax-v5-cuentas-historial.zip`. Extrae el contenido antes de probarlo. Para publicarlo, sube **todo** el contenido del ZIP a una carpeta de tu hosting; `index.html`, `app.js`, las hojas de estilo, el manifiesto, `sw.js` y `assets/` deben permanecer juntos. HTTPS es necesario para instalar la aplicación en el celular y utilizar las cuentas.

Google y el historial real dependen de la configuración de Firebase y de que el dominio final esté autorizado. Facebook requiere completar la configuración en Meta y Firebase. Antes de lanzar a usuarios, se debe probar en el dominio final el inicio de sesión, el registro y la lectura de aportes, la recuperación de sesión y el aislamiento entre dos cuentas. La vista local en modo demo utiliza aportes temporales y no confirma que la sincronización real funcione.
