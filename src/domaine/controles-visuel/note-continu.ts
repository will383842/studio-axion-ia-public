/**
 * Note sur 100 d'une toile continue (lot P4), CALCULÉE PAR LE CODE : aucune IA, aucun réseau. PUR.
 * Grille de l'écran de la maquette ; les critères de rendu lisent les mesures de l'opération `toile-continue`.
 * Une mesure absente vaut 0 au critère. Un critère éliminatoire raté est bloquant et plafonne le total.
 */
import { GABARITS, type DefinitionGabarit } from "../../briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../briques/visuels/continu/registre-parcours";
import { interditsDans as interditsPartages, interditsTousEcrivains } from "../qualite-script/regles/interdits";
import type { ContextePorte, NiveauControle } from "../visuels/contrats";
import type { CritereNote } from "./note";
import { controlerToile } from "./porte-continu";
import { controlesStructureToile } from "./rythme-continu";
import { mots } from "./texte";

export const SEUIL_PRESENTE = 90;
export const SEUIL_RETOUCHE = 85;
/** Total maximal d'une toile qui rate un critère éliminatoire : toujours sous le seuil de retouche. */
export const PLAFOND_ELIMINATOIRE = 50;
export const TEXTE_MIN_PX = 26;
export const TITRE_P1_MOTS_MAX = 10;
export const CONTRASTE_MIN = 4.5;
export const POLICES_CONTINU: readonly string[] = ["Axion Bricolage", "Axion Instrument Serif", "Axion Inter", "Axion JetBrains Mono"];

/** Mesures de la toile (`MesuresToile` de studio-rendu) et mesures attendues des lots suivants ; toutes facultatives. */
export interface MesuresNoteToile {
  debordements?: number;
  taillePoliceMin?: number;
  textesSurCouture?: number;
  textesHorsMarge?: number;
  textesCoinReserve?: number;
  intrusionsMetaP1?: number;
  chevauchements?: number;
  debordCouture1?: number;
  traitsFinsSurCouture?: number;
  /** Textes à moins de 100 px d'une couture (zone sûre ramenée à 7/10). Absent : non mesuré, non prouvé, 7/10. */
  textesPresCouture?: number;
  /** Plus faible rapport de contraste texte/fond mesuré. */
  contrasteMin?: number;
  /** Textes orange plus petits qu'un grand titre (64 px). */
  orangeHorsTitres?: number;
  /** Polices réellement chargées au rendu. */
  polices?: string[];
  /** Texte du post conforme (lot P7). */
  textePostConforme?: boolean;
}

export interface OptionsNoteToile {
  /** Contexte de la porte (par défaut : les interdits partagés de la production, aucun fait validé). */
  ctx?: ContextePorte;
  /** Verdict de la porte déjà calculé : la porte n'est alors pas relancée. */
  verdictPorte?: NiveauControle;
  gabarits?: readonly DefinitionGabarit[];
}

export interface NoteToile {
  total: number;
  criteres: CritereNote[];
  bloquants: string[];
}

const interditsParDefaut = (texte: string): string[] => [...new Set([...interditsPartages(texte, "ecrire").map((i) => i.libelle), ...interditsTousEcrivains(texte)])];

/** Les mesures viennent d'un JSON de rendu : seules les valeurs valides comptent. */
const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const zero = (v: unknown) => nombre(v) && v === 0;

type PageLue = { type: string; alt?: unknown; titre?: unknown };
function lirePages(toile: unknown): PageLue[] {
  const pages = (toile as { pages?: unknown } | null)?.pages;
  if (!Array.isArray(pages)) return [];
  return pages.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return { type: typeof o.type === "string" ? o.type : "", alt: o.alt, titre: o.titre };
  });
}

function critere(id: number, nom: string, max: number, points: number, raison: string, options: { bloquant?: boolean; nonMesure?: boolean } = {}): CritereNote {
  const bloquant = options.bloquant ?? false;
  return { id, nom, points, max, auto: true, bloquant, niveau: bloquant ? "rouge" : points >= max ? "vert" : "orange", nonMesure: options.nonMesure ?? false, raison };
}

