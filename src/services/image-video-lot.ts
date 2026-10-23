/**
 * IMAGE → VIDÉO · LOT D'IMAGES (décisions de Will, 17/10) : plan `docs/formats/image-video/lot-images/PLAN.md`.
 *
 *  - `deposerLotImageVideo` : N images → N brouillons créés AU DÉPÔT (session présente), UN accord de prix total, le
 *    crédit et le budget du lot réservés (`reserverLot`), le lot rangé dans `parametres` (`imageVideo.lot.<id>`).
 *  - `avancerLotsIV` : le séquenceur, appelé une fois par tour de la boucle de fond, SANS session : relit les travaux,
 *    met à jour les statuts (mise de côté, faite), puis lance la vidéo suivante — jamais deux fabrications Image → vidéo
 *    en même temps, jamais `lancerFabrication` (il exige une session) : seulement `lancerFabricationConfirmee`.
 *  - `arreterLotImageVideo`, `reprendreLotImageVideo`, `refaireVideoDuLot` : les gestes de Will.
 *
 * Tout est relu / réécrit à chaque tour (aucun état en mémoire) : un redémarrage du serveur reprend où le lot en était,
 * `lanceeLe` étant écrit AVANT chaque lancement. Toute écriture du lot se fait sous `sousVerrou` (verrou de la boucle).
 * Le lot ne s'allume par aucun réglage : sans l'accord d'essai réel (`PARAM_ACCORD_ESSAI_IV`) le moteur refuse chaque
 * lancement (`IV_FORMAT_MASQUE`) et le lot se met en pause avant toute dépense.
 */
import "server-only";
import { createHash } from "node:crypto";
import type { AccordPrix } from "@/domaine/accord";
import {
  appliquerIssueIV,
  prixDuLotIV,
  prochaineALancerIV,
  refusTailleLotIV,
  resumeLotIV,
  statutDepuisEtatIV,
  type LotIV,
  type RaisonPauseLotIV,
  type VideoDuLotIV,
} from "@/domaine/image-video/lot";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { CommandeFabrication, Distribution, Id, LigneCout, Travail } from "@/domaine/types";
import { OFFRES, type Offre } from "@/formats/cas-concret/cas";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { additionner } from "@/lib/montants";
import { engageCentimes, estimerImageVideo, type EtatFabricationIV } from "@/moteurs/montage-image-video";
import { barreDe, ETAPES_ECRANS, PHRASE_IMAGE_TROP_LOURDE, refusDimensions, TAILLE_MAX_IMAGE_OCTETS } from "@/components/formats/image-video/vue";
import { attendreRattrapage, DELAI_FICHIER_CONTROLE_MS, empreinteDuFichier, phraseRefusEmpreinte } from "./empreintes-fichiers";
import { creerVerrou, depots, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { phraseFinDeLotIV } from "@/domaine/notifications-textes";
import { exigerSession } from "./auth";
import { creerNotification } from "./notifications";
import { libererLot, rendreAuLot, reserverLot, transfererDuLot } from "./credits";
import type { SourcesSujets } from "./sujets-traites";
import { candidatImageIV, deposerImageVideo, PARAM_ACCORD_ESSAI_IV, PHRASES_IV, prixDuDepot, type DependancesEcranIV } from "./image-video-ecran";
import { phraseImagesSautees } from "@/components/formats/image-video/sujet-deja-traite";

// ─── Rangement ───────────────────────────────────────────────────────────────────────────────────────────────────────

export const PREFIXE_LOT_IV = "imageVideo.lot.";
export const PARAM_LOTS_IV = "imageVideo.lots";
/** Lots gardés dans l'index (le plus récent d'abord). */
export const LOTS_MAX_INDEX_IV = 50;
/** Lots relus à chaque tour de la boucle (les plus récents) : un lot plus ancien n'a plus rien à avancer. */
export const LOTS_SUIVIS_IV = 10;

export const PHRASES_LOT_IV = Object.freeze({
  introuvable: "Ce lot n'existe plus.",
  taille: (n: number) => refusTailleLotIV(n) ?? "",
  pauseBudget: "Le prix accordé pour ce lot est atteint : rien de plus n'est lancé.",
  pauseCredit: "Le crédit d'un fournisseur ne suffit plus : le lot est en pause, rien de plus n'est payé.",
  pauseFormat: "Le format « Image → vidéo » n'est pas encore ouvert : le lot est en pause avant toute dépense.",
  pausePanne: "Une panne a empêché de lancer la vidéo suivante : le lot est en pause, rien n'a été payé.",
  supprimee: "Supprimée.",
  ecartee: "Archivée ou à la corbeille : elle n'est pas lancée.",
  rienAReprendre: "Ce lot n'est pas en pause.",
  rienARefaire: "Cette vidéo n'est pas à refaire.",
});

const cleLot = (id: string) => `${PREFIXE_LOT_IV}${id}`;

export async function lireLotIV(id: string): Promise<LotIV | null> {
  return lireParametre<LotIV | null>(cleLot(id), null);
}

/** À appeler SOUS `sousVerrou`. */
async function ecrireLotIV(lot: LotIV): Promise<void> {
  await ecrireParametre(cleLot(lot.id), lot);
  const index = await lireParametre<string[]>(PARAM_LOTS_IV, []);
  if (index[0] !== lot.id) await ecrireParametre(PARAM_LOTS_IV, [lot.id, ...index.filter((x) => x !== lot.id)].slice(0, LOTS_MAX_INDEX_IV));
}

export async function lotsDeLIndexIV(): Promise<string[]> {
  return lireParametre<string[]>(PARAM_LOTS_IV, []);
}

// ─── Estimation d'une vidéo ──────────────────────────────────────────────────────────────────────────────────────────

/** Les lignes de coût d'UNE vidéo du lot (même calcul que le dépôt d'une image seule). */
function lignesUneVideo(reseaux: readonly ReseauIV[], taux: number): LigneCout[] {
  const commande = { entrees: { imageVideo: { reseaux: [...reseaux] } }, tauxUsdEur: taux, dureeCibleSec: 50 } as unknown as CommandeFabrication;
  return estimerImageVideo(commande).lignes;
}

const eurosTexte = (centimes: number) => `${(centimes / 100).toFixed(2).replace(".", ",")} €`;

// ─── Dépôt ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ImageDuLotIV {
  fichierId: string;
  largeur: number;
  hauteur: number;
}

