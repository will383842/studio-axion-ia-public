/**
 * LANCEUR DE LA FABRICATION « IMAGE → VIDÉO » (lot L15), sans passer par l'interface : un chemin d'image + un plafond.
 *
 *   npx tsx --conditions=react-server scripts/image-video/fabriquer.ts --image <chemin> --plafond <euros> \
 *     [--reel] [--dossier <chemin>] [--sortie <dossier>] [--attendre <minutes>] \
 *     [--reseaux tiktok,youtube-shorts,linkedin,instagram,facebook] \
 *     [--offre formation|audit|integration|coaching] [--type <type d'image>] [--fin-seule] \
 *     [--valider-carte [--carte <carte corrigée.json>]] [--valider-script [--script <fiche modifiée.json>] [--choix <choix.json>]]
 *
 * - Par défaut : SIMULATION (Claude, voix et rendu simulés, rien de payant). `--reel` branche les vrais outils du studio
 *   (`src/services/image-video.ts`) : Claude, voix HeyGen, stockage, serveur de rendu, budget et réservations.
 * - `--plafond` est OBLIGATOIRE : c'est le plafond de dépense de CETTE vidéo (en euros). Le studio s'arrête net avant
 *   tout appel qui le dépasserait ; il ne le dépasse jamais.
 * - L'état de la fabrication est gardé après chaque pas dans `<dossier>/etat.json` : relancer la même commande REPREND
 *   sans rien repayer (lectures, carte, script, voix, pistes, rendus, contrôles déjà faits).
 * - Les deux portes de Will arrêtent le lanceur (code 5) : `carte.json` (ce que le studio a compris) puis `script.json`
 *   (le script, ses formules à trancher et le prix de la suite) sont écrits dans le dossier.
 *   · Mode RÉEL : la fabrication est montrée dans le studio (`/image-video/<vidéo>`, travail « vitrine » que la boucle de
 *     fond ne fait jamais avancer) ; Will valide la carte, puis le script, PAR L'INTERFACE ; relancer la même commande
 *     reprend avec sa décision. `--attendre <minutes>` : le lanceur attend lui-même la validation (relue toutes les 15 s).
 *   · Sans interface (simulation, essais) : `--valider-carte` (éventuellement `--carte` corrigée), puis `--valider-script`
 *     (éventuellement `--script` modifié et `--choix` : `{ "<clé de formule>": "garder" | "reformuler" }` ; sans
 *     `--choix`, toutes les formules sont gardées). REFUSÉS en mode réel (code 1, rien n'est lancé ni payé) : la voix ne
 *     se paie qu'après la validation du script ET l'accord de son prix, dans le studio.
 * - Mode RÉEL : un seul lanceur à la fois par vidéo, toutes machines confondues (bail exclusif dans la base du studio,
 *   pris avant toute dépense, qui expire seul si le lanceur meurt) ; un second lanceur s'arrête aussitôt (code 3).
 * - Mode RÉEL, après le script : voix, mise en scène, RENDU sur le serveur de rendu du studio (opération `composition`
 *   existante : une scène par bloc, puis le montage voix + bruitages + sous-titres), contrôles L13, livraison.
 * - `--sortie <dossier>` : les fichiers finaux (`<réseau>.mp4`, ou `version-<id>.mp4` si les contrôles ont refusé la
 *   vidéo), les textes de publication (`<réseau>.txt`) et `resume.json` (dépense réelle, pire coût engagé, verdicts).
 *
 * N'importe rien de `tests/`, `outils/`, `docs/` ni `studio-rendu/`.
 * Codes de sortie : 0 prête · 1 arguments · 3 déjà en cours ailleurs · 4 arrêtée (refus, plafond) · 5 attend Will ·
 * 6 attente trop longue.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { CarteImage, TypeImage } from "@/domaine/image-video/carte";
import { TYPES_IMAGE } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import {
  attendWillIV,
  avancerJusquAArretIV,
  engageCentimes,
  ErreurDecisionIV,
  etatInitialIV,
  imposerTypeIV,
  PLAFOND_VIDEO_IV_CENTIMES,
  recettesDesVersionsIV,
  reprendreIV,
  validerCarteIV,
  validerScriptIV,
  type DemandeFabricationIV,
  type EtatFabricationIV,
  type LivraisonReseauIV,
  type OutilsFabricationIV,
} from "@/moteurs/montage-image-video/fabrication";
import type { Offre } from "@/moteurs/montage-image-video/emprunts";
import type { ChoixFormule } from "@/moteurs/montage-image-video/regles";
import { convertirEnSimulation } from "@/moteurs/montage-image-video/lecture/simulation";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import type { VerrouLanceurIV } from "@/services/image-video-lanceur";

const OFFRES: readonly Offre[] = ["formation", "audit", "integration", "coaching"];

/** Numéro de version d'essai des liens suivis d'une sortie du lanceur (ADR 0002 : le lien porte toujours un code de version). */
export const NUMERO_VERSION_LANCEUR = 9999;

