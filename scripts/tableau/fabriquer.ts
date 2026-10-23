/**
 * LANCEUR DE LA FABRICATION DU TABLEAU ANIMÉ (tâche TB-06a, plus petite première version, sans écran).
 *
 *   npx tsx --conditions=react-server scripts/tableau/fabriquer.ts --fiche <chemin.json> --personnage <id> \
 *     [--fin "<phrase>"] [--deja-vu <AAAA-MM-JJ>] [--contexte <chemin.json>] [--dossier <chemin>] \
 *     [--accord-depense <euros>] [--sorties vertical,portrait,carre,horizontal] [--reel]
 *
 * Par défaut c'est une SIMULATION : voix, stockage et rendu simulés, aucun client réel construit, rien de payant.
 * `--reel` branche les vrais outils (voix du personnage, stockage, `studio-rendu`, budget et réservation du studio).
 * Le coût estimé est affiché AVANT tout ; sans `--accord-depense` au moins égal, le lanceur s'arrête.
 * Il écrit une vidéo `brouillon` du format `tableau-anime` (format masqué), jamais publiée.
 * `--sorties` : formats d'image à fabriquer (`src/moteurs/montage-tableau/formats-sortie.ts`), séparés par des virgules ;
 * défaut `vertical`. La voix et le calage sont faits une seule fois pour toutes les sorties.
 *
 * L'avancement des étapes est affiché au fil de l'eau ; un bruitage introuvable est retiré (alerte), un montage arrêté
 * (entrée inaccessible après une série d'essais) affiche l'entrée en cause et sort avec le code 4.
 *
 * Codes de sortie : 0 fabriquée, 1 arguments, 2 fiche refusée, 3 accord de dépense manquant, 4 fabrication arrêtée.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "@/briques/voix-maitre/nettoyage";
import type { Video } from "@/domaine/types";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import { fournisseurAlignementSimulation } from "@/fournisseurs/simulation/alignement";
import { fournisseurVoixSimulation, stockageSimulation } from "@/fournisseurs/simulation/autres";
import type { ServiceRendu } from "@/fournisseurs/types";
import { validerFicheTableau, FORMAT_TABLEAU, type FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { ErreurFabrication, estimerFabrication, fabriquerTableau, type CompteRenduFabrication, type JournalFabrication, type OutilsFabrication } from "@/moteurs/montage-tableau/fabriquer";
import type { ContexteTableau } from "@/moteurs/montage-tableau/regles";
import { lireSorties, type IdSortie } from "@/moteurs/montage-tableau/formats-sortie";
import { TARIF_VOIX_CENTIMES_PAR_CARACTERE, branchementsReels, chargerModulesReels, type Branchements } from "@/services/tableau-outils";
import type { ContenuPreuve } from "@/briques/tableau-scene/types";
import { controlerProprietes, proprietesScenes } from "@/briques/tableau-scene/proprietes";

// Tarif et outils réels : vivent dans le studio (`src/services/tableau-outils.ts`), ré-exportés pour les appelants du lanceur.
export { TAUX_ESTIMATION_USD_EUR, TARIF_VOIX_CENTIMES_PAR_CARACTERE, branchementsReels, type Branchements } from "@/services/tableau-outils";

export interface ArgumentsLanceur {
  fiche: string;
  personnage: string;
  fin?: string;
  reel: boolean;
  /** Accord de dépense, en centimes d'euro. */
  accordCentimes?: number;
  dejaVu?: string;
  contexte?: string;
  dossier?: string;
  /** Formats de sortie (absent : vertical seul). */
  sorties?: IdSortie[];
}

/** Fichier de contexte (facultatif) : ce que la fiche cite et que le lanceur ne peut pas deviner. */
export interface FichierContexte {
  aujourdhui?: string;
  sourcesChiffres?: string[];
  preuves?: ContexteTableau["preuves"];
  matieres?: ContexteTableau["matieres"];
  /** Phrase testée et date du test, par `preuveId` (bulle de preuve). */
  contenusPreuves?: Record<string, ContenuPreuve>;
  prononciations?: { mot: string; prononciation: string }[];
}

export class ErreurArguments extends Error {}

