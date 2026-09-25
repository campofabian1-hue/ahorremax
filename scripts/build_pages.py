"""Build the static, installable Ahorremax site for GitHub Pages."""

from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(ROOT / 'scripts/package_web.py')], check=True, cwd=ROOT)

source = ROOT / 'entregables/ahorremax-web-redisenado'
destination = ROOT / 'docs'
if destination.exists():
    shutil.rmtree(destination)
shutil.copytree(source, destination, ignore=shutil.ignore_patterns('recursos-originales', 'LEEME.txt', 'SISTEMA_VISUAL.md'))
(destination / '.nojekyll').write_text('')
print(destination)
