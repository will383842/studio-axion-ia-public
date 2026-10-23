/**
 * FACE CAMÉRA ANIMÉE v4 — BRANCHEMENT DE PRODUCTION (Lot I, 17/10/2026). Serveur seulement.
 *
 * 1. Les OUTILS RÉELS de la chaîne (`moteurs/montage-facecam-animee/chaine-v4.ts`), branchés au moteur pour la boucle de fond
 *    (`brancherServicesFacecamAnimee`, ce fichier est chargé par `boucle.ts` pour son effet) :
 *    - transcription horodatée au mot de la prise : conteneur `studio-aligneur`, route `transcrire` (celle du face caméra) ;
 *    - réalisateur : Claude Opus par le chemin de dépense du studio (`executerRolePourVideo`, plafond propre de la vidéo) ;
 *    - rendu : service de rendu du studio, opération `composition` en mode `facecam-v4` (prise montée + médias servis par adresse) ;
 *    chaque travail extérieur est REPRIS par son identifiant à chaque passage (jamais lancé deux fois), sans bloquer la boucle.
 * 2. L'ÉCRAN DE DÉPÔT (`/face-camera-animee`, joignable par son adresse ; le format reste masqué : aucun menu, aucune liste ne le montre) :
 *    la prise déposée par Will (envoi multipart du studio) devient une vidéo du format, lancée par le lancement commun (format sans prix).
 *    Tant que le format est masqué, le lancement réel exige l'accord d'essai de Will (réglage `facecamAnimee.accordEssaiReel`), comme
 *    « Image → vidéo ».
 * La vidéo finie est rangée comme celles des autres générateurs (sorties de la version, page `/videos/<id>`) : plus de Drive.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CommandeFabrication, Distribution, Fichier, Id, MotHorodate, Travail } from "@/domaine/types";
import type { ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { PARAM_PLAFOND_VIDEOS_FA, PREFIXE_ETAPE_VIDEOS_FA, plafondRestantVideosFa, plafondVideosFa } from "./depense-claude-video";
import { roleControleVideoV4, sousVerrouLocalV4, type DependancesVideosV4 } from "@/moteurs/montage-facecam-animee/videos-v4-studio";
import { brancherServicesFacecamAnimee, ID_MOTEUR_FACECAM_ANIMEE, lireEntreesFacecamAnimee } from "@/moteurs/montage-facecam-animee";
import { EnCoursChaineV4, ErreurChaineV4, lireEtatV4, PRISE_MONTEE_V4, SORTIE_V4, type GardeV4, type OutilsChaineV4, type RecadrageV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { ReponseRealisateur, RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { texteScript } from "@/domaine/derivations";
import { cleFichierRef, clesFichier, type CandidatSujet, type Confirmation, type NiveauSujet, type Precedent } from "@/domaine/sujets-traites";
import { empreinteAvantControle, PHRASE_VERIFICATION_EN_COURS, phraseRefusEmpreinte, type DependancesAvantControle } from "./empreintes-fichiers";
import { creerVerrou, depots, ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import type { SourcesSujets } from "./sujets-traites";
import { phrasePrisesSautees } from "@/components/formats/facecam-animee/sujet-deja-traite";
import { estimerOpusV4, type EstimationOpusV4 } from "@/moteurs/montage-facecam-animee/realisateur/cout-v4";
import { exigerSession } from "./auth";
import { listerScripts, obtenirScript } from "./scripts";
import { TEXTE_DIT_MAX_FA, texteDitDuScript } from "@/components/formats/facecam-animee/scripts-valides";

export const ID_FORMAT_FACECAM_ANIMEE = "facecam-animee";
/** Accord d'essai réel de Will tant que le format est masqué (même mécanisme que « Image → vidéo »). */
export const PARAM_ACCORD_ESSAI_FA = "facecamAnimee.accordEssaiReel";
/** Plafond Claude propre d'une vidéo face caméra animée (dollars) : jusqu'à 3 essais du réalisateur. */
export const PARAM_PLAFOND_CLAUDE_FA = "facecamAnimee.plafondClaudeUsd";
export const PLAFOND_CLAUDE_FA_USD = 4;
export const PREFIXE_ETAPE_FA = "Face caméra animée ·";
/** Contrôle visuel des vidéos d'illustration (Sonnet) : plafond propre par vidéo finale, 0,60 $ (décision de Will du 18/10) ; défini avec les autres plafonds propres. */
export { PARAM_PLAFOND_VIDEOS_FA, PREFIXE_ETAPE_VIDEOS_FA };
const STUDIO_NON_RELIE_FA = "Le studio n'est pas relié (stockage ou serveur de rendu) : la vidéo face caméra animée ne peut pas être fabriquée.";

/* ------------------------------------------------------------------ */
/* 1. Outils réels                                                       */
/* ------------------------------------------------------------------ */

export interface DependancesOutilsFA {
  videoId: Id;
  travailId: Id;
  /** Production : un fournisseur simulé y est refusé (défaut : `NODE_ENV`). */
  production?: boolean;
  /* Doubles (répétition générale, tests) ; absents : ceux du studio. */
  /** Adresses signées du stockage (lecture, dépôt). */
  signer?: { lecture(cle: string): Promise<string>; depot(cle: string, mime: string): Promise<string> };
  /** Service de rendu (défaut : `obtenirServiceRendu()`). */
  rendu?: ServiceRendu;
  /** Transcription (défaut : conteneur `studio-aligneur`). */
  transcrire?: OutilsChaineV4["transcrire"];
  /** Repérage du visage d'une prise horizontale (défaut : route `visages` du conteneur). */
  reperer?: OutilsChaineV4["reperer"];
  /** Vidéos d'illustration (double de test) ; absent : recherche Pexels / Pixabay du serveur, préparation ffmpeg et contrôle Claude. */
  videos?: OutilsChaineV4["videos"];
  /** Contrôle visuel d'une vidéo (double de test) ; absent : Claude par `executerRolePourVideo`. */
  controleVideo?: DependancesVideosV4["controler"];
  /** Chemin de dépense Claude (défaut : `executerRolePourVideo`). */
  appelerRoleClaude?: (role: DefinitionRole, entree: EntreeRole, options: { etape: string }) => Promise<{ ok: true; simule: boolean; donnees?: unknown } | { ok: false; message: string }>;
}