export interface ArgumentsIV {
  image: string;
  plafondCentimes: number;
  reel: boolean;
  dossier?: string;
  reseaux: ReseauIV[];
  offre?: Offre;
  type?: TypeImage;
  finSeule: boolean;
  validerCarte: boolean;
  carte?: string;
  validerScript: boolean;
  script?: string;
  choix?: string;
  /** Dossier des fichiers finaux, textes de publication et résumé. */
  sortie?: string;
  /** Mode réel : minutes d'attente d'une validation faite dans le studio (0 : arrêt tout de suite, code 5). */
  attendreMinutes: number;
}

export class ErreurArguments extends Error {}

const AVEC_VALEUR = ["--image", "--plafond", "--dossier", "--reseaux", "--offre", "--type", "--carte", "--script", "--choix", "--sortie", "--attendre"];

/** Lit la ligne de commande. Lève `ErreurArguments` (message en français). */
export function lireArguments(argv: readonly string[]): ArgumentsIV {
  const v = new Map<string, string>();
  const drapeaux = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (["--reel", "--simulation", "--fin-seule", "--valider-carte", "--valider-script"].includes(a)) drapeaux.add(a);
    else if (AVEC_VALEUR.includes(a)) {
      const x = argv[i + 1];
      if (x === undefined || x.startsWith("--")) throw new ErreurArguments(`Il manque la valeur de ${a}.`);
      v.set(a, x);
      i++;
    } else throw new ErreurArguments(`Option inconnue : ${a}.`);
  }
  const image = v.get("--image");
  if (!image) throw new ErreurArguments("Il manque --image <chemin de l'image>.");
  const plafond = v.get("--plafond");
  if (plafond === undefined) throw new ErreurArguments("Il manque --plafond <euros> : le plafond de dépense de cette vidéo (par exemple 2,00).");
  const euros = Number(plafond.replace(",", "."));
  if (!Number.isFinite(euros) || euros < 0) throw new ErreurArguments(`Plafond illisible : « ${plafond} » (en euros, par exemple 2,00).`);
  const reseaux = v.has("--reseaux") ? v.get("--reseaux")!.split(",").map((r) => r.trim()).filter(Boolean) : [...RESEAUX_IV];
  const inconnus = reseaux.filter((r) => !(RESEAUX_IV as readonly string[]).includes(r));
  if (inconnus.length || !reseaux.length) throw new ErreurArguments(`Réseau inconnu : ${inconnus.join(", ") || "aucun"} (permis : ${RESEAUX_IV.join(", ")}).`);
  const offre = v.get("--offre");
  if (offre !== undefined && !OFFRES.includes(offre as Offre)) throw new ErreurArguments(`Offre inconnue : ${offre} (permises : ${OFFRES.join(", ")}).`);
  const attendre = v.has("--attendre") ? Number(v.get("--attendre")!.replace(",", ".")) : 0;
  if (!Number.isFinite(attendre) || attendre < 0) throw new ErreurArguments(`Attente illisible : « ${v.get("--attendre")} » (en minutes, par exemple 30).`);
  const type = v.get("--type");
  if (type !== undefined && !(TYPES_IMAGE as readonly string[]).includes(type)) throw new ErreurArguments(`Type d'image inconnu : ${type} (permis : ${TYPES_IMAGE.join(", ")}).`);
  return {
    image,
    plafondCentimes: Math.round(euros * 100),
    reel: drapeaux.has("--reel"),
    ...(v.has("--dossier") ? { dossier: v.get("--dossier") } : {}),
    reseaux: RESEAUX_IV.filter((r) => reseaux.includes(r)),
    ...(offre ? { offre: offre as Offre } : {}),
    ...(type ? { type: type as TypeImage } : {}),
    finSeule: drapeaux.has("--fin-seule"),
    validerCarte: drapeaux.has("--valider-carte"),
    ...(v.has("--carte") ? { carte: v.get("--carte") } : {}),
    validerScript: drapeaux.has("--valider-script"),
    ...(v.has("--script") ? { script: v.get("--script") } : {}),
    ...(v.has("--choix") ? { choix: v.get("--choix") } : {}),
    ...(v.has("--sortie") ? { sortie: v.get("--sortie") } : {}),
    attendreMinutes: attendre,
  };
}