export interface DemandeLotIV {
  images: ImageDuLotIV[];
  reseaux: string[];
  offre?: string;
  /** Montant affiché et confirmé pour TOUT le lot (centimes d'euro). */
  accordCentimes?: AccordPrix;
}

/** Image du lot laissée de côté parce qu'elle est déjà traitée (ou en double dans le lot). */
export interface ImageSauteeIV {
  nom: string;
  /** Titres des vidéos qui la traitent déjà (vide : doublon dans le lot). */
  precedents: string[];
}

export type IssueLotIV = { statut: "lancee"; lotId: string; sautees?: ImageSauteeIV[]; phraseSautees?: string } | { statut: "accord-requis"; centimes: number; phrase: string; sautees?: ImageSauteeIV[] } | { statut: "refusee"; phrase: string };

export interface DependancesLotIV extends DependancesEcranIV {
  /** Lancement d'une vidéo SANS session (défaut : `lancerFabricationConfirmee`). `confirmeCentimes` : le prix par vidéo. */
  lancerVideo?: (videoId: Id, confirmeCentimes: number) => Promise<{ travailId: Id }>;
}

const verrouDepot = creerVerrou();

/**
 * Sources du contrôle « image déjà traitée » pour Image → vidéo : une vidéo de lot encore « brouillon » (pas encore lancée par
 * le séquenceur) compte comme en file tant que son lot est actif (en cours ou en pause) ; un lot arrêté ou terminé ne retient rien.
 * Les statuts qui comptent au registre ne changent pas : seule la vue lue ici est ajustée.
 */
export async function sourcesSujetsIV(base?: SourcesSujets): Promise<SourcesSujets> {
  const src = base ?? (await import("./sujets-traites")).SOURCES_PAR_DEFAUT;
  return {
    ...src,
    async videos() {
      const vues = await src.videos();
      const actifs = new Map<string, boolean>();
      const lotActif = async (id: string) => {
        if (!actifs.has(id)) {
          const lot = await lireLotIV(id).catch(() => null);
          actifs.set(id, lot?.statut === "en-cours" || lot?.statut === "en-pause");
        }
        return actifs.get(id)!;
      };
      return Promise.all(
        vues.map(async (v) => {
          if (v.formatId !== ID_FORMAT_IMAGE_VIDEO || v.statut !== "brouillon") return v;
          const lotId = (v.entrees?.imageVideo as { lot?: { id?: unknown } } | undefined)?.lot?.id;
          return typeof lotId === "string" && lotId && (await lotActif(lotId)) ? { ...v, statut: "en_file" as const } : v;
        }),
      );
    },
  };
}

export const idDuLotIV = (cle: string) => `lot-iv-${cle.slice(0, 12)}`;

export function cleIdempotenceLotIV(fichierIds: readonly string[], reseaux: readonly string[], offre: string | undefined, accord: number): string {
  return createHash("sha256")
    .update(JSON.stringify({ fichiers: [...fichierIds].sort(), reseaux: [...reseaux].sort(), offre: offre ?? "", accord }))
    .digest("hex");
}

const formatOuvertParDefaut = async () => !!(await import("@/formats")).trouverFormat(ID_FORMAT_IMAGE_VIDEO);
const voixParDefaut = async () => (await import("./cas-concret")).voixDeReference();
const fichierParDefaut = async (fichierId: string) => (await import("./fichiers")).fichierEnvoye(fichierId, "entree");
const tauxParDefaut = () => lireParametre<number>("taux.usdEur", 0.92);

/** Brouillon d'une vidéo du lot : créé AU DÉPÔT, avec ses entrées complètes (le séquenceur n'a pas de session). */
async function brouillonParDefaut(e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown> }) {
  const { nouveauBrouillonFormat } = await import("./creation-format");
  const video = await nouveauBrouillonFormat({ formatId: ID_FORMAT_IMAGE_VIDEO, ...e });
  const { enregistrerScriptDuBrouillon } = await import("./videos");
  const { BLOCS_SCRIPT_PROVISOIRE_IV } = await import("./image-video-ecran");
  await enregistrerScriptDuBrouillon(video.id, BLOCS_SCRIPT_PROVISOIRE_IV(video.id));
  return video;
}

async function abandonnerParDefaut(videoId: Id) {
  const { abandonnerBrouillon } = await import("./videos");
  await abandonnerBrouillon(videoId);
}

async function lancerVideoParDefaut(videoId: Id, confirmeCentimes: number): Promise<{ travailId: Id }> {
  // Dernier garde-fou avant la fabrication payée : Will a pu archiver la vidéo ou la mettre à la corbeille depuis la
  // réservation. `echecDuLancement` rend alors la part au lot (aucun travail créé) et met la vidéo de côté.
  if (await videoEcartee(videoId)) throw new ErreurStudio("IV_ECARTEE", PHRASES_LOT_IV.ecartee);
  const { lancerFabricationConfirmee } = await import("./fabrication");
  return lancerFabricationConfirmee(videoId, { confirme: confirmeCentimes });
}

