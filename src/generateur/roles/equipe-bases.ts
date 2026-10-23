/**
 * CHAÎNE « ÉQUIPE » · FICHE DE LA CIBLE, lue dans les bases de l'Usine (UNE SEULE SOURCE : `donnees/bases-usine`, la même
 * lecture que le reste du studio, aucune copie ici). PUR : aucun appel, aucun réseau.
 *
 * Ce que l'équipe en tire : la taille (qui décide, comment on lui parle, ses mots, ce qu'on ne lui dit jamais), le métier
 * quand la fonction du brief en désigne UN seul (ses mots, ce qu'il veut vraiment, ses objections) et la douleur NOMMÉE
 * (règle C80 : la douleur est nommée, seule l'intensité varie). Rien d'autre : ni cas d'usage (« à refaire seul »), ni
 * sujets (« 5 actualités »), ni appels (« lien dans mon profil ») ne passent par ici, et chaque ligne reprise est filtrée
 * par les règles de Will et par l'absence de chiffre (aucun chiffre sans preuve).
 * Sans cible dans le brief, ou sans fiche trouvée : `null`, la chaîne se comporte comme avant.
 */
import { metiers, tailles, type Douleur, type Metier } from "@/donnees/bases-usine";
import { normaliser } from "@/domaine/controles-script/texte";
import type { TailleCible } from "./equipe-commun";
import { violationsReglesWill } from "./equipe-commun";

export interface FicheCibleEquipe {
  taille: { code: TailleCible; nom: string; quiDecide: string; commentParler: string; mots: string[]; neJamaisDire: string[] };
  metier?: { code: string; nom: string; mots: string[]; veutVraiment: string; neJamaisDire: string[] };
  /** La douleur NOMMÉE (mot pour mot de la base) : le chef la garde, seule son intensité varie. */
  douleur?: { code: string; dite: string; scene: string };
  objections: string[];
}

/** Les trois contradictions connues des bases : si une cellule en porte la trace, elle n'entre pas. */
const CONTRADICTIONS_CONNUES = /\b(refaire seule?|peut refaire|lien dans (mon|ma|le) profil|\d+ actualites?)\b/;

