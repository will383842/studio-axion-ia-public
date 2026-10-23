/**
 * « NOUVELLE VIDÉO · TABLEAU ANIMÉ » : du script à la fabrication, depuis la console (sans le lanceur en ligne de
 * commande). Quatre temps, chacun ici :
 *  1. le script et ses choix (série, structure, douleur, geste, fin, réseaux) ;
 *  2. `decouperScriptTableau` : le découpage existant (`decouperEnScenes`, une relance au plus) branché sur le chemin de
 *     dépense Claude du studio (`executerRolePourVideo` : plafonds, réservation, coût réel ; modèle d'écriture, jamais
 *     Haiku), la fiche validée par les règles, puis un BROUILLON en base (vidéo `brouillon`, collection `videos`) ;
 *  3. `corrigerFicheTableau` : texte dit et mots affichés, scène par scène ; chaque enregistrement AJOUTE une version
 *     (les précédentes restent dans le brouillon, rien n'est écrasé) ;
 *  4. `fabriquerVideoTableau` : le prix de la voix (calcul existant) doit être CONFIRMÉ en montant, sinon refus côté
 *     serveur ; la fiche est rangée dans le stockage du studio, puis le lancement commun (`lancerFabrication`).
 *
 * Écriture du script et découpage : des TÂCHES DE FOND (`tableau-taches.ts`). L'action enregistre la demande dans le
 * brouillon et rend la main tout de suite ; la boucle de fond fait les appels ; l'écran suit l'état toutes les 3 s.
 * Aucune action de ce parcours ne tient une requête longue (Cloudflare coupe à 100 s).
 *
 * Brouillon : `video.entrees.tableauCreation` (voir `BrouillonTableau`). Tant que le format est `masque`, rien n'est
 * montré et rien n'est créé. Rien sur le disque. Les réseaux cochés deviennent les formats de sortie de la fabrication
 * (une vidéo par format, une seule voix : le prix ne change pas).
 */
import type { Confirmation, NiveauSujet, Precedent, Suggestion } from "@/domaine/sujets-traites";
import type { SourcesSujets } from "./sujets-traites";
import "server-only";
import { createHash } from "node:crypto";
import { DESSINS } from "@/briques/dessins";
import { BORNES_FICHE, cleFicheScenes, empreinteFiche, type ProblemeFiche } from "@/briques/fiche-scenes";
import { EMPLACEMENT_MOT, TABLE_FINS } from "@/briques/fins";
import { ecranTableauVisible, FORMAT_TABLEAU_ANIME } from "@/components/formats/tableau-anime/aiguillage";
import { phraseDuRefus } from "@/components/formats/tableau-anime/vue";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import { voixPourFormat } from "@/domaine/voix-format";
import type { PastilleControle } from "@/domaine/relecture-script";
import { contexteDesLignes, contexteDuGenerateur, correctionsDeLaRelecture, lireLignesRelues, pastillesTexteTableau, RAISON_CASE_DEJA_VU, repereFiche, repereTexte, texteDeWillAccepte, texteDesLignes } from "@/domaine/relecture-tableau";
import { MENTION_IA_PAR_DEFAUT } from "@/domaine/derivations";
import type { BlocScript, Distribution, Id, MentionIA, Video } from "@/domaine/types";
import { dureeParDefaut, reglagesParDefaut, trouverFormat } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { formaterMontant, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { ENTREE_TABLEAU, fichiersDuTravail, lireEntreesTableau, voixPayeeDuTravail, type VoixPayee } from "@/moteurs/montage-tableau";
import { ancreParlee, couperScene } from "@/moteurs/montage-tableau/rythme";
import { coutPireDecoupageUsd, decouperEnScenes, ETAPE_DECOUPAGE, PARTIES_MAX, partiesDuDecoupage, remettreEnForme, type EntreeDecoupage, type OutilsDecoupage, type PreuveProposee, type ReponseAppelDecoupage, type ResultatDecoupage } from "@/moteurs/montage-tableau/decoupage";
import type { CaseDejaVu } from "@/moteurs/montage-tableau/controles";
import { estimerFabrication } from "@/moteurs/montage-tableau/fabriquer";
import { lecturesVoixMaxDuReglage } from "./voix-ressemblance";
import { relireFicheTableau, type PointRelecture } from "@/moteurs/montage-tableau/relecture";
import { descriptionSortie, sortiesDesReseaux, type IdSortie } from "@/moteurs/montage-tableau/formats-sortie";
import { DESCRIPTIONS_STRUCTURES, STRUCTURES_TABLEAU, STYLE_PAR_DEFAUT_TABLEAU, STYLE_REFERENCE_2, STYLE_REFERENCE_3, validerFicheTableau, type ElementTableau, type FicheTableau, type StructureTableau } from "@/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "@/moteurs/montage-tableau/regles";
import {
  RESEAUX_SCRIPT,
  RESEAUX_SCRIPT_INFOS,
  partiesAccordees,
  partiesDuScript,
  phrasesDites,
  schemaDemandeScript,
  SERIES_TABLEAU as SERIES_SCRIPT,
  type AngleScript,
  type DemandeScriptTableau,
  type PartieScript,
  type ResultatScriptTableau,
  type ScriptTableau,
} from "@/domaine/scripts-tableau";
import type { VersionRetenue } from "@/domaine/scripts-tableau-controles";
import { contientExpression, mots as motsDuTexte, motsPleins } from "@/domaine/controles-script/texte";
import { titreAffiche } from "@/domaine/titres";
import { CARACTERES_DITS_MAX_TABLEAU, DUREE_MAX_TABLEAU_SEC, caracteresDits, dureeDiteSec } from "@/domaine/duree-tableau";
import { DOULEUR_MAX_TABLEAU, MOT_DOULEUR_LONGUEUR_MAX, MOTS_DOULEUR_MAX, couperAuMot, douleurDepuisScript, nettoyerMotsDouleur, raccourcirDouleur } from "@/domaine/douleur-tableau";
import { METHODE_PAR_DEFAUT, PARAM_METHODE_TABLEAU, methodeLue, type MethodeTableau } from "./tableau-scripts/consignes";
import { depots, ErreurStudio, fournisseur, horodatage, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { appelerRejoue, clientRejoue, lireTache, modifierTache, nouvelleTache, NOM_ANNEXE_TABLEAU, phraseErreur, tacheActive, travaillerTaches, vueTache, type TacheTableau, type VueTacheTableau } from "./tableau-taches";
import { MARGE_CREDITS } from "./credits";
import { exigerSession } from "./auth";
import { trouverMoi } from "./moi";
import { TARIF_VOIX_CENTIMES_PAR_CARACTERE } from "./tableau-outils";
import { interditsDeLaMarque } from "./tableau-marque";
import { choisirFinTableau } from "./tableau-fin";

/* ------------------------------------------------------------------ */
/* Listes fermées de l'écran                                             */
/* ------------------------------------------------------------------ */

/** Les quatre séries du tableau (sans numéro d'épisode : la fiche n'en porte jamais). */
export const SERIES_TABLEAU = [
  { code: "formation", nom: "Formation" },
  { code: "audit", nom: "Audit" },
  { code: "automatisations", nom: "Automatisations" },
  { code: "coaching", nom: "Coaching 1 to 1" },
] as const;

/** Réseaux visés : chacun devient un format de sortie de la fabrication (`sortiesDesReseaux`, sans doublon). */
export const RESEAUX_TABLEAU = [
  { valeur: "verticaux", libelle: "TikTok / Reels / Shorts / Stories" },
  { valeur: "fil-instagram-facebook", libelle: "Fil Instagram et Facebook" },
  { valeur: "linkedin", libelle: "LinkedIn" },
  { valeur: "youtube", libelle: "YouTube" },
] as const;

/** Clé du brouillon dans `video.entrees`. */
export const CLE_CREATION_TABLEAU = "tableauCreation";

const TEXTE_MAX = 4000;
const COURT_MAX = 160;
/** Titre d'un brouillon (« Vos brouillons », page de la vidéo) : coupé au mot, avec « … ». */
const TITRE_MAX = 80;

/* ------------------------------------------------------------------ */
/* Brouillon                                                             */
/* ------------------------------------------------------------------ */

export interface DonneesScriptTableau {
  /** Le texte dit, mot pour mot. */
  texte: string;
  serieCode: string;
  structure: StructureTableau;
  /** La douleur du public, en une phrase (140 caractères au plus : borne de la fiche ; raccourcie, jamais refusée). */
  douleur: string;
  /**
   * Mots de la douleur, tels qu'ils sont DITS au début (2 à 4) : rendus par le générateur (présents dans l'accroche) ou
   * saisis à la main. Les règles « douleur en tête » et « geste fort » les cherchent ; absents : les mots de « douleur ».
   */
  motsDouleur?: string[];
  /** Le geste refaisable dans la minute. */
  gesteMinute: string;
  /** Fin choisie dans la table des fins ; `null` : aucune. */
  finId: string | null;
  /** Mot à commenter (fin « Commentez {MOT} » seulement). */
  mot?: string;
  reseaux: string[];
  /**
   * Les PARTIES NOMMÉES du texte dit (accroche, douleur, solution, étapes, exemple, à retenir, appel), rendues par le
   * générateur (REGLES § « Contrat avec le découpage ») : mises bout à bout, elles redonnent EXACTEMENT `texte`. Absentes
   * d'un texte écrit à la main, et retirées dès que le texte ne leur correspond plus (`partiesAccordees`).
   */
  parties?: PartieScript[];
  /**
   * D'où vient le texte dit : « will » (« J'ai déjà mon texte » : pris à l'identique, la voix n'est pas contrôlée au
   * découpage sur le tutoiement et les mots de temps). Absente : script de Claude, tous les contrôles restent.
   */
  origine?: "will";
}

export interface VersionFicheTableau {
  numero: number;
  fiche: FicheTableau;
  enregistreeLe: string;
  /**
   * `decoupage-a-corriger` : fiche LISIBLE rendue par le découpage mais refusée par les règles. Elle est gardée (le
   * travail payé n'est jamais jeté), affichée avec ses défauts, et ne part jamais en fabrication telle quelle : une
   * correction qui passe les règles l'enregistre comme nouvelle version.
   */
  origine: "decoupage" | "correction" | "decoupage-a-corriger";
}

/** Dernière écriture du script par le générateur (trace en base, collection `tracesScriptsTableau`). */
export interface GenerationBrouillon {
  traceId: string;
  demande: DemandeScriptTableau;
  le: string;
  /** Refus : les motifs, et la MEILLEURE version écrite (gardée et affichée : le travail payé n'est jamais jeté). */
  issue: { ok: true; resultat: ResultatScriptTableau; angle: AngleScript } | { ok: false; motifs: string[]; meilleure?: VersionRetenue };
  /** Reprise d'une trace existante, sans nouvel appel (« Reprendre la meilleure version »). */
  reprise?: boolean;
}

/** `video.entrees.tableauCreation` : les choix, et TOUTES les versions de la fiche (la dernière fait foi). */
export interface BrouillonTableau {
  donnees: DonneesScriptTableau;
  versions: VersionFicheTableau[];
  /** Script écrit par le générateur (« Écrire le script pour moi »), s'il y en a un. */
  generation?: GenerationBrouillon;
  /** Tâche de fond en cours ou dernière tâche (écriture, découpage) : son état, ses appels déjà payés. */
  tache?: TacheTableau;
  /**
   * Case « Ce conseil n'est pas en première page d'une recherche », cochée par Will à la création (datée du jour) ;
   * transmise à la fabrication, dont la relecture la vérifie (absente : la fabrication refuse).
   */
  dejaVu?: CaseDejaVu;
}

/** Lecture tolérante du brouillon d'une vidéo (au moindre doute : rien). */
export function lireBrouillonTableau(video: Pick<Video, "entrees"> | null | undefined): BrouillonTableau | null {
  const b = (video?.entrees as Record<string, unknown> | undefined)?.[CLE_CREATION_TABLEAU] as BrouillonTableau | undefined;
  if (!b || typeof b !== "object" || !b.donnees || !Array.isArray(b.versions)) return null;
  return b;
}

const nettoyer = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Vérifie ce que l'écran envoie (donnée non sûre). Phrases simples, en vouvoiement. */
export function validerDonneesScript(brut: unknown): { ok: true; donnees: DonneesScriptTableau } | { ok: false; phrase: string } {
  const b = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const texte = nettoyer(b.texte, TEXTE_MAX);
  if (texte.split(" ").filter(Boolean).length < 8) return { ok: false, phrase: "Écrivez le texte dit (quelques phrases)." };
  const serie = SERIES_TABLEAU.find((s) => s.code === b.serieCode);
  if (!serie) return { ok: false, phrase: "Choisissez la série." };
  const structure = STRUCTURES_TABLEAU.find((s) => s === b.structure);
  if (!structure) return { ok: false, phrase: "Choisissez la forme de la vidéo." };
  // Trop longue pour la fiche (140 caractères) : raccourcie à la première phrase entière qui tient, jamais refusée.
  const douleur = raccourcirDouleur(nettoyer(b.douleur, TEXTE_MAX));
  if (!douleur) return { ok: false, phrase: "Dites en une phrase le problème de votre public." };
  const motsDouleur = nettoyerMotsDouleur(Array.isArray(b.motsDouleur) || typeof b.motsDouleur === "string" ? (b.motsDouleur as string[] | string) : []);
  if (motsDouleur.length > MOTS_DOULEUR_MAX) return { ok: false, phrase: `Donnez ${MOTS_DOULEUR_MAX} mots de la douleur au plus.` };
  const motVide = motsDouleur.find((m) => !motsPleins(m).length);
  if (motVide) return { ok: false, phrase: `Le mot de la douleur « ${motVide} » ne porte aucun sens : prenez un mot plein (un verbe, un nom) dit au début du texte.` };
  const absent = motsDouleur.find((m) => !contientExpression(texte, m));
  if (absent) return { ok: false, phrase: `Le mot de la douleur « ${absent} » n'est pas dans le texte dit : recopiez-le tel qu'il est dit, ou retirez-le.` };
  // Borne de la fiche (120 caractères) : coupé au mot, jamais refusé.
  const gesteMinute = couperAuMot(nettoyer(b.gesteMinute, TEXTE_MAX), BORNES_FICHE.gesteMinuteMax);
  if (!gesteMinute) return { ok: false, phrase: "Dites le geste à refaire dans la minute." };
  const fin = b.finId ? TABLE_FINS.find((f) => f.id === b.finId) : null;
  if (b.finId && !fin) return { ok: false, phrase: "Cette phrase de fin n'existe pas." };
  const avecMot = !!fin && (fin.dit.includes(EMPLACEMENT_MOT) || fin.ecran.includes(EMPLACEMENT_MOT));
  const mot = nettoyer(b.mot, 24);
  if (avecMot && !/^[\p{L}\p{N}]{2,24}$/u.test(mot)) return { ok: false, phrase: "Donnez le mot à commenter (un seul mot)." };
  const reseaux = Array.isArray(b.reseaux) ? [...new Set(b.reseaux.filter((r): r is string => RESEAUX_TABLEAU.some((x) => x.valeur === r)))] : [];
  if (!reseaux.length) return { ok: false, phrase: "Cochez au moins un réseau." };
  const parties = lireParties(b.parties, texte);
  return { ok: true, donnees: { texte, serieCode: serie.code, structure, douleur, ...(motsDouleur.length ? { motsDouleur } : {}), gesteMinute, finId: fin?.id ?? null, ...(avecMot ? { mot: mot.toUpperCase() } : {}), reseaux, ...(parties ? { parties } : {}), ...(b.origine === "will" ? { origine: "will" as const } : {}) } };
}

/**
 * Les parties nommées envoyées avec le texte (donnée non sûre) : gardées seulement si elles sont bien formées ET
 * redonnent exactement le texte dit ; sinon `undefined` (texte retouché à la main : le découpage le relit sans elles).
 */
export function lireParties(brut: unknown, texte: string): PartieScript[] | undefined {
  if (!Array.isArray(brut) || !brut.length || brut.length > PARTIES_MAX) return undefined;
  const ids = new Set<string>(["accroche", "douleur", "solution", "etape", "exemple", "a-retenir", "appel"]);
  const parties: PartieScript[] = [];
  for (const x of brut) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof o.partie !== "string" || !ids.has(o.partie) || typeof o.texte !== "string" || typeof o.libelle !== "string") return undefined;
    const ecran = Array.isArray(o.ecran) ? o.ecran.filter((e): e is string => typeof e === "string") : [];
    const etape = o.etape && typeof o.etape === "object" ? (o.etape as Record<string, unknown>) : null;
    parties.push({
      partie: o.partie as PartieScript["partie"],
      libelle: o.libelle.slice(0, 40),
      texte: o.texte,
      ecran,
      ...(typeof o.numero === "number" ? { numero: o.numero } : {}),
      ...(etape ? { etape: { action: String(etape.action ?? ""), comment: String(etape.comment ?? ""), resultat: String(etape.resultat ?? "") } } : {}),
      ...(typeof o.mention === "string" ? { mention: o.mention } : {}),
    });
  }
  return partiesAccordees(parties, texte) ? parties : undefined;
}