const euros = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const MIME: Readonly<Record<string, string>> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

/** Ce que le lanceur a besoin de brancher (tests : des doubles). */
export interface BranchementsIV {
  outils: OutilsFabricationIV;
  /** Après chaque pas (mode réel : coût de la voix enregistré à la fin). */
  terminer?: (e: EtatFabricationIV) => Promise<void>;
  /**
   * Mode réel : publie l'état dans le studio (vitrine lue par l'interface, où Will valide) ; rend l'adresse de la page.
   * Absent : les portes se franchissent par `--valider-carte` / `--valider-script`.
   */
  publier?: (e: EtatFabricationIV) => Promise<string>;
  /** Octets d'un fichier rangé (fichiers finaux pour `--sortie`) ; `null` : illisible. */
  telecharger?: (cle: string) => Promise<Uint8Array | null>;
  /** Dépense RÉELLE enregistrée pour cette vidéo (centimes d'euro, par étape). */
  depenseReelle?: () => Promise<{ centimes: number; lignes: { etape: string; fournisseur: string; centimes: number }[] }>;
  /**
   * Mode réel : prend le bail exclusif de la vidéo (un seul lanceur à la fois, toutes machines confondues) ; `null` : un
   * autre lanceur le tient. Pris avant toute dépense, rendu à la fin.
   */
  verrouiller?: () => Promise<VerrouLanceurIV | null>;
}

export const PHRASES_LANCEUR_IV = Object.freeze({
  validerEnReel:
    "En mode réel, la carte et le script se valident dans le studio, avec l'accord du prix : --valider-carte et --valider-script sont refusés. Rien n'a été lancé ni payé. Relancez sans ces options.",
  dejaEnCours: "Cette vidéo est déjà fabriquée par un autre lanceur (ici ou sur une autre machine). Rien n'a été lancé ni payé : attendez qu'il finisse, puis relancez la même commande.",
  verrouPerdu: "Ce lanceur n'a plus la main sur cette vidéo (un autre l'a reprise) : il s'arrête sans rien payer de plus. Relancez la même commande plus tard.",
});

export interface DependancesLanceurIV {
  ecrire: (ligne: string) => void;
  /** Branchements (défaut : simulation, ou les outils réels du studio avec `--reel`). */
  branchements?: (demande: DemandeFabricationIV, octets: Uint8Array) => Promise<BranchementsIV>;
  /** Attente entre deux passages quand un rendu est en cours (défaut : 15 s). */
  attendre?: () => Promise<void>;
  attentesMax?: number;
}

/** Pose les bouchons de `next/*` (les services tirent `auth` → `next/headers`), comme le lanceur du tableau. */
function installerBouchonsNext(): void {
  createRequire(import.meta.url)("../tableau/bouchons-next.cjs");
}

/**
 * Branchements SIMULÉS : découpe simulée, tout appel Claude est le rôle simulé (aucune clé : la lecture rend la carte
 * de démonstration), la voix et le rendu sont refusés (un essai simulé s'arrête au plus tard à la voix, rien n'est
 * payé). Pour un parcours complet sans dépense : les tests du lot L15.
 */
function branchementsSimules(octets: Uint8Array): BranchementsIV {
  const simuler = async (role: { simuler: (e: never) => unknown }, entree: unknown) => {
    const r = role.simuler(entree as never);
    return { ok: true as const, simule: true, ...(typeof r === "string" ? { texte: r } : { donnees: r }) };
  };
  const refus = async (): Promise<never> => {
    throw new Error("Simulation : la voix, le rendu et les contrôles ne sont joués qu'avec --reel (ou dans les tests du lot L15).");
  };
  return {
    outils: {
      lireImageSource: async () => octets,
      lecture: { convertir: convertirEnSimulation, appeler: simuler as never },
      ecriture: { appeler: simuler as never },
      voix: { tarifCentimesParCaractere: 0.03 } as OutilsFabricationIV["voix"],
      assemblage: { lireSon: refus, convertirEnWav: refus, rangerSon: refus, traiterVoix: refus },
      rendre: refus,
      controles: { lireSon: refus, transcrire: refus, extraireImages: refus, lireImage: refus, appeler: refus },
      budget: { reserver: async () => ({ ok: true }) },
      cartesValidees: async () => 0,
      maintenant: () => new Date().toISOString(),
    },
  };
}

