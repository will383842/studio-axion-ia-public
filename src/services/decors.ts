/**
 * DÉCORS (lot B1 ; `decors/CATALOGUE-DECORS.md`, plan B.3). Écran « Mes décors » de la Bibliothèque.
 *
 *  - Catalogue : fonds neutres (N1-N6), décors réalistes (R1-R8), 3 à 5 décors RÉCURRENTS mis en avant, la réserve à part.
 *  - « Un décor en une phrase » : coût affiché AVANT, confirmation, puis 3 propositions (une par ambiance) : photos SANS
 *    personne (fal.ai réel si relié, sinon les photos de l'essai), posées en `photo-incrustee`, vignette SUR le double
 *    (brique `composition`, opération `image-fixe`, gratuite). Will en garde une ; les autres sont RANGÉES (jamais
 *    supprimées).
 *  - Looks HeyGen (décors réalistes) : fabriqués AUTOMATIQUEMENT au premier usage du décor, coût affiché avant et
 *    confirmation ; rangés comme visages générés `a_verifier` ; réutilisés ensuite gratuitement. ÉTEINTS par défaut :
 *    sans `FOURNISSEUR_VISAGE=heygen`, le Look est SIMULÉ (aucun appel, aucun coût) et le dit.
 */
import "server-only";
import type { FournisseurIllustrationEtendu } from "@/fournisseurs/illustration/types";
import { attendreFabrication } from "@/fournisseurs/illustration/fal";
import type { DemandeRendu } from "@/fournisseurs";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import { obtenirServiceRendu, renduSimule } from "@/fournisseurs/rendu/client";
import { segmentStockage } from "@/fournisseurs/rendu/commun";
import { photoDecorSimulee, PHOTOS_DECOR_SIMULEES } from "@/fournisseurs/simulation/autres";
import { decorDepuisValeur, doubleVignette, parametresVignetteDecor, proprietesVignetteDecor } from "@/briques/composition";
import {
  CENTIMES_USD_PAR_LOOK,
  consigneLook,
  estimationLook,
  MESSAGE_PRIX_LOOK_A_CONFIRMER,
  PRIX_LOOK_A_CONFIRMER,
  etatDecor,
  LIBELLES_ETAT_DECOR,
  nomDecorDemande,
  ordonnerDecors,
  peutMettreEnAvant,
  PROPOSITIONS_PAR_DEMANDE,
  requetesPropositions,
  sujetDecorEn,
  type EtatDecor,
} from "@/domaine/decors";
import { TARIFS_FABRICATION_USD } from "@/domaine/illustrations";
import type { AngleVisage, DateIso, ElementBibliotheque, Fichier, Id, Montant, ValeurDecor } from "@/domaine/types";
import { descriptionEnCatalogue } from "@/donnees/decors-catalogue";
import { DECORS_DANS_HEYGEN, LOOKS_HEYGEN_PAR_LE_STUDIO } from "@/fournisseurs/heygen/rendus";
import { etatConnexion, resoudreFournisseur } from "@/fournisseurs";
import type { LookExistant } from "@/fournisseurs/types";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";
import { nouvelId } from "@/lib/ids";
import { centimes, TAUX_USD_EUR_PAR_DEFAUT, usdVersEur } from "@/lib/montants";
import type { OrigineLancement } from "./budget-mensuel";
import { depots, ecrireParametre, ErreurStudio, fournisseur, horodatage, journaliser, lireParametre, maintenant, ressourceActive } from "./_commun";
import { exigerSession } from "./auth";
import { urlsFichiers } from "./fichiers";
import { doublesDeBasePourLooks, enregistrerLookGenere } from "./personnages";
import { accordDonne, type AccordPrix } from "@/domaine/accord";
import { budgetIndicatifPour } from "./mode-budget";

/** Double simulé seul (fond transparent), posé par l'écran sur une photo qui n'a pas encore sa vignette. */
export const SILHOUETTE_DOUBLE = "/demo/decors/silhouette.png";

export interface VueDecor {
  id: Id;
  nom: string;
  code?: string;
  etat: EtatDecor;
  libelleEtat: string;
  ton: (typeof LIBELLES_ETAT_DECOR)[EtatDecor]["ton"];
  /** Image du décor seul (fond, photo). */
  image: string | null;
  /** Vignette SUR le double, si calculée. */
  surDouble: string | null;
  description?: string;
  ambiance?: string;
  misEnAvant: boolean;
  reserve: boolean;
  clair: boolean;
  methode: NonNullable<ValeurDecor["methode"]>;
  demande?: { texte: string; le: string; retenu: boolean; groupe: Id[] };
  range: boolean;
  /** Le défaut du format avocat (N1). */
  defautAvocat: boolean;
  /** Correcteur réel 2 : looks HeyGen reliés à ce décor, par angle. */
  looksRelies: { angle: AngleVisage; idExterne: string }[];
}

export interface EcranDecors {
  recurrents: VueDecor[];
  realistes: VueDecor[];
  demandes: VueDecor[];
  autres: VueDecor[];
  reserve: VueDecor[];
  ranges: VueDecor[];
  /** Les photos des demandes sont fabriquées pour de vrai (fal.ai relié). */
  photosReelles: boolean;
  /** Les Looks sont allumés (`FOURNISSEUR_VISAGE=heygen`). */
  looksReels: boolean;
  silhouette: string;
}

const estDecor = (e: ElementBibliotheque): e is ElementBibliotheque & { valeur: ValeurDecor } => e.type === "decor" && e.valeur.type === "decor";

async function tauxUsdEur(): Promise<number> {
  return lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
}

async function fabricationPhotos() {
  const f = (await fournisseur("illustration")) as FournisseurIllustrationEtendu;
  return f.mode === "reel" && f.fabrication ? f.fabrication : null;
}

async function versVues(elements: (ElementBibliotheque & { valeur: ValeurDecor })[]): Promise<VueDecor[]> {
  const urls = await urlsFichiers(elements.flatMap((e) => [e.valeur.imageFichierId, e.fichierId, e.vignetteFichierId, e.valeur.vignetteDoubleFichierId]));
  return elements.map((e) => {
    const v = e.valeur;
    const etat = etatDecor(v);
    const groupe = v.demande?.propositionIds ?? [];
    return {
      id: e.id,
      nom: e.nom,
      code: v.catalogue?.code,
      etat,
      libelleEtat: LIBELLES_ETAT_DECOR[etat].libelle,
      ton: LIBELLES_ETAT_DECOR[etat].ton,
      image: urls[v.imageFichierId ?? ""] ?? urls[e.vignetteFichierId ?? ""] ?? urls[e.fichierId ?? ""] ?? null,
      surDouble: urls[v.vignetteDoubleFichierId ?? ""] ?? null,
      description: v.description,
      ambiance: v.ambiance,
      misEnAvant: !!v.catalogue?.misEnAvant,
      reserve: !!v.catalogue?.reserve,
      clair: !!v.clair,
      methode: v.methode ?? "neutre-incruste",
      demande: v.demande ? { texte: v.demande.texte, le: v.demande.le, retenu: !!v.demande.retenu, groupe } : undefined,
      range: !!e.archiveLe,
      defautAvocat: e.id === "decor-n1-halo-orange",
      looksRelies: (Object.entries(v.lookIdParAngle ?? {}) as [AngleVisage, string | undefined][]).filter((x): x is [AngleVisage, string] => !!x[1]).map(([angle, idExterne]) => ({ angle, idExterne })),
    };
  });
}

