/**
 * FORMATS DE SORTIE DU TABLEAU ANIMÉ, PAR RÉSEAU : SOURCE DE VÉRITÉ UNIQUE (dimensions, réseaux servis, zones sûres).
 *
 * Une vidéo du tableau peut sortir en plusieurs formats d'image ; chacun a ses dimensions exactes et sa ZONE SÛRE :
 * les marges (haut, bas, côtés) où rien d'important n'est écrit, parce que l'application du réseau y pose ses boutons,
 * son pseudo, sa légende ou sa barre de lecture. La zone sûre d'un format est l'UNION (le plus prudent, côté par
 * côté) des zones de tous les réseaux qu'il sert.
 *
 * Données PURES, sans style : aucune couleur, aucune police, aucun bloc. La mise en page (`mise-en-page.ts`) les lit
 * pour CALCULER la page dans chaque format (pas de recadrage) ; un autre style graphique peut les relire tel quel.
 *
 * Unité de référence : les tailles du style (texte, traits, marges, bande des sous-titres) sont exprimées pour une
 * image 1080 × 1920. Un format les applique à `reference` = 1080 × 1920 multiplié par (petit côté ÷ 1 080) : un texte
 * garde la même taille réelle sur un téléphone, que la vidéo soit verticale, portrait, carrée ou horizontale (le petit
 * côté occupe toute la largeur de l'écran).
 *
 * Zones (pourcentages de l'image) et dimensions : LUES dans le registre des réseaux (`src/reseaux`, `sorties.ts`), qui
 * cite la source de chaque valeur ; « valeur prudente » = aucune source officielle chiffrée lue, marge large exprès.
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import { listerReseaux, obtenirReseau, type IdEmplacement, type ZoneProtegee } from "@/reseaux";
import { dimensions } from "@/reseaux/sorties";

/** Identifiants des formats de sortie. */
export const IDS_FORMATS_SORTIE = ["vertical", "portrait", "carre", "horizontal"] as const;
export type IdFormatSortie = (typeof IDS_FORMATS_SORTIE)[number];

/** Sortie par défaut (comportement d'avant : une seule vidéo verticale). */
export const SORTIES_PAR_DEFAUT: readonly IdFormatSortie[] = Object.freeze(["vertical"]);

/** Un réseau (ou un emplacement d'un réseau) servi par un format, et sa zone à protéger. */
export interface ReseauServi {
  /** Libellé en français (« Reels Instagram », « Fil Facebook »…). */
  libelle: string;
  zone: ZoneProtegee;
  /** D'où vient la valeur. */
  source: string;
}

export interface FormatSortie {
  id: IdFormatSortie;
  /** Libellé en français. */
  libelle: string;
  ratio: Ratio;
  largeur: number;
  hauteur: number;
  reseaux: readonly ReseauServi[];
}

/**
 * Un emplacement du registre (`src/reseaux`) lu comme « réseau servi » : même libellé, même zone, même source.
 * Plan « formats par réseau », T2 : la table n'écrit plus aucune zone, tout vient du registre.
 */
function emplacementDuRegistre(reseau: IdReseau, id: IdEmplacement, ratio: Ratio): ReseauServi {
  const e = obtenirReseau(reseau).emplacements.find((x) => x.id === id && x.ratio === ratio);
  if (!e) throw new Error(`Registre des réseaux : emplacement « ${id} » ${ratio} introuvable pour ${reseau}.`);
  return { libelle: e.libelle, zone: { ...e.zone }, source: e.source };
}

/** Un format d'image de la table : dimensions et zones lues dans le registre des réseaux. */
function formatDuRegistre(id: IdFormatSortie, libelle: string, ratio: Ratio, emplacements: readonly (readonly [IdReseau, IdEmplacement])[]): FormatSortie {
  const { largeur, hauteur } = dimensions(ratio);
  return { id, libelle, ratio, largeur, hauteur, reseaux: emplacements.map(([reseau, e]) => emplacementDuRegistre(reseau, e, ratio)) };
}

