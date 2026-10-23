/**
 * ESSAI RÉEL des gabarits de la vague 1 (L9 : T22, T23, T24, T26, T27, T28) : chaque gabarit est rendu par le vrai Remotion en contenu MOYEN
 * (réaliste), MINIMAL et MAXIMAL (budgets du registre, mots longs : le cas le plus rude), et chaque rendu est MESURÉ (débordements, textes en
 * zone réservée, chevauchements texte/texte et texte/illustration, plus petit corps, VIDE : part du corps de page sans texte ni dessin, au plus
 * `VIDE_MAX` = 25 %). Sans réseau extérieur, sans appel payant.
 * Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome-headless-shell npx tsx --tsconfig ../tsconfig.json scripts/essai-l9.ts [t22 t23 ...]
 * Navigateur : Chrome Headless Shell de Chrome for Testing 149.0.7790.0 (celui de Remotion), JAMAIS le Chromium de Playwright.
 * Sortie : `essais-visuels/l9/apres/<nom>.jpg` et `essais-visuels/l9/apres/mesures.json` ; avec l'argument `avant`, le même contenu dans les
 * anciens gabarits (`AVANT_L9`) sous `essais-visuels/l9/avant/`.
 */
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { TypePage } from "../../src/briques/visuels/registre-pages.js";
import { TAILLE_TEXTE_MIN } from "../compositions/visuels/commun/constantes.js";
import { VIDE_MAX } from "../compositions/visuels/commun/zones.js";
import { creerVisuelPage, rendreAvecRemotion } from "../src/operations/visuel-page.js";
import { AVANT_L9, MOYENS_L9, VARIANTES_L9 } from "./contenu-essai-l9.js";
import { capaciteQuestion } from "../../src/briques/visuels/registre-pages.js";
import { casMax, casMin, ICONES_ESSAI, specAutour, texteMotsLongs } from "./contenu-essai-visuel.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (!navigateur) throw new Error("STUDIO_RENDU_NAVIGATEUR doit désigner le Chrome Headless Shell de Remotion (Chrome for Testing 149).");
if (navigateur.includes("pw-browsers")) throw new Error("Le Chromium de Playwright ne doit pas être utilisé pour ces essais.");

export const TYPES_L9: readonly TypePage[] = ["T22", "T23", "T24", "T26", "T27", "T28"];

// « avant » : le même contenu dans les anciens gabarits (planche avant / après), rendu dans `essais-visuels/l9/avant/`.
const avant = process.argv[2] === "avant";
const sortie = resolve("essais-visuels", "l9", avant ? "avant" : "apres");
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-l9-"));
const op = creerVisuelPage({ rendre: rendreAvecRemotion({ navigateur }), deposer: async (cible, chemin) => void copyFileSync(chemin, cible) });

const filtre = avant ? [] : process.argv.slice(2).map((a) => a.toLowerCase());
const essais = avant ? AVANT_L9 : [
  ...MOYENS_L9,
  ...VARIANTES_L9,
  ...TYPES_L9.flatMap((t) => casMin(t).map((c) => ({ nom: `${t.toLowerCase()}-minimal`, page: c.page }))),
  ...TYPES_L9.flatMap((t) => casMax(t, texteMotsLongs).map((c, i) => ({ nom: `${t.toLowerCase()}-maximal-v${i + 1}`, page: { ...c.page, ...("titre" in c.page ? { titre: "Construire messages" } : {}) } }))),
  ...frontieres(),
].filter((e) => filtre.length === 0 || filtre.some((f) => e.nom.startsWith(f)));

/**
 * Cas FRONTIÈRE : un texte juste sous le seuil où le gabarit agrandit ses caractères (T22, T24) ou garde son grand corps (T23 : 70 % du
 * budget) est plus haut que le maximum du budget, rendu à un corps plus petit. Mots longs : la forme la plus rude.
 */
