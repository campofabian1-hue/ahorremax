import { calculateDreamPlan, forecastDream, DREAM_CADENCES } from '../src/dream.mjs';
import { parsePesoInput, formatPesoInput, formatPesoField } from '../src/peso-input.mjs';
import { optimizeDreamPhoto } from '../src/dream-photo.mjs';
import { dreamReminder } from '../src/dream-reminder.mjs';
import * as cloud from './cloud.mjs';

let callbacks;
let account = null;
let demo = true;
let plan = null;
let revision = 0;
let unwatch = null;
let busy = false;
let syncError = false;
let draft = null;
let activity = [];
let activityLoaded = false;
let activityError = '';
let activityRequest = 0;
let editingPlan = false;
let editingEntryId = null;
let editingAmount = '';
let photoData = '';
let photoRevision = 0;
let unwatchPhoto = null;
let photoDraftUrl = '';
let photoDraftImage = null;
let photoPositionX = 50;
let photoPositionY = 50;
let photoEditorOpen = false;
let photoBusy = false;
let photoError = '';

const currency = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const escaped = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const prettyDate = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00.000Z`));
const daysBetween = (from, to) => Math.max(0, Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000));
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const colombiaToday = () => { const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value])); return `${parts.year}-${parts.month}-${parts.day}`; };
const defaultTarget = () => { const date = new Date(`${today()}T12:00:00.000Z`); date.setUTCMonth(date.getUTCMonth() + 6); return date.toISOString().slice(0, 10); };

function initialDraft() {
  return { purpose: '', goal: 1_000_000, cadence: 'monthly', strategy: 'deadline', startDate: today(), targetDate: defaultTarget(), amount: 100_000, place: 'pocket', placeName: 'Nequi' };
}

export function configure(options) { callbacks = options; }
export function hasPlan() { return Boolean(plan); }
export function overview() { return plan ? { purpose: plan.purpose, goal: plan.goal, saved: plan.saved, cadence: plan.cadence, contribution: plan.contribution, photoData } : null; }
function clearPhotoDraft() { if (photoDraftUrl) URL.revokeObjectURL(photoDraftUrl); photoDraftUrl = ''; photoDraftImage = null; photoPositionX = 50; photoPositionY = 50; }
export function resetDemo() { plan = null; revision = 0; draft = initialDraft(); editingPlan = false; editingEntryId = null; editingAmount = ''; syncError = false; activity = []; activityLoaded = false; activityError = ''; photoData = ''; photoRevision = 0; clearPhotoDraft(); photoEditorOpen = false; photoError = ''; }
async function loadActivity() {
  if (!account) return;
  const request = ++activityRequest;
  try {
    const next = await cloud.listDreamOperations();
    if (request !== activityRequest) return;
    activity = next; activityLoaded = true; activityError = '';
  } catch (error) { if (request !== activityRequest) return; activityError = cloud.errorMessage(error); }
  callbacks.renderIfDream();
}
export function setAccount(nextAccount) {
  unwatch?.(); unwatch = null;
  unwatchPhoto?.(); unwatchPhoto = null;
  account = nextAccount;
  demo = !nextAccount;
  plan = null; revision = 0; draft = initialDraft(); editingPlan = false; editingEntryId = null; editingAmount = ''; syncError = false; busy = false;
  activityRequest++; activity = []; activityLoaded = false; activityError = '';
  photoData = ''; photoRevision = 0; clearPhotoDraft(); photoEditorOpen = false; photoError = '';
  if (!nextAccount) return;
  void loadActivity();
  unwatch = cloud.watchDream(data => {
    try {
      if ((!data && revision > 0) || (data && data.revision < revision)) return;
      if (data) validateStored(data);
      plan = data; revision = data?.revision || 0; syncError = false;
      callbacks.renderIfDream();
    } catch (error) { syncError = true; callbacks.notify(error.message); callbacks.renderIfDream(); }
  }, error => { syncError = true; callbacks.notify(cloud.errorMessage(error)); callbacks.renderIfDream(); });
  unwatchPhoto = cloud.watchDreamPhoto(data => {
    if ((!data && photoRevision > 0) || (data && data.revision < photoRevision)) return;
    photoData = data?.imageData || ''; photoRevision = data?.revision || 0;
    callbacks.renderIfDream();
  }, error => { photoError = cloud.errorMessage(error); callbacks.renderIfDream(); });
}

function validateStored(data) {
  if (data.mode !== 'dream' || !Number.isSafeInteger(data.revision) || data.revision < 1 || !Array.isArray(data.entries) || data.entries.length > 3700 || typeof data.purpose !== 'string' || data.purpose.length < 3 || data.purpose.length > 80 || !['account', 'pocket', 'cash'].includes(data.place) || typeof data.placeName !== 'string' || data.placeName.length > 60) throw new Error('No se pudo validar el plan personalizado guardado.');
  const quote = calculateDreamPlan({ goal: data.goal, startDate: data.startDate, cadence: data.cadence, strategy: data.strategy, targetDate: data.targetDate, amount: data.contribution });
  if (quote.contribution !== data.contribution || quote.periods !== data.periods || quote.projectedDate !== data.projectedDate) throw new Error('El cálculo del plan guardado no coincide con sus datos.');
  const ids = new Set(); let total = 0;
  for (const entry of data.entries) {
    if (typeof entry.id !== 'string' || ids.has(entry.id) || !Number.isSafeInteger(entry.amount) || entry.amount < 1 || typeof entry.date !== 'string' || Number.isNaN(Date.parse(entry.date))) throw new Error('Hay un aporte inválido en el plan personalizado.');
    ids.add(entry.id); total += entry.amount;
  }
  if (total > data.goal || total !== data.saved) throw new Error('Los aportes no coinciden con el avance guardado.');
}

function readForm(form) {
  const values = new FormData(form);
  return {
    purpose: String(values.get('purpose') || '').trim(),
    goal: parsePesoInput(values.get('goal')),
    cadence: String(values.get('cadence') || ''),
    strategy: String(values.get('strategy') || ''),
    startDate: String(values.get('startDate') || ''),
    targetDate: String(values.get('targetDate') || ''),
    amount: parsePesoInput(values.get('amount')),
    place: String(values.get('place') || ''),
    placeName: String(values.get('placeName') || '').trim(),
  };
}

function validDraft(values) {
  if (values.purpose.length < 3 || values.purpose.length > 80) throw new Error('Escribe el nombre de tu sueño (entre 3 y 80 caracteres).');
  if (values.startDate < today() && !(editingPlan && values.startDate === plan?.startDate)) throw new Error('El primer aporte debe ser hoy o una fecha futura.');
  if (editingPlan && plan?.entries.length && values.startDate !== plan.startDate) throw new Error('La fecha del primer aporte no se puede cambiar después de registrar ahorros.');
  if (editingPlan && plan && values.goal < plan.saved) throw new Error(`La meta no puede ser inferior a lo ya registrado: ${currency(plan.saved)}.`);
  if (!['account', 'pocket', 'cash'].includes(values.place)) throw new Error('Elige dónde guardarás el dinero.');
  if (values.place !== 'cash' && !values.placeName) throw new Error('Escribe el nombre de tu cuenta o bolsillo.');
  return calculateDreamPlan(values);
}

function strategyFields(values) {
  return `<div class="dream-strategy" role="radiogroup" aria-label="Cómo calcular el plan">
    <label><input type="radio" name="strategy" value="deadline" ${values.strategy === 'deadline' ? 'checked' : ''}><span><strong>Conozco la fecha</strong><small>Te sugerimos cuánto separar.</small></span></label>
    <label><input type="radio" name="strategy" value="amount" ${values.strategy === 'amount' ? 'checked' : ''}><span><strong>Conozco mi aporte</strong><small>Calculamos cuándo llegarás.</small></span></label>
  </div>`;
}

function planDraft() {
  return { purpose: plan.purpose, goal: plan.goal, cadence: plan.cadence, strategy: plan.strategy, startDate: plan.startDate, targetDate: plan.targetDate || defaultTarget(), amount: plan.contribution, place: plan.place, placeName: plan.placeName };
}

function photoWidget(onboarding = false) {
  if (!onboarding && !photoEditorOpen) return `<section class="dream-photo-memory"><div><span class="eyebrow">TU MOTIVACIÓN VISUAL</span><h2>${photoData ? 'Tu sueño, siempre a la vista' : 'Dale una imagen a tu sueño'}</h2><p>${photoData ? demo ? 'Esta foto aparece durante la prueba y se borra al salir.' : 'Esta foto aparece en tu reto cada vez que vuelves.' : 'Agrega una foto para recordar por qué estás ahorrando.'}</p></div><button type="button" class="secondary" data-dream-photo-open>${photoData ? 'Cambiar foto' : 'Agregar foto'}</button></section>`;
  const preview = photoDraftUrl || photoData;
  return `<section class="dream-photo-editor" aria-label="Foto de tu sueño"><div class="dream-photo-heading"><div><span class="eyebrow">UNA IMAGEN PARA TU META</span><h2>${photoData ? 'Tu sueño tiene imagen' : 'Haz visible lo que quieres lograr'}</h2><p>Sube una foto de tu viaje, proyecto o aquello para lo que estás ahorrando. ${demo ? 'En la prueba, la foto se borrará al salir.' : 'Solo tú podrás verla en tu cuenta.'}</p></div>${!onboarding ? '<button type="button" class="text-button" data-dream-photo-cancel>Cerrar</button>' : ''}</div>
    <div class="dream-photo-layout"><div class="dream-photo-frame">${preview ? `<img src="${escaped(preview)}" alt="Vista previa de tu sueño" style="object-position:${photoDraftUrl ? photoPositionX : 50}% ${photoDraftUrl ? photoPositionY : 50}%">` : '<img src="./assets/dream-jar.webp" alt="" class="dream-photo-placeholder">'}</div><div class="dream-photo-controls"><label for="dream-photo-file" class="dream-photo-file-label">${preview ? 'Elegir otra foto' : 'Elegir una foto'}</label><input id="dream-photo-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" aria-describedby="dream-photo-help"><p id="dream-photo-help">JPG, PNG, WebP o HEIC. La app ajusta el encuadre y reduce el tamaño antes de guardarla.</p>${photoDraftUrl ? `<label for="dream-photo-x">Mover horizontalmente</label><input id="dream-photo-x" type="range" min="0" max="100" value="${photoPositionX}"><label for="dream-photo-y">Mover verticalmente</label><input id="dream-photo-y" type="range" min="0" max="100" value="${photoPositionY}">` : ''}${onboarding ? '<p class="dream-photo-note">La foto se guardará cuando confirmes el plan. Puedes añadirla o cambiarla más adelante.</p>' : `<button type="button" class="primary" data-dream-photo-save ${!photoDraftUrl || photoBusy ? 'disabled' : ''}>${photoBusy ? 'Guardando foto…' : 'Guardar esta foto'}</button>${photoData ? '<button type="button" class="text-button dream-photo-remove" data-dream-photo-remove>Quitar foto</button>' : ''}`}${photoError ? `<p class="dream-photo-error" role="alert">${escaped(photoError)}</p>` : ''}</div></div></section>`;
}

async function loadPhotoFile(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size > 20_000_000) { photoError = 'Elige una imagen JPG, PNG, WebP o HEIC de máximo 20 MB.'; callbacks.renderIfDream(); return; }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('No se pudo abrir la imagen. Prueba con otra foto.');
    clearPhotoDraft(); photoDraftUrl = url; photoDraftImage = image; photoEditorOpen = true; photoError = '';
    callbacks.renderIfDream();
  } catch { URL.revokeObjectURL(url); photoError = 'No se pudo abrir la imagen. Prueba con otra foto.'; callbacks.renderIfDream(); }
}

async function persistPhotoDraft() {
  if (!photoDraftImage || photoBusy) return false;
  photoBusy = true; photoError = ''; callbacks.renderIfDream();
  try {
    const imageData = await optimizeDreamPhoto(photoDraftImage, photoPositionX, photoPositionY);
    if (!demo) photoRevision = await cloud.saveDreamPhoto(imageData, photoRevision);
    photoData = imageData; clearPhotoDraft(); photoEditorOpen = false;
    callbacks.notify(demo ? 'Foto agregada a este plan de prueba.' : 'La foto de tu sueño quedó guardada en tu cuenta.');
    return true;
  } catch (error) { photoError = cloud.errorMessage(error); callbacks.notify(photoError); return false; }
  finally { photoBusy = false; callbacks.renderIfDream(); }
}

function setup() {
  const values = draft || (editingPlan ? planDraft() : initialDraft());
  return `<div class="dream-page dream-onboarding"><button class="text-button dream-back" ${editingPlan ? 'data-dream-cancel-plan' : 'data-action="plans"'}>← ${editingPlan ? 'Volver a mi plan' : 'Todos los retos'}</button>
    <section class="method-banner method-dream dream-hero"><div class="dream-hero-copy"><span class="method-kicker dream-kicker">${editingPlan ? 'AJUSTA TU PLAN' : 'RETO 04 · DISEÑADO POR TI'}</span><h1>${editingPlan ? 'Edita los montos de tu sueño' : 'Cumple tu sueño'}</h1><p>${editingPlan ? 'Corrige tu meta o el aporte previsto. Tus ahorros ya registrados permanecerán en el historial.' : 'Ponle una cifra y un ritmo a eso que quieres lograr. Te mostramos un plan claro antes de empezar.'}</p></div><img src="./assets/dream-jar.webp" width="440" height="440" alt="Alcancía de vidrio con monedas y una estrella" decoding="async"></section>
    <div class="dream-columns"><form id="dream-plan-form" class="dream-form" novalidate>
      <div class="dream-step"><span>01</span><div><h2>Define tu meta</h2><p>El dinero sigue donde tú decidas guardarlo.</p></div></div>
      <div class="dream-fields"><label for="dream-purpose">¿Cuál es tu sueño?</label><input id="dream-purpose" name="purpose" maxlength="80" required placeholder="Ej.: mi viaje, estudios o un fondo de emergencia" value="${escaped(values.purpose)}" autocomplete="off">
      <label for="dream-goal">¿Cuánto necesitas ahorrar? <span>COP</span></label><input id="dream-goal" name="goal" class="peso-input" type="text" inputmode="numeric" required value="${formatPesoInput(values.goal)}" autocomplete="off">
      <label for="dream-start">¿Cuándo harás el primer aporte?</label><input id="dream-start" name="startDate" type="date" min="${editingPlan ? escaped(plan.startDate) : today()}" required value="${escaped(values.startDate)}"></div>
      <div class="dream-step"><span>02</span><div><h2>Elige cómo avanzar</h2><p>Dos formas de llegar a un plan que sí puedas cumplir.</p></div></div>
      ${strategyFields(values)}
      <div class="dream-fields"><label for="dream-cadence">¿Cada cuánto vas a ahorrar?</label><select id="dream-cadence" name="cadence">${Object.entries(DREAM_CADENCES).map(([key, item]) => `<option value="${key}" ${values.cadence === key ? 'selected' : ''}>${item.label} · ${item.interval}</option>`).join('')}</select>
      <div id="dream-deadline-field"><label for="dream-target">¿En qué fecha quieres alcanzar la meta?</label><input id="dream-target" name="targetDate" type="date" min="${escaped(values.startDate)}" value="${escaped(values.targetDate)}"></div>
      <div id="dream-amount-field" hidden><label for="dream-amount">¿Cuánto puedes separar en cada aporte?</label><input id="dream-amount" name="amount" class="peso-input" type="text" inputmode="numeric" value="${formatPesoInput(values.amount)}" autocomplete="off"></div></div>
      <div class="dream-step"><span>03</span><div><h2>Elige dónde guardarlo</h2><p>Ahorremax registra el avance; no mueve tu dinero.</p></div></div>
      <div class="dream-fields"><label for="dream-place">Lugar del ahorro</label><select id="dream-place" name="place"><option value="account" ${values.place === 'account' ? 'selected' : ''}>Cuenta de ahorros</option><option value="pocket" ${values.place === 'pocket' ? 'selected' : ''}>Bolsillo digital</option><option value="cash" ${values.place === 'cash' ? 'selected' : ''}>Efectivo en casa</option></select>
      <div id="dream-place-name-field"><label for="dream-place-name">Nombre de la cuenta o bolsillo</label><input id="dream-place-name" name="placeName" maxlength="60" value="${escaped(values.placeName)}" placeholder="Por ejemplo, Nequi" autocomplete="off"></div></div>
      <div class="dream-step"><span>04</span><div><h2>Haz tu sueño visible</h2><p>Una foto propia te recordará para qué estás ahorrando.</p></div></div>${photoWidget(true)}
    </form><aside class="dream-quote" aria-label="Tu plan calculado"><div class="dream-quote-head"><span>VISTA PREVIA DE TU PLAN</span><span class="dream-quote-spark" aria-hidden="true">✦</span></div><p class="dream-quote-label">Tu aporte sugerido</p><strong id="dream-quote-amount">—</strong><p id="dream-quote-frequency" class="dream-quote-frequency">Elige tus datos para calcularlo.</p><div class="dream-quote-divider"></div><div class="dream-quote-row"><span>Aportes previstos</span><strong id="dream-quote-periods">—</strong></div><div class="dream-quote-row"><span>Tiempo estimado</span><strong id="dream-quote-time">—</strong></div><div class="dream-quote-row"><span>Fecha estimada</span><strong id="dream-quote-date">—</strong></div><p id="dream-quote-last" class="dream-quote-note"></p><p id="dream-quote-error" class="dream-quote-error" role="alert"></p><button type="submit" form="dream-plan-form" class="primary dream-confirm" id="dream-confirm">${editingPlan ? 'Guardar cambios' : demo ? 'Revisar y comenzar plan de prueba' : 'Revisar y comenzar mi plan'} →</button><p class="dream-quote-disclaimer">Cálculo sin intereses ni rendimientos. Registra cada aporte cuando realmente hayas separado el dinero.</p></aside></div></div>`;
}

function dashboard() {
  const currentDay = colombiaToday();
  const entries = plan.entries;
  const saved = entries.reduce((sum, item) => sum + item.amount, 0);
  const progress = Math.min(100, saved / plan.goal * 100);
  let forecast;
  try { forecast = forecastDream({ ...plan, saved, completedCount: entries.length, referenceDate: currentDay }); }
  catch { forecast = null; }
  const remaining = plan.goal - saved;
  let reminder = null;
  try { reminder = dreamReminder({ ...plan, saved }, currentDay); } catch { reminder = null; }
  const rows = entries.length ? entries.slice().reverse().map(item => `<div class="dream-entry"><div><strong>${currency(item.amount)}</strong><small>${new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.date))}</small></div><div class="dream-entry-actions"><button type="button" class="text-button" data-dream-edit="${escaped(item.id)}">Editar</button><button type="button" class="text-button dream-remove" data-dream-remove="${escaped(item.id)}">Quitar</button></div></div>${editingEntryId === item.id ? `<form id="dream-edit-form" class="dream-edit-form" data-entry-id="${escaped(item.id)}" novalidate><label for="dream-edit-amount">Corrige el monto de este aporte</label><div class="dream-contribution-controls"><input id="dream-edit-amount" name="amount" class="peso-input" type="text" inputmode="numeric" value="${escaped(editingAmount || formatPesoInput(item.amount))}" required autocomplete="off"><button class="primary" type="submit" ${busy || syncError ? 'disabled' : ''}>Guardar corrección</button></div><button type="button" class="text-button" data-dream-cancel-edit>Cancelar</button></form>` : ''}`).join('') : '<div class="dream-empty">Cuando registres tu primer aporte, aparecerá aquí. Comienza cuando hayas separado el dinero.</div>';
  const activityRows = !demo ? activity.map(item => `<div class="dream-entry dream-audit"><div><strong>${item.type === 'dream_created' ? 'Plan confirmado' : item.type === 'dream_plan_updated' ? 'Plan actualizado' : item.type === 'dream_contribution_edited' ? 'Monto de aporte editado' : item.type === 'dream_contribution_corrected' ? 'Aporte retirado' : 'Aporte registrado'}</strong><small>${item.createdAt ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt)) : 'Fecha pendiente'}${item.type === 'dream_plan_updated' ? ` · Aporte previsto: ${currency(item.previousAmount)} → ${currency(item.amount)}` : ''}</small></div><span>${item.type === 'dream_contribution_edited' ? `${currency(item.previousAmount)} → ${currency(item.amount)}` : item.type === 'dream_plan_updated' ? `${currency(item.previousGoal)} → ${currency(item.goal)}` : item.amount ? `${item.type === 'dream_contribution_corrected' ? '−' : '+'}${currency(item.amount)}` : '✦'}</span></div>`).join('') : '';
  return `<div class="dream-page dream-active"><button class="text-button dream-back" data-action="plans">← Todos los retos</button><section class="method-banner method-dream dream-hero ${photoData ? 'has-personal-photo' : ''}"><div class="dream-hero-copy"><span class="method-kicker dream-kicker">TU PLAN PERSONALIZADO</span><h1>${escaped(plan.purpose)}</h1><p>${remaining ? `Un aporte a la vez. Tu meta es ${currency(plan.goal)}.` : '¡Cumpliste tu meta! Cada aporte hizo posible este logro.'}</p></div>${photoData ? `<img class="dream-hero-personal" src="${escaped(photoData)}" alt="" decoding="async">` : '<img src="./assets/dream-jar.webp" width="440" height="440" alt="" decoding="async">'}</section>${photoWidget(false)}
    ${demo ? '' : `<section class="dream-push"><div><span class="eyebrow">RECORDATORIOS</span><h2>Un aviso cuando falte un aporte</h2><p>${cloud.remindersConfigured ? 'Si no has registrado el aporte previsto, podemos avisarte al día siguiente a las 9:00 a. m. Puedes desactivarlo cuando quieras.' : 'Los avisos dentro de la app ya están disponibles. El envío al celular con la app cerrada requiere terminar la configuración de Firebase.'}</p></div>${cloud.remindersConfigured ? `<button type="button" class="secondary" data-dream-push-toggle>${cloud.dreamRemindersEnabled() ? 'Desactivar avisos' : 'Activar avisos al celular'}</button>` : ''}</section>`}
    ${syncError ? '<div class="dream-alert" role="alert">No se pudo sincronizar este plan. Revisa la conexión antes de registrar un aporte.</div>' : ''}
    ${reminder ? `<section class="dream-reminder" aria-label="Aporte pendiente"><span class="dream-reminder-spark" aria-hidden="true">✦</span><div><span class="eyebrow">TU SUEÑO TE ESPERA</span><h2>Hoy puedes acercarte a ${escaped(plan.purpose)}</h2><p>Según el ritmo que elegiste, faltan ${currency(reminder.shortfall)} por registrar. Tu ahorro actual sigue intacto.${reminder.delayed ? ` Si retomas hoy, la fecha estimada sería el ${prettyDate(reminder.projectedDate)}.` : ''}</p></div><a href="#dream-contribution" class="dream-reminder-link">Registrar aporte →</a></section>` : ''}
    <div class="dream-dashboard-grid"><section class="dream-progress-card"><span class="eyebrow">AHORRO REGISTRADO</span><div class="dream-saved">${currency(saved)}</div><p>de ${currency(plan.goal)} · faltan <strong>${currency(remaining)}</strong></p><div class="dream-meter" role="progressbar" aria-label="Avance de mi sueño" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.toFixed(1)}"><div style="width:${progress}%"></div></div><div class="dream-meter-label"><span>${progress.toLocaleString('es-CO', { maximumFractionDigits: 1 })} % completado</span><span>${entries.length} ${entries.length === 1 ? 'aporte' : 'aportes'}</span></div></section>
    <section class="dream-timeline"><span class="eyebrow">EL CAMINO QUE ELEGISTE</span><div><span>Ritmo</span><strong>${DREAM_CADENCES[plan.cadence].label} · ${DREAM_CADENCES[plan.cadence].interval}</strong></div><div><span>Aporte previsto</span><strong>${currency(plan.contribution)}</strong></div><div><span>${remaining ? 'Fecha estimada al ritmo actual' : 'Meta alcanzada'}</span><strong>${remaining ? forecast ? prettyDate(forecast.projectedDate) : 'Revisa el plazo' : '¡Lo lograste!'}</strong></div>${remaining && forecast ? `<div><span>Tiempo estimado restante</span><strong>${daysBetween(currentDay, forecast.projectedDate)} días</strong></div>` : ''}${plan.strategy === 'deadline' && remaining ? `<p class="dream-deadline-note">Tu fecha objetivo inicial: ${prettyDate(plan.targetDate)}. La estimación cambia si adelantas o retrasas aportes.</p>` : ''}<div><span>Dónde guardas el dinero</span><strong>${escaped(plan.place === 'cash' ? 'Efectivo en casa' : plan.placeName)}</strong></div><button type="button" class="text-button dream-edit-plan" data-dream-edit-plan>Editar montos del plan</button></section></div>
    ${remaining ? `<section class="dream-action-card"><div><span class="eyebrow">TU PRÓXIMO PASO</span><h2>${currency(forecast?.nextAmount || Math.min(remaining, plan.contribution))}</h2><p>${forecast ? `Aporte previsto para el ${prettyDate(forecast.nextDate)}. Puedes registrar otro monto si ahorraste una cantidad distinta.` : 'Registra lo que realmente separaste.'}</p></div><form id="dream-contribution-form" novalidate><label for="dream-contribution">Monto que ya ahorraste</label><div class="dream-contribution-controls"><input id="dream-contribution" name="amount" class="peso-input" type="text" inputmode="numeric" value="${formatPesoInput(forecast?.nextAmount || Math.min(remaining, plan.contribution))}" required autocomplete="off"><button class="primary" type="submit" ${busy || syncError ? 'disabled' : ''}>Registrar aporte →</button></div></form></section>` : '<div class="dream-celebration">✦ Meta cumplida. Tus aportes permanecen en el historial de tu cuenta.</div>'}
    <section class="dream-records"><div><span class="eyebrow">MOVIMIENTOS</span><h2>Tus aportes</h2><p>${demo ? 'Estos aportes son de prueba y se borran al salir de la demo.' : 'Si corriges un registro, el monto se descuenta del avance y la operación permanece en el historial.'}</p></div>${rows}</section>${demo ? '' : `<section class="dream-records"><div><span class="eyebrow">HISTORIAL DE LA CUENTA</span><h2>Operaciones recientes</h2><p>Mostramos hasta 50 operaciones. Las correcciones permanecen registradas.</p></div>${activityRows || (activityLoaded ? '<div class="dream-empty">Todavía no hay operaciones.</div>' : '')}${activityError ? `<p class="dream-quote-error" role="alert">${escaped(activityError)}</p>` : ''}</section>`}</div>`;
}

export function render() { return plan && !editingPlan ? dashboard() : setup(); }

export function refreshQuote() {
  const form = document.querySelector('#dream-plan-form');
  if (!form) return;
  const values = readForm(form);
  draft = values;
  document.querySelector('#dream-deadline-field').hidden = values.strategy !== 'deadline';
  document.querySelector('#dream-amount-field').hidden = values.strategy !== 'amount';
  document.querySelector('#dream-place-name-field').hidden = values.place === 'cash';
  const amountElement = document.querySelector('#dream-quote-amount');
  const periodsElement = document.querySelector('#dream-quote-periods');
  const dateElement = document.querySelector('#dream-quote-date');
  const timeElement = document.querySelector('#dream-quote-time');
  const lastElement = document.querySelector('#dream-quote-last');
  const errorElement = document.querySelector('#dream-quote-error');
  const button = document.querySelector('#dream-confirm');
  document.querySelector('#dream-target').min = values.startDate || today();
  try {
    const quote = calculateDreamPlan(values);
    if (values.startDate < today() && !(editingPlan && values.startDate === plan?.startDate)) throw new Error('El primer aporte debe ser hoy o una fecha futura.');
    amountElement.textContent = currency(quote.contribution);
    document.querySelector('#dream-quote-frequency').textContent = DREAM_CADENCES[values.cadence].interval;
    periodsElement.textContent = String(quote.periods);
    timeElement.textContent = `${daysBetween(values.startDate, quote.projectedDate)} días`;
    dateElement.textContent = prettyDate(quote.projectedDate);
    lastElement.textContent = quote.lastAmount < quote.contribution ? `El último aporte será de ${currency(quote.lastAmount)} para completar exactamente tu meta.` : 'Cada aporte será del mismo valor.';
    const fieldError = values.purpose.length < 3 ? 'Ponle nombre a tu sueño para confirmar el plan.' : values.purpose.length > 80 ? 'El nombre es demasiado largo.' : editingPlan && plan?.entries.length && values.startDate !== plan.startDate ? 'La fecha del primer aporte no se puede cambiar después de registrar ahorros.' : editingPlan && values.goal < plan.saved ? `La meta no puede ser inferior a ${currency(plan.saved)}.` : values.place !== 'cash' && !values.placeName ? 'Escribe el nombre de tu cuenta o bolsillo.' : '';
    errorElement.textContent = fieldError;
    button.disabled = busy || syncError || Boolean(fieldError);
  } catch (error) {
    amountElement.textContent = '—'; periodsElement.textContent = '—'; timeElement.textContent = '—'; dateElement.textContent = '—'; lastElement.textContent = '';
    errorElement.textContent = error.message; button.disabled = true;
  }
}

export function handleInput(event) {
  if (event.target.id === 'dream-photo-file') { if (event.type === 'change') { refreshQuote(); void loadPhotoFile(event.target.files?.[0]); } return; }
  if (event.target.id === 'dream-photo-x' || event.target.id === 'dream-photo-y') {
    if (event.target.id === 'dream-photo-x') photoPositionX = Number(event.target.value);
    else photoPositionY = Number(event.target.value);
    const image = document.querySelector('.dream-photo-frame img');
    if (image) image.style.objectPosition = `${photoPositionX}% ${photoPositionY}%`;
    return;
  }
  if (event.target.matches?.('.peso-input')) formatPesoField(event.target);
  if (event.target.id === 'dream-edit-amount') editingAmount = event.target.value;
  if (event.target.closest('#dream-plan-form')) refreshQuote();
}

async function persist(next, operation) {
  if (busy || syncError) return false;
  busy = true; callbacks.renderIfDream();
  try {
    if (!demo) await cloud.saveDream(next, revision, operation);
    revision += 1; plan = { ...next, revision }; draft = null;
    if (operation.type === 'dream_plan_updated') editingPlan = false;
    if (operation.type === 'dream_contribution_edited' || operation.type === 'dream_contribution_corrected') { editingEntryId = null; editingAmount = ''; }
    if (!demo) void loadActivity();
    callbacks.renderIfDream();
    return true;
  } catch (error) { callbacks.notify(cloud.errorMessage(error)); callbacks.renderIfDream(); return false; }
  finally { busy = false; callbacks.renderIfDream(); }
}

export async function handleSubmit(event) {
  if (event.target.id === 'dream-plan-form') {
    event.preventDefault();
    if ((plan && !editingPlan) || busy || syncError) return true;
    const values = readForm(event.target);
    let quote;
    try { quote = validDraft(values); }
    catch (error) { callbacks.notify(error.message); refreshQuote(); return true; }
    const location = values.place === 'cash' ? 'efectivo en casa' : values.placeName;
    if (editingPlan) {
      if (!await callbacks.confirm('Revisa los cambios del plan', `Tu meta será ${currency(values.goal)} y el aporte previsto ${currency(quote.contribution)} ${DREAM_CADENCES[values.cadence].interval}. Tus ${currency(plan.saved)} ya registrados se conservan. ¿Guardar estos cambios?`, 'Guardar cambios')) return true;
      const next = { ...plan, purpose: values.purpose, goal: values.goal, cadence: values.cadence, strategy: values.strategy, startDate: values.startDate, targetDate: values.strategy === 'deadline' ? values.targetDate : '', contribution: quote.contribution, periods: quote.periods, projectedDate: quote.projectedDate, place: values.place, placeName: values.place === 'cash' ? '' : values.placeName };
      if (await persist(next, { type: 'dream_plan_updated', amount: quote.contribution, previousAmount: plan.contribution, previousGoal: plan.goal, entryId: '' })) { if (photoDraftImage) await persistPhotoDraft(); callbacks.notify('Los montos de tu plan quedaron actualizados.'); }
      return true;
    }
    if (!await callbacks.confirm('1 de 2 · Revisa tu plan', `Meta: ${currency(values.goal)}. Aporte: ${currency(quote.contribution)} ${DREAM_CADENCES[values.cadence].interval}. ${quote.periods} aportes hasta el ${prettyDate(quote.projectedDate)}. Puedes volver y corregir cualquier cifra.`, 'Continuar')) return true;
    if (!await callbacks.confirm('2 de 2 · Iniciar el plan', `Guardarás el dinero en ${location}. Ahorremax solo llevará el registro. ¿Confirmas la creación de “${values.purpose}” con meta de ${currency(values.goal)}?`, 'Crear e iniciar plan')) return true;
    const next = { mode: 'dream', purpose: values.purpose, goal: values.goal, cadence: values.cadence, strategy: values.strategy, startDate: values.startDate, targetDate: values.strategy === 'deadline' ? values.targetDate : '', contribution: quote.contribution, periods: quote.periods, projectedDate: quote.projectedDate, place: values.place, placeName: values.place === 'cash' ? '' : values.placeName, saved: 0, entries: [] };
    if (await persist(next, { type: 'dream_created', amount: 0, entryId: '' })) { if (photoDraftImage) await persistPhotoDraft(); callbacks.notify(demo ? 'Plan de prueba creado.' : 'Tu sueño quedó guardado en tu cuenta.'); }
    return true;
  }
  if (event.target.id === 'dream-contribution-form') {
    event.preventDefault();
    if (!plan || busy || syncError) return true;
    const amount = parsePesoInput(new FormData(event.target).get('amount'));
    const saved = plan.entries.reduce((sum, entry) => sum + entry.amount, 0);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > plan.goal - saved) { callbacks.notify(`Escribe un aporte entre $1 y ${currency(plan.goal - saved)}.`); return true; }
    if (!await callbacks.confirm('¿Ya separaste este dinero?', `Registrarás ${currency(amount)} en ${plan.place === 'cash' ? 'efectivo en casa' : plan.placeName}. Tu avance quedará en ${currency(saved + amount)} de ${currency(plan.goal)}.`)) return true;
    const entry = { id: crypto.randomUUID(), amount, date: new Date().toISOString() };
    if (await persist({ ...plan, saved: saved + amount, entries: [...plan.entries, entry] }, { type: 'dream_contribution_added', amount, entryId: entry.id })) callbacks.notify(demo ? 'Aporte de prueba registrado.' : 'Aporte guardado en tu cuenta.');
    return true;
  }
  if (event.target.id === 'dream-edit-form') {
    event.preventDefault();
    if (!plan || busy || syncError) return true;
    const entry = plan.entries.find(item => item.id === event.target.dataset.entryId);
    if (!entry) { callbacks.notify('Este aporte cambió. Vuelve a abrirlo desde tus movimientos.'); return true; }
    const amount = parsePesoInput(new FormData(event.target).get('amount'));
    const nextSaved = plan.saved - entry.amount + amount;
    if (!Number.isSafeInteger(amount) || amount < 1 || nextSaved > plan.goal) { callbacks.notify(`Escribe un monto entre $ 1 y ${currency(plan.goal - plan.saved + entry.amount)}.`); return true; }
    if (amount === entry.amount) { editingEntryId = null; editingAmount = ''; callbacks.renderIfDream(); return true; }
    if (!await callbacks.confirm('¿Corregir el monto?', `Cambiarás este aporte de ${currency(entry.amount)} a ${currency(amount)}. El nuevo total registrado será ${currency(nextSaved)}. La corrección quedará en el historial.`, 'Guardar corrección')) return true;
    const nextEntries = plan.entries.map(item => item.id === entry.id ? { ...item, amount } : item);
    if (await persist({ ...plan, saved: nextSaved, entries: nextEntries }, { type: 'dream_contribution_edited', amount, previousAmount: entry.amount, entryIndex: plan.entries.findIndex(item => item.id === entry.id), entryId: entry.id })) callbacks.notify('Monto corregido y guardado.');
    return true;
  }
  return false;
}

export async function handleClick(button) {
  if (button.hasAttribute('data-dream-push-toggle')) {
    try { if (cloud.dreamRemindersEnabled()) { await cloud.disableDreamReminders(); callbacks.notify('Avisos al celular desactivados.'); } else { await cloud.enableDreamReminders(); callbacks.notify('Avisos al celular activados para este dispositivo.'); } }
    catch (error) { callbacks.notify(cloud.errorMessage(error)); }
    callbacks.renderIfDream(); return true;
  }
  if (button.hasAttribute('data-dream-photo-open')) { photoEditorOpen = true; callbacks.renderIfDream(); return true; }
  if (button.hasAttribute('data-dream-photo-cancel')) { clearPhotoDraft(); photoEditorOpen = false; photoError = ''; callbacks.renderIfDream(); return true; }
  if (button.hasAttribute('data-dream-photo-save')) { await persistPhotoDraft(); return true; }
  if (button.hasAttribute('data-dream-photo-remove')) {
    if (!photoData || photoBusy) return true;
    if (!await callbacks.confirm('¿Quitar la foto de tu sueño?', 'La foto dejará de mostrarse en tu cuenta. Tus aportes y la meta permanecerán guardados.', 'Quitar foto')) return true;
    photoBusy = true; callbacks.renderIfDream();
    try { if (!demo) photoRevision = await cloud.saveDreamPhoto('', photoRevision); photoData = ''; clearPhotoDraft(); photoEditorOpen = false; callbacks.notify('La foto se quitó de tu plan.'); }
    catch (error) { photoError = cloud.errorMessage(error); callbacks.notify(photoError); }
    finally { photoBusy = false; callbacks.renderIfDream(); }
    return true;
  }
  if (button.hasAttribute('data-dream-edit-plan')) { if (!plan || busy || syncError) return true; editingPlan = true; draft = planDraft(); callbacks.renderIfDream(); return true; }
  if (button.hasAttribute('data-dream-cancel-plan')) { editingPlan = false; draft = null; callbacks.renderIfDream(); return true; }
  if (button.hasAttribute('data-dream-cancel-edit')) { editingEntryId = null; editingAmount = ''; callbacks.renderIfDream(); return true; }
  if (button.dataset.dreamEdit) { const entry = plan?.entries.find(item => item.id === button.dataset.dreamEdit); if (entry) { editingEntryId = entry.id; editingAmount = formatPesoInput(entry.amount); callbacks.renderIfDream(); } return true; }
  if (!button.dataset.dreamRemove) return false;
  const entry = plan?.entries.find(item => item.id === button.dataset.dreamRemove);
  if (!entry || busy || syncError) return true;
  if (!await callbacks.confirm('¿Corregir este aporte?', `Se descontarán ${currency(entry.amount)} del avance de ${plan.purpose}.${demo ? ' Este aporte de prueba se borrará.' : ' La operación quedará registrada en el historial.'}`)) return true;
  if (await persist({ ...plan, saved: plan.saved - entry.amount, entries: plan.entries.filter(item => item.id !== entry.id) }, { type: 'dream_contribution_corrected', amount: entry.amount, entryIndex: plan.entries.findIndex(item => item.id === entry.id), entryId: entry.id })) callbacks.notify('Aporte corregido.');
  return true;
}