/** L'écran « Mes décors » : récurrents, réalistes, mes demandes, autres, réserve, rangés. */
export async function ecranDecors(): Promise<EcranDecors> {
  await exigerSession();
  // CORRECTEUR 1 — B4 : les photos payées pas encore arrivées sont suivies (aucun paiement) avant l'affichage.
  await reprendreLotsDecors().catch((e) => console.error("[studio] suivi des décors demandés en échec", e));
  // Correcteur réel 2 (F2) : looks HeyGen en préparation suivis (lecture gratuite) ; aperçu posé en vignette une fois prêts.
  await suivreLooks().catch((e) => console.error("[studio] suivi des looks en échec", e));
  const tous = (await depots().elements.lister((e) => e.type === "decor")).filter(estDecor);
  const actifs = tous.filter((e) => !e.archiveLe);
  const { proposes, reserve } = ordonnerDecors(actifs);
  const vues = new Map((await versVues(tous)).map((v) => [v.id, v]));
  const vue = (e: { id: Id }) => vues.get(e.id)!;
  const recurrents = proposes.filter((e) => e.valeur.catalogue?.misEnAvant).map(vue);
  const realistes = proposes.filter((e) => !e.valeur.catalogue?.misEnAvant && e.valeur.methode === "look-heygen").map(vue);
  const demandes = proposes.filter((e) => !e.valeur.catalogue?.misEnAvant && e.valeur.methode !== "look-heygen" && !!e.valeur.demande).map(vue);
  const autres = proposes.filter((e) => !e.valeur.catalogue?.misEnAvant && e.valeur.methode !== "look-heygen" && !e.valeur.demande).map(vue);
  // Les demandes les plus récentes d'abord, chaque groupe de propositions ensemble.
  demandes.sort((a, b) => (b.demande?.le ?? "").localeCompare(a.demande?.le ?? "") || a.nom.localeCompare(b.nom, "fr"));
  const ranges = tous.filter((e) => !!e.archiveLe).map(vue);
  const visage = await fournisseur("visage");
  return {
    recurrents,
    realistes,
    demandes,
    autres,
    reserve: reserve.map(vue),
    ranges,
    photosReelles: !!(await fabricationPhotos()),
    looksReels: visage.mode === "reel",
    silhouette: SILHOUETTE_DOUBLE,
  };
}

/* ------------------------------------------------------------------ */
/* « Un décor en une phrase » → 3 propositions                           */
/* ------------------------------------------------------------------ */

export interface EstimationDemandeDecor {
  /** Ce que le studio a compris (mots du lieu, en anglais pour le générateur). */
  compris: string;
  propositions: number;
  cout: Montant;
  /** Essai : aucune dépense, les photos de l'essai sont posées. */
  essai: boolean;
}

/** Coût AVANT confirmation (rien n'est lancé). */
export async function estimerDemandeDecor(texte: string): Promise<EstimationDemandeDecor> {
  await exigerSession();
  const phrase = texte.trim();
  if (phrase.length < 3) throw new ErreurStudio("VIDE", "Décrivez le décor en une phrase.");
  const requetes = requetesPropositions(phrase);
  if (!requetes.length) throw new ErreurStudio("INCOMPRIS", "Décrivez un lieu (« un bureau avec une bibliothèque »), sans personne.");
  const reel = !!(await fabricationPhotos());
  const cout = reel ? usdVersEur(requetes.length * TARIFS_FABRICATION_USD.image, await tauxUsdEur()) : centimes(0);
  return { compris: sujetDecorEn(phrase), propositions: requetes.length, cout, essai: !reel };
}

/** Enregistre un fichier image déjà déposé (clé de NOTRE stockage). */
async function enregistrerFichier(cle: string, nom: string, mime: string, largeur?: number, hauteur?: number): Promise<Fichier> {
  return depots().fichiers.enregistrer({ id: nouvelId("f"), cleStockage: cle, nom, mime, taille: 0, largeur, hauteur, origine: "fabrication", statut: "pret", ...horodatage() });
}

/**
 * Vignette SUR le double, calculée par `studio-rendu` (opération `image-fixe`, composition commune) : gratuite.
 * Sans conteneur ni stockage réel, rien n'est calculé (l'écran pose le double simulé sur la photo) ; null.
 */
export async function calculerVignetteSurDouble(decor: ElementBibliotheque & { valeur: ValeurDecor }, env: Record<string, string | undefined> = process.env): Promise<Id | null> {
  const d = depots();
  const stockage = await fournisseur("stockage");
  if (renduSimule(env) || !stockage.urlLectureDuree || !stockage.urlDepotDuree) return null;
  const image = decor.valeur.imageFichierId ? await d.fichiers.obtenir(decor.valeur.imageFichierId) : null;
  // Double : l'image détourée du visage principal si elle existe, sinon la silhouette simulée.
  const principal = (await d.visages.lister((v) => v.statut === "pret" && !!v.detoureFichierId && (v.origine ?? "filme") === "filme"))[0];
  const detoure = principal?.detoureFichierId ? await d.fichiers.obtenir(principal.detoureFichierId) : null;
  const entrees: Record<string, string> = {};
  if (image) entrees.decor = await stockage.urlLectureDuree(image.cleStockage, 3600);
  if (detoure) entrees["double-principal"] = await stockage.urlLectureDuree(detoure.cleStockage, 3600);
  const proprietes = proprietesVignetteDecor({ decor: decorDepuisValeur(decor.valeur, !!image, RECETTE_COMPOSITION_AVOCAT.decorRepli), double: doubleVignette(!!detoure) });
  const cle = `studio/${segmentStockage(env)}/decors/${decor.id}/sur-double-${Date.now().toString(36)}.png`;
  const demande: DemandeRendu = {
    idRendu: `vignette-decor-${decor.id}-${Date.now().toString(36)}`,
    operation: "image-fixe",
    file: "courte",
    entrees,
    sortie: { urlDepot: await stockage.urlDepotDuree(cle, 3600, "image/png"), cle },
    parametres: parametresVignetteDecor(proprietes),
  };
  // Attente partagée (une seule boucle pour tout le studio), sans nouvel essai : un échec laisse la vignette d'avant.
  const fait = await executerRendu(obtenirServiceRendu(env), demande, { delaiMs: 60_000, essais: 0 }).catch(() => null);
  if (!fait) return null;
  return (await enregistrerFichier(cle, `${decor.nom} sur le double.png`, "image/png", 1080, 1920)).id;
}