/** Le contexte des règles d'un brouillon : celui du jour, plus les mots de la douleur de ses choix. */
export function avecMotsDouleur<C extends object>(contexte: C, donnees: Pick<DonneesScriptTableau, "motsDouleur" | "origine">): C & { motsDouleur?: readonly string[]; texteDeWill?: boolean } {
  const avec = donnees.motsDouleur?.length ? { ...contexte, motsDouleur: donnees.motsDouleur } : contexte;
  return donnees.origine === "will" ? { ...avec, texteDeWill: true } : avec;
}

/** Le titre a-t-il été fait de la douleur par l'ancien code (`douleur.slice(0, 80)`) ? */
export function titreVientDeLaDouleur(titre: string, douleurs: readonly string[]): boolean {
  return douleurs.some((d) => !!d && titre === d.slice(0, TITRE_MAX));
}

/** Titre d'un brouillon : le sujet saisi, sinon les premiers mots du texte (sa première phrase), coupé au mot. */
export function titreBrouillon(source: string): string {
  const t = source.replace(/\s+/g, " ").trim();
  const premiere = t.split(/(?<=[.!?…])\s+/)[0] ?? t;
  return couperAuMot(premiere, TITRE_MAX).replace(/\.$/, "");
}

/**
 * Un motif de refus du découpage, dit pour Will (PUR) : les règles disent déjà quoi faire ; les contrôles du découpage
 * (champs recopiés, dessins, preuves) sont des fautes du découpage lui-même, que Will ne peut pas corriger dans le
 * texte : on le lui dit, avec ce qui marche.
 */
export function motifPourVous(motif: string): string {
  if (/\(recopié tel quel\)\.$|doit être recopiée telle quelle/.test(motif)) return `${motif} Rien à corriger de votre côté : la fiche gardée reprend la bonne valeur. Enregistrez-la après relecture, ou « Reprendre ».`;
  if (/n'est pas dans la liste fournie\.$/.test(motif)) return `${motif} Retirez cet élément de la scène en corrigeant la fiche, ou « Reprendre ».`;
  if (/[Cc]hamp « douleur » : \d+ caractères au plus/.test(motif)) return `${motif} Raccourcissez « Le problème de votre public » à ${DOULEUR_MAX_TABLEAU} caractères (une phrase), puis découpez à nouveau.`;
  return motif;
}

/* ------------------------------------------------------------------ */
/* Visibilité, contexte des règles                                       */
/* ------------------------------------------------------------------ */

/** L'écran existe seulement quand le format n'est plus masqué (même aiguillage que « Votre vidéo »). */
export function creationTableauVisible(): boolean {
  return ecranTableauVisible(trouverFormat(FORMAT_TABLEAU_ANIME));
}

export const aujourdhuiIso = () => new Date().toISOString().slice(0, 10);

export async function contexteRegles(aujourdhui: string): Promise<Omit<ContexteTableau, "texteScript">> {
  const d = depots();
  const [preuves, matieres] = await Promise.all([d.preuves.lister(), d.matieres.lister()]);
  // Interdits de Will et mots interdits de la marque : la règle 13 les repasse aussi sur l'écrit (lecture partagée avec les retouches).
  const { interdits, motsInterdits } = await interditsDeLaMarque();
  return { aujourdhui, sourcesChiffres: [], preuves, matieres, interdits, motsInterdits };
}

/** Preuves que la fiche peut montrer : preuves validées (leur énoncé) et démonstrations validées (leurs mots-clés). */
export async function preuvesProposees(aujourdhui: string): Promise<PreuveProposee[]> {
  const d = depots();
  const vivante = (x: { statut: string; archiveLe?: string; retrait?: unknown; perimeLe?: string }) => x.statut === "validee" && !x.archiveLe && !x.retrait && (!x.perimeLe || x.perimeLe >= aujourdhui);
  const [preuves, matieres] = await Promise.all([d.preuves.lister(vivante), d.matieres.lister((m) => m.type === "demonstration" && vivante(m))]);
  return [...preuves.map((p) => ({ id: p.id, resume: p.enonce })), ...matieres.map((m) => ({ id: m.id, resume: (m.motsCles ?? []).join(", ") || "démonstration" }))];
}

const texteDitDe = (f: Pick<FicheTableau, "scenes">) => f.scenes.map((s) => s.texteDit).join(" ");

/* ------------------------------------------------------------------ */
/* Écran                                                                 */
/* ------------------------------------------------------------------ */

export interface FinProposee {
  id: string;
  ecran: string;
  /** Ce que l'écran affiche (jamais une réservation directe : règle de la maison). */
  libelle: string;
  avecMot: boolean;
  validee: boolean;
}

/**
 * Libellé affiché d'une fin (PUR). Règle de la maison : jamais de réservation directe à l'écran du studio ; la fin
 * « Réservez votre appel de diagnostic » s'affiche « Un appel de diagnostic ». Le texte de la fin lui-même (table des
 * fins) n'est pas changé ici.
 */
export function libelleFin(ecran: string): string {
  if (/^r[ée]servez votre appel de diagnostic$/i.test(ecran.trim())) return "Un appel de diagnostic";
  return ecran.replace("{MOT}", "…");
}

export interface EtatBrouillonTableau {
  videoId: Id;
  donnees: DonneesScriptTableau;
  /** Script du générateur et ce qu'il remplit (« Utiliser ce script »). */
  generation: (GenerationBrouillon & { proposition: DonneesScriptTableau | null }) | null;
  fiche: FicheTableau | null;
  problemes: ProblemeFiche[];
  /** La dernière fiche est celle d'un découpage refusé par les règles, gardée « à corriger ». */
  ficheACorriger: boolean;
  /** Prix de la voix de la dernière fiche (centimes d'euro, jamais sous-estimé) ; 0 quand la voix déjà payée est reprise. */
  coutVoixCentimes: number;
  /**
   * La voix à la fabrication : `neuve` (première lecture), `reutilisee` (voix payée par une fabrication arrêtée, même
   * texte dit : rien à repayer), `relue` (le texte dit a changé depuis : la voix est relue et payée).
   */
  voix: "neuve" | "reutilisee" | "relue";
  versions: number;
  /** Tâche de fond (écriture ou découpage) : où elle en est, en clair. */
  tache: VueTacheTableau | null;
  /**
   * Écriture payée dont rien n'a été gardé (avant les tâches de fond : la requête coupée par Cloudflare, constat du
   * 12/10) : le nombre d'appels et leur coût réel. L'écran dit « Écriture interrompue » et propose de reprendre.
   */
  ecritureInterrompue: { appels: number; centimes: number } | null;
  /** La demande d'écriture connue (dernière tâche, dernier script, sinon ce que le brouillon en garde) : le formulaire la reprend. */
  demandeConnue: Partial<DemandeScriptTableau> | null;
  /** Une écriture non livrée a laissé des versions dans sa trace : « Reprendre la meilleure version » (sans appel). */
  repriseTrace: boolean;
  /** Case « Ce conseil n'est pas en première page d'une recherche » : cochée (avec sa date), ou `null`. */
  dejaVu: CaseDejaVu | null;
  /**
   * Pourquoi « Fabriquer la vidéo » est inactif (phrase simple), ou `null` : la relecture complète d'avant la fabrication
   * (LA MÊME que la fabrication, `relireFicheTableau`) passe, la case est cochée, rien ne tourne.
   */
  raisonFabriquer: string | null;
  /** La raison est la case « déjà vu » non cochée (l'écran la suit en direct, sans comparer les phrases). */
  raisonFabriquerCase: boolean;
}

/** Un brouillon récent, pour y revenir depuis « Tableau animé ». */
export interface BrouillonRecentTableau {
  videoId: Id;
  titre: string;
  etat: string;
  date: string;
}

export interface EcranCreationTableau {
  visible: boolean;
  series: { valeur: string; libelle: string }[];
  structures: { valeur: StructureTableau; libelle: string }[];
  reseaux: { valeur: string; libelle: string }[];
  fins: FinProposee[];
  /** Coût PIRE du découpage (deux appels au plus), en centimes d'euro, annoncé avant le clic (script le plus long). */
  coutDecoupageCentimes: number;
  /** Générateur de scripts : listes fermées, et son coût PIRE (quatre appels au plus) annoncé avant le clic. */
  ecriture: { series: { valeur: string; libelle: string }[]; reseaux: { valeur: string; libelle: string }[]; coutCentimes: number };
  brouillon: EtatBrouillonTableau | null;
  /** Les brouillons récents du tableau (le plus récent d'abord). */
  recents: BrouillonRecentTableau[];
}

/** Choix les plus longs que l'écran permet (script de `CARACTERES_DITS_MAX_TABLEAU` caractères dits, 90 s de voix ; phrases de 160) : base du prix annoncé. */
const TEXTE_DECOUPAGE_MAX = "mot ".repeat(Math.ceil(CARACTERES_DITS_MAX_TABLEAU / 4));

/**
 * Les parties du script le plus chargé : `variableDecoupage` répète le texte dans `<parties>` quand le script les porte
 * (`lireParties`), avec le libellé (40 caractères au plus) et le nom de la page de chaque partie. Le prix annoncé est un
 * vrai plafond : toutes les parties permises (3 fixes, 5 étapes, exemple, à retenir, appel), libellés au plus long, et
 * tout le texte maximal réparti entre elles.
 */
const PARTIES_DECOUPAGE_MAX: PartieScript[] = (() => {
  const ids: { partie: PartieScript["partie"]; numero?: number }[] = [{ partie: "accroche" }, { partie: "douleur" }, { partie: "solution" }, ...[1, 2, 3, 4, 5].map((numero) => ({ partie: "etape" as const, numero })), { partie: "exemple" }, { partie: "a-retenir" }, { partie: "appel" }];
  const mots = TEXTE_DECOUPAGE_MAX.trim().split(" ");
  const taille = Math.ceil(mots.length / ids.length);
  return ids.map((x, i) => ({ ...x, libelle: "x".repeat(40), texte: mots.slice(i * taille, (i + 1) * taille).join(" "), ecran: [] })).filter((p) => p.texte);
})();

const DONNEES_DECOUPAGE_MAX: DonneesScriptTableau = { texte: TEXTE_DECOUPAGE_MAX, serieCode: SERIES_TABLEAU[0].code, structure: "erreur-corrigee", douleur: "x".repeat(COURT_MAX), gesteMinute: "x".repeat(COURT_MAX), finId: null, reseaux: [], parties: PARTIES_DECOUPAGE_MAX, motsDouleur: Array.from({ length: MOTS_DOULEUR_MAX }, () => "x".repeat(MOT_DOULEUR_LONGUEUR_MAX)) };

/**
 * Coût pire du découpage d'un script de longueur maximale (premier appel et relance), en centimes d'euro. `controle` et
 * `preuves` : le contexte des règles et les preuves proposées, qui entrent dans la demande (par défaut : aucun).
 */
export function coutDecoupageCentimes(tauxUsdEur: number, controle: Omit<ContexteTableau, "texteScript"> = { aujourdhui: "2026-01-01", sourcesChiffres: [], preuves: [], matieres: [] }, preuves: readonly PreuveProposee[] = []): number {
  // Plafond sur toutes les structures et toutes les séries : leur description entre dans la demande, la plus longue fait le prix.
  const pireUsd = Math.max(...STRUCTURES_TABLEAU.flatMap((structure) => SERIES_TABLEAU.map((serie) => coutPireDecoupageUsd(entreeDecoupage({ ...DONNEES_DECOUPAGE_MAX, structure, serieCode: serie.code }, "v-estimation", "b1", controle, preuves)))));
  return centimesEurDe(pireUsd, tauxUsdEur);
}

/**
 * Le prix du découpage ANNONCÉ sur le bouton, avec le VRAI contexte du jour (règles, preuves proposées) : le même que
 * le serveur exige ensuite (`prixDecoupage`). Avant : annoncé sans les preuves, puis exigé avec (0,82 € puis 0,83 €,
 * la feuille « Confirmer ce prix » s'ouvrait deux fois).
 */
async function annonceDecoupageCentimes(aujourdhui: string, tauxUsdEur: number): Promise<number> {
  return coutDecoupageCentimes(tauxUsdEur, await contexteRegles(aujourdhui), await preuvesProposees(aujourdhui));
}

const centimesEurDe = (usd: number, tauxUsdEur: number) => Math.ceil(usd * 100 * tauxUsdEur - 1e-9);

/** Étape des dépenses de l'écriture du script (même préfixe que son plafond propre). */
const PREFIXE_DEPENSE_SCRIPT = "Tableau · script";

/** Écriture payée sans résultat gardé : dépenses de l'écriture, mais ni script, ni tâche, ni texte (PUR). */
export function ecritureSansResultat(b: BrouillonTableau, depensesScript: { centimes: number }[]): { appels: number; centimes: number } | null {
  if (b.generation || b.tache || b.donnees.texte.trim() || b.versions.length || !depensesScript.length) return null;
  return { appels: depensesScript.length, centimes: depensesScript.reduce((s, x) => s + x.centimes, 0) };
}

async function depensesScriptDe(videoId: Id): Promise<{ centimes: number }[]> {
  const depenses = await depots().depenses.lister((x) => x.videoId === videoId && x.lignes.some((l) => l.etape.startsWith(PREFIXE_DEPENSE_SCRIPT)));
  return depenses.map((x) => ({ centimes: x.total.centimes }));
}

async function boucleTourne(): Promise<boolean> {
  const { boucleActive } = await import("./_boucle-etat");
  return boucleActive();
}

/** L'état d'un brouillon en un mot, pour la liste des brouillons récents (PUR). */
export function etatEnClair(b: BrouillonTableau, interrompue: boolean): string {
  const t = b.tache;
  if (t && tacheActive(t)) return t.type === "ecriture" ? "Écriture en cours" : "Découpage en cours";
  if (t?.statut === "interrompue" || interrompue) return t?.type === "decoupage" ? "Découpage interrompu" : "Écriture interrompue";
  if (t?.statut === "erreur") return "Arrêté : à réessayer";
  const derniere = b.versions.at(-1);
  // Une fiche corrigée à la main et enregistrée (elle passe les règles) est prête, même après un découpage refusé.
  if (derniere?.origine === "correction") return "Fiche prête";
  if (t?.type === "decoupage" && t.statut === "refusee") return derniere?.origine === "decoupage-a-corriger" ? "Découpage à corriger" : "Découpage refusé";
  if (derniere?.origine === "decoupage-a-corriger") return "Découpage à corriger";
  if (b.versions.length) return `Scènes prêtes (version ${b.versions.length})`;
  if (b.generation) return b.generation.issue.ok ? "Script écrit" : b.generation.issue.meilleure ? "Script à revoir" : "Script refusé";
  return b.donnees.texte.trim() ? "Texte saisi" : "Brouillon";
}

/** Les brouillons récents du tableau animé (titre, état, date), le plus récent d'abord. */
export async function brouillonsRecentsTableau(limite = 10): Promise<BrouillonRecentTableau[]> {
  const videos = (await depots().videos.lister((v) => v.formatId === FORMAT_TABLEAU_ANIME && v.statut === "brouillon" && !!lireBrouillonTableau(v))).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe)).slice(0, limite);
  const r: BrouillonRecentTableau[] = [];
  for (const v of videos) {
    const b = lireBrouillonTableau(v)!;
    const interrompue = !!ecritureSansResultat(b, await depensesScriptDe(v.id));
    r.push({ videoId: v.id, titre: titreAffiche(v.titre) || "Sans titre", etat: etatEnClair(b, interrompue), date: v.modifieLe });
  }
  return r;
}