function frontieres(): { nom: string; page: Record<string, unknown> }[] {
  const titre = "Construire messages";
  const t = texteMotsLongs;
  const res = [
    { nom: "t22-frontiere-court", page: { type: "T22", titre, mythe: t(30), realite: t(36, 4) } },
    { nom: "t22-frontiere-moyen", page: { type: "T22", titre, mythe: t(45), realite: t(60, 4) } },
    // Mots de 15 lettres (le plafond de la porte, `CAPACITE_COMPARAISON.mot`), les plus larges : chaque case n'en porte qu'un.
    ...[3, 5].map((n) => ({ nom: `t24-frontiere-mot15-${n}`, page: { type: "T24", titre, lignes: Array.from({ length: n }, () => ({ sans: "automatiquement", avec: "administratives" })) } })),
    ...[3, 4, 5].map((n) => ({ nom: `t24-frontiere-${n}`, page: { type: "T24", titre, lignes: Array.from({ length: n }, (_, i) => ({ sans: t(14, i), avec: t(14, i + 4) })) } })),
  ];
  for (const n of [2, 3, 4]) {
    const c = capaciteQuestion(n);
    const q = Math.floor(0.7 * c.question);
    const a = Math.floor(0.7 * c.aide);
    res.push({ nom: `t23-frontiere-${n}`, page: { type: "T23", titre, questions: Array.from({ length: n }, (_, i) => ({ question: t(q, i), aide: t(a, i + 3), icone: ICONES_ESSAI[i] })), annotation: t(40, 2) } } as never);
  }
  return res;
}

const resultats: Record<string, unknown> = {};
const echecs: string[] = [];
for (const e of essais) {
  const { spec, index } = specAutour(e.page);
  const fichier = `${e.nom}.jpg`;
  const cible = join(travail, fichier);
  try {
    const r = await op(
      { idRendu: e.nom, operation: "visuel-page", file: "courte", entrees: {}, sortie: { urlDepot: cible, cle: "essai" }, parametres: { proprietes: { spec, index }, scale: 1, jpegQuality: 90 } },
      { progression: () => {}, dossier: mkdtempSync(join(travail, "p-")), signal: new AbortController().signal },
    );
    copyFileSync(cible, join(sortie, fichier));
    const m = (r.mesures ?? {}) as Record<string, number>;
    resultats[e.nom] = m;
    const fautes = [
      m.debordements !== 0 && `${m.debordements} débordement(s)`,
      m.textesEnZone !== 0 && `${m.textesEnZone} texte(s) en zone réservée`,
      m.chevauchements !== 0 && `${m.chevauchements} chevauchement(s)`,
      // Vide : une mesure absente est un échec, comme le reste ; les anciens gabarits (« avant ») ne sont rendus que pour la comparaison.
      !avant && !(m.vide <= VIDE_MAX) && `vide ${Math.round(m.vide * 100)} % (> ${VIDE_MAX * 100} %)`,
      !(m.taillePoliceMin >= TAILLE_TEXTE_MIN) && `texte à ${m.taillePoliceMin} px`,
    ].filter(Boolean);
    console.log(`${e.nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [débordements ${m.debordements}, zone ${m.textesEnZone}, chevauchements ${m.chevauchements}, vide ${Math.round(m.vide * 100)} %, police min ${m.taillePoliceMin}]`);
    if (fautes.length) echecs.push(`${e.nom} : ${fautes.join(", ")}`);
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).slice(0, 300);
    resultats[e.nom] = { erreur: message };
    console.log(`${e.nom} : ÉCHEC ${message}`);
    echecs.push(`${e.nom} : ${message}`);
  }
}
writeFileSync(join(sortie, filtre.length ? `mesures-${filtre.join("-")}.json` : "mesures.json"), `${JSON.stringify(resultats, null, 2)}\n`);
if (echecs.length) {
  console.error(`\n${echecs.length} essai(s) en échec :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${essais.length} rendus, 0 débordement, 0 texte en zone, 0 chevauchement${avant ? " (vide non contrôlé : anciens gabarits)" : ", vide ≤ 25 %"}.`);
process.exit(0);
