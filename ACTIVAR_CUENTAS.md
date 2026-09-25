# Activar cuentas reales en Ahorremax

El código usa Firebase Authentication y almacenamiento privado por UID en Firestore. El proyecto `ahorremax-c1e48` y la aplicación web Ahorremax Web ya existen. Google está habilitado. El acceso y la lectura de un plan privado se verificaron en localhost; la escritura real y el aislamiento entre dos cuentas aún requieren una prueba de integración. Las reglas de `firestore.rules` se actualizaron y publicaron el 25 de septiembre de 2026. El sitio está publicado en `https://campofabian1-hue.github.io/ahorremax/`. Su dominio debe autorizarse en Firebase Authentication antes de usar Google allí. Facebook sigue pendiente de Meta. La demo usa memoria temporal y nunca se presenta como una cuenta guardada.

1. Completado: proyecto Ahorremax y aplicación web registrados en el plan Spark.
2. Completado: Google habilitado con el correo de soporte del propietario.
3. Para Facebook, crear/configurar la aplicación en Meta for Developers, habilitar Facebook Login y copiar el App ID y App Secret directamente a la configuración del proveedor Facebook en Firebase. Nunca poner el secreto en el código cliente ni en el chat.
4. Añadir a Meta la URI OAuth de retorno indicada por Firebase. Completar los requisitos de Meta para que puedan acceder personas distintas a los desarrolladores/testers.
5. Firestore creado: Standard, `(default)`, ubicación `nam5`, modo producción, plan Spark. Reglas de `firestore.rules` publicadas. Cada aporte y su evento de actividad se escriben en la misma transacción. La comprobación de aislamiento entre usuarios sigue pendiente.
6. Configuración pública incorporada en `app/firebase-config.mjs`. Activar `providersReady` para cada proveedor únicamente después de verificarlo con Firestore.
7. Autorizar `campofabian1-hue.github.io` y cualquier otro dominio HTTPS final en Authentication. Para pruebas locales está autorizado `localhost`: usar http://localhost:4173/app/.
8. Verificar Google y Facebook por separado, cierre/reapertura, cambio de dispositivo, rechazo de acceso de un UID ajeno y conflictos simultáneos. Las cuentas de ambos proveedores no se vinculan automáticamente por coincidencia de correo: se indica usar el proveedor inicial.

Datos: cada usuario tiene `users/{uid}/plans/active` y un historial en `users/{uid}/operations/{operationId}`. El plan guarda aportes con ID, fecha, casillas, monto y atajo utilizado. Una transacción comprueba la revisión antes de escribir y guarda la operación correspondiente; el servidor debe confirmar el guardado antes de mostrar éxito. El cliente calcula el saldo a partir de las casillas y valida los registros recibidos. Las reglas aíslan usuarios y validan la estructura principal; no son un libro bancario ni validan depósitos externos. El historial de operaciones comienza con esta versión; no reconstruye correcciones de versiones anteriores.

Fuentes oficiales:
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/facebook-login
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/manage-data/transactions

Pendiente antes de abrirlo a clientes: prueba de escritura y lectura con una cuenta real, rechazo de lectura con una segunda cuenta, prueba de reglas en emulador, aviso de privacidad con identidad del responsable y validación de instalación en teléfono. No se afirma que estas comprobaciones hayan pasado.