/** Réponse de `executerRolePourVideo` → réponse attendue par `realiser`. PUR. */
export function reponseRealisateurDe(r: { ok: true; simule: boolean; donnees?: unknown; invalide?: string } | { ok: false; message: string }): ReponseRealisateur {
  if (!r.ok) return { ok: false, message: r.message };
  // Claude non relié (simulation) : aucune mise en scène inventée, la version simple prend le relais.
  if (r.simule) return { ok: false, message: "Claude n'est pas relié au studio." };
  // Réponse illisible (pas du JSON) : `null`, que `realiser` refuse avec une erreur de forme, puis nouvel essai.
  // et dit POURQUOI (coupée par max_tokens, pas du JSON) au lieu de « received null ».
  if (r.donnees === undefined) return { ok: true, donnees: null, erreur: r.invalide ?? "Réponse vide de Claude (aucun JSON)." };
  return { ok: true, donnees: r.donnees };
}

/**
 * Visage d'une prise d'après la piste de la route `visages` (positions sur la prise entière) : médianes des échantillons où il est trouvé
 * (centre des yeux, largeur de la boîte). `null` : trop peu d'échantillons. PUR.
 */
export function visageDeLaPiste(piste: { echantillons?: { yeuxX?: number; yeuxY?: number; boite?: number[]; confiance?: number }[] } | null | undefined): { centreX: number; yeux: number; largeurVisage?: number } | null {
  const ok = (piste?.echantillons ?? []).filter((e) => e.confiance === 1 && Number.isFinite(e.yeuxX) && Number.isFinite(e.yeuxY));
  if (ok.length < 3) return null;
  const mediane = (v: number[]) => {
    const t = [...v].sort((a, b) => a - b);
    return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
  };
  const largeurs = ok.map((e) => e.boite?.[2]).filter((x): x is number => Number.isFinite(x) && (x as number) > 0);
  return { centreX: mediane(ok.map((e) => e.yeuxX as number)), yeux: mediane(ok.map((e) => e.yeuxY as number)), ...(largeurs.length ? { largeurVisage: mediane(largeurs) } : {}) };
}

/** Demande au service de rendu pour une vidéo v4. PUR. */
export function demandeRenduV4(d: { idRendu: string; prise: string; plan: PlanFacecamAnimee; gardes: GardeV4[]; sortie: { urlDepot: string; cle: string }; vignette: { urlDepot: string; cle: string }; recadrage?: RecadrageV4; videos?: { nom: string; url: string }[] }) {
  return {
    idRendu: d.idRendu,
    operation: "composition" as const,
    file: "longue" as const,
    // Vidéos d'illustration des plaquettes : une entrée signée par fichier, « broll:v4-<rang>-<k>.mp4 » (le rendu les range dans le dossier servi sous ce nom).
    entrees: { prise: d.prise, ...Object.fromEntries((d.videos ?? []).map((v) => [`broll:${v.nom}`, v.url])) },
    sortie: d.sortie,
    parametres: {
      mode: "facecam-v4",
      plan: { ...d.plan, prise: { ...d.plan.prise, src: PRISE_MONTEE_V4 }, sons: [] },
      gardes: d.gardes,
      vignette: d.vignette,
      // Prise horizontale : colonne 9:16 fixe sur le visage, ramenée à 1080 × 1920 au montage (aucun zoom en plus).
      ...(d.recadrage ? { recadrage: { x: d.recadrage.x, largeur: d.recadrage.largeur, hauteur: d.recadrage.hauteur, sortieLargeur: SORTIE_V4.largeur, sortieHauteur: SORTIE_V4.hauteur } } : {}),
    },
  };
}