export function noterToile(toile: unknown, mesures?: MesuresNoteToile, options: OptionsNoteToile = {}): NoteToile {
  const m = mesures ?? {};
  const gabarits = options.gabarits ?? GABARITS;
  const parType = new Map(gabarits.map((g) => [g.type, g]));
  const pages = lirePages(toile);
  const n = pages.length;
  const absent = (...cles: (keyof MesuresNoteToile)[]) => cles.filter((c) => !nombre(m[c]));
  const nonMesure = (cles: (keyof MesuresNoteToile)[]) => `Mesure absente : ${cles.join(", ")}.`;

  // 1. Page 1 lisible seule (15) : titre court, rien dans les zones Meta, un élément à cheval sur la couture 1/2.
  const titre = typeof pages[0]?.titre === "string" ? pages[0].titre : "";
  const titreCourt = titre !== "" && mots(titre).length <= TITRE_P1_MOTS_MAX;
  const sansIntrusion = zero(m.intrusionsMetaP1);
  const aCheval = nombre(m.debordCouture1) && m.debordCouture1 >= 1;
  const f1 = [titreCourt ? "" : `Titre de la page 1 absent ou de plus de ${TITRE_P1_MOTS_MAX} mots.`, sansIntrusion ? "" : "Intrusion dans les zones Meta de la page 1 (ou non mesurée).", aCheval ? "" : "Aucun élément à cheval sur la couture 1/2 (ou non mesuré)."].filter(Boolean);
  const c1 = critere(1, "Page 1 lisible seule", 15, 5 * (Number(titreCourt) + Number(sansIntrusion) + Number(aCheval)), f1.join(" ") || "Titre court, zones Meta libres, la couture 1/2 invite à glisser.");

  // 2. Aucun mot coupé par une couture (12, éliminatoire).
  const couture = zero(m.textesSurCouture);
  const c2 = absent("textesSurCouture").length
    ? critere(2, "Aucun mot coupé par une couture", 12, 0, nonMesure(["textesSurCouture"]), { nonMesure: true })
    : critere(2, "Aucun mot coupé par une couture", 12, couture ? 12 : 0, couture ? "Aucun texte sur une couture." : `${m.textesSurCouture} texte(s) sur une couture.`, { bloquant: !couture });

  // 3. Texte ≥ 26 px mesuré (12, éliminatoire).
  const lisible = nombre(m.taillePoliceMin) && m.taillePoliceMin >= TEXTE_MIN_PX;
  const c3 = absent("taillePoliceMin").length
    ? critere(3, `Texte ≥ ${TEXTE_MIN_PX} px mesuré`, 12, 0, nonMesure(["taillePoliceMin"]), { nonMesure: true })
    : critere(3, `Texte ≥ ${TEXTE_MIN_PX} px mesuré`, 12, lisible ? 12 : 0, lisible ? `Plus petit texte : ${m.taillePoliceMin} px.` : `Un texte mesure ${m.taillePoliceMin} px.`, { bloquant: !lisible });

  // 4. Contraste, orange en grands titres (8).
  const manque4 = absent("contrasteMin", "orangeHorsTitres");
  const contraste = nombre(m.contrasteMin) && m.contrasteMin >= CONTRASTE_MIN;
  const orange = zero(m.orangeHorsTitres);
  const c4 = manque4.length
    ? critere(4, "Contraste, orange en grands titres", 8, 0, nonMesure(manque4), { nonMesure: true })
    : critere(4, "Contraste, orange en grands titres", 8, 4 * (Number(contraste) + Number(orange)), [contraste ? "" : `Contraste ${m.contrasteMin} < ${CONTRASTE_MIN}.`, orange ? "" : "De l'orange hors des grands titres."].filter(Boolean).join(" ") || "Contrastes suffisants, orange réservé aux grands titres.");

  // 5. Zone sûre (10) : marges et coin réservé ; 7/10 si un texte frôle une couture (moins de 100 px), ou si ce n'est pas mesuré.
  const manque5 = absent("textesHorsMarge", "textesCoinReserve");
  const sure = zero(m.textesHorsMarge) && zero(m.textesCoinReserve);
  const presAbsent = !nombre(m.textesPresCouture);
  const pres = !zero(m.textesPresCouture);
  const c5 = manque5.length
    ? critere(5, "Zone sûre", 10, 0, nonMesure(manque5), { nonMesure: true })
    : critere(
        5,
        "Zone sûre",
        10,
        !sure ? 0 : pres ? 7 : 10,
        !sure ? "Un texte sort de la marge de 80 px ou entre dans le coin réservé." : presAbsent ? `${nonMesure(["textesPresCouture"])} Distance aux coutures non prouvée : 7/10.` : pres ? "Un texte est à moins de 100 px d'une couture." : "Marges et coin réservé respectés.",
        { nonMesure: sure && presAbsent },
      );

  // 6. Charte, mots interdits, faits (15, éliminatoire : verdict de la porte) ; polices de la charte.
  const verdict = options.verdictPorte ?? controlerToile(toile, options.ctx ?? { faitsDisponibles: false, interditsDans: interditsParDefaut }).rapport.verdict;
  const policesAbsentes = !Array.isArray(m.polices);
  const polices = Array.isArray(m.polices) ? m.polices.filter((p): p is string => typeof p === "string") : [];
  const policesHors = polices.filter((p) => !POLICES_CONTINU.includes(p));
  const sansPolices = policesAbsentes ? ` ${nonMesure(["polices"])}` : "";
  const c6 =
    verdict === "rouge"
      ? critere(6, "Charte, mots interdits, faits", 15, 0, "La porte est rouge.", { bloquant: true })
      : critere(6, "Charte, mots interdits, faits", 15, policesHors.length ? 0 : verdict === "orange" ? 12 : 15, (policesHors.length ? `Police hors charte : ${policesHors.join(", ")}.` : verdict === "orange" ? "La porte est orange." : "Porte verte.") + sansPolices, { nonMesure: policesAbsentes });

  // 7. Diversité des familles (8) : les règles de variété de la structure.
  const structure = controlesStructureToile({ pages }, gabarits).map((c) => c.code);
  const suite = structure.includes("FAMILLE_SUITE");
  const variete = structure.includes("VARIETE");
  const c7 = critere(7, "Diversité des familles", 8, 8 - 4 * Number(suite) - 4 * Number(variete), [suite ? "Deux familles identiques se suivent." : "", variete ? "Trop peu de familles." : ""].filter(Boolean).join(" ") || "Familles variées.");

  // 8. Signal de défilement (5).
  const c8 = absent("debordCouture1").length
    ? critere(8, "Signal de défilement", 5, 0, nonMesure(["debordCouture1"]), { nonMesure: true })
    : critere(8, "Signal de défilement", 5, aCheval ? 5 : 0, aCheval ? "Un élément déborde sur la page 2." : "Rien ne déborde de la page 1 sur la page 2.");

  // 9. Texte du post (6) : noté par le lot P7.
  const c9 = m.textePostConforme === undefined ? critere(9, "Texte du post", 6, 0, "Texte du post non noté.", { nonMesure: true }) : critere(9, "Texte du post", 6, m.textePostConforme ? 6 : 0, m.textePostConforme ? "Texte du post conforme." : "Texte du post à reprendre.");

  // 10. Un seul appel, en dernière page (ou la fin d'un parcours qui termine).
  const appels = pages.map((p, i) => (parType.get(p.type)?.role === "appel" ? i : -1)).filter((i) => i >= 0);
  const dernier = pages[n - 1]?.type;
  const finParcours = PARCOURS.some((p) => p.termine && p.pagesTypes[p.pagesTypes.length - 1] === dernier);
  const appelOk = n > 0 && ((appels.length === 1 && appels[0] === n - 1) || (appels.length === 0 && finParcours));
  const c10 = critere(10, "Un seul appel en dernière page", 6, appelOk ? 6 : 0, appelOk ? "Un seul appel, en dernière page." : `${appels.length} appel(s), ${appels.includes(n - 1) ? "dont" : "aucun"} en dernière page.`);

  // 11. Accessibilité : chaque page porte son texte alternatif.
  const sansAlt = pages.map((p, i) => (typeof p.alt === "string" && p.alt.trim() !== "" ? 0 : i + 1)).filter(Boolean);
  const c11 = critere(11, "Accessibilité (alt de chaque page)", 3, n > 0 && sansAlt.length === 0 ? 3 : 0, n === 0 ? "Aucune page." : sansAlt.length ? `Texte alternatif absent : page(s) ${sansAlt.join(", ")}.` : "Chaque page a son texte alternatif.");

  const criteres = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11];
  const somme = criteres.reduce((s, c) => s + c.points, 0);
  const bloquants = criteres.filter((c) => c.bloquant).map((c) => `${c.nom} (${c.points}/${c.max}) : ${c.raison}`);
  return { total: bloquants.length ? Math.min(somme, PLAFOND_ELIMINATOIRE) : somme, criteres, bloquants };
}