/** Branchements RÉELS : outils du studio, image déposée dans le stockage, vidéo brouillon (jamais publiée). */
async function branchementsReels(demande: DemandeFabricationIV, octets: Uint8Array, mime: string): Promise<BranchementsIV> {
  installerBouchonsNext();
  const [{ outilsImageVideo }, { depots, horodatage }, { resoudreFournisseur }, credits, { nouvelId }] = await Promise.all([
    import("@/services/image-video"),
    import("@/services/_commun"),
    import("@/fournisseurs"),
    import("@/services/credits"),
    import("@/lib/ids"),
  ]);
  const d = depots();
  const stockage = resoudreFournisseur("stockage");
  if (stockage.mode === "simulation" || !stockage.urlDepotDuree) throw new Error("Le stockage des fichiers n'est pas relié (R2) : le mode réel en a besoin.");
  // L'image source va dans le stockage : la relecture finale la compare aux images de la vidéo.
  const depot = await stockage.urlDepotDuree(demande.image.cle, 3600, mime);
  const envoi = await fetch(depot, { method: "PUT", body: Buffer.from(octets), headers: { "content-type": mime } });
  if (!envoi.ok) throw new Error(`L'image n'a pas pu être déposée dans le stockage (${envoi.status}).`);
  const maintenant = new Date().toISOString();
  const titre = `Image → vidéo · ${basename(demande.image.cle)}`;
  const entrees = { imageVideo: { imageCle: demande.image.cle, empreinte: demande.image.empreinte, reseaux: demande.reseaux, plafondCentimes: demande.plafondCentimes } };
  if (!(await d.videos.obtenir(demande.videoId))) {
    await d.videos.enregistrer({
      id: demande.videoId,
      titre,
      sujet: "Essai du lanceur image → vidéo",
      formatId: "image-video",
      versionFormat: 1,
      profilRenduVersion: 1,
      marqueId: "marque-axion",
      statut: "brouillon",
      dureeCibleSec: 50,
      ratios: ["9:16"],
      distribution: [],
      entrees,
      reglages: {},
      styles: {},
      mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
      langue: "fr-FR",
      creeLe: maintenant,
      modifieLe: maintenant,
    } as never);
  }
  const { publierVitrineIV, adresseVideoIV, idsVitrineIV, verrouillerLanceurIV } = await import("@/services/image-video-lanceur");
  const { lireOctets } = await import("@/services/image-video");
  const { travailId } = idsVitrineIV(demande.videoId);
  // La voix n'est réservée que sur l'accord du prix donné par Will avec la validation du script.
  const outils = await outilsImageVideo({ videoId: demande.videoId, travailId, plafondClaudeUsd: demande.plafondCentimes / 100, lireImageSource: async () => octets, cartesValidees: async () => 0, accordDuScriptExige: true, production: true });
  return {
    outils,
    verrouiller: () => verrouillerLanceurIV(demande.videoId),
    publier: async (e) => {
      await publierVitrineIV({ videoId: demande.videoId, titre, etat: e, entrees });
      return adresseVideoIV(demande.videoId);
    },
    telecharger: async (cle) => lireOctets(stockage.urlLectureDuree ? await stockage.urlLectureDuree(cle, 3600) : await stockage.urlLecture(cle), 200 * 1024 * 1024),
    depenseReelle: async () => {
      const lignes = (await d.depenses.lister((x) => x.videoId === demande.videoId)).flatMap((x) => x.lignes).filter((l) => l.nature === "reel" && l.total.centimes > 0);
      return { centimes: lignes.reduce((s, l) => s + l.total.centimes, 0), lignes: lignes.map((l) => ({ etape: l.etape, fournisseur: String(l.fournisseur), centimes: l.total.centimes })) };
    },
    terminer: async (e) => {
      // La voix payée est enregistrée une fois (les appels Claude le sont déjà par leur chemin de dépense) ; la
      // réservation du travail est soldée.
      const payees = e.voix?.voix.payees ?? [];
      const total = payees.reduce((s, p) => s + p.coutCentimes, 0);
      const deja = await d.depenses.lister((x) => x.videoId === demande.videoId && x.lignes.some((l) => l.etape === "Image → vidéo · voix"));
      const dejaCentimes = deja.reduce((s, x) => s + x.total.centimes, 0);
      if (total > dejaCentimes) {
        const lignes = [{ etape: "Image → vidéo · voix", fournisseur: "heygen", unite: "caractere" as const, quantite: payees.reduce((s, p) => s + p.caracteres, 0), prixUnitaire: { centimes: 0, devise: "EUR" as const }, total: { centimes: total - dejaCentimes, devise: "EUR" as const }, nature: "reel" as const }];
        await d.depenses.enregistrer({ id: nouvelId("dep"), videoId: demande.videoId, lignes, total: lignes[0].total, date: new Date().toISOString(), ...horodatage() } as never);
      }
      if (e.etape === "prete" || e.etape === "refusee") await credits.libererReservation(travailId, "consommee");
    },
  };
}

