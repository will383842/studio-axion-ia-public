/**
 * PLAN DE SCÈNES DEPUIS UN TABLEAU DE BORD (G4-04) — donnée → plan brut avec les pièces EXISTANTES du catalogue,
 * puis `validerPlan` (repli par scène, jamais de refus). Pur : aucun disque, aucun réseau, aucun appel à Claude.
 * Rien ne l'importe en production (le moteur G4-09 le branchera). Aucune valeur inventée : tout nombre posé
 * vient de `nombresPermis(donnee)`. Tout ce qui est raccourci, omis ou remplacé est DIT dans `remarques`.
 * Ordre fixe : ouverture (légende) → indicateurs clés → un graphique par série → un avant/après par comparaison → alertes.
 * Éteint par défaut : la synthèse `tableau-de-bord` n'est posée que si `synthese === true`.
 */
import type { FormatPlan } from "../plan-scenes/schema";
import { validerPlan, type ResultatValidation } from "../plan-scenes/validateur";
import { garderChiffres } from "./garde-chiffres";
import type { ComparaisonTableau, IndicateurTableau, SerieTableau, TableauDeBord } from "./types";

export interface OptionsPlanDepuisDonnees {
  format: FormatPlan;
  /** Minutage des mots dits (indices pour `surMot`) ; absent : scènes réparties sur `dureeMs`. */
  mots?: { texte: string; debutMs: number; finMs: number }[];
  dureeMs: number;
  /** Seul `true` ajoute la scène de synthèse `tableau-de-bord`. */
  synthese?: boolean;
}

export interface ResultatPlanDepuisDonnees {
  resultat: ResultatValidation;
  /** Phrases en français : ce qui a été raccourci, omis ou remplacé. */
  remarques: string[];
}

interface SceneBrute {
  piece: string;
  parametres: Record<string, unknown>;
}

const POINTS_MAX = 8;
const KPI_MAX = 3;

/** Nombre écrit à la française, sans rien arrondir. */
function ecrire(v: number): string {
  return String(v).replace(".", ",");
}
/** Valeur d'un indicateur avec sa précision déclarée (permise par `nombresPermis`). */
function ecrirePrecis(i: IndicateurTableau): string {
  return i.valeur.toFixed(i.precision).replace(".", ",");
}
function couper(t: string, max: number): string {
  if (t.length <= max) return t;
  const c = t.slice(0, max);
  const e = c.lastIndexOf(" ");
  return (e >= Math.floor(max / 2) ? c.slice(0, e) : c).trim();
}

/** Les plus grands écarts : écart relatif des comparaisons (côté « après »), sinon l'ordre de la donnée. */
function indicateursCles(d: TableauDeBord, max: number): IndicateurTableau[] {
  const score = new Map<string, number>();
  for (const c of d.comparaisons) {
    const av = d.indicateurs.find((i) => i.id === c.avant);
    const ap = d.indicateurs.find((i) => i.id === c.apres);
    if (!av || !ap) continue;
    const ecart = av.valeur === 0 ? Math.abs(ap.valeur) : Math.abs(ap.valeur - av.valeur) / Math.abs(av.valeur);
    score.set(ap.id, Math.max(score.get(ap.id) ?? 0, ecart));
  }
  return d.indicateurs
    .map((i, rang) => ({ i, rang, s: score.get(i.id) ?? 0 }))
    .sort((a, b) => b.s - a.s || a.rang - b.rang)
    .slice(0, max)
    .map((x) => x.i);
}