/**
 * « Fabriquer les N vidéos » : refusé tant que l'accord n'est pas le MONTANT total (`true` ne suffit pas) ; un refus du
 * budget ou des crédits ne crée rien. Un second dépôt identique rend le lot déjà créé.
 */
export async function deposerLotImageVideo(d: DemandeLotIV, dep: DependancesLotIV = {}): Promise<IssueLotIV> {
  await exigerSession();
  const n = d.images.length;
  const refusTaille = refusTailleLotIV(n);
  if (refusTaille) return { statut: "refusee", phrase: refusTaille };
  for (const i of d.images) {
    const refus = refusDimensions(Number(i.largeur), Number(i.hauteur));
    if (refus) return { statut: "refusee", phrase: refus };
  }
  const reseaux = RESEAUX_IV.filter((r) => d.reseaux.includes(r));
  if (!reseaux.length) return { statut: "refusee", phrase: (d.reseaux as readonly string[]).includes("tiktok") ? PHRASES_IV.tiktokRetire : PHRASES_IV.sansReseau };
  const offre = OFFRES.includes(d.offre as Offre) ? (d.offre as Offre) : undefined;
  if (!(await (dep.formatOuvert ?? formatOuvertParDefaut)())) return { statut: "refusee", phrase: PHRASES_IV.pasRaccorde };
  const voix = await (dep.voix ?? voixParDefaut)();
  if (!voix) return { statut: "refusee", phrase: PHRASES_IV.sansVoix };
  const fichiers: { id: string; cleStockage: string; nom: string; taille: number; sha256?: string }[] = [];
  for (const i of d.images) {
    try {
      const f = await (dep.fichier ?? fichierParDefaut)(i.fichierId);
      if (!/^image\/(png|jpeg|webp)$/.test(f.mime)) return { statut: "refusee", phrase: "Déposez des images PNG, JPEG ou WebP." };
      if (!(f.taille <= TAILLE_MAX_IMAGE_OCTETS)) return { statut: "refusee", phrase: PHRASE_IMAGE_TROP_LOURDE };
      fichiers.push({ id: f.id, cleStockage: f.cleStockage, nom: f.nom, taille: f.taille, ...(f.sha256 ? { sha256: f.sha256 } : {}) });
    } catch (e) {
      return { statut: "refusee", phrase: e instanceof ErreurStudio ? e.message : PHRASES_IV.fichier };
    }
  }
  // Images déjà traitées (lot L6) : sautées et dites, jamais le lot entier bloqué ; avant le prix et avant toute dépense.
  // La clé d'idempotence reste celle de la demande entière (un même dépôt rend le même lot, même si des vidéos sont parties entre-temps).
  const cle = cleIdempotenceLotIV(d.images.map((i) => i.fichierId), reseaux, offre, typeof d.accordCentimes === "number" && Number.isFinite(d.accordCentimes) ? d.accordCentimes : NaN);
  // Même demande déjà déposée : le même lot, rendu AVANT le tri (des vidéos du lot ont pu partir et compter au registre depuis).
  const lotId = idDuLotIV(cle);
  if (await lireLotIV(lotId)) return { statut: "lancee", lotId };
  const sautees: ImageSauteeIV[] = [];
  const gardees: number[] = [];
  const { verifierSujet, lireGardeSujets } = await import("./sujets-traites");
  const sources = await sourcesSujetsIV(dep.sourcesSujets);
  // Réglage « eteint » : ni contrôle, ni empreinte, ni doublon écarté, exactement comme avant.
  const controle = !dep.sansControleSujet && (await lireGardeSujets(sources)) !== "eteint";
  if (controle) {
    // Empreinte du contenu avant le tri (copies renommées reconnues, doublons internes au lot compris), hors de tout verrou.
    // Le rattrapage du dossier n'est attendu qu'UNE fois (borné), puis seulement le calcul de chaque fichier, avec UNE échéance
    // globale pour toute la boucle (la borne d'un fichier, pas une par image). Au premier fichier dont la vérification échoue ou
    // dépasse l'échéance, le lot entier est refusé en nommant ce fichier (rien créé, rien payé) : jamais d'attentes additionnées.
    let courant = "";
    try {
      if (!dep.empreinte) await attendreRattrapage("image-video", dep.optionsEmpreinte);
      const fin = Date.now() + (dep.optionsEmpreinte?.delaiFichierMs ?? DELAI_FICHIER_CONTROLE_MS);
      for (const [k, f] of fichiers.entries()) {
        courant = f.nom;
        const reste = fin - Date.now();
        if (reste <= 0) throw Object.assign(new Error("vérification du lot en cours"), { enCours: true });
        fichiers[k] = await (dep.empreinte ?? ((x) => empreinteDuFichier(x, { ...dep.optionsEmpreinte, delaiFichierMs: reste })))(f);
      }
    } catch (e) {
      console.error("[empreinte] lot image → vidéo", e);
      return { statut: "refusee", phrase: courant ? `« ${courant} » : ${phraseRefusEmpreinte(e)}` : phraseRefusEmpreinte(e) };
    }
  }
  if (!controle) d.images.forEach((_, k) => gardees.push(k));
  else {
    const vues = new Set<string>();
    for (const [k, f] of fichiers.entries()) {
      const candidat = candidatImageIV(f);
      // Même image deux fois dans le lot : seule la première part (clés de contenu et de fichier, pas « nom + taille »).
      const cles = (candidat.cles ?? []).filter((c) => !c.includes("#"));
      if (cles.some((c) => vues.has(c))) {
        sautees.push({ nom: f.nom, precedents: [] });
        continue;
      }
      const v = await verifierSujet(candidat, undefined, sources);
      if (!v.ok) {
        sautees.push({ nom: f.nom, precedents: v.precedents.map((p) => p.titre) });
        continue;
      }
      cles.forEach((c) => vues.add(c));
      gardees.push(k);
    }
  }
  const phraseSautees = sautees.length ? phraseImagesSautees(sautees, gardees.length) : undefined;
  if (gardees.length < n && gardees.length < 2) {
    return { statut: "refusee", phrase: `${phraseSautees} ${gardees.length === 1 ? "Déposez-la seule, sans lot." : "Rien n'est lancé ni payé."}` };
  }
  const images = gardees.map((k) => d.images[k]!);
  const fichiersLot = gardees.map((k) => fichiers[k]!);
  const nLot = images.length;
  const taux = await (dep.taux ?? tauxParDefaut)();
  const prixParVideo = prixDuDepot(reseaux, taux);
  const total = prixDuLotIV(nLot, prixParVideo);
  const accord = typeof d.accordCentimes === "number" && Number.isFinite(d.accordCentimes) ? d.accordCentimes : undefined;
  if (accord === undefined || accord < total) {
    return { statut: "accord-requis", centimes: total, phrase: `${phraseSautees ? `${phraseSautees} ` : ""}Ce lot de ${nLot} vidéos coûte au plus ${eurosTexte(total)}. Confirmez ce prix pour lancer.`, ...(sautees.length ? { sautees } : {}) };
  }

  return verrouDepot(async () => {
    if (await lireLotIV(lotId)) return { statut: "lancee" as const, lotId, ...(sautees.length ? { sautees, ...(phraseSautees ? { phraseSautees } : {}) } : {}) };
    // Budget du mois, seuil de confirmation, clés et crédits de CHAQUE fournisseur, pour tout le lot : un refus ne crée rien.
    const lignes = Array.from({ length: nLot }, () => lignesUneVideo(reseaux, taux)).flat();
    try {
      await reserverLot(lotId, lignes, additionner(...lignes.map((l) => l.total)), accord);
    } catch (e) {
      if (e instanceof ErreurStudio && e.code === "CONFIRMATION_REQUISE" && typeof e.montant === "number") return { statut: "accord-requis" as const, centimes: e.montant, phrase: e.message };
      if (e instanceof ErreurStudio) return { statut: "refusee" as const, phrase: e.message };
      throw e;
    }
    const accordEssaiReel = await (dep.accordEssai ?? (() => lireParametre<boolean>(PARAM_ACCORD_ESSAI_IV, false)))();
    const distribution: Distribution[] = [{ role: "voix", source: "double", personnageId: voix.personnageId, voixId: voix.voixId }];
    const videos: VideoDuLotIV[] = [];
    try {
      for (const [k, i] of images.entries()) {
        const f = fichiersLot[k]!;
        const titre = (f.nom.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[-_]+/g, " ").trim() || "Image → vidéo").slice(0, 80);
        const entrees = {
          imageVideo: {
            imageCle: f.cleStockage,
            fichierId: f.id,
            ...(f.sha256 ? { empreinte: f.sha256 } : {}),
            reseaux,
            ...(offre ? { offre } : {}),
            largeur: Math.round(i.largeur),
            hauteur: Math.round(i.hauteur),
            plafondCentimes: prixParVideo,
            accordEssaiReel: accordEssaiReel === true,
            lot: { id: lotId, rang: k + 1, accordParVideoCentimes: prixParVideo },
          },
        };
        const video = await (dep.brouillon ?? brouillonParDefaut)({ titre, sujet: titre, distribution, entrees });
        videos.push({ rang: k + 1, videoId: video.id, fichierId: f.id, nom: f.nom, statut: "en-attente" });
      }
    } catch (e) {
      // Un brouillon n'a pas pu être créé : on rend le crédit du lot et on archive ceux déjà créés (rien n'est lancé).
      await libererLot(lotId).catch(() => undefined);
      for (const v of videos) await (dep.abandonner ?? abandonnerParDefaut)(v.videoId).catch(() => undefined);
      if (e instanceof ErreurStudio) return { statut: "refusee" as const, phrase: e.message };
      throw e;
    }
    const lot: LotIV = {
      version: "lot-iv/1",
      id: lotId,
      creeLe: maintenant(),
      cleIdempotence: cle,
      reseaux,
      ...(offre ? { offre } : {}),
      prixParVideoCentimes: prixParVideo,
      accordCentimes: Math.round(accord),
      plafondCentimes: total,
      tauxUsdEur: taux,
      videos,
      statut: "en-cours",
      pannesDeSuite: 0,
      journal: [`Lot de ${nLot} images déposé : au plus ${eurosTexte(total)}.`, ...(phraseSautees ? [phraseSautees] : [])],
    };
    await sousVerrou(() => ecrireLotIV(lot));
    await journaliser("video", `Lot d'images déposé : ${nLot} vidéos${sautees.length ? ` (${sautees.length} déjà traitée${sautees.length > 1 ? "s" : ""}, sautée${sautees.length > 1 ? "s" : ""})` : ""}`).catch(() => undefined);
    return { statut: "lancee" as const, lotId, ...(sautees.length ? { sautees, ...(phraseSautees ? { phraseSautees } : {}) } : {}) };
  });
}

