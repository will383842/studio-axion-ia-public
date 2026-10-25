/**
 * OUTILS RÉELS DU FORMAT « IMAGE → VIDÉO » (lot L15) : ce que les services branchent sur la machine pure
 * `moteurs/montage-image-video/fabrication.ts` (qui n'importe jamais un service). Partagés par le moteur du studio
 * (`brancherServicesImageVideo`, chargé pour son effet par la boucle de fond une fois les raccords du lot L17 posés) et
 * par le lanceur `scripts/image-video/fabriquer.ts` (l'image du studio ne contient pas `scripts/`).
 *
 * ARGENT (une seule réservation par appel) :
 *  - la CAISSE de la machine compte d'abord le pire coût de chaque appel contre le plafond de la vidéo ;
 *  - Claude (lecture, écriture, relecture finale) : `budget.reserver` ne fait qu'un PRÉ-VOL (budget du studio, crédits),
 *    car `executerRolePourVideo` réserve lui-même l'appel, sous le verrou du mois, sur un plafond PROPRE au format
 *    (réglage `imageVideo.plafondClaudeUsd`) : jamais deux réservations pour un appel ;
 *  - voix HeyGen : `verifierEtReserver` (chaîne unique du studio), au nom de la vidéo et du travail, juste avant chaque
 *    lecture payée ; tarif au caractère MAJORÉ au taux prudent (jamais moins d'1 € pour 1 $) ;
 *  - transcription (serveur du studio) : pré-vol seulement.
 * RENDU du fichier final : `image-video-rendu.ts` (scènes par l'opération `composition` existante, puis composition
 * `complet` voix + bruitages + sous-titres, comme le cas concret) ; aucune opération nouvelle, aucun coût réservé (le
 * serveur de rendu est celui du studio). Images noires ou figées et empreinte du fichier : FFmpeg local.
 * PIÈCE PAS ENCORE BRANCHABLE (refus clair, jamais un faux succès) :
 *  - la MISE EN PAGE des instants clés (Q21) : elle lit `studio-rendu/…/emprise.ts`, que `src/` ne peut pas importer.
 * Conversion de l'image en PNG et tuiles : FFmpeg local s'il est installé (comme `facecam-branchements`), sinon refus.
 */
