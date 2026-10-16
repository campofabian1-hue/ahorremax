"""Package the app as a classic script: local demo and static hosting."""
from pathlib import Path
import hashlib, re, shutil, zipfile
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'entregables' / 'ahorremax-web-redisenado'
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True)

def body(path):
    s = (ROOT / path).read_text()
    s = re.sub(r'^import .*?;\n', '', s, flags=re.M)
    s = re.sub(r'^export \{.*?\};\n', '', s, flags=re.M)
    return re.sub(r'^export ', '', s, flags=re.M)

bundle = "'use strict';\n(()=>{\n" + body('src/savings.mjs')
bundle += body('src/dream.mjs') + body('src/dream-reminder.mjs') + body('src/dream-photo.mjs') + body('src/peso-input.mjs')
bundle += '\nconst cloud=(()=>{\n' + body('app/firebase-config.mjs') + body('app/cloud.mjs')
bundle += '\nreturn {providersReady,configured,remindersConfigured,dreamRemindersEnabled,enableDreamReminders,disableDreamReminders,initialize,usesRedirect,signIn,signOut,watchPlans,watchDream,watchDreamPhoto,save,saveDream,saveDreamPhoto,listOperations,listDreamOperations,errorMessage};\n})();\n'
bundle += '\nconst dreamFeature=(()=>{\n' + body('app/dream-feature.mjs')
bundle += '\nreturn {configure,hasPlan,overview,resetDemo,setAccount,render,refreshQuote,handleInput,handleSubmit,handleClick};\n})();\n'
bundle += body('app/main.mjs') + '\n})();\n'
(OUT / 'app.js').write_text(bundle)
for name in ['styles.css','theme.css','wallet-theme.css','brand.css','motivation.css','studio.css','dream.css','challenge-experience.css','mark.svg','icon.svg','icon-180.png','icon-192.png','icon-512.png','icon-512-maskable.png','icon-studio-180.png','icon-studio-192.png','icon-studio-512.png','icon-studio-512-maskable.png','icon-esmeralda-180.png','icon-esmeralda-192.png','icon-esmeralda-512.png','icon-esmeralda-512-maskable.png']:
    shutil.copy2(ROOT/'app'/name, OUT/name)
(OUT/'assets').mkdir()
shutil.copy2(ROOT/'app/assets/google.png',OUT/'assets/google.png')
shutil.copy2(ROOT/'app/assets/ahorremax-logo.png',OUT/'assets/ahorremax-logo.png')
shutil.copy2(ROOT/'app/assets/ahorremax-mark.png',OUT/'assets/ahorremax-mark.png')
shutil.copy2(ROOT/'app/assets/dream-jar.webp',OUT/'assets/dream-jar.webp')
(OUT/'assets/icons').mkdir()
for name in ['weekly.png', 'flexible.png', 'daily.png']:
    shutil.copy2(ROOT/'app/assets/icons'/name, OUT/'assets/icons'/name)
(OUT/'recursos-originales').mkdir()
for name in ['weekly.png', 'flexible.png', 'daily.png']:
    shutil.copy2(ROOT/'app/assets/icons/original'/name, OUT/'recursos-originales'/name)
(OUT/'assets/campaign').mkdir()
(OUT/'recursos-originales/campana').mkdir()
for name in ['weekly', 'flexible', 'daily']:
    shutil.copy2(ROOT/'app/assets/campaign'/f'{name}.webp', OUT/'assets/campaign'/f'{name}.webp')
    shutil.copy2(ROOT/'app/assets/campaign/original'/f'{name}.png', OUT/'recursos-originales/campana'/f'{name}.png')
shutil.copy2(ROOT/'app/assets/campaign/PROMPTS.md', OUT/'recursos-originales/campana/PROMPTS.md')
bundle_version=hashlib.sha256(bundle.encode()).hexdigest()[:12]
script_url=f'./app.js?v={bundle_version}'
html=(ROOT/'app/index.html').read_text().replace('<script type="module" src="./main.mjs?v=26"></script>', f'<script defer src="{script_url}"></script>')
manifest=(ROOT/'app/manifest.webmanifest').read_text().replace('"/app/"','"./"')
(OUT/'manifest.webmanifest').write_text(manifest)
sw=(ROOT/'app/sw.js').read_text()
sw=sw.replace("'./main.mjs?v=26','./dream-feature.mjs','./cloud.mjs','./firebase-config.mjs'", f"'{script_url}'").replace(",'../src/savings.mjs','../src/dream.mjs','../src/dream-reminder.mjs','../src/dream-photo.mjs','../src/peso-input.mjs'",'')
for name in ['styles.css','theme.css','wallet-theme.css','brand.css','motivation.css','studio.css','dream.css','challenge-experience.css']:
    version=hashlib.sha256((OUT/name).read_bytes()).hexdigest()[:12]
    html=html.replace(f'./{name}',f'./{name}?v={version}')
    sw=sw.replace(f"'./{name}'",f"'./{name}?v={version}'")
