/**
 * RELECTURE DE LA FICHE AVANT LA FABRICATION : UNE SEULE VÉRITÉ (essai réel du 12/10 : l'écran disait « Tout est bon »,
 * la fabrication s'arrêtait ensuite à la relecture). L'écran de création, avant « Tout est bon » et avant de demander le
 * prix, et la fabrication, à son étape « script », appellent LA MÊME fonction (`relireFicheTableau`) avec les mêmes
 * entrées : tous les contrôles bloquants de `controlerVideoTableau` (fiche, variété, case « déjà vu »), et la mise en
 * page de CHAQUE fichier qui sera produit (vertical, vertical de TikTok et Shorts, portrait, carré, horizontal selon les
 * réseaux cochés), avec la fiche et l'écran d'appel propres à chaque sortie (`sortiesRelues`, que la fabrication
 * reprend aussi pour sa propre mise en page). La fiche propre d'une sortie (fin propre à TikTok et Shorts) repasse
 * aussi les règles de FORME du calage (références, ancres, scène sans mot, aucun commentaire : `controlerFormeSortie`) :
 * incident du 12/10 (vidéo `v-9d15cce3c6e3`), « Tout est bon » puis arrêt au calage du second vertical, voix payée.
 * Aucune règle n'est écrite ici. PUR : tout est injecté.
 */
import { controlerVideoTableau, type CaseDejaVu, type LigneControleTableau, type RapportControleTableau } from "./controles";
import { appelEnFinDeFiche, type FicheTableau } from "./fiche";
import { descriptionSortie, formatImage, sansAppelAuMot, VERTICAL_LIENS, type IdSortie } from "./formats-sortie";
import type { AppelFinV2, ContenuPreuve, OptionsMiseEnPage } from "./mise-en-page";
import type { ContexteTableau } from "./regles";
import { appelDitDeLaSortie, finAuMot, finDesLiens, FIN_SANS_APPEL_LIENS, planVoixSorties } from "./variantes-fin";
import type { LeveeVariete, ResumeVisuel } from "@/briques/variete";
// Après `./fiche` (cycle d'import : `densite` → `gabarit` → `fiche`).
import { pagesDuStyle } from "./densite";

/**
 * Fin retenue pour la vidéo : sa phrase à l'écran, ou pourquoi il n'y en a pas (phrase claire, jamais un échec).
 * `type` (nature de la fin) et `mot` (le mot à commenter saisi à la création, en capitales) servent l'écran d'appel du
 * style « blocs/2 ».
 */
export type FinRetenue = { id: string; ecran: string; type?: string; mot?: string; dit?: string; objectif?: string } | { absente: string };

/** Alerte : le fichier de LinkedIn (portrait 4:5 depuis T5, carré avant) se termine sans appel (rien n'est dit dans une vidéo LinkedIn). */
export const FIN_SANS_APPEL_LINKEDIN = "Fin sans appel pour LinkedIn : aucun appel à commenter n'est dit dans une vidéo LinkedIn (le mot va en dernière ligne du texte). Sa vidéo se termine sur axion-ia.com.";

/**
 * Garde-fou des sorties de TikTok et Shorts et de LinkedIn (`sansAppelAuMot`) : jamais la fin au mot (« Écrivez/Commentez
 * MOT », ni une phrase qui promet un envoi), quoi que rende `choisirFin`. Sinon, ou sans fin : aucun appel, et l'alerte
 * `FIN_SANS_APPEL_LIENS` (TikTok et Shorts) ou `FIN_SANS_APPEL_LINKEDIN`.
 */