/* CORRECTEUR 1 — B4 : le LOT de décors demandé, gardé en base (réglage `decors.lot.<id>`), avec chaque demande. */
interface DemandePhotoDecor {
  /** Rang dans les propositions (ambiance). */
  i: number;
  requete: string;
  /** Identifiant de la demande chez le fabricant : gardé dès la soumission (payée). */
  idDemande?: string;
  statut: "a-soumettre" | "soumise" | "faite" | "echec" | "incertaine";
  photo?: { cle: string; mime: string; coutUsd: number; largeur?: number; hauteur?: number };
  elementId?: Id;
}
interface LotDecors {
  id: string;
  phrase: string;
  le: DateIso;
  statut: "en_cours" | "fini";
  demandes: DemandePhotoDecor[];
}
const CLE_INDEX_LOTS = "decors.lots";
const cleLot = (id: string) => `decors.lot.${id}`;

async function lotsEnCours(): Promise<LotDecors[]> {
  const ids = await lireParametre<string[]>(CLE_INDEX_LOTS, []);
  const lots: LotDecors[] = [];
  for (const id of ids) {
    const l = await lireParametre<LotDecors | null>(cleLot(id), null);
    if (l?.statut === "en_cours") lots.push(l);
  }
  return lots;
}

async function enregistrerLot(lot: LotDecors): Promise<void> {
  await ecrireParametre(cleLot(lot.id), lot);
  const ids = await lireParametre<string[]>(CLE_INDEX_LOTS, []);
  // L'index ne garde que les lots en cours (un lot fini reste lisible sous sa clé : rien n'est effacé).
  const suivants = lot.statut === "en_cours" ? (ids.includes(lot.id) ? ids : [...ids, lot.id]) : ids.filter((x) => x !== lot.id);
  if (suivants.length !== ids.length || suivants.some((x, i) => x !== ids[i])) await ecrireParametre(CLE_INDEX_LOTS, suivants);
}

/** Les décors d'un lot pas encore créés (photos arrivées) deviennent des propositions ; renvoie tous ceux du lot. */
async function creerPropositionsDuLot(lot: LotDecors, reel: boolean): Promise<Id[]> {
  const d = depots();
  const requetes = requetesPropositions(lot.phrase);
  for (const dem of lot.demandes) {
    if (dem.statut !== "faite" || !dem.photo || dem.elementId) continue;
    const ambiance = requetes[dem.i]?.ambiance ?? requetes[0].ambiance;
    const p = dem.photo;
    const f = await enregistrerFichier(p.cle, `${nomDecorDemande(lot.phrase, ambiance.libelle)}.jpg`, p.mime, p.largeur ?? (reel ? 768 : undefined), p.hauteur ?? (reel ? 1344 : undefined));
    const surDouble = !reel ? p.cle.replace("/propositions/", "/propositions/sur-double/") : undefined;
    const vignetteDouble = surDouble ? await enregistrerFichier(surDouble, `${ambiance.libelle} sur le double.jpg`, "image/jpeg", 540, 960) : null;
    const clair = ambiance.code === "jour";
    const element: ElementBibliotheque & { valeur: ValeurDecor } = {
      id: nouvelId("decor"),
      type: "decor",
      nom: nomDecorDemande(lot.phrase, ambiance.libelle),
      motsCles: sujetDecorEn(lot.phrase).split(", ").slice(0, 6),
      fichierId: f.id,
      vignetteFichierId: f.id,
      licence: { type: "generee-ia", usageCommercial: true, reseaux: [], source: reel ? "fal.ai (Nano Banana)" : "Essai du studio" },
      formatsParDefaut: [],
      marqueId: "marque-axion",
      valeur: {
        type: "decor",
        mode: "image",
        imageFichierId: f.id,
        methode: "photo-incrustee",
        // Une photo réelle est toujours floutée (profondeur de champ) : 14 px à 1080 de large.
        profondeurFlou: 14,
        teinte: clair ? "#E9E1D4" : "#1A120B",
        teinteLumiere: clair ? "#F2D6A8" : "#D69650",
        directionLumiere: clair ? "gauche" : "droite",
        positionSujet: 0.5,
        clair,
        lutsConseillees: clair ? ["Doux", "Naturel"] : undefined,
        ambiance: ambiance.libelle,
        description: lot.phrase,
        statut: "a_verifier",
        vignetteDoubleFichierId: vignetteDouble?.id,
        demande: { texte: lot.phrase, le: lot.le },
      },
      ...horodatage(),
    };
    await d.elements.enregistrer(element);
    dem.elementId = element.id;
  }
  const ids = lot.demandes.flatMap((x) => (x.elementId ? [x.elementId] : []));
  // Le groupe des propositions est connu de chacune (choix et rangement des autres).
  for (const id of ids) {
    const e = await d.elements.obtenir(id);
    if (e && estDecor(e) && (e.valeur.demande?.propositionIds ?? []).join("|") !== ids.join("|")) await d.elements.modifier(id, { valeur: { ...e.valeur, demande: { ...e.valeur.demande!, propositionIds: ids } } });
  }
  // Vignettes sur le double (gratuites) quand `studio-rendu` est relié ; sinon l'écran pose le double simulé.
  for (const id of ids) {
    const e = await d.elements.obtenir(id);
    if (!e || !estDecor(e) || e.valeur.vignetteDoubleFichierId) continue;
    const v = await calculerVignetteSurDouble(e).catch(() => null);
    if (v) await d.elements.modifier(id, { valeur: { ...e.valeur, vignetteDoubleFichierId: v } });
  }
  return ids;
}

/**
 * Suit les demandes soumises (déjà PAYÉES) d'un lot : une photo arrivée est rangée, une panne du suivi garde la demande
 * pour la prochaine fois (jamais une nouvelle demande payante). `attenteMs` : 0 = un seul coup d'œil.
 */
async function suivreLot(lot: LotDecors, fabrication: NonNullable<Awaited<ReturnType<typeof fabricationPhotos>>>, attenteMs: number): Promise<void> {
  await Promise.all(
    lot.demandes.map(async (dem) => {
      if (dem.statut !== "soumise" || !dem.idDemande) return;
      try {
        const r = attenteMs > 0 ? await attendreFabrication(fabrication, dem.idDemande, attenteMs, 2000) : await fabrication.suivre(dem.idDemande);
        if (r.statut === "fait") {
          dem.statut = "faite";
          dem.photo = { cle: r.fichierCle, mime: r.mime, coutUsd: r.coutUsdCentimes };
        } else if (r.statut === "echec") dem.statut = "echec";
      } catch (e) {
        // Refus net de la demande : abandonnée. Panne du suivi ou délai : la demande payée est gardée.
        if ((e as { erreur?: { reessayable?: boolean } })?.erreur?.reessayable === false) dem.statut = "echec";
      }
    }),
  );
  if (!lot.demandes.some((x) => x.statut === "soumise")) lot.statut = "fini";
}

