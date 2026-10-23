/**
 * STOCKAGE RÉEL Cloudflare R2 (lot M1b, B.9 ter) — contrat `StockageFichiers`.
 * Activé seulement par `FOURNISSEUR_STOCKAGE=r2` (ou le réglage `fournisseur.stockage`) ET les variables
 * `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (`R2_PUBLIC_HOST` facultative :
 * hôte du point d'accès S3, par exemple `{compte}.eu.r2.cloudflarestorage.com` pour un seau européen).
 * Sans elles, la simulation reste en place et tout fonctionne.
 *
 * - Seau PRIVÉ : toute lecture passe par une adresse signée (courte pour le navigateur, 24 h pour HeyGen).
 * - Clés `studio/{env}/{type}/{entiteId}/{fichierId}.{ext}`.
 * - Envoi des rushs : multipart signé, direct du navigateur vers R2 (règle CORS du seau : `deploiement/r2-cors.json`).
 * Chaque appel réseau a un délai maximal (30 s) ; aucun n'est fait sous le verrou des services.
 */
import { createHash } from "node:crypto";
import type { EnvoiMultipart, StockageFichiers } from "../types";
import { signerAdresse, type IdentifiantsS3 } from "./signature";

export interface ConfigR2 {
  compte: string;
  cleAcces: string;
  secret: string;
  seau: string;
  hote: string;
  env: "prod" | "dev";
}

/** Durées des adresses signées (secondes). */
export const DUREES_R2 = {
  /** Lecture dans le navigateur : courte. */
  navigateur: 15 * 60,
  /** Fichiers donnés à HeyGen (audio maître, tranches, rush d'entraînement). */
  fournisseur: 24 * 3600,
  /** Dépôt d'un fichier entier ou d'un morceau. */
  depot: 6 * 3600,
} as const;

export const DELAI_RESEAU_MS = 30_000;

/** Configuration lue dans l'environnement, ou null si une variable manque. */
export function configR2(env: Record<string, string | undefined> = process.env): ConfigR2 | null {
  const compte = env.R2_ACCOUNT_ID?.trim();
  const cleAcces = env.R2_ACCESS_KEY_ID?.trim();
  const secret = env.R2_SECRET_ACCESS_KEY?.trim();
  const seau = env.R2_BUCKET?.trim();
  if (!compte || !cleAcces || !secret || !seau) return null;
  const hote = (env.R2_PUBLIC_HOST?.trim() || `${compte}.r2.cloudflarestorage.com`).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return { compte, cleAcces, secret, seau, hote, env: env.NODE_ENV === "production" ? "prod" : "dev" };
}

const EXTENSIONS: Record<string, string> = { image: "jpg", video: "mp4", audio: "mp3", application: "bin", text: "txt" };

/** Clé de stockage d'un fichier déposé (même forme qu'en simulation). */
export function cleDeDepot(env: string, demande: { fichierId: string; nom: string; mime: string; typeEntite: string; entiteId: string }): string {
  const ext = (demande.nom.includes(".") ? demande.nom.split(".").pop() : EXTENSIONS[demande.mime.split("/")[0]]) ?? "bin";
  return `studio/${env}/${demande.typeEntite}/${demande.entiteId}/${demande.fichierId}.${ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"}`;
}

/** Valeur d'une balise XML simple (réponses S3). */
function balise(xml: string, nom: string): string | undefined {
  return new RegExp(`<${nom}>([^<]*)</${nom}>`).exec(xml)?.[1];
}

/** Lit la liste des morceaux d'une réponse `ListParts`. */
export function lireMorceaux(xml: string): { numero: number; etag: string; taille: number }[] {
  const res: { numero: number; etag: string; taille: number }[] = [];
  for (const m of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
    const numero = Number(balise(m[1], "PartNumber"));
    const etag = (balise(m[1], "ETag") ?? "").replace(/&quot;/g, '"');
    if (numero) res.push({ numero, etag, taille: Number(balise(m[1], "Size") ?? 0) });
  }
  return res.sort((a, b) => a.numero - b.numero);
}

