#!/usr/bin/env python3
"""Markdown -> print-ready PDF. No network, no pandoc. Chromium headless does the printing.

Usage:
  md2pdf.py INPUT.md OUTPUT.pdf [--title T] [--subtitle S] [--client C] [--date D]
            [--doc-type "Product Requirements Document"] [--footer "..."] [--no-cover]

The first H1 in the document becomes the cover title unless --title is given.
Any `---` fenced YAML-ish front matter is read for title/subtitle/client/date/doc-type.
"""
import argparse, html, os, re, shutil, subprocess, sys, tempfile

try:
    import markdown
except ImportError:
    sys.exit("python-markdown is required:  uv pip install --system markdown  (or pip install markdown)")

CHROME_CANDIDATES = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "brave"]

CSS = """
@page { size: A4; margin: 20mm 18mm 18mm 18mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: "Inter", "Source Sans 3", "DejaVu Sans", system-ui, sans-serif;
  font-size: 10.5pt; line-height: 1.62; color: #16181d; margin: 0;
}
.cover {
  height: 297mm; padding: 38mm 24mm 24mm 24mm; page-break-after: always;
  display: flex; flex-direction: column; justify-content: space-between;
  background: #0e1116; color: #f4f5f7;
}
.cover .rule { width: 56px; height: 3px; background: #d9722f; margin-bottom: 26mm; }
.cover .doctype { font-size: 9.5pt; letter-spacing: .22em; text-transform: uppercase; color: #d9722f; margin-bottom: 8mm; }
.cover h1 { font-size: 34pt; line-height: 1.1; font-weight: 700; margin: 0 0 6mm 0; letter-spacing: -.02em; color: #fff; }
.cover .subtitle { font-size: 13pt; color: #a9b0bd; font-weight: 400; max-width: 120mm; line-height: 1.45; }
.cover dl { display: grid; grid-template-columns: 34mm 1fr; row-gap: 3mm; font-size: 10pt; margin: 0; }
.cover dt { color: #6f7986; letter-spacing: .08em; text-transform: uppercase; font-size: 8pt; padding-top: 2px; }
.cover dd { margin: 0; color: #e6e9ee; }
h1, h2, h3, h4 { color: #0e1116; font-weight: 650; line-height: 1.25; letter-spacing: -.01em; }
h1 { font-size: 20pt; margin: 0 0 6mm 0; padding-bottom: 3mm; border-bottom: 2px solid #0e1116; page-break-before: always; }
h1:first-of-type { page-break-before: avoid; }
h2 { font-size: 14pt; margin: 9mm 0 3mm; }
h3 { font-size: 11.5pt; margin: 6mm 0 2mm; color: #2b3038; }
h4 { font-size: 10.5pt; margin: 5mm 0 2mm; color: #4a515c; text-transform: uppercase; letter-spacing: .06em; }
h1, h2, h3, h4 { page-break-after: avoid; }
p, ul, ol, table, blockquote, pre { page-break-inside: avoid; }
p { margin: 0 0 3.4mm; }
ul, ol { margin: 0 0 3.4mm; padding-left: 5.5mm; }
li { margin-bottom: 1.4mm; }
li > ul, li > ol { margin-top: 1.4mm; }
strong { font-weight: 650; color: #0e1116; }
code { font-family: "JetBrains Mono", "DejaVu Sans Mono", monospace; font-size: 9pt;
       background: #f1f2f4; padding: 1px 4px; border-radius: 3px; color: #9a3412; }
pre { background: #f7f8f9; border: 1px solid #e3e6ea; border-left: 3px solid #d9722f;
      padding: 3.5mm 4mm; border-radius: 3px; overflow-x: auto; font-size: 8.6pt; line-height: 1.5; }
pre code { background: none; padding: 0; color: #16181d; }
table { border-collapse: collapse; width: 100%; margin: 0 0 4.5mm; font-size: 9.4pt; }
thead { background: #0e1116; color: #fff; }
th { text-align: left; padding: 2.2mm 3mm; font-weight: 600; font-size: 8.6pt;
     letter-spacing: .05em; text-transform: uppercase; }
td { padding: 2.2mm 3mm; border-bottom: 1px solid #e3e6ea; vertical-align: top; }
tbody tr:nth-child(even) { background: #fafbfc; }
tbody tr:last-child td { border-bottom: 1px solid #c9ced6; }
blockquote { margin: 0 0 4mm; padding: 3mm 4mm; background: #fff8f2;
             border-left: 3px solid #d9722f; color: #40352c; }
blockquote p:last-child { margin-bottom: 0; }
hr { border: none; border-top: 1px solid #dfe3e8; margin: 7mm 0; }
a { color: #9a3412; text-decoration: none; border-bottom: 1px solid #e6c3ad; }
.totals td { font-weight: 650; background: #fff8f2 !important; }
"""