function resume(e: EtatFabricationIV): string[] {
  const l = [`Étape : ${e.etape}${e.attente ? ` (attente : ${e.attente})` : ""}.`, `Engagé (pire coût réservé) : ${euros(engageCentimes(e))} sur un plafond de ${euros(e.caisse.plafondCentimes)}.`];
  if (e.voix) l.push(`Voix payée : ${euros(e.voix.voix.payees.reduce((s, p) => s + p.coutCentimes, 0))} (${e.voix.voix.payees.length} lecture(s)).`);
  if (e.refus) l.push(`ARRÊT à « ${e.refus.etape} » : ${e.refus.message}`, ...(e.refus.phrases ?? []).slice(0, 20).map((p) => `  - ${p}`));
  return l;
}

/** Taux dollar → euro : le réglage du studio en mode réel (`taux.usdEur`, celui des outils réels), sinon le défaut du studio. */
async function tauxDuStudio(reel: boolean): Promise<number> {
  if (!reel) return TAUX_USD_EUR_PAR_DEFAUT;
  installerBouchonsNext();
  const { lireParametre } = await import("@/services/_commun");
  return lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
}

/** Lance (ou reprend) la fabrication. Renvoie le code de sortie. */
export async function lancer(args: ArgumentsIV, deps: DependancesLanceurIV): Promise<number> {
  const ecrire = deps.ecrire;
  // Mode réel : les portes ne se franchissent QUE dans le studio (accord du prix compris), jamais par la ligne de commande.
  if (args.reel && (args.validerCarte || args.validerScript)) {
    ecrire(PHRASES_LANCEUR_IV.validerEnReel);
    return 1;
  }
  const octets = new Uint8Array(await readFile(args.image));
  const empreinte = createHash("sha256").update(octets).digest("hex");
  const videoId = `v-iv-${empreinte.slice(0, 12)}`;
  const dossier = args.dossier ?? join(tmpdir(), "studio-image-video", videoId);
  await mkdir(dossier, { recursive: true });
  const fichierEtat = join(dossier, "etat.json");
  const ext = extname(args.image).toLowerCase();
  const demande: DemandeFabricationIV = {
    videoId,
    versionId: "lanceur",
    image: { cle: `studio/${args.reel ? "essai" : "simulation"}/image-video/${videoId}/source${ext || ".png"}`, empreinte },
    reseaux: args.reseaux,
    ...(args.offre ? { offre: args.offre } : {}),
    ...(args.type ? { typeImpose: args.type } : {}),
    validationCarte: "toujours",
    appelCommentaire: args.finSeule ? "fin-seule" : "question-puis-fin",
    plafondCentimes: args.plafondCentimes,
    tauxUsdEur: await tauxDuStudio(args.reel && !deps.branchements),
    codeSuivi: `iv-${empreinte.slice(0, 8)}`,
    // Hors studio, aucune version n'existe : numéro d'essai (« 9999-IV-XX »), qui ne se rattache à aucune vidéo du studio.
    numeroVersion: NUMERO_VERSION_LANCEUR,
  };

  ecrire(args.reel ? `Mode RÉEL : plafond de cette vidéo ${euros(args.plafondCentimes)} (jamais dépassé).` : "Mode SIMULATION : rien de payant n'est appelé (--reel pour l'essai réel).");
  const b = deps.branchements ? await deps.branchements(demande, octets) : args.reel ? await branchementsReels(demande, octets, MIME[ext] ?? "image/png") : branchementsSimules(octets);
  if (b.publier && (args.validerCarte || args.validerScript)) {
    ecrire(PHRASES_LANCEUR_IV.validerEnReel);
    return 1;
  }
  // Un seul lanceur à la fois sur cette vidéo, AVANT toute dépense (et avant de relire l'état gardé).
  const verrou = b.verrouiller ? await b.verrouiller() : null;
  if (b.verrouiller && !verrou) {
    ecrire(PHRASES_LANCEUR_IV.dejaEnCours);
    return 3;
  }
  try {
    return await fabriquer(args, deps, { demande, dossier, b, verrou });
  } finally {
    await verrou?.rendre();
  }
}