/** Rang pair : compteur ; rang impair : carte KPI (le validateur retire une même pièce répétée). */
function sceneIndicateur(i: IndicateurTableau, d: TableauDeBord, noter: (m: string) => void, rang: number): SceneBrute {
  const comp = d.comparaisons.find((c) => c.apres === i.id);
  const avant = comp ? d.indicateurs.find((x) => x.id === comp.avant) : undefined;
  const unite = i.unite.trim();
  if (rang % 2 === 0 && unite.length <= 8) {
    if (i.libelle.length > 40) noter(`Indicateur « ${i.libelle} » : libellé raccourci à 40 caractères.`);
    // Unité vide : le champ n'est pas posé (le validateur la « réparerait » en « % »).
    return { piece: "compteur", parametres: { valeur: i.valeur, ...(unite ? { unite } : {}), libelle: couper(i.libelle, 40), surMot: 0 } };
  }
  const decimales = Math.min(i.precision, 2);
  if (i.precision > decimales) noter(`Indicateur « ${i.libelle} » : ${i.precision} décimales, 2 affichées par la carte.`);
  // Le suffixe (espace compris) tient dans 6 caractères : unité de 5 au plus ; sinon l'unité passe dans le libellé.
  const suffixe = unite.length <= 5 ? unite : "";
  const libelle = suffixe || !unite ? i.libelle : `${i.libelle} (${unite})`;
  if (!suffixe && unite) noter(`Indicateur « ${i.libelle} » : unité de plus de 5 caractères, écrite dans le libellé.`);
  const tendance = avant ? (i.valeur > avant.valeur ? "hausse" : i.valeur < avant.valeur ? "baisse" : "stable") : "stable";
  return { piece: "carte-kpi", parametres: { libelle: couper(libelle, 40), valeur: i.valeur, prefixe: "", suffixe: suffixe ? ` ${suffixe}` : "", decimales, tendance, variation: "" } };
}

function sceneSerie(s: SerieTableau, noter: (m: string) => void): SceneBrute {
  let points = s.points;
  if (points.length > POINTS_MAX) {
    noter(`Série « ${s.libelle} » de ${points.length} points : les ${POINTS_MAX} derniers montrés.`);
    points = points.slice(-POINTS_MAX);
  }
  const bas = points.reduce((m, p) => (p.valeur < m.valeur ? p : m), points[0]!);
  if (bas.valeur < 0) {
    noter(`Série « ${s.libelle} » : valeur négative (${ecrire(bas.valeur)}), le graphique ne les montre pas ; dite en légende.`);
    return { piece: "legende", parametres: { texte: couper(`${s.libelle} : ${ecrire(bas.valeur)} ${s.unite} en ${bas.x}`, 80), sousTexte: "", style: "etiquette" } };
  }
  if (s.libelle.length > 48) noter(`Série « ${s.libelle} » : titre raccourci à 48 caractères.`);
  let libellesCoupes = false;
  const valeurs = points.map((p) => {
    if (p.x.length > 14) libellesCoupes = true;
    return { libelle: couper(p.x, 14), valeur: p.valeur };
  });
  if (libellesCoupes) noter(`Série « ${s.libelle} » : libellés d'axe raccourcis à 14 caractères.`);
  const max = valeurs.reduce((m, v, k) => (v.valeur > valeurs[m]!.valeur ? k : m), 0);
  return { piece: "graphique", parametres: { type: "courbe", titre: couper(s.libelle, 48), valeurs, enAvant: max } };
}

function sceneComparaison(c: ComparaisonTableau, d: TableauDeBord, noter: (m: string) => void): SceneBrute | null {
  const av = d.indicateurs.find((i) => i.id === c.avant);
  const ap = d.indicateurs.find((i) => i.id === c.apres);
  if (!av || !ap) return null;
  const uAv = av.unite.trim();
  if (uAv !== ap.unite.trim()) {
    noter(`Comparaison « ${av.libelle} » / « ${ap.libelle} » : unités différentes, scène omise.`);
    return null;
  }
  const unite = uAv && uAv.length <= 8 ? { unite: uAv } : {};
  if (uAv.length > 8) noter(`Comparaison « ${ap.libelle} » : unité de plus de 8 caractères, non écrite.`);
  return { piece: "avant-apres", parametres: { titre: couper(ap.libelle, 40), avant: { valeur: av.valeur, ...unite, surMot: 0 }, apres: { valeur: ap.valeur, ...unite, surMot: 0 } } };
}

function sceneSynthese(d: TableauDeBord, noter: (m: string) => void): SceneBrute | null {
  const kpis: { libelle: string; valeur: string }[] = [];
  for (const i of indicateursCles(d, 4)) {
    const valeur = `${ecrirePrecis(i)} ${i.unite}`;
    if (valeur.length > 12) {
      noter(`Synthèse : « ${i.libelle} » (${valeur}) dépasse 12 caractères, omis.`);
      continue;
    }
    kpis.push({ libelle: couper(i.libelle, 24), valeur });
  }
  const serie = d.series.find((s) => s.points.every((p) => p.valeur >= 0));
  if (kpis.length < 2 || !serie || serie.points.length < 3) {
    noter("Synthèse : il faut 2 chiffres écrits et une série positive de 3 points au moins ; scène omise.");
    return null;
  }
  const points = serie.points.slice(-12);
  return { piece: "tableau-de-bord", parametres: { titre: couper(d.titre, 40), kpis, serie: points.map((p) => p.valeur) } };
}