/** Une cellule des bases entre dans la consigne seulement si elle est propre : ni chiffre, ni règle de Will enfreinte, ni contradiction connue. */
export function celluleSure(t: string): boolean {
  const s = t.trim();
  if (!s || /\d/.test(s) || /[<>]/.test(s)) return false;
  return violationsReglesWill(s).length === 0 && !CONTRADICTIONS_CONNUES.test(normaliser(s).replace(/['’]/g, " "));
}

const sures = (xs: readonly string[], max: number) => xs.filter(celluleSure).slice(0, max);

/** Mots significatifs d'un texte (5 lettres et plus), sans accents. */
const motsDe = (t: string) => new Set(normaliser(t).replace(/['’]/g, " ").split(/\s+/).filter((m) => m.length >= 5));

/** Les bases sont figées dans le build : on les lit une fois. */
let metiersLus: Metier[] | undefined;
const tousLesMetiers = () => (metiersLus ??= metiers());

/** Le métier que désigne la fonction du brief : UN seul, sinon aucun (jamais de choix au hasard entre deux métiers). */
export function metierDeLaFonction(fonction: string | undefined): Metier | null {
  const f = normaliser(fonction ?? "").replace(/['’]/g, " ").trim();
  if (f.length < 4) return null;
  const trouves = tousLesMetiers().filter((m) => {
    const noms = [m.nom, ...m.seNomment.split(/[,;]/)].map((x) => normaliser(x).replace(/[«»]/g, "").replace(/['’]/g, " ").trim()).filter((x) => x.length >= 4);
    return noms.some((n) => n === f || n === `${f}s` || `${n}s` === f);
  });
  return trouves.length === 1 ? trouves[0] : null;
}

/** La douleur la plus proche du sujet (mots communs), à égalité celle que la graine désigne ; seulement une douleur propre de la taille. */
function douleurDuSujet(m: Metier, taille: TailleCible, idee: string, g: number): Douleur | null {
  const typique = m.taillesTypiques.length === 0 || m.taillesTypiques.includes(taille);
  const candidates = m.douleurs.filter((d) => (d.tailles.length ? d.tailles.includes(taille) : typique) && celluleSure(d.dite) && (!d.sceneAvant || celluleSure(d.sceneAvant)));
  if (!candidates.length) return null;
  const voulus = motsDe(idee);
  const score = (d: Douleur) => [...motsDe(d.dite)].filter((x) => voulus.has(x)).length;
  const meilleur = Math.max(...candidates.map(score));
  const ex = candidates.filter((d) => score(d) === meilleur);
  return ex[g % ex.length];
}

/**
 * La fiche de la cible du sujet. `cible` = ce que le brief donne (vide : pas de fiche) ; `taille` et `fonction` viennent de
 * `cibleEquipe`. Une taille inconnue des bases : `null`.
 */
export function ficheCibleEquipe(brief: string | undefined, cible: { taille: TailleCible; fonction?: string }, idee: string, g: number): FicheCibleEquipe | null {
  if (!brief?.trim()) return null;
  const t = tailles().find((x) => x.code === cible.taille);
  if (!t) return null;
  const m = metierDeLaFonction(cible.fonction);
  const d = m ? douleurDuSujet(m, cible.taille, idee, g) : null;
  const objections = m ? m.objections.filter((o) => (o.ouLUtiliser.length === 0 || o.ouLUtiliser.includes("video")) && celluleSure(o.objection)).map((o) => o.objection.replace(/[«»]/g, "").trim()) : [];
  const choisies = objections.length ? Array.from({ length: Math.min(3, objections.length) }, (_, i) => objections[(g + i) % objections.length]) : [];
  return {
    taille: { code: cible.taille, nom: t.nom, quiDecide: celluleSure(t.quiDecide) ? t.quiDecide : "", commentParler: celluleSure(t.commentParler) ? t.commentParler : "", mots: sures(t.mots, 8), neJamaisDire: sures(t.neJamaisDire, 6) },
    ...(m ? { metier: { code: m.code, nom: m.nom, mots: sures(m.mots, 10), veutVraiment: celluleSure(m.veutVraiment) ? m.veutVraiment : "", neJamaisDire: sures(m.neJamaisDire, 4) } } : {}),
    ...(d ? { douleur: { code: d.code, dite: d.dite.trim(), scene: d.sceneAvant && celluleSure(d.sceneAvant) ? d.sceneAvant.trim() : "" } } : {}),
    objections: [...new Set(choisies)],
  };
}

const ligne = (balise: string, v: string) => (v ? `<${balise}>${v}</${balise}>` : "");

/**
 * Ce que chaque rôle reçoit (chaîne vide : rien à montrer, la variable reste celle d'avant).
 *  - `chef` : la taille, le métier, la douleur nommée ;
 *  - `scenariste` : le vocabulaire, les objections, ce qu'on ne dit pas ;
 *  - `relecteur` : le vocabulaire et les objections, pour relire dans la peau de la cible.
 */
export function rendreFicheCible(f: FicheCibleEquipe | null | undefined, pour: "chef" | "scenariste" | "relecteur"): string {
  if (!f) return "";
  const mots = [...f.taille.mots, ...(f.metier?.mots ?? [])].join(" ; ");
  const eviter = [...f.taille.neJamaisDire, ...(f.metier?.neJamaisDire ?? [])].join(" ; ");
  const objections = f.objections.map((o) => `- ${o}`).join("\n");
  const corps =
    pour === "chef"
      ? [
          ligne("taille", `${f.taille.nom}. Qui décide : ${f.taille.quiDecide}`.replace(/ Qui décide : $/, "")),
          ligne("comment_parler", f.taille.commentParler),
          f.metier ? ligne("metier", `${f.metier.nom}. Il veut vraiment : ${f.metier.veutVraiment}`.replace(/ Il veut vraiment : $/, "")) : "",
          f.douleur ? ligne("douleur_nommee", [f.douleur.dite, f.douleur.scene].filter(Boolean).join(" ")) : "",
        ]
      : [ligne("mots_de_la_cible", mots), objections ? `<objections_de_la_cible>\n${objections}\n</objections_de_la_cible>` : "", pour === "scenariste" ? ligne("a_ne_pas_dire", eviter) : ligne("comment_parler", f.taille.commentParler)];
  const dedans = corps.filter(Boolean).join("\n");
  return dedans ? `<fiche_cible>\n${dedans}\n</fiche_cible>` : "";
}