/** La table. Ordre = ordre d'affichage. */
export const FORMATS_SORTIE: Readonly<Record<IdFormatSortie, FormatSortie>> = Object.freeze({
  vertical: formatDuRegistre("vertical", "Vertical 9:16", "9:16", [
    ["tiktok", "video"],
    ["instagram", "reels"],
    ["facebook", "reels"],
    ["youtube-shorts", "video"],
    ["instagram", "stories"],
  ]),
  portrait: formatDuRegistre("portrait", "Portrait 4:5", "4:5", [
    ["instagram", "fil"],
    ["facebook", "fil"],
  ]),
  carre: formatDuRegistre("carre", "Carré 1:1", "1:1", [
    ["linkedin", "fil"],
    ["facebook", "fil"],
  ]),
  horizontal: formatDuRegistre("horizontal", "Horizontal 16:9", "16:9", [["youtube", "video"]]),
});

/** Le format, ou une erreur claire. */
export function formatSortie(id: IdFormatSortie): FormatSortie {
  const f = (FORMATS_SORTIE as Record<string, FormatSortie | undefined>)[id];
  if (!f) throw new Error(`Format de sortie inconnu : « ${id} » (connus : ${IDS_FORMATS_SORTIE.join(", ")}).`);
  return f;
}

/** Vrai pour un identifiant de la table. */
export function estFormatSortie(id: string): id is IdFormatSortie {
  return (IDS_FORMATS_SORTIE as readonly string[]).includes(id);
}

/** Zone sûre d'un format : union (le plus prudent côté par côté) des zones de ses réseaux. */
export function zoneSureFormat(id: IdFormatSortie): ZoneProtegee {
  return formatSortie(id).reseaux.reduce<ZoneProtegee>(
    (acc, r) => ({ haut: Math.max(acc.haut, r.zone.haut), droite: Math.max(acc.droite, r.zone.droite), bas: Math.max(acc.bas, r.zone.bas), gauche: Math.max(acc.gauche, r.zone.gauche) }),
    { haut: 0, droite: 0, bas: 0, gauche: 0 },
  );
}

/**
 * BAS DE LA ZONE SÛRE DU VERTICAL POUR LE STYLE « blocs/2 » (relecture du 12/10/2026) : 20 % au lieu des 30 % de
 * l'union ci-dessus. Les 30 % viennent du guide Meta des Reels, qui couvre la légende DÉPLIÉE ; repliée, la légende de
 * TikTok et des Reels (pseudo, une à deux lignes, son) tient dans les 18 à 20 % du bas, comme la marge déjà retenue pour
 * YouTube Shorts et les stories. Le style « blocs/2 » met ses sous-titres juste au-dessus (bande vers 72-80 % de la
 * hauteur, comme la vidéo modèle validée) : 30 % laissaient la moitié basse de l'image vide. Le haut et les côtés ne
 * changent pas. L'ancien style (`charte-video/1`) garde la zone de la table, inchangée.
 */
export const ZONE_VERTICAL_BLOCS_2 = Object.freeze({
  bas: 20,
  source: "valeur défendable : légende repliée de TikTok et des Reels ≈ 18-20 % du bas (marge des Shorts et des stories de la table)",
});

/** Zone sûre d'un format pour le style « blocs/2 » : celle de la table, sauf le bas du vertical (`ZONE_VERTICAL_BLOCS_2`). */
export function zoneSureBlocs2(id: IdFormatSortie, zone: ZoneProtegee = zoneSureFormat(id)): ZoneProtegee {
  return id === "vertical" ? { ...zone, bas: Math.min(zone.bas, ZONE_VERTICAL_BLOCS_2.bas) } : zone;
}