export function finDeLaSortie(id: IdSortie, fin: FinRetenue | undefined, fiche?: Pick<FicheTableau, "scenes" | "structure">): FinRetenue | undefined {
  if (!sansAppelAuMot(id)) return fin;
  // TikTok et Shorts (Will, 14/10) : UNE demande de la banque, choisie selon le type de la fiche (`objectif` : choix forcé).
  const liens = id === VERTICAL_LIENS && fiche ? finDesLiens(fiche, fin && "ecran" in fin ? fin.objectif : undefined) : undefined;
  if (liens) return liens;
  const sansAppel = id === VERTICAL_LIENS ? FIN_SANS_APPEL_LIENS : FIN_SANS_APPEL_LINKEDIN;
  if (fin && "absente" in fin && fin.absente.includes(sansAppel)) return fin;
  if (!fin || !("ecran" in fin) || finAuMot(fin) || /^\s*(écrivez|commentez)\b|\bje vous (l['’]\s?|les )?envoie\b/i.test(`${fin.ecran} ${fin.dit ?? ""}`)) return { absente: sansAppel };
  return fin;
}

/**
 * Écran d'appel « blocs/2 » d'une fin retenue : le mot à commenter, ou l'appel de diagnostic ; absent (fin absente ou
 * d'une autre nature) : l'écran d'appel décrit par la fiche.
 */
export function appelDeLaFin(fin: FinRetenue | undefined): AppelFinV2 | undefined {
  if (!fin || !("ecran" in fin)) return undefined;
  if (fin.mot?.trim()) return { mot: fin.mot.trim().toUpperCase() };
  if (/diagnostic/i.test(fin.id) || /diagnostic/i.test(fin.ecran)) return { diagnostic: true };
  return undefined;
}

/** Ce que la mise en page d'une sortie reçoit : sa fiche (fin propre comprise), son écran d'appel, ses options. */
export interface SortiePreparee {
  id: IdSortie;
  libelle: string;
  fiche: FicheTableau;
  appel?: AppelFinV2;
  options: OptionsMiseEnPage;
}

/**
 * Fiche et options de mise en page de chaque sortie, comme la fabrication les passe à `mettreEnPage` : la variante de
 * fin de la sortie (vertical de TikTok et Shorts), l'écran d'appel de sa fin retenue (« blocs/2 »), son format d'image
 * et les bulles de preuve. `fiche` : la fiche de la vidéo (calée ou non : la place ne dépend pas des heures).
 */
export function sortiesRelues(fiche: FicheTableau, sorties: readonly IdSortie[], fins: (id: IdSortie) => FinRetenue | undefined, preuves: Readonly<Record<string, ContenuPreuve>> = {}): SortiePreparee[] {
  const plan = planVoixSorties(fiche, sorties.map((id) => ({ id, fin: fins(id) })));
  const principale = plan.mode === "unique" ? null : (plan.variantes.find((v) => v.sorties.includes(sorties[0])) ?? plan.variantes[0]);
  return sorties.map((id) => {
    const variante = plan.mode === "unique" ? null : (plan.variantes.find((v) => v.sorties.includes(id)) ?? principale);
    const ficheS = variante?.fiche ?? fiche;
    const fin = fins(id);
    const dit = appelDitDeLaSortie(id, fin);
    // TikTok et Shorts, LinkedIn : jamais l'écran du mot à commenter ; le site en grand (sous la phrase de leur fin validée).
    // « reference/1 » : la même fin, écrite sur la dernière page (le site et sa phrase s'y ajoutent pour ces sorties).
    const appel: AppelFinV2 | undefined = appelEnFinDeFiche(ficheS) ? (sansAppelAuMot(id) ? { site: true, ...(dit.sorte === "phrase" ? { phrase: dit.ecran } : {}) } : appelDeLaFin(fin)) : undefined;
    const image = formatImage(id);
    return { id, libelle: descriptionSortie(id, sorties).libelle, fiche: ficheS, ...(appel ? { appel } : {}), options: { preuves, ...(image === "vertical" ? {} : { format: image }), ...(appel ? { appel } : {}) } };
  });
}

/** Preuves de la fiche (phrase testée, date) par élément, tirées du contenu des preuves par `preuveId`. */
export function preuvesDeLaFiche(fiche: Pick<FicheTableau, "scenes">, contenus: Readonly<Record<string, ContenuPreuve>> = {}): Record<string, ContenuPreuve> {
  return Object.fromEntries(fiche.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" && contenus[e.preuveId] ? [[e.id, contenus[e.preuveId]] as const] : [])));
}

export interface EntreeRelecture {
  /** Fiche brute (JSON lu) : validée par la relecture. */
  fiche: unknown;
  contexte: ContexteTableau;
  historique?: readonly ResumeVisuel[];
  leveeVariete?: LeveeVariete;
  dejaVu?: CaseDejaVu;
  /** Les fichiers qui seront produits (réseaux cochés). */
  sorties: readonly IdSortie[];
  /** Fin retenue pour chaque sortie (services : `choisirFin`) ; absente : aucune fin. */
  choisirFin?: (appelId: string | null, sortie: IdSortie) => FinRetenue | undefined;
  contenusPreuves?: Readonly<Record<string, ContenuPreuve>>;
}

/** Un point bloquant de la relecture, rattaché à sa scène quand on la connaît. */
export interface PointRelecture {
  famille: LigneControleTableau["famille"];
  libelle: string;
  /** Phrase en français simple. */
  message: string;
  sceneId?: string;
}

export interface RelectureFiche {
  ok: boolean;
  rapport: RapportControleTableau;
  /** Chaque bloquant, une fois par scène en cause (sans scène : un point général). */
  points: PointRelecture[];
}

/** Phrase d'un bloquant, en clair (« Zone sûre : … »). */
const phraseDe = (l: LigneControleTableau) => `${l.libelle} : ${l.raison}`;

/**
 * LA relecture bloquante d'avant la fabrication (écran de création et étape « script » de la fabrication). Ne lève
 * jamais : une fiche refusée, une mise en page impossible ou un texte hors zone deviennent des points bloquants.
 */
export async function relireFicheTableau(e0: EntreeRelecture): Promise<RelectureFiche> {
  // « reference/3 » : relue dans le style de sa série, ses pages réparées dans ce style (comme la fabrication la lira).
  const e = { ...e0, fiche: pagesDuStyle(e0.fiche) };
  const brute = e.fiche as FicheTableau | null;
  const sorties = e.sorties.length ? e.sorties : (["vertical"] as IdSortie[]);
  let relues: SortiePreparee[] = [];
  let impossible: string | null = null;
  // La fiche brute peut être illisible : les sorties ne sont préparées que pour une fiche qui a des scènes.
  if (brute && typeof brute === "object" && Array.isArray(brute.scenes)) {
    try {
      const fins = new Map(sorties.map((id) => [id, finDeLaSortie(id, e.choisirFin ? e.choisirFin(brute.appelId ?? null, id) : undefined, brute)]));
      relues = sortiesRelues(brute, sorties, (id) => fins.get(id), preuvesDeLaFiche(brute, e.contenusPreuves));
    } catch (err) {
      relues = [];
      // Fiche bien formée dont une sortie n'a pas pu être préparée : jamais un « Tout est bon » silencieux.
      if (brute.scenes.length) impossible = `La fiche de chaque fichier à produire n'a pas pu être préparée (${err instanceof Error ? err.message : "erreur inconnue"}).`;
    }
  }
  const rapport = await controlerVideoTableau({
    fiche: e.fiche,
    contexte: e.contexte,
    historique: e.historique ?? [],
    ...(e.dejaVu ? { dejaVu: e.dejaVu } : {}),
    ...(e.leveeVariete ? { leveeVariete: e.leveeVariete } : {}),
    ...(relues.length ? { sorties: relues.map((s) => ({ id: s.id, libelle: s.libelle, fiche: s.fiche, options: s.options })) } : {}),
    ...(impossible ? { sortiesImpossibles: [impossible] } : {}),
  });
  // Les refus des règles de la fiche nomment déjà leur scène (« Scène s06 · … ») : rattachés à elle.
  const points = rapport.bloquants.flatMap((l): PointRelecture[] => {
    const scenes = l.scenes?.length ? l.scenes : l.famille === "fiche" ? [/Scène ([A-Za-z0-9_-]+) ·/.exec(l.raison)?.[1]].filter((x): x is string => !!x) : [];
    const message = phraseDe(l);
    return scenes.length ? scenes.map((sceneId) => ({ famille: l.famille, libelle: l.libelle, message, sceneId })) : [{ famille: l.famille, libelle: l.libelle, message }];
  });
  return { ok: rapport.verdict === "livrable", rapport, points };
}
