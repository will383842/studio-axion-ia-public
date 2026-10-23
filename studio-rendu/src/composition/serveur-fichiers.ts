/**
 * Petit serveur de fichiers LOCAL (127.0.0.1, port libre) pour un rendu : les entrées sont d'abord téléchargées
 * depuis leurs adresses signées dans le dossier de travail, puis servies au navigateur de Remotion. Le rendu ne
 * dépend donc ni de la durée de validité des adresses, ni du réseau pendant les minutes du montage. Lot M4.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { basename, extname, join } from "node:path";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".cube": "text/plain",
};

export async function servirDossier(dossier: string): Promise<{ base: string; fermer: () => Promise<void> }> {
  const serveur = createServer(async (req, res) => {
    try {
      const nom = basename(decodeURIComponent(new URL(req.url ?? "/", "http://local").pathname));
      const chemin = join(dossier, nom);
      const { size } = await stat(chemin);
      const type = TYPES[extname(nom).toLowerCase()] ?? "application/octet-stream";
      const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
      if (plage) {
        const debut = plage[1] ? Number(plage[1]) : 0;
        const fin = plage[2] ? Math.min(size - 1, Number(plage[2])) : size - 1;
        res.writeHead(206, { "content-type": type, "content-length": fin - debut + 1, "content-range": `bytes ${debut}-${fin}/${size}`, "accept-ranges": "bytes", "access-control-allow-origin": "*" });
        createReadStream(chemin, { start: debut, end: fin }).pipe(res);
        return;
      }
      res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes", "access-control-allow-origin": "*" });
      createReadStream(chemin).pipe(res);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  return { base, fermer: () => new Promise<void>((ok) => serveur.close(() => ok())) };
}
