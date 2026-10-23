/**
 * VIDÉOS D'ILLUSTRATION DES PLAQUETTES v4 — l'OUTIL du studio (18/10/2026). Serveur seulement (ffmpeg, banques, Claude injectés).
 *
 * Cause du plantage de la vidéo v-60359dd080b1 : personne ne remplissait `medias` des plaquettes qui montrent des vidéos (AvantApres,
 * MosaiqueVideos, duel-video). Cet outil le fait, avec le module « Les photos et logos » (`images/`, jusqu'ici branché nulle part) :
 * pour chaque `recherche` d'une plaquette, UNE fenêtre est approvisionnée (Pexels puis Pixabay, page par page, préparation ffmpeg 1080×1350,
 * mesure du mouvement, contrôle « littéral » par Claude sur une planche d'images extraites du passage retenu).
 * Décisions de Will (18/10) :
 *  - aucune vidéo littérale trouvée → la plaquette reste SANS media ; la chaîne la RETIRE du plan (le visage reste seul), jamais d'approximation ;
 *  - dépense Claude du contrôle visuel : 0,60 $ au plus par vidéo finale (compteur rendu), 2 contrôles au plus par recherche
 *    (banque + requête) puis passage à l'autre banque ou requête, modèle de contrôle déjà réglé dans le module images (pas Opus).
 * Les fichiers préparés sont rangés sous `studio/<env>/facecam-animee/<videoId>/videos/v4-<rang>-<k>.mp4` (clé donnée par `cleClip`).
 * Aucun appel réseau n'est fait ici : tout passe par `DependancesVideosV4`.
 */
