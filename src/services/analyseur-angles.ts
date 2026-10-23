/**
 * BRANCHEMENT RÉEL DE L'ANALYSEUR D'ANGLES de la multicaméra (mission H — JOURNAL-F4 « Ce qui reste » n° 3).
 *
 * Aucune opération nouvelle : la durée vient de l'opération `analyse-media` EXISTANTE de `studio-rendu` (ffprobe), le
 * visage et la bouche de la route `/visages` EXISTANTE de `studio-aligneur` (MediaPipe), les mots de la référence sont
 * donnés par l'appelant (audio maître de l'avocat, mots montés du face caméra). Utilisé SEULEMENT quand le réglage
 * multicaméra du format a `reel: true` ET que le rendu et l'aligneur sont reliés ; sinon `null` (le double de
 * simulation reste choisi, aucun appel).
 */
import "server-only";
import { resoudreFournisseur } from "@/fournisseurs";
import { fournisseurFacecam } from "@/fournisseurs/facecam";
import { analyseurAngleReel, type EchantillonBouche } from "@/fournisseurs/multicamera/analyseur";
import type { AnalyseurAngle } from "@/fournisseurs/multicamera";
import { obtenirServiceRendu, renduSimule } from "@/fournisseurs/rendu/client";

const DUREE_SEC = 6 * 3600;
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const idSur = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "-").slice(-150);

export interface OptionsAnalyseurAngles {
  motsReference: (audioCle: string) => Promise<{ debutSec: number; finSec: number }[]>;
  env?: Record<string, string | undefined>;
  attendre?: (ms: number) => Promise<void>;
  /** Interrogations au plus (10 s chacune). */
  suivisMax?: number;
}

export function analyseurAnglesStudio(o: OptionsAnalyseurAngles): AnalyseurAngle | null {
  const env = o.env ?? process.env;
  if (renduSimule(env)) return null;
  const facecam = fournisseurFacecam({ reel: true }, env);
  if (facecam.mode !== "reel") return null;
  const stockage = resoudreFournisseur("stockage");
  if (!stockage.urlDepotDuree) return null;
  const attendre = o.attendre ?? pause;
  const max = o.suivisMax ?? 180;
  const lecture = async (cle: string) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, DUREE_SEC) : stockage.urlLecture(cle));
  const depot = async (cle: string, mime: string) => stockage.urlDepotDuree!(cle, DUREE_SEC, mime);

  return analyseurAngleReel({
    async duree(videoCle) {
      const rendu = obtenirServiceRendu(env);
      const cle = `${videoCle}.analyse.json`;
      const demande = { idRendu: `angle-${idSur(videoCle)}`, operation: "analyse-media" as const, file: "courte" as const, entrees: { media: await lecture(videoCle) }, sortie: { urlDepot: await depot(cle, "application/json"), cle }, parametres: {} };
      await rendu.soumettre(demande);
      for (let n = 0; n < max; n++) {
        const e = await rendu.etat(demande.idRendu);
        if (e.statut === "termine") return Number(e.mesures?.dureeSec ?? NaN);
        if (e.statut === "echec") throw new Error(e.erreur.message);
        if (e.statut === "inconnu") await rendu.soumettre(demande);
        await attendre(10_000);
      }
      throw new Error("La mesure de la durée a pris trop de temps.");
    },
    async visages(videoCle): Promise<EchantillonBouche[]> {
      const piste = `${videoCle}.visages.json.gz`;
      const points = `${videoCle}.points.json.gz`;
      const demande = { idTravail: `angle-${idSur(videoCle)}`, source: await lecture(videoCle), depots: { piste: await depot(piste, "application/gzip"), points: await depot(points, "application/gzip") } };
      let e = await facecam.soumettre("visages", demande);
      for (let n = 0; e.statut !== "termine"; n++) {
        if (e.statut === "echec") throw new Error(e.erreur.message);
        if (n >= max) throw new Error("L'analyse du visage a pris trop de temps.");
        await attendre(10_000);
        e = await facecam.suivre("visages", demande.idTravail);
      }
      const r = await fetch(await lecture(e.resultat.pisteVisageCle), { signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error("Piste du visage illisible.");
      const { gunzipSync } = await import("node:zlib");
      const json = JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf-8")) as { echantillons?: EchantillonBouche[] };
      return (json.echantillons ?? []).map((x) => ({ t: Number(x.t), bouche: Number(x.bouche), confiance: Number(x.confiance) }));
    },
    motsReference: o.motsReference,
  });
}
