# Sistema visual de Ahorremax · cuatro retos

Esta vista de selección ayuda a escoger por ritmo y propósito. Cada tarjeta muestra el nombre como texto editable, una miniatura tridimensional, la duración o flexibilidad del método y una acción concreta. Cuando existe un plan, muestra el propósito, el dinero registrado y el avance real de esa cuenta. No se presentan cifras de ejemplo como aportes realizados.

El logo morado y turquesa entregado por el propietario se conserva en `app/assets/ahorremax-logo.png`. Manrope se usa en títulos y cifras; los controles y textos de lectura mantienen la tipografía del resto de la aplicación. El fondo claro permite descansar la vista y las superficies se separan mediante bordes finos y sombras suaves.

| Reto | Color de orientación | Imagen | Decisión que comunica |
| --- | --- | --- | --- |
| La Ruta del Millón | Azul `#396BC3` | Calendario de cerámica azul | Ahorrar cada semana durante 26 semanas |
| Reto Marca y Gana | Verde `#008C70` | Tablero de casillas | Elegir y combinar montos a ritmo propio |
| Reto Turbo | Coral `#DF6B38` | Calendario y monedas ascendentes | Ahorrar diariamente durante 40 días |
| Cumple tu sueño | Violeta `#7847BB` | Alcancía de vidrio | Definir meta, frecuencia y plazo o aporte |

La familia de tarjetas está implementada en `app/challenge-experience.css`. Sus estados de foco, pulsación y selección funcionan también con teclado y pantallas táctiles. Los iconos de los tres retos originales están en `app/assets/icons/` y la alcancía personalizada en `app/assets/dream-jar.webp`. Las piezas anteriores de campaña permanecen en `app/assets/campaign/` como originales del proyecto, pero ya no se muestran ni se precargan en la selección. Cada modo mantiene su propia pantalla de trabajo.

La cuarta modalidad se apoya en `app/dream.css`, `app/dream-feature.mjs`, `src/dream.mjs` y `src/peso-input.mjs`. El formulario permite calcular el aporte a partir de una fecha o proyectar la fecha a partir del aporte. Formatea COP con separador de miles, exige dos confirmaciones al iniciar, permite editar el plan y corregir aportes. El cálculo no incluye intereses ni rendimientos. El dinero permanece en la cuenta, bolsillo o efectivo que elija cada persona; la aplicación registra su declaración de ahorro.

Para publicar el plan personalizado con cuentas reales se deben desplegar **los archivos de la app y `firestore.rules` juntos**. Sus operaciones usan `users/{uid}/plans/dream` y `users/{uid}/dreamOperations/{operationId}`; los tres retos existentes conservan sus documentos y registros. La vista previa local solo permite comprobar la demo. Antes del lanzamiento, prueba en el dominio final el acceso con Google, la escritura y recuperación de los cuatro planes, el aislamiento entre cuentas y la actualización de instalaciones existentes. Facebook sigue pendiente de habilitación en Meta y Firebase.

Genera el paquete con `python3 scripts/package_web.py`. El ZIP de revisión queda en `entregables/Ahorremax-v25-cuatro-retos-preview.zip`. Abre `http://127.0.0.1:4185/` con el servidor local de prueba si está en ejecución. No publiques el paquete ni las reglas hasta aprobar el diseño y completar la verificación con una cuenta real.