// ─── Séquenceur ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Le travail le plus récent d'une vidéo. */
async function dernierTravail(videoId: Id): Promise<Travail | null> {
  const liste = await depots().travaux.lister((t) => t.cibleId === videoId);
  return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] ?? null;
}

const etatDe = (t: Travail | null): EtatFabricationIV | null => ((t?.parametres?.imageVideo as EtatFabricationIV | undefined) ?? null);

/** Une fabrication Image → vidéo (du lot ou non) avance-t-elle ? Une porte de Will n'avance pas (travail en échec). */
async function uneFabricationIVActive(): Promise<boolean> {
  const actifs = await depots().travaux.lister((t) => (t.statut === "en_cours" || t.statut === "en_file") && !!t.parametres?.imageVideo && t.parametres?.lanceurIV !== true);
  return actifs.length > 0;
}

/** Lancement par défaut du séquenceur (exporté pour les tests). */
export const lancerVideoDuLot = (videoId: Id, confirmeCentimes: number) => lancerVideoParDefaut(videoId, confirmeCentimes);

/** Vidéo absente, archivée ou à la corbeille : traitée comme supprimée (jamais lancée ni payée). */
export async function videoEcartee(videoId: Id): Promise<boolean> {
  const v = await depots().videos.obtenir(videoId);
  return !v || v.statut === "archivee";
}