/**
 * Prix de la voix d'une fiche ; 0 pour une fiche « à corriger » trop mal formée pour être chiffrée. 14/10 :
 * `lecturesVoixMax` (contrôle de ressemblance à la voix de référence) : le prix couvre toutes les lectures possibles.
 */
function coutVoixDe(fiche: FicheTableau, lecturesVoixMax: number): number {
  try {
    return estimerFabrication(fiche, TARIF_VOIX_CENTIMES_PAR_CARACTERE, [], { lecturesVoixMax }).centimes;
  } catch {
    return 0;
  }
}

/**
 * LA relecture d'avant la fabrication, pour un brouillon : `relireFicheTableau` avec EXACTEMENT les entrées que la
 * fabrication lancée depuis ce brouillon recevra (fiche, contexte des règles, sorties des réseaux cochés, fin de chaque
 * sortie avec le mot saisi, case « déjà vu », aucun historique ni preuve injectés : la chaîne n'en reçoit pas non plus).
 */
export async function relireBrouillonTableau(b: Pick<BrouillonTableau, "donnees" | "dejaVu">, fiche: FicheTableau, contexte: Omit<ContexteTableau, "texteScript">) {
  const sorties = sortiesDesReseaux(b.donnees.reseaux);
  return relireFicheTableau({
    fiche,
    contexte: { ...avecMotsDouleur(contexte, b.donnees), texteScript: texteDitDe(fiche) },
    historique: [],
    sorties,
    choisirFin: choisirFinTableau({}, { sorties, ...(b.donnees.mot ? { mot: b.donnees.mot } : {}) }),
    ...(b.dejaVu ? { dejaVu: b.dejaVu } : {}),
  });
}

/** Phrase du bouton inactif quand la case « déjà vu » n'est pas cochée (définie avec l'écran, pure). */
export { RAISON_CASE_DEJA_VU };

/** Point de la relecture → refus montré sur sa scène (ou en tête de la fiche). La case « déjà vu » a sa place à part. */
const enProbleme = (p: PointRelecture): ProblemeFiche => ({ regle: p.libelle, ...(p.sceneId ? { sceneId: p.sceneId } : {}), message: p.message });

async function etatBrouillon(video: Video, b: BrouillonTableau, contexte: Omit<ContexteTableau, "texteScript">, extra: { boucle: boolean; depensesScript: { centimes: number }[]; repriseTrace?: boolean }): Promise<EtatBrouillonTableau> {
  const version = b.versions.at(-1) ?? null;
  const derniere = version?.fiche ?? null;
  const aCorriger = version?.origine === "decoupage-a-corriger";
  // La relecture complète (règles, mise en page de chaque sortie, case « déjà vu ») : la même que la fabrication.
  const relecture = derniere ? await relireBrouillonTableau(b, derniere, contexte) : null;
  const points = relecture ? relecture.points.filter((p) => p.famille !== "deja-vu") : [];
  // Une fiche gardée « à corriger » a toujours au moins un point à revoir (elle a été refusée par les règles).
  const problemes = points.length ? points.map(enProbleme) : aCorriger ? [{ regle: "a-corriger", message: "Fiche refusée au découpage : relisez-la, corrigez-la si besoin, puis enregistrez." }] : [];
  const tache = b.tache ? vueTache(b.tache, extra.boucle) : null;
  const dejaPayee = derniere ? await voixDejaPayee(video.id, b, derniere) : null;
  const raisonFabriquer = !derniere
    ? "Découpez d'abord le script en scènes."
    : tacheActive(b.tache)
      ? "Un travail est en cours sur ce brouillon : attendez qu'il finisse."
      : problemes.length
        ? "Corrigez les points signalés sur les scènes avant de fabriquer."
        : !b.dejaVu?.coche
          ? RAISON_CASE_DEJA_VU
          : relecture && !relecture.ok
            ? (relecture.points[0]?.message ?? "La relecture de la fiche n'a pas abouti.")
            : null;
  return {
    videoId: video.id,
    donnees: b.donnees,
    generation: b.generation ? { ...b.generation, proposition: propositionDe(b.generation) } : null,
    fiche: derniere,
    problemes,
    ficheACorriger: aCorriger,
    coutVoixCentimes: derniere && dejaPayee?.etat !== "reutilisee" ? coutVoixDe(derniere, await lecturesVoixMaxDuReglage()) : 0,
    voix: dejaPayee?.etat ?? "neuve",
    versions: b.versions.length,
    tache,
    ecritureInterrompue: ecritureSansResultat(b, extra.depensesScript),
    demandeConnue: b.tache?.demande ?? b.generation?.demande ?? demandeDuBrouillon(b.donnees),
    repriseTrace: !!extra.repriseTrace,
    dejaVu: b.dejaVu?.coche ? b.dejaVu : null,
    raisonFabriquer,
    raisonFabriquerCase: raisonFabriquer === RAISON_CASE_DEJA_VU,
  };
}

/**
 * Ce qu'un brouillon garde d'une demande d'écriture (écriture lancée avant les tâches de fond : seuls la série, le
 * sujet, la fin et le réseau ont été rangés dans ses choix). PUR. Le reste (public, envoi) est à compléter.
 */
export function demandeDuBrouillon(d: DonneesScriptTableau): Partial<DemandeScriptTableau> {
  const reseau = (Object.entries(RESEAU_DU_GENERATEUR) as [DemandeScriptTableau["reseau"], string][]).find(([, v]) => d.reseaux[0] === v)?.[0];
  const fin = d.finId === FIN_DU_GENERATEUR.commentaire ? { type: "commentaire" as const, mot: d.mot ?? "" } : d.finId === FIN_DU_GENERATEUR.diagnostic ? { type: "diagnostic" as const } : undefined;
  return {
    ...(SERIES_SCRIPT.includes(d.serieCode as never) ? { serie: d.serieCode as DemandeScriptTableau["serie"] } : {}),
    ...(d.douleur ? { sujet: d.douleur } : {}),
    ...(reseau ? { reseau } : {}),
    ...(fin ? { fin } : {}),
  };
}

/** Ce que la page affiche ; `visible: false` (format masqué) : rien d'autre n'est lu. */
export async function ecranCreationTableau(videoId?: Id, dependances: { aujourdhui?: string } = {}): Promise<EcranCreationTableau> {
  await exigerSession();
  const vide: EcranCreationTableau = { visible: false, series: [], structures: [], reseaux: [], fins: [], coutDecoupageCentimes: 0, ecriture: { series: [], reseaux: [], coutCentimes: 0 }, brouillon: null, recents: [] };
  if (!creationTableauVisible()) return vide;
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  let brouillon: EtatBrouillonTableau | null = null;
  if (videoId) {
    const video = await depots().videos.obtenir(videoId);
    const b = video && video.formatId === FORMAT_TABLEAU_ANIME && video.statut === "brouillon" ? lireBrouillonTableau(video) : null;
    if (video && b) brouillon = await etatBrouillon(video, b, await contexteRegles(dependances.aujourdhui ?? aujourdhuiIso()), { boucle: await boucleTourne(), depensesScript: await depensesScriptDe(video.id), repriseTrace: await repriseTracePossible(b) });
  }
  return {
    visible: true,
    series: SERIES_TABLEAU.map((s) => ({ valeur: s.code, libelle: s.nom })),
    structures: STRUCTURES_TABLEAU.map((s) => ({ valeur: s, libelle: DESCRIPTIONS_STRUCTURES[s].nom })),
    reseaux: RESEAUX_TABLEAU.map((r) => ({ ...r })),
    fins: finsProposees(),
    coutDecoupageCentimes: await annonceDecoupageCentimes(dependances.aujourdhui ?? aujourdhuiIso(), taux),
    ecriture: {
      series: SERIES_TABLEAU.map((s) => ({ valeur: s.code, libelle: s.nom })),
      reseaux: RESEAUX_SCRIPT.map((r) => ({ valeur: r, libelle: RESEAUX_SCRIPT_INFOS[r].libelle })),
      coutCentimes: coutEcritureCentimes(taux, await pireCasEcritureUsd()),
    },
    brouillon,
    recents: await brouillonsRecentsTableau(),
  };
}

/* ------------------------------------------------------------------ */
/* 2. Découper en scènes                                                 */
/* ------------------------------------------------------------------ */

export interface DependancesCreationTableau {
  /** UN appel Claude (tests : un double) ; par défaut le chemin de dépense du studio. */
  appeler?: OutilsDecoupage["appeler"];
  /** Range la fiche (JSON) dans le stockage du studio. */
  deposerFiche?: (cle: string, contenu: string) => Promise<void>;
  /** Lancement commun des formats (par défaut `lancerFabrication`). */
  lancer?: (videoId: Id, accord: number) => Promise<{ travailId: Id }>;
  aujourdhui?: string;
  /** Sources du contrôle « sujet déjà traité » (tests : de faux dépôts) ; par défaut les dépôts du studio. */
  sourcesSujets?: SourcesSujets;
}

/** L'entrée du découpage d'un brouillon (PUR, exporté pour le test « contrat » générateur → découpage). */
export function entreeDecoupage(donnees: DonneesScriptTableau, videoId: Id, versionId: string, controle: Omit<ContexteTableau, "texteScript">, preuves: readonly PreuveProposee[]): EntreeDecoupage {
  const format = trouverFormat(FORMAT_TABLEAU_ANIME);
  const serie = SERIES_TABLEAU.find((s) => s.code === donnees.serieCode) ?? SERIES_TABLEAU[0];
  return {
    texteScript: donnees.texte,
    structure: donnees.structure,
    serie: { code: serie.code, nom: serie.nom },
    // Borne de la fiche (140 caractères) garantie ici aussi : le découpage recopie la douleur telle quelle.
    douleur: raccourcirDouleur(donnees.douleur),
    gesteMinute: couperAuMot(donnees.gesteMinute, BORNES_FICHE.gesteMinuteMax),
    preuves,
    dessins: DESSINS.map((x) => ({ id: x.id, motsCles: x.motsCles })),
    videoId,
    versionId,
    // Style « reference/3 » (gabarit par parties, 14/10) par défaut : celui du format, sinon celui des nouvelles fiches.
    habillage: format?.pieces?.habillage ?? STYLE_PAR_DEFAUT_TABLEAU,
    stylo: format?.pieces?.stylo ?? "crayon/1",
    ratio: "9:16",
    // Les mots de la douleur suivent jusqu'aux règles (et jusqu'à la consigne : « <mots_douleur> »).
    controle: avecMotsDouleur(controle, donnees),
    // Les parties du script (accroche, douleur, solution…), quand le générateur les rend : le découpage les suit.
    ...(partiesDuDecoupage(donnees.parties) ? { parties: partiesDuDecoupage(donnees.parties) } : {}),
  };
}

/**
 * Le chemin de dépense Claude du studio, rattaché à la vidéo (plafonds, réservation et coût réel compris). `depuis` :
 * l'enveloppe du découpage demandé (un découpage précédent de la même vidéo ne la mange pas).
 */
function appelStudio(videoId: Id, depuis?: string, pireUsd?: number): OutilsDecoupage["appeler"] {
  return async (role, entree) => {
    const { executerRolePourVideo, PLAFOND_DECOUPAGE_TABLEAU } = await import("./depense-claude-video");
    // Plafond PROPRE du découpage pour cette vidéo, à part des textes : par défaut 0,60 $, ou le prix CONFIRMÉ de ce
    // découpage (ses deux appels au pire, marge de réservation comprise) s'il est plus haut ; un réglage explicite gagne.
    const defautUsd = Math.max(PLAFOND_DECOUPAGE_TABLEAU.defautUsd, (pireUsd ?? 0) * (1 + MARGE_CREDITS));
    const r = await executerRolePourVideo(videoId, role, entree, { etape: ETAPE_DECOUPAGE, plafondPropre: { ...PLAFOND_DECOUPAGE_TABLEAU, defautUsd, ...(depuis ? { depuis } : {}) } });
    return reponseDecoupageDepuis(r);
  };
}

/**
 * Ce que le chemin de dépense rend, pour le découpage (PUR). CAUSE DU DÉCOUPAGE VIDE (constat du 12/10) : le rôle du
 * découpage n'a PAS de schéma, et `lireSortie` (`fournisseurs/claude/inscription.ts`) ne remplit `donnees` que pour un
 * rôle avec schéma ; on ne lisait que `donnees`, toujours absent : « La réponse est vide ». Le texte brut est lu ici.
 */
export function reponseDecoupageDepuis(r: import("./depense-claude-video").ResultatVideo): ReponseAppelDecoupage {
  if (!r.ok) return { ok: false, arret: r.arret, message: r.message };
  return { ok: true, simule: r.simule, donnees: r.donnees ?? r.texte, invalide: r.invalide, stopReason: r.stopReason ?? null, coutUsd: r.coutUsd, ...(r.jetons ? { jetons: r.jetons } : {}) };
}

async function distributionDuTableau(): Promise<Distribution[]> {
  const moi = await trouverMoi();
  if (!moi) return [{ role: "voix", source: "double" }];
  const voix = voixPourFormat(await depots().voix.lister((v) => v.personnageId === moi.id), moi, FORMAT_TABLEAU_ANIME);
  return [{ role: "voix", source: "double", personnageId: moi.id, voixId: voix?.id }];
}

/** Brouillon neuf du tableau (statut `brouillon`, rien de lancé). */
async function nouveauBrouillon(donnees: DonneesScriptTableau, titre: string, tache?: TacheTableau): Promise<Video> {
  const format = trouverFormat(FORMAT_TABLEAU_ANIME)!;
  const mention = await lireParametre<MentionIA>("mentionIA.parDefaut", MENTION_IA_PAR_DEFAUT);
  const video: Video = {
    id: nouvelId("v"),
    // Le titre est le SUJET saisi (ou les premiers mots d'un texte collé), jamais la douleur.
    titre: titreBrouillon(titre) || "Sans titre",
    sujet: donnees.gesteMinute,
    formatId: format.id,
    versionFormat: format.version,
    profilRenduVersion: format.profilRendu?.version ?? 1,
    marqueId: "marque-axion",
    statut: "brouillon",
    dureeCibleSec: dureeParDefaut(format),
    ratios: ["9:16"],
    distribution: await distributionDuTableau(),
    entrees: { [CLE_CREATION_TABLEAU]: { donnees, versions: [], ...(tache ? { tache } : {}) } satisfies BrouillonTableau },
    reglages: reglagesParDefaut(format),
    styles: {},
    briquesCoupees: [],
    // La mention IA suit le réglage de Will (Réglages > Mention IA), comme les autres formats.
    briquesAllumees: mention.incrustee ? ["mention-ia"] : [],
    mentionIA: mention,
    adresse: "vous",
    langue: "fr-FR",
    ...horodatage(),
  };
  await depots().videos.enregistrer(video);
  return video;
}

/**
 * Brouillon du tableau d'une vidéo, ou une erreur claire. `apresArret` : une vidéo dont la fabrication s'est arrêtée
 * (« Relancer » depuis la page de la vidéo) se relance depuis son brouillon, comme un brouillon.
 */
async function brouillonExistant(videoId: Id, options: { apresArret?: boolean } = {}): Promise<{ video: Video; brouillon: BrouillonTableau }> {
  const video = await depots().videos.obtenir(videoId);
  const brouillon = video && video.formatId === FORMAT_TABLEAU_ANIME ? lireBrouillonTableau(video) : null;
  if (!video || !brouillon) throw new ErreurStudio("INTROUVABLE", "Ce brouillon n'existe plus.");
  if (video.statut !== "brouillon" && !(options.apresArret && (video.statut === "echec" || video.statut === "annulee"))) throw new ErreurStudio("DEJA_LANCEE", "Cette vidéo est déjà lancée.");
  return { video, brouillon };
}

/**
 * Modifie le brouillon sous le verrou du studio, sur une copie FRAÎCHE de la vidéo : la tâche de fond et l'écran
 * n'écrasent jamais ce que l'autre vient d'écrire (avant, une version ajoutée effaçait aussi le script généré).
 */
