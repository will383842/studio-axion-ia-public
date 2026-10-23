/**
 * RECOPIE d'un média tiers dans NOTRE stockage (lot A2) : aucun domaine tiers n'est jamais affiché par le studio
 * (`next.config.ts`, CSP) ; une vidéo Pexels / Pixabay ou un fichier fabriqué par fal.ai est téléchargé puis déposé
 * dans R2 (PUT signé). Sans R2 (essai local, hors production), le fichier est écrit dans `public/essais/` et lu par
 * le serveur de développement ; en production sans R2 : erreur claire, rien n'est perdu (rien n'a été payé en plus).
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ErreurFournisseur, StockageFichiers } from "../types";

export const DELAI_TELECHARGEMENT_MS = 120_000;

export class ErreurIllustration extends Error {
  constructor(public readonly erreur: ErreurFournisseur) {
    super(erreur.message);
    this.name = "ErreurIllustration";
  }
}

/** Fonction de dépôt : renvoie la clé de stockage. Injectée dans les essais. */
export type Deposer = (contenu: Uint8Array, cle: string, mime: string) => Promise<string>;

/** Clé de stockage d'un média d'illustration : `studio/{env}/illustrations/{source}/{empreinte}.{ext}`. */
export function cleIllustration(source: string, idExterne: string, ext: string, env: Record<string, string | undefined> = process.env): string {
  const e = env.NODE_ENV === "production" ? "prod" : "dev";
  const h = createHash("sha256").update(`${source}:${idExterne}`).digest("hex").slice(0, 24);
  return `studio/${e}/illustrations/${source.replace(/[^a-z0-9-]/g, "")}/${h}.${ext.replace(/[^a-z0-9]/g, "") || "bin"}`;
}

/** Télécharge un fichier distant (délai maximal), refuse une réponse vide. */
export async function telecharger(url: string, delaiMs = DELAI_TELECHARGEMENT_MS): Promise<{ contenu: Uint8Array; mime: string }> {
  let r: Response;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(delaiMs) });
  } catch (e) {
    console.warn(`[illustrations] téléchargement impossible : ${(e as Error).message}`);
    throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "Le fichier n'a pas pu être téléchargé : nouvel essai dans un instant." });
  }
  if (!r.ok) {
    console.warn(`[illustrations] téléchargement refusé : réponse ${r.status}`);
    throw new ErreurIllustration({ code: r.status === 404 || r.status === 403 ? "fichier-inaccessible" : "indisponible", reessayable: true, message: "Le fichier n'a pas pu être téléchargé." });
  }
  const contenu = new Uint8Array(await r.arrayBuffer());
  if (!contenu.length) throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "Fichier téléchargé vide." });
  return { contenu, mime: r.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream" };
}

/** Dépôt par défaut : R2 (PUT signé) si le stockage le permet ; sinon `public/essais/` hors production. */
export function depotParDefaut(stockage: () => Promise<StockageFichiers>, env: Record<string, string | undefined> = process.env): Deposer {
  return async (contenu, cle, mime) => {
    const s = await stockage();
    if (s.urlDepotDuree) {
      const url = await s.urlDepotDuree(cle, 3600, mime);
      const r = await fetch(url, { method: "PUT", headers: { "content-type": mime }, body: contenu as unknown as BodyInit, signal: AbortSignal.timeout(DELAI_TELECHARGEMENT_MS) });
      if (!r.ok) {
        console.warn(`[illustrations] dépôt dans le stockage refusé : réponse ${r.status}`);
        throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "Le fichier n'a pas pu être rangé dans le stockage." });
      }
      return cle;
    }
    if (env.NODE_ENV === "production") throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "Le stockage des fichiers n'est pas relié : l'illustration ne peut pas être gardée." });
    const relatif = cle.replace(/^studio\/[a-z]+\//, "");
    const dossier = join(process.cwd(), "public", "essais", ...relatif.split("/").slice(0, -1));
    await mkdir(dossier, { recursive: true });
    await writeFile(join(dossier, relatif.split("/").at(-1)!), contenu);
    return `/essais/${relatif}`;
  };
}

/** Stockage de l'environnement, chargé à la demande (le registre importe ce dossier : pas d'import circulaire). */
export async function stockageEnvironnement(): Promise<StockageFichiers> {
  const { resoudreFournisseur } = await import("../index");
  return resoudreFournisseur("stockage");
}