/** Lit la ligne de commande. Lève `ErreurArguments` (message en français). */
export function lireArguments(argv: readonly string[]): ArgumentsLanceur {
  const valeurs = new Map<string, string>();
  let reel = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reel") reel = true;
    else if (a === "--simulation") reel = false;
    else if (["--fiche", "--personnage", "--fin", "--accord-depense", "--deja-vu", "--contexte", "--dossier", "--sorties"].includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new ErreurArguments(`Il manque la valeur de ${a}.`);
      valeurs.set(a, v);
      i++;
    } else throw new ErreurArguments(`Option inconnue : ${a}.`);
  }
  const fiche = valeurs.get("--fiche");
  const personnage = valeurs.get("--personnage");
  if (!fiche) throw new ErreurArguments("Il manque --fiche <chemin.json>.");
  if (!personnage) throw new ErreurArguments("Il manque --personnage <id>.");
  let accordCentimes: number | undefined;
  const accord = valeurs.get("--accord-depense");
  if (accord !== undefined) {
    const euros = Number(accord.replace(",", "."));
    if (!Number.isFinite(euros) || euros < 0) throw new ErreurArguments(`Accord de dépense illisible : « ${accord} » (en euros, par exemple 0,50).`);
    accordCentimes = Math.round(euros * 100);
  }
  const dejaVu = valeurs.get("--deja-vu");
  if (dejaVu !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dejaVu)) throw new ErreurArguments("--deja-vu attend la date où la case a été cochée (AAAA-MM-JJ).");
  let sorties: IdSortie[] | undefined;
  if (valeurs.has("--sorties")) {
    try {
      sorties = lireSorties(valeurs.get("--sorties"));
    } catch (err) {
      throw new ErreurArguments(`--sorties : ${(err as Error).message}`);
    }
  }
  return {
    ...(sorties ? { sorties } : {}), fiche, personnage, reel, ...(valeurs.has("--fin") ? { fin: valeurs.get("--fin") } : {}), ...(accordCentimes !== undefined ? { accordCentimes } : {}), ...(dejaVu ? { dejaVu } : {}), ...(valeurs.has("--contexte") ? { contexte: valeurs.get("--contexte") } : {}), ...(valeurs.has("--dossier") ? { dossier: valeurs.get("--dossier") } : {}) };
}

const euros = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const jour = (d: Date) => d.toISOString().slice(0, 10);

/** Contexte des règles de la fiche : le script validé est la fiche elle-même (PPV, fiche relue par Will). */
export function contexteDe(fiche: Pick<FicheTableau, "scenes">, f: FichierContexte, aujourdhui: string): ContexteTableau {
  return { texteScript: fiche.scenes.map((s) => s.texteDit).join(" "), aujourdhui: f.aujourdhui ?? aujourdhui, sourcesChiffres: f.sourcesChiffres ?? [], preuves: f.preuves ?? [], matieres: f.matieres ?? [] };
}