async function modifierBrouillon(videoId: Id, f: (b: BrouillonTableau) => BrouillonTableau, video: (b: BrouillonTableau, v: Video, avant: BrouillonTableau) => Partial<Video> = () => ({})): Promise<BrouillonTableau> {
  return sousVerrou(async () => {
    const v = await depots().videos.obtenir(videoId);
    const avant = lireBrouillonTableau(v);
    if (!v || !avant) throw new ErreurStudio("INTROUVABLE", "Ce brouillon n'existe plus.");
    const apres = f(avant);
    await depots().videos.modifier(videoId, { ...video(apres, v, avant), entrees: { ...v.entrees, [CLE_CREATION_TABLEAU]: apres } });
    return apres;
  });
}

async function ajouterVersion(videoId: Id, fiche: FicheTableau, origine: VersionFicheTableau["origine"], donnees?: DonneesScriptTableau): Promise<number> {
  const b = await modifierBrouillon(
    videoId,
    (x) => ({ ...x, donnees: donnees ?? x.donnees, versions: [...x.versions, { numero: x.versions.length + 1, fiche, enregistreeLe: new Date().toISOString(), origine }] }),
    // Le titre (sujet saisi) n'est jamais remplacé par la douleur ; un titre fait de la douleur par l'ancien code est
    // remplacé par le sujet (ou les premiers mots du texte).
    // Durée affichée avant le montage : la même estimation que le générateur et les règles (voix réelle).
    (x, v, avant) => ({ sujet: x.donnees.gesteMinute, dureeCibleSec: Math.max(1, Math.round(dureeDiteSec(texteDitDe(fiche)))), ...(titreVientDeLaDouleur(v.titre, [avant.donnees.douleur, x.donnees.douleur]) ? { titre: titreBrouillon(x.generation?.demande.sujet || x.donnees.texte) || v.titre } : {}) }),
  );
  return b.versions.length;
}

/** Une tâche du brouillon est-elle en cours ? Phrase de refus, sinon `null`. */
function refusSiOccupe(b: BrouillonTableau): string | null {
  if (!tacheActive(b.tache)) return null;
  return b.tache!.type === "ecriture" ? "Une écriture est déjà en cours pour ce brouillon : attendez qu'elle finisse." : "Un découpage est déjà en cours pour ce brouillon : attendez qu'il finisse.";
}

export type IssueDecoupageTableau =
  | { statut: "en-cours"; videoId: Id; tacheId: string; avertissement?: { niveau: NiveauSujet; precedents: Precedent[] } }
  | { statut: "accord-requis"; centimes: number; phrase: string; videoId?: Id }
  | RefusSujetTraite
  | { statut: "refusee"; phrase: string; refus: string[]; videoId?: Id };

/** Le prix PIRE du découpage de ces choix (deux appels au plus), en dollars et en centimes d'euro, et sa phrase. */
async function prixDecoupage(donnees: DonneesScriptTableau, aujourdhui: string): Promise<{ pireUsd: number; montant: number; phrase: string }> {
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const entree = entreeDecoupage(donnees, "v-prix", "b1", await contexteRegles(aujourdhui), await preuvesProposees(aujourdhui));
  const pireUsd = coutPireDecoupageUsd(entree);
  // Le prix annoncé sur le bouton (script le plus long permis) ; plus haut seulement pour un script plus long encore.
  const montant = Math.max(centimesEurDe(pireUsd, taux), await annonceDecoupageCentimes(aujourdhui, taux));
  return { pireUsd, montant, phrase: `Le découpage coûte au plus ${formaterMontant({ centimes: montant, devise: "EUR" })}. Confirmez ce prix pour lancer.` };
}

/** Refus de « Découper en scènes » sans le repère « texte relu » du texte envoyé. Rien n'est payé. */
export const RAISON_TEXTE_NON_RELU = "Le texte a changé depuis votre relecture : relisez-le, puis « Découper en scènes ». Rien n'a été payé.";

/**
 * « Découper en scènes » : valide les choix, crée (ou reprend) le brouillon, et ENREGISTRE le découpage comme tâche de
 * fond (rend la main tout de suite). La boucle de fond fait le découpage (une relance au plus) et ajoute la fiche
 * validée comme nouvelle version. Refus : une phrase claire, rien d'écrasé.
 */
export async function decouperScriptTableau(brut: unknown, options: { videoId?: Id; accord?: AccordPrix | unknown; relu?: unknown; sujet?: Confirmation } = {}, dependances: DependancesCreationTableau = {}): Promise<IssueDecoupageTableau> {
  await exigerSession();
  if (!creationTableauVisible()) return { statut: "refusee", phrase: "Le tableau animé n'est pas encore ouvert.", refus: [] };
  const v = validerDonneesScript(brut);
  if (!v.ok) return { statut: "refusee", phrase: v.phrase, refus: [], videoId: options.videoId };
  let donnees = v.donnees;
  const aujourdhui = dependances.aujourdhui ?? aujourdhuiIso();
  // LA borne de longueur (la même que le compteur de l'écran, le générateur et la règle de durée) : refusé AVANT le prix.
  const enTrop = caracteresDits(donnees.texte) - CARACTERES_DITS_MAX_TABLEAU;
  if (enTrop > 0) return { statut: "refusee", phrase: `Le texte dit fait ${caracteresDits(donnees.texte)} caractères : ${CARACTERES_DITS_MAX_TABLEAU} au plus (${DUREE_MAX_TABLEAU_SEC} s de voix). Raccourcissez-le d'environ ${enTrop} caractères.`, refus: [], videoId: options.videoId };

  const existant = options.videoId ? (await brouillonExistant(options.videoId)).brouillon : null;
  const occupe = existant && refusSiOccupe(existant);
  if (occupe) return { statut: "refusee", phrase: occupe, refus: [], videoId: options.videoId };
  // Garde-fou : l'origine « will » vient de l'écran ; le texte de Claude lui-même (rechargement) ne la garde pas.
  if (donnees.origine === "will" && !texteDeWillAccepte(donnees.texte, existant)) {
    const { origine: _o, ...sans } = donnees;
    void _o;
    donnees = sans;
  }
  // Texte de Will, pris à l'identique : ni la règle 10 (douleur) ni la fin sans commentaire ne le refusent. Seuls les textes de Claude gardent leurs contrôles.
  // Le texte relu, comme « Fabriquer » : le repère reçu est celui du texte ENVOYÉ (il tombe dès qu'il change). Avant le prix.
  if (typeof options.relu !== "string" || options.relu !== repereTexte(donnees.texte)) return { statut: "refusee", phrase: RAISON_TEXTE_NON_RELU, refus: [], videoId: options.videoId };

  // Sujet déjà traité : « J'ai déjà mon texte » n'a pas d'écriture, donc c'est ICI que le texte d'une NOUVELLE vidéo est contrôlé.
  // Jamais pour un brouillon existant (écrit par Claude, repris, redécoupé). Avant le prix, avant tout brouillon et toute dépense.
  let avertissement: { niveau: NiveauSujet; precedents: Precedent[] } | undefined;
  let choixForce: string | undefined;
  if (!options.videoId) {
    const c = await controlerSujetDuTexte(donnees, confirmationPropre(options.sujet), dependances.sourcesSujets);
    if (c.refus) return c.refus;
    avertissement = c.avertissement;
    choixForce = c.confirme;
  }

  // Le prix, comme l'écriture : rien ne part sans le montant affiché, confirmé (au moins le pire de CE script).
  const prix = await prixDecoupage(donnees, aujourdhui);
  const accord = accordPropre(options.accord);
  if (typeof accord !== "number" || accord < prix.montant) return { statut: "accord-requis", centimes: prix.montant, phrase: prix.phrase, videoId: options.videoId };

  let videoId: Id;
  let tache: TacheTableau;
  if (options.videoId && existant) {
    const brouillon = existant;
    tache = nouvelleTache("decoupage", "decoupage", { aujourdhui, versionId: `b${brouillon.versions.length + 1}`, pireUsd: prix.pireUsd });
    await modifierBrouillon(options.videoId, (b) => ({ ...b, donnees, tache }));
    videoId = options.videoId;
  } else {
    tache = nouvelleTache("decoupage", "decoupage", { aujourdhui, versionId: "b1", pireUsd: prix.pireUsd });
    videoId = (await nouveauBrouillon(donnees, donnees.texte, tache)).id;
  }
  await journaliser("video", "Tableau animé : découpage en scènes demandé (tâche de fond)", { type: "video", id: videoId });
  if (choixForce) await journaliser("video", `Tableau animé : sujet déjà traité, texte voulu quand même (choix « ${choixForce} »)`, { type: "video", id: videoId });
  await reveillerTaches();
  return { statut: "en-cours", videoId, tacheId: tache.id, ...(avertissement ? { avertissement } : {}) };
}

/**
 * Le texte de Will est-il d'un sujet déjà traité ? Deux lectures du même texte : son titre affiché (première phrase, comme le
 * brouillon) et le sujet saisi (le geste). Chaque lecture est contrôlée SANS confirmation (son jeton dépend de son texte) ; si
 * l'une refuse, le refus est UN seul, avec un jeton combiné des jetons refusés : la confirmation reçue vaut seulement si elle
 * porte ce jeton (un précédent qui apparaît ou disparaît le change). Un texte trop court pour être comparé ne bloque rien.
 */
async function controlerSujetDuTexte(donnees: DonneesScriptTableau, confirmation: Confirmation | undefined, sources?: SourcesSujets): Promise<{ refus?: RefusSujetTraite; avertissement?: { niveau: NiveauSujet; precedents: Precedent[] }; confirme?: string }> {
  const { verifierSujet } = await import("./sujets-traites");
  const { racinesIdee } = await import("@/domaine/classement-generateur");
  const { empreinteCourte } = await import("@/domaine/sujets-traites");
  const lectures = [...new Set([titreBrouillon(donnees.texte), donnees.gesteMinute.trim()].filter((t) => racinesIdee(t).size >= 2))];
  const refus: Extract<Awaited<ReturnType<typeof verifierSujet>>, { ok: false }>[] = [];
  let avertissement: { niveau: NiveauSujet; precedents: Precedent[] } | undefined;
  for (const texte of lectures) {
    const v = await verifierSujet({ generateur: ID_FORMAT_TABLEAU_SUJET, texte }, undefined, sources);
    if (v.ok) avertissement ??= v.avertissement;
    else refus.push(v);
  }
  if (!refus.length) return avertissement ? { avertissement } : {};
  const jeton = refus.length === 1 ? refus[0]!.jeton : empreinteCourte(refus.map((r) => r.jeton).sort().join("|"));
  if (confirmation && confirmation.jeton === jeton) return { confirme: confirmation.choix, ...(avertissement ? { avertissement } : {}) };
  const precedents = [...new Map(refus.flatMap((r) => r.precedents).map((p) => [p.videoId ?? p.sujetId ?? p.lien, p] as const)).values()];
  const niveau: NiveauSujet = refus.some((r) => r.niveau === "identique") ? "identique" : "proche";
  const suggestions = refus[0]!.suggestions;
  return { refus: { statut: "sujet-deja-traite", niveau, precedents, suggestions, jeton, ...(confirmation ? { jetonPerime: true } : {}), phrase: niveau === "identique" ? "Ce sujet est déjà traité." : "Un sujet très proche est déjà traité." } };
}

/**
 * La vidéo a-t-elle été supprimée pendant un appel (suppression définitive) ? Alors le retour n'écrit RIEN : ni tâche,
 * ni version, ni journal, ni fichier (aucun document recréé pour un id disparu).
 */
async function supprimeePendantLAppel(videoId: Id): Promise<boolean> {
  if (await depots().videos.obtenir(videoId)) return false;
  console.info(`[tableau] vidéo ${videoId} supprimée pendant un appel : réponse ignorée, rien n'est écrit`);
  return true;
}

/** Le découpage d'une tâche (boucle de fond, hors requête) : appels rejoués s'ils sont déjà payés. */
async function executerDecoupage(videoId: Id, tache: TacheTableau, dependances: DependancesCreationTableau): Promise<void> {
  const { brouillon } = await brouillonExistant(videoId);
  const donnees = brouillon.donnees;
  const aujourdhui = tache.aujourdhui ?? aujourdhuiIso();
  const controle = await contexteRegles(aujourdhui);
  const entree = entreeDecoupage(donnees, videoId, tache.versionId ?? `b${brouillon.versions.length + 1}`, controle, await preuvesProposees(aujourdhui));
  await modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "en-cours", etape: "decoupage" });
  const pireUsd = tache.pireUsd ?? coutPireDecoupageUsd(entree);
  const appeler = appelerRejoue(videoId, tache.id, dependances.appeler ?? appelStudio(videoId, tache.depuis, pireUsd), tache.journal);
  // Le chemin de dépense réserve lui-même chaque appel (plafond de la vidéo, limite du mois, pré-vol) : rien à réserver
  // en plus ici, sinon le même appel serait compté deux fois.
  const r = await decouperEnScenes(entree, { appeler, budget: { reserver: async () => ({ ok: true }) } });
  if (await supprimeePendantLAppel(videoId)) return;
  if (!r.ok) {
    // Arrêt avant l'appel (plafond, crédit) ou Claude indisponible : on peut réessayer (rien de repayé) ; refus des
    // règles, réponse coupée ou illisible : « Réessayer » refait un découpage neuf, après confirmation du prix.
    const reessayable = r.motif === "budget" || r.motif === "appel";
    console.error(`[tableau] découpage de la vidéo ${videoId} arrêté à l'étape « découpage » : ${r.motif} — ${r.message.slice(0, 200)}`);
    // Le travail payé n'est jamais jeté : une fiche lisible refusée par les règles est gardée « à corriger ».
    if (r.aCorriger) await ajouterVersion(videoId, { ...r.aCorriger, appelId: donnees.finId }, "decoupage-a-corriger", donnees);
    await modifierTache(videoId, tache.id, (t) => t && { ...t, statut: reessayable ? "erreur" : "refusee", enVol: undefined, message: messageDecoupage(r), motifs: r.refus.map(motifPourVous) });
    await journaliser("video", `Tableau animé : découpage ${r.motif === "tronquee" ? "coupé" : "refusé"}, la main revient à Will`, { type: "video", id: videoId });
    return;
  }
  // La fin choisie par Will est portée par la fiche (la chaîne la lit, jamais une fin non validée).
  await ajouterVersion(videoId, { ...r.fiche, appelId: donnees.finId }, "decoupage", donnees);
  await modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "terminee", enVol: undefined, message: r.relance ? "Scènes prêtes (après une relance)." : "Scènes prêtes." });
  await journaliser("video", "Tableau animé : script découpé en scènes", { type: "video", id: videoId });
}

/** La phrase durable d'un découpage qui n'a pas abouti, selon son issue (PUR). */
export function messageDecoupage(r: Extract<ResultatDecoupage, { ok: false }>): string {
  if (r.motif === "tronquee") return "Découpage coupé : la réponse a été coupée avant la fin. Rien n'est rejoué à l'identique : « Reprendre » refait un découpage.";
  if (r.motif === "illisible") return "Découpage illisible : la réponse n'a pas pu être lue. « Reprendre » refait un découpage.";
  if (r.motif === "refusee") return r.aCorriger ? "Découpage refusé par les règles. La fiche est gardée ci-dessous avec ses défauts : corrigez-la à la main, ou « Reprendre »." : "Découpage refusé par les règles. « Reprendre » refait un découpage.";
  return r.message;
}

/* ------------------------------------------------------------------ */
/* 3. Corriger la fiche                                                  */
/* ------------------------------------------------------------------ */

/** Correction d'une scène : le texte dit, le texte de ses lignes écrites (par identifiant d'élément), ses mots importants. */
export interface CorrectionScene {
  sceneId: string;
  texteDit?: string;
  lignes?: Record<string, string>;
  /**
   * « Mots importants » de la scène, séparés par des virgules (vide : aucun). Chaque mot va aux lignes où il est écrit ;
   * `normaliserEcrans` les remet en forme (mots seuls, sans ponctuation, seulement ceux de la ligne).
   */
  importants?: string;
  /** Lignes écrites AJOUTÉES à la scène (texte court, ancré au mot où ses mots sont dits ; sinon au dernier mot). */
  ajouts?: string[];
  /** Couper la scène en deux juste avant ce mot (un début de phrase du texte dit, index de mot comme l'ancre). */
  couperAvant?: number;
}


