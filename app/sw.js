const CACHE='ahorremax-shell-v26';
const ASSETS=['./','./index.html','./styles.css','./theme.css','./wallet-theme.css','./brand.css','./motivation.css','./studio.css','./dream.css','./challenge-experience.css','./main.mjs?v=26','./dream-feature.mjs','./cloud.mjs','./firebase-config.mjs','./icon-esmeralda-180.png','./icon-esmeralda-192.png','./icon-esmeralda-512.png','./icon-esmeralda-512-maskable.png','./manifest.webmanifest','./assets/google.png','./assets/ahorremax-logo.png','./assets/ahorremax-mark.png','./assets/icons/weekly.png','./assets/icons/flexible.png','./assets/icons/daily.png','./assets/dream-jar.webp','../src/savings.mjs','../src/dream.mjs','../src/dream-reminder.mjs','../src/dream-photo.mjs','../src/peso-input.mjs'];
const urls=ASSETS.map(path=>new URL(path,self.location).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ahorremax-shell-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!urls.includes(event.request.url))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request)));
});
self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?.json()||{};}catch{return;}
  const message=payload.notification||payload.data||{};
  if(!message.title&&!message.body)return;
  event.waitUntil(self.registration.showNotification(message.title||'Ahorremax',{
    body:message.body||'Tu sueño sigue esperando un pequeño paso.',
    icon:'./icon-esmeralda-192.png',badge:'./icon-esmeralda-192.png',
    tag:'ahorremax-dream-reminder',data:{url:new URL('./',self.registration.scope).href},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification.data?.url||new URL('./',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const open=windows.find(client=>client.url.startsWith(new URL('./',self.registration.scope).href));
    if(open)return open.focus();
    return self.clients.openWindow(url);
  }));
});
