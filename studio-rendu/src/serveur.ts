/**
 * Serveur HTTP de `studio-rendu` (réseau `interne` du compose, jamais exposé) :
 *   POST /rendus        → { idRendu }  (202, réponse immédiate ; idempotent)
 *   GET  /rendus/{id}   → EtatRendu    (404 : inconnu, par exemple après un redémarrage)
 *   GET  /sante         → { ok, files }
 * Clé partagée `STUDIO_RENDU_CLE` (en-tête `x-studio-rendu-cle`), en plus du réseau interne : OBLIGATOIRE en
 * production (relecture sécurité R45 n° 3, `cleDeDemarrage`). Chaque adresse d'une demande (entrées, dépôt) doit venir du
 * stockage du studio (`adressePermise`, n° 4) : sinon refus 400, rien n'est lancé. Seule exception : la page de
 * `capture-site`, bornée par sa propre liste (`HOTES_CAPTURE`).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { verifierDemande, type DemandeRendu } from "./contrat.js";
import type { FilesRendu } from "./files.js";
import { adresseAutorisee } from "./operations/capture-site.js";
import { adressePermise } from "./outils.js";

const CORPS_MAX = 1024 * 1024;

function repondre(res: ServerResponse, statut: number, corps: unknown) {
  const texte = JSON.stringify(corps);
  res.writeHead(statut, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "content-length": Buffer.byteLength(texte) });
  res.end(texte);
}

function lireCorps(req: IncomingMessage): Promise<string> {
  return new Promise((ok, ko) => {
    let taille = 0;
    const morceaux: Buffer[] = [];
    req.on("data", (m: Buffer) => {
      taille += m.length;
      if (taille > CORPS_MAX) {
        ko(new Error("trop volumineux"));
        req.destroy();
        return;
      }
      morceaux.push(m);
    });
    req.on("end", () => ok(Buffer.concat(morceaux).toString("utf8")));
    req.on("error", ko);
  });
}

/**
 * Clé du serveur au démarrage. En production (`NODE_ENV=production`), une clé absente est un REFUS DE DÉMARRER : sans
 * elle, quiconque atteint le port soumettrait des rendus et ferait lire ou écrire des adresses de son choix. PUR.
 */
export function cleDeDemarrage(env: Record<string, string | undefined>): string | undefined {
  const cle = env.STUDIO_RENDU_CLE?.trim() || undefined;
  if (!cle && env.NODE_ENV === "production") throw new Error("STUDIO_RENDU_CLE manque : studio-rendu refuse de démarrer en production sans sa clé partagée. Renseignez-la dans le .env (la même que celle du studio), puis relancez.");
  return cle;
}

/**
 * Adresses d'une demande (entrées, dépôts) qui ne viennent pas du stockage du studio. PUR (selon l'environnement).
 *
 * Relecture R45 (2e lecture, B) : la page de `capture-site` est une page publique du site, pas une adresse du
 * stockage. Elle passe par sa propre liste, plus stricte (`HOTES_CAPTURE`, aussi vérifiée dans l'opération) ; les
 * hôtes du site ne s'ajoutent JAMAIS aux hôtes permis (ils seraient sinon lisibles et cibles de dépôt). Le dépôt
 * (`sortie.urlDepot`) de la capture reste vérifié comme les autres.
 */
export function adressesRefusees(d: DemandeRendu): number {
  const entrees = { ...d.entrees };
  let refusees = 0;
  if (d.operation === "capture-site" && entrees.page !== undefined) {
    if (!adresseAutorisee(entrees.page)) refusees++;
    delete entrees.page;
  }
  const adresses = [...Object.values(entrees), d.sortie?.urlDepot ?? ""];
  const depots = (d.parametres as { depots?: Record<string, { urlDepot?: unknown } | undefined> } | undefined)?.depots;
  if (depots && typeof depots === "object") for (const x of Object.values(depots)) if (typeof x?.urlDepot === "string") adresses.push(x.urlDepot);
  return refusees + adresses.filter((a) => a !== "" && !adressePermise(a)).length;
}

function cleValide(req: IncomingMessage, cle?: string): boolean {
  if (!cle) return true;
  const recue = req.headers["x-studio-rendu-cle"];
  if (typeof recue !== "string") return false;
  const a = Buffer.from(recue);
  const b = Buffer.from(cle);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function creerServeur(files: FilesRendu, options: { cle?: string } = {}): Server {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://studio-rendu");
      if (req.method === "GET" && url.pathname === "/sante") return repondre(res, 200, { ok: true, files: files.resume() });
      if (!cleValide(req, options.cle)) return repondre(res, 401, { erreur: "clé invalide" });

      if (req.method === "POST" && url.pathname === "/rendus") {
        let demande: unknown;
        try {
          demande = JSON.parse(await lireCorps(req));
        } catch {
          return repondre(res, 400, { erreur: "demande illisible" });
        }
        const probleme = verifierDemande(demande);
        if (probleme) return repondre(res, 400, { erreur: probleme });
        if (adressesRefusees(demande as DemandeRendu)) return repondre(res, 400, { erreur: "adresse refusée" });
        const r = files.soumettre(demande as DemandeRendu);
        return repondre(res, 202, { idRendu: r.idRendu, nouveau: r.nouveau });
      }

      const m = /^\/rendus\/([^/]+)$/.exec(url.pathname);
      if (req.method === "GET" && m) {
        const etat = files.etat(decodeURIComponent(m[1]));
        return etat ? repondre(res, 200, etat) : repondre(res, 404, { statut: "inconnu" });
      }
      return repondre(res, 404, { erreur: "introuvable" });
    } catch (e) {
      return repondre(res, 500, { erreur: e instanceof Error ? e.message : "erreur" });
    }
  });
}
