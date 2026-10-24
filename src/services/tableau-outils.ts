/**
 * OUTILS RÉELS DU TABLEAU ANIMÉ (tâche TB-11) : tarif de la voix et `branchementsReels` (voix prête du personnage,
 * stockage R2, `studio-rendu`, budget du studio). Partagés par les raccords du studio (`tableau-branchements.ts`) et par
 * le lanceur `scripts/tableau/fabriquer.ts`, qui les importe d'ici : l'image du studio ne contient pas `scripts/`.
 */
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "@/briques/voix-maitre/nettoyage";
import { exigerVoixMaitre } from "@/briques/voix-maitre/voix-epinglee";
import type { OutilsRenduCartes } from "@/briques/motion/rendu-cartes";
import type { Video, Voix } from "@/domaine/types";
import { voixPourFormat } from "@/domaine/voix-format";
import type { StockageFichiers } from "@/fournisseurs/types";
import { CENTIMES_USD_PAR_CARACTERE_HEYGEN } from "@/fournisseurs/heygen/voix";
import type { EstimationFabrication, OutilsFabrication } from "@/moteurs/montage-tableau/fabriquer";

/** Taux prudent (1 $ = 1 €) : l'estimation en euros ne sous-estime jamais (le taux du studio est autour de 0,9). */
export const TAUX_ESTIMATION_USD_EUR = 1;

/** Tarif de la voix, en centimes d'euro par caractère (HeyGen, au taux prudent). */
export const TARIF_VOIX_CENTIMES_PAR_CARACTERE = CENTIMES_USD_PAR_CARACTERE_HEYGEN * TAUX_ESTIMATION_USD_EUR;

/** Ce que le mode réel branche (construit seulement avec `--reel`). */
export interface Branchements {
  voix: OutilsFabrication["voix"];
  scenes: OutilsRenduCartes;
  montage: OutilsFabrication["montage"];
  env: string;
  /** Contrôle du budget du mois et des crédits, puis réservation (chaîne unique du studio). */
  verifierEtReserver: (e: EstimationFabrication) => Promise<void>;
  enregistrerVideo: (v: Video) => Promise<void>;
  /** Attente entre deux tours d'une étape suivie (voix, scènes, composition). */
  attendre: () => Promise<void>;
}

/**
 * Modules du mode réel, importés à la demande (seulement avec `--reel`). Chargés seuls par le test du chemin réel
 * (`tests/tableau/fabriquer/chemin-reel.test.ts`) : `credits` tire `auth`, donc `next/*`, hors de Next.
 */
export async function chargerModulesReels() {
  const [commun, fournisseurs, client, credits, montants, etalonnage, garde] = await Promise.all([import("./_commun"), import("@/fournisseurs"), import("@/fournisseurs/rendu/client"), import("./credits"), import("@/lib/montants"), import("./etalonnage"), import("@/fournisseurs/rendu/garde")]);
  return { commun, fournisseurs, client, credits, montants, etalonnage, garde };
}

/** Clés déjà trouvées lisibles (une copie déposée ne disparaît pas) : une seule vérification par clé et par processus. */
const lisiblesConnues = new Set<string>();

/**
 * L'entrée existe-t-elle là où `studio-rendu` la lira ? Clé publique : copiée au besoin par le chemin commun, puis
 * vérifiée ; clé du stockage : vérifiée telle quelle. Fichier absent ou refusé : `false` (jamais d'exception).
 */