/** La vidéo brouillon (jamais publiée) qui porte la fabrication. */
export function videoBrouillon(fiche: FicheTableau, personnageId: string, r: CompteRenduFabrication, maintenant: string): Video {
  return {
    id: `v-${fiche.videoId}`,
    titre: fiche.douleur,
    sujet: fiche.gesteMinute,
    formatId: FORMAT_TABLEAU,
    versionFormat: 1,
    profilRenduVersion: 1,
    marqueId: "marque-axion",
    statut: "brouillon",
    dureeCibleSec: Math.round(r.dureeSec),
    ratios: r.sorties.length ? r.sorties.map((s) => s.ratio) : ["9:16"],
    distribution: [{ role: "voix", source: "double", personnageId }],
    entrees: { tableau: { videoFiche: fiche.videoId, versionId: fiche.versionId, cles: r.cles, verdict: r.controles.verdict } },
    reglages: {},
    styles: {},
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    langue: "fr-FR",
    coutReel: { centimes: r.coutVoixCentimes, devise: "EUR" },
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

/** Branchements SIMULÉS : aucun client réel, horloge du rendu avancée à chaque attente. */
export function branchementsSimules(dossier: string, videoId: string): Branchements {
  let t = 0;
  const rendu: ServiceRendu = creerServiceRenduSimule(() => t);
  const deposes = new Set<string>();
  const suivi: ServiceRendu = {
    soumettre: async (d) => {
      deposes.add(d.sortie.cle);
      return rendu.soumettre(d);
    },
    etat: (id) => rendu.etat(id),
  };
  return {
    env: "dev",
    attendre: async () => {
      t += 15_000;
    },
    voix: {
      voix: () => fournisseurVoixSimulation,
      stockage: () => stockageSimulation,
      aligneur: () => fournisseurAlignementSimulation,
      rendu: () => suivi,
      renduEstSimule: () => true,
      idVoix: "simulation",
      fournisseurVoix: "simulation",
      caler: () => false,
      regles: REGLES_NETTOYAGE_PAR_DEFAUT,
      cle: (nom) => `studio/dev/audio-maitre/${videoId}/${nom}`,
    },
    scenes: { rendu: () => suivi, depot: async () => "", existe: async (cle) => deposes.has(cle) },
    montage: {
      rendu: () => suivi,
      signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://simulation.invalid/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, ""])) }),
      cle: (c, nom) => `studio/dev/videos/${c.videoId}/${nom}`,
    },
    verifierEtReserver: async () => undefined,
    enregistrerVideo: async (v) => {
      await writeFile(join(dossier, "video-brouillon.json"), `${JSON.stringify(v, null, 2)}\n`);
    },
  };
}

/**
 * Pose les bouchons de `next/headers`, `next/navigation` et `next/cache` (`bouchons-next.cjs`) : hors de Next, le mode
 * réel plantait au chargement (`credits` → `auth` → `next/*`). Sans effet la seconde fois.
 */
export function installerBouchonsNext(): void {
  createRequire(import.meta.url)("./bouchons-next.cjs");
}

/** Charge le chemin `--reel` jusqu'aux imports, sans rien appeler (test du chemin réel). Renvoie les modules chargés. */
export async function chargerCheminReel(): Promise<string[]> {
  installerBouchonsNext();
  return Object.keys(await chargerModulesReels());
}

export interface DependancesLanceur {
  ecrire: (ligne: string) => void;
  /** Branchements réels (tests : un double qui compte ses appels). */
  reels?: (personnageId: string, videoId: string) => Promise<Branchements>;
  maintenant?: () => Date;
}

/** Lance la fabrication. Renvoie le code de sortie. */
export async function lancer(args: ArgumentsLanceur, deps: DependancesLanceur): Promise<number> {
  const ecrire = deps.ecrire;
  const maintenant = deps.maintenant?.() ?? new Date();
  const brute = JSON.parse(await readFile(args.fiche, "utf8")) as unknown;
  const fc: FichierContexte = args.contexte ? (JSON.parse(await readFile(args.contexte, "utf8")) as FichierContexte) : {};

  // 1. La fiche d'abord : refusée = arrêt, rien n'est construit. Preuves, matières et sources viennent du fichier de
  // contexte (relu par Will), en simulation comme en réel.
  const contexte = contexteDe(brute as FicheTableau, fc, jour(maintenant));
  const premier = validerFicheTableau(brute, contexte);
  const ficheLue = brute as FicheTableau;
  if (!premier.ok) {
    ecrire("Fiche refusée :");
    for (const p of premier.problemes) ecrire(`  - ${p.message}`);
    return 2;
  }

  // 2. Le coût estimé, AVANT tout ; l'accord doit le couvrir.
  const estimation = estimerFabrication(ficheLue, TARIF_VOIX_CENTIMES_PAR_CARACTERE, fc.prononciations ?? []);
  ecrire(`Coût estimé : ${euros(estimation.centimes)} au plus (voix : ${estimation.caracteres} caractères ; rendu sur le serveur du studio).`);
  ecrire(args.reel ? "Mode RÉEL : la voix sera payée." : "Mode SIMULATION : rien de payant n'est appelé (--reel pour l'essai réel).");
  if (args.accordCentimes === undefined || args.accordCentimes < estimation.centimes) {
    ecrire(args.accordCentimes === undefined ? `Arrêt : relancez avec --accord-depense ${(estimation.centimes / 100).toFixed(2)} (en euros) pour accepter ce coût.` : `Arrêt : l'accord (${euros(args.accordCentimes)}) est inférieur au coût estimé (${euros(estimation.centimes)}).`);
    return 3;
  }

  const dossier = args.dossier ?? join(tmpdir(), "studio-tableau", ficheLue.videoId);
  await mkdir(dossier, { recursive: true });
  const simules = args.reel ? null : branchementsSimules(dossier, ficheLue.videoId);
  if (args.reel && !deps.reels) installerBouchonsNext();
  const b = simules ?? (await (deps.reels ?? branchementsReels)(args.personnage, ficheLue.videoId));
  const accord = args.accordCentimes;
  const fichierJournal = join(dossier, "journal.json");

  const outils: OutilsFabrication = {
    videoId: ficheLue.videoId,
    env: b.env,
    lireFiche: async () => brute,
    contexte,
    ...(args.dejaVu ? { dejaVu: { coche: true, le: args.dejaVu } } : {}),
    ...(fc.prononciations ? { prononciations: fc.prononciations } : {}),
    ...(fc.contenusPreuves ? { contenusPreuves: fc.contenusPreuves } : {}),
    ...(args.fin ? { fin: args.fin } : {}),
    ...(args.sorties ? { sorties: args.sorties } : {}),
    personnageId: args.personnage,
    journal: {
      lire: async () => {
        try {
          return JSON.parse(await readFile(fichierJournal, "utf8")) as JournalFabrication;
        } catch {
          return null;
        }
      },
      ecrire: async (j) => writeFile(fichierJournal, `${JSON.stringify(j)}\n`),
    },
    budget: {
      tarifCentimesParCaractere: TARIF_VOIX_CENTIMES_PAR_CARACTERE,
      verifierEtReserver: async (e) => {
        if (accord === undefined || accord < e.centimes) throw new Error(`L'accord de dépense (${euros(accord ?? 0)}) ne couvre pas ${euros(e.centimes)}.`);
        await b.verifierEtReserver(e);
      },
    },
    voix: b.voix,
    preparation: { proprietesScenes, controlerProprietes },
    scenes: b.scenes,
    montage: b.montage,
    attendre: b.attendre,
    // Avancement au fil de l'eau : chaque étape commencée, faite ou reprise, et où en sont les scènes et le montage.
    avancement: (ligne) => ecrire(ligne),
  };

  let r: CompteRenduFabrication;
  try {
    r = await fabriquerTableau(outils);
  } catch (err) {
    if (err instanceof ErreurFabrication) {
      ecrire(`Fabrication arrêtée à l'étape « ${err.etape} » :`);
      for (const x of err.raisons) ecrire(`  - ${x}`);
      ecrire(`Relancez la même commande : les étapes réussies sont reprises (journal : ${fichierJournal}).`);
      return err.etape === "fiche" ? 2 : 4;
    }
    throw err;
  }
  await b.enregistrerVideo(videoBrouillon(ficheLue, args.personnage, r, maintenant.toISOString()));
  for (const l of compteRendu(r)) ecrire(l);
  ecrire(`Vidéo brouillon v-${ficheLue.videoId} écrite (format ${FORMAT_TABLEAU}, masqué, jamais publiée). Journal : ${fichierJournal}.`);
  return 0;
}

/** Compte rendu lisible : coût, durée de chaque étape, scènes rendues ou reprises, clés des fichiers, contrôles. */
export function compteRendu(r: CompteRenduFabrication): string[] {
  return [
    `Coût de ce lancement : ${euros(r.coutCentimes)} (voix de la vidéo : ${euros(r.coutVoixCentimes)} ; estimé : ${euros(r.estimation.centimes)}).`,
    `Durée de la vidéo : ${r.dureeSec.toFixed(1).replace(".", ",")} s.`,
    "Étapes :",
    ...r.etapes.map((e) => `  - ${e.etape} : ${e.statut === "reprise" ? "reprise" : `faite en ${(e.dureeMs / 1000).toFixed(1).replace(".", ",")} s`}`),
    `Scènes rendues : ${r.scenes.rendues.join(", ") || "aucune"} ; reprises : ${r.scenes.reprises.join(", ") || "aucune"}.`,
    "Fichiers :",
    `  - voix : ${r.cles.voix}`,
    ...Object.entries(r.cles.scenes).map(([id, cle]) => `  - scène ${id} : ${cle}`),
    `  - vidéo : ${r.cles.video}`,
    ...(r.cles.master ? [`  - image sans texte : ${r.cles.master}`] : []),
    `  - vignette : ${r.cles.vignette}`,
    `Contrôles : ${r.controles.resume}.`,
    ...r.controles.phrases.map((p) => `  - ${p}`),
    ...(r.alertes?.length ? ["Alertes :", ...r.alertes.map((a) => `  - ${a.message}`)] : []),
    ...(r.sorties.length > 1 || r.sorties[0]?.format !== "vertical" ? lignesSorties(r) : []),
  ];
}

const ETAT_FICHIER = { conforme: "conforme", "non-conforme": "NON CONFORME", "non-mesure": "non mesuré" } as const;

/** Une ligne par sortie : format, dimensions, réseaux, vidéo, durée, taille, contrôle du fichier. */
export function lignesSorties(r: CompteRenduFabrication): string[] {
  return [
    "Sorties :",
    ...r.sorties.flatMap((s) => [
      `  - ${s.libelle} (${s.largeur} × ${s.hauteur}) pour ${s.reseaux.join(", ")} : ${s.cles.video} ; ${s.dureeSec.toFixed(1).replace(".", ",")} s ; ${s.tailleOctets ? `${(s.tailleOctets / 1e6).toFixed(1).replace(".", ",")} Mo` : "taille non mesurée"} ; contrôles ${s.controles.resume} ; fichier ${ETAT_FICHIER[s.controleFichier.etat]}.`,
      ...s.controleFichier.phrases.map((p) => `      ${p}`),
    ]),
  ];
}

async function principal(): Promise<void> {
  let args: ArgumentsLanceur;
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void principal();