export async function outilsFacecamAnimee(dep: DependancesOutilsFA): Promise<OutilsChaineV4> {
  const client = await import("@/fournisseurs/rendu/client");
  const production = dep.production ?? process.env.NODE_ENV === "production";
  const env = production ? "prod" : "dev";
  let signerLecture: (cle: string) => Promise<string>;
  let signerDepot: (cle: string, mime: string) => Promise<string>;
  let supprimerStockage: ((cle: string) => Promise<void>) | undefined;
  if (dep.signer) {
    signerLecture = dep.signer.lecture;
    signerDepot = dep.signer.depot;
  } else {
    const { resoudreFournisseur } = await import("@/fournisseurs");
    const stockage = resoudreFournisseur("stockage") as StockageFichiers;
    if (production && stockage.mode === "simulation") throw new Error(STUDIO_NON_RELIE_FA);
    supprimerStockage = stockage.supprimer ? (cle) => (stockage.supprimer as (c: string) => Promise<void>)(cle) : undefined;
    signerLecture = async (cle) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, 6 * 3600) : stockage.urlLecture(cle));
    signerDepot = async (cle, mime) => {
      if (stockage.urlDepotDuree) return stockage.urlDepotDuree(cle, 6 * 3600, mime);
      if (stockage.mode === "simulation") return "";
      throw new Error(STUDIO_NON_RELIE_FA);
    };
  }
  if (!dep.rendu && production && client.renduSimule()) throw new Error(STUDIO_NON_RELIE_FA);
  const rendu = dep.rendu ?? client.obtenirServiceRendu();
  const cleFA = (nom: string) => `studio/${env}/facecam-animee/${dep.videoId}/${nom}`;

  return {
    async transcrire({ priseCle, appelId }) {
      if (dep.transcrire) return dep.transcrire({ priseCle, appelId });
      const [{ fournisseurFacecam }, { lireJsonGz }] = await Promise.all([import("@/fournisseurs/facecam"), import("./monteur-facecam")]);
      const facecam = fournisseurFacecam({ reel: true });
      const cleTranscription = cleFA(`${appelId}-transcription.json.gz`);
      let e = await facecam.suivre("transcrire", appelId);
      if (e.statut === "echec" && e.erreur.travailInconnu) {
        e = await facecam.soumettre("transcrire", {
          idTravail: appelId,
          source: await signerLecture(priseCle),
          depots: { transcription: await signerDepot(cleTranscription, "application/gzip") },
          parametres: { glossaire: [], cles: { transcription: cleTranscription } },
        });
      }
      if (e.statut === "en_file" || e.statut === "en_cours" || (e.statut === "echec" && e.erreur.injoignable)) throw new EnCoursChaineV4("La transcription");
      if (e.statut === "echec") throw new ErreurChaineV4("La transcription de votre vidéo n'a pas abouti. Vous pouvez réessayer.", e.erreur.reessayable, e.erreur.message);
      const r = e.resultat;
      const brut = Array.isArray(r.mots) ? r.mots : ((await lireJsonGz<MotHorodate[] | { mots?: MotHorodate[] }>(r.transcriptionCle).catch(() => null)) ?? []);
      const mots = Array.isArray(brut) ? brut : (brut.mots ?? []);
      return { mots, dureeSec: r.dureeSec, ...(r.largeurSource && r.hauteurSource ? { largeurSource: r.largeurSource, hauteurSource: r.hauteurSource } : {}) };
    },
    async reperer({ priseCle, appelId }) {
      if (dep.reperer) return dep.reperer({ priseCle, appelId });
      const [{ fournisseurFacecam }, { lireJsonGz }] = await Promise.all([import("@/fournisseurs/facecam"), import("./monteur-facecam")]);
      const facecam = fournisseurFacecam({ reel: true });
      const clePiste = cleFA(`${appelId}-piste.json.gz`);
      const clePoints = cleFA(`${appelId}-points.json.gz`);
      let e = await facecam.suivre("visages", appelId);
      if (e.statut === "echec" && e.erreur.travailInconnu) {
        e = await facecam.soumettre("visages", {
          idTravail: appelId,
          source: await signerLecture(priseCle),
          depots: { piste: await signerDepot(clePiste, "application/gzip"), points: await signerDepot(clePoints, "application/gzip") },
          parametres: { cles: { piste: clePiste, points: clePoints } },
        });
      }
      if (e.statut === "en_file" || e.statut === "en_cours" || (e.statut === "echec" && e.erreur.injoignable)) throw new EnCoursChaineV4("Le cadrage");
      // Visage introuvable (ou repérage raté) : colonne centrée, la vidéo est quand même fabriquée.
      if (e.statut === "echec") return null;
      return visageDeLaPiste(await lireJsonGz<Parameters<typeof visageDeLaPiste>[0]>(e.resultat.pisteVisageCle).catch(() => null));
    },
    async plafondClaudeAtteint() {
      const { plafondClaudeDuMoisAtteint } = await import("./plafond-claude");
      return plafondClaudeDuMoisAtteint();
    },
    async appelerRealisateur(requete: RequeteRealisateur): Promise<ReponseRealisateur> {
      const { roleRealisateurV4, entreeRoleRealisateurV4 } = await import("@/moteurs/montage-facecam-animee/realisateur/role-v4");
      const etape = `${PREFIXE_ETAPE_FA} mise en scène`;
      if (dep.appelerRoleClaude) return reponseRealisateurDe(await dep.appelerRoleClaude(roleRealisateurV4(), entreeRoleRealisateurV4(requete), { etape }));
      const { executerRolePourVideo } = await import("./depense-claude-video");
      const plafondPropre = { id: "faclaude", parametre: PARAM_PLAFOND_CLAUDE_FA, defautUsd: PLAFOND_CLAUDE_FA_USD, prefixeEtape: PREFIXE_ETAPE_FA };
      // Le plafond propre a la forme de ceux du tableau ; son identifiant n'est pas dans leur liste (même chemin que « Image → vidéo »).
      const r = await executerRolePourVideo(dep.videoId, roleRealisateurV4(), entreeRoleRealisateurV4(requete), { etape, plafondPropre } as unknown as Parameters<typeof executerRolePourVideo>[3]);
      return reponseRealisateurDe(r);
    },
    async historique() {
      // Les 5 dernières vidéos qui ont un plan v4 (hors la vidéo en cours : un « réessayer » ne se compare pas à lui-même), la plus récente d'abord,
      // un seul travail par vidéo (le plus récent). Une lecture qui échoue ne bloque jamais la mise en scène : pas d'historique.
      try {
        const { historiqueDuPlan } = await import("@/moteurs/montage-facecam-animee/realisateur/regles");
        const travaux = (await depots().travaux.lister((t) => t.fournisseurUtilise === ID_MOTEUR_FACECAM_ANIMEE && t.cibleId !== dep.videoId)) as Travail[];
        const vus = new Set<string>();
        return travaux
          .map((t) => ({ cible: t.cibleId ?? t.id, creeLe: t.creeLe ?? "", plan: lireEtatV4(t.parametres?.facecamAnimeeV4)?.realisation?.plan }))
          .filter((x) => x.plan?.elementsV4?.length)
          .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
          .filter((x) => (vus.has(x.cible) ? false : (vus.add(x.cible), true)))
          .slice(0, 5)
          .map((x) => historiqueDuPlan(x.plan!));
      } catch (e) {
        console.warn("[studio] historique du réalisateur illisible :", e instanceof Error ? e.message : e);
        return [];
      }
    },
    async videos({ plan, mots }) {
      if (dep.videos) return dep.videos({ videoId: dep.videoId, plan, mots });
      const [{ fournirVideosV4 }, { chercherVideosServeur, outilsPreparationServeur }] = await Promise.all([import("@/moteurs/montage-facecam-animee/videos-v4-studio"), import("@/moteurs/montage-facecam-animee/images/production")]);
      const cles = { pexels: process.env.PEXELS_API_KEY?.trim() || undefined, pixabay: process.env.PIXABAY_API_KEY?.trim() || undefined };
      if (!cles.pexels && !cles.pixabay) return { plan, fichiers: [], manques: ["Les banques de vidéos (Pexels, Pixabay) ne sont pas reliées au studio : aucune vidéo d'illustration."], depenseUsd: 0 };
      const preparation = outilsPreparationServeur({
        deposer: async (contenu, cle, mime) => {
          const url = await signerDepot(cle, mime);
          if (!url) throw new Error(STUDIO_NON_RELIE_FA);
          const r = await fetch(url, { method: "PUT", body: contenu as unknown as BodyInit, headers: { "content-type": mime }, signal: AbortSignal.timeout(120_000) });
          if (!r.ok) throw new Error(`dépôt de la vidéo : réponse ${r.status}`);
          return cle;
        },
        ...(supprimerStockage ? { retirer: supprimerStockage } : {}),
        sousVerrou: sousVerrouLocalV4,
      });
      /** Début de la version courante : création du travail de fabrication. */
      const debutVersion = async () => (await depots().travaux.obtenir(dep.travailId))?.creeLe;
      // Le compteur local lit le même réglage que le chemin de dépense (jamais une constante).
      // ... moins ce qui est déjà dépensé depuis le début de la version (pas de téléchargements inutiles quand le plafond est presque atteint).
      const plafondUsd = await plafondRestantVideosFa(dep.videoId, await debutVersion());
      const controler: DependancesVideosV4["controler"] =
        dep.controleVideo ??
        (async ({ image, consigne }) => {
          const { executerRolePourVideo } = await import("./depense-claude-video");
          const octets = await readFile(image);
          // Plafond propre « favid » : l'enveloppe commence au début de CETTE version (le travail), pas à la création de la vidéo.
          const r = await executerRolePourVideo(dep.videoId, roleControleVideoV4(), { contexte: {}, variable: consigne, images: [{ type: "image/jpeg", base64: octets.toString("base64"), legende: "Planche de trois images du passage retenu" }] }, { etape: `${PREFIXE_ETAPE_VIDEOS_FA} contrôle`, plafondPropre: plafondVideosFa(await debutVersion()) });
          if (!r.ok) return { ok: false, message: r.message };
          // Claude non relié (simulation) ou réponse vide : refus, jamais une vidéo acceptée sans contrôle.
          if (r.simule || !r.texte) return { ok: false, message: "Claude n'est pas relié au studio." };
          return { ok: true, texte: r.texte, coutUsd: r.coutUsd };
        });
      return fournirVideosV4({ videoId: dep.videoId, plan, mots }, { chercherVideos: chercherVideosServeur(cles), preparation, cleClip: (nom) => cleFA(`videos/${nom}`), controler, plafondUsd });
    },
    async rendre({ idRendu, priseCle, plan, gardes, recadrage, videos }) {
      const sortieCle = cleFA(`${idRendu}.mp4`);
      const vignetteCle = cleFA(`${idRendu}.jpg`);
      const demande = demandeRenduV4({
        idRendu,
        prise: await signerLecture(priseCle),
        plan,
        gardes,
        sortie: { urlDepot: await signerDepot(sortieCle, "video/mp4"), cle: sortieCle },
        vignette: { urlDepot: await signerDepot(vignetteCle, "image/jpeg"), cle: vignetteCle },
        ...(recadrage ? { recadrage } : {}),
        ...(videos?.length ? { videos: await Promise.all(videos.map(async (v) => ({ nom: v.nom, url: await signerLecture(v.cle) }))) } : {}),
      });
      const e = await client.suivreRendu(rendu, demande);
      if (e.statut === "termine") {
        const m = e.mesures ?? {};
        return { cle: e.sortieCle || sortieCle, vignetteCle, dureeSec: Number(m.dureeSec) || plan.duree, taille: Number(m.taille) || 0 };
      }
      if (e.statut === "echec") throw new ErreurChaineV4("Le montage de la vidéo n'a pas abouti. Vous pouvez réessayer.", e.erreur.reessayable, e.erreur.message);
      throw new EnCoursChaineV4("Le montage");
    },
  };
}