/** Corps XML de `CompleteMultipartUpload`. */
export function corpsFinMultipart(morceaux: { numero: number; etag: string }[]): string {
  const parts = [...morceaux]
    .sort((a, b) => a.numero - b.numero)
    .map((m) => `<Part><PartNumber>${m.numero}</PartNumber><ETag>${m.etag.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</ETag></Part>`)
    .join("");
  return `<CompleteMultipartUpload>${parts}</CompleteMultipartUpload>`;
}

type Fetch = typeof fetch;

/** Pages de 1000 clés lues au plus pour un dossier de vidéo. */
const PAGES_MAX_LISTE = 20;

const decoderXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export function creerStockageR2(config: ConfigR2, dependances: { fetch?: Fetch; maintenant?: () => Date } = {}): StockageFichiers {
  const identifiants: IdentifiantsS3 = { cleAcces: config.cleAcces, secret: config.secret, region: "auto" };
  const appeler: Fetch = dependances.fetch ?? fetch;
  const date = () => (dependances.maintenant ?? (() => new Date()))();
  const chemin = (cle: string) => `/${config.seau}/${cle.replace(/^\/+/, "")}`;
  const signer = (methode: "GET" | "PUT" | "POST" | "HEAD" | "DELETE", cle: string, expireSec: number, parametres?: Record<string, string>) =>
    signerAdresse(identifiants, { methode, hote: config.hote, chemin: chemin(cle), expireSec, parametres, date: date() });

  /** Liste du seau (ListObjectsV2) : chemin du seau seul, sans clé. */
  const signerListe = (parametres: Record<string, string>) =>
    signerAdresse(identifiants, { methode: "GET", hote: config.hote, chemin: `/${config.seau}`, expireSec: 300, parametres, date: date() });

  async function requete(url: string, init: RequestInit = {}): Promise<Response> {
    const r = await appeler(url, { ...init, signal: AbortSignal.timeout(DELAI_RESEAU_MS) });
    if (!r.ok) throw Object.assign(new Error(`R2 ${init.method ?? "GET"} ${r.status}`), { reessayable: r.status >= 500 || r.status === 429, statut: r.status });
    return r;
  }

  const multipart: EnvoiMultipart = {
    async commencer(cle, mime) {
      const r = await requete(signer("POST", cle, 300, { uploads: "" }), { method: "POST", headers: { "content-type": mime } });
      const idEnvoi = balise(await r.text(), "UploadId");
      if (!idEnvoi) throw new Error("R2 : identifiant d'envoi absent");
      return { idEnvoi };
    },
    async signerMorceaux(cle, idEnvoi, numeros) {
      const res: Record<number, string> = {};
      for (const n of numeros) {
        if (!Number.isInteger(n) || n < 1 || n > 10_000) continue;
        res[n] = signer("PUT", cle, DUREES_R2.depot, { partNumber: String(n), uploadId: idEnvoi });
      }
      return res;
    },
    async morceauxRecus(cle, idEnvoi) {
      const r = await requete(signer("GET", cle, 300, { uploadId: idEnvoi }));
      return lireMorceaux(await r.text());
    },
    async terminer(cle, idEnvoi, morceaux) {
      await requete(signer("POST", cle, 300, { uploadId: idEnvoi }), { method: "POST", headers: { "content-type": "application/xml" }, body: corpsFinMultipart(morceaux) });
      return { ok: true };
    },
  };

  return {
    id: "r2",
    type: "stockage",
    nom: "Cloudflare R2",
    reelPrevu: "Cloudflare R2",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    async preparerDepot(demande) {
      const cleStockage = cleDeDepot(config.env, demande);
      return { cleStockage, urlDepot: signer("PUT", cleStockage, DUREES_R2.depot) };
    },
    async confirmerDepot(cleStockage) {
      try {
        const r = await requete(signer("HEAD", cleStockage, 300), { method: "HEAD" });
        const taille = Number(r.headers.get("content-length"));
        return { ok: true, ...(r.headers.get("content-length") !== null && Number.isSafeInteger(taille) && taille >= 0 ? { taille } : {}) };
      } catch {
        return { ok: false };
      }
    },
    async lireDebut(cleStockage, octets) {
      // Lecture PARTIELLE (`Range`, en-tête non signé : seule `host` l'est) ; au plus `octets` gardés en mémoire.
      const n = Math.max(1, Math.min(4096, Math.floor(octets)));
      const r = await requete(signer("GET", cleStockage, 300), { headers: { range: `bytes=0-${n - 1}` } });
      const lecteur = r.body?.getReader();
      if (!lecteur) return new Uint8Array(0);
      const debut = new Uint8Array(n);
      let lus = 0;
      while (lus < n) {
        const { done, value } = await lecteur.read();
        if (done || !value) break;
        const part = value.subarray(0, n - lus);
        debut.set(part, lus);
        lus += part.byteLength;
      }
      await lecteur.cancel().catch(() => undefined);
      return debut.subarray(0, lus);
    },
    async supprimer(cleStockage) {
      await requete(signer("DELETE", cleStockage, 300), { method: "DELETE" });
    },
    async listerPrefixe(prefixe) {
      // Défense en profondeur : la garde stricte du dossier d'une vidéo est dans `domaine/dossiers-video.ts`.
      if (!prefixe.startsWith("studio/") || prefixe.split("/").includes("..") || prefixe.includes("//")) throw new Error(`R2 : préfixe refusé ${JSON.stringify(prefixe)}`);
      const cles: string[] = [];
      let jeton: string | undefined;
      for (let page = 0; page < PAGES_MAX_LISTE; page++) {
        const r = await requete(signerListe({ "list-type": "2", prefix: prefixe, ...(jeton ? { "continuation-token": jeton } : {}) }));
        const xml = await r.text();
        for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) {
          const cle = decoderXml(m[1]);
          if (cle.startsWith(prefixe)) cles.push(cle);
        }
        jeton = balise(xml, "IsTruncated") === "true" ? decoderXml(balise(xml, "NextContinuationToken") ?? "") : undefined;
        if (!jeton) break;
      }
      if (jeton) console.error(`[r2] liste tronquée après ${PAGES_MAX_LISTE} pages, des objets peuvent rester sans être listés`, prefixe);
      return cles;
    },
    async empreinteSha256(cleStockage, tailleAttendue) {
      // Lecture COMPLÈTE en continu : le délai total grandit avec la taille (60 s + 1 s par tranche de 10 Mo) ; jamais le corps entier en mémoire.
      const delai = 60_000 + Math.ceil(Math.max(0, tailleAttendue) / 10_485_760) * 1000;
      const r = await appeler(signer("GET", cleStockage, 3600), { headers: { "accept-encoding": "identity" }, signal: AbortSignal.timeout(delai) }); // en-tête non signé : octets stockés, jamais décompressés
      if (!r.ok) {
        await r.body?.cancel().catch(() => undefined);
        throw Object.assign(new Error(`R2 GET ${r.status}`), { reessayable: r.status >= 500 || r.status === 429, statut: r.status });
      }
      const lecteur = r.body?.getReader();
      if (!lecteur) throw new Error("R2 : corps de réponse absent");
      const hash = createHash("sha256");
      let taille = 0;
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        if (!value) continue;
        hash.update(value);
        taille += value.byteLength;
      }
      if (taille !== tailleAttendue) throw Object.assign(new Error(`R2 : ${taille} octets lus, ${tailleAttendue} attendus`), { definitif: true });
      return { sha256: hash.digest("hex"), taille };
    },
    async urlLecture(cleStockage) {
      // Fichiers de démonstration servis par le studio lui-même (public/).
      if (!cleStockage || cleStockage.startsWith("/")) return cleStockage;
      return signer("GET", cleStockage, DUREES_R2.navigateur);
    },
    async urlLectureDuree(cleStockage, secondes) {
      return signer("GET", cleStockage, secondes);
    },
    async urlDepotDuree(cleStockage, secondes) {
      return signer("PUT", cleStockage, secondes);
    },
    multipart,
  };
}

/** Instance de l'environnement (null sans configuration complète). */
export function stockageR2DepuisEnv(): StockageFichiers | null {
  const c = configR2();
  return c ? creerStockageR2(c) : null;
}