/** Mise de côté d'une vidéo écartée : « Supprimée. » si elle n'existe plus, sinon « Archivée ou à la corbeille ». */
async function ecarter(lot: LotIV, rang: number, videoId: Id): Promise<LotIV> {
  const motif = (await depots().videos.obtenir(videoId)) ? PHRASES_LOT_IV.ecartee : PHRASES_LOT_IV.supprimee;
  return appliquerIssueIV(lot, rang, { statut: "mise-de-cote", miseDeCote: { porte: "arret", motif, phrases: [] } });
}

async function recalculerStatuts(lot: LotIV): Promise<LotIV> {
  let suivant = lot;
  for (const v of lot.videos) {
    // Une vidéo qui n'a pas encore de travail et que Will a archivée ou mise à la corbeille est mise de côté, jamais lancée.
    if ((v.statut === "en-attente" || (v.statut === "en-fabrication" && !(await dernierTravail(v.videoId)))) && (await videoEcartee(v.videoId))) {
      suivant = await ecarter(suivant, v.rang, v.videoId);
      continue;
    }
    if (v.statut !== "en-fabrication" && v.statut !== "mise-de-cote") continue;
    const travail = await dernierTravail(v.videoId);
    if (!travail) {
      // Vidéo supprimée : elle n'est plus fabriquée ; sans travail et sans vidéo, rien à attendre.
      if (!(await depots().videos.obtenir(v.videoId))) suivant = appliquerIssueIV(suivant, v.rang, { statut: "mise-de-cote", miseDeCote: { porte: "arret", motif: PHRASES_LOT_IV.supprimee, phrases: [] } });
      continue;
    }
    suivant = appliquerIssueIV(suivant, v.rang, issueDuTravail(travail));
  }
  return suivant;
}

/**
 * Statut d'une vidéo d'après son dernier travail. Un travail refusé par le moteur AVANT tout pas de la machine
 * (`travailRefuse` : en échec, sans état) est un arrêt, pas un brouillon : sinon la vidéo serait relancée à chaque tour.
 */
function issueDuTravail(travail: Travail) {
  const e = etatDe(travail);
  if (e) return statutDepuisEtatIV(e, travail.statut);
  if (travail.statut === "echec") {
    const err = travail.erreur;
    return statutDepuisEtatIV({ etape: "refusee", refus: { ...(err?.code ? { code: err.code } : {}), message: err?.messagePourWill || "Arrêtée." } }, "echec");
  }
  if (travail.statut === "en_cours" || travail.statut === "en_file") return { statut: "en-fabrication" as const };
  return statutDepuisEtatIV(null, travail.statut);
}

function pauseDe(lot: LotIV, raison: RaisonPauseLotIV, phrase: string): LotIV {
  return { ...structuredClone(lot), statut: "en-pause", pause: { raison, phrase }, journal: [...lot.journal, phrase] };
}

function raisonDeLErreur(e: unknown): { raison: RaisonPauseLotIV; phrase: string } | null {
  if (!(e instanceof ErreurStudio)) return null;
  if (e.code === "CREDIT_INSUFFISANT" || e.code === "CLE_REFUSEE") return { raison: "credit", phrase: e.message || PHRASES_LOT_IV.pauseCredit };
  if (e.code === "BUDGET_DEPASSE" || e.code === "CONFIRMATION_REQUISE") return { raison: "budget", phrase: e.message || PHRASES_LOT_IV.pauseBudget };
  if (e.code === "IV_FORMAT_MASQUE") return { raison: "format", phrase: PHRASES_LOT_IV.pauseFormat };
  return null;
}

/** Travail créé pour cette vidéo depuis `lanceeLe` ? (le lancement a-t-il abouti avant l'erreur) */
const unTravailExiste = async (videoId: Id) => (await dernierTravail(videoId)) !== null;