(OUT/'index.html').write_text(html)
(OUT/'sw.js').write_text(sw)
(OUT/'LEEME.txt').write_text('''AHORREMAX — CUATRO RETOS DE AHORRO Y REGISTRO PERSONAL

Extrae el ZIP antes de usarlo.

EN TU COMPUTADOR: abre index.html para explorar los cuatro retos en modo de prueba. Los aportes de la prueba se borran al recargar. El acceso con Google y el guardado real requieren HTTPS o un servidor local autorizado.

EN LA APP: elige un reto, escribe para qué quieres ahorrar, indica dónde guardarás el dinero y comienza. Puedes editar el nombre de la meta después. En Cumple tu sueño puedes añadir una foto propia, ajustar el encuadre y verla en la tarjeta y en tu plan. La app muestra un aviso si hay aportes programados pendientes; nunca descuenta dinero ya ahorrado. La barra y los hitos muestran el avance registrado manualmente; la app no verifica depósitos bancarios.

IDENTIDAD: se mantiene intacto el logo original morado y turquesa de Ahorremax. El nuevo icono de instalación verde esmeralda está en icon-esmeralda-180.png, icon-esmeralda-192.png, icon-esmeralda-512.png y icon-esmeralda-512-maskable.png. Los tres iconos de los retos están optimizados en assets/icons/; sus originales de alta resolución están en recursos-originales/. El sistema visual está documentado en SISTEMA_VISUAL.md.

EN TU HOSTING: sube TODO el contenido de este ZIP a una carpeta propia, por ejemplo public_html/ahorremax/. El index.html debe quedar directamente en esa carpeta. Abre https://TU-DOMINIO/ahorremax/. No reemplaces la página principal. No es un plugin de WordPress.

CUENTAS: Google usa Firebase Authentication. Para un dominio distinto de fcfinanzas.com, autoriza ese dominio en Firebase Authentication antes de usarlo y comprueba el acceso en móvil. Facebook requiere completar la configuración de Meta y Firebase. Cada cuenta puede guardar los cuatro retos por separado. Los planes existentes conservan sus aportes.

FOTO Y AVISOS: la foto de una cuenta requiere publicar las nuevas reglas de Firestore. La prueba sin cuenta no la conserva al salir. El envío al celular con la app cerrada requiere una clave pública Web Push VAPID en app/firebase-config.mjs, desplegar la función programada de Firebase y que cada cliente active el permiso desde su dispositivo. Subir solo este ZIP no activa las notificaciones push. Lee NOTIFICACIONES.md para la configuración.

HISTORIAL: cada cuenta conserva sus aportes vigentes y, desde esta versión, un registro privado de creación del plan, aportes, correcciones y cambios de meta. Un aporte y su registro de actividad se guardan juntos. La prueba sin cuenta no genera historial persistente.

La instalación como aplicación móvil requiere HTTPS. En Android, usa el botón de instalación o la opción del navegador. En iPhone, usa Compartir > Agregar a pantalla de inicio. Antes de abrirla a clientes en otro dominio, verifica allí el acceso con Google, la escritura y lectura de aportes, el cierre y regreso de sesión, y la instalación en teléfono. Presupuestos, viajes y proyectos son módulos futuros: este paquete contiene tres retos para el millón y un plan personalizable: Cumple tu sueño.
''')
shutil.copy2(ROOT/'SISTEMA_VISUAL.md',OUT/'SISTEMA_VISUAL.md')
shutil.copy2(ROOT/'NOTIFICACIONES.md',OUT/'NOTIFICACIONES.md')
zip_path=ROOT/'entregables/Ahorremax-v26-foto-sueno.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob('*')):
        if p.is_file(): z.write(p,p.relative_to(OUT))
with zipfile.ZipFile(zip_path) as z: assert z.testzip() is None
print(zip_path)