// Raccord du moteur : la boucle de fond charge ce fichier pour son effet.
brancherServicesFacecamAnimee({ outils: async (commande: CommandeFabrication, travailId: string) => outilsFacecamAnimee({ videoId: commande.videoId, travailId }) });

/* ------------------------------------------------------------------ */
/* 2. Écran de dépôt (Will seul : page joignable par son adresse)        */
/* ------------------------------------------------------------------ */

export const PHRASES_FA = Object.freeze({
  fichier: "Ce fichier n'est pas arrivé. Envoyez-le à nouveau.",
  pasUneVideo: "Déposez une vidéo (MP4 ou MOV, filmée à l'iPhone).",
  tropCourte: "Cette vidéo est trop courte (moins de 5 secondes).",
  sansAccord: "« Face caméra animée » est en essai : donnez votre accord d'essai réel pour lancer une vraie vidéo.",
});

export interface DemandeDepotFA {
  fichierId: string;
  /** Durée lue par le navigateur (secondes). */
  dureeSec: number;
  titre?: string;
  /** Le texte que Will a dit (facultatif, collé). */
  texte?: string;
  /** Accord d'essai réel coché sur l'écran (tant que le format est masqué). */
  accordEssai?: boolean;
  /** « Refaire quand même » : le choix et le jeton du refus « prise déjà traitée », renvoyés tels quels. */
  sujet?: { choix: "refaire" | "nouvel-angle"; jeton: string };
}

