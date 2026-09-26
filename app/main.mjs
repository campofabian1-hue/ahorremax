import { createPlan, summarize, SHORTCUTS, shortcutQuote } from '../src/savings.mjs';
import * as cloud from './cloud.mjs';

const root = document.querySelector('#app');
const money = amount => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
const modes = {
  weekly: { name: 'La Ruta del Millón', tagline: 'Un paso cada semana. Una meta que se acerca.', duration: '26 semanas', icon: '↗', description: 'Un aporte cada semana. Empieza con $26.000 y aumenta $1.000 por semana.', unit: 'Semana' },
  flexible: { name: 'Reto Marca y Gana', tagline: 'Elige tu monto, marca tu casilla y gana tranquilidad con cada ahorro.', duration: '200 días · a tu ritmo', icon: '▦', description: '200 casillas, cinco atajos y muchas formas de avanzar. Tú eliges cuánto separar cada día.', unit: 'Casilla' },
  daily: { name: 'Reto Turbo', tagline: 'Pon a prueba tu constancia y dale velocidad a tu ahorro.', duration: '40 días', icon: '↗', description: 'Empieza con $6.000 diarios y suma $1.000 cada día hasta llegar a $45.000.', unit: 'Día' },
};
const places = { account: ['Cuenta de ahorros', 'En la entidad que tú elijas', '▤'], pocket: ['Bolsillo digital', 'Nequi, Daviplata, Lulo u otro', '▣'], cash: ['Efectivo en casa', 'Alcancía, sobre o debajo del colchón', '⌂'] };
let screen = 'welcome', mode = 'weekly', infoMode = 'weekly', place = 'pocket', placeName = 'Nequi', purpose = '', startDate = today(), entries = [], tab = 'plan', filter = 'all', selected = new Set();
const demoEntriesByMode = { weekly: [], flexible: [], daily: [] };
const demoProfilesByMode = { weekly: null, flexible: null, daily: null };
let timer;
let signingIn=false;
let user=null, revision=0, busy=false, unwatch=null, demo=true, syncError=false, hasPlan=false;
let activity=[], activityCursor=null, activityMore=false, activityLoading=false, activityLoaded=false, activityError='', activityRequest=0;
let installPrompt=null;
function snapshot(nextEntries=entries){return {mode,place,placeName,purpose,startDate,entries:nextEntries};}
function restore(data){
  if(!data||!Object.hasOwn(modes,data.mode)||!Object.hasOwn(places,data.place)||!Array.isArray(data.entries)||data.entries.length>200||!Number.isSafeInteger(data.revision)||data.revision<1||!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)||!Number.isFinite(Date.parse(data.startDate)))throw new Error('No se pudo validar tu plan guardado.');
  const plan=createPlan(data.mode), seen=new Set(), entryIds=new Set();
  for(const entry of data.entries){
    if(typeof entry.id!=='string'||entryIds.has(entry.id)||!Array.isArray(entry.ids)||!entry.ids.length||!Number.isFinite(Date.parse(entry.date)))throw new Error('Hay un registro inválido en tu historial.');
    entryIds.add(entry.id); let amount=0;
    for(const id of entry.ids){const item=plan.find(p=>p.id===id);if(!item||seen.has(id))throw new Error('Hay casillas duplicadas en tu historial.');seen.add(id);amount+=item.amount;}
    if(amount!==entry.amount)throw new Error('El monto de un registro no coincide con sus casillas.');
  }
  mode=data.mode;place=data.place;placeName=String(data.placeName||'').slice(0,60);purpose=String(data.purpose||'').slice(0,80);startDate=data.startDate;entries=data.entries;revision=data.revision;
}
async function persist(nextEntries,operation){
  if(busy||syncError) return false;
  busy=true;
  try {if(!demo)await cloud.save(snapshot(nextEntries),revision,operation);entries=nextEntries;if(demo)demoEntriesByMode[mode]=nextEntries;else {hasPlan=true;revision+=1;if(tab==='history')void loadActivity(true);}return true;}
  catch(error){notify(cloud.errorMessage(error));return false;}
  finally{busy=false;}
}
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function installAvailable(){return location.protocol==='https:'&&!window.matchMedia?.('(display-mode: standalone)').matches&&!navigator.standalone;}
function notify(message) { const el = document.querySelector('#notice'); el.textContent = message; clearTimeout(timer); timer = setTimeout(() => el.textContent = '', 5000); }
async function loadActivity(reset=false){
  if(demo||!user||(!reset&&(!activityMore||activityLoading)))return;
  const request=++activityRequest, uid=user.uid;
  if(reset){activity=[];activityCursor=null;activityMore=false;activityLoaded=false;activityError='';}
  activityLoading=true;
  if(screen==='dashboard'&&tab==='history')render();
  try{
    const page=await cloud.listOperations(activityCursor);
    if(request!==activityRequest||user?.uid!==uid)return;
    activity=[...activity,...page.items];activityCursor=page.cursor;activityMore=page.hasMore;activityLoaded=true;activityError='';
  }catch(error){if(request!==activityRequest)return;activityError=cloud.errorMessage(error);}
  finally{if(request===activityRequest){activityLoading=false;if(screen==='dashboard'&&tab==='history')render();}}
}
function completed() { return entries.flatMap(e => e.ids); }
function saveDemoProfile() { if (demo) demoProfilesByMode[mode] = { place, placeName, purpose, startDate }; }
function restoreDemoProfile(nextMode) {
  const profile = demoProfilesByMode[nextMode];
  if (profile) ({ place, placeName, purpose, startDate } = profile);
  else { place = 'pocket'; placeName = 'Nequi'; purpose = ''; startDate = today(); }
}
function nextMilestone(saved) { return [250000, 500000, 750000, 1000000].find(value => saved < value) || null; }
function brandLogo() { return `<div class="brand ahorremax-lockup"><img src="./assets/ahorremax-logo.png" alt="Ahorremax"></div>`; }
function header() { return `<header class="topbar">${brandLogo()}${screen === 'welcome' ? '<span class="pill">Tu primer millón, a tu manera</span>' : `<button class="text-button" data-action="exit">${demo?'Salir de la demo':'Cerrar sesión'}</button>`}</header>`; }
function render() {
  root.innerHTML = `${screen !== 'welcome' ? `<div class="demo-banner">${demo?'Demo · Aportes de prueba, no se guardan al recargar.':syncError?'Sin sincronización. No registres aportes hasta reconectar.':`Cuenta de ${escape(user?.displayName||user?.email||'usuario')} · Historial en la nube`}</div>` : ''}<main class="shell mode-${mode} screen-${screen}">${screen !== 'welcome' ? walletNavigation() : ''}${header()}${screen === 'welcome' ? welcome() : screen === 'plans' ? plans() : screen === 'setup' ? setup() : screen === 'goal' ? goalEditor() : screen === 'method-info' ? methodInfo() : dashboard()}<footer class="footer">${installAvailable()?'<button class="text-button footer-install" data-action="install">Instalar Ahorremax</button>':''}Ahorremax · Montos en pesos colombianos (COP)</footer></main>${screen !== 'welcome' ? walletBottomNavigation() : ''}`;
}
function walletNavigation() {
  return `<aside class="wallet-sidebar" aria-label="Navegación de Ahorremax"><div class="wallet-side-logo">${brandLogo()}</div><p class="wallet-side-section">MI AHORRO</p><button data-action="home" class="${screen==='dashboard'&&tab==='plan'?'active':''}"><span>◫</span> Resumen</button><button data-action="plans" class="${screen==='plans'?'active':''}"><span>▦</span> Mis retos</button><button data-action="history" class="${tab==='history'?'active':''}"><span>◷</span> Movimientos</button><div class="wallet-side-footer"><span class="wallet-avatar"><img src="./assets/ahorremax-mark.png" alt=""></span><div><strong>Ahorremax</strong><small>${demo?'Exploración temporal':'Mi cuenta de ahorro'}</small></div></div></aside>`;
}
function walletBottomNavigation() {
  return `<nav class="wallet-bottom-nav" aria-label="Navegación principal"><button data-action="home" class="${screen==='dashboard'&&tab==='plan'?'active':''}"><span>◫</span>Resumen</button><button data-action="plans" class="${screen==='plans'?'active':''}"><span>▦</span>Retos</button><button data-action="history" class="${tab==='history'?'active':''}"><span>◷</span>Historial</button></nav>`;
}
function welcome() { const install=installAvailable()?'<button class="secondary install-button" data-action="install">Instalar Ahorremax en mi celular</button>':''; return `${location.protocol==='file:'?'<div class="setup-note">Vista local de demostración. Para iniciar sesión y guardar tu avance, abre la aplicación desde tu página web.</div>':''}<div class="login-layout"><section class="login-intro"><div class="intro-chip">AHORRAR TAMBIÉN SE DISFRUTA</div><p class="eyebrow">Un hábito que crece contigo</p><h1>Pequeños pasos.<span>Un millón de posibilidades.</span></h1><p class="muted">Elige cómo quieres ahorrar, separa tu dinero y mira cómo cada aporte te acerca a tu meta.</p><div class="goal-note"><div><strong>3 caminos</strong><span>Elige el que va contigo</span></div><div><strong>$1.000.000</strong><span>Una meta para empezar</span></div></div></section><section class="login-card"><p class="eyebrow">Tu meta empieza aquí</p><h2>Vamos por ese millón.</h2><p class="muted">Elige tu cuenta y lleva tu avance contigo.</p><button class="google" data-action="google"><img class="provider-logo" src="./assets/google.png" alt="">Continuar con Google</button><button class="google facebook" data-action="facebook"><svg class="provider-logo" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#0866ff"/><path fill="white" d="M16.7 15.5l.53-3.5h-3.36V9.73c0-.96.47-1.89 1.97-1.89h1.53V4.87s-1.39-.24-2.72-.24c-2.77 0-4.59 1.68-4.59 4.72V12H7v3.5h3.06V24h3.81v-8.5z"/></svg>Continuar con Facebook</button>${!cloud.providersReady.google||!cloud.providersReady.facebook?`<div class="setup-note small muted">${cloud.providersReady.google?'Google está habilitado. Facebook estará disponible próximamente.':'Estamos conectando las cuentas. Mientras tanto, explora la demo.'}</div>`:'<p class="small muted">Tu historial se guarda de forma privada en tu cuenta.</p>'}<button class="primary" data-action="demo">Probar sin cuenta <span aria-hidden="true">→</span></button>${install}<p class="small muted" style="margin:20px 0 0">Tú guardas el dinero donde prefieras. Ahorremax te ayuda a llevar el registro.</p></section></div>`; }
function plans() {
  const order = ['weekly', 'flexible', 'daily'];
  const details = {
    weekly: { number: '01', label: 'CONSTANCIA SEMANAL', headline: modes.weekly.name, text: modes.weekly.tagline, visual: '<div class="weekly-preview" aria-hidden="true"><i>26</i><i>27</i><i>28</i><i>29</i><i>30</i><span>mil COP por semana ↗</span></div>', stat: '26 aportes · $1.001.000' },
    flexible: { number: '02', label: 'FLEXIBLE Y A TU RITMO', headline: modes.flexible.name, text: modes.flexible.tagline, visual: '<div class="flexible-preview" aria-hidden="true"><i>☺</i><i>♥</i><i>♫</i><i>☀</i><i>▲</i><i>+</i><i>+</i><i>+</i><i>+</i><i>+</i></div>', stat: '200 casillas · $1.195.000' },
    daily: { number: '03', label: 'RETO INTENSIVO', headline: modes.daily.name, text: modes.daily.tagline, visual: '<div class="daily-preview" aria-hidden="true"><i style="height:30%"></i><i style="height:41%"></i><i style="height:52%"></i><i style="height:64%"></i><i style="height:77%"></i><i style="height:88%"></i><i style="height:100%"></i></div>', stat: '40 aportes · $1.020.000' }
  };
  return `<section class="section-heading challenge-heading"><div><p class="eyebrow">Elige tu camino</p><h1>Tres formas de llegar a tu millón.</h1><p class="muted">Cada reto tiene un ritmo y una forma distinta de registrar tus ahorros.</p></div></section><div class="challenge-grid">${order.map(key=>{const d=details[key];const active=!demo&&hasPlan&&mode===key;const ids=demo?demoEntriesByMode[key].flatMap(e=>e.ids):(active?completed():[]);const summary=summarize(key,ids);return `<button class="challenge-card challenge-${key} ${active?'is-active':''}" data-mode="${key}" aria-label="${active?'Continuar':'Elegir'} ${modes[key].name}, ${d.stat}"><span class="challenge-top"><span class="challenge-number">${d.number}</span><span class="challenge-label">${active?'MI RETO ACTIVO':d.label}</span></span><div class="challenge-visual campaign-visual"><img src="./assets/campaign/${key}.webp" alt="" width="960" height="640" decoding="async" loading="lazy"></div><div class="challenge-copy"><h2 class="campaign-title">${d.headline}</h2><p>${d.text}</p></div><div class="challenge-foot"><span>${d.stat}</span><strong>${active?'Continuar · '+money(summary.saved):summary.saved?money(summary.saved)+' ahorrados':demo?'Explorar reto':hasPlan?'Conocer método':'Elegir reto'} <span aria-hidden="true">→</span></strong></div></button>`}).join('')}</div><p class="challenge-note">${!demo&&hasPlan?'Tu cuenta conserva un reto activo. Esta versión guarda un plan por persona; los otros métodos se muestran para comparar.':'Los tres recorridos superan $1.000.000. La meta se celebra al llegar a esa cifra; puedes seguir hasta completar cada plan.'}</p>`;
}
function methodInfo() {
  const selectedMode = infoMode;
  const plan = createPlan(selectedMode);
  const explanations = {
    weekly: 'Separas dinero una vez por semana. El aporte sube $1.000 cada semana, desde $26.000 hasta $51.000.',
    flexible: 'Escoges casillas según el dinero disponible. Puedes combinar valores o usar los cinco atajos de iconos para marcar varias a la vez.',
    daily: 'Separas dinero cada día durante 40 días. Comienzas con $6.000 y sumas $1.000 al aporte diario anterior.'
  };
  return `<button class="text-button" data-action="plans">← Ver los tres retos</button><section class="method-info info-${selectedMode}"><p class="eyebrow">${modes[selectedMode].duration}</p><h1>${modes[selectedMode].name}</h1><p>${explanations[selectedMode]}</p><div class="method-info-numbers"><div><span>Primer aporte</span><strong>${money(plan[0].amount)}</strong></div><div><span>${selectedMode==='flexible'?'Casilla mayor':'Último aporte'}</span><strong>${money(selectedMode==='flexible'?Math.max(...plan.map(item=>item.amount)):plan.at(-1).amount)}</strong></div><div><span>Plan completo</span><strong>${money(summarize(selectedMode).planTotal)}</strong></div></div><p class="small muted">Tu reto activo es ${modes[mode].name}. Sus aportes permanecen guardados; esta versión lleva un reto por cuenta.</p><button class="primary" data-action="home">Volver a mi reto →</button></section>`;
}
function purposeInput() { return `<label for="purpose">¿Para qué quieres ahorrar $1.000.000?</label><p class="field-help">Ponle nombre a lo que quieres lograr. Lo verás cada vez que avances.</p><input id="purpose" name="purpose" maxlength="80" minlength="3" required placeholder="Ej.: mi fondo de emergencia" value="${escape(purpose)}" autocomplete="off"><div class="purpose-suggestions" aria-label="Ideas para tu meta"><button type="button" data-purpose="Mi fondo de emergencia">Fondo de emergencia</button><button type="button" data-purpose="Mis estudios">Estudios</button><button type="button" data-purpose="Un viaje especial">Un viaje</button><button type="button" data-purpose="Mi emprendimiento">Emprendimiento</button></div>`; }
function setup() { return `<button class="text-button" data-action="plans">← Cambiar método</button><section class="section-heading"><div><p class="eyebrow">Tu reto, tu razón</p><h1>¿Qué hará posible tu millón?</h1><p class="muted">Una meta concreta te ayuda a recordar por qué empezaste.</p></div><span class="steps">Paso 2 de 2</span></section><form id="setup-form" class="form-card">${purposeInput()}<label>¿Dónde vas a guardar tu ahorro?</label><div class="place-options">${Object.entries(places).map(([key,p])=>`<button type="button" class="place" data-place="${key}" aria-pressed="${place===key}"><span aria-hidden="true">${p[2]}</span><span><strong>${p[0]}</strong><small>${p[1]}</small></span></button>`).join('')}</div>${place!=='cash'?`<label for="place-name">${place==='pocket'?'Nombre del bolsillo o entidad':'Nombre de la entidad'}</label><input id="place-name" name="placeName" maxlength="60" required value="${escape(placeName)}" placeholder="${place==='pocket'?'Por ejemplo, Nequi':'Por ejemplo, tu banco'}" autocomplete="off">`:''}<label for="start">Fecha de inicio</label><input id="start" name="start" type="date" required value="${startDate}"><div class="summary-strip"><span>${modes[mode].name} · ${modes[mode].duration}</span><strong>${money(summarize(mode).planTotal)}</strong></div><button class="primary" type="submit">${demo?'Comenzar mi plan de prueba':'Crear y guardar mi plan'} →</button></form>`; }
function goalEditor() { return `<button class="text-button" data-action="home">← Volver a mi avance</button><section class="section-heading"><div><p class="eyebrow">Tu motivo</p><h1>Una meta que tenga sentido para ti.</h1><p class="muted">Puedes cambiar el nombre de tu objetivo sin perder ningún aporte.</p></div></section><form id="goal-form" class="form-card">${purposeInput()}<button class="primary" type="submit">Guardar mi meta →</button></form>`; }
function methodIntro(summary, plan) {
  if (mode === 'weekly') return `<section class="method-banner method-weekly"><div><span class="method-kicker">RETO 01 · 26 SEMANAS</span><h2>${modes.weekly.name}</h2><p>${modes.weekly.tagline} Comienzas con $26.000 y subes $1.000 cada semana. El aporte 26 es de $51.000.</p></div><div class="method-mini weekly-mini" aria-hidden="true"><span>Semana 1<br><strong>$26k</strong></span><span>Semana 13<br><strong>$38k</strong></span><span>Semana 26<br><strong>$51k</strong></span></div></section>`;
  if (mode === 'daily') return `<section class="method-banner method-daily"><div><span class="method-kicker">RETO 03 · 40 DÍAS</span><h2>${modes.daily.name}</h2><p>${modes.daily.tagline} El primer día separas $6.000. Cada día sumas $1.000 y terminas con un aporte de $45.000.</p></div><div class="method-mini daily-mini" aria-hidden="true"><span>Día 1<br><strong>$6k</strong></span><span>→</span><span>Día 40<br><strong>$45k</strong></span></div></section>`;
  return `<section class="method-banner method-flexible"><div><span class="method-kicker">RETO 02 · 200 CASILLAS</span><h2>${modes.flexible.name}</h2><p>${modes.flexible.tagline} Escoge casillas, combina montos o usa los cinco iconos para registrar un aporte adicional.</p></div><div class="method-mini flexible-mini" aria-hidden="true"><span>☺</span><span>♥</span><span>♫</span><span>☀</span><span>▲</span></div></section>`;
}
function goalCard(summary) {
  const milestone = nextMilestone(summary.saved);
  return `<section class="personal-goal" aria-label="Mi motivo para ahorrar"><div class="goal-emblem" aria-hidden="true">✦</div><div class="personal-goal-copy"><span class="eyebrow">AHORRO PARA</span><h2>${escape(purpose || 'Mi primer millón')}</h2><p>${milestone ? `Siguiente hito: ${money(milestone)} · te faltan ${money(milestone-summary.saved)}.` : 'Cumpliste tu meta de $1.000.000. Puedes terminar las casillas que quedan.'}</p></div><button class="goal-edit" data-action="edit-goal" aria-label="Editar el propósito de mi ahorro">Editar meta</button></section>`;
}
function inAppReminder(next) {
  if (!next) return 'Terminaste todos los aportes previstos.';
  if (mode === 'flexible') return 'Recordatorio: escoge una casilla cuando separes dinero; tú decides el ritmo.';
  const scheduled = new Date(`${startDate}T12:00:00`);
  scheduled.setDate(scheduled.getDate() + (next.period-1) * (mode === 'weekly' ? 7 : 1));
  const current = new Date(`${today()}T12:00:00`);
  const days = Math.round((scheduled-current)/86400000);
  if (days === 0) return 'Tu próximo aporte está previsto para hoy.';
  if (days === 1) return 'Tu próximo aporte está previsto para mañana.';
  if (days < 0) return 'Este aporte sigue disponible. Puedes retomarlo a tu ritmo.';
  return `Próximo aporte previsto: ${dueDate(next.period)}.`;
}
function dashboard() {
  const ids = completed(), summary = summarize(mode, ids), plan = createPlan(mode), next = plan.find(item => !ids.includes(item.id));
  return `<section class="section-heading"><div><p class="eyebrow">Mi ahorro</p><h1>${summary.goalReached?'¡Llegaste a tu primer millón!':'Cada aporte cuenta.'}</h1><p class="muted">${escape(purpose||'Estás construyendo un hábito para ti.')}</p></div><button class="pill challenge-switch" data-action="plans">Ver los 3 retos ↗</button></section>${methodIntro(summary,plan)}${goalCard(summary)}${summary.goalReached?`<div class="celebrate"><strong>Meta de $1.000.000 alcanzada</strong><p>${summary.planCompleted?'También completaste todas las casillas de tu plan.':'Puedes continuar hasta completar tu plan de '+money(summary.planTotal)+'.'}</p></div>`:''}<div class="dashboard"><section class="balance"><span class="eyebrow">Ahorro registrado</span><div class="number">${money(summary.saved)}</div><div class="balance-sub">de una meta de $1.000.000</div><div class="progress-row"><span>Tu avance</span><strong>${summary.progress.toLocaleString('es-CO',{maximumFractionDigits:1})} %</strong></div><div class="milestone-labels" aria-hidden="true"><span>INICIO</span><span>25 %</span><span>50 %</span><span>75 %</span><span>META</span></div><div class="track" role="progressbar" aria-label="Avance hacia un millón" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${summary.progress}"><div style="width:${summary.progress}%"></div></div><div class="wallet-chart-row"><div class="wallet-donut" style="--progress:${summary.progress}%" aria-hidden="true"><span>${Math.round(summary.progress)}<small>%</small></span></div><div class="wallet-chart-copy"><strong>Camino a tu millón</strong><p>${summary.completedCount} de ${plan.length} aportes marcados</p><p class="wallet-chart-legend"><i></i> Ahorro registrado</p></div></div><div class="balance-bottom"><span>${summary.remaining?`Te faltan ${money(summary.remaining)}`:'Meta alcanzada'}</span><span>${summary.completedCount} de ${plan.length} aportes</span></div></section><section class="next-card"><div><span class="eyebrow">${next?'Tu próximo paso':'Plan completado'}</span><div class="number">${next?money(next.amount):'¡Lo lograste!'}</div><p class="muted">${next?(mode==='flexible'?'Una casilla disponible. También puedes elegir otras y combinarlas abajo.':`${modes[mode].unit} ${next.period} · ${dueDate(next.period)}<br>Registra el aporte después de separar tu dinero.`):'Cada aporte hizo posible este resultado.'}</p><p class="timing-cue">${inAppReminder(next)}</p></div><button class="primary" data-action="next" ${!next?'disabled':''}>${next?'Registrar este aporte':'Todos los aportes completados'}</button></section></div><div class="detail-row"><span class="icon-box" aria-hidden="true">${places[place][2]}</span><div><strong>${escape(place==='cash'?'Efectivo en casa':placeName)}</strong><p class="muted">${places[place][0]}</p></div><span class="end">Registro manual</span></div><div class="tabbar" role="tablist" aria-label="Detalle del ahorro"><button role="tab" aria-selected="${tab==='plan'}" data-tab="plan">Mi plan</button><button role="tab" aria-selected="${tab==='history'}" data-tab="history">Historial (${entries.length})</button></div>${tab==='plan'?`${mode==='flexible'?flexibleTools():''}${planView(plan,ids)}`:history()}${selected.size&&tab==='plan'?`<div class="batch"><p><strong>${selected.size} casillas seleccionadas</strong><br>${money(plan.filter(item=>selected.has(item.id)).reduce((sum,item)=>sum+item.amount,0))}</p><button class="text-button" data-action="clear">Limpiar</button><button class="primary" data-action="batch">Registrar aporte</button></div>`:''}`;
}
function dueDate(period) { const d = new Date(`${startDate}T12:00:00`); d.setDate(d.getDate()+(period-1)*(mode==='weekly'?7:1)); return new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',year:'numeric'}).format(d); }
function planView(plan, ids) {
  const visible=plan.filter(item=>filter==='all'||(filter==='done'?ids.includes(item.id):!ids.includes(item.id)));
  const header=`<div class="plan-header"><div><p class="eyebrow">${modes[mode].duration}</p><h2>${modes[mode].name}</h2></div><select id="filter" aria-label="Filtrar aportes"><option value="all" ${filter==='all'?'selected':''}>Todos</option><option value="pending" ${filter==='pending'?'selected':''}>Pendientes</option><option value="done" ${filter==='done'?'selected':''}>Completados</option></select></div><p class="small muted">Selecciona uno o varios aportes pendientes. Regístralos después de separar tu dinero.</p>`;
  if(!visible.length)return header+'<div class="empty">Todavía no hay aportes en este filtro.</div>';
  if(mode==='weekly')return header+`<div class="weekly-list">${visible.map(item=>{const number=plan.indexOf(item)+1,done=ids.includes(item.id);return `<button class="week-row ${done?'done':''} ${selected.has(item.id)?'selected':''}" data-id="${item.id}" aria-pressed="${selected.has(item.id)}" ${done?'disabled':''} aria-label="Semana ${number}, ${money(item.amount)}, ${done?'completada':'pendiente'}"><span class="week-marker">${done?'✓':String(number).padStart(2,'0')}</span><span class="week-content"><strong>Semana ${number}</strong><small>${dueDate(item.period)}</small></span><span class="week-amount">${money(item.amount)}</span><span class="week-state">${done?'Completada':selected.has(item.id)?'Seleccionada':'Pendiente'}</span></button>`}).join('')}</div>`;
  if(mode==='daily')return header+`<div class="daily-grid">${visible.map(item=>{const number=plan.indexOf(item)+1,done=ids.includes(item.id);return `<button class="day-card ${done?'done':''} ${selected.has(item.id)?'selected':''}" data-id="${item.id}" aria-pressed="${selected.has(item.id)}" ${done?'disabled':''} aria-label="Día ${number}, ${money(item.amount)}, ${done?'completado':'pendiente'}"><span class="day-top"><span>DÍA ${String(number).padStart(2,'0')}</span><span>${done?'✓':'↗'}</span></span><strong>${money(item.amount)}</strong><small>${dueDate(item.period)}</small><i style="width:${Math.round(item.amount/45000*100)}%" aria-hidden="true"></i></button>`}).join('')}</div>`;
  return header+`<div class="tiles flexible-tiles">${visible.map(item=>{ const done=ids.includes(item.id),number=plan.indexOf(item)+1; return `<button class="tile ${done?'done':''} ${selected.has(item.id)?'selected':''}" data-id="${item.id}" aria-pressed="${selected.has(item.id)}" ${done?'disabled':''} aria-label="Casilla ${number}, ${money(item.amount)}, ${done?'completada':'pendiente'}"><span>${done?'✓ Completada':'Casilla '+number}</span><strong>${money(item.amount)}</strong>${item.shortcut?`<i class="tile-symbol symbol-${item.shortcut}" aria-label="${SHORTCUTS.find(g=>g.key===item.shortcut).name}">${SHORTCUTS.find(g=>g.key===item.shortcut).icon}</i>`:''}</button>`; }).join('')}</div>`;
}
function activityLog(){
  if(demo)return '';
  const labels={plan_created:'Plan creado',contribution_added:'Aporte registrado',contribution_corrected:'Aporte corregido',goal_updated:'Meta actualizada'};
  const rows=activity.map(item=>{
    const title=labels[item.type]||'Actividad';
    const date=item.createdAt?new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.createdAt)):'Fecha pendiente';
    const amount=item.amount?(item.type==='contribution_corrected'?'−':'· ')+money(item.amount):'';
    const detail=item.type==='goal_updated'?' · '+escape(item.purpose):item.ids?.length?' · '+item.ids.length+' casilla'+(item.ids.length===1?'':'s'):'';
    return `<div class="activity-row"><div class="activity-mark" aria-hidden="true">${item.type==='contribution_corrected'?'↶':item.type==='contribution_added'?'+':'✓'}</div><div><strong>${title}</strong><p>${date}${detail}</p></div><span>${amount}</span></div>`;
  }).join('');
  return `<section class="activity-section"><div class="activity-heading"><div><p class="eyebrow">Registro de actividad</p><h2>Tus operaciones</h2></div><p>Conservamos los aportes, las correcciones y los cambios de meta de tu cuenta.</p></div>${rows||(!activityLoading&&activityLoaded?'<div class="empty">No hay operaciones registradas desde que se activó este historial.</div>':'')}${activityError?`<p class="activity-error" role="alert">${escape(activityError)}</p>`:''}${activityLoading?'<p class="activity-loading" role="status">Cargando operaciones…</p>':''}${activityMore&&!activityLoading?'<button class="secondary activity-more" data-action="more-activity">Ver operaciones anteriores</button>':''}</section>`;
}
function history() {
  const current=entries.length?entries.slice().reverse().map(e=>`<div class="history-row"><div><strong>${money(e.amount)}</strong><p>${new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(e.date))} · ${e.ids.length} casilla${e.ids.length>1?'s':''}${e.shortcut?' · Atajo '+escape(SHORTCUTS.find(g=>g.key===e.shortcut)?.name||''):''}</p></div><button class="text-button" data-remove="${e.id}">Corregir aporte</button></div>`).join(''):'<div class="empty"><h3>Aquí empieza tu historia.</h3><p>Cuando registres tu primer aporte, aparecerá en este espacio.</p></div>';
  return `<section class="current-entries"><h2>Aportes vigentes</h2>${current}</section>${activityLog()}`;
}
async function confirm(title, copy) { const dialog=document.querySelector('#confirm'); if(dialog.open)return false; document.querySelector('#dialog-title').textContent=title; document.querySelector('#dialog-copy').textContent=copy; dialog.returnValue='cancel'; dialog.showModal(); return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true})); }
function flexibleTools(){
  return `<section class="shortcut-section"><div class="plan-header"><div><p class="eyebrow">Dale un impulso a tu meta</p><h2>Un aporte. Varias casillas.</h2></div><span class="spark">✦</span></div><p class="muted small">Elige un icono y marcaremos automáticamente todas sus casillas pendientes.</p><div class="shortcuts">${SHORTCUTS.map(g=>{const quote=shortcutQuote(g.key,completed());return `<button class="shortcut ${g.key}" data-shortcut="${g.key}" ${!quote.ids.length?'disabled':''}><span class="shortcut-icon">${g.icon}</span><strong>${quote.ids.length?money(quote.amount):'¡Listo!'}</strong><span>${g.name}</span><small>${quote.ids.length} pendientes</small></button>`;}).join('')}</div><details class="rules"><summary>Cómo ahorrar $1.000.000 en 200 días <span>Ver reglas</span></summary><ol><li>Separa dinero cada día y marca las casillas que sumen exactamente tu aporte. Por ejemplo: $1.000 + $2.000 + $4.000 = $7.000.</li><li>Puedes combinar casillas o utilizar un atajo: ☺ $20.000, ♥ $40.000, ♫ $60.000, ☀ $80.000 y ▲ $100.000. La distribución de iconos está ajustada para que estas sumas sean exactas.</li><li>Si ya pagaste parte de un grupo, el atajo descuenta esas casillas: solo registrarás lo pendiente. Nunca se contará dos veces un mismo ahorro.</li><li>Con una casilla por día completarás el tablero en 200 días; si combinas varias, puedes terminar antes. El tablero completo suma $1.195.000 y celebramos al alcanzar $1.000.000.</li><li>Registra un aporte después de guardar el dinero en tu cuenta, bolsillo o en casa. Ahorremax lleva el control, no realiza transferencias.</li><li>Si te equivocas, corrige el aporte desde Historial. Sus casillas volverán a estar disponibles.</li></ol></details></section>`;
}
async function record(ids,shortcut=null) {
  if(busy||syncError)return;
  const done=new Set(completed()); const items=createPlan(mode).filter(i=>ids.includes(i.id)&&!done.has(i.id));if(!items.length)return;
  const amount=items.reduce((s,i)=>s+i.amount,0);
  if(!await confirm(shortcut?'Activa tu atajo '+SHORTCUTS.find(g=>g.key===shortcut).icon:'¿Ya separaste este dinero?',`Registrarás ${money(amount)} en ${place==='cash'?'efectivo en casa':placeName} y marcaremos ${items.length} ${items.length===1?'casilla':'casillas'}.${demo?' Es un aporte de prueba.':''}`))return;
  if(items.some(i=>completed().includes(i.id))){notify('El plan cambió. Revisa las casillas e inténtalo otra vez.');return;}
  const entry={id:crypto.randomUUID(),ids:items.map(i=>i.id),amount,date:new Date().toISOString(),shortcut};
  const before = summarize(mode, completed()).saved;
  if(await persist([...entries,entry],{type:'contribution_added',amount,ids:entry.ids,entryId:entry.id,shortcut:shortcut||''})){
    selected.clear();render();
    const reached = [250000,500000,750000,1000000].filter(value => before < value && before + amount >= value).at(-1);
    notify(reached ? `¡Llegaste a ${money(reached)}! ${demo?'Aporte de prueba registrado.':'Tu aporte quedó guardado.'}` : demo?'Aporte de prueba registrado.':'Aporte guardado en tu cuenta.');
  }
}
root.addEventListener('click',async event=>{
  const button=event.target.closest('button'); if(!button||busy)return;
  if(button.dataset.purpose){const input=document.querySelector('#purpose');if(input){input.value=button.dataset.purpose;input.focus();}return;}
  if(button.dataset.shortcut){const q=shortcutQuote(button.dataset.shortcut,completed());await record(q.ids,q.key);return;}
  if(button.dataset.mode){
    const nextMode=button.dataset.mode;
    if(!demo){
      if(hasPlan){screen=nextMode===mode?'dashboard':'method-info';infoMode=nextMode;tab='plan';render();window.scrollTo(0,0);return;}
      mode=nextMode;screen='setup';render();window.scrollTo(0,0);return;
    }
    demoEntriesByMode[mode]=entries;
    mode=nextMode;entries=demoEntriesByMode[mode];restoreDemoProfile(mode);
    selected.clear();filter='all';tab='plan';screen=demoProfilesByMode[mode]?'dashboard':'setup';
    render();window.scrollTo(0,0);return;
  }
  if(button.dataset.place){rememberForm();place=button.dataset.place;placeName=place==='pocket'?'Nequi':'';render();return;}
  if(button.dataset.tab){tab=button.dataset.tab;render();if(tab==='history'&&!demo)void loadActivity(true);return;}
  if(button.dataset.id){selected.has(button.dataset.id)?selected.delete(button.dataset.id):selected.add(button.dataset.id);const scroll=window.scrollY;render();window.scrollTo(0,scroll);return;}
  if(button.dataset.remove){const removed=entries.find(e=>e.id===button.dataset.remove);if(removed&&await confirm('Corregir este aporte','Se retirará este registro del total y sus casillas quedarán disponibles otra vez.')){if(await persist(entries.filter(e=>e.id!==button.dataset.remove),{type:'contribution_corrected',amount:removed.amount,ids:removed.ids,entryId:removed.id,shortcut:removed.shortcut||''})){render();notify('Registro corregido.');}}return;}
  switch(button.dataset.action){
    case 'google': case 'facebook': if(signingIn){notify('Ya hay una ventana de acceso abierta. Complétala o ciérrala para intentarlo de nuevo.');break;} signingIn=true;button.disabled=true;notify('Abriendo el acceso. Si no ves la ventana, revisa si tu navegador bloqueó las ventanas emergentes.');try{await cloud.signIn(button.dataset.action);}catch(error){notify(cloud.errorMessage(error));}finally{signingIn=false;button.disabled=false;}break;
    case 'home': screen=!demo&&!hasPlan?'plans':'dashboard';tab='plan';render();window.scrollTo(0,0);break;
    case 'history': screen=!demo&&!hasPlan?'plans':'dashboard';tab='history';render();if(!demo&&hasPlan)void loadActivity(true);window.scrollTo(0,0);break;
    case 'more-activity': void loadActivity();break;
    case 'demo': demo=true;screen='plans';render();window.scrollTo(0,0);break;
    case 'install': {
      if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;notify(choice.outcome==='accepted'?'Ahorremax se está instalando.':'Puedes instalar Ahorremax más adelante desde el menú del navegador.');}
      else if(/iPhone|iPad|iPod/i.test(navigator.userAgent||''))notify('En Safari, toca Compartir y luego Agregar a pantalla de inicio.');
      else notify('Abre el menú de tu navegador y elige Instalar aplicación o Agregar a pantalla de inicio.');
      break;
    }
    case 'plans': rememberForm();screen='plans';render();window.scrollTo(0,0);break;
    case 'setup': screen='setup';render();window.scrollTo(0,0);break;
    case 'edit-goal': screen='goal';render();window.scrollTo(0,0);break;
    case 'next': { const next=createPlan(mode).find(i=>!completed().includes(i.id));if(next)await record([next.id]);break; }
    case 'batch': await record([...selected]);break;
    case 'clear': selected.clear();render();break;
    case 'exit': if(!demo){try{await cloud.signOut();}catch(error){notify(cloud.errorMessage(error));}break;}if(!Object.values(demoEntriesByMode).some(items=>items.length)||await confirm('¿Salir de la prueba?','Los aportes de ejemplo de los tres retos se borrarán.')){for(const key of Object.keys(demoEntriesByMode)){demoEntriesByMode[key]=[];demoProfilesByMode[key]=null;}entries=[];selected.clear();tab='plan';filter='all';screen='welcome';render();window.scrollTo(0,0);}break;
  }
});
function rememberForm(){const form=document.querySelector('#setup-form');if(!form)return; const data=new FormData(form);purpose=String(data.get('purpose')||'').trim();startDate=String(data.get('start')||today());placeName=String(data.get('placeName')||'').trim();}
root.addEventListener('submit',async event=>{
  if(!['setup-form','goal-form'].includes(event.target.id))return;
  event.preventDefault();
  if(event.target.id==='goal-form'){
    const nextPurpose=String(new FormData(event.target).get('purpose')||'').trim();
    if(nextPurpose.length<3){notify('Escribe una meta de al menos tres caracteres.');return;}
    const previousPurpose=purpose;purpose=nextPurpose;
    if(await persist(entries,{type:'goal_updated',amount:0,ids:[],entryId:''})){saveDemoProfile();screen='dashboard';render();window.scrollTo(0,0);notify('Tu meta quedó actualizada.');}
    else purpose=previousPurpose;
    return;
  }
  rememberForm();
  if(purpose.length<3){notify('Cuéntanos para qué quieres ahorrar.');return;}
  if(place!=='cash'&&!placeName){notify('Escribe el nombre de la entidad o bolsillo.');return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isFinite(new Date(`${startDate}T12:00:00`).getTime())){notify('Revisa la fecha de inicio.');return;}
  if(await persist(entries,{type:'plan_created',amount:0,ids:[],entryId:''})){saveDemoProfile();screen='dashboard';render();window.scrollTo(0,0);}
});
root.addEventListener('change',event=>{if(event.target.id==='filter'){filter=event.target.value;render();}});
render();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_savings_preview',description:'Read the current Ahorremax trial savings summary. This is temporary demo data, not a real account.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>demo?({demo:true,mode,...summarize(mode,completed())}):({available:false,message:'El historial de cuentas reales no se expone mediante esta herramienta de demostración.'})})).catch(()=>{});}catch{}}

cloud.initialize(async account=>{
  const previousUser=user;
  unwatch?.();unwatch=null;user=account;
  if(!account&&!previousUser){return;}
  entries=[];selected.clear();revision=0;syncError=false;hasPlan=false;
  activityRequest++;activity=[];activityCursor=null;activityMore=false;activityLoading=false;activityLoaded=false;activityError='';
  if(!account){demo=true;screen='welcome';render();return;}
  demo=false;screen='loading';root.innerHTML='<main class="shell"><h1>Recuperando tu avance…</h1></main>';
  unwatch=cloud.watch(data=>{try{const priorRevision=revision;if(data){restore(data);hasPlan=true;screen='dashboard';}else{hasPlan=false;screen='plans';}syncError=false;render();if(tab==='history'&&revision!==priorRevision)void loadActivity(true);}catch(error){syncError=true;screen='welcome';render();notify(error.message);}},error=>{syncError=true;screen='welcome';render();notify(cloud.errorMessage(error));});
}).catch(error=>notify(cloud.errorMessage(error)));

window.addEventListener?.('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener?.('appinstalled',()=>{installPrompt=null;notify('Ahorremax quedó instalada en este dispositivo.');});
if(location.protocol!=='file:'&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
