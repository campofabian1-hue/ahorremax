import { firebaseConfig, providersReady } from './firebase-config.mjs';
export { providersReady };
export const configured = Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.authDomain);
let auth, db, authApi, storeApi;
export async function initialize(onUser) {
  if(location.protocol==='file:'||!configured)return;
  const [appApi,a,s]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),
  ]);
  authApi=a;storeApi=s;
  const app=appApi.initializeApp(firebaseConfig);auth=a.getAuth(app);db=s.getFirestore(app);
  a.onAuthStateChanged(auth,onUser);
}
export async function signIn(provider) {
  if(location.protocol==='file:')throw new Error('Para iniciar sesión, abre Ahorremax desde tu página web o http://localhost:4173/app/. El archivo local solo permite explorar la demo.');
  if(!providersReady[provider])throw new Error(`El acceso con ${provider==='google'?'Google':'Facebook'} aún se está configurando. Puedes explorar la demo.`);
  if(!configured||!authApi)throw new Error('El acceso está pendiente de configuración. Puedes explorar la demo.');
  const p=provider==='google'?new authApi.GoogleAuthProvider():new authApi.FacebookAuthProvider();
  return authApi.signInWithPopup(auth,p);
}
export async function signOut(){ if(auth)await authApi.signOut(auth); }
function ref(){if(!auth?.currentUser)throw new Error('Inicia sesión para guardar tu avance.');return storeApi.doc(db,'users',auth.currentUser.uid,'plans','active');}
export function watch(onData,onError){return storeApi.onSnapshot(ref(),{includeMetadataChanges:true},snap=>{if(!snap.metadata.hasPendingWrites)onData(snap.exists()?snap.data():null);},onError);}
export async function save(data,expectedRevision,operation){
  const document=ref();
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
  const clauses=[storeApi.orderBy('revision','desc')];
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
export function errorMessage(error){
  const messages={'auth/cancelled-popup-request':'Ya se inició otra solicitud de acceso. Completa la ventana más reciente.','auth/popup-blocked':'El navegador bloqueó la ventana. Permite ventanas de acceso e inténtalo otra vez.','auth/popup-closed-by-user':'Cerraste la ventana de acceso. Puedes intentarlo de nuevo.','auth/account-exists-with-different-credential':'Este correo ya tiene una cuenta. Entra con el proveedor que usaste la primera vez.','auth/unauthorized-domain':'Este dominio todavía no está autorizado para iniciar sesión.','auth/operation-not-allowed':'Este proveedor todavía no está habilitado.','permission-denied':'No se pudo acceder a tu historial. Revisa la configuración de permisos.','unavailable':'No hay conexión con el guardado. Tu aporte no se ha confirmado; vuelve a intentarlo.'};
  return messages[error.code]||error.message||'No se pudo completar la acción. Inténtalo nuevamente.';
}