/** La fabrication proprement dite, bail tenu (mode réel). Renvoie le code de sortie. */
async function fabriquer(args: ArgumentsIV, deps: DependancesLanceurIV, c: { demande: DemandeFabricationIV; dossier: string; b: BranchementsIV; verrou: VerrouLanceurIV | null }): Promise<number> {
  const { demande, dossier, b, verrou } = c;
  const ecrire = deps.ecrire;
  const fichierEtat = join(dossier, "etat.json");
  // Reprise : l'état gardé (rien n'est repayé) ; le plafond de la ligne de commande s'applique.
  let e: EtatFabricationIV;
  try {
    e = JSON.parse(await readFile(fichierEtat, "utf8")) as EtatFabricationIV;
    ecrire(`Reprise de ${fichierEtat} (rien de déjà payé n'est refait).`);
  } catch {
    e = etatInitialIV(demande);
  }
  if (e.caisse.plafondCentimes !== args.plafondCentimes) e = reprendreIV(e, { plafondCentimes: args.plafondCentimes });
  if (e.etape === "refusee" && e.refus?.code === "IV_TYPE_A_CHOISIR" && args.type) e = imposerTypeIV(e, args.type);
  else if (e.etape === "refusee" && e.refus?.reessayable) e = reprendreIV(e);

  const garder = async (x: EtatFabricationIV) => writeFile(fichierEtat, `${JSON.stringify(x)}\n`);

  // Décisions de Will passées sur la ligne de commande.
  try {
    if (args.validerCarte && attendWillIV(e) === "carte") {
      const carte = args.carte ? (JSON.parse(await readFile(args.carte, "utf8")) as CarteImage) : undefined;
      e = validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, ...(carte ? { carte } : {}), le: new Date().toISOString() });
      ecrire("Carte validée.");
    }
    if (args.validerScript && attendWillIV(e) === "script") {
      const fiche = args.script ? (JSON.parse(await readFile(args.script, "utf8")) as FicheImage) : undefined;
      const choix = args.choix ? (JSON.parse(await readFile(args.choix, "utf8")) as Record<string, ChoixFormule>) : Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
      e = validerScriptIV(e, { proposition: e.propositionScript!.empreinte, ...(fiche ? { fiche } : {}), choixFormules: choix });
      ecrire("Script validé : la voix peut être payée.");
    }
  } catch (err) {
    if (!(err instanceof ErreurDecisionIV)) throw err;
    ecrire(`Validation refusée : ${err.message}`);
    for (const p of err.phrases) ecrire(`  - ${p}`);
    await garder(e);
    return 5;
  }
  await garder(e);

  // La fabrication, jusqu'à une porte de Will, la fin, ou une attente trop longue. Mode réel : l'état est montré dans le
  // studio après chaque passage ; une porte validée dans le studio est relue toutes les 15 s pendant `--attendre`.
  const attendre = deps.attendre ?? (() => new Promise<void>((ok) => setTimeout(ok, 15_000)));
  const attentesWillMax = Math.ceil(args.attendreMinutes * 4);
  let adresse: string | null = null;
  for (let attentes = 0, attentesWill = 0; ; ) {
    if (verrou?.perdu()) {
      ecrire(PHRASES_LANCEUR_IV.verrouPerdu);
      return 3;
    }
    e = await avancerJusquAArretIV(e, b.outils, { garder });
    await b.terminer?.(e);
    if (b.publier) adresse = await b.publier(e);
    if (e.attente) {
      if (attentes++ >= (deps.attentesMax ?? 240)) {
        for (const l of resume(e)) ecrire(l);
        ecrire("Le serveur fait encore attendre : relancez la même commande plus tard (rien n'est perdu).");
        if (args.sortie) await ecrireSortie(args.sortie, e, b, ecrire);
        return 6;
      }
      await attendre();
      continue;
    }
    const porte = attendWillIV(e);
    if (porte && b.publier && attentesWill < attentesWillMax) {
      if (attentesWill === 0) ecrire(`En attente de votre validation ${porte === "carte" ? "de la carte" : "du script"} dans le studio : ${adresse}`);
      attentesWill++;
      await attendre();
      continue;
    }
    break;
  }

  for (const l of e.journal) ecrire(`· ${l}`);
  for (const l of resume(e)) ecrire(l);
  const will = attendWillIV(e);
  if (will === "carte") {
    await writeFile(join(dossier, "carte.json"), `${JSON.stringify(e.propositionCarte, null, 2)}\n`);
    ecrire(`Voici ce que j'ai compris : ${join(dossier, "carte.json")} (${e.propositionCarte?.doutes.length ?? 0} doute(s)).`);
    for (const x of e.propositionCarte?.doutes ?? []) ecrire(`  - ${x}`);
    if (b.publier) ecrire(`Validez (ou corrigez) la carte dans le studio : ${adresse} ; puis relancez la même commande (rien n'est repayé).`);
    else ecrire("Relisez-la, corrigez-la au besoin (--carte), puis relancez avec --valider-carte.");
    if (args.sortie) await ecrireSortie(args.sortie, e, b, ecrire);
    return 5;
  }
  if (will === "script") {
    const p = e.propositionScript!;
    await writeFile(join(dossier, "script.json"), `${JSON.stringify(p, null, 2)}\n`);
    ecrire(`Votre script : ${join(dossier, "script.json")}.`);
    for (const f of p.formules) ecrire(`  - formule « ${f.texte} » (clé ${f.cle}) : version prudente « ${f.proposition} »`);
    ecrire(`Prix de la suite : environ ${euros(p.prix.habituelCentimes)}, au plus ${euros(p.prix.auPlusCentimes)} (déjà engagé ${euros(p.prix.engageCentimes)}, plafond ${euros(p.prix.plafondCentimes)}).`);
    if (b.publier) ecrire(`Validez le script dans le studio (« Valider et fabriquer ») : ${adresse} ; puis relancez la même commande. La voix n'est payée qu'après.`);
    else ecrire("Relancez avec --valider-script (et --choix / --script au besoin) : la voix n'est payée qu'après.");
    if (args.sortie) await ecrireSortie(args.sortie, e, b, ecrire);
    return 5;
  }
  if (e.etape === "prete") {
    for (const l of e.livraison ?? []) ecrire(`${l.reseau} : ${l.version === "aucune" ? `non livrée (${l.mention ?? ""})` : `${l.fichierCle} · ${(l.dureeSec ?? 0).toFixed(1).replace(".", ",")} s${l.mention ? ` · ${l.mention}` : ""}`}`);
  }
  if (args.sortie) await ecrireSortie(args.sortie, e, b, ecrire);
  return e.etape === "prete" ? 0 : 4;
}