/** Applique les corrections (pure) ; rien d'autre ne change. */
export function appliquerCorrections(fiche: FicheTableau, corrections: readonly CorrectionScene[]): FicheTableau {
  const parScene = new Map(corrections.map((c) => [c.sceneId, c] as const));
  return {
    ...fiche,
    scenes: fiche.scenes.map((s) => {
      const c = parScene.get(s.id);
      if (!c) return s;
      return {
        ...s,
        ...(typeof c.texteDit === "string" ? { texteDit: c.texteDit.replace(/\s+/g, " ").trim() } : {}),
        elements: s.elements.map((e) => {
          if (e.type !== "ligne") return e;
          const texte = typeof c.lignes?.[e.id] === "string" ? c.lignes[e.id].replace(/\s+/g, " ").trim() : e.texte;
          if (typeof c.importants !== "string") return { ...e, texte };
          // Mots importants : la liste saisie est posée sur chaque ligne ; `normaliserEcrans` garde ceux qu'elle écrit.
          const { importants: _avant, ...ligne } = e;
          void _avant;
          const mots = c.importants.split(",").map((m) => m.trim()).filter(Boolean);
          return mots.length ? { ...ligne, texte, importants: mots } : { ...ligne, texte };
        }),
      };
    }),
  };
}

/** Un identifiant de ligne libre dans la fiche, dérivé de la scène (« s04l1 »…). */
function idLigneLibre(fiche: FicheTableau, sceneId: string): string {
  const pris = new Set(fiche.scenes.flatMap((s) => s.elements.map((e) => e.id)));
  let n = 1;
  while (pris.has(`${sceneId}l${n}`)) n++;
  return `${sceneId}l${n}`;
}

/**
 * Ajoute les lignes écrites demandées (pure) : texte resserré, niveau « texte », rôle « règle », ancrée au mot où ses
 * mots sont dits (sinon au dernier mot de la scène). Les lignes vides sont ignorées.
 */
export function ajouterLignes(fiche: FicheTableau, corrections: readonly CorrectionScene[]): FicheTableau {
  let f = fiche;
  for (const c of corrections) {
    for (const brut of c.ajouts ?? []) {
      const texte = brut.replace(/\s+/g, " ").trim();
      const i = f.scenes.findIndex((s) => s.id === c.sceneId);
      if (!texte || i < 0) continue;
      const s = f.scenes[i];
      const dits = motsDuTexte(s.texteDit);
      const ancre = ancreParlee(dits, texte) ?? Math.max(0, dits.length - 1);
      // Style « reference/2 » (gabarit de page clair) : une ligne ajoutée à la main est un détail de sa page.
      const ligne: ElementTableau = { id: idLigneLibre(f, s.id), type: "ligne", texte, niveau: "texte", role: "regle", ...(f.habillage === STYLE_REFERENCE_2 || f.habillage === STYLE_REFERENCE_3 ? { bloc: "detail" as const } : {}), ancre };
      f = { ...f, scenes: f.scenes.map((x, j) => (j === i ? { ...x, elements: [...x.elements, ligne] } : x)) };
    }
  }
  return f;
}

/**
 * Coupe les scènes demandées en deux à une fin de phrase (pure), de la dernière à la première (les identifiants sont
 * renumérotés après chaque coupe). Une coupe impossible rend une phrase, et rien n'est coupé.
 */
export function couperScenes(fiche: FicheTableau, corrections: readonly CorrectionScene[]): { ok: true; fiche: FicheTableau } | { ok: false; phrase: string } {
  const coupes = corrections
    .filter((c) => typeof c.couperAvant === "number")
    .map((c) => ({ i: fiche.scenes.findIndex((s) => s.id === c.sceneId), mot: c.couperAvant! }))
    .filter((c) => c.i >= 0)
    .sort((a, b) => b.i - a.i);
  let f = fiche;
  for (const c of coupes) {
    const r = couperScene(f, c.i, c.mot);
    if (!r) return { ok: false, phrase: `La scène ${c.i + 1} ne peut pas être coupée là : choisissez une fin de phrase qui laisse un élément écrit de chaque côté (10 scènes au plus, jamais la scène de l'appel).` };
    f = r;
  }
  return { ok: true, fiche: f };
}

function lireCorrections(brut: unknown): CorrectionScene[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((c): CorrectionScene[] => {
    const x = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    if (typeof x.sceneId !== "string") return [];
    const lignes = x.lignes && typeof x.lignes === "object" ? Object.fromEntries(Object.entries(x.lignes as Record<string, unknown>).filter(([, t]) => typeof t === "string").map(([k, t]) => [k, String(t).slice(0, COURT_MAX)])) : undefined;
    const ajouts = Array.isArray(x.ajouts) ? x.ajouts.filter((t): t is string => typeof t === "string" && !!t.trim()).slice(0, BORNES_FICHE.elementsMax).map((t) => t.slice(0, COURT_MAX)) : [];
    const couperAvant = typeof x.couperAvant === "number" && Number.isInteger(x.couperAvant) && x.couperAvant > 0 ? x.couperAvant : undefined;
    return [
      {
        sceneId: x.sceneId,
        ...(typeof x.texteDit === "string" ? { texteDit: x.texteDit.slice(0, TEXTE_MAX) } : {}),
        ...(lignes ? { lignes } : {}),
        ...(typeof x.importants === "string" ? { importants: x.importants.slice(0, COURT_MAX) } : {}),
        ...(ajouts.length ? { ajouts } : {}),
        ...(couperAvant !== undefined ? { couperAvant } : {}),
      },
    ];
  });
}

export type IssueCorrectionTableau = { statut: "enregistree"; version: number } | { statut: "refusee"; phrase: string; problemes: ProblemeFiche[] };

/** Correction de l'en-tête de la fiche : la douleur et ses mots (règles « douleur en tête » et « geste fort »). */
export interface CorrectionEntete {
  douleur?: string;
  /** Séparés par des virgules (ou une liste) ; vide : les mots du champ « douleur ». */
  motsDouleur?: string | string[];
}

/** Ce que l'écran envoie : la liste des scènes corrigées, ou `{ scenes, douleur, motsDouleur }` (donnée non sûre). */
function lireEntete(brut: unknown): CorrectionEntete {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const b = brut as Record<string, unknown>;
  return {
    ...(typeof b.douleur === "string" ? { douleur: b.douleur.slice(0, TEXTE_MAX) } : {}),
    ...(typeof b.motsDouleur === "string" || Array.isArray(b.motsDouleur) ? { motsDouleur: b.motsDouleur as string | string[] } : {}),
  };
}

/**
 * La fiche corrigée et ses choix, SANS RIEN ENREGISTRER : les corrections appliquées, remises en forme comme au
 * découpage, puis validées par les règles. Partagée par « Enregistrer » et par les contrôles en direct de la relecture.
 */
async function ficheCorrigee(
  brouillon: BrouillonTableau,
  actuelle: FicheTableau,
  correctionsBrutes: unknown,
  aujourdhui: string | undefined,
): Promise<{ ok: true; fiche: FicheTableau; donnees: DonneesScriptTableau } | { ok: false; phrase: string; problemes: ProblemeFiche[] }> {
  const scenes = Array.isArray(correctionsBrutes) ? correctionsBrutes : (correctionsBrutes as { scenes?: unknown } | null)?.scenes;
  const entete = lireEntete(correctionsBrutes);
  // Mots forts remis en forme comme au découpage : une ligne réécrite à la main ne doit pas bloquer l'enregistrement.
  // Les formes et le rythme aussi, comme au découpage : ancres ramenées dans le texte dit, identifiants renumérotés,
  // gestes orphelins rattachés, pages en ordre, puis ancres réparties sur les mots dits. Une fiche « à corriger »
  // enregistrée sans changement reçoit donc toutes ces réparations.
  const corrections = lireCorrections(scenes);
  const coupee = couperScenes(ajouterLignes(appliquerCorrections(actuelle, corrections), corrections), corrections);
  if (!coupee.ok) return { ok: false, phrase: coupee.phrase, problemes: [] };
  const douleur = entete.douleur !== undefined ? raccourcirDouleur(entete.douleur) : actuelle.douleur;
  if (!douleur) return { ok: false, phrase: "Dites en une phrase le problème de votre public.", problemes: [] };
  const motsDouleur = entete.motsDouleur !== undefined ? nettoyerMotsDouleur(entete.motsDouleur) : (brouillon.donnees.motsDouleur ?? []);
  const corrigee = remettreEnForme({ ...coupee.fiche, douleur }, { motsDouleur });
  const texte = texteDitDe(corrigee);
  if (motsDouleur.length > MOTS_DOULEUR_MAX) return { ok: false, phrase: `Donnez ${MOTS_DOULEUR_MAX} mots de la douleur au plus.`, problemes: [] };
  const absent = motsDouleur.find((m) => !motsPleins(m).length || !contientExpression(texte, m));
  if (absent) return { ok: false, phrase: `Le mot de la douleur « ${absent} » n'est pas dit dans le texte : recopiez-le tel qu'il est dit, ou retirez-le.`, problemes: [] };
  const donnees: DonneesScriptTableau = { ...brouillon.donnees, texte, douleur, motsDouleur: motsDouleur.length ? motsDouleur : undefined };
  if (!donnees.motsDouleur) delete donnees.motsDouleur;
  // Texte corrigé : les parties nommées ne tiennent que si elles le redonnent encore mot pour mot.
  if (donnees.parties && !partiesAccordees(donnees.parties, texte)) delete donnees.parties;
  const r = validerFicheTableau(corrigee, { ...avecMotsDouleur(await contexteRegles(aujourdhui ?? aujourdhuiIso()), donnees), texteScript: texte });
  if (!r.ok) return { ok: false, phrase: "Ces corrections ne passent pas les règles : rien n'a été enregistré.", problemes: r.problemes };
  return { ok: true, fiche: r.fiche, donnees };
}

/**
 * Enregistre les corrections comme NOUVELLE version, si la fiche corrigée passe les règles ; sinon rien ne change.
 * `correctionsBrutes` : la liste des scènes corrigées, ou `{ scenes, douleur, motsDouleur }` (la douleur, raccourcie
 * à 140 caractères s'il le faut, et ses mots, qui doivent être dits dans le texte, peuvent aussi être corrigés).
 */
export async function corrigerFicheTableau(videoId: Id, correctionsBrutes: unknown, dependances: { aujourdhui?: string } = {}): Promise<IssueCorrectionTableau> {
  await exigerSession();
  if (!creationTableauVisible()) return { statut: "refusee", phrase: "Le tableau animé n'est pas encore ouvert.", problemes: [] };
  const { video, brouillon } = await brouillonExistant(videoId);
  const occupe = refusSiOccupe(brouillon);
  if (occupe) return { statut: "refusee", phrase: occupe, problemes: [] };
  const actuelle = brouillon.versions.at(-1)?.fiche;
  if (!actuelle) return { statut: "refusee", phrase: "Découpez d'abord le script en scènes.", problemes: [] };
  const r = await ficheCorrigee(brouillon, actuelle, correctionsBrutes, dependances.aujourdhui);
  if (!r.ok) return { statut: "refusee", phrase: r.phrase, problemes: r.problemes };
  // Le texte dit corrigé devient le script de la vidéo (les règles exigent l'un égal à l'autre).
  const version = await ajouterVersion(video.id, r.fiche, "correction", r.donnees);
  // Un découpage refusé dont la fiche vient d'être corrigée n'est plus « refusé » : son bandeau et ses motifs s'effacent.
  if (brouillon.tache?.type === "decoupage" && brouillon.tache.statut === "refusee") {
    const id = brouillon.tache.id;
    await modifierTache(video.id, id, (t) => t && { ...t, statut: "terminee", message: "Fiche corrigée à la main.", motifs: undefined });
  }
  return { statut: "enregistree", version };
}

/* ------------------------------------------------------------------ */
/* Relire le script : contrôles en direct (gratuits, rien n'est écrit)  */
/* ------------------------------------------------------------------ */

/**
 * Contrôles en direct du texte dit, AVANT « Découper en scènes » (écran « Relire le script ») : GRATUITS, aucun appel,
 * rien d'écrit. `scriptBrut` : le script relu (seules ses lignes sont lues). Lignes du script généré du brouillon
 * (`videoId`) : tous les contrôles du gabarit cadré, et ceux d'un texte libre s'il a été retouché. Sans script généré, ou
 * quand l'écran déclare le texte de Will (origine « will ») : pris à l'identique, seul le plafond de durée bloque.
 */
export async function controlerTexteTableau(videoId: Id | undefined, scriptBrut: unknown): Promise<PastilleControle[]> {
  await exigerSession();
  const b = videoId ? lireBrouillonTableau(await depots().videos.obtenir(videoId)) : null;
  const lues = lireLignesRelues(scriptBrut);
  // Garde-fou : « will » (déclaré par l'écran) ne vaut pas pour le texte de Claude lui-même, ni retouché ni rechargé.
  const lignes = lues.some((l) => l.deWill) && !texteDeWillAccepte(texteDesLignes(lues), b) ? lues.map(({ deWill: _w, ...l }) => (void _w, l)) : lues;
  return pastillesTexteTableau(lignes, contexteDesLignes(contexteDuGenerateur(b?.generation), lignes));
}

/**
 * Contrôles en direct de la fiche relue, AVANT « Enregistrer » ou « Fabriquer » : les corrections de la relecture
 * passent par LES MÊMES règles qu'à l'enregistrement (`ficheCorrigee`), sans rien enregistrer ni payer. Chaque refus
 * est posé sur sa scène quand il en nomme une.
 */
export async function controlerFicheTableau(videoId: Id, scriptBrut: unknown, dependances: { aujourdhui?: string } = {}): Promise<PastilleControle[]> {
  await exigerSession();
  const { brouillon } = await brouillonExistant(videoId);
  const actuelle = brouillon.versions.at(-1)?.fiche;
  if (!actuelle) return [{ niveau: "bloquant", texte: "Découpez d'abord le script en scènes." }];
  const r = await ficheCorrigee(brouillon, actuelle, correctionsDeLaRelecture(actuelle, lireLignesRelues(scriptBrut)), dependances.aujourdhui);
  if (r.ok) return [];
  if (!r.problemes.length) return [{ niveau: "bloquant", texte: r.phrase }];
  const ids = new Set(actuelle.scenes.map((s) => s.id));
  return r.problemes.map((p) => ({ niveau: "bloquant" as const, code: p.regle, texte: phraseDuRefus(p.message), ...(p.sceneId && ids.has(p.sceneId) ? { ligneId: p.sceneId } : {}) }));
}

/**
 * La dernière fabrication de la vidéo s'est-elle arrêtée à la relecture de la fiche (étape « fiche » du moteur : fiche
 * et contrôles d'avant la voix) ? Rien de la voix n'est alors payé : corriger et relancer ne repaie rien.
 */
export async function arreteeALaRelecture(videoId: Id): Promise<boolean> {
  const travaux = await depots().travaux.lister((t) => t.cibleId === videoId && t.type !== "reexport");
  const dernier = travaux.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
  return dernier?.statut === "echec" && dernier.etapes.some((e) => (e.cle === "fiche" || e.cle === "decoupage") && e.statut === "echec");
}

/**
 * « Corriger la fiche » / « Reprendre la fiche » (page de la vidéo, APRÈS TOUT ARRÊT : relecture, voix, calage, pages,
 * scènes, montage, contrôles, délai de garde, arrêt par Will) : la vidéo redevient un BROUILLON, avec ses versions de
 * fiche, son script et ses choix ; l'écran de création la reprend (`?brouillon=<id>`). Rien n'est perdu : l'écriture et
 * le découpage sont gardés, et la voix déjà payée est reprise à la fabrication suivante si le texte dit n'a pas changé
 * (`voixDejaPayee`, annoncé avant le prix).
 */