async function travailleSurLot(id: string, dep: DependancesLotIV): Promise<void> {
  // 1. Sous verrou : relire, recalculer les statuts depuis les travaux, écrire.
  const { lot: apres, fini } = await sousVerrou(async () => {
    const lu = await lireLotIV(id);
    if (!lu) return { lot: null as LotIV | null, fini: false };
    // Lot fini, en pause ou arrêté : les statuts continuent d'être relus (Will valide ou refait une vidéo mise de côté,
    // la vidéo en cours d'un lot arrêté va au bout), mais rien n'est lancé.
    if (lu.statut !== "en-cours" && !lu.videos.some((v) => v.statut === "mise-de-cote" || v.statut === "en-fabrication")) return { lot: null as LotIV | null, fini: false };
    const recalcule = await recalculerStatuts(lu);
    if (JSON.stringify(recalcule) !== JSON.stringify(lu)) await ecrireLotIV(recalcule);
    return { lot: lu.statut === "en-cours" ? recalcule : null, fini: lu.statut === "en-cours" && recalcule.statut === "termine" };
  });
  if (!apres) return;
  if (fini) {
    await libererLot(id).catch(() => undefined);
    // Une seule notification : seul le tour qui vient d'écrire « terminé » arrive ici (les suivants ne relisent que les lots en cours).
    const r = resumeLotIV(apres);
    await creerNotification({ type: "video-prete", titre: phraseFinDeLotIV(r), message: r.misesDeCote ? "Les vidéos mises de côté sont à relire." : "Les vidéos sont à relire.", lien: `/image-video/lot/${id}` }).catch(() => undefined);
    return;
  }
  if (apres.statut !== "en-cours") return;
  // 2. La suivante : une vidéo « en fabrication » SANS travail (arrêt entre `lanceeLe` et le lancement) est relancée en
  //    premier ; sinon la première « en attente ». Jamais deux fabrications Image → vidéo à la fois.
  const orpheline = await trouverOrpheline(apres);
  const autre = await uneFabricationIVActive();
  const suivante = orpheline ?? (autre ? null : prochaineALancerIV(apres, false));
  if (!suivante || autre) return;
  // Plafond du lot : ce qui est engagé dans les caisses des vidéos + une vidéo ne dépasse jamais le prix accordé.
  if (!orpheline) {
    let engage = 0;
    for (const v of apres.videos) {
      if (v.statut === "en-attente") continue;
      const e = etatDe(await dernierTravail(v.videoId));
      if (e) engage += engageCentimes(e);
    }
    if (engage + apres.prixParVideoCentimes > apres.plafondCentimes) {
      await sousVerrou(async () => {
        const lu = await lireLotIV(id);
        if (lu?.statut === "en-cours") await ecrireLotIV(pauseDe(lu, "budget", PHRASES_LOT_IV.pauseBudget));
      });
      return;
    }
  }
  // 3. `lanceeLe` écrit AVANT le lancement (reprise après un arrêt du serveur).
  const prepare = await sousVerrou(async () => {
    const lu = await lireLotIV(id);
    const v = lu?.videos.find((x) => x.rang === suivante.rang);
    if (!lu || lu.statut !== "en-cours" || !v || (v.statut !== "en-attente" && !(orpheline && v.statut === "en-fabrication"))) return false;
    // Revérifié ICI, juste avant de payer : Will a pu archiver ou mettre à la corbeille la vidéo depuis la mise de côté (étape 1).
    if (await videoEcartee(v.videoId)) {
      await ecrireLotIV(await ecarter(lu, v.rang, v.videoId));
      return false;
    }
    v.statut = "en-fabrication";
    v.lanceeLe = maintenant();
    await ecrireLotIV(lu);
    return true;
  });
  if (!prepare) return;
  const lignes = lignesUneVideo(apres.reseaux, apres.tauxUsdEur);
  try {
    await transfererDuLot(id, suivante.videoId, lignes, additionner(...lignes.map((l) => l.total)));
    await (dep.lancerVideo ?? lancerVideoParDefaut)(suivante.videoId, apres.prixParVideoCentimes);
  } catch (e) {
    await echecDuLancement(id, suivante, e);
  }
}

async function trouverOrpheline(lot: LotIV): Promise<VideoDuLotIV | null> {
  for (const v of lot.videos) {
    if (v.statut === "en-fabrication" && v.lanceeLe && !(await unTravailExiste(v.videoId))) return v;
  }
  return null;
}

/** Le lancement a échoué : la part est rendue au lot si aucun travail n'a été créé ; le lot se met en pause ou la vidéo est mise de côté. */
async function echecDuLancement(id: string, v: VideoDuLotIV, e: unknown): Promise<void> {
  const cree = await unTravailExiste(v.videoId);
  if (!cree) await rendreAuLot(id, v.videoId).catch(() => undefined);
  await sousVerrou(async () => {
    const lu = await lireLotIV(id);
    if (!lu) return;
    const vid = lu.videos.find((x) => x.rang === v.rang);
    if (!vid) return;
    if (cree) return;
    // Lot arrêté (ou mis en pause) pendant ce lancement : la vidéo revient « à venir », l'arrêt de Will n'est pas défait.
    if (lu.statut !== "en-cours") {
      vid.statut = "en-attente";
      delete vid.lanceeLe;
      await ecrireLotIV(lu);
      return;
    }
    const pause = raisonDeLErreur(e);
    if (pause) {
      // La vidéo n'est pas perdue : elle repart quand le lot reprend.
      vid.statut = "en-attente";
      delete vid.lanceeLe;
      await ecrireLotIV(pauseDe(lu, pause.raison, pause.phrase));
      return;
    }
    const motif = e instanceof ErreurStudio ? e.message : PHRASES_LOT_IV.pausePanne;
    const code = e instanceof ErreurStudio && /^IV_/.test(e.code) ? e.code : "IV_PANNE";
    delete vid.lanceeLe;
    await ecrireLotIV(appliquerIssueIV(lu, v.rang, { statut: "mise-de-cote", miseDeCote: { porte: "arret", motif, phrases: [], code } }));
  });
}