/** Prise déjà traitée (lot L7) : rien n'est créé ni lancé ; l'écran propose « Choisir une autre prise » ou « Refaire quand même ». */
export interface RefusSujetFA {
  statut: "sujet-deja-traite";
  niveau: NiveauSujet;
  precedents: Precedent[];
  jeton: string;
  /** La confirmation reçue ne correspond plus aux vidéos d'aujourd'hui : redemander. */
  jetonPerime?: boolean;
  /** Nom de la prise refusée (pour la nommer dans un envoi groupé). */
  nom: string;
  phrase: string;
}

export type IssueDepotFA = { statut: "lancee"; videoId: Id; avertissement?: { niveau: NiveauSujet; precedents: Precedent[] } } | RefusSujetFA | { statut: "refusee"; phrase: string };

/** Générateur du contrôle « sujet déjà traité ». */
export const GENERATEUR_SUJET_FA = "facecam-animee";
export const PHRASE_PRISE_DEJA_TRAITEE = "Cette vidéo filmée est déjà traitée.";

/** Candidat du contrôle pour une prise : empreinte, nom + taille et références du fichier ; le texte n'est pas utilisé. PUR. */
export function candidatPriseFA(f: { id: string; cleStockage: string; nom: string; taille?: number; sha256?: string }): CandidatSujet {
  const cles = [...clesFichier({ ...(f.sha256 ? { sha256: f.sha256 } : {}), nom: f.nom, ...(typeof f.taille === "number" ? { taille: f.taille } : {}) }), cleFichierRef(f.id), cleFichierRef(f.cleStockage)];
  return { generateur: GENERATEUR_SUJET_FA, cles: [...new Set(cles)] };
}

/** La confirmation reçue de l'écran (donnée non sûre) : un choix connu et un jeton, sinon rien. */
export function confirmationPropreFA(brut: unknown): Confirmation | undefined {
  const b = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  return (b.choix === "refaire" || b.choix === "nouvel-angle") && typeof b.jeton === "string" && b.jeton ? { choix: b.choix, jeton: b.jeton } : undefined;
}

/** Un seul dépôt à la fois : le contrôle « déjà traité » et le lancement qui suit ne s'entrecroisent pas (double clic, deux onglets). */
const verrouDepotUniqueFA = creerVerrou();

/** Ce que le dépôt lit du studio (doubles dans les tests). */
export interface DependancesDepotFA {
  fichier?: (fichierId: string) => Promise<Pick<Fichier, "id" | "cleStockage" | "mime" | "nom" | "taille" | "sha256">>;
  /** Rend la prise AVEC son empreinte sha256 (copie renommée reconnue) ; échec = dépôt refusé. Défaut : `empreinteAvantControle`. */
  empreinte?: <T extends Pick<Fichier, "id" | "cleStockage" | "sha256">>(f: T) => Promise<T>;
  /** Tests : stockage et délais de l'empreinte par défaut. */
  optionsEmpreinte?: DependancesAvantControle;
  accordEssai?: () => Promise<boolean>;
  enregistrerAccord?: () => Promise<void>;
  brouillon?: (e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown>; texte?: string }) => Promise<{ id: Id }>;
  lancer?: (videoId: Id) => Promise<{ travailId: Id }>;
  abandonner?: (videoId: Id) => Promise<void>;
  /** Sources du contrôle « prise déjà traitée » (tests : de faux dépôts) ; par défaut les dépôts du studio. */
  sourcesSujets?: SourcesSujets;
}

/** Destination de l'envoi de la prise (dossier des entrées du studio). */
export const CIBLE_DEPOT_FA = Object.freeze({ typeEntite: "entree", entiteId: "facecam-animee" });

/**
 * La prise est-elle une vidéo MP4 / MOV ? Le type donné par le navigateur, sinon l'extension, casse ignorée (.MOV, .mov, .MP4 : un
 * navigateur peut n'envoyer aucun type, ou « octets », pour un .MOV). PUR.
 */
export function estPriseVideoFA(f: Pick<Fichier, "mime" | "nom">): boolean {
  const mime = (f.mime ?? "").toLowerCase();
  if (/^video\/(mp4|quicktime|x-m4v)$/.test(mime)) return true;
  return (mime === "" || mime === "application/octet-stream" || mime.startsWith("video/")) && /\.(mp4|mov|m4v)$/i.test(f.nom ?? "");
}

/** Entrées de la commande pour une prise déposée. PUR. */
export function entreesDuDepotFA(fichier: Pick<Fichier, "id" | "cleStockage">, d: Pick<DemandeDepotFA, "dureeSec" | "texte">, accordEssaiReel: boolean): Record<string, unknown> {
  const texte = d.texte?.trim().slice(0, 20_000);
  return { facecamAnimee: { priseCle: fichier.cleStockage, fichierId: fichier.id, dureePriseSec: Math.round(Number(d.dureeSec) * 1000) / 1000, ...(texte ? { texteValide: texte } : {}), accordEssaiReel } };
}

