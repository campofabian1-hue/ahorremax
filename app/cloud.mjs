import { firebaseConfig, providersReady, webPushVapidKey } from './firebase-config.mjs';
export { providersReady };
export const configured = Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.authDomain);
let auth, db, authApi, storeApi, firebaseApp, messagingApi, messagingInstance;
export const remindersConfigured = Boolean(webPushVapidKey);
export async function initialize(onUser) {
  if(location.protocol==='file:'||!configured)return;
  const [appApi,a,s]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),
  ]);
  authApi=a;storeApi=s;
  firebaseApp=appApi.initializeApp(firebaseConfig);auth=a.getAuth(firebaseApp);db=s.getFirestore(firebaseApp);
  let redirectError=null;
  try{await a.getRedirectResult(auth);}catch(error){redirectError=error;}
  a.onAuthStateChanged(auth,onUser);
  if(redirectError)throw redirectError;
}
export function usesRedirect(){
  return location.hostname===firebaseConfig.authDomain;
}
export async function signIn(provider) {
  if(location.protocol==='file:')throw new Error('Para iniciar sesión, abre Ahorremax desde tu página web o http://localhost:4173/app/. El archivo local solo permite explorar la demo.');
  if(!providersReady[provider])throw new Error(`El acceso con ${provider==='google'?'Google':'Facebook'} aún se está configurando. Puedes explorar la demo.`);
  if(!configured||!authApi)throw new Error('El acceso está pendiente de configuración. Puedes explorar la demo.');
  const p=provider==='google'?new authApi.GoogleAuthProvider():new authApi.FacebookAuthProvider();
  if(usesRedirect())return authApi.signInWithRedirect(auth,p);
  return authApi.signInWithPopup(auth,p);
}
export async function signOut(){
  if(!auth)return;
  let reminderError=null;
  try{await disableDreamReminders();}catch(error){reminderError=error;}
  await authApi.signOut(auth);
  if(reminderError)throw new Error('La sesión se cerró, pero no pudimos desactivar los avisos de este dispositivo. Revisa el permiso de notificaciones del navegador.');
}
function deviceRef(installationId){if(!auth?.currentUser)throw new Error('Inicia sesión para administrar tus recordatorios.');return storeApi.doc(db,'users',auth.currentUser.uid,'notificationDevices',installationId);}
export async function enableDreamReminders(){
  if(!remindersConfigured)throw new Error('Los avisos al celular están pendientes de activar en Firebase.');
  if(!auth?.currentUser)throw new Error('Inicia sesión para recibir recordatorios en tu celular.');
  if(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!navigator.standalone&&!window.matchMedia?.('(display-mode: standalone)').matches)throw new Error('En iPhone, instala Ahorremax con Compartir → Agregar a pantalla de inicio y ábrela desde su icono para activar avisos.');
  if(!('Notification' in window)||!('serviceWorker' in navigator))throw new Error('Este navegador no admite notificaciones de la app.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Activa las notificaciones en los ajustes del navegador para recibir los avisos.');
  messagingApi ||= await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js');
  if(!await messagingApi.isSupported())throw new Error('Este navegador no admite notificaciones push de Firebase.');
  messagingInstance ||= messagingApi.getMessaging(firebaseApp);
  const registration=await navigator.serviceWorker.register('./sw.js');
  const installationId=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('No se pudo terminar el registro de notificaciones. Inténtalo de nuevo.')),20000);
    const stop=messagingApi.onRegistered(messagingInstance,id=>{clearTimeout(timeout);stop();resolve(id);});
    messagingApi.register(messagingInstance,{vapidKey:webPushVapidKey,serviceWorkerRegistration:registration}).catch(error=>{clearTimeout(timeout);stop();reject(error);});
  });
  await storeApi.setDoc(deviceRef(installationId),{installationId,enabled:true,updatedAt:storeApi.serverTimestamp()},{merge:true});
  localStorage.setItem('ahorremax-dream-fid',installationId);
  return true;
}
export async function disableDreamReminders(){
  const installationId=localStorage.getItem('ahorremax-dream-fid');
  if(!installationId||!auth?.currentUser)return;
  await storeApi.deleteDoc(deviceRef(installationId));
  localStorage.removeItem('ahorremax-dream-fid');
  if(messagingInstance)await messagingApi.unregister(messagingInstance);
}
export function dreamRemindersEnabled(){return remindersConfigured && 'Notification' in window && Notification.permission==='granted' && Boolean(localStorage.getItem('ahorremax-dream-fid'));}
const planIds=['active','weekly','flexible','daily'];
function dreamRef(){if(!auth?.currentUser)throw new Error('Inicia sesión para guardar tu sueño.');return storeApi.doc(db,'users',auth.currentUser.uid,'plans','dream');}
export function watchDream(onData,onError){return storeApi.onSnapshot(dreamRef(),{includeMetadataChanges:true},snap=>{if(!snap.metadata.hasPendingWrites)onData(snap.exists()?snap.data():null);},onError);}
function dreamPhotoRef(){if(!auth?.currentUser)throw new Error('Inicia sesión para guardar la foto de tu sueño.');return storeApi.doc(db,'users',auth.currentUser.uid,'dreamMedia','cover');}
export function watchDreamPhoto(onData,onError){return storeApi.onSnapshot(dreamPhotoRef(),{includeMetadataChanges:true},snap=>{if(!snap.metadata.hasPendingWrites)onData(snap.exists()?snap.data():null);},onError);}
export async function saveDreamPhoto(imageData,expectedRevision){
  if(imageData && (!imageData.startsWith('data:image/jpeg;base64,') || imageData.length>450000))throw new Error('La foto no tiene un formato válido o es demasiado grande.');
  const document=dreamPhotoRef(),operationId=crypto.randomUUID();
  const activity=storeApi.doc(db,'users',auth.currentUser.uid,'dreamMediaOperations',operationId);
  await storeApi.runTransaction(db,async transaction=>{
    const current=await transaction.get(document);
    const revision=current.exists()?current.data().revision:0;
    if(revision!==expectedRevision)throw new Error('La foto cambió en otro dispositivo. Actualiza la página e inténtalo de nuevo.');
    const type=imageData?(current.exists()&&current.data().imageData?'photo_updated':'photo_added'):'photo_removed';
    transaction.set(document,{imageData,revision:revision+1,lastOperationId:operationId,updatedAt:storeApi.serverTimestamp()});
    transaction.set(activity,{type,revision:revision+1,createdAt:storeApi.serverTimestamp()});
  });
  return expectedRevision+1;
}
export async function saveDream(data,expectedRevision,operation){
  const document=dreamRef();
  const operationId=crypto.randomUUID();
  const activity=storeApi.doc(db,'users',auth.currentUser.uid,'dreamOperations',operationId);
  await storeApi.runTransaction(db,async transaction=>{
    const current=await transaction.get(document);
    const revision=current.exists()?current.data().revision:0;
    if(revision!==expectedRevision)throw new Error('Tu sueño cambió en otro dispositivo. Revisa el avance actualizado y vuelve a intentarlo.');
    const {mode,purpose,goal,cadence,strategy,startDate,targetDate,contribution,periods,projectedDate,place,placeName,saved,entries}=data;
    transaction.set(document,{mode,purpose,goal,cadence,strategy,startDate,targetDate,contribution,periods,projectedDate,place,placeName,saved,entries,revision:revision+1,lastOperationId:operationId,updatedAt:storeApi.serverTimestamp()});
    transaction.set(activity,{type:operation.type,revision:revision+1,amount:operation.amount,previousAmount:operation.previousAmount||0,previousGoal:operation.previousGoal||0,entryIndex:Number.isInteger(operation.entryIndex)?operation.entryIndex:-1,entryId:operation.entryId,purpose,goal,createdAt:storeApi.serverTimestamp()});
  });
}
function ref(planId){
  if(!auth?.currentUser)throw new Error('Inicia sesión para guardar tu avance.');
  if(!planIds.includes(planId))throw new Error('El método de ahorro no es válido.');
  return storeApi.doc(db,'users',auth.currentUser.uid,'plans',planId);
}
export function watchPlans(onData,onError){
  const values={},ready=new Set();
  const unsubscribers=planIds.map(planId=>storeApi.onSnapshot(ref(planId),{includeMetadataChanges:true},snap=>{
    if(snap.metadata.hasPendingWrites)return;
    values[planId]=snap.exists()?snap.data():null;
    ready.add(planId);
    if(ready.size!==planIds.length)return;
    if(values.active&&!planIds.slice(1).includes(values.active.mode)){
      onError(new Error('El reto anterior no tiene una modalidad válida.'));return;
    }
    const plans={};
    for(const mode of planIds.slice(1)){
      const current=values[mode];
      if(current&&current.mode!==mode){onError(new Error('Un reto guardado no coincide con su modalidad.'));return;}
      plans[mode]=current?{...current,planId:mode}:values.active?.mode===mode?{...values.active,planId:'active'}:null;
    }
    onData(plans);
  },onError));
  return ()=>unsubscribers.forEach(unsubscribe=>unsubscribe());
}
export async function save(data,expectedRevision,operation,planId=data.mode){
  if(planId!=='active'&&planId!==data.mode)throw new Error('El método de ahorro no coincide con el plan.');
  const document=ref(planId);
  const operationId=crypto.randomUUID();
  const activity=storeApi.doc(db,'users',auth.currentUser.uid,'operations',operationId);
  await storeApi.runTransaction(db,async transaction=>{
    const current=await transaction.get(document);
    const revision=current.exists()?current.data().revision:0;
    if(revision!==expectedRevision)throw new Error('Tu avance cambió en otro dispositivo. Revisa el saldo actualizado y vuelve a intentarlo.');
    transaction.set(document,{...data,revision:revision+1,lastOperationId:operationId,updatedAt:storeApi.serverTimestamp()});
    transaction.set(activity,{
      type:operation.type,
      revision:revision+1,
      mode:data.mode,
      amount:operation.amount||0,
      ids:operation.ids||[],
      entryId:operation.entryId||'',
      shortcut:operation.shortcut||'',
      purpose:data.purpose,
      createdAt:storeApi.serverTimestamp(),
    });
  });
}
export async function listOperations(cursor=null,pageSize=25){
  if(!auth?.currentUser)throw new Error('Inicia sesión para consultar tu historial.');
  const collection=storeApi.collection(db,'users',auth.currentUser.uid,'operations');
  const clauses=[storeApi.orderBy('createdAt','desc')];
  if(cursor)clauses.push(storeApi.startAfter(cursor));
  clauses.push(storeApi.limit(pageSize+1));
  const snapshot=await storeApi.getDocs(storeApi.query(collection,...clauses));
  const page=snapshot.docs.slice(0,pageSize);
  return {
    items:page.map(doc=>({id:doc.id,...doc.data(),createdAt:doc.data().createdAt?.toDate()?.toISOString()||null})),
    cursor:page.at(-1)||null,
    hasMore:snapshot.docs.length>pageSize,
  };
}
export async function listDreamOperations(){
  if(!auth?.currentUser)throw new Error('Inicia sesión para consultar tu historial.');
  const collection=storeApi.collection(db,'users',auth.currentUser.uid,'dreamOperations');
  const snapshot=await storeApi.getDocs(storeApi.query(collection,storeApi.orderBy('revision','desc'),storeApi.limit(50)));
  return snapshot.docs.map(doc=>({id:doc.id,...doc.data(),createdAt:doc.data().createdAt?.toDate()?.toISOString()||null}));
}
export function errorMessage(error){
  const messages={'auth/cancelled-popup-request':'Ya se inició otra solicitud de acceso. Completa la ventana más reciente.','auth/popup-blocked':'El navegador bloqueó la ventana. Permite ventanas de acceso e inténtalo otra vez.','auth/popup-closed-by-user':'Cerraste la ventana de acceso. Puedes intentarlo de nuevo.','auth/account-exists-with-different-credential':'Este correo ya tiene una cuenta. Entra con el proveedor que usaste la primera vez.','auth/unauthorized-domain':'Este dominio todavía no está autorizado para iniciar sesión.','auth/operation-not-allowed':'Este proveedor todavía no está habilitado.','permission-denied':'No se pudo acceder a tu historial. Revisa la configuración de permisos.','unavailable':'No hay conexión con el guardado. Tu aporte no se ha confirmado; vuelve a intentarlo.'};
  return messages[error.code]||error.message||'No se pudo completar la acción. Inténtalo nuevamente.';
}