/**
 * HAUT DE LA ZONE SÛRE DU VERTICAL POUR LE STYLE « reference/1 » (réglage du 14/10/2026, demandé par Will après regard
 * des planches) : la page commence EN HAUT, premier bloc vers y = 140 sur 1920, comme le reel de référence. Les 14 % de
 * l'union viennent du guide Meta des Reels (barre du haut prudente) ; TikTok et Shorts demandent 10 %. 6 % (115 px)
 * + la marge du haut de la page (24 px) placent le premier bloc vers 140 px. Les côtés et le bas (20 %, comme
 * « blocs/2 ») ne changent pas.
 */
export const ZONE_VERTICAL_REFERENCE = Object.freeze({
  haut: 6,
  source: "décision du propriétaire (14/10/2026) : premier bloc vers y = 140 comme le reel de référence",
});

/** Zone sûre d'un format pour le style « reference/1 » : celle de « blocs/2 », sauf le haut du vertical. */
export function zoneSureReference(id: IdFormatSortie, zone?: ZoneProtegee): ZoneProtegee {
  const z = zoneSureBlocs2(id, zone ?? zoneSureFormat(id));
  return id === "vertical" ? { ...z, haut: Math.min(z.haut, ZONE_VERTICAL_REFERENCE.haut) } : z;
}

/** Image de référence des tailles du style pour ce format (1080 × 1920 à l'échelle du petit côté). */
export function referenceFormat(id: IdFormatSortie): { largeur: number; hauteur: number } {
  const f = formatSortie(id);
  const k = Math.min(f.largeur, f.hauteur) / 1080;
  return { largeur: Math.round(1080 * k), hauteur: Math.round(1920 * k) };
}

/** Réseaux servis, en une phrase (« TikTok, Reels Instagram… »). */
export function reseauxServis(id: IdFormatSortie): string {
  return formatSortie(id).reseaux.map((r) => r.libelle).join(", ");
}

/**
 * VERTICAL « LIENS » (décision du propriétaire, 12/10/2026) : aucune vidéo ne part sur TikTok ni sur YouTube Shorts avec
 * la fin « Écrivez MOT en commentaire. Je vous l'envoie. » (rien n'y est envoyé). Quand les réseaux cochés couvrent à
 * la fois les Reels et stories (Instagram, Facebook) ET TikTok ou Shorts, la fabrication produit DEUX fichiers
 * verticaux, identiques sauf la fin : `vertical` (Reels Instagram et Facebook, stories) et `vertical-liens` (TikTok,
 * YouTube Shorts). Mêmes dimensions, même mise en page et MÊME zone sûre que le vertical (l'union de tous les réseaux
 * verticaux de la table) : seules la dernière scène et la composition diffèrent.
 */
export const VERTICAL_LIENS = "vertical-liens" as const;

/**
 * PORTRAIT DE LINKEDIN (plan « formats par réseau », T5 ; décision 1 de Will du 18/10 : LinkedIn = 4:5 partout) : LinkedIn
 * quitte le carré pour un 4:5 SANS la fin au mot (aucun appel à commenter sur LinkedIn), à côté du portrait du fil
 * Instagram et Facebook, comme le vertical « liens » à côté du vertical. Mêmes dimensions, même mise en page et même zone
 * sûre que le portrait (celle du portrait couvre celle de LinkedIn en 4:5) : seules la fin et la composition diffèrent.
 * Le carré reste connu (vidéos déjà faites, ou demandé par une autre case).
 */
export const PORTRAIT_LINKEDIN = "portrait-linkedin" as const;

/** Une sortie de la fabrication : un format d'image, le vertical de TikTok et Shorts, ou le portrait de LinkedIn. */
export type IdSortie = IdFormatSortie | typeof VERTICAL_LIENS | typeof PORTRAIT_LINKEDIN;

/** Sorties connues, dans l'ordre d'affichage (le vertical « liens » juste après le vertical, le portrait de LinkedIn juste après le portrait). */
export const IDS_SORTIES: readonly IdSortie[] = Object.freeze(["vertical", VERTICAL_LIENS, "portrait", PORTRAIT_LINKEDIN, "carre", "horizontal"]);

/** Libellés des réseaux verticaux servis par le vertical « liens » (TikTok, YouTube Shorts). */
const RESEAUX_LIENS: readonly string[] = ["TikTok", "YouTube Shorts"];