async function fichierParDefaut(fichierId: string) {
  const { fichierEnvoye } = await import("./fichiers");
  return fichierEnvoye(fichierId, CIBLE_DEPOT_FA.typeEntite, CIBLE_DEPOT_FA.entiteId);
}

async function brouillonParDefaut(e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown>; texte?: string }) {
  const [{ nouveauBrouillonFormat }, { enregistrerScriptDuBrouillon }] = await Promise.all([import("./creation-format"), import("./videos")]);
  const video = await nouveauBrouillonFormat({ formatId: ID_FORMAT_FACECAM_ANIMEE, titre: e.titre, sujet: e.sujet, distribution: e.distribution, entrees: e.entrees });
  // Le lancement commun exige un script rattaché : le texte dit (s'il est donné), sinon un bloc vide ; le moteur ne le lit pas.
  await enregistrerScriptDuBrouillon(video.id, [{ id: `${video.id}-b1`, blocRecette: "corps", segments: [{ id: `${video.id}-s1`, texte: e.texte ?? "" }] }]);
  return video;
}

async function lancerParDefaut(videoId: Id) {
  const { lancerFabrication } = await import("./fabrication");
  // Format sans prix : l'accord est donné d'office par le lancement commun (`accordDuFormat`).
  return lancerFabrication(videoId);
}

async function abandonnerParDefaut(videoId: Id) {
  const { abandonnerBrouillon } = await import("./videos");
  await abandonnerBrouillon(videoId);
}

/** État de l'écran : l'accord d'essai déjà donné ou non. */
export async function etatDepotFacecamAnimee(dep: Pick<DependancesDepotFA, "accordEssai"> = {}): Promise<{ accordEssai: boolean }> {
  await exigerSession();
  const accord = await (dep.accordEssai ?? (() => lireParametre<boolean>(PARAM_ACCORD_ESSAI_FA, false)))().catch(() => false);
  return { accordEssai: accord === true };
}

/** « Animer ma vidéo » : la prise déposée devient une vidéo du format, lancée tout de suite (aucun prix, aucun Drive). */
export async function deposerFacecamAnimee(d: DemandeDepotFA, dep: DependancesDepotFA = {}): Promise<IssueDepotFA> {
  await exigerSession();
  let fichier: Awaited<ReturnType<NonNullable<DependancesDepotFA["fichier"]>>>;
  try {
    fichier = await (dep.fichier ?? fichierParDefaut)(d.fichierId);
  } catch (e) {
    return { statut: "refusee", phrase: e instanceof ErreurStudio ? e.message : PHRASES_FA.fichier };
  }
  if (!estPriseVideoFA(fichier)) return { statut: "refusee", phrase: PHRASES_FA.pasUneVideo };
  if (!(Number(d.dureeSec) >= 5)) return { statut: "refusee", phrase: PHRASES_FA.tropCourte };
  let accord = await (dep.accordEssai ?? (() => lireParametre<boolean>(PARAM_ACCORD_ESSAI_FA, false)))();
  if (accord !== true && d.accordEssai === true) {
    // Accord donné sur l'écran : gardé (réglage), comme pour « Image → vidéo ».
    await (dep.enregistrerAccord ?? (() => ecrireParametre(PARAM_ACCORD_ESSAI_FA, true)))();
    accord = true;
  }
  if (accord !== true) return { statut: "refusee", phrase: PHRASES_FA.sansAccord };
  // Empreinte du contenu AVANT le contrôle « prise déjà traitée » et hors de tout verrou : une copie renommée est reconnue. Échec : rien n'est créé.
  // Garde « éteint » : aucune lecture du stockage, exactement comme avant.
  const { lireGardeSujets } = await import("./sujets-traites");
  if ((await lireGardeSujets(dep.sourcesSujets)) !== "eteint") {
    try {
      fichier = await (dep.empreinte ?? ((f) => empreinteAvantControle(f, dep.optionsEmpreinte)))(fichier);
    } catch (e) {
      console.error("[empreinte] dépôt face caméra animée", e);
      return { statut: "refusee", phrase: phraseRefusEmpreinte(e) };
    }
  }
  return verrouDepotUniqueFA<IssueDepotFA>(async () => {
    // Prise déjà traitée (lot L7) : SEULEMENT pour un nouveau dépôt (ce chemin n'est jamais une reprise), AVANT le brouillon et le
    // lancement. Un refus ne crée rien. Une vidéo en échec ne compte pas au registre : redéposer la prise reste libre.
    const { verifierSujet } = await import("./sujets-traites");
    const v = await verifierSujet(candidatPriseFA(fichier), confirmationPropreFA(d.sujet), dep.sourcesSujets);
    if (!v.ok) {
      const { niveau, precedents, jeton, jetonPerime } = v;
      return { statut: "sujet-deja-traite" as const, niveau, precedents, jeton, ...(jetonPerime ? { jetonPerime: true as const } : {}), nom: fichier.nom, phrase: PHRASE_PRISE_DEJA_TRAITEE };
    }
    const avertissement = v.avertissement;
    const choixForce = v.confirme;
    const titre = (d.titre?.trim() || fichier.nom.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[-_]+/g, " ").trim() || "Face caméra animée").slice(0, 80);
    // Will se filme : sa voix, son visage, la prise (jamais d'avatar).
    const distribution: Distribution[] = [{ role: "Face caméra", source: "rush" }];
    const video = await (dep.brouillon ?? brouillonParDefaut)({ titre, sujet: titre, distribution, entrees: entreesDuDepotFA(fichier, d, true), texte: d.texte?.trim() || undefined });
    try {
      await (dep.lancer ?? lancerParDefaut)(video.id);
    } catch (e) {
      await (dep.abandonner ?? abandonnerParDefaut)(video.id).catch(() => undefined);
      if (e instanceof ErreurStudio) return { statut: "refusee", phrase: e.message };
      throw e;
    }
    await journaliser("video", "Vidéo filmée déposée : « Face caméra animée » lancée", { type: "video", id: video.id }).catch(() => undefined);
    // Choix forcé (« Refaire quand même ») : la trace reste dans le journal.
    if (choixForce) await journaliser("video", `Face caméra animée : prise déjà traitée, dépôt voulu quand même (choix « ${choixForce} »)`, { type: "video", id: video.id }).catch(() => undefined);
    return { statut: "lancee", videoId: video.id, ...(avertissement ? { avertissement } : {}) };
  });
}