export async function entreeLisible(cle: string, stockage: Pick<StockageFichiers, "confirmerDepot">, rendreLisible: (cle: string, stockage: StockageFichiers) => Promise<string>): Promise<boolean> {
  if (lisiblesConnues.has(cle)) return true;
  try {
    const ok = (await stockage.confirmerDepot(await rendreLisible(cle, stockage as StockageFichiers))).ok;
    if (ok) lisiblesConnues.add(cle);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Adresse de lecture d'une entrée de la composition. Une clé publique du studio (`/bruitages/…`, `/demo/…`, `/luts/…`)
 * n'existe pas dans le stockage : le chemin commun (`cleLisibleParLeRendu`, `services/etalonnage.ts`) la copie une fois
 * sous `studio/{env}/public/…`, et c'est cette copie qui est signée (jamais la clé publique elle-même).
 */
export function lectureSignee(stockage: StockageFichiers, rendreLisible: (cle: string, stockage: StockageFichiers) => Promise<string>): (cle: string) => Promise<string> {
  return async (cle) => {
    const lisible = await rendreLisible(cle, stockage);
    return stockage.urlLectureDuree ? stockage.urlLectureDuree(lisible, 3600) : stockage.urlLecture(lisible);
  };
}

/** Identifiant du format (le même que `FORMAT_TABLEAU_ANIME` des composants, redéclaré ici : un service chargé dynamiquement n'importe pas `@/components`). */
const FORMAT_TABLEAU = "tableau-anime";

/**
 * La voix de la fabrication : le MÊME résolveur que l'écran de création (`voixPourFormat`, domaine/voix-format.ts) : choix de la
 * vidéo, sinon voix du format, sinon voix par défaut du personnage, sinon la première prête. Avant le 24/10/2026 on prenait toujours
 * la première : après le changement de voix, l'ancienne (supprimée chez HeyGen) passait devant la nouvelle et la garde de voix
 * refusait la fabrication, sans rien dépenser (essai réel v-43f3e2278b14).
 */
export function choisirVoixDeFabrication<V extends Pick<Voix, "id" | "statut">>(
  pretes: V[],
  personnage: Parameters<typeof voixPourFormat>[1],
  choixVideo?: string,
): V | undefined {
  return voixPourFormat(pretes, personnage, FORMAT_TABLEAU, choixVideo) ?? pretes[0];
}

/**
 * Branchements RÉELS (seulement avec `--reel`). Non exécuté par les tests (aucun vrai appel) : voir
 * `docs/formats/tableau-anime-essai.md`, « ce qui n'a pas pu être vérifié ».
 */
export async function branchementsReels(personnageId: string, videoId: string, charger: typeof chargerModulesReels = chargerModulesReels): Promise<Branchements> {
  const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
  const m = await charger();
  const { depots, ressourceActive, lireParametre } = m.commun;
  const { resoudreFournisseur } = m.fournisseurs;
  const { obtenirServiceRendu, renduSimule } = m.client;
  const { verifierEtReserver } = m.credits;
  const { TAUX_USD_EUR_PAR_DEFAUT, centimes } = m.montants;
  const { cleLisibleParLeRendu } = m.etalonnage;
  if (renduSimule()) throw new Error("STUDIO_RENDU_URL est absente : le mode réel exige le serveur de rendu.");
  const d = depots();
  const personnage = await d.personnages.obtenir(personnageId);
  if (!personnage) throw new Error(`Personnage « ${personnageId} » introuvable.`);
  const video = await d.videos.obtenir(videoId);
  const choixVideo = video?.distribution?.find((x) => x.role === "voix")?.voixId;
  const voix = choisirVoixDeFabrication(await d.voix.lister((v) => v.personnageId === personnageId && v.statut === "pret"), personnage, choixVideo);
  if (!voix) throw new Error(`Le personnage « ${personnage.nom} » n'a pas de voix prête.`);
  const ressource = await ressourceActive(voix.id);
  if (!ressource?.idExterne) throw new Error(`La voix « ${voix.nom} » n'est pas reliée chez son fournisseur.`);
  // L1-05 : seule la voix maître HeyGen parle ; refus avant toute dépense (aucun fournisseur résolu).
  exigerVoixMaitre(voix.fournisseur, ressource.idExterne);
  const fournisseurVoix = resoudreFournisseur("voix", voix.fournisseur);
  if (fournisseurVoix.mode === "simulation") throw new Error(`La voix « ${voix.nom} » est une voix d'essai : choisissez une voix réelle.`);
  const stockage = resoudreFournisseur("stockage");
  if (stockage.mode === "simulation") throw new Error("Le stockage des fichiers n'est pas relié (R2).");
  const aligneur = resoudreFournisseur("alignement");
  const rendu = obtenirServiceRendu();
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const signerLecture = lectureSignee(stockage, cleLisibleParLeRendu);
  const signerDepot = async (cle: string, mime: string) => {
    if (!stockage.urlDepotDuree) throw new Error("Le stockage ne sait pas signer un dépôt.");
    return stockage.urlDepotDuree(cle, 3600, mime);
  };
  const travailId = `tb-${videoId}`;
  // Incident du 12/10 : un rendu en cours figé (ou oublié par un conteneur redémarré) devient un échec au bout de N min.
  const garde = { delaiMs: m.garde.delaiSansNouvelleMs() };
  return {
    env,
    voix: {
      voix: () => fournisseurVoix,
      stockage: () => stockage,
      aligneur: () => aligneur,
      rendu: () => rendu,
      renduEstSimule: () => false,
      idVoix: ressource.idExterne,
      reglages: voix.reglages,
      tauxUsdEur: taux,
      fournisseurVoix: voix.fournisseur,
      // La voix de synthèse garde son horodatage (lot R6, C6), sauf si elle n'en donne pas.
      caler: (motsEstimes) => motsEstimes && aligneur.mode !== "simulation",
      regles: REGLES_NETTOYAGE_PAR_DEFAUT,
      cle: (nom) => `studio/${env}/audio-maitre/${videoId}/${nom}`,
    },
    scenes: {
      rendu: () => rendu,
      depot: (cle) => signerDepot(cle, "video/mp4"),
      // Scène déjà déposée sous la clé de son empreinte (HEAD du stockage) : rien à rendre.
      existe: async (cle) => (await stockage.confirmerDepot(cle).catch(() => ({ ok: false }))).ok,
      garde,
    },
    montage: {
      rendu: () => rendu,
      signer: async (lectures, depots) => ({
        lectures: Object.fromEntries(await Promise.all(Object.entries(lectures).map(async ([n, c]) => [n, await signerLecture(c)] as const))),
        depots: Object.fromEntries(await Promise.all(depots.map(async (x) => [x.cle, await signerDepot(x.cle, x.mime)] as const))),
      }),
      cle: (c, nom) => `studio/${env}/videos/${c.videoId}/${nom}`,
      lisible: (cle) => entreeLisible(cle, stockage, cleLisibleParLeRendu),
      garde,
    },
    verifierEtReserver: async (e) => {
      const total = centimes(e.centimes);
      await verifierEtReserver(
        { lignes: [{ etape: "voix", fournisseur: voix.fournisseur, unite: "caractere", quantite: e.caracteres, prixUnitaire: centimes(TARIF_VOIX_CENTIMES_PAR_CARACTERE), total, nature: "estime" }], total },
        e.centimes,
        "Cette vidéo",
        { videoId: `v-${videoId}`, travailId },
      );
    },
    enregistrerVideo: async (v) => {
      if (await d.videos.obtenir(v.id)) await d.videos.modifier(v.id, { entrees: v.entrees, coutReel: v.coutReel, dureeCibleSec: v.dureeCibleSec });
      else await d.videos.enregistrer(v);
    },
    attendre: () => new Promise<void>((ok) => setTimeout(ok, 5_000)),
  };
}
