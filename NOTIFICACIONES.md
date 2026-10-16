# Foto y recordatorios de «Cumple tu sueño»

La foto que el cliente elige se recorta en su dispositivo a una proporción 5:3, se convierte a JPEG y se guarda en `users/{uid}/dreamMedia/cover`. El plan y sus aportes permanecen en `users/{uid}/plans/dream`. Cambiar la foto no modifica el ahorro registrado. Las reglas de Firestore limitan la lectura de la imagen y de su historial a la cuenta propietaria. La prueba sin cuenta se borra al salir.

Cuando un aporte previsto no aparece en el registro, la app muestra un aviso al abrir el plan. Calcula la diferencia entre el ahorro programado hasta ayer y el ahorro realmente registrado; un aporte adicional adelantado cubre los siguientes vencimientos. El aviso no descuenta dinero del saldo. Explica que la fecha estimada puede moverse si el ritmo no se retoma.

El envío al celular con la app cerrada está implementado en `functions/index.js`, programado para las 9:00 a. m. de Bogotá. **No queda activo al subir solamente el ZIP**: se necesita la configuración y el despliegue siguientes.

1. En Firebase Console, proyecto `ahorremax-c1e48`, abre Configuración del proyecto → Cloud Messaging → Certificados Web Push. Genera o consulta la **clave pública** VAPID y colócala en `app/firebase-config.mjs` como `webPushVapidKey`. Nunca añadas la clave privada al repositorio.
2. Confirma que el proyecto está en el plan Blaze y que Cloud Scheduler y Cloud Messaging están disponibles. Las funciones programadas usan Cloud Scheduler y pueden generar cargos; revisa la estimación antes de desplegar.
3. Con una sesión autorizada de Firebase CLI, despliega las reglas, el índice y la función: `firebase deploy --only firestore:rules,firestore:indexes,functions:sendDreamReminders --project ahorremax-c1e48`. Espera a que el índice esté listo. Después genera y publica el paquete web actualizado en el dominio HTTPS.
4. En un teléfono de prueba, inicia sesión, abre «Cumple tu sueño» y toca «Activar avisos al celular». Acepta el permiso del sistema. En iPhone o iPad, instala primero la app en la pantalla de inicio. Comprueba que la imagen y el plan reaparecen al volver a entrar con la misma cuenta.
5. Haz una prueba controlada con un plan de prueba cuyo aporte haya quedado pendiente desde el día anterior. Verifica un solo aviso a las 9:00 a. m. y consulta `users/{uid}/reminderDeliveries` si hay un fallo. El texto de la notificación evita mostrar cifras o nombres de metas en la pantalla bloqueada.

Al desactivar los avisos o cerrar sesión, la app elimina el registro de ese dispositivo. Los demás dispositivos de la misma cuenta conservan su configuración. El servidor comprueba de nuevo el plan antes de enviar y no notifica si la meta ya se cumplió o si los ahorros registrados cubren el importe programado.