export async function rouvrirFicheTableau(videoId: Id): Promise<{ videoId: Id }> {
  await exigerSession();
  if (!creationTableauVisible()) throw new ErreurStudio("MASQUE", "Le tableau animé n'est pas encore ouvert.");
  const { video } = await brouillonExistant(videoId, { apresArret: true });
  if (video.statut === "brouillon") return { videoId };
  const enCours = await depots().travaux.trouver((t) => t.cibleId === videoId && (t.statut === "en_cours" || t.statut === "en_file"));
  if (enCours) throw new ErreurStudio("EN_FABRICATION", "Cette vidéo se fabrique en ce moment : attendez la fin, ou arrêtez-la d'abord.");
  await depots().videos.modifier(videoId, { statut: "brouillon" });
  await journaliser("video", `Tableau animé : fiche rouverte pour correction (${video.statut === "annulee" ? "après un arrêt" : "après un échec"})`, { type: "video", id: videoId });
  return { videoId };
}

/** Empreinte de ce que la voix dit : le texte dit de chaque scène, l'appel, les sorties (fins) et le mot à commenter. */
function empreinteTexteDit(fiche: Pick<FicheTableau, "scenes" | "appelId">, sorties: readonly string[], mot: string | undefined): string {
  return createHash("sha256").update(JSON.stringify([fiche.scenes.map((s) => s.texteDit), fiche.appelId ?? null, [...sorties], mot ?? null])).digest("hex");
}

/** Fabrications de la vidéo, la plus récente d'abord. */
async function fabricationsDe(videoId: Id) {
  const liste = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "fabrication");
  return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

/**
 * La voix déjà payée par une fabrication arrêtée de cette vidéo, pour cette fiche : `reutilisee` (même texte dit, mêmes
 * fins : rien n'est relu ni repayé), `relue` (le texte dit a changé : la voix est relue et payée), `null` (aucune voix
 * payée : prix normal).
 */