/** Un tour du séquenceur (boucle de fond, hors du tour) : chaque lot « en cours », l'un après l'autre. Jamais d'exception. */
export async function avancerLotsIV(dep: DependancesLotIV = {}): Promise<void> {
  for (const id of (await lotsDeLIndexIV()).slice(0, LOTS_SUIVIS_IV)) {
    try {
      await travailleSurLot(id, dep);
    } catch (e) {
      console.error("[studio] lot d'images en échec", e instanceof Error ? e.name : "erreur");
    }
  }
}

// ─── Gestes de Will ──────────────────────────────────────────────────────────────────────────────────────────────────

/** « Arrêter le lot » : plus aucun lancement ; la vidéo en cours va au bout (rien de payé n'est perdu). */
export async function arreterLotImageVideo(lotId: string): Promise<{ statut: "arrete" } | { statut: "refusee"; phrase: string }> {
  await exigerSession();
  const lot = await sousVerrou(async () => {
    const lu = await lireLotIV(lotId);
    if (!lu) return null;
    if (lu.statut === "termine" || lu.statut === "arrete") return lu;
    const suivant: LotIV = { ...structuredClone(lu), statut: "arrete", journal: [...lu.journal, "Lot arrêté par Will : les vidéos pas encore commencées ne seront pas fabriquées."] };
    delete suivant.pause;
    await ecrireLotIV(suivant);
    return suivant;
  });
  if (!lot) return { statut: "refusee", phrase: PHRASES_LOT_IV.introuvable };
  await libererLot(lotId);
  return { statut: "arrete" };
}

/** « Reprendre le lot » : la réservation est revérifiée sur ce qui reste ; un refus garde la pause avec sa phrase. */
export async function reprendreLotImageVideo(lotId: string): Promise<{ statut: "reprise" } | { statut: "refusee"; phrase: string }> {
  await exigerSession();
  const lu = await lireLotIV(lotId);
  if (!lu) return { statut: "refusee", phrase: PHRASES_LOT_IV.introuvable };
  if (lu.statut !== "en-pause") return { statut: "refusee", phrase: PHRASES_LOT_IV.rienAReprendre };
  const restant = lu.videos.filter((v) => v.statut === "en-attente").length;
  if (restant > 0) {
    const lignes = Array.from({ length: restant }, () => lignesUneVideo(lu.reseaux, lu.tauxUsdEur)).flat();
    const total = additionner(...lignes.map((l) => l.total));
    try {
      await reserverLot(lotId, lignes, total, total.centimes, { reprise: true });
    } catch (e) {
      if (e instanceof ErreurStudio) return { statut: "refusee", phrase: e.message };
      throw e;
    }
  }
  await sousVerrou(async () => {
    const l = await lireLotIV(lotId);
    if (!l || l.statut !== "en-pause") return;
    const suivant: LotIV = { ...structuredClone(l), statut: "en-cours", pannesDeSuite: 0, journal: [...l.journal, "Lot repris par Will."] };
    delete suivant.pause;
    await ecrireLotIV(suivant);
  });
  return { statut: "reprise" };
}

export interface DemandeRefaireIV {
  accordCentimes?: AccordPrix;
}

/**
 * « Refaire » une vidéo du lot : une NOUVELLE vidéo de la même image, par le parcours d'une image seule (son prix, son
 * accord) ; l'ancienne n'est pas supprimée. L'entrée du lot passe « refaite » et pointe la nouvelle.
 */
export async function refaireVideoDuLot(lotId: string, rang: number, d: DemandeRefaireIV, dep: DependancesEcranIV = {}): Promise<Awaited<ReturnType<typeof deposerImageVideo>>> {
  await exigerSession();
  const lot = await lireLotIV(lotId);
  const v = lot?.videos.find((x) => x.rang === rang);
  if (!lot || !v) return { statut: "refusee", phrase: PHRASES_LOT_IV.introuvable };
  if (v.statut !== "mise-de-cote" && v.statut !== "faite") return { statut: "refusee", phrase: PHRASES_LOT_IV.rienARefaire };
  const ancienne = await depots().videos.obtenir(v.videoId);
  const entrees = (ancienne?.entrees?.imageVideo ?? {}) as { largeur?: number; hauteur?: number };
  const issue = await deposerImageVideo({ fichierId: v.fichierId, reseaux: lot.reseaux, ...(lot.offre ? { offre: lot.offre } : {}), largeur: Number(entrees.largeur ?? 0), hauteur: Number(entrees.hauteur ?? 0), accordCentimes: d.accordCentimes }, { ...dep, sansControleSujet: true });
  if (issue.statut !== "lancee") return issue;
  await sousVerrou(async () => {
    const lu = await lireLotIV(lotId);
    const e = lu?.videos.find((x) => x.rang === rang);
    if (!lu || !e) return;
    e.statut = "refaite";
    e.refaiteEn = issue.videoId;
    await ecrireLotIV(lu);
  });
  return issue;
}

// ─── Vue de la page du lot ───────────────────────────────────────────────────────────────────────────────────────────

export interface CarteVideoLotIV {
  rang: number;
  videoId: string;
  nom: string;
  imageUrl: string | null;
  statut: VideoDuLotIV["statut"];
  pastille: { libelle: string; ton: "neutre" | "ambre" | "sauge" | "brique" };
  /** Mise de côté : le motif en une phrase. */
  motif?: string;
  /** Page de la vidéo (faite ou mise de côté). */
  voir?: string;
  /** Page de la nouvelle vidéo (statut « refaite »). */
  nouvelle?: string;
}

