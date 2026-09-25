const CACHE='ahorremax-shell-v10';
const ASSETS=['./','./index.html','./styles.css','./theme.css','./wallet-theme.css','./brand.css','./motivation.css','./studio.css','./main.mjs?v=9','./cloud.mjs','./firebase-config.mjs','./mark.svg','./icon-180.png','./icon-192.png','./icon-512.png','./icon-512-maskable.png','./manifest.webmanifest','./assets/google.png','./assets/ahorremax-logo.png','./assets/ahorremax-mark.png','./assets/icons/weekly.png','./assets/icons/flexible.png','./assets/icons/daily.png','../src/savings.mjs'];
const urls=ASSETS.map(path=>new URL(path,self.location).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ahorremax-shell-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!urls.includes(event.request.url))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request)));
});