/**
 * CORRECTEUR 1 — B4 : reprend le suivi des lots de décors en cours (photos payées pas encore arrivées) : un coup
 * d'œil chez le fabricant, les photos arrivées deviennent des propositions. Aucun paiement. Appelé par l'écran
 * « Mes décors » et avant toute nouvelle demande.
 */
export async function reprendreLotsDecors(): Promise<LotDecors[]> {
  // Un lot dont les soumissions partent en ce moment (dans ce processus) n'est pas touché : il s'écrit lui-même.
  const lots = (await lotsEnCours()).filter((l) => !lotsEnSoumission().has(l.id));
  if (!lots.length) return [];
  for (const lot of lots) await solderLotInterrompu(lot);
  const fabrication = await fabricationPhotos();
  if (!fabrication) return lots;
  for (const lot of lots) {
    await suivreLot(lot, fabrication, 0);
    await creerPropositionsDuLot(lot, true);
    await enregistrerLot(lot);
  }
  return lots;
}

/** Lots dont les soumissions partent en ce moment dans ce processus (relecture paquet 4). */
const cleLotsEnSoumission = Symbol.for("studio-axion-ia.decors-en-soumission");
function lotsEnSoumission(): Set<string> {
  const g = globalThis as typeof globalThis & { [cleLotsEnSoumission]?: Set<string> };
  return (g[cleLotsEnSoumission] ??= new Set());
}

/**
 * Relecture paquet 4 (exactitude petit défaut 2) : lot coupé par un arrêt du serveur pendant ses soumissions. Une demande
 * restée « à soumettre » a pu partir : elle compte comme payée (« incertaine », jamais refaite). La dépense est écrite si
 * elle manque, puis la réservation est soldée. Aucun appel réseau.
 */
async function solderLotInterrompu(lot: LotDecors): Promise<void> {
  const d = depots();
  if (!lot.demandes.some((x) => x.statut === "a-soumettre") && (await d.depenses.trouver((x) => x.travailId === lot.id))) return;
  for (const dem of lot.demandes) if (dem.statut === "a-soumettre") dem.statut = "incertaine";
  const payees = lot.demandes.filter((x) => x.statut === "soumise" || x.statut === "incertaine" || x.statut === "faite").length;
  if (payees && !(await d.depenses.trouver((x) => x.travailId === lot.id))) {
    const taux = await tauxUsdEur();
    const prixUnitaire = usdVersEur(TARIFS_FABRICATION_USD.image, taux);
    const cout = usdVersEur(payees * TARIFS_FABRICATION_USD.image, taux);
    await d.depenses.enregistrer({ id: nouvelId("dep"), travailId: lot.id, lignes: [{ etape: "Décor demandé", fournisseur: "fal", unite: "image", quantite: payees, prixUnitaire, total: cout, nature: "reel" }], total: cout, date: lot.le, ...horodatage() });
    await journaliser("bibliotheque", `Décor « ${lot.phrase} » : demande coupée par un redémarrage, comptée comme payée`);
  }
  if (!lot.demandes.some((x) => x.statut === "soumise")) lot.statut = "fini";
  await enregistrerLot(lot);
  const { libererReservation } = await import("./credits");
  await libererReservation(lot.id, "consommee");
}

/** Phrase quand des photos payées ne sont pas encore arrivées. */
const PHOTOS_EN_PREPARATION = "Les photos sont encore en préparation. Rouvrez « Mes décors » dans un instant : elles arriveront sans nouveau paiement.";

/**
 * « Demander un décor » : 3 propositions, photos SANS personne. `confirme` est exigé (le coût a été affiché par
 * `estimerDemandeDecor`). Chaque proposition est un décor `photo-incrustee`, `a_verifier`, avec sa demande.
 * CORRECTEUR 1 — B4 : contrôle du budget AVEC réservation (verrou des crédits) ; chaque demande est gardée dans le lot
 * dès sa soumission et la dépense est comptée aussitôt ; une photo pas encore arrivée est SUIVIE plus tard (jamais
 * redemandée ni repayée). La même phrase redemandée pendant qu'un lot attend reprend ce lot.
 */