/** Nombre de prises au plus par envoi groupé (« Animer mes N vidéos »). */
export const PRISES_MAX_LOT_FA = 20;

export type IssueLotFA = { fichierId: string } & IssueDepotFA;

/**
 * « Animer mes N vidéos » (demande de Will, 17/10) : chaque prise déposée devient une vidéo distincte, lancée dans la FILE de fabrication
 * du studio (la boucle de fond respecte sa concurrence : aucune vidéo n'est fabriquée en double ni perdue). Une prise refusée n'empêche
 * pas les autres ; l'accord d'essai, donné une fois, vaut pour tout le lot. Une même prise (même fichier) n'est lancée qu'une fois.
 */
export async function deposerFacecamAnimeeLot(demandes: DemandeDepotFA[], dep: DependancesDepotFA = {}): Promise<{ issues: IssueLotFA[]; phraseSautees?: string }> {
  await exigerSession();
  if (!Array.isArray(demandes) || !demandes.length) return { issues: [] };
  if (demandes.length > PRISES_MAX_LOT_FA) throw new ErreurStudio("LOT_TROP_GRAND", `Déposez au plus ${PRISES_MAX_LOT_FA} vidéos à la fois.`);
  const vus = new Set<string>();
  const issues: IssueLotFA[] = [];
  // Une à une : chaque vidéo est enregistrée puis mise en file avant la suivante (l'ordre de Will est l'ordre de fabrication).
  // Dès qu'une prise répond « vérification en cours » (fichier très lourd), les suivantes sont refusées avec la même phrase SANS attendre :
  // jamais 20 attentes de 60 s dans une seule requête. Rien n'est créé pour elles ; l'essai suivant les trouve calculées.
  let verificationEnCours = false;
  for (const d of demandes) {
    const fichierId = String(d?.fichierId ?? "");
    if (vus.has(fichierId)) continue;
    vus.add(fichierId);
    if (verificationEnCours) {
      issues.push({ fichierId, statut: "refusee", phrase: PHRASE_VERIFICATION_EN_COURS });
      continue;
    }
    try {
      const issue = await deposerFacecamAnimee(d, dep);
      if (issue.statut === "refusee" && issue.phrase === PHRASE_VERIFICATION_EN_COURS) verificationEnCours = true;
      issues.push({ fichierId, ...issue });
    } catch (e) {
      // Rien de perdu : la prise refusée reste sur l'écran avec sa phrase, les autres partent.
      issues.push({ fichierId, statut: "refusee", phrase: e instanceof ErreurStudio ? e.message : "Cette vidéo n'a pas pu être lancée. Réessayez." });
    }
  }
  // Prises déjà traitées : sautées (jamais le lot entier bloqué), nommées en une phrase ; les autres sont parties.
  const sautees = issues.flatMap((i) => (i.statut === "sujet-deja-traite" ? [i.nom] : []));
  const parties = issues.filter((i) => i.statut === "lancee").length;
  return { issues, ...(sautees.length ? { phraseSautees: phrasePrisesSautees(sautees, parties) } : {}) };
}

/* ------------------------------------------------------------------ */
/* 3. Reprendre un script validé (lecture seule)                         */
/* ------------------------------------------------------------------ */

// La borne et la coupe du texte dit sont pures : elles vivent avec l'écran (importées des deux côtés).
export { TEXTE_DIT_MAX_FA, texteDitDuScript };
export const PHRASE_SCRIPT_INTROUVABLE_FA = "Ce script n'est plus disponible parmi les scripts validés.";

export interface ScriptValideFA {
  id: Id;
  sujet: string;
  apercu: string;
  dureeEstimeeSec: number;
}

/** Les scripts VALIDÉS du format, du plus récent au plus ancien. Lecture seule : rien n'est modifié. */
export async function scriptsValidesFacecamAnimee(): Promise<ScriptValideFA[]> {
  await exigerSession();
  const liste = await listerScripts({ formatId: ID_FORMAT_FACECAM_ANIMEE });
  // Un script validé sans aucun texte (ex. posé par une prise sans texte dit) n'aide personne : on ne le propose pas.
  return liste.filter((s) => s.statutEditorial === "valide" && s.apercu.trim() !== "").map((s) => ({ id: s.id, sujet: s.sujet, apercu: s.apercu, dureeEstimeeSec: s.dureeEstimeeSec }));
}

/** Le texte d'un script validé de ce format (rien d'autre : un brouillon ou le script d'un autre format est refusé). */
export async function texteDuScriptValideFA(id: Id): Promise<{ texte: string; tronque: boolean }> {
  await exigerSession();
  const s = await obtenirScript(id);
  if (!s || s.formatId !== ID_FORMAT_FACECAM_ANIMEE || s.statutEditorial !== "valide") throw new ErreurStudio("SCRIPT_INTROUVABLE", PHRASE_SCRIPT_INTROUVABLE_FA);
  const r = texteDitDuScript(texteScript(s.blocs));
  if (!r.texte) throw new ErreurStudio("SCRIPT_INTROUVABLE", PHRASE_SCRIPT_INTROUVABLE_FA);
  return r;
}

