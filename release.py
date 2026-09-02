#!/usr/bin/env python3
"""
Release helper — اداة الإصدار
Usage:  python release.py <path-to-html> "<ملخص التغييرات>"
1. Reads APP_VERSION from the HTML (single source of truth).
2. Creates folder vX.Y/ and copies the HTML as sru_infrastructure_inventory_vX.Y.html
3. Prepends a dated entry to CHANGELOG.md and copies it into the folder.
4. Zips the folder as sru_infrastructure_inventory_vX.Y.zip
"""
import re, sys, shutil, datetime, pathlib, zipfile
src = pathlib.Path(sys.argv[1]); notes = sys.argv[2] if len(sys.argv) > 2 else "تحديث"
html = src.read_text(encoding="utf-8")
m = re.search(r"const APP_VERSION = '(v\d+\.\d)'", html)
if not m: sys.exit("APP_VERSION not found in HTML")
ver = m.group(1)
folder = pathlib.Path(ver); folder.mkdir(exist_ok=True)
shutil.copy(src, folder / f"sru_infrastructure_inventory_{ver}.html")
log = pathlib.Path("CHANGELOG.md")
head = "# سجل التغييرات — جرد أصول البنية التحتية (ICTD Infrastructure Inventory)\n\n"
old = log.read_text(encoding="utf-8") if log.exists() else head
body = old[len(head):] if old.startswith(head) else old
entry = f"## {ver} — {datetime.date.today()}\n" + "".join(f"- {l.strip()}\n" for l in notes.split(";") if l.strip()) + "\n"
log.write_text(head + entry + body, encoding="utf-8")
shutil.copy(log, folder / "CHANGELOG.md")
with zipfile.ZipFile(f"sru_infrastructure_inventory_{ver}.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for f in folder.iterdir(): z.write(f, f"{ver}/{f.name}")
print(f"Released {ver}: folder {folder}/, zip sru_infrastructure_inventory_{ver}.zip")