/** Vrai pour une sortie connue (format d'image, vertical « liens » ou portrait de LinkedIn). */
export function estSortie(id: string): id is IdSortie {
  return (IDS_SORTIES as readonly string[]).includes(id);
}

/**
 * Format d'image d'une sortie : le vertical « liens » est un vertical, le portrait de LinkedIn un portrait (dimensions,
 * mise en page, zone sûre).
 */
export function formatImage(id: IdSortie): IdFormatSortie {
  return id === VERTICAL_LIENS ? "vertical" : id === PORTRAIT_LINKEDIN ? "portrait" : id;
}

/**
 * Sorties qui ne disent JAMAIS l'appel au mot de la fiche (fin propre, sans appel) : le vertical de TikTok et Shorts (rien
 * n'y est envoyé, 12/10/2026), le portrait de LinkedIn (T5) et le carré, fichier de LinkedIn avant T5 (aucun appel à
 * commenter dit dans une vidéo LinkedIn : Will, 12/10/2026 ; base 7 de l'Usine).
 */
export const SORTIES_SANS_APPEL_AU_MOT: readonly IdSortie[] = Object.freeze([VERTICAL_LIENS, PORTRAIT_LINKEDIN, "carre"]);

export function sansAppelAuMot(id: string): boolean {
  return (SORTIES_SANS_APPEL_AU_MOT as readonly string[]).includes(id);
}

/** Vrai quand les deux verticaux sont produits (le vertical ne sert plus alors TikTok ni Shorts). */
export function verticauxSepares(sorties: readonly IdSortie[]): boolean {
  return sorties.includes("vertical") && sorties.includes(VERTICAL_LIENS);
}

/** Réseaux (ordre du registre) qui ont un emplacement dans ce format d'image. */
function reseauxDuFormat(ratio: Ratio, parmi?: readonly IdReseau[]): IdReseau[] {
  return listerReseaux()
    .filter((r) => r.emplacements.some((e) => e.ratio === ratio) && (!parmi || parmi.includes(r.id)))
    .map((r) => r.id);
}

/**
 * Réseaux servis par chaque sortie, lus dans les emplacements du registre des réseaux (plan « formats par réseau », T2).
 * SEULE table : la fin de chaque sortie (`services/tableau-fin.ts`) et les réseaux posés sur chaque fichier (T4) la lisent.
 */
export const RESEAUX_DES_SORTIES: Readonly<Record<IdSortie, readonly IdReseau[]>> = {
  vertical: reseauxDuFormat("9:16"),
  "vertical-liens": ["tiktok", "youtube-shorts"],
  portrait: reseauxDuFormat("4:5", ["instagram", "facebook"]),
  "portrait-linkedin": reseauxDuFormat("4:5", ["linkedin"]),
  carre: reseauxDuFormat("1:1", ["linkedin", "facebook"]),
  horizontal: reseauxDuFormat("16:9"),
};

/**
 * Réseaux servis par une sortie dans une fabrication (`faites` : toutes ses sorties). Quand les deux verticaux sont
 * produits, le vertical ne sert plus que les Reels et stories (Instagram, Facebook), le vertical « liens » TikTok et Shorts.
 */
export function reseauxDeLaSortie(sortie: IdSortie, faites: readonly IdSortie[]): readonly IdReseau[] {
  if (sortie === "vertical" && verticauxSepares(faites)) return ["instagram", "facebook"];
  return RESEAUX_DES_SORTIES[sortie] ?? RESEAUX_DES_SORTIES.vertical;
}

/**
 * Description d'une sortie dans une fabrication donnée (`sorties` : toutes les sorties demandées) : libellé, dimensions
 * et réseaux EXACTS servis par CE fichier. Le vertical seul sert tous les réseaux verticaux (comportement d'avant) ;
 * quand le vertical « liens » existe aussi, le vertical ne sert plus que les Reels et les stories.
 */
