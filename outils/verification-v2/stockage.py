"""Faux R2 local : GET / PUT / HEAD sur un dossier (adresses « signées » = http://127.0.0.1:4700/<clé>)."""
import os, sys, shutil
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, urlparse
RACINE = sys.argv[1]
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def chemin(self):
        p = unquote(urlparse(self.path).path).lstrip("/")
        return os.path.join(RACINE, p)
    def do_HEAD(self):
        c = self.chemin()
        if not os.path.isfile(c): self.send_response(404); self.end_headers(); return
        self.send_response(200); self.send_header("content-length", str(os.path.getsize(c))); self.end_headers()
    def do_GET(self):
        c = self.chemin()
        if not os.path.isfile(c): self.send_response(404); self.end_headers(); return
        taille = os.path.getsize(c)
        debut, fin = 0, taille - 1
        plage = self.headers.get("range")
        if plage and plage.startswith("bytes="):
            a, _, b = plage[6:].partition("-")
            debut = int(a or 0); fin = int(b) if b else taille - 1
            self.send_response(206); self.send_header("content-range", f"bytes {debut}-{fin}/{taille}")
        else:
            self.send_response(200)
        self.send_header("accept-ranges", "bytes"); self.send_header("content-length", str(fin - debut + 1)); self.end_headers()
        with open(c, "rb") as f:
            f.seek(debut); reste = fin - debut + 1
            while reste > 0:
                b = f.read(min(1 << 20, reste))
                if not b: break
                try: self.wfile.write(b)
                except (BrokenPipeError, ConnectionResetError): return
                reste -= len(b)
    def do_PUT(self):
        c = self.chemin(); os.makedirs(os.path.dirname(c), exist_ok=True)
        n = int(self.headers.get("content-length") or 0)
        with open(c + ".tmp", "wb") as f:
            reste = n
            while reste > 0:
                b = self.rfile.read(min(1 << 20, reste)); f.write(b); reste -= len(b)
        os.replace(c + ".tmp", c)
        self.send_response(200); self.send_header("content-length", "0"); self.end_headers()
ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), H).serve_forever()
