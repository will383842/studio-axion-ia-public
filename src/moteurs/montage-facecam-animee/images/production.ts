/**
 * MINI-VIDÉOS — CHEMIN DE PRODUCTION (passe 3, revue passe 2 point 2 : « brancher `adaptateurStudio` en production »).
 *
 * Le moteur « Montage face caméra animée » appelle, à son étape « Les photos et logos », la fonction rendue par
 * `etapeImagesStudio` : elle lit le plan de mise en scène de la commande, le remplit par `remplirFenetres` branché sur
 * `adaptateurStudio` (recherche Pexels + Pixabay page par page, Mes images, préparation ffmpeg, dépôt dans le stockage
 * du rendu), contrôle chaque mini-vidéo par Claude, demande une autre scène au réalisateur si rien ne convient, puis
 * écrit le plan rempli. Garde finale : AUCUNE photo fixe dans une fenêtre (`fenetresSansVie`) — sinon échec.
 * Le format reste FERMÉ (`refusAuLancement` du moteur) : ce chemin ne tourne que lorsqu'on l'active.
 * Les clés ne sont lues que dans l'environnement du serveur (`clesDepuisEnv`) et ne sortent jamais d'ici.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { Transform } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as FluxWeb } from "node:stream/web";
import type { FenetrePlan } from "@/domaine/facecam-animee/plan";
import { adaptateurStudio, type OptionsAdaptateur } from "./adaptateur";
import { chercheurVideosBanques, type ClesBanques, type Recuperer } from "./banques";
import { remplirFenetres, type DependancesImages, type ResultatImages } from "./index";
import type { OutilsPreparation } from "./preparation";

export interface OptionsProductionImages extends OptionsAdaptateur {
  verifierMiniVideo?: DependancesImages["verifierMiniVideo"];
  verifierImage?: DependancesImages["verifierImage"];
  autreScene?: DependancesImages["autreScene"];
  historique?: DependancesImages["historique"];
  /** Transcription : le contrôle visuel juge contre la phrase dite (passe 3). */
  mots?: DependancesImages["mots"];
}

/** Fenêtres SANS VIE : un média qui n'est ni une vidéo ni une capture du site (qui défile). Rangs dans le plan. */
export function fenetresSansVie(fenetres: readonly FenetrePlan[]): number[] {
  return fenetres.flatMap((f, i) => (f.capture || (f.video === true && /\.(mp4|webm|mov)$/i.test(f.media)) ? [] : [i]));
}

/** Remplit les fenêtres d'un plan par le chemin de production (adaptateur du studio). */
export async function approvisionnerFenetresStudio<P extends { fenetres: FenetrePlan[] }>(plan: P, o: OptionsProductionImages): Promise<ResultatImages<P>> {
  const r = await remplirFenetres(plan, {
    ...adaptateurStudio(o),
    ...(o.verifierMiniVideo ? { verifierMiniVideo: o.verifierMiniVideo } : {}),
    ...(o.verifierImage ? { verifierImage: o.verifierImage } : {}),
    ...(o.autreScene ? { autreScene: o.autreScene } : {}),
    ...(o.historique ? { historique: o.historique } : {}),
    ...(o.mots ? { mots: o.mots } : {}),
  });
  const mortes = fenetresSansVie(r.plan.fenetres);
  if (mortes.length) throw new Error(`Fenêtres sans mini-vidéo après approvisionnement : ${mortes.map((i) => i + 1).join(", ")}.`);
  return r;
}

/** Ce que l'étape « Les photos et logos » du moteur lit et écrit pour une commande. */
export interface EtapeImagesStudio<C> {
  /** Le plan de mise en scène de la commande (écrit par le réalisateur) ; absent : rien à faire. */
  lirePlan(commande: C): Promise<{ fenetres: FenetrePlan[] } | null | undefined>;
  /** Enregistre le plan rempli et le rapport (choix, manques, empreintes pour l'historique). */
  ecrirePlan(commande: C, resultat: ResultatImages<{ fenetres: FenetrePlan[] }>): Promise<void>;
  /** Options de production (adaptateur, contrôle, réalisateur) pour cette commande. */
  options(commande: C): Promise<OptionsProductionImages> | OptionsProductionImages;
}