export function planDepuisDonnees(donnee: TableauDeBord, options: OptionsPlanDepuisDonnees): ResultatPlanDepuisDonnees {
  const remarques: string[] = [];
  const noter = (m: string) => {
    if (!remarques.includes(m)) remarques.push(m);
  };
  const scenes: SceneBrute[] = [];
  if (donnee.titre.length > 80 || donnee.periode.libelle.length > 80) noter("Ouverture : texte raccourci.");
  scenes.push({ piece: "legende", parametres: { texte: couper(donnee.titre, 80), sousTexte: couper(donnee.periode.libelle, 80), style: "bandeau" } });
  if (options.synthese === true) {
    const s = sceneSynthese(donnee, noter);
    if (s) scenes.push(s);
  }
  indicateursCles(donnee, KPI_MAX).forEach((i, rang) => scenes.push(sceneIndicateur(i, donnee, noter, rang)));
  for (const s of donnee.series) scenes.push(sceneSerie(s, noter));
  for (const c of donnee.comparaisons) {
    const s = sceneComparaison(c, donnee, noter);
    if (s) scenes.push(s);
  }
  for (const a of donnee.alertes) {
    const texte = couper(a.texte, 80);
    const reste = a.texte.slice(texte.length).trim();
    scenes.push({ piece: "legende", parametres: { texte, sousTexte: couper(reste, 80), style: "bandeau" } });
  }

  // Minutage : une plage de mots par scène si les mots suffisent, sinon répartition égale du temps.
  const mots = options.mots ?? [];
  const n = scenes.length;
  const parMots = mots.length >= n;
  if (mots.length > 0 && !parMots) noter(`Minutage : ${mots.length} mots pour ${n} scènes, scènes réparties sur la durée.`);
  const dureeMs = Math.max(options.dureeMs, mots.at(-1)?.finMs ?? 0, 3000);
  const brut = scenes.map((s, k) => {
    let premier = 0;
    let dernier = 0;
    let debutMs: number;
    let finMs: number;
    if (parMots) {
      premier = Math.floor((k * mots.length) / n);
      dernier = Math.max(premier, Math.floor(((k + 1) * mots.length) / n) - 1);
      debutMs = mots[premier]!.debutMs;
      finMs = mots[dernier]!.finMs;
    } else {
      debutMs = Math.round((k * dureeMs) / n);
      finMs = Math.round(((k + 1) * dureeMs) / n);
    }
    const parametres = { ...s.parametres };
    posterSurMot(parametres, premier);
    return { id: `s${k + 1}`, mots: parMots ? { premier, dernier } : undefined, debutMs, finMs, piece: s.piece, parametres };
  });

  const resultat = validerPlan({ scenes: brut }, { mots, format: options.format, dureeMs });

  // Jamais silencieux : scènes retirées, paramètres réparés, replis de pièce, textes coupés.
  const CODES_DITS = new Set(["PARAMETRES_REPARES", "REPLI_NIVEAU_1", "PIECE_INCONNUE", "OBJET_NON_PERMIS", "CALQUE_RETIRE", "TEXTE_COUPE"]);
  for (const r of resultat.remarques) if (/retirée/.test(r.message) || CODES_DITS.has(r.code)) noter(`Scène ${r.sceneId ?? ""} : ${r.message}`.replace("Scène  :", "Plan :"));

  // Contrôle final : tout nombre écrit dans un texte de légende vient de la donnée.
  const textes = scenes.filter((s) => s.piece === "legende").flatMap((s) => [String(s.parametres.texte), String(s.parametres.sousTexte)]);
  for (const h of garderChiffres(donnee, { textesEcran: textes }).horsDonnee) noter(`Texte « ${h.texte} » : le nombre « ${h.brut} » n'est pas dans la donnée (affiché tel quel, à vérifier).`);
  return { resultat, remarques };
}

/** `surMot` des pièces de données : le premier mot de la scène. */
function posterSurMot(p: Record<string, unknown>, mot: number): void {
  if ("surMot" in p) p.surMot = mot;
  for (const k of ["avant", "apres"]) {
    const v = p[k];
    if (v && typeof v === "object" && "surMot" in v) (v as Record<string, unknown>).surMot = mot;
  }
}
