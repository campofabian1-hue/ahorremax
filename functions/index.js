const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { pendingDreamAmount } = require('./reminder-logic.cjs');

initializeApp();

exports.sendDreamReminders = onSchedule({
  schedule: '0 9 * * *', timeZone: 'America/Bogota', region: 'us-central1',
  timeoutSeconds: 300, maxInstances: 1,
}, async () => {
  const db = getFirestore();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const plans = new Map();
  let cursor = null, sent = 0, pending = 0;
  async function deliver(device) {
    const userRef = device.ref.parent.parent;
    if (!userRef) return;
    const uid = userRef.id;
    if (!plans.has(uid)) plans.set(uid, userRef.collection('plans').doc('dream').get().then(snapshot => snapshot.data() || null));
    const shortfall = pendingDreamAmount(await plans.get(uid), today);
    if (!shortfall) return;
    pending++;
    const claim = userRef.collection('reminderDeliveries').doc(`${today}_${device.id}`);
    const claimed = await db.runTransaction(async transaction => {
      if ((await transaction.get(claim)).exists) return false;
      transaction.create(claim, { status: 'claimed', date: today, installationId: device.id, createdAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) return;
    try {
      await getMessaging().send({
        fid: device.id,
        notification: {
          title: 'Ahorremax · Tu sueño sigue cerca',
          body: 'Tienes un aporte por registrar. Cada vez que ahorras, te acercas a tu meta.',
        },
        webpush: { fcmOptions: { link: 'https://fcfinanzas.com/app/ahorremax/' } },
      });
      await claim.update({ status: 'sent', sentAt: FieldValue.serverTimestamp() });
      sent++;
    } catch (error) {
      await claim.update({ status: 'failed', failureCode: String(error.code || 'unknown').slice(0, 80), failedAt: FieldValue.serverTimestamp() });
      logger.warn('Dream reminder delivery failed', { uid, code: error.code || 'unknown' });
    }
  }
  for (;;) {
    let query = db.collectionGroup('notificationDevices').where('enabled', '==', true).orderBy('__name__').limit(200);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (let start = 0; start < page.docs.length; start += 10) await Promise.all(page.docs.slice(start, start + 10).map(deliver));
    cursor = page.docs.at(-1);
    if (page.size < 200) break;
  }
  logger.info('Dream reminders checked', { date: today, pending, sent });
});