FRONT = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)


def read_front_matter(text):
    m = FRONT.match(text)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line and not line.strip().startswith("#"):
            k, v = line.split(":", 1)
            meta[k.strip().lower().replace("_", "-")] = v.strip().strip('"').strip("'")
    return meta, text[m.end():]


def find_chrome():
    for c in CHROME_CANDIDATES:
        p = shutil.which(c)
        if p:
            return p
    sys.exit("No Chromium/Chrome found. Install chromium, or set PATH to a Chrome binary.")


def build_cover(meta):
    rows = "".join(
        f"<dt>{html.escape(k)}</dt><dd>{html.escape(v)}</dd>"
        for k, v in [
            ("Prepared for", meta.get("client", "")),
            ("Date", meta.get("date", "")),
            ("Version", meta.get("version", "")),
            ("Prepared by", meta.get("author", "")),
            ("Status", meta.get("status", "")),
        ] if v
    )
    return f"""<section class="cover">
  <div>
    <div class="rule"></div>
    <div class="doctype">{html.escape(meta.get('doc-type', 'Document'))}</div>
    <h1>{html.escape(meta.get('title', 'Untitled'))}</h1>
    <div class="subtitle">{html.escape(meta.get('subtitle', ''))}</div>
  </div>
  <dl>{rows}</dl>
</section>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input"); ap.add_argument("output")
    for f in ("title", "subtitle", "client", "date", "doc-type", "version", "author", "status"):
        ap.add_argument(f"--{f}", default=None)
    ap.add_argument("--no-cover", action="store_true")
    a = ap.parse_args()

    raw = open(a.input, encoding="utf-8").read()
    meta, body = read_front_matter(raw)
    for f in ("title", "subtitle", "client", "date", "doc-type", "version", "author", "status"):
        v = getattr(a, f.replace("-", "_"))
        if v:
            meta[f] = v
    if "title" not in meta:
        m = re.search(r"^#\s+(.+)$", body, re.M)
        meta["title"] = m.group(1).strip() if m else os.path.basename(a.input)
        if m:
            body = body[:m.start()] + body[m.end():]

    md = markdown.Markdown(extensions=[
        "tables", "fenced_code", "attr_list", "def_list", "footnotes",
        "sane_lists", "md_in_html", "toc", "admonition",
    ])
    inner = md.convert(body)
    cover = "" if a.no_cover else build_cover(meta)
    doc = (f"<!doctype html><html><head><meta charset='utf-8'>"
           f"<title>{html.escape(meta['title'])}</title><style>{CSS}</style></head>"
           f"<body>{cover}<main>{inner}</main></body></html>")

    out = os.path.abspath(a.output)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "doc.html")
        open(src, "w", encoding="utf-8").write(doc)
        cmd = [find_chrome(), "--headless=new", "--disable-gpu", "--no-sandbox",
               "--no-pdf-header-footer", "--virtual-time-budget=4000",
               f"--user-data-dir={td}/profile", f"--print-to-pdf={out}", f"file://{src}"]
        r = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(out):
        sys.exit(f"PDF was not produced.\n{r.stderr[-1500:]}")
    print(f"{out}  ({os.path.getsize(out)/1024:.0f} KB)")


if __name__ == "__main__":
    main()