export function descriptionSortie(id: IdSortie, sorties: readonly IdSortie[] = [id]): FormatSortie & { sortie: IdSortie } {
  const f = formatSortie(formatImage(id));
  if (id === VERTICAL_LIENS) return { ...f, sortie: id, libelle: "Vertical 9:16 · TikTok et Shorts", reseaux: f.reseaux.filter((r) => RESEAUX_LIENS.includes(r.libelle)) };
  if (id === "vertical" && verticauxSepares(sorties)) return { ...f, sortie: id, libelle: "Vertical 9:16 · Reels et stories", reseaux: f.reseaux.filter((r) => !RESEAUX_LIENS.includes(r.libelle)) };
  if (id === PORTRAIT_LINKEDIN) return { ...f, sortie: id, libelle: "Portrait 4:5 · LinkedIn", reseaux: [emplacementDuRegistre("linkedin", "fil", f.ratio)] };
  return { ...f, sortie: id };
}

/** Lit une liste de sorties (« vertical,carre ») ; lève une erreur claire. Vide = défaut ; doublons retirés. */
export function lireSorties(texte: string | readonly string[] | undefined): IdSortie[] {
  const brut = typeof texte === "string" ? texte.split(",") : [...(texte ?? [])];
  const ids = brut.map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [...SORTIES_PAR_DEFAUT];
  const inconnus = ids.filter((s) => !estSortie(s));
  if (inconnus.length) throw new Error(`Format de sortie inconnu : ${inconnus.map((s) => `« ${s} »`).join(", ")} (connus : ${IDS_SORTIES.join(", ")}).`);
  return [...new Set(ids as IdSortie[])];
}

/**
 * Réseaux cochés à la création (valeurs de l'écran « Nouvelle vidéo · tableau animé ») → format de sortie : chaque
 * réseau a son format. Une valeur inconnue est ignorée. LinkedIn : 4:5 (T5, décision 1 du 18/10 ; avant : le carré).
 */
export const FORMAT_DU_RESEAU: Readonly<Record<string, IdFormatSortie>> = Object.freeze({
  verticaux: "vertical",
  "fil-instagram-facebook": "portrait",
  linkedin: "portrait",
  youtube: "horizontal",
});

/**
 * Sorties de chaque case de réseau. « verticaux » (TikTok / Reels / Shorts / Stories) couvre les deux groupes : deux
 * verticaux. Cases plus fines (si l'écran les propose un jour) : Reels et stories → `vertical` ; TikTok, Shorts →
 * `vertical-liens`. LinkedIn → `portrait-linkedin` (T5 : 4:5 sans la fin au mot, à côté du portrait du fil). Les
 * autres cases : leur format (`FORMAT_DU_RESEAU`).
 */
export const SORTIES_DU_RESEAU: Readonly<Record<string, readonly IdSortie[]>> = Object.freeze({
  verticaux: ["vertical", VERTICAL_LIENS],
  "reels-stories": ["vertical"],
  "reels-instagram-facebook": ["vertical"],
  stories: ["vertical"],
  instagram: ["vertical"],
  facebook: ["vertical"],
  tiktok: [VERTICAL_LIENS],
  "youtube-shorts": [VERTICAL_LIENS],
  "tiktok-shorts": [VERTICAL_LIENS],
  ...Object.fromEntries(Object.entries(FORMAT_DU_RESEAU).filter(([r]) => r !== "verticaux").map(([r, f]) => [r, [f]])),
  linkedin: [PORTRAIT_LINKEDIN],
});

/** Sorties des réseaux cochés, sans doublon, dans l'ordre de `IDS_SORTIES` ; aucun réseau connu : le défaut. */
export function sortiesDesReseaux(reseaux: readonly string[]): IdSortie[] {
  const voulus = new Set(reseaux.flatMap((r) => SORTIES_DU_RESEAU[r] ?? []));
  const ids = IDS_SORTIES.filter((id) => voulus.has(id));
  return ids.length ? ids : [...SORTIES_PAR_DEFAUT];
}