export async function voixDejaPayee(videoId: Id, b: Pick<BrouillonTableau, "versions" | "donnees">, fiche: FicheTableau): Promise<{ etat: "reutilisee"; reprise: VoixPayee } | { etat: "relue" } | null> {
  for (const t of await fabricationsDe(videoId)) {
    const reprise = voixPayeeDuTravail(t);
    if (!reprise) continue;
    const version = t.versionId ? await depots().versions.obtenir(t.versionId) : null;
    const e = lireEntreesTableau(version?.commande.entrees);
    const avant = e.version ? b.versions[e.version - 1]?.fiche : undefined;
    if (!avant) return { etat: "relue" };
    const meme = empreinteTexteDit(avant, e.sorties ?? [], e.mot) === empreinteTexteDit(fiche, sortiesDesReseaux(b.donnees.reseaux), b.donnees.mot);
    return meme ? { etat: "reutilisee", reprise } : { etat: "relue" };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* « Relancer » après un arrêt                                          */
/* ------------------------------------------------------------------ */

export type IssueRelanceTableau = { statut: "relancee"; travailId: Id; phrase: string } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

/**
 * « Relancer » (page de la vidéo), après TOUT échec, avec le code d'aujourd'hui :
 *  - arrêt à la relecture (rien de la voix payé) : nouvelle relecture, puis le prix de la voix (`fabriquerVideoTableau`) ;
 *  - arrêt APRÈS la voix (calage d'une sortie, pages, scènes, montage, contrôles, délai de garde) : le MÊME travail
 *    reprend l'étape en échec et les suivantes (`reessayerTravail`) sur son journal : voix payée, scènes dessinées et
 *    fichiers déjà faits sont repris, aucun prix n'est demandé, l'erreur gardée est effacée. Une erreur « non
 *    réessayable » de données (fiche refusée au calage) est RE-CALCULÉE, jamais rejouée telle quelle ;
 *  - arrêt pendant la voix (lecture pas finie) : le prix de la voix est redemandé avant.
 * Jamais sans issue visible : `relancee` (le suivi repart), `accord-requis` (prix à confirmer) ou `refusee` + phrase.
 */
export async function relancerTableau(travailId: Id, accordBrut: AccordPrix | unknown, dependances: DependancesCreationTableau = {}): Promise<IssueRelanceTableau> {
  await exigerSession();
  if (!creationTableauVisible()) return { statut: "refusee", phrase: "Le tableau animé n'est pas encore ouvert." };
  const t = await depots().travaux.obtenir(travailId);
  const video = t ? await depots().videos.obtenir(t.cibleId) : null;
  if (!t || !video || video.formatId !== FORMAT_TABLEAU_ANIME) return { statut: "refusee", phrase: "Cette fabrication n'existe plus : rouvrez la page de la vidéo." };
  if (t.statut === "en_cours" || t.statut === "en_file") return { statut: "relancee", travailId: t.id, phrase: "La fabrication tourne déjà." };
  if (t.statut === "termine") return { statut: "refusee", phrase: "Cette fabrication est terminée : la vidéo est prête." };
  if (t.statut === "annule") return { statut: "refusee", phrase: "Vous avez arrêté cette fabrication : « Reprendre la fiche » rouvre le brouillon (la voix déjà payée est gardée)." };
  const dernier = (await fabricationsDe(video.id))[0];
  if (t.type === "fabrication" && dernier && dernier.id !== t.id) return { statut: "refusee", phrase: "Une fabrication plus récente existe : rouvrez la page de la vidéo." };

  // Arrêt à la relecture : rien de la voix n'est payé ; la relecture et le prix repassent (rien d'autre n'est repayé).
  if (t.type === "fabrication" && t.etapes.some((e) => (e.cle === "fiche" || e.cle === "decoupage") && e.statut === "echec")) {
    // La fiche relue au premier lancement, si elle n'a pas changé depuis (sinon : relire, depuis le brouillon).
    const b = lireBrouillonTableau(video);
    const fabriquee = b && lireEntreesTableau(video.entrees).version === b.versions.length ? b.versions.at(-1)?.fiche : undefined;
    const r = await fabriquerVideoTableau(video.id, accordBrut, dependances, fabriquee ? repereFiche(fabriquee) : undefined);
    return r.statut === "lancee" ? { statut: "relancee", travailId: r.travailId, phrase: "Fabrication relancée." } : r;
  }

  // Après la relecture : le même travail reprend où il s'est arrêté. Voix pas encore lue en entier : son prix d'abord.
  const voixFaite = !t.etapes.some((e) => e.cle === "voix") || t.etapes.some((e) => e.cle === "voix" && e.statut === "terminee");
  const accord = accordPropre(accordBrut);
  if (!voixFaite) {
    const b = lireBrouillonTableau(video);
    const e = lireEntreesTableau(video.entrees);
    const fiche = (e.version ? b?.versions[e.version - 1]?.fiche : undefined) ?? b?.versions.at(-1)?.fiche;
    const montant = fiche ? coutVoixDe(fiche, await lecturesVoixMaxDuReglage()) : 0;
    if (montant > 0 && (typeof accord !== "number" || accord < montant)) {
      return { statut: "accord-requis", centimes: montant, phrase: `La voix n'a pas été lue en entier : environ ${formaterMontant({ centimes: montant, devise: "EUR" })} au plus. Confirmez ce prix pour relancer.` };
    }
  }
  try {
    const { reessayerTravail } = await import("./travaux");
    await reessayerTravail(t.id, voixFaite ? {} : { confirme: accord });
  } catch (err) {
    if (err instanceof ErreurStudio && err.code === "CONFIRMATION_REQUISE" && typeof err.montant === "number") return { statut: "accord-requis", centimes: err.montant, phrase: err.message };
    if (err instanceof ErreurStudio) return { statut: "refusee", phrase: err.message };
    throw err;
  }
  await journaliser("fabrication", "Tableau animé : fabrication relancée là où elle s'était arrêtée", { type: "video", id: video.id });
  return { statut: "relancee", travailId: t.id, phrase: voixFaite ? "Fabrication relancée là où elle s'était arrêtée : la voix déjà payée est reprise, rien n'est repayé." : "Fabrication relancée." };
}

/**
 * Ce qu'une fabrication arrêtée a déjà produit (page de la vidéo) : chaque fichier déposé (téléchargeable, adresse
 * signée) et les sorties qui manquent. `null` : rien d'arrêté.
 */
export async function fichiersApresArretTableau(videoId: Id): Promise<{ prets: { cle: string; libelle: string; url: string }[]; manquants: string[] } | null> {
  const t = (await fabricationsDe(videoId))[0];
  if (!t || (t.statut !== "echec" && t.statut !== "annule")) return null;
  const version = t.versionId ? await depots().versions.obtenir(t.versionId) : null;
  const demandees: IdSortie[] = lireEntreesTableau(version?.commande.entrees).sorties ?? ["vertical"];
  const faits = fichiersDuTravail(t);
  if (!Object.keys(faits).length) return null;
  const stockage = await fournisseur("stockage");
  const prets: { cle: string; libelle: string; url: string }[] = [];
  for (const id of demandees) {
    const f = faits[id];
    if (!f) continue;
    const url = (stockage.urlLectureDuree ? await stockage.urlLectureDuree(f.video, 3600) : await stockage.urlLecture(f.video)) || "";
    if (url) prets.push({ cle: id, libelle: descriptionSortie(id, demandees).libelle, url });
  }
  const manquants = demandees.filter((id) => !prets.some((p) => p.cle === id)).map((id) => descriptionSortie(id, demandees).libelle);
  return { prets, manquants };
}

/**
 * Case « Ce conseil n'est pas en première page d'une recherche » : cochée, elle est DATÉE DU JOUR et enregistrée dans le
 * brouillon (la fabrication la reçoit) ; décochée, elle est retirée. Aucune recherche automatique : c'est Will qui
 * vérifie.
 */
export async function cocherDejaVuTableau(videoId: Id, coche: boolean, dependances: { aujourdhui?: string } = {}): Promise<{ dejaVu: CaseDejaVu | null }> {
  await exigerSession();
  if (!creationTableauVisible()) throw new ErreurStudio("MASQUE", "Le tableau animé n'est pas encore ouvert.");
  await brouillonExistant(videoId);
  const dejaVu: CaseDejaVu | undefined = coche === true ? { coche: true, le: dependances.aujourdhui ?? aujourdhuiIso() } : undefined;
  await modifierBrouillon(videoId, (b) => {
    const { dejaVu: _avant, ...reste } = b;
    void _avant;
    return dejaVu ? { ...reste, dejaVu } : reste;
  });
  return { dejaVu: dejaVu ?? null };
}

/* ------------------------------------------------------------------ */
/* 4. Fabriquer                                                          */
/* ------------------------------------------------------------------ */

export type IssueFabricationTableau = { statut: "lancee"; videoId: Id; travailId: Id } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

async function deposerFicheReelle(cle: string, contenu: string): Promise<void> {
  const { resoudreFournisseur } = await import("@/fournisseurs");
  const stockage = resoudreFournisseur("stockage");
  if (stockage.mode === "simulation" || !stockage.urlDepotDuree) throw new ErreurStudio("STOCKAGE_NON_RELIE", "Le stockage des fichiers n'est pas relié : la vidéo ne peut pas partir. Rien n'a été payé.");
  const url = await stockage.urlDepotDuree(cle, 600, "application/json");
  // 10 s au plus : avec le pré-vol des crédits (15 s au plus), « Fabriquer » reste sous 30 s.
  const r = await fetch(url, { method: "PUT", body: contenu, headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new ErreurStudio("STOCKAGE_REFUS", "La fiche de scènes n'a pas pu être rangée. Rien n'a été payé : réessayez dans un instant.");
}

async function lancerCommun(videoId: Id, accord: number): Promise<{ travailId: Id }> {
  const { lancerFabrication } = await import("./fabrication");
  return lancerFabrication(videoId, { confirme: accord });
}

/** Refus de « Fabriquer » sans le repère « script relu » de la fiche actuelle. Rien n'est payé. */
export const RAISON_SCRIPT_NON_RELU = "Le script a changé depuis votre relecture : relisez-le, puis « Fabriquer ». Rien n'a été payé.";

/**
 * « Fabriquer la vidéo » : refus côté serveur sans le repère « script relu » de la fiche actuelle (`relu`, empreinte
 * des lignes relues : `repereFiche`), puis sans un MONTANT confirmé au moins égal au prix de la voix (`true` ne
 * suffit pas). Ensuite : fiche rangée dans le stockage, script de la vidéo, entrées du tableau, lancement commun.
 */
export async function fabriquerVideoTableau(videoId: Id, accordBrut: AccordPrix | unknown, dependances: DependancesCreationTableau = {}, relu?: unknown): Promise<IssueFabricationTableau> {
  await exigerSession();
  if (!creationTableauVisible()) return { statut: "refusee", phrase: "Le tableau animé n'est pas encore ouvert." };
  // Une vidéo arrêtée à la relecture se relance d'ici (« Relancer ») : rien n'a été payé de la voix à ce moment-là.
  const { video, brouillon } = await brouillonExistant(videoId, { apresArret: true });
  if (video.statut === "echec" && !(await arreteeALaRelecture(video.id))) return { statut: "refusee", phrase: "Cette vidéo s'est arrêtée après la voix : « Reprendre la fabrication » (page de la vidéo) reprend l'étape en échec sans rien repayer, « Corriger la fiche » rouvre le brouillon." };
  const occupe = refusSiOccupe(brouillon);
  if (occupe) return { statut: "refusee", phrase: occupe };
  const fiche = brouillon.versions.at(-1)?.fiche;
  if (!fiche) return { statut: "refusee", phrase: "Découpez d'abord le script en scènes." };
  if (brouillon.versions.at(-1)?.origine === "decoupage-a-corriger") return { statut: "refusee", phrase: "Cette fiche a été refusée au découpage : corrigez-la et enregistrez-la avant de fabriquer." };
  // Le script relu : le repère reçu est celui de la fiche ACTUELLE (il tombe dès que son texte change). Avant le prix.
  if (typeof relu !== "string" || relu !== repereFiche(fiche)) return { statut: "refusee", phrase: RAISON_SCRIPT_NON_RELU };
  const contexte = avecMotsDouleur(await contexteRegles(dependances.aujourdhui ?? aujourdhuiIso()), brouillon.donnees);
  const r = validerFicheTableau(fiche, { ...contexte, texteScript: texteDitDe(fiche) });
  if (!r.ok) return { statut: "refusee", phrase: "La fiche de scènes a des points à revoir : corrigez-les, puis relancez." };
  // LA relecture de la fabrication, AVANT de demander le prix : un refus ici ne propose jamais de payer.
  if (!brouillon.dejaVu?.coche) return { statut: "refusee", phrase: RAISON_CASE_DEJA_VU };
  const relecture = await relireBrouillonTableau(brouillon, r.fiche, contexte);
  if (!relecture.ok) return { statut: "refusee", phrase: `La relecture de la fiche n'a pas abouti : ${relecture.points.slice(0, 3).map((p) => p.message).join(" ")}` };

  // Voix déjà payée par une fabrication arrêtée, même texte dit : reprise, aucun prix ; texte changé : relue et payée.
  const dejaPayee = await voixDejaPayee(video.id, brouillon, r.fiche);
  // 14/10 : contrôle de ressemblance de la voix : le prix confirmé couvre toutes les lectures possibles (3 au plus).
  const montant = dejaPayee?.etat === "reutilisee" ? 0 : estimerFabrication(r.fiche, TARIF_VOIX_CENTIMES_PAR_CARACTERE, [], { lecturesVoixMax: await lecturesVoixMaxDuReglage() }).centimes;
  const accord = accordPropre(accordBrut);
  if (montant > 0 && (typeof accord !== "number" || accord < montant)) {
    const prix = formaterMontant({ centimes: montant, devise: "EUR" });
    return { statut: "accord-requis", centimes: montant, phrase: dejaPayee?.etat === "relue" ? `Le texte dit a changé : la voix sera relue, environ ${prix}. Confirmez ce prix pour lancer.` : `La voix coûte environ ${prix}. Confirmez ce prix pour lancer.` };
  }

  if (await supprimeePendantLAppel(video.id)) return { statut: "refusee", phrase: "Ce brouillon n'existe plus." };
  const numero = brouillon.versions.length;
  const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
  const cle = cleFicheScenes(env, video.id, `b${numero}`);
  await (dependances.deposerFiche ?? deposerFicheReelle)(cle, JSON.stringify(r.fiche));

  // Le script de la vidéo : une scène par bloc, mot pour mot (le prix et la chaîne lisent le même texte).
  const blocs: BlocScript[] = r.fiche.scenes.map((s, i) => ({ id: `${video.id}-b${i + 1}`, blocRecette: i === 0 ? "accroche" : "geste", segments: [{ id: `${video.id}-s${i + 1}`, texte: s.texteDit }] }));
  const { enregistrerScriptDuBrouillon } = await import("./videos");
  await enregistrerScriptDuBrouillon(video.id, blocs);
  const aJour = (await depots().videos.obtenir(video.id))!;
  const distribution = aJour.distribution.some((x) => x.personnageId) ? aJour.distribution : await distributionDuTableau();
  // Réseaux cochés → formats de sortie ; le mot à commenter de la fin ; la trace du script généré, s'il y en a un.
  const entreesTableau = {
    ficheScenesCle: cle,
    empreinte: empreinteFiche(r.fiche),
    version: numero,
    sorties: sortiesDesReseaux(brouillon.donnees.reseaux),
    ...(brouillon.donnees.mot ? { mot: brouillon.donnees.mot } : {}),
    // Les mots de la douleur validés avec la fiche : la relecture de la fabrication cherche les mêmes.
    ...(brouillon.donnees.motsDouleur?.length ? { motsDouleur: brouillon.donnees.motsDouleur } : {}),
    // L'origine « will » (texte de Will pris à l'identique) : les retouches de « Votre vidéo » la relisent.
    ...(brouillon.donnees.origine === "will" ? { origine: "will" as const } : {}),
    ...(brouillon.generation?.traceId ? { traceScriptId: brouillon.generation.traceId } : {}),
    // La case « déjà vu » cochée (avec sa date) : la relecture de la fabrication la vérifie.
    dejaVu: brouillon.dejaVu,
    // La voix déjà payée (même texte dit) : le moteur la reprend au lancement, rien n'est relu.
    ...(dejaPayee?.etat === "reutilisee" ? { voixPayee: dejaPayee.reprise } : {}),
  };
  await depots().videos.modifier(video.id, { distribution, entrees: { ...aJour.entrees, [ENTREE_TABLEAU]: entreesTableau } });

  const { travailId } = await (dependances.lancer ?? lancerCommun)(video.id, typeof accord === "number" ? accord : 0);
  await journaliser("video", "Tableau animé : fabrication lancée depuis la console", { type: "video", id: video.id });
  return { statut: "lancee", videoId: video.id, travailId };
}

/* ------------------------------------------------------------------ */
/* « Écrire le script pour moi » : le générateur de scripts              */
/* ------------------------------------------------------------------ */

/**
 * Fins proposées à l'écran : une seule ligne par phrase (une même fin existe dans chaque groupe de réseaux ; chaque
 * sortie prend celle de son groupe à la fabrication).
 */
export function finsProposees(table: readonly (typeof TABLE_FINS)[number][] = TABLE_FINS): FinProposee[] {
  const vues = new Set<string>();
  return table.flatMap((f) => {
    const cle = `${f.type}|${f.ecran}`;
    if (vues.has(cle)) return [];
    vues.add(cle);
    return [{ id: f.id, ecran: f.ecran, libelle: libelleFin(f.ecran), avecMot: f.dit.includes(EMPLACEMENT_MOT) || f.ecran.includes(EMPLACEMENT_MOT), validee: f.validee }];
  });
}

/** Fins du générateur → fin de la table (la phrase validée du mot à commenter ; l'appel de diagnostic, à valider). */
export const FIN_DU_GENERATEUR = { commentaire: "fin-if-mot-envoi", diagnostic: "fin-if-diagnostic" } as const;

/** Réseau principal du générateur → case « réseaux » de l'écran (donc format de sortie). */
export const RESEAU_DU_GENERATEUR: Readonly<Record<(typeof RESEAUX_SCRIPT)[number], (typeof RESEAUX_TABLEAU)[number]["valeur"]>> = {
  courts: "verticaux",
  fil: "fil-instagram-facebook",
  linkedin: "linkedin",
  youtube: "youtube",
};

/** Demande la plus longue permise : sert à annoncer le coût PIRE avant le clic (jamais sous-estimé). */
const DEMANDE_MAX: DemandeScriptTableau = {
  serie: "formation",
  sujet: "x".repeat(160),
  public: "x".repeat(200),
  vraiCas: { metier: "x".repeat(120), tache: "x".repeat(200), avant: "x".repeat(400), apres: "x".repeat(400), date: "x".repeat(40) },
  reseau: "linkedin",
  fin: { type: "diagnostic" },
  envoi: "x".repeat(300),
};

/** Méthode des tâches d'écriture enregistrées AVANT le lot A5 (sans champ `methode`) : le défaut d'alors. Les nouvelles créations écrivent toujours leur méthode. */
export const METHODE_ANCIENNES_TACHES: MethodeTableau = "complete";

/** Méthode d'écriture du tableau (réglage `tableau.methode`) : « courte » sauf si « complete » est réglée. */
export async function methodeEcritureTableau(): Promise<MethodeTableau> {
  return methodeLue(await lireParametre<unknown>(PARAM_METHODE_TABLEAU, METHODE_PAR_DEFAUT));
}

/**
 * Pire cas d'une génération (quatre appels, toute la sortie permise), en dollars, socle de Will compris (sa charte, son
 * style, ses preuves et les modèles de ton, donnés à chaque passe). Socle illisible : compté à zéro, comme l'écriture,
 * qui partira alors sans lui. `methode` absente : celle du réglage.
 */
export async function pireCasEcritureUsd(methode?: MethodeTableau): Promise<number> {
  const [{ estimerCoutScript, jetonsDuSocle }, { socleSansEchec, socleWillTableau }] = await Promise.all([import("./tableau-scripts"), import("./tableau-scripts/client-studio")]);
  const socle = await socleSansEchec(socleWillTableau)();
  const { memoireTableauAllumee } = await import("./tableau-scripts/memoire");
  return estimerCoutScript(DEMANDE_MAX, undefined, jetonsDuSocle(socle), methode ?? (await methodeEcritureTableau()), await memoireTableauAllumee()).pireCasUsd;
}

/** Coût PIRE d'une écriture, en centimes d'euro (annoncé avant le clic ; le prix à confirmer). */
export function coutEcritureCentimes(tauxUsdEur: number, pireUsd: number): number {
  return Math.ceil(pireUsd * 100 * tauxUsdEur - 1e-9);
}

/**
 * Ce que « Utiliser ce script » (ou « Utiliser quand même », « Corriger à la main ») remplit : le script livré, sinon
 * la meilleure version d'un refus ; `null` s'il n'y a rien à reprendre (PUR).
 */
export function propositionDe(g: GenerationBrouillon): DonneesScriptTableau | null {
  if (g.issue.ok) return donneesDepuisScript(g.demande, g.issue.resultat, g.issue.angle);
  const m = g.issue.meilleure?.ecriture;
  return m ? donneesDepuisScript(g.demande, { script: m.script, angle: "", motsDouleur: m.motsDouleur ?? [] }) : null;
}

/**
 * Ce que « Utiliser ce script » remplit (PUR) : le texte dit, la série, le problème, ses mots, le geste, la fin et le
 * réseau. La douleur transmise au découpage est celle que le script DIT (accroche, puis bloc « douleur », en phrases
 * entières, 140 caractères au plus), pas la description de la passe « angle » (constat du 12/10 : à la troisième
 * personne, sans aucun mot de l'accroche, elle faisait refuser la fiche par « douleur en tête »). Les mots de la douleur
 * rendus par le générateur suivent, s'ils sont bien dans le texte.
 */
export function donneesDepuisScript(
  demande: DemandeScriptTableau,
  resultat: Pick<ResultatScriptTableau, "script" | "angle"> & { motsDouleur?: readonly string[] },
  angle?: Pick<AngleScript, "douleur">,
  texteDit: string = texteDuScript(resultat),
): DonneesScriptTableau {
  const serie = SERIES_TABLEAU.find((s) => s.code === demande.serie) ?? SERIES_TABLEAU[0];
  const premiere = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, COURT_MAX);
  const motsDouleur = nettoyerMotsDouleur(resultat.motsDouleur ?? []).filter((m) => motsPleins(m).length && contientExpression(texteDit, m)).slice(0, MOTS_DOULEUR_MAX);
  const parties = partiesDuScript(resultat.script);
  return {
    texte: texteDit,
    serieCode: serie.code,
    structure: "demonstration",
    douleur: douleurDepuisScript(resultat.script) || raccourcirDouleur(angle?.douleur || resultat.angle || demande.sujet),
    ...(motsDouleur.length ? { motsDouleur } : {}),
    gesteMinute: couperAuMot(premiere(demande.sujet), BORNES_FICHE.gesteMinuteMax),
    finId: FIN_DU_GENERATEUR[demande.fin.type],
    ...(demande.fin.type === "commentaire" ? { mot: demande.fin.mot.replace(/[^\p{L}\p{N}]/gu, "").toUpperCase().slice(0, 24) } : {}),
    reseaux: [RESEAU_DU_GENERATEUR[demande.reseau]],
    // Les parties nommées, pour le découpage, seulement si elles redonnent le texte transmis mot pour mot.
    ...(partiesAccordees(parties, texteDit) ? { parties } : {}),
  };
}

/** Le texte dit d'un script généré, moment par moment, mis bout à bout. */
export function texteDuScript(r: { script: ScriptTableau }): string {
  return phrasesDites(r.script)
    .map((p) => p.dit.trim())
    .filter(Boolean)
    .join(" ");
}

/** Sujet déjà traité (lot L4) : l'écriture n'est pas lancée, l'écran propose trois choix avec ce jeton. */
export interface RefusSujetTraite {
  statut: "sujet-deja-traite";
  niveau: NiveauSujet;
  precedents: Precedent[];
  suggestions: Suggestion[];
  jeton: string;
  /** La confirmation reçue ne correspond plus aux vidéos d'aujourd'hui : redemander. */
  jetonPerime?: boolean;
  phrase: string;
}

export type IssueEcritureTableau =
  | { statut: "en-cours"; videoId: Id; tacheId: string; traceId: string; avertissement?: { niveau: NiveauSujet; precedents: Precedent[] } }
  | { statut: "accord-requis"; centimes: number; phrase: string }
  | RefusSujetTraite
  | { statut: "refusee"; phrase: string; videoId?: Id };

export interface DependancesEcritureTableau {
  /** Client du générateur (tests : un double) ; par défaut le chemin de dépense plafonné du studio. */
  client?: import("./tableau-scripts").ClientScripts;
  /** Claude relié pour les textes ? (par défaut : le réglage du studio) */
  claudeRelie?: () => Promise<boolean>;
  /** Sources du contrôle « sujet déjà traité » (tests : de faux dépôts) ; par défaut les dépôts du studio. */
  sourcesSujets?: SourcesSujets;
}

/** Lecture de la demande envoyée par l'écran (donnée non sûre) : la demande, ou une phrase simple. */
export function lireDemandeEcriture(brut: unknown): { ok: true; demande: DemandeScriptTableau } | { ok: false; phrase: string } {
  const b = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  if (!SERIES_SCRIPT.includes(b.serie as never)) return { ok: false, phrase: "Choisissez la série." };
  if (!nettoyer(b.sujet, COURT_MAX)) return { ok: false, phrase: "Dites le sujet en une ligne." };
  if (!nettoyer(b.public, 200)) return { ok: false, phrase: "Dites à qui parle la vidéo." };
  if (!RESEAUX_SCRIPT.includes(b.reseau as never)) return { ok: false, phrase: "Choisissez le réseau principal." };
  const fin = (b.fin && typeof b.fin === "object" ? b.fin : {}) as Record<string, unknown>;
  if (fin.type !== "commentaire" && fin.type !== "diagnostic") return { ok: false, phrase: "Choisissez la fin : un mot à commenter, ou un appel de diagnostic." };
  if (!nettoyer(b.envoi, 300)) return { ok: false, phrase: fin.type === "commentaire" ? "Dites ce que vous envoyez à ceux qui commentent." : "Dites ce que l'appel de diagnostic apporte." };
  const vrai = b.vraiCas && typeof b.vraiCas === "object" ? (b.vraiCas as Record<string, unknown>) : null;
  const vraiCas = vrai && ["metier", "tache", "avant", "apres", "date"].some((k) => nettoyer(vrai[k], 400)) ? vrai : null;
  const r = schemaDemandeScript.safeParse({
    serie: b.serie,
    sujet: nettoyer(b.sujet, COURT_MAX),
    public: nettoyer(b.public, 200),
    vraiCas: vraiCas ? Object.fromEntries(["metier", "tache", "avant", "apres", "date"].map((k) => [k, nettoyer(vraiCas[k], 400)])) : null,
    reseau: b.reseau,
    fin: fin.type === "commentaire" ? { type: "commentaire", mot: nettoyer(fin.mot, 20) } : { type: "diagnostic" },
    envoi: nettoyer(b.envoi, 300),
    // Durée visée (gabarit cadré du 15/10) : 60 s par défaut, ou 30 s.
    ...(b.duree === 30 || b.duree === 60 ? { duree: b.duree } : {}),
  });
  if (r.success) return { ok: true, demande: r.data };
  const champ = String(r.error.issues[0]?.path[0] ?? "");
  if (champ === "fin") return { ok: false, phrase: "Donnez le mot à commenter (un seul mot)." };
  if (champ === "vraiCas") return { ok: false, phrase: "Le vrai cas est incomplet : remplissez ses cinq champs, ou laissez-les vides." };
  return { ok: false, phrase: "Vérifiez les champs : l'un d'eux est trop long ou vide." };
}

/** Le prix de l'écriture (pire cas des quatre appels, selon `methodeTache` si donnée, sinon la méthode réglée), et la phrase à confirmer. */
async function prixEcriture(methodeTache?: MethodeTableau): Promise<{ pireUsd: number; montant: number; phrase: string; methode: MethodeTableau }> {
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const methode = methodeTache ?? (await methodeEcritureTableau());
  const pireUsd = await pireCasEcritureUsd(methode);
  const montant = coutEcritureCentimes(taux, pireUsd);
  return { pireUsd, montant, methode, phrase: `L'écriture coûte au plus ${formaterMontant({ centimes: montant, devise: "EUR" })}. Confirmez ce prix pour lancer.` };
}

/**
 * « Écrire le script pour moi » : refus côté serveur sans un MONTANT confirmé au moins égal au coût pire de l'écriture.
 * Crée (ou reprend) le brouillon, ouvre la trace, puis ENREGISTRE l'écriture comme tâche de fond et rend la main tout
 * de suite (aucun appel ici). `accroche` : une autre accroche de la dernière écriture ; seule l'écriture est refaite.
 */
export async function ecrireScriptTableau(brut: unknown, options: { videoId?: Id; accord?: AccordPrix | unknown; accroche?: number; sujet?: Confirmation } = {}, dependances: DependancesEcritureTableau = {}): Promise<IssueEcritureTableau> {
  await exigerSession();
  if (!creationTableauVisible()) return { statut: "refusee", phrase: "Le tableau animé n'est pas encore ouvert." };
  const lue = lireDemandeEcriture(brut);
  if (!lue.ok) return { statut: "refusee", phrase: lue.phrase, videoId: options.videoId };
  const demande = lue.demande;

  // Sujet déjà traité (lot L4) : SEULEMENT pour une nouvelle vidéo, jamais pour une reprise, une autre accroche ou « Réécrire »
  // d'un brouillon existant. Avant le prix, avant tout brouillon et toute dépense : un refus n'enregistre rien.
  let avertissement: { niveau: NiveauSujet; precedents: Precedent[] } | undefined;
  let choixForce: string | undefined;
  if (!options.videoId) {
    const { verifierSujet } = await import("./sujets-traites");
    const v = await verifierSujet({ generateur: ID_FORMAT_TABLEAU_SUJET, texte: demande.sujet }, confirmationPropre(options.sujet), dependances.sourcesSujets);
    if (!v.ok) {
      const { niveau, precedents, suggestions, jeton, jetonPerime } = v;
      return { statut: "sujet-deja-traite", niveau, precedents, suggestions, jeton, ...(jetonPerime ? { jetonPerime: true } : {}), phrase: niveau === "identique" ? "Ce sujet est déjà traité." : "Un sujet très proche est déjà traité." };
    }
    avertissement = v.avertissement;
    choixForce = v.confirme;
  }

  // Le prix d'abord : rien ne part sans le montant affiché, confirmé.
  const prix = await prixEcriture();
  const accord = accordPropre(options.accord);
  if (typeof accord !== "number" || accord < prix.montant) return { statut: "accord-requis", centimes: prix.montant, phrase: prix.phrase };
  if (!dependances.client && !(await (dependances.claudeRelie ?? claudeRelieParDefaut)())) {
    return { statut: "refusee", phrase: "Claude n'est pas relié pour l'écriture : aucun script n'a été écrit, rien n'a été payé.", videoId: options.videoId };
  }

  // Autre accroche : l'angle de la dernière écriture livrée, avec ce rang retenu.
  const existant = options.videoId ? (await brouillonExistant(options.videoId)).brouillon : null;
  if (existant) {
    const occupe = refusSiOccupe(existant);
    if (occupe) return { statut: "refusee", phrase: occupe, videoId: options.videoId };
  }
  const avant = existant?.generation?.issue.ok ? existant.generation.issue : null;
  const rang = typeof options.accroche === "number" && Number.isInteger(options.accroche) && options.accroche >= 0 && options.accroche <= 4 ? options.accroche : null;
  const angle = avant && rang !== null ? { ...avant.angle, accroches: avant.resultat.accroches, retenue: rang, raison: "Accroche choisie par vous." } : undefined;

  const traceId = nouvelId("tst");
  const tache = nouvelleTache("ecriture", angle ? "ecriture" : "accroches", { demande, ...(angle ? { angle } : {}), pireUsd: prix.pireUsd, traceId, methode: prix.methode });
  let videoId: Id;
  if (options.videoId) {
    await modifierBrouillon(options.videoId, (b) => ({ ...b, tache }));
    videoId = options.videoId;
  } else {
    // Brouillon neuf (le texte viendra du script).
    videoId = (await nouveauBrouillon({ texte: "", serieCode: demande.serie, structure: "demonstration", douleur: raccourcirDouleur(demande.sujet), gesteMinute: demande.sujet, finId: FIN_DU_GENERATEUR[demande.fin.type], reseaux: [RESEAU_DU_GENERATEUR[demande.reseau]] }, demande.sujet, tache)).id;
  }
  // La trace existe dès maintenant : une écriture coupée, même avant le premier appel, en laisse une.
  const { ouvrirTraceScript } = await import("./tableau-scripts");
  await ouvrirTraceScript(traceId, demande, { videoId, tacheId: tache.id }, !!dependances.client?.simule);
  await journaliser("video", "Tableau animé : écriture du script demandée (tâche de fond)", { type: "video", id: videoId });
  // Sujet déjà traité et choix forcé (« Refaire quand même ») : la trace reste dans le journal.
  if (choixForce) await journaliser("video", `Tableau animé : sujet déjà traité, écriture voulue quand même (choix « ${choixForce} »)`, { type: "video", id: videoId });
  await reveillerTaches();
  return { statut: "en-cours", videoId, tacheId: tache.id, traceId, ...(avertissement ? { avertissement } : {}) };
}

/** Générateur du contrôle « sujet déjà traité » : pas de clé exacte, seul le « proche » joue sur le texte du sujet. */
const ID_FORMAT_TABLEAU_SUJET = "tableau-anime";

/** La confirmation reçue de l'écran (donnée non sûre) : un choix connu et un jeton, sinon rien. */
function confirmationPropre(brut: unknown): Confirmation | undefined {
  const b = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  return (b.choix === "refaire" || b.choix === "nouvel-angle") && typeof b.jeton === "string" && b.jeton ? { choix: b.choix, jeton: b.jeton } : undefined;
}

async function claudeRelieParDefaut(): Promise<boolean> {
  return (await import("./depense-claude-video")).claudeTextesActif();
}

/** L'écriture d'une tâche (boucle de fond, hors requête) : appels déjà payés rejoués, état gardé après chaque appel. */
async function executerEcriture(videoId: Id, tache: TacheTableau, dependances: DependancesEcritureTableau): Promise<void> {
  if (!tache.demande) {
    await modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "refusee", message: "La demande de cette écriture n'a pas été gardée : remplissez-la à nouveau." });
    return;
  }
  // La méthode dont le prix a été confirmé. Depuis le lot A5 la création l'écrit TOUJOURS ; une tâche plus ancienne, sans ce
  // champ, a été lancée quand le défaut était « complete » : elle reste « complete » (jamais relue en « courte »).
  const methode = tache.methode ?? METHODE_ANCIENNES_TACHES;
  // Mémoire commune : le prix confirmé (`tache.pireUsd`) compte le bloc selon le réglage DE CE MOMENT-LÀ, alors que le réglage est
  // relu au lancement (`memoireTableauAllumee`). Si Will le change entre les deux, l'écart est le bloc (~1 000 jetons, deux appels
  // d'écriture) : il tient dans MARGE_CREDITS (plafond ci-dessous), et la tâche ne garde pas le réglage (champ à ajouter à la
  // tâche, au reprix et aux tâches anciennes : pas pour une dépense de cet ordre).
  const pireUsd = tache.pireUsd ?? (await pireCasEcritureUsd(methode));
  const { deroulerScriptTableau } = await import("./tableau-scripts");
  const { clientScriptsStudio } = await import("./tableau-scripts/client-studio");
  const { plafondScriptTableau } = await import("./depense-claude-video");
  const plafond = pireUsd * (1 + MARGE_CREDITS);
  const base = dependances.client ?? clientScriptsStudio(videoId, plafond, { ...plafondScriptTableau(plafond), depuis: tache.depuis });
  await modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "en-cours" });
  const r = await deroulerScriptTableau(tache.demande, {
    client: clientRejoue(videoId, tache.id, base, tache.journal),
    ...(tache.angle ? { angle: tache.angle } : {}),
    ...(tache.traceId ? { traceId: tache.traceId } : {}),
    methode,
    contexte: { videoId, tacheId: tache.id },
  });
  if (await supprimeePendantLAppel(videoId)) return;
  if (!r.ok && r.nature !== "refus") {
    // Plafond, crédit, Claude indisponible ou erreur imprévue : les appels faits sont gardés, « Réessayer » fait la suite.
    await modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "erreur", enVol: undefined, message: `${r.motifs.join(" ")}${r.appels ? " Les appels déjà faits sont gardés : réessayer ne les repaie pas." : ""}` });
    await journaliser("video", "Tableau animé : écriture du script arrêtée, à réessayer", { type: "video", id: videoId });
    return;
  }
  const generation: GenerationBrouillon = { traceId: r.traceId, demande: tache.demande, le: new Date().toISOString(), issue: r.ok ? { ok: true, resultat: r.resultat, angle: r.angle } : { ok: false, motifs: r.motifs, ...(r.meilleure ? { meilleure: r.meilleure } : {}) } };
  const phraseRefus = !r.ok && r.meilleure ? "Ce script n'a pas passé tous les contrôles : la meilleure version est gardée ci-dessous." : "Ce script n'est pas assez bon : rien n'est proposé.";
  await modifierBrouillon(videoId, (b) => ({ ...b, generation, ...(b.tache?.id === tache.id ? { tache: { ...b.tache, statut: r.ok ? "terminee" : "refusee", enVol: undefined, majLe: maintenant(), ...(r.ok ? {} : { message: phraseRefus, motifs: r.motifs }) } } : {}) }));
  await journaliser("video", r.ok ? "Tableau animé : script écrit par le générateur" : "Tableau animé : le générateur a refusé le script", { type: "video", id: videoId });
}