export interface VueLotIV {
  id: string;
  titre: string;
  sousTitre: string;
  statut: LotIV["statut"];
  /** Étape allumée : 0 les images, 1 fabrication, 2 à relire. */
  etape: 0 | 1 | 2;
  /** La phrase de la pause. */
  pause?: string;
  aRelire: CarteVideoLotIV[];
  videos: CarteVideoLotIV[];
  /** L'unique action de l'écran. */
  action: "arreter" | "reprendre" | "relire" | null;
  premiereARelire?: string;
  prixParVideoCentimes: number;
  /** La page se relit seule. */
  enCours: boolean;
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** « Lot de 4 images · 2 faites · 1 mise de côté » : la ligne d'un lot récent sur l'écran de dépôt. PUR. */
export function ligneDuLotIV(lot: LotIV): string {
  const r = resumeLotIV(lot);
  return `Lot de ${lot.videos.length} images · ${pluriel(r.faites, "faite", "faites")} · ${pluriel(r.misesDeCote, "mise de côté", "mises de côté")}`;
}

/** La page du lot, d'après le lot et ce que le studio sait de chaque vidéo (image, étape courante). PUR. */
export function construireVueLotIV(lot: LotIV, aides: { imageUrl: (v: VideoDuLotIV) => string | null; etape: (v: VideoDuLotIV) => string | undefined }): VueLotIV {
  const r = resumeLotIV(lot);
  const carte = (v: VideoDuLotIV): CarteVideoLotIV => {
    const base = { rang: v.rang, videoId: v.videoId, nom: v.nom, imageUrl: aides.imageUrl(v), statut: v.statut };
    if (v.statut === "en-attente") return { ...base, pastille: { libelle: "À venir", ton: "neutre" } };
    if (v.statut === "en-fabrication") return { ...base, pastille: { libelle: aides.etape(v) ?? "En fabrication", ton: "ambre" } };
    if (v.statut === "faite") return { ...base, pastille: { libelle: "Faite", ton: "sauge" }, voir: `/image-video/${v.videoId}` };
    if (v.statut === "mise-de-cote") return { ...base, pastille: { libelle: "Mise de côté", ton: "brique" }, motif: v.miseDeCote?.motif ?? "", ...(v.miseDeCote?.motif === PHRASES_LOT_IV.supprimee ? {} : { voir: `/image-video/${v.videoId}` }) };
    return { ...base, pastille: { libelle: "Refaite", ton: "neutre" }, ...(v.refaiteEn ? { nouvelle: `/image-video/${v.refaiteEn}` } : {}) };
  };
  const videos = [...lot.videos].sort((a, b) => a.rang - b.rang).map(carte);
  const aRelire = videos.filter((v) => v.statut === "mise-de-cote");
  const fini = lot.statut === "termine" || lot.statut === "arrete";
  const action: VueLotIV["action"] = lot.statut === "en-cours" ? "arreter" : lot.statut === "en-pause" ? "reprendre" : aRelire.length ? "relire" : null;
  return {
    id: lot.id,
    titre: `Lot de ${lot.videos.length} images`,
    sousTitre: `${pluriel(r.faites, "faite", "faites")} · ${pluriel(r.misesDeCote, "mise de côté", "mises de côté")} · ${r.enAttente + r.enFabrication} à venir`,
    statut: lot.statut,
    etape: fini ? 2 : 1,
    ...(lot.statut === "en-pause" && lot.pause ? { pause: lot.pause.phrase } : {}),
    aRelire,
    videos,
    action,
    ...(action === "relire" && aRelire[0]?.voir ? { premiereARelire: aRelire[0].voir } : {}),
    prixParVideoCentimes: lot.prixParVideoCentimes,
    enCours: lot.statut === "en-cours",
  };
}

/** La page du lot ; `null` : lot inconnu. Jamais d'exception. */
export async function vueLotImageVideo(lotId: string): Promise<VueLotIV | null> {
  await exigerSession();
  try {
    const lot = await lireLotIV(lotId);
    if (!lot) return null;
    const stockage = await import("./_commun").then((m) => m.fournisseur("stockage")).catch(() => null);
    const images = new Map<string, string | null>();
    const etapes = new Map<string, string | undefined>();
    for (const v of lot.videos) {
      const video = await depots().videos.obtenir(v.videoId);
      const cle = (video?.entrees?.imageVideo as { imageCle?: unknown } | undefined)?.imageCle;
      images.set(v.videoId, typeof cle === "string" && cle && stockage ? await stockage.urlLecture(cle).catch(() => null) : null);
      if (v.statut === "en-fabrication") {
        const e = etatDe(await dernierTravail(v.videoId));
        etapes.set(v.videoId, e ? ETAPES_ECRANS.find((x) => x.ecran === barreDe(e))?.nom : undefined);
      }
    }
    return construireVueLotIV(lot, { imageUrl: (v) => images.get(v.videoId) ?? null, etape: (v) => etapes.get(v.videoId) });
  } catch {
    return null;
  }
}

/** Les lots récents (3 au plus), pour l'écran de dépôt. Jamais d'exception. */
export async function dernieresLotsImageVideo(max = 3): Promise<{ lotId: string; ligne: string }[]> {
  await exigerSession();
  try {
    const sortie: { lotId: string; ligne: string }[] = [];
    for (const id of (await lotsDeLIndexIV()).slice(0, max)) {
      const lot = await lireLotIV(id);
      if (lot) sortie.push({ lotId: id, ligne: ligneDuLotIV(lot) });
    }
    return sortie;
  } catch {
    return [];
  }
}