export async function demanderDecor(texte: string, options: { confirme: AccordPrix; origine?: OrigineLancement }): Promise<{ propositionIds: Id[]; cout: Montant; essai: boolean }> {
  await exigerSession();
  if (!accordDonne(options.confirme) && !(await budgetIndicatifPour(options.origine))) throw new ErreurStudio("CONFIRMATION", "Confirmez d'abord le coût affiché.");
  const phrase = texte.trim().slice(0, 200);
  const requetes = requetesPropositions(phrase);
  if (!requetes.length || requetes.length !== PROPOSITIONS_PAR_DEMANDE) throw new ErreurStudio("INCOMPRIS", "Décrivez un lieu (« un bureau avec une bibliothèque »), sans personne.");
  const d = depots();
  const fabrication = await fabricationPhotos();
  const taux = await tauxUsdEur();
  const prixUnitaire = usdVersEur(TARIFS_FABRICATION_USD.image, taux);

  // Un lot de la même phrase attend encore ses photos (payées) : il reprend, rien n'est redemandé.
  // (Un lot fini pendant cette reprise est rendu aussi : ses propositions viennent d'arriver.)
  const memePhrase = (await reprendreLotsDecors()).find((l) => l.phrase === phrase);
  if (memePhrase) {
    const ids = memePhrase.demandes.flatMap((x) => (x.elementId ? [x.elementId] : []));
    if (memePhrase.statut === "en_cours" && !ids.length) throw new ErreurStudio("EN_PREPARATION", PHOTOS_EN_PREPARATION);
    const payees = memePhrase.demandes.filter((x) => x.statut !== "a-soumettre" && x.statut !== "echec").length;
    return { propositionIds: ids, cout: usdVersEur(payees * TARIFS_FABRICATION_USD.image, taux), essai: false };
  }

  const le = maintenant();
  const lotId = `decor-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const lot: LotDecors = { id: lotId, phrase, le, statut: "en_cours", demandes: requetes.map(({ requete }, i) => ({ i, requete, statut: "a-soumettre" })) };

  if (!fabrication) {
    // Essai : les photos de l'essai, aucune dépense.
    for (const dem of lot.demandes) {
      const p = photoDecorSimulee(dem.i);
      dem.statut = "faite";
      dem.photo = { cle: p.fichierCle, mime: p.mime, coutUsd: 0, largeur: p.largeur, hauteur: p.hauteur };
    }
    lot.statut = "fini";
    const ids = await creerPropositionsDuLot(lot, false);
    await enregistrerLot(lot);
    await journaliser("bibliotheque", `Décor demandé : « ${phrase} » — ${ids.length} propositions (essai)`);
    return { propositionIds: ids, cout: centimes(0), essai: true };
  }

  // E2E-2 argent n° 15 + CORRECTEUR 1 — B4 : budget du mois et crédit contrôlés AVANT l'appel, avec réservation (deux
  // demandes simultanées ne passent pas sur le même restant). La réservation est libérée dès que la dépense est comptée.
  const total = usdVersEur(requetes.length * TARIFS_FABRICATION_USD.image, taux);
  const { verifierEtReserverSelonOrigine, libererReservation } = await import("./credits");
  await verifierEtReserverSelonOrigine(options.origine, { lignes: [{ etape: "Décor demandé", fournisseur: "fal", unite: "image", quantite: requetes.length, prixUnitaire, total, nature: "estime" }], total }, options.confirme, "Ce décor", { videoId: lotId, travailId: lotId });

  // Soumissions : chaque identifiant est gardé dans le lot dès la réponse. Une soumission incertaine (la demande a pu
  // partir) n'est pas refaite et compte comme payée.
  // Relecture paquet 4 (petit défaut 2) : le lot est écrit en base AVANT les soumissions (toutes « à soumettre »), puis
  // après chacune ; un arrêt du serveur entre-temps est soldé à la reprise (`solderLotInterrompu`). La réservation n'est
  // libérée qu'une fois la dépense écrite.
  lotsEnSoumission().add(lotId);
  let ecriture: Promise<void> = Promise.resolve();
  const sauver = () => (ecriture = ecriture.then(() => enregistrerLot(lot)));
  let depenseEcrite = false;
  try {
    await sauver();
    await Promise.all(
      lot.demandes.map(async (dem) => {
        try {
          dem.idDemande = (await fabrication.soumettre({ genre: "image", requete: dem.requete, ratio: "9:16", cleIdempotence: `${lotId}-${dem.i}` })).idDemande;
          dem.statut = "soumise";
        } catch (e) {
          dem.statut = (e as { soumissionIncertaine?: boolean } | null)?.soumissionIncertaine ? "incertaine" : "echec";
        }
        await sauver();
      }),
    );
    await sauver();
    // Dépense comptée DÈS la soumission (ce qui est parti est payé), au tarif relevé.
    const payees = lot.demandes.filter((x) => x.statut === "soumise" || x.statut === "incertaine").length;
    if (payees) {
      const cout = usdVersEur(payees * TARIFS_FABRICATION_USD.image, taux);
      await d.depenses.enregistrer({ id: nouvelId("dep"), travailId: lotId, lignes: [{ etape: "Décor demandé", fournisseur: "fal", unite: "image", quantite: payees, prixUnitaire, total: cout, nature: "reel" }], total: cout, date: le, ...horodatage() });
    }
    depenseEcrite = true;
  } finally {
    lotsEnSoumission().delete(lotId);
    // Dépense écrite : la réservation est soldée. Sinon (panne de la base) elle reste active : la reprise du lot la soldera.
    if (depenseEcrite) await libererReservation(lotId, "consommee");
  }

  // Suivi borné ; ce qui n'est pas arrivé reste gardé dans le lot (repris par « Mes décors » ou la même demande).
  await suivreLot(lot, fabrication, 180_000);
  const ids = await creerPropositionsDuLot(lot, true);
  await enregistrerLot(lot);
  const payees = lot.demandes.filter((x) => x.statut === "soumise" || x.statut === "incertaine" || x.statut === "faite").length;
  if (!ids.length) {
    if (lot.statut === "en_cours") throw new ErreurStudio("EN_PREPARATION", PHOTOS_EN_PREPARATION);
    throw new ErreurStudio("FABRICATION", "Aucune photo n'a pu être fabriquée. Réessayez dans un instant.");
  }
  await journaliser("bibliotheque", `Décor demandé : « ${phrase} » — ${ids.length} propositions`);
  return { propositionIds: ids, cout: usdVersEur(payees * TARIFS_FABRICATION_USD.image, taux), essai: false };
}

/** Will garde UNE proposition : elle devient un décor prêt ; les autres du même groupe sont RANGÉES (jamais supprimées). */
export async function garderProposition(id: Id): Promise<{ ranges: Id[] }> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(id);
  if (!e || !estDecor(e) || !e.valeur.demande) throw new ErreurStudio("INTROUVABLE", "Cette proposition n'existe plus.");
  await d.elements.modifier(id, { archiveLe: undefined, valeur: { ...e.valeur, statut: "valide", demande: { ...e.valeur.demande, retenu: true } } });
  const ranges: Id[] = [];
  for (const autre of e.valeur.demande.propositionIds ?? []) {
    if (autre === id) continue;
    const a = await d.elements.obtenir(autre);
    if (!a || a.archiveLe || !estDecor(a) || a.valeur.demande?.retenu) continue;
    await d.elements.modifier(autre, { archiveLe: maintenant() });
    ranges.push(autre);
  }
  await journaliser("bibliotheque", `Décor gardé : ${e.nom}${ranges.length ? ` (${ranges.length} autre${ranges.length > 1 ? "s" : ""} rangée${ranges.length > 1 ? "s" : ""})` : ""}`, { type: "element", id });
  return { ranges };
}

/** Range ou remet un décor (jamais supprimé). Le décor par défaut de l'avocat ne se range pas. */
export async function rangerDecor(id: Id, ranger: boolean): Promise<void> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(id);
  if (!e || !estDecor(e)) throw new ErreurStudio("INTROUVABLE", "Ce décor n'existe plus.");
  if (ranger && id === "decor-n1-halo-orange") throw new ErreurStudio("DEFAUT", "Halo orange est le décor par défaut de l'avocat : il reste.");
  await d.elements.modifier(id, { archiveLe: ranger ? maintenant() : undefined });
  await journaliser("bibliotheque", `${ranger ? "Rangé" : "Remis"} : ${e.nom}`, { type: "element", id });
}

/** Met en avant (décors récurrents, 5 au plus) ou retire. */
export async function mettreEnAvant(id: Id, oui: boolean): Promise<void> {
  await exigerSession();
  const d = depots();
  const tous = (await d.elements.lister((e) => e.type === "decor")).filter(estDecor);
  const e = tous.find((x) => x.id === id);
  if (!e) throw new ErreurStudio("INTROUVABLE", "Ce décor n'existe plus.");
  if (oui) {
    const r = peutMettreEnAvant(tous, id);
    if (!r.ok) throw new ErreurStudio("RECURRENTS", r.raison);
  }
  const catalogue = e.valeur.catalogue ?? { code: "", ordre: 50 };
  await d.elements.modifier(id, { favori: oui, valeur: { ...e.valeur, catalogue: { ...catalogue, misEnAvant: oui || undefined, reserve: oui ? undefined : catalogue.reserve } } });
}

/** Will valide un décor sur capture (proposition gardée, ou Look vérifié). */
export async function validerDecor(id: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(id);
  if (!e || !estDecor(e)) throw new ErreurStudio("INTROUVABLE", "Ce décor n'existe plus.");
  await d.elements.modifier(id, { valeur: { ...e.valeur, statut: "valide" } });
  // Les visages générés pour ce décor (retrouvés par l'identifiant de leur look) sont validés avec lui.
  const looks = new Set(Object.values(e.valeur.lookIdParAngle ?? {}).filter(Boolean));
  for (const r of await d.ressourcesFournisseurs.lister((x) => x.entite === "visage" && looks.has(x.idExterne) && !x.remplaceeLe)) {
    const v = await d.visages.obtenir(r.entiteId);
    if (v?.origine === "genere" && v.statut === "a_verifier") {
      await d.visages.modifier(v.id, { statut: "pret" });
      await d.ressourcesFournisseurs.modifier(r.id, { statut: "pret" });
    }
  }
  await journaliser("bibliotheque", `Décor validé sur capture : ${e.nom}`, { type: "element", id });
}

/* ------------------------------------------------------------------ */
/* Looks HeyGen : au premier usage, coût affiché, confirmation           */
/* ------------------------------------------------------------------ */

export interface EstimationLook {
  decorId: Id;
  nom: string;
  angles: AngleVisage[];
  cout: Montant;
  /** Les Looks existent déjà : réutilisés gratuitement. */
  reutilise: boolean;
  /** Looks éteints : un essai simulé (aucun appel, aucun coût). */
  essai: boolean;
  /** Ce qui empêche la création (pas de double, décor qui n'est pas un Look). */
  bloque?: string;
  /** Correcteur réel 2 (F5) : le prix d'un look HeyGen n'est pas documenté : phrase montrée avec le montant provisoire. */
  prixAConfirmer?: string;
}

/**
 * Correcteur réel 2 (F1) : looks HeyGen payants créés par le studio seulement si Will a allumé « Créer vos décors avec
 * HeyGen » (Réglages › Connexions › Double ; éteint par défaut, `LOOKS_HEYGEN_PAR_LE_STUDIO`).
 */
async function looksHeygenEteints(fournisseurId: string): Promise<boolean> {
  if (fournisseurId !== "heygen") return false;
  const { looksStudioAllumes } = await import("./rendu-double");
  return !(LOOKS_HEYGEN_PAR_LE_STUDIO || (await looksStudioAllumes()));
}

/** Angles du double qui portent un look ; F3 : avec `deuxAngles`, l'angle manquant part du même look filmé (caméra à 30°). */
async function anglesDeBase(fournisseurId: string, deuxAngles = false) {
  const bases = await doublesDeBasePourLooks(fournisseurId, !(await looksHeygenEteints(fournisseurId)));
  if (!deuxAngles || !bases.length) return bases;
  const sortie = [...bases];
  for (const angle of ["trois-quarts", "face"] as AngleVisage[]) if (!sortie.some((b) => b.angle === angle)) sortie.push({ ...bases[0], angle });
  return sortie;
}

const prixLookAConfirmer = (fournisseurId: string, essai: boolean) => (fournisseurId === "heygen" && !essai && PRIX_LOOK_A_CONFIRMER ? { prixAConfirmer: MESSAGE_PRIX_LOOK_A_CONFIRMER } : {});

/** Coût AVANT le premier usage d'un décor réaliste (rien n'est lancé). */
export async function estimerLookDecor(decorId: Id, options: { deuxAngles?: boolean } = {}): Promise<EstimationLook> {
  await exigerSession();
  const e = await depots().elements.obtenir(decorId);
  if (!e || !estDecor(e)) throw new ErreurStudio("INTROUVABLE", "Ce décor n'existe plus.");
  const f = await fournisseur("visage");
  const essai = f.mode !== "reel";
  if ((e.valeur.methode ?? "neutre-incruste") !== "look-heygen") return { decorId, nom: e.nom, angles: [], cout: centimes(0), reutilise: true, essai, bloque: "Ce décor est posé par le studio : rien à fabriquer." };
  if (await looksHeygenEteints(f.id)) return { decorId, nom: e.nom, angles: [], cout: centimes(0), reutilise: false, essai, bloque: DECORS_DANS_HEYGEN };
  const bases = await anglesDeBase(f.id, options.deuxAngles === true);
  const angles = bases.map((b) => b.angle);
  const est = estimationLook(e.valeur, angles);
  const bloque = !bases.length ? "Votre double n'existe pas encore : le décor sera fabriqué dès qu'il sera prêt." : undefined;
  return { decorId, nom: e.nom, angles: est.angles, cout: essai ? centimes(0) : usdVersEur(est.centimesUsd, await tauxUsdEur()), reutilise: est.reutilise && !!bases.length, essai, bloque, ...prixLookAConfirmer(f.id, essai) };
}

/**
 * Premier usage d'un décor réaliste : fabrique son Look pour chaque angle du double qui n'en a pas (1 crédit HeyGen par
 * angle), APRÈS confirmation. Le décor passe `a_verifier` ; chaque look est rangé comme visage généré. Un Look déjà
 * fabriqué n'est JAMAIS refait (réutilisé gratuitement).
 */
export async function preparerLookDecor(decorId: Id, options: { confirme: AccordPrix; deuxAngles?: boolean; origine?: OrigineLancement }): Promise<{ crees: AngleVisage[]; reutilise: boolean; essai: boolean }> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(decorId);
  if (!e || !estDecor(e)) throw new ErreurStudio("INTROUVABLE", "Ce décor n'existe plus.");
  if ((e.valeur.methode ?? "neutre-incruste") !== "look-heygen") throw new ErreurStudio("PAS_UN_LOOK", "Ce décor est posé par le studio : rien à fabriquer.");
  const f = await fournisseur("visage");
  if (await looksHeygenEteints(f.id)) throw new ErreurStudio("DECOR_DANS_HEYGEN", DECORS_DANS_HEYGEN);
  const bases = await anglesDeBase(f.id, options.deuxAngles === true);
  if (!bases.length) throw new ErreurStudio("DOUBLE_MANQUANT", "Votre double n'existe pas encore : le décor sera fabriqué dès qu'il sera prêt.");
  const manquants = bases.filter((b) => !e.valeur.lookIdParAngle?.[b.angle]);
  if (!manquants.length) return { crees: [], reutilise: true, essai: f.mode !== "reel" };
  if (!accordDonne(options.confirme) && !(await budgetIndicatifPour(options.origine))) throw new ErreurStudio("CONFIRMATION", "Confirmez d'abord le coût affiché.");
  const descriptionEn = descriptionEnCatalogue(e.valeur.catalogue?.code) ?? sujetDecorEn(e.valeur.description ?? e.nom);
  const lookIdParAngle = { ...(e.valeur.lookIdParAngle ?? {}) };
  const crees: AngleVisage[] = [];
  const fabriquer = async () => {
    try {
      for (const b of manquants) {
        const { idExterne, statut } = await f.creerLook({ visageId: b.idExterne, prompt: consigneLook(descriptionEn, b.angle, e.valeur.description ?? e.nom) });
        lookIdParAngle[b.angle] = idExterne;
        await enregistrerLookGenere({ base: b.visage, decorNom: e.nom, fournisseurId: f.id, idExterne, statut });
        crees.push(b.angle);
        // Enregistré à chaque look : une erreur sur le second angle ne fait jamais repayer le premier.
        await d.elements.modifier(decorId, { valeur: { ...e.valeur, lookIdParAngle: { ...lookIdParAngle }, statut: "a_verifier" } });
      }
    } finally {
      // L3-01 : la dépense des looks FAITS est enregistrée même si le suivant tombe en panne (avant : rien n'était compté).
      if (f.mode === "reel" && crees.length) {
        const taux = await tauxUsdEur();
        const total = usdVersEur(crees.length * 100, taux);
        await d.depenses.enregistrer({
          id: nouvelId("dep"),
          lignes: [{ etape: `Décor « ${e.nom} »`, fournisseur: "heygen", unite: "appel", quantite: crees.length, prixUnitaire: usdVersEur(100, taux), total, nature: "reel" }],
          total,
          date: maintenant(),
          ...horodatage(),
        });
      }
    }
  };
  // E2E-2 argent n° 15 : Looks payés (HeyGen relié) → budget du mois et crédit contrôlés AVANT le premier appel.
  // L3-01 : contrôle, réservation ET engagement sous le verrou des crédits, avec l'origine, le temps de fabriquer les looks.
  if (f.mode === "reel") {
    const taux = await tauxUsdEur();
    const total = usdVersEur(manquants.length * 100, taux);
    const { depenserSelonOrigine } = await import("./credits");
    await depenserSelonOrigine(options.origine, { lignes: [{ etape: `Décor « ${e.nom} »`, fournisseur: "heygen", unite: "appel", quantite: manquants.length, prixUnitaire: usdVersEur(100, taux), total, nature: "estime" }], total }, options.confirme, "Ce décor", { travailId: nouvelId("look") }, fabriquer);
  } else await fabriquer();
  await journaliser("bibliotheque", `Décor « ${e.nom} » fabriqué avec votre double (${crees.length} angle${crees.length > 1 ? "s" : ""}${f.mode === "reel" ? "" : ", essai"}) : à vérifier sur capture`, { type: "element", id: decorId });
  return { crees, reutilise: false, essai: f.mode !== "reel" };
}

/* ------------------------------------------------------------------ */
/* Correcteur réel 2 (04/10) : RELIER un look déjà fait dans HeyGen        */
/* ------------------------------------------------------------------ */

/** Angles qu'un look relié peut tenir (l'angle principal de l'avocat est le trois-quarts). */
const ANGLES_LOOK: AngleVisage[] = ["trois-quarts", "face"];

function visageHeygenBranche() {
  const f = resoudreFournisseur("visage", "heygen");
  const branche = f.id === "heygen" && f.mode === "reel" && !!f.listerLooks && !!f.garderApercuLook && etatConnexion("visage", "heygen") === "relie";
  return { f, branche };
}

/**
 * Les looks du compte HeyGen (Will dans un décor, fait DANS l'application HeyGen), pour « Relier un look HeyGen ».
 * Lecture GRATUITE ; rien n'est créé chez HeyGen. `branche: false` : HeyGen n'est pas relié au serveur.
 */
export async function looksHeygenPourDecors(): Promise<{ branche: boolean; looks: LookExistant[] }> {
  await exigerSession();
  const { f, branche } = visageHeygenBranche();
  if (!branche) return { branche: false, looks: [] };
  return { branche: true, looks: await f.listerLooks!() };
}

/**
 * « Relier ce look » : le look choisi (relu chez HeyGen, gratuit) devient celui du décor pour cet angle. Le double sera
 * rendu SUR ce look, avec son fond, au même tarif à la seconde. L'image d'aperçu devient la vignette du décor sur le
 * double. Le décor repasse « à vérifier » : il ne sert qu'après la validation de Will sur cette vignette. Un look
 * remplacé n'est pas effacé chez HeyGen (rien n'y est touché) ; l'ancien lien reste écrit au Journal.
 */
export async function relierLookDecor(decorId: Id, choix: { idExterne: string; angle: AngleVisage }): Promise<void> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(decorId);
  if (!e || !estDecor(e)) throw new ErreurStudio("INTROUVABLE", "Ce décor n'existe plus.");
  if ((e.valeur.methode ?? "neutre-incruste") !== "look-heygen") throw new ErreurStudio("PAS_UN_LOOK", "Ce décor est posé par le studio : choisissez un décor réaliste pour y relier un look HeyGen.");
  if (!ANGLES_LOOK.includes(choix.angle)) throw new ErreurStudio("ANGLE", "Choisissez « Trois quarts » ou « Presque de face ».");
  const idExterne = String(choix.idExterne ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(idExterne)) throw new ErreurStudio("INTROUVABLE", "Ce look n'existe pas dans votre compte HeyGen.");
  const { f, branche } = visageHeygenBranche();
  if (!branche) throw new ErreurStudio("HEYGEN_NON_RELIE", "HeyGen n'est pas encore relié au serveur.");
  // Seuls les looks DU COMPTE se relient (jamais un identifiant tapé à la main) ; relu une fois de plus, gratuitement.
  if (!(await f.listerLooks!()).some((l) => l.idExterne === idExterne)) throw new ErreurStudio("INTROUVABLE", "Ce look n'existe pas dans votre compte HeyGen.");
  const { look, apercuCle, mime } = await f.garderApercuLook!(idExterne);
  if (!look.utilisable) throw new ErreurStudio("LOOK_PAS_PRET", look.raison ?? "Ce look n'est pas encore prêt chez HeyGen.");
  const ancien = e.valeur.lookIdParAngle?.[choix.angle];
  const vignette = apercuCle ? (await enregistrerFichier(apercuCle, `${e.nom} sur le double`, mime ?? "image/jpeg")).id : e.valeur.vignetteDoubleFichierId;
  await d.elements.modifier(decorId, { valeur: { ...e.valeur, lookIdParAngle: { ...(e.valeur.lookIdParAngle ?? {}), [choix.angle]: idExterne }, statut: "a_verifier", ...(vignette ? { vignetteDoubleFichierId: vignette } : {}) } });
  await journaliser("bibliotheque", `Décor « ${e.nom} » relié au look HeyGen « ${look.nom} » (${choix.angle === "face" ? "presque de face" : "trois quarts"})${ancien && ancien !== idExterne ? `, à la place de ${ancien}` : ""} : à valider sur la vignette`, { type: "element", id: decorId });
}

/* ------------------------------------------------------------------ */
/* Correcteur réel 2 (F2) : un décor HeyGen depuis « Décrivez »           */
/* ------------------------------------------------------------------ */

/** Ce que « Décrivez » donnera : la consigne anglaise (tenue, décor, cadrage) et le prix, AVANT tout accord. */
export interface EstimationDecorDecrit {
  nom: string;
  consigne: string;
  angles: AngleVisage[];
  cout: Montant;
  essai: boolean;
  bloque?: string;
  prixAConfirmer?: string;
}

function nomDecorDecrit(phrase: string): string {
  const p = phrase.trim().replace(/\s+/g, " ").slice(0, 60);
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "Décor HeyGen";
}

export async function estimerDecorDepuisDescription(phrase: string, options: { deuxAngles?: boolean } = {}): Promise<EstimationDecorDecrit> {
  await exigerSession();
  const texte = String(phrase ?? "").trim();
  if (texte.length < 3) throw new ErreurStudio("TEXTE_COURT", "Décrivez le décor en quelques mots.");
  const f = await fournisseur("visage");
  const essai = f.mode !== "reel";
  const en = sujetDecorEn(texte);
  const eteint = await looksHeygenEteints(f.id);
  const bases = eteint ? [] : await anglesDeBase(f.id, options.deuxAngles === true);
  const angles = bases.map((b) => b.angle);
  const bloque = eteint ? DECORS_DANS_HEYGEN : !bases.length ? "Votre double n'existe pas encore : choisissez-le d'abord dans Personnages." : !en ? "Décrivez la pièce ou la tenue avec d'autres mots." : undefined;
  const cout = essai ? centimes(0) : usdVersEur(angles.length * CENTIMES_USD_PAR_LOOK, await tauxUsdEur());
  return { nom: nomDecorDecrit(texte), consigne: consigneLook(en, angles[0] ?? "trois-quarts"), angles, cout, essai, ...(bloque ? { bloque } : {}), ...prixLookAConfirmer(f.id, essai) };
}

/**
 * « Créer ce décor avec HeyGen » : un décor réaliste neuf (rangé dans la Bibliothèque, réutilisable) puis son look par
 * angle, APRÈS l'accord sur le prix affiché (`preparerLookDecor` : budget, crédit, dépense). Le décor reste « à
 * vérifier » jusqu'à la validation de Will sur sa vignette. Rien n'est créé si le réglage est éteint.
 */
export async function creerDecorDepuisDescription(phrase: string, options: { confirme: AccordPrix; deuxAngles?: boolean }): Promise<{ decorId: Id; crees: AngleVisage[]; essai: boolean }> {
  const est = await estimerDecorDepuisDescription(phrase, options);
  if (est.bloque) throw new ErreurStudio(est.bloque === DECORS_DANS_HEYGEN ? "DECOR_DANS_HEYGEN" : "BLOQUE", est.bloque);
  if (!accordDonne(options.confirme) && !(await budgetIndicatifPour())) throw new ErreurStudio("CONFIRMATION", "Confirmez d'abord le coût affiché.");
  const d = depots();
  const texte = String(phrase).trim();
  const element: ElementBibliotheque & { valeur: ValeurDecor } = {
    id: nouvelId("decor"),
    type: "decor",
    nom: est.nom,
    motsCles: sujetDecorEn(texte).split(", ").slice(0, 6),
    licence: { type: "generee-ia", usageCommercial: true, reseaux: [], source: "HeyGen (look de votre avatar)" },
    formatsParDefaut: [],
    marqueId: "marque-axion",
    valeur: { type: "decor", mode: "image", methode: "look-heygen", profondeurFlou: 0, teinte: "#1A120B", directionLumiere: "gauche", positionSujet: 0.5, description: texte, statut: "a_verifier", demande: { texte, le: maintenant() } },
    ...horodatage(),
  };
  await d.elements.enregistrer(element);
  try {
    const r = await preparerLookDecor(element.id, options);
    return { decorId: element.id, crees: r.crees, essai: r.essai };
  } catch (e) {
    // Rien de créé chez HeyGen : le décor vide est rangé (jamais supprimé) ; un look déjà créé reste sur son décor.
    const apres = await d.elements.obtenir(element.id);
    if (apres && estDecor(apres) && !Object.keys(apres.valeur.lookIdParAngle ?? {}).length) await d.elements.modifier(element.id, { archiveLe: maintenant() });
    throw e;
  }
}

/** Suivi des Looks en préparation (interrogation seule, gratuite). Renvoie le nombre de looks mis à jour. */
export async function suivreLooks(): Promise<number> {
  const d = depots();
  const f = await fournisseur("visage");
  let n = 0;
  for (const v of await d.visages.lister((x) => x.origine === "genere" && x.statut === "en_preparation" && x.fournisseur === f.id)) {
    const r = await ressourceActive(v.id);
    if (!r) continue;
    const s = await f.suivre(r.idExterne).catch(() => null);
    if (!s || s.statut === "en_preparation") continue;
    const statut = s.statut === "pret" ? "a_verifier" : s.statut;
    await d.visages.modifier(v.id, { statut });
    await d.ressourcesFournisseurs.modifier(r.id, { statut });
    // Correcteur réel 2 (F2) : le décor qui porte ce look reçoit son aperçu (Will dans la pièce) en vignette, à vérifier.
    if (statut === "a_verifier" && f.garderApercuLook) {
      for (const e of (await d.elements.lister((x) => x.type === "decor")).filter(estDecor)) {
        if (!Object.values(e.valeur.lookIdParAngle ?? {}).includes(r.idExterne) || e.valeur.vignetteDoubleFichierId) continue;
        const a = await f.garderApercuLook(r.idExterne).catch(() => null);
        if (a?.apercuCle) await d.elements.modifier(e.id, { valeur: { ...e.valeur, vignetteDoubleFichierId: (await enregistrerFichier(a.apercuCle, `${e.nom} sur le double`, a.mime ?? "image/jpeg")).id } });
      }
    }
    n++;
  }
  return n;
}

/** Liste des photos de l'essai (tests, outils). */
export const PHOTOS_ESSAI = PHOTOS_DECOR_SIMULEES;