import type { FenetrePlan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { DefinitionRole } from "@/generateur/roles/types";
import { MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import type { ChoixVideoV4, FichierVideoV4 } from "./chaine-v4";
import type { CandidatImage } from "./images/choisir";
import type { approvisionnerFenetresStudio, OptionsProductionImages } from "./images/production";
import type { OutilsPreparation } from "./images/preparation";
import { lireVerdictMiniVideo, type VerdictMiniVideo } from "./images/verification";
import type { MotTranscrit } from "./realisateur";
import { besoinVideosV4, raisonSansVideoV4 } from "./videos-v4";

/** Dépense Claude du contrôle visuel des vidéos, en dollars, par vidéo finale. */
export const PLAFOND_VIDEOS_USD = 0.6;
/** Contrôles de candidats au plus par recherche, pour une même banque et une même requête. */
export const CONTROLES_MAX_PAR_REQUETE = 2;
/** Candidats téléchargés et préparés au plus par recherche (disque, mémoire et bande passante du serveur), contrôlés ou non. */
export const TELECHARGEMENTS_MAX_PAR_RECHERCHE = 8;
/** Recherches de vidéos (appels aux banques) au plus par recherche de plaquette. */
export const APPELS_BANQUE_MAX_PAR_RECHERCHE = 30;
/** Coût estimé d'un contrôle quand aucun n'a encore été payé (une planche de 3 images, Sonnet) : prudence avant le plafond. */
export const COUT_CONTROLE_ESTIME_USD = 0.05;

export interface DependancesVideosV4 {
  /** Recherche de vidéos d'une banque (Pexels, Pixabay), page par page. Une banque en panne rend une liste vide ou lève. */
  chercherVideos(source: "pexels" | "pixabay", requeteEn: string, page: number): Promise<CandidatImage[]>;
  /** Outils de préparation (ffmpeg, téléchargement, dépôt) ; leur `deposer` reçoit la clé FINALE (voir `cleClip`). */
  preparation: OutilsPreparation;
  /** Clé de stockage finale d'un clip (`nom` = « v4-<rang>-<k>.mp4 »). */
  cleClip(nom: string): string;
  /** Contrôle visuel par Claude d'UNE planche (chemin local) : texte brut de la réponse et coût réel en dollars. */
  controler(d: { image: string; consigne: string }): Promise<{ ok: true; texte: string; coutUsd: number } | { ok: false; message: string }>;
  /** Remplissage des fenêtres (défaut : `approvisionnerFenetresStudio`). */
  approvisionner?: typeof approvisionnerFenetresStudio;
  plafondUsd?: number;
  controlesMaxParRequete?: number;
  /** Coût d'un contrôle, au pire (défaut `COUT_CONTROLE_ESTIME_USD`) : un contrôle qui ferait dépasser le plafond n'est pas lancé. */
  coutMaxControleUsd?: number;
}

export interface ResultatVideosV4 {
  plan: PlanFacecamAnimee;
  fichiers: FichierVideoV4[];
  manques: string[];
  /** Dépense Claude du contrôle visuel (dollars). */
  depenseUsd: number;
  choix: ChoixVideoV4[];
}

/**
 * RÔLE CLAUDE du contrôle visuel d'une vidéo d'illustration : le modèle de contrôle déjà réglé dans le module images (celui du juge, Sonnet),
 * jamais Opus. Texte libre (JSON demandé par la consigne du contrôle, lu par `lireVerdictMiniVideo`) ; la consigne propre à chaque candidat
 * est la partie variable de l'entrée, la planche d'images est jointe. Sans Claude relié, la simulation ne rend rien : le candidat est refusé.
 */
export function roleControleVideoV4(): DefinitionRole {
  return {
    id: "controle-video-facecam-animee",
    version: 1,
    consigne: "Tu contrôles une vidéo d'illustration pour une vidéo face caméra d'Axion-IA. L'utilisateur te donne la consigne de contrôle et une planche de trois images du passage retenu. Réponds seulement par le JSON demandé dans la consigne.",
    modele: MODELE_JUGE,
    effort: "low",
    maxTokens: 400,
    simuler: () => "",
  };
}

/** Exclusion mutuelle locale : une préparation (téléchargement + ffmpeg) à la fois dans ce processus (le PC et le serveur sont justes en mémoire). */
let queuePreparation: Promise<unknown> = Promise.resolve();
export function sousVerrouLocalV4<T>(f: () => Promise<T>): Promise<T> {
  const suite = queuePreparation.then(f, f);
  queuePreparation = suite.catch(() => undefined);
  return suite;
}

const nomClip = (rang: number, k: number) => `v4-${rang}-${k}.mp4`;

/**
 * Remplit les `medias` des plaquettes à vidéo du plan. Une plaquette dont les vidéos n'ont pas toutes été trouvées reste SANS media
 * (la chaîne la retire) ; les clips déjà préparés pour elle sont effacés. PUR de tout réseau : tout est injecté.
 */
export async function fournirVideosV4(d: { videoId: string; plan: PlanFacecamAnimee; mots: readonly MotTranscrit[] }, dep: DependancesVideosV4): Promise<ResultatVideosV4> {
  // Chargé à la demande : le module des photos et logos (ffmpeg, banques) ne pèse pas sur le démarrage du studio.
  const approvisionner = dep.approvisionner ?? (await import("./images/production")).approvisionnerFenetresStudio;
  const plafond = dep.plafondUsd ?? PLAFOND_VIDEOS_USD;
  const controlesMax = dep.controlesMaxParRequete ?? CONTROLES_MAX_PAR_REQUETE;
  let depense = 0;
  let dernierCout = dep.coutMaxControleUsd ?? COUT_CONTROLE_ESTIME_USD;
  const historique: string[] = [];
  const fichiers: FichierVideoV4[] = [];
  const manques: string[] = [];
  const choix: ChoixVideoV4[] = [];

  /** Le prochain contrôle ferait-il dépasser le plafond ? */
  const plafondAtteint = () => depense + Math.max(dernierCout, dep.coutMaxControleUsd ?? COUT_CONTROLE_ESTIME_USD) > plafond + 1e-9;

  const elements = [...(d.plan.elementsV4 ?? [])];
  /** Outil absent du serveur (ENOENT) : panne, pas un refus ; plus rien n'est cherché ni téléchargé. */
  let panneOutil = false;
  for (const [rang, e] of elements.entries()) {
    const besoin = besoinVideosV4(e.id);
    if (!besoin || !raisonSansVideoV4(e)) continue;
    const quoi = `« ${e.id} » à ${e.debut.toFixed(1).replace(".", ",")} s`;
    const recherches = e.recherches ?? [];
    if (recherches.length < besoin[0]) {
      manques.push(`${quoi} : ${recherches.length} recherche(s) écrite(s) pour ${besoin[0]} vidéo(s) au minimum.`);
      continue;
    }
    const voulues = Math.min(besoin[1], recherches.length);
    const trouvees: { k: number; fichier: FichierVideoV4 }[] = [];
    const choisies: ChoixVideoV4[] = [];
    for (let k = 0; k < voulues; k++) {
      // Plus assez de recherches restantes pour atteindre le minimum : on arrête, aucune dépense inutile.
      if (trouvees.length + (voulues - k) < besoin[0]) break;
      const nom = nomClip(rang, k);
      const cle = dep.cleClip(nom);

      // État propre à CETTE recherche : banque + requête en cours, contrôles par (banque + requête), appels aux banques.
      let courant = "";
      const controles = new Map<string, number>();
      let appels = 0;
      let telechargements = 0;
      /** Plus de contrôle possible pour la requête en cours (2 faits, ou plafond d'argent). */
      const controleEpuise = () => plafondAtteint() || (controles.get(courant) ?? 0) >= controlesMax;
      /** Plus de téléchargement utile : contrôle épuisé ou 8 candidats déjà téléchargés pour cette recherche. */
      const epuisee = () => controleEpuise() || telechargements >= TELECHARGEMENTS_MAX_PAR_RECHERCHE;
      const preparation: OutilsPreparation = {
        ...dep.preparation,
        // Rien n'est téléchargé ni préparé quand le contrôle de ce candidat ne pourrait plus avoir lieu (les 2 contrôles de cette requête sont faits, ou plafond atteint).
        async dossierTravail(n) {
          if (epuisee()) throw new Error("limite de contrôles ou de téléchargements atteinte pour cette recherche");
          telechargements++;
          return dep.preparation.dossierTravail(n);
        },
        async deposer(fichierLocal) {
          return dep.preparation.deposer(fichierLocal, cle);
        },
      };
      const options: OptionsProductionImages = {
        preparation,
        chercherVideos: async (source, requeteEn, page) => {
          if (plafondAtteint() || appels >= APPELS_BANQUE_MAX_PAR_RECHERCHE) return [];
          appels++;
          courant = `${source}|${requeteEn}`;
          return dep.chercherVideos(source, requeteEn, page);
        },
        verifierMiniVideo: async ({ image, consigne }): Promise<VerdictMiniVideo> => {
          if (!image) return lireVerdictMiniVideo("image absente");
          if (controleEpuise()) return lireVerdictMiniVideo("limite de contrôles atteinte");
          controles.set(courant, (controles.get(courant) ?? 0) + 1);
          const r = await dep.controler({ image, consigne });
          if (!r.ok) return lireVerdictMiniVideo("contrôle impossible");
          depense += r.coutUsd;
          dernierCout = Math.max(r.coutUsd, 0);
          return lireVerdictMiniVideo(r.texte);
        },
        // Une même vidéo de banque n'illustre pas deux plaquettes de la même vidéo.
        historique: [historique],
        mots: d.mots.map((m) => ({ w: m.w, a: m.a })),
      };
      const fenetre: FenetrePlan = { debut: e.debut, fin: e.fin, media: nom, recherche: recherches[k], video: true, ...(e.illustre ? { illustre: e.illustre } : {}) };
      let rempli: Awaited<ReturnType<typeof approvisionner>> | null = null;
      try {
        rempli = await approvisionner({ fenetres: [fenetre] }, options);
      } catch (err) {
        // Détail technique au journal du serveur seulement ; Will lit une phrase simple.
        console.warn(`[studio] vidéos d'illustration v4 : ${quoi}, vidéo ${k + 1} : ${err instanceof Error ? err.message.slice(0, 300) : "erreur"}`);
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
          manques.push("Un outil vidéo manque sur le serveur du studio : aucune vidéo d'illustration n'a pu être préparée.");
          panneOutil = true;
          break;
        }
        manques.push(`${quoi}, vidéo ${k + 1} : la recherche n'a pas pu aboutir.`);
      }
      const ok = rempli && rempli.plan.fenetres.length === 1 && rempli.plan.fenetres[0].media === cle;
      if (!rempli || !ok) {
        if (rempli) {
          console.info(`[studio] vidéos d'illustration v4 : ${quoi}, vidéo ${k + 1} : ${rempli.manques.map((m) => m.raison).join(" ; ").slice(0, 400)}`);
          manques.push(`${quoi}, vidéo ${k + 1} : aucune vidéo fidèle à ce qui est dit n'a été trouvée.`);
        }
        // Une seule vidéo manquante suffit à retirer un duel ou un avant/après ; une mosaïque peut continuer sans elle.
        continue;
      }
      historique.push(...rempli.empreintes);
      const c = rempli.choix[0];
      trouvees.push({ k, fichier: { nom, cle } });
      choisies.push({ fichier: nom, source: c.source, id: c.id, scene: c.scene, ...(c.page ? { page: c.page } : {}), ...(c.auteur ? { auteur: c.auteur } : {}), ...(c.licence?.nom ? { licence: c.licence.nom } : {}), ...(c.verdict ? { verdict: c.verdict } : {}) });
    }

    if (panneOutil) {
      for (const t of trouvees) await dep.preparation.retirer?.(t.fichier.cle).catch(() => undefined);
      break;
    }
    if (trouvees.length >= besoin[0]) {
      // Mosaïque : les recherches gardées restent alignées sur les vidéos trouvées (jamais une vidéo reprise à la place d'une autre).
      elements[rang] = { ...e, recherches: trouvees.map((t) => recherches[t.k]), medias: trouvees.map((t) => `broll/${t.fichier.nom}`) };
      fichiers.push(...trouvees.map((t) => t.fichier));
      choix.push(...choisies);
    } else {
      manques.push(`${quoi} : ${trouvees.length} vidéo(s) fidèle(s) trouvée(s) sur ${besoin[0]} au minimum.`);
      // Les clips préparés pour une plaquette qui sera retirée sont effacés.
      for (const t of trouvees) await dep.preparation.retirer?.(t.fichier.cle).catch(() => undefined);
    }
  }
  return { plan: { ...d.plan, elementsV4: elements }, fichiers, manques, depenseUsd: Math.round(depense * 10_000) / 10_000, choix };
}
