"""Package the app as a classic script: local demo and static hosting."""
from pathlib import Path
import re, shutil, zipfile
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
bundle += '\nconst cloud=(()=>{\n' + body('app/firebase-config.mjs') + body('app/cloud.mjs')
bundle += '\nreturn {providersReady,configured,initialize,signIn,signOut,watch,save,listOperations,errorMessage};\n})();\n'
bundle += body('app/main.mjs') + '\n})();\n'
(OUT / 'app.js').write_text(bundle)
for name in ['styles.css','theme.css','wallet-theme.css','brand.css','motivation.css','studio.css','mark.svg','icon.svg','icon-180.png','icon-192.png','icon-512.png','icon-512-maskable.png']:
    shutil.copy2(ROOT/'app'/name, OUT/name)
(OUT/'assets').mkdir()
shutil.copy2(ROOT/'app/assets/google.png',OUT/'assets/google.png')
shutil.copy2(ROOT/'app/assets/ahorremax-logo.png',OUT/'assets/ahorremax-logo.png')
shutil.copy2(ROOT/'app/assets/ahorremax-mark.png',OUT/'assets/ahorremax-mark.png')
(OUT/'assets/icons').mkdir()
for name in ['weekly.png', 'flexible.png', 'daily.png']:
    shutil.copy2(ROOT/'app/assets/icons'/name, OUT/'assets/icons'/name)
(OUT/'recursos-originales').mkdir()
for name in ['weekly.png', 'flexible.png', 'daily.png']:
    shutil.copy2(ROOT/'app/assets/icons/original'/name, OUT/'recursos-originales'/name)
html=(ROOT/'app/index.html').read_text().replace('<script type="module" src="./main.mjs?v=10"></script>', '<script defer src="./app.js"></script>')
(OUT/'index.html').write_text(html)
manifest=(ROOT/'app/manifest.webmanifest').read_text().replace('"/app/"','"./"')
(OUT/'manifest.webmanifest').write_text(manifest)
sw=(ROOT/'app/sw.js').read_text()
sw=sw.replace("'./main.mjs?v=10','./cloud.mjs','./firebase-config.mjs'", "'./app.js'").replace(",'../src/savings.mjs'",'')
(OUT/'sw.js').write_text(sw)
(OUT/'LEEME.txt').write_text('''AHORREMAX — TRES RETOS DE AHORRO Y REGISTRO PERSONAL

Extrae el ZIP antes de usarlo.

EN TU COMPUTADOR: abre index.html para explorar los tres retos en modo de prueba. Los aportes de la prueba se borran al recargar. El acceso con Google y el guardado real requieren HTTPS o un servidor local autorizado.

EN LA APP: elige un reto, escribe para qué quieres ahorrar, indica dónde guardarás el dinero y comienza. Puedes editar el nombre de la meta después. La barra y los hitos muestran el avance registrado manualmente; la app no verifica depósitos bancarios.

IDENTIDAD: se mantiene intacto el logo original morado y turquesa de Ahorremax. Los tres iconos 3D están optimizados en assets/icons/; sus originales de alta resolución están en recursos-originales/. El sistema visual está documentado en SISTEMA_VISUAL.md.

EN TU HOSTING: sube TODO el contenido de este ZIP a una carpeta propia, por ejemplo public_html/ahorremax/. El index.html debe quedar directamente en esa carpeta. Abre https://TU-DOMINIO/ahorremax/. No reemplaces la página principal. No es un plugin de WordPress.

CUENTAS: Google usa Firebase Authentication. Para un dominio distinto del publicado en GitHub Pages, autoriza ese dominio en Firebase Authentication antes de usarlo. Facebook requiere completar la configuración de Meta y Firebase. La versión actual guarda un reto activo por persona; no cambia un plan ya registrado al explorar otros métodos.

HISTORIAL: cada cuenta conserva sus aportes vigentes y, desde esta versión, un registro privado de creación del plan, aportes, correcciones y cambios de meta. Un aporte y su registro de actividad se guardan juntos. La prueba sin cuenta no genera historial persistente.

La instalación como aplicación móvil requiere HTTPS. En Android, usa el botón de instalación o la opción del navegador. En iPhone, usa Compartir > Agregar a pantalla de inicio. Antes de abrirla a clientes en otro dominio, verifica allí el acceso con Google, la escritura y lectura de aportes, el cierre y regreso de sesión, y la instalación en teléfono. Presupuestos, viajes y proyectos son módulos futuros: este paquete contiene los tres retos de ahorro actuales.
''')
shutil.copy2(ROOT/'SISTEMA_VISUAL.md',OUT/'SISTEMA_VISUAL.md')
zip_path=ROOT/'entregables/Ahorremax-v5-cuentas-historial.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob('*')):
        if p.is_file(): z.write(p,p.relative_to(OUT))
with zipfile.ZipFile(zip_path) as z: assert z.testzip() is None
print(zip_path)