/** La dépendance `images` du moteur, branchée sur le studio. */
export function etapeImagesStudio<C>(e: EtapeImagesStudio<C>): (commande: C) => Promise<void> {
  return async (commande) => {
    const plan = await e.lirePlan(commande);
    if (!plan?.fenetres?.length) return;
    await e.ecrirePlan(commande, await approvisionnerFenetresStudio(plan, await e.options(commande)));
  };
}

/* ---------------- Outils du serveur (ffmpeg, téléchargement, dépôt) ---------------- */

const TELECHARGEMENT_MAX = 200 * 1024 * 1024;
const DELAI_TELECHARGEMENT_MS = 180_000;

/** Recherche directe des vidéos Pexels + Pixabay avec les clés du serveur. */
export function chercherVideosServeur(cles: ClesBanques, recuperer: Recuperer = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })) {
  return chercheurVideosBanques(cles, recuperer);
}

/**
 * Outils de préparation sur le serveur : ffmpeg/ffprobe du système, téléchargement borné (taille et durée), dossier de
 * travail jetable par candidat, dépôt dans le stockage du rendu par `deposer` (contenu, clé, type).
 */
export function outilsPreparationServeur(o: { telechargementMaxOctets?: number; deposer: (contenu: Uint8Array, cle: string, mime: string) => Promise<string>; retirer?: (cle: string) => Promise<void>; racine?: string; sousVerrou?: OutilsPreparation["sousVerrou"] }): OutilsPreparation {
  return {
    executer(programme, args) {
      return new Promise((ok, ko) => {
        const p = spawn(programme, args, { windowsHide: true });
        const sortie: Buffer[] = [];
        let erreur = "";
        p.stdout.on("data", (d: Buffer) => sortie.push(d));
        p.stderr.on("data", (d: Buffer) => {
          erreur = (erreur + d.toString()).slice(-2000);
        });
        p.on("error", ko);
        p.on("close", (code) => (code === 0 ? ok(Buffer.concat(sortie)) : ko(new Error(`${programme} a échoué (${code}) : ${erreur.slice(-300)}`))));
      });
    },
    async telecharger(url, fichier) {
      const r = await fetch(url, { signal: AbortSignal.timeout(DELAI_TELECHARGEMENT_MS) });
      if (!r.ok || !r.body) throw new Error(`téléchargement : réponse ${r.status}`);
      const plafond = o.telechargementMaxOctets ?? TELECHARGEMENT_MAX;
      if (Number(r.headers.get("content-length") ?? 0) > plafond) throw new Error("fichier trop lourd");
      // Les octets REÇUS sont comptés : un serveur sans content-length (ou qui ment) est coupé au plafond.
      let recus = 0;
      const compteur = new Transform({
        transform(morceau: Buffer, _e, suite) {
          recus += morceau.length;
          if (recus > plafond) suite(new Error("fichier trop lourd"));
          else suite(null, morceau);
        },
      });
      try {
        await pipeline(Readable.fromWeb(r.body as unknown as FluxWeb), compteur, createWriteStream(fichier), { signal: AbortSignal.timeout(DELAI_TELECHARGEMENT_MS) });
      } catch (e) {
        await rm(fichier, { force: true }).catch(() => undefined);
        throw e;
      }
    },
    async dossierTravail(nom) {
      const racine = o.racine ?? join(tmpdir(), "mini-videos");
      await mkdir(racine, { recursive: true });
      return mkdtemp(join(racine, `${nom}-`));
    },
    async taille(f) {
      return (await stat(f)).size;
    },
    async deposer(fichier, cle) {
      return o.deposer(await readFile(fichier), cle, "video/mp4");
    },
    ...(o.retirer ? { retirer: o.retirer } : {}),
    async supprimerDossier(d) {
      await rm(d, { recursive: true, force: true });
    },
    async supprimer(f) {
      await rm(f, { force: true });
    },
    ...(o.sousVerrou ? { sousVerrou: o.sousVerrou } : {}),
  };
}