/* ------------------------------------------------------------------ */
/* 4. Coût : estimation honnête avant, vrai coût après                   */
/* ------------------------------------------------------------------ */

export interface PriseAEstimerFA {
  dureeSec: number;
  /** Nombre de mots du texte dit, s'il est donné. */
  motsTexte?: number;
}

export interface EstimationFA {
  /** Par vidéo (la plus chère des prises) puis pour tout le lot, en centimes d'euro, arrondis au centime SUPÉRIEUR. */
  unEssaiCentimesEur: number;
  pireCasCentimesEur: number;
  pireCasLotCentimesEur: number;
  /** Plafond Claude d'une vidéo (dollars) et son équivalent en centimes d'euro. */
  plafondUsd: number;
  plafondCentimesEur: number;
  essaisMax: number;
  /** Essais de plus si aucune vidéo fidèle n'est trouvée (repli « sans vidéo », une seule fois). */
  essaisRepliMax: number;
  videos: number;
  /** Rendu et voix : sur le serveur du studio et la voix de Will, 0 €. */
  renduCentimesEur: 0;
  voixCentimesEur: 0;
}

/** Plafond Claude d'une vidéo (réglage, sinon 4 $). */
export async function plafondClaudeFaUsd(): Promise<number> {
  const v = await lireParametre<number>(PARAM_PLAFOND_CLAUDE_FA, PLAFOND_CLAUDE_FA_USD);
  return Number.isFinite(v) && v >= 0 ? v : PLAFOND_CLAUDE_FA_USD;
}

/** Assemble l'estimation d'un lot de prises. PUR : le pire cas est celui de la prise la plus chère, jamais en dessous du réel. */
export function estimationDuLot(prises: PriseAEstimerFA[], plafondUsd: number, tauxUsdEur: number): EstimationFA {
  const e: EstimationOpusV4[] = prises.map((p) => estimerOpusV4({ dureeSec: p.dureeSec, motsTexte: p.motsTexte, plafondUsd }));
  const eur = (usd: number) => Math.ceil(usd * tauxUsdEur * 100 - 1e-9);
  const plusChere = e.reduce((m, x) => (x.engageMaxUsd > m.engageMaxUsd ? x : m), e[0] ?? estimerOpusV4({ dureeSec: 0, plafondUsd }));
  return {
    unEssaiCentimesEur: eur(Math.min(plusChere.unEssaiUsd, plafondUsd)),
    pireCasCentimesEur: eur(plusChere.engageMaxUsd),
    pireCasLotCentimesEur: e.reduce((t, x) => t + eur(x.engageMaxUsd), 0),
    plafondUsd,
    plafondCentimesEur: eur(plafondUsd),
    essaisMax: plusChere.essaisMax,
    essaisRepliMax: plusChere.essaisRepliMax,
    videos: prises.length,
    renduCentimesEur: 0,
    voixCentimesEur: 0,
  };
}

/** Estimation affichée avant « Animer ma vidéo ». Lecture seule. */
export async function estimerFacecamAnimee(prises: PriseAEstimerFA[]): Promise<EstimationFA> {
  await exigerSession();
  const liste = (Array.isArray(prises) ? prises : []).slice(0, PRISES_MAX_LOT_FA).map((p) => ({ dureeSec: Number(p?.dureeSec) || 0, motsTexte: Number(p?.motsTexte) || 0 }));
  const { taux } = await import("./generation-claude");
  return estimationDuLot(liste, await plafondClaudeFaUsd(), await taux());
}

/** Ce qui a VRAIMENT été payé pour une vidéo (dépenses enregistrées, hors montants simulés), en centimes d'euro. */
export async function coutReelVideoFA(videoId: Id): Promise<number> {
  const { depenseComptee, montantPaye } = await import("./couts");
  const depenses = await depots().depenses.lister((x) => x.videoId === videoId);
  return depenses.filter(depenseComptee).reduce((t, x) => t + montantPaye(x).centimes, 0);
}

/** Les dernières vidéos du format (pour y revenir), avec l'état de leur fabrication. */
export async function dernieresFacecamAnimee(max = 6): Promise<{ videoId: Id; titre: string; statut: string; etape?: string; phrase?: string; payeCentimesEur: number }[]> {
  await exigerSession();
  const d = depots();
  const videos = (await d.videos.lister((v) => v.formatId === ID_FORMAT_FACECAM_ANIMEE && v.statut !== "archivee")).sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? "")).slice(0, max);
  const travaux = (await d.travaux.lister((t) => t.fournisseurUtilise === ID_MOTEUR_FACECAM_ANIMEE)) as Travail[];
  const payes = await Promise.all(videos.map((v) => coutReelVideoFA(v.id)));
  return videos.map((v, i) => {
    const t = travaux.filter((x) => x.cibleId === v.id).sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
    const etat = lireEtatV4(t?.parametres?.facecamAnimeeV4);
    return { videoId: v.id, titre: v.titre, payeCentimesEur: payes[i], statut: t?.statut ?? v.statut, ...(etat ? { etape: etat.etape } : {}), ...(t?.erreur?.messagePourWill ? { phrase: t.erreur.messagePourWill } : etat?.realisation?.phrase ? { phrase: etat.realisation.phrase } : {}) };
  });
}

/** Lecture des entrées d'une vidéo (pour l'écran). */
export { lireEntreesFacecamAnimee };
