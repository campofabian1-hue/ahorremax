# Ahorremax

Aplicación web instalable para registrar manualmente el ahorro hacia una meta de $1.000.000 COP. Ofrece tres recorridos: 26 semanas, 200 casillas flexibles y 40 días. El dinero permanece donde la persona decida; Ahorremax no accede a cuentas bancarias ni ejecuta transferencias.

## Qué guarda cada cuenta

Firebase Authentication identifica a cada persona. Cloud Firestore conserva su plan activo en `users/{uid}/plans/active` y un registro de operaciones en `users/{uid}/operations/{operationId}`. Crear un plan, registrar o corregir un aporte y cambiar la meta escriben el plan y un evento de actividad en una sola transacción. Las operaciones no se pueden editar ni eliminar desde el cliente. Las reglas comprueban el UID, la estructura de los datos y que ambos documentos se escriban juntos.

El historial de actividad comienza con la publicación de esta versión. Los aportes anteriores que sigan vigentes se mantienen en el plan; las correcciones antiguas que no quedaron guardadas en el modelo anterior no se pueden reconstruir. El registro es una declaración manual del usuario, no una certificación bancaria.

## Probar y construir

```bash
node --test tests/*.test.mjs
python3 scripts/build_pages.py
```

`docs/` contiene el sitio estático listo para GitHub Pages. `scripts/package_web.py` genera un ZIP para otros hostings en `entregables/`. Al abrir ese ZIP por `file://`, solo funciona la demostración temporal; las cuentas requieren HTTPS o un servidor local autorizado.

## Publicar

El flujo de GitHub Actions valida la lógica, construye la PWA y publica `docs/` en GitHub Pages cuando se actualiza `main`. En Settings → Pages, la fuente debe ser **GitHub Actions**. Para usar un dominio propio, configúralo en GitHub Pages y agrégalo también a los dominios autorizados de Firebase Authentication.

Firebase ya usa el proyecto `ahorremax-c1e48`. Las reglas se validan y publican con:

```bash
firebase deploy --only firestore:rules --project ahorremax-c1e48 --dry-run
firebase deploy --only firestore:rules --project ahorremax-c1e48
```

El acceso con Google está configurado. Facebook permanece deshabilitado hasta completar su aplicación de Meta, el proveedor en Firebase y la comprobación del flujo. No se deben incluir secretos de Meta o claves privadas en este repositorio. La configuración web pública de Firebase está en `app/firebase-config.mjs`.

## Instalar en el celular

Abre el sitio HTTPS y usa **Instalar Ahorremax en mi celular** cuando el navegador lo permita. En Safari para iPhone, usa Compartir → Agregar a pantalla de inicio. El guardado de operaciones de una cuenta requiere conexión con Firebase; la demostración sin cuenta no sincroniza datos.

El diseño y los iconos se documentan en [SISTEMA_VISUAL.md](SISTEMA_VISUAL.md). Presupuestos, viajes y proyectos son módulos futuros.