/** Texte de publication d'un réseau, tel qu'il se colle (PUR). */
export function texteDePublication(l: LivraisonReseauIV): string {
  const blocs = [
    l.titre ? `Titre :\n${l.titre}` : "",
    l.texte ? `Texte :\n${l.texte}` : "",
    l.premierCommentaire ? `Premier commentaire :\n${l.premierCommentaire}` : "",
    l.lien ? `Lien suivi :\n${l.lien}` : "",
    l.consigneLien ? `Où poser le lien :\n${l.consigneLien}` : "",
    l.mention ? `À savoir :\n${l.mention}` : "",
  ];
  return `${blocs.filter(Boolean).join("\n\n")}\n`;
}

/** Résumé de la fabrication (`resume.json`) : dépense réelle, pire coût engagé, verdicts, fichiers. */
export interface ResumeSortieIV {
  videoId: string;
  etape: EtatFabricationIV["etape"];
  arret: { etape: string; code: string; message: string; phrases: string[] } | null;
  plafondCentimes: number;
  /** Pire coût réservé par la caisse (jamais au-dessus du plafond). */
  engageCentimes: number;
  /** Dépense réellement enregistrée pour la vidéo (`null` : non lue, simulation). */
  depenseReelle: { centimes: number; lignes: { etape: string; fournisseur: string; centimes: number }[] } | null;
  voixPayeeCentimes: number;
  verdict: { ok: boolean; phrase: string; phrases: string[]; mentions: string[] } | null;
  reseaux: { reseau: string; version: string; fichier: string | null; dureeSec: number | null; mention: string | null; texte: string | null; fichierFil?: string | null }[];
  /** Recette de variété tirée (ou changée par Will) et celle de chaque version ; `null` : fabrication d'avant la variété. */
  variete: { recette: Record<string, string>; par: string; historique: number; versions: { version: string; reseaux: string[]; format: string; recette: Record<string, string> }[] } | null;
  /** Fichiers rendus (une entrée par version), même refusés par les contrôles. */
  rendus: { version: string; fichier: string | null; dureeSec: number; mesures: Record<string, number | undefined> }[];
  journal: string[];
}