export type IssueRepriseTraceTableau = { statut: "reprise"; livre: boolean } | { statut: "refusee"; phrase: string };

/** La trace d'écriture d'un brouillon (le dernier script, sinon la dernière tâche d'écriture). */
function traceDuBrouillon(b: BrouillonTableau): string | undefined {
  return b.generation?.traceId ?? (b.tache?.type === "ecriture" ? b.tache.traceId : undefined);
}

/** Une reprise de trace a-t-elle un sens : une écriture non livrée dont la trace a des versions ? */
async function repriseTracePossible(b: BrouillonTableau): Promise<boolean> {
  if (b.generation?.issue.ok || tacheActive(b.tache)) return false;
  const id = traceDuBrouillon(b);
  if (!id) return false;
  const t = await depots().tracesScriptsTableau.obtenir(id);
  return !!t && t.versions.length > 0;
}

/**
 * « Reprendre la meilleure version » : relit la trace d'écriture du brouillon et reprend sa meilleure version, SANS
 * aucun appel payant (les versions sont recontrôlées avec les règles en vigueur). Livrée si elle passe tout ; sinon
 * gardée et affichée avec ses défauts. La trace n'est pas modifiée.
 */
export async function reprendreMeilleureVersionTableau(videoId: Id): Promise<IssueRepriseTraceTableau> {
  await exigerSession();
  if (!creationTableauVisible()) return { statut: "refusee", phrase: "Le tableau animé n'est pas encore ouvert." };
  const { brouillon } = await brouillonExistant(videoId);
  const occupe = refusSiOccupe(brouillon);
  if (occupe) return { statut: "refusee", phrase: occupe };
  const traceId = traceDuBrouillon(brouillon);
  const trace = traceId ? await depots().tracesScriptsTableau.obtenir(traceId) : null;
  if (!traceId || !trace || !trace.versions.length) return { statut: "refusee", phrase: "Aucune version écrite à reprendre pour ce brouillon." };
  const { livrerDepuisTrace, optionsControlesDeLaTrace } = await import("./tableau-scripts");
  const r = livrerDepuisTrace(trace, await optionsControlesDeLaTrace(trace));
  const generation: GenerationBrouillon = {
    traceId,
    demande: trace.demande,
    le: new Date().toISOString(),
    reprise: true,
    issue: r.ok ? { ok: true, resultat: r.resultat, angle: r.angle } : { ok: false, motifs: r.motifs, ...(r.meilleure ? { meilleure: r.meilleure } : {}) },
  };
  await modifierBrouillon(videoId, (b) => ({
    ...b,
    generation,
    ...(b.tache?.type === "ecriture" && b.tache.traceId === traceId ? { tache: { ...b.tache, statut: r.ok ? ("terminee" as const) : ("refusee" as const), enVol: undefined, majLe: maintenant(), message: r.ok ? "Script repris de l'écriture précédente, sans nouvel appel." : "La meilleure version est gardée ci-dessous.", motifs: r.ok ? undefined : r.motifs } } : {}),
  }));
  await journaliser("video", `Tableau animé : meilleure version du script reprise de la trace ${traceId} (aucun appel)`, { type: "video", id: videoId });
  return { statut: "reprise", livre: r.ok };
}

/* ------------------------------------------------------------------ */
/* Tâches de fond : la boucle, le suivi, la reprise                      */
/* ------------------------------------------------------------------ */

/** Ce que la boucle de fond fait d'une tâche ; toute erreur est rangée dans la tâche (jamais « en cours » pour toujours). */
export async function executerTacheTableau(videoId: Id, tache: TacheTableau, dependances: DependancesCreationTableau & DependancesEcritureTableau = {}): Promise<void> {
  // Brouillon supprimé avec sa tâche en attente, juste avant que la boucle la prenne : rien n'est lancé ni écrit.
  if (await supprimeePendantLAppel(videoId)) return;
  try {
    if (tache.type === "ecriture") await executerEcriture(videoId, tache, dependances);
    else await executerDecoupage(videoId, tache, dependances);
  } catch (e) {
    if (await supprimeePendantLAppel(videoId)) return;
    const actuelle = await lireTache(videoId).catch(() => null);
    const etape = actuelle?.id === tache.id ? actuelle.etape : tache.etape;
    console.error(`[tableau] tâche ${tache.type} de la vidéo ${videoId} en échec à l'étape « ${etape} » : ${e instanceof Error ? e.name : "erreur"} — ${phraseErreur(e)}`);
    const phrase = e instanceof ErreurStudio ? e.message : `${tache.type === "ecriture" ? "L'écriture" : "Le découpage"} s'est arrêté${tache.type === "ecriture" ? "e" : ""} sur une erreur.`;
    await modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "erreur", enVol: undefined, message: `${phrase} Les appels déjà faits sont gardés : réessayez.` });
    if (tache.traceId) {
      const { fermerTraceScript } = await import("./tableau-scripts");
      await fermerTraceScript(tache.traceId, "erreur", `${phrase} (étape « ${etape} »)`);
    }
  }
}

/** Un passage de la boucle de fond sur les tâches du tableau (`services/boucle.ts`). `dependances` : tests. */
export async function travaillerTachesTableau(dependances: DependancesCreationTableau & DependancesEcritureTableau = {}): Promise<number> {
  return travaillerTaches((videoId, tache) => executerTacheTableau(videoId, tache, dependances));
}

/** Réveille la boucle tout de suite (sans attendre son prochain tour), si elle tourne dans ce processus. */
async function reveillerTaches(): Promise<void> {
  const { boucleActive, verrouBoucleTenu } = await import("./_boucle-etat");
  if (!boucleActive() || !verrouBoucleTenu()) return;
  const { lancerAnnexe } = await import("./boucle");
  void lancerAnnexe(NOM_ANNEXE_TABLEAU, () => travaillerTachesTableau(), 0);
}

/** L'état d'une tâche, pour l'écran qui interroge toutes les 3 s. `null` : aucun brouillon, ou aucune tâche. */
export async function suiviTacheTableau(videoId: Id): Promise<VueTacheTableau | null> {
  await exigerSession();
  const t = await lireTache(videoId);
  return t ? vueTache(t, await boucleTourne()) : null;
}

export type IssueRepriseTableau = { statut: "en-cours"; videoId: Id; tacheId: string } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

/**
 * « Réessayer » / « Reprendre » une tâche arrêtée (erreur, interruption) : les appels déjà payés sont gardés et
 * rejoués, seule la suite est faite. Le prix est confirmé à nouveau (au plus celui d'une écriture ou d'un découpage
 * entier) ; une enveloppe neuve du plafond s'ouvre. Découpage REFUSÉ (règles, réponse coupée ou illisible) :
 * « Réessayer » refait un découpage neuf (ses réponses ne sont pas rejouées : elles redonneraient le même refus).
 */
export async function reprendreTacheTableau(videoId: Id, accordBrut?: AccordPrix | unknown): Promise<IssueRepriseTableau> {
  await exigerSession();
  if (!creationTableauVisible()) return { statut: "refusee", phrase: "Le tableau animé n'est pas encore ouvert." };
  const { brouillon } = await brouillonExistant(videoId);
  const t = brouillon.tache;
  const decoupageRefuse = t?.type === "decoupage" && t.statut === "refusee";
  if (!t || (t.statut !== "erreur" && t.statut !== "interrompue" && !decoupageRefuse)) return { statut: "refusee", phrase: tacheActive(t) ? "Le travail est déjà en cours." : "Rien à reprendre pour ce brouillon." };
  const prix = t.type === "ecriture" ? await prixEcriture(t.methode ?? METHODE_ANCIENNES_TACHES) : await prixDecoupage(brouillon.donnees, aujourdhuiIso());
  const accord = accordPropre(accordBrut);
  if (typeof accord !== "number" || accord < prix.montant) return { statut: "accord-requis", centimes: prix.montant, phrase: prix.phrase };
  const neuf = decoupageRefuse ? { journal: [], aujourdhui: aujourdhuiIso(), versionId: `b${brouillon.versions.length + 1}` } : {};
  const reprise = await modifierTache(videoId, t.id, (x) => x && { ...x, ...neuf, statut: "en-attente", enVol: undefined, message: undefined, motifs: undefined, depuis: maintenant(), pireUsd: prix.pireUsd });
  if (t.traceId) await depots().tracesScriptsTableau.modifier(t.traceId, { issue: "en-cours", erreur: undefined }).catch(() => undefined);
  await journaliser("video", `Tableau animé : ${t.type === "ecriture" ? "écriture" : "découpage"} repris (les appels déjà faits sont gardés)`, { type: "video", id: videoId });
  await reveillerTaches();
  return { statut: "en-cours", videoId, tacheId: reprise?.id ?? t.id };
}