import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandeFabrication, Id, LigneCout, MotHorodate } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { BRUITAGES_V4_IV, historiqueVarieteIV, RenduEnCoursIV, tarifVoixCentimesEur, type DemandeDepenseIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import type { ConvertirEnPng } from "@/moteurs/montage-image-video/lecture/preparation";
import type { ReponseAppelLecture } from "@/moteurs/montage-image-video/lecture";
import { brancherServicesImageVideo, lireEntreesImageVideo } from "@/moteurs/montage-image-video";
import { PLAFOND_VIDEO_IV_CENTIMES } from "@/moteurs/montage-image-video/fabrication";
import { signalerDepassementIndicatif } from "./budget-mensuel";
import { accordAutomatique, budgetIndicatifPour, FACTEUR_SECURITE_BUDGET, sujetDeCloche } from "./mode-budget";
import { argumentsMorceau, argumentsSonWav, type PassageFigeIV } from "@/moteurs/montage-image-video/commandes-ffmpeg";

/* ------------------------------------------------------------------ */
/* Phrases et réglages                                                   */
/* ------------------------------------------------------------------ */

export const STUDIO_NON_RELIE_IV = "Le studio n'est pas relié (stockage, voix, Claude ou serveur de rendu) : rien n'a été dépensé.";
export const CONVERSION_IMPOSSIBLE_IV = "FFmpeg est absent de ce serveur : l'image ne peut pas être découpée pour la lecture.";

/** Plafond Claude propre au format, par vidéo (lecture, écriture, relecture finale), en dollars. */
export const PARAM_PLAFOND_CLAUDE_IV = "imageVideo.plafondClaudeUsd";
/** Préfixe des étapes de dépense Claude du format (plafond propre de `executerRolePourVideo`). */
export const PREFIXE_ETAPE_IV = "Image → vidéo ·";
/**
 * Cartes validées par Will (réglage du studio) : la LISTE des vidéos dont la carte a été validée, chacune comptée une
 * seule fois ; au-delà de 10, le réglage `validationCarte` s'applique (B6). Un ancien nombre est lu tel quel.
 */
export const PARAM_CARTES_VALIDEES = "imageVideo.cartesValidees";

/** Nombre de cartes validées d'après le réglage gardé (liste de vidéos, ou ancien nombre). PUR. */
export function nombreCartesValidees(garde: unknown): number {
  if (Array.isArray(garde)) return new Set(garde.filter((x) => typeof x === "string")).size;
  const n = Math.floor(Number(garde));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Le réglage après la validation de la carte d'une vidéo (PUR) : la vidéo est ajoutée une seule fois ; déjà comptée
 * (deux clics, revalidation après une reprise) : `null`, rien ne change. Un ancien nombre ne se convertit pas en
 * liste : il est gardé et la vidéo n'est pas recomptée sans pouvoir le vérifier.
 */
export function avecCarteValidee(garde: unknown, videoId: string): string[] | null {
  const liste = Array.isArray(garde) ? garde.filter((x): x is string => typeof x === "string") : [];
  if (!Array.isArray(garde) && nombreCartesValidees(garde) > 0) return null;
  return liste.includes(videoId) ? null : [...liste, videoId];
}
/** Décisions de Will en attente, par vidéo (`imageVideo.decisions.<videoId>`). */
export const PREFIXE_DECISIONS = "imageVideo.decisions.";

const ETAPES_CLAUDE: Readonly<Record<string, string>> = { lecture: `${PREFIXE_ETAPE_IV} lecture`, ecriture: `${PREFIXE_ETAPE_IV} écriture`, relecture: `${PREFIXE_ETAPE_IV} relecture` };

/* ------------------------------------------------------------------ */
/* Pièces pures                                                          */
/* ------------------------------------------------------------------ */

type ResultatAppelVideo = { ok: true; simule: boolean; donnees?: unknown; texte?: string; stopReason?: string | null; invalide?: string; coutUsd?: number } | { ok: false; arret: string; message: string };

/** Réponse du chemin de dépense, sous la forme lue par la lecture, l'écriture et la relecture (PUR). */
export function reponseAppelIV(r: ResultatAppelVideo): ReponseAppelLecture {
  if (!r.ok) return { ok: false, arret: r.arret, message: r.message };
  return {
    ok: true,
    simule: r.simule,
    ...(r.donnees !== undefined ? { donnees: r.donnees } : {}),
    ...(typeof r.texte === "string" ? { texte: r.texte } : {}),
    ...(r.stopReason !== undefined ? { stopReason: r.stopReason } : {}),
    ...(r.invalide ? { invalide: r.invalide } : {}),
    ...(typeof r.coutUsd === "number" ? { coutUsd: r.coutUsd } : {}),
  };
}

/** Lignes de coût d'une dépense sur le point de partir (pire coût, centimes d'euro), pour le pré-vol ou la réservation (PUR). */
export function lignesDeDepense(d: DemandeDepenseIV): LigneCout[] {
  const total = { centimes: d.centimes, devise: "EUR" as const };
  const quantite = d.fournisseur === "heygen" ? Math.max(1, d.caracteres ?? 1) : 1;
  return [{ etape: d.fournisseur === "anthropic" ? (ETAPES_CLAUDE[d.etape] ?? `${PREFIXE_ETAPE_IV} ${d.etape}`) : d.etape, fournisseur: d.fournisseur, unite: d.fournisseur === "heygen" ? "caractere" : "appel", quantite, prixUnitaire: { centimes: Math.ceil(d.centimes / quantite), devise: "EUR" }, total, nature: "estime" }];
}

/** Arguments d'un morceau : module pur `commandes-ffmpeg` (copié dans l'image du studio, exécuté avant mise en ligne). */
export { argumentsMorceau } from "@/moteurs/montage-image-video/commandes-ffmpeg";

/** Conversion de l'image entière et des 4 tuiles en PNG par FFmpeg local ; FFmpeg absent : refus (la lecture le dit). */
export const convertirParFfmpeg: ConvertirEnPng = async (d) => {
  const dossier = await mkdtemp(join(tmpdir(), "iv-image-"));
  try {
    const entree = join(dossier, `source.${d.format === "jpeg" ? "jpg" : d.format}`);
    await writeFile(entree, d.octets);
    const sorties: Uint8Array[] = [];
    for (const m of d.morceaux) {
      sorties.push(
        await new Promise<Uint8Array>((ok, ko) =>
          execFile("ffmpeg", argumentsMorceau(entree, m), { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, timeout: 60_000 }, (e, sortie) => (e ? ko((e as NodeJS.ErrnoException).code === "ENOENT" ? new Error(CONVERSION_IMPOSSIBLE_IV) : e) : ok(new Uint8Array(sortie)))),
        ),
      );
    }
    return sorties;
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
};

/**
 * Son brut (copie HeyGen, MP3) → WAV PCM mono à sa fréquence, par FFmpeg local (15/10, v-dd3049053f88 : l'assemblage
 * refusait le MP3, Q17). Même FFmpeg statique que `studio-rendu` : les silences mesurés sont sur l'horloge des coupes.
 */
export async function convertirSonEnWavParFfmpeg(octets: Uint8Array): Promise<Uint8Array> {
  const dossier = await mkdtemp(join(tmpdir(), "iv-son-"));
  try {
    const entree = join(dossier, "brut");
    const sortie = join(dossier, "brut.wav");
    await writeFile(entree, octets);
    await new Promise<void>((ok, ko) =>
      execFile("ffmpeg", argumentsSonWav(entree, sortie), { maxBuffer: 16 * 1024 * 1024, timeout: 5 * 60_000 }, (e) => (e ? ko((e as NodeJS.ErrnoException).code === "ENOENT" ? new Error("FFmpeg est absent du studio : le son ne peut pas être converti en WAV.") : e) : ok())),
    );
    return new Uint8Array(await readFile(sortie));
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

/** Images noires et figées d'un fichier vidéo, par FFmpeg local (journal lu par `lireNoirEtFige`) ; FFmpeg absent : rien. */
export async function mesurerNoirEtFigeParFfmpeg(octets: Uint8Array, dureeSec: number): Promise<{ noirMaxSec: number; figeMaxSec: number; figes: PassageFigeIV[] } | null> {
  const { argumentsNoirEtFige, lireNoirEtFige, lirePassagesFiges } = await import("./image-video-rendu");
  const dossier = await mkdtemp(join(tmpdir(), "iv-final-"));
  try {
    const entree = join(dossier, "final.mp4");
    await writeFile(entree, octets);
    const journal = await new Promise<string | null>((ok, ko) =>
      execFile("ffmpeg", argumentsNoirEtFige(entree), { maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60_000 }, (e, _sortie, erreurs) => {
        if (e && (e as NodeJS.ErrnoException).code === "ENOENT") ok(null);
        else if (e) ko(e);
        else ok(String(erreurs));
      }),
    );
    // Passages figés gardés : jugés avec la voix de la ligne (décision de Will du 17/10).
    return journal === null ? null : { ...lireNoirEtFige(journal, dureeSec), figes: lirePassagesFiges(journal, dureeSec) };
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

/** Lit un fichier EN ENTIER par une adresse signée (`null` : illisible, vide ou trop gros). */
export async function lireOctets(adresse: string, max = 32 * 1024 * 1024, appeler: typeof fetch = fetch): Promise<Uint8Array | null> {
  try {
    const r = await appeler(adresse, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    const annonce = Number(r.headers.get("content-length"));
    if (Number.isFinite(annonce) && annonce > max) return null;
    const o = new Uint8Array(await r.arrayBuffer());
    return o.byteLength && o.byteLength <= max ? o : null;
  } catch {
    return null;
  }
}

/** Un passage sur un rendu : soumis s'il est inconnu ; fini : son état ; pas fini : attente ; raté : erreur. */
export async function relireRenduIV(service: ServiceRendu, demande: DemandeRendu, quoi: string): Promise<Extract<EtatRendu, { statut: "termine" }>> {
  const { ErreurRendu, suivreRendu } = await import("@/fournisseurs/rendu/client");
  const e = await suivreRendu(service, demande);
  if (e.statut === "termine") return e;
  if (e.statut === "echec") throw new ErreurRendu(e.erreur);
  throw new RenduEnCoursIV(quoi);
}

/* ------------------------------------------------------------------ */
/* Les outils réels                                                      */
/* ------------------------------------------------------------------ */

export interface DependancesOutilsIV {
  videoId: Id;
  /** Identifiant du travail (réservations de la voix). */
  travailId: Id;
  /** Plafond Claude propre du format pour cette vidéo, en dollars (défaut : le plafond de la vidéo). */
  plafondClaudeUsd?: number;
  /** Production : un fournisseur simulé y est refusé (défaut : `NODE_ENV`). */
  production?: boolean;
  /** Lecture de l'image source (défaut : le stockage, par sa clé). Le lanceur lit un fichier local. */
  lireImageSource?: (cle: string) => Promise<Uint8Array | null>;
  /** Conversion PNG (défaut : FFmpeg local). */
  convertir?: ConvertirEnPng;
  /** Décisions de Will (défaut : celles gardées par le studio). */
  decisions?: OutilsFabricationIV["decisions"];
  /** Compteur des cartes validées (défaut : le réglage du studio). */
  cartesValidees?: () => Promise<number>;
  /** Recettes de variété des dernières vidéos IV prêtes (défaut : lues dans les travaux gardés). */
  historiqueVariete?: OutilsFabricationIV["historiqueVariete"];
  /**
   * Fabrication menée par le LANCEUR : aucun « Réessayer » ne garde l'accord du prix ; la décision du script ne compte
   * que si elle porte l'accord de Will (`accordCentimes`, écrit avec elle), et la voix est réservée sur CE montant
   * (jamais un accord fabriqué au coût de la lecture). Sans accord : la voix n'est ni réservée ni payée.
   */
  accordDuScriptExige?: boolean;
  /**
   * Vidéo d'un LOT d'images : prix accordé pour CETTE vidéo (centimes d'euro). C'est le seul accord implicite de sa voix,
   * borné par ce prix : une voix plus chère est refusée (« Ce prix demande votre confirmation »), jamais payée.
   */
  accordLotCentimes?: number;
  /** L3-01 : origine de la commande (`CommandeFabrication.origine`) ; « usine » : voix et Claude sur le budget de l'Usine. */
  origine?: CommandeFabrication["origine"];
}

/** Accord donné à la réservation de la voix : celui du lot s'il y en a un, sinon le coût de la voix lui-même. PUR. */
export function accordDeLaVoixIV(centimesVoix: number, accordLotCentimes?: number): number {
  return accordLotCentimes ?? centimesVoix;
}

/** Prix accordé pour la vidéo d'un lot (`entrees.imageVideo.lot`) ; `undefined` : vidéo seule. PUR. */
export function accordLotDeLaCommandeIV(commande: Pick<CommandeFabrication, "entrees">): number | undefined {
  return lireEntreesImageVideo(commande.entrees).lot?.accordParVideoCentimes;
}

/** Accord du prix porté par une décision de script gardée (centimes d'euro) ; `null` : aucun accord lisible. PUR. */
export function accordDeLaDecision(d: unknown): number | null {
  const a = d && typeof d === "object" ? (d as { accordCentimes?: unknown }).accordCentimes : undefined;
  return typeof a === "number" && Number.isFinite(a) && a >= 0 ? a : null;
}

export const PHRASE_ACCORD_ABSENT_IV = "Le prix de la suite n'a pas été accordé dans le studio : la voix n'est pas payée. Validez le script en confirmant son prix.";

/**
 * Outils RÉELS d'une fabrication (voir l'en-tête). Lève une phrase claire quand rien ne peut partir (studio pas relié en
 * production) : rien n'a été dépensé.
 */
export async function outilsImageVideo(dep: DependancesOutilsIV): Promise<OutilsFabricationIV> {
  const [commun, { resoudreFournisseur }, client, { CENTIMES_USD_PAR_CARACTERE_HEYGEN }, { TAUX_USD_EUR_PAR_DEFAUT }] = await Promise.all([
    import("./_commun"),
    import("@/fournisseurs"),
    import("@/fournisseurs/rendu/client"),
    import("@/fournisseurs/heygen/voix"),
    import("@/lib/montants"),
  ]);
  const { lireParametre } = commun;
  const production = dep.production ?? process.env.NODE_ENV === "production";
  const env = production ? "prod" : "dev";
  const stockage = resoudreFournisseur("stockage") as StockageFichiers;
  const aligneur = resoudreFournisseur("alignement");
  const voix = resoudreFournisseur("voix", "heygen");
  const rendu = client.obtenirServiceRendu();
  const renduSimule = client.renduSimule();
  if (production && (stockage.mode === "simulation" || voix.mode === "simulation" || renduSimule)) throw new Error(STUDIO_NON_RELIE_IV);
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const tarifUsd = voix.capacites.tarifUsd?.unite === "caractere" ? voix.capacites.tarifUsd.centimesUsd : CENTIMES_USD_PAR_CARACTERE_HEYGEN;

  const signerLecture = async (cle: string) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, 3600) : stockage.urlLecture(cle));
  const signerDepot = async (cle: string, mime: string) => {
    if (stockage.urlDepotDuree) return stockage.urlDepotDuree(cle, 3600, mime);
    if (stockage.mode === "simulation") return "";
    throw new Error(STUDIO_NON_RELIE_IV);
  };
  const lireStockage = async (cle: string) => (stockage.mode === "simulation" ? null : lireOctets(await signerLecture(cle)));

  // Claude : le chemin de dépense du studio, sur un plafond propre au format (la réservation de l'appel y est faite).
  const plafondPropre = { id: "ivclaude", parametre: PARAM_PLAFOND_CLAUDE_IV, defautUsd: dep.plafondClaudeUsd ?? 3, prefixeEtape: PREFIXE_ETAPE_IV };
  const appelerClaude = (etape: string) => async (role: DefinitionRole, entree: EntreeRole): Promise<ReponseAppelLecture> => {
    const { executerRolePourVideo } = await import("./depense-claude-video");
    // Le plafond propre a la forme de ceux du tableau ; son identifiant n'est pas dans leur liste (même chemin que le cas concret).
    const r = await executerRolePourVideo(dep.videoId, role, entree, { etape: ETAPES_CLAUDE[etape], plafondPropre, ...(dep.origine ? { origine: dep.origine } : {}) } as unknown as Parameters<typeof executerRolePourVideo>[3]);
    return reponseAppelIV(r as ResultatAppelVideo);
  };

  const decisionsGardees = async () => lireParametre<Record<string, unknown> | null>(`${PREFIXE_DECISIONS}${dep.videoId}`, null);

  // Budget réel, APRÈS la caisse : pré-vol pour Claude et la transcription, réservation pour la voix.
  const indicatifIV = await budgetIndicatifPour(dep.origine);
  const budget: OutilsFabricationIV["budget"] = {
    reserver: async (d) => {
      // Lanceur : la voix ne part que sur l'accord de Will, relu à chaque réservation (avant même le mode simulé).
      let accordVoix: number = d.centimes;
      if (d.fournisseur === "heygen" && dep.accordDuScriptExige) {
        const accord = accordDeLaDecision((await decisionsGardees())?.script);
        // Mode indicatif (ordre du 25/10) : le prix du jour vaut accord, Will ne valide jamais un prix à la main.
        if (accord === null && !indicatifIV) return { ok: false, message: PHRASE_ACCORD_ABSENT_IV };
        accordVoix = accord ?? d.centimes;
      } else if (d.fournisseur === "heygen") accordVoix = accordDeLaVoixIV(d.centimes, dep.accordLotCentimes);
      if (d.fournisseur === "heygen") {
        const auto = await accordAutomatique(accordVoix, d.centimes, { origine: dep.origine, videoId: String(dep.videoId) });
        if (typeof auto === "number") accordVoix = auto;
      }
      const { claudeTextesActif } = await import("./depense-claude-video");
      if (d.fournisseur === "anthropic" && !(await claudeTextesActif())) return { ok: true };
      if (d.fournisseur === "heygen" && voix.mode === "simulation") return { ok: true };
      const credits = await import("./credits");
      const lignes = lignesDeDepense(d);
      try {
        // L3-01 : la voix est contrôlée, réservée et engagée sous le verrou des crédits avec l'origine de la commande ;
        // Claude n'a ici qu'un pré-vol (sa réservation se fait dans `executerRolePourVideo`, avec la même origine).
        if (d.fournisseur === "heygen") await credits.verifierEtReserverSelonOrigine(dep.origine, { lignes, total: lignes[0].total }, accordVoix, "Cette vidéo", { videoId: dep.videoId, travailId: dep.travailId });
        else await credits.verifierBudgetEtCredits({ lignes, total: lignes[0].total }, d.centimes, "Cette vidéo", { origine: dep.origine });
        return { ok: true };
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : undefined;
        if (code === "CREDIT_INSUFFISANT") return { ok: false, message: "Crédit insuffisant chez le fournisseur." };
        if (code === "BUDGET_DEPASSE") return { ok: false, message: "Budget du mois atteint." };
        if (code === "CONFIRMATION_REQUISE") return { ok: false, message: "Ce prix demande votre confirmation." };
        throw err;
      }
    },
    // Mode indicatif : le plafond de la vidéo est un repère (cloche) ; le prix n'arrête plus rien (ordre du 25/10).
    ...(indicatifIV
      ? { indicatif: { facteurSecurite: FACTEUR_SECURITE_BUDGET, signaler: async (message: string) => signalerDepassementIndicatif("video", "Prix annoncé dépassé (la vidéo continue)", message, await sujetDeCloche(String(dep.videoId))) } }
      : {}),
  };

  // Transcription et extraction d'images : conteneur `studio-aligneur` (routes existantes `transcrire` et `image`).
  const { fournisseurFacecam } = await import("@/fournisseurs/facecam");
  const facecam = fournisseurFacecam({ reel: true });
  async function travailFacecam<R extends "transcrire" | "image">(route: R, idTravail: string, demande: () => Promise<{ source: string; depots?: Record<string, string>; parametres?: Record<string, unknown> }>, quoi: string, attenteMaxMs: number) {
    const debut = Date.now();
    let e = await facecam.suivre(route, idTravail);
    if (e.statut === "echec" && e.erreur.travailInconnu) e = await facecam.soumettre(route, { idTravail, ...(await demande()) });
    while (e.statut === "en_file" || e.statut === "en_cours") {
      if (Date.now() - debut > attenteMaxMs) throw new RenduEnCoursIV(quoi);
      await new Promise((ok) => setTimeout(ok, 5_000));
      e = await facecam.suivre(route, idTravail);
    }
    if (e.statut === "echec") throw new Error(`${quoi} n'a pas abouti (${e.erreur.message}).`);
    return e.resultat;
  }

  const cleIV = (nom: string) => `studio/${env}/image-video/${dep.videoId}/${nom}`;
  const decisions: OutilsFabricationIV["decisions"] = dep.decisions ?? {
    carte: async () => ((await decisionsGardees())?.carte ?? null) as never,
    script: async () => {
      const d = (await decisionsGardees())?.script ?? null;
      // Lanceur : une décision sans accord du prix n'avance pas la fabrication (le lanceur reste à la porte).
      return (dep.accordDuScriptExige && !indicatifIV && accordDeLaDecision(d) === null ? null : d) as never;
    },
  };

  return {
    lireImageSource: dep.lireImageSource ?? lireStockage,
    lecture: { convertir: dep.convertir ?? convertirParFfmpeg, appeler: appelerClaude("lecture") },
    ecriture: {
      appeler: appelerClaude("ecriture"),
      socle: async () => {
        try {
          // Même charte et même voix que le cas concret, sans aucune phrase de la v4 (décision de Will du 18/10).
          const { socleCasConcretSansV4, TON_IMAGE_VIDEO_EN_MOTS } = await import("./cas-concret-socle");
          return await socleCasConcretSansV4(TON_IMAGE_VIDEO_EN_MOTS);
        } catch (err) {
          console.error(`[image-video] socle de Will illisible, écriture avec la seule consigne du format : ${err instanceof Error ? err.name : "erreur"}`);
          return undefined;
        }
      },
    },
    voix: {
      voix: () => voix,
      stockage: () => stockage,
      aligneur: () => aligneur,
      rendu: () => rendu,
      renduEstSimule: () => renduSimule,
      tauxUsdEur: taux,
      // La voix de synthèse garde son horodatage (essais réels du 14/10 : l'aligneur absorbait les « euh »).
      caler: (motsEstimes) => motsEstimes && aligneur.mode !== "simulation",
      cle: (nom) => cleIV(`voix/${nom}`),
      mesurerPauses: async (cle, pauses) => {
        if (renduSimule) return pauses.map(() => -90);
        const media = await signerLecture(cle);
        const niveaux: number[] = [];
        for (const p of pauses) {
          const id = `iv-pause-${dep.videoId}-${Buffer.from(`${cle}|${p.deSec}|${p.aSec}`).toString("base64url").slice(0, 40)}`;
          const sortieCle = cleIV(`mesures/${id}.json`);
          const e = await relireRenduIV(rendu, { idRendu: id, operation: "mesure-son", file: "courte", entrees: { media }, sortie: { urlDepot: await signerDepot(sortieCle, "application/json"), cle: sortieCle }, parametres: { pauses: [[p.deSec, p.aSec]] } }, "La mesure des blancs");
          const n = e.mesures?.pauseMaxDb;
          niveaux.push(typeof n === "number" && Number.isFinite(n) ? n : -90);
        }
        return niveaux;
      },
      // Tarif en centimes d'euro par caractère, majoré au taux prudent.
      tarifCentimesParCaractere: tarifVoixCentimesEur(tarifUsd, taux),
    },
    assemblage: {
      lireSon: lireStockage,
      convertirEnWav: convertirSonEnWavParFfmpeg,
      rangerSon: async (cle, octets) => {
        const url = await signerDepot(cle, "audio/wav");
        if (!url) return;
        const r = await fetch(url, { method: "PUT", body: octets as unknown as BodyInit, headers: { "content-type": "audio/wav" }, signal: AbortSignal.timeout(60_000) });
        if (!r.ok) throw new Error(`dépôt refusé (${r.status})`);
      },
      traiterVoix: async (d) => {
        const sortieCle = cleIV(`voix-seule/${d.id}.wav`);
        const e = await relireRenduIV(
          rendu,
          {
            idRendu: d.id,
            operation: "nettoyage-audio",
            file: "courte",
            entrees: { audio: await signerLecture(d.recette.corps), ...(d.recette.fin ? { audio2: await signerLecture(d.recette.fin) } : {}) },
            sortie: { urlDepot: await signerDepot(sortieCle, "audio/wav"), cle: sortieCle },
            parametres: { ...d.recette.parametres, tempo: d.tempo },
          },
          "La piste voix seule",
        );
        return { cle: e.sortieCle, dureeSec: e.mesures?.dureeSec ?? d.recette.dureeSec };
      },
    },
    rendre: async (d) => {
      const { rendreVersionIV } = await import("./image-video-rendu");
      return rendreVersionIV(d, {
        rendu,
        env,
        signerLecture,
        signerDepot,
        existe: async (cle) => stockage.mode !== "simulation" && (await stockage.confirmerDepot(cle).catch(() => ({ ok: false }))).ok,
        sons: BRUITAGES_V4_IV,
        mesurer: async (cle, dureeSec) => {
          if (renduSimule || stockage.mode === "simulation") return {};
          // Fichier final lu en entier (200 Mo au plus) : empreinte de ses octets, images noires et figées.
          const octets = await lireOctets(await signerLecture(cle), 200 * 1024 * 1024);
          if (!octets) return {};
          const { createHash } = await import("node:crypto");
          const noirFige = await mesurerNoirEtFigeParFfmpeg(octets, dureeSec);
          return { empreinte: `final-${createHash("sha256").update(octets).digest("hex").slice(0, 32)}`, ...(noirFige ?? {}) };
        },
      });
    },
    controles: {
      lireSon: lireStockage,
      transcrire: async (d) => {
        // L'aligneur exige une adresse de dépôt pour le résultat complet (`depots.transcription`, comme face caméra) ; les mots
        // reviennent aussi dans la réponse (jusqu'à 6 000), ce que lit l'écoute. 18/10 : sans elle, « Adresse de dépôt
        // « transcription » manquante » (première écoute réelle, v-dd3049053f88).
        const cleTranscription = cleIV(`ecoute/${d.appelId}-transcription.json.gz`);
        const r = await travailFacecam(
          "transcrire",
          d.appelId,
          async () => ({ source: await signerLecture(d.cle), depots: { transcription: await signerDepot(cleTranscription, "application/gzip") }, parametres: { langue: d.langue, jusquaSec: d.jusquaSec, cles: { transcription: cleTranscription } } }),
          "La transcription de la voix",
          10 * 60_000,
        );
        return { mots: ((r as { mots?: MotHorodate[] }).mots ?? []).filter((m) => m.debutSec <= d.jusquaSec) };
      },
      extraireImages: async (d) => {
        const depots = Object.fromEntries(await Promise.all(Object.entries(d.parametres.cles).map(async ([nom, cle]) => [nom, await signerDepot(cle, "image/jpeg")] as const)));
        const id = `iv-controle-${Buffer.from(`${dep.videoId}|${d.source}`).toString("base64url").slice(-48)}`;
        await travailFacecam("image", id, async () => ({ source: await signerLecture(d.source), depots, parametres: d.parametres }), "L'extraction des images de contrôle", 10 * 60_000);
        return { images: Object.entries(d.parametres.cles).map(([nom, cle]) => ({ nom, cle })) };
      },
      lireImage: async (cle) => {
        const octets = await lireStockage(cle);
        if (!octets) return null;
        return { octets, type: octets[0] === 0x89 ? "image/png" : "image/jpeg" };
      },
      appeler: appelerClaude("relecture"),
    },
    budget,
    bruitagesValides: BRUITAGES_V4_IV,
    cartesValidees: dep.cartesValidees ?? (async () => nombreCartesValidees(await lireParametre<unknown>(PARAM_CARTES_VALIDEES, []))),
    // Variété : les recettes des fabrications IV prêtes, la plus récente d'abord (aucune table : l'état du travail les garde).
    historiqueVariete:
      dep.historiqueVariete ??
      (async () => {
        const travaux = await commun.depots().travaux.lister((t) => (t.parametres as { imageVideo?: { etape?: unknown } } | undefined)?.imageVideo?.etape === "prete");
        travaux.sort((a, b) => (b.termineLe ?? b.creeLe).localeCompare(a.termineLe ?? a.creeLe));
        return historiqueVarieteIV(travaux.map((t) => (t.parametres as { imageVideo: EtatFabricationIV }).imageVideo), String(dep.videoId));
      }),
    decisions,
    maintenant: () => new Date().toISOString(),
  };
}

/** Tarif de la voix du format en centimes d'euro par caractère (HeyGen, taux prudent) : pour annoncer un prix sans outils. */
export async function tarifVoixImageVideo(): Promise<number> {
  const [{ CENTIMES_USD_PAR_CARACTERE_HEYGEN }, { lireParametre }, { TAUX_USD_EUR_PAR_DEFAUT }] = await Promise.all([import("@/fournisseurs/heygen/voix"), import("./_commun"), import("@/lib/montants")]);
  return tarifVoixCentimesEur(CENTIMES_USD_PAR_CARACTERE_HEYGEN, await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT));
}

/*
 * Raccord du moteur : la boucle de fond charge ce fichier pour son effet (ligne posée au lot L17, avec les 5 raccords).
 * Le plafond Claude propre suit le plafond de la vidéo (en euros, compté au taux prudent : 1 € = 1 $ au moins).
 */
/** Plafond Claude propre d'une vidéo (dollars) : son plafond (le prix confirmé au dépôt, ou relevé par Will) ; sans lui, 3 €. PUR. */
export function plafondClaudeUsdIV(commande: Pick<CommandeFabrication, "entrees">): number {
  return (lireEntreesImageVideo(commande.entrees).plafondCentimes ?? PLAFOND_VIDEO_IV_CENTIMES) / 100;
}

brancherServicesImageVideo({
  outils: async (commande, travailId) => outilsImageVideo({ videoId: commande.videoId, travailId, plafondClaudeUsd: plafondClaudeUsdIV(commande), ...(accordLotDeLaCommandeIV(commande) !== undefined ? { accordLotCentimes: accordLotDeLaCommandeIV(commande) } : {}), ...(commande.origine ? { origine: commande.origine } : {}) }),
  numeroVersion: async (versionId) => {
    const { depots } = await import("./_commun");
    const v = await depots().versions.obtenir(versionId).catch(() => null);
    return v?.numeroSuivi ?? v?.numero;
  },
});
