# Ahorremax

Aplicación web instalable para registrar manualmente el ahorro. Ofrece tres recorridos hacia $1.000.000 COP —26 semanas, 200 días con 200 casillas flexibles y 40 días— y un cuarto reto, **Cumple tu sueño**, en el que cada persona define su meta, frecuencia y plazo o aporte. El dinero permanece donde la persona decida; Ahorremax no accede a cuentas bancarias ni ejecuta transferencias.

**Abrir e instalar:** https://fcfinanzas.com/app/ahorremax/ (la dirección anterior de GitHub Pages redirige aquí).

**Paquete para otro sitio web:** ejecuta `python3 scripts/package_web.py` para generar el ZIP actualizado en `entregables/`. Extrae todo el contenido y sube los archivos a una carpeta del sitio, manteniendo `index.html` en esa carpeta. Autoriza el dominio en Firebase Authentication y comprueba allí el acceso con Google antes de distribuirlo.

## Qué guarda cada cuenta

Firebase Authentication identifica a cada persona. Cloud Firestore conserva los tres planes fijos en `users/{uid}/plans/{mode}` (`weekly`, `flexible`, `daily`) y el plan personalizado en `users/{uid}/plans/dream`. Los planes anteriores siguen en `users/{uid}/plans/active` y se muestran en su modalidad original, sin mover ni borrar sus aportes. Los retos fijos registran operaciones en `users/{uid}/operations/{operationId}`; Cumple tu sueño registra su creación, aportes y correcciones en `users/{uid}/dreamOperations/{operationId}`. La foto elegida se guarda aparte en `users/{uid}/dreamMedia/cover`, con historial privado en `dreamMediaOperations`. Cada cambio y su evento se escriben en una transacción. Las reglas comprueban el UID, la estructura de los datos y la escritura conjunta.

El historial de actividad comienza con la publicación de esta versión. Los aportes anteriores que sigan vigentes se mantienen en el plan; las correcciones antiguas que no quedaron guardadas en el modelo anterior no se pueden reconstruir. El registro es una declaración manual del usuario, no una certificación bancaria.

## Probar y construir

```bash
node --test tests/*.test.mjs tests/*.test.cjs
python3 scripts/build_pages.py
```

`docs/` contiene el sitio estático listo para GitHub Pages. `scripts/package_web.py` genera un ZIP para otros hostings en `entregables/`. Al abrir ese ZIP por `file://`, solo funciona la demostración temporal; las cuentas requieren HTTPS o un servidor local autorizado.

## Publicar

El flujo de GitHub Actions valida la lógica, construye la PWA y publica `docs/` en GitHub Pages cuando se actualiza `main`. Esa URL redirige al sitio principal para mantener una sola instalación y un origen de acceso con Google. En Settings → Pages, la fuente debe ser **GitHub Actions**.

Firebase Hosting publica `https://ahorremax-c1e48.web.app/` como enlace de entrada que dirige al sitio principal. Esto evita un inicio de sesión separado en un dominio que Google no reconoce como origen de OAuth. Para actualizarlo después de probar los cambios: `python3 scripts/build_pages.py && firebase deploy --only hosting,firestore:rules --project ahorremax-c1e48`. El sitio `fcfinanzas.com/app/ahorremax/` se publica desde el repositorio privado `fc-finanzas-estrategias` mediante Netlify; conserva allí su configuración de seguridad y metadatos propios.

Firebase ya usa el proyecto `ahorremax-c1e48`. Las reglas se validan y publican con:

```bash
firebase deploy --only firestore:rules --project ahorremax-c1e48 --dry-run
firebase deploy --only firestore:rules --project ahorremax-c1e48
```

El acceso con Google está configurado. Facebook permanece deshabilitado hasta completar su aplicación de Meta, el proveedor en Firebase y la comprobación del flujo. No se deben incluir secretos de Meta o claves privadas en este repositorio. La configuración web pública de Firebase está en `app/firebase-config.mjs`.

Los avisos por aporte pendiente aparecen dentro del reto. El envío push al celular con la app cerrada está preparado para las 9:00 a. m. de Bogotá, pero necesita la clave pública VAPID, el plan Blaze, el despliegue de `functions:sendDreamReminders` y una prueba real por dispositivo. Sigue [NOTIFICACIONES.md](NOTIFICACIONES.md); subir el ZIP por sí solo no activa ese servicio.

## Instalar en el celular

Abre el sitio HTTPS y usa **Instalar Ahorremax en mi celular** cuando el navegador lo permita. En Safari para iPhone, usa Compartir → Agregar a pantalla de inicio. El guardado de operaciones de una cuenta requiere conexión con Firebase; la demostración sin cuenta no sincroniza datos.

El diseño y los iconos se documentan en [SISTEMA_VISUAL.md](SISTEMA_VISUAL.md). Presupuestos, viajes y proyectos son módulos futuros.