/** Écrit les fichiers finaux, les textes de publication et `resume.json` dans `dossier`. */
export async function ecrireSortie(dossier: string, e: EtatFabricationIV, b: Pick<BranchementsIV, "telecharger" | "depenseReelle">, ecrire: (l: string) => void): Promise<ResumeSortieIV> {
  await mkdir(dossier, { recursive: true });
  const ecrits = new Map<string, string | null>();
  const fichier = async (cle: string, nom: string): Promise<string | null> => {
    if (ecrits.has(cle)) return ecrits.get(cle)!;
    const octets = b.telecharger ? await b.telecharger(cle).catch(() => null) : null;
    const issue = octets ? nom : null;
    if (octets) await writeFile(join(dossier, nom), octets);
    else ecrire(`Fichier non téléchargé : ${nom}`);
    ecrits.set(cle, issue);
    return issue;
  };
  const reseaux: ResumeSortieIV["reseaux"] = [];
  for (const l of e.livraison ?? []) {
    const nom = l.fichierCle && l.version !== "aucune" ? await fichier(l.fichierCle, `${l.reseau}${l.version === "courte" ? "-courte" : ""}.mp4`) : null;
    const texte = l.version !== "aucune" ? `${l.reseau}.txt` : null;
    if (texte) await writeFile(join(dossier, texte), texteDePublication(l));
    // Facebook : le second fichier, la vidéo du fil en 4:5.
    const fil = l.fichierCleFil && l.version !== "aucune" ? await fichier(l.fichierCleFil, `${l.reseau}-fil-4x5${l.version === "courte" ? "-courte" : ""}.mp4`) : undefined;
    reseaux.push({ reseau: l.reseau, version: l.version, fichier: nom, dureeSec: l.dureeSec ?? null, mention: l.mention ?? null, texte, ...(fil !== undefined ? { fichierFil: fil } : {}) });
  }
  const rendus: ResumeSortieIV["rendus"] = [];
  for (const [version, r] of Object.entries(e.rendus ?? {})) {
    rendus.push({ version, fichier: await fichier(r.cle, `version-${version}.mp4`), dureeSec: r.dureeSec, mesures: { ...(r.mesures ?? {}) } });
  }
  const v = e.controles?.verdict;
  const resumeSortie: ResumeSortieIV = {
    videoId: e.demande.videoId,
    etape: e.etape,
    arret: e.refus ? { etape: e.refus.etape, code: e.refus.code, message: e.refus.message, phrases: [...(e.refus.phrases ?? [])] } : null,
    plafondCentimes: e.caisse.plafondCentimes,
    engageCentimes: engageCentimes(e),
    depenseReelle: b.depenseReelle ? await b.depenseReelle().catch(() => null) : null,
    voixPayeeCentimes: (e.voix?.voix.payees ?? []).reduce((s, p) => s + p.coutCentimes, 0),
    verdict: v ? { ok: v.ok, phrase: v.phrase, phrases: [...v.phrases], mentions: [...v.mentions] } : null,
    reseaux,
    variete: e.variete ? { recette: { ...e.variete.recette }, par: e.variete.par, historique: e.variete.historique, versions: recettesDesVersionsIV(e).map((x) => ({ ...x, recette: { ...x.recette } })) } : null,
    rendus,
    journal: [...e.journal],
  };
  await writeFile(join(dossier, "resume.json"), `${JSON.stringify(resumeSortie, null, 2)}\n`);
  ecrire(`Sortie écrite dans ${dossier} (resume.json${reseaux.some((x) => x.fichier) || rendus.some((x) => x.fichier) ? ", fichiers finaux" : ""}${reseaux.some((x) => x.texte) ? ", textes de publication" : ""}).`);
  return resumeSortie;
}

async function principal(): Promise<void> {
  let args: ArgumentsIV;
  try {
    args = lireArguments(process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof ErreurArguments)) throw err;
    console.error(err.message);
    process.exitCode = 1;
    return;
  }
  process.exitCode = await lancer(args, { ecrire: (l) => console.log(l) });
}

export { PLAFOND_VIDEO_IV_CENTIMES };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void principal();
