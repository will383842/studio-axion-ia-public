/**
 * Règle 4 fidèle à la mise en page (test croisé) : sur 20 fiches (les 4 exemples et 16 variantes, plus ou moins
 * chargées), « la règle 4 accepte » si et seulement si « la mise en page réussit ». Toutes les variantes restent sous
 * 40 mots et 6 lignes écrites par page, avec des mots qui tiennent à la taille prévue : seule la place à l'écran les
 * départage, et la règle doit trancher comme la mise en page.
 */
import { describe, expect, it } from "vitest";
import type { ElementTableau, FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { PAGE_LIGNES_MAX, PAGE_MOTS_MAX, reglePageLisible, textesEcrits } from "../../../src/moteurs/montage-tableau/regles";
import { EXEMPLES, contexteExemple, copie, ficheAvantApres, ficheDemonstration, ficheErreurCorrigee, ficheQuestionAbonne } from "./exemples";
import { element, scene } from "./outils";

const repete = (mot: string, n: number) => Array.from({ length: n }, () => mot).join(" ");

function variante(nom: string, base: FicheTableau, changer: (f: FicheTableau) => void) {
  const f = copie(base);
  f.videoId = `${base.videoId}-${nom}`;
  changer(f);
  return { nom, fiche: f };
}

/** `n` dessins au centre de plus dans la scène `id` (ils ne comptent ni en mots ni en lignes). */
const dessinsAuCentre = (f: FicheTableau, id: string, n: number) => {
  for (let i = 0; i < n; i++) scene(f, id).elements.push({ id: `d${id}${i}`, type: "dessin", dessinId: "ampoule", cote: "centre", ancre: 1 });
};

const ligne = (id: string, texte: string, ancre: number): ElementTableau => ({ id, type: "ligne", texte, niveau: "texte", role: "condition", ancre });

const FICHES: readonly { nom: string; fiche: FicheTableau }[] = [
  ...Object.entries(EXEMPLES).map(([nom, fiche]) => ({ nom, fiche })),
  variante("resultat-de-12-mots", ficheErreurCorrigee, (f) => (element(f, "e10", "ligne").texte = repete("juste", 12))),
  variante("resultat-de-20-mots", ficheErreurCorrigee, (f) => (element(f, "e10", "ligne").texte = repete("juste", 20))),
  variante("resultat-de-28-mots", ficheErreurCorrigee, (f) => (element(f, "e10", "ligne").texte = repete("juste", 28))),
  variante("resultat-de-32-mots", ficheErreurCorrigee, (f) => (element(f, "e10", "ligne").texte = repete("juste", 32))),
  variante("un-dessin-de-plus", ficheErreurCorrigee, (f) => dessinsAuCentre(f, "s06", 1)),
  variante("trois-dessins-de-plus", ficheErreurCorrigee, (f) => dessinsAuCentre(f, "s06", 3)),
  variante("cinq-dessins-de-plus", ficheErreurCorrigee, (f) => dessinsAuCentre(f, "s06", 5)),
  variante("titre-long", ficheQuestionAbonne, (f) => {
    const l = f.scenes.flatMap((s) => s.elements).find((e): e is Extract<ElementTableau, { type: "ligne" }> => e.type === "ligne" && e.niveau === "titre")!;
    l.texte = "Une question fermée donne une réponse claire et nette";
  }),
  variante("quatre-lignes-de-plus", ficheDemonstration, (f) => {
    scene(f, "s02").elements.push(ligne("x1", "Notez la dernière question d'un client", 1), ligne("x2", "Gardez la question telle quelle", 2));
    scene(f, "s01").elements.push(ligne("x3", "Plus jamais à court", 1), ligne("x4", "Une idée chaque matin", 2));
  }),
  variante("quatre-lignes-longues-de-plus", ficheDemonstration, (f) => {
    scene(f, "s02").elements.push(ligne("x1", repete("question", 7), 1), ligne("x2", repete("question", 7), 2));
    scene(f, "s01").elements.push(ligne("x3", repete("idée", 7), 1), ligne("x4", repete("idée", 7), 2));
  }),
  variante("avant-apres-chargees", ficheAvantApres, (f) => {
    element(f, "e09", "preuve").lignes = [`Avant : ${repete("recopie", 12)}`, `Après : ${repete("relecture", 12)}`];
  }),
  variante("avant-apres-mi-chargees", ficheAvantApres, (f) => {
    element(f, "e09", "preuve").lignes = [`Avant : ${repete("recopie", 5)}`, `Après : ${repete("relecture", 5)}`];
  }),
  variante("quatre-scenes-sur-une-page", ficheErreurCorrigee, (f) => f.scenes.forEach((s, i) => (s.page = i < 4 ? 1 : 2))),
  variante("quatre-scenes-sur-une-page-sans-dessin", ficheErreurCorrigee, (f) => {
    f.scenes.forEach((s, i) => (s.page = i < 4 ? 1 : 2));
    for (const s of f.scenes) s.elements = s.elements.filter((e) => e.type !== "dessin");
  }),
  variante("deux-pages-dessins-au-centre", ficheQuestionAbonne, (f) => {
    f.scenes.forEach((s, i) => (s.page = i < 3 ? 1 : 2));
    for (const s of f.scenes) for (const e of s.elements) if (e.type === "dessin") e.cote = "centre";
  }),
  variante("une-scene-par-page", ficheAvantApres, (f) => f.scenes.forEach((s, i) => (s.page = Math.min(6, i + 1)))),
];

function miseEnPageReussit(fiche: FicheTableau): boolean {
  try {
    mettreEnPage(fiche);
    return true;
  } catch {
    return false;
  }
}

describe("règle 4 ⇔ mise en page réelle, sur 20 fiches", () => {
  it("20 fiches distinctes, toutes sous 40 mots et 6 lignes écrites par page", () => {
    expect(FICHES).toHaveLength(20);
    expect(new Set(FICHES.map((v) => v.fiche.videoId)).size).toBe(20);
    for (const { fiche } of FICHES)
      for (const page of new Set(fiche.scenes.map((s) => s.page))) {
        const elements = fiche.scenes.filter((s) => s.page === page).flatMap((s) => s.elements);
        expect(elements.flatMap(textesEcrits).join(" ").split(/\s+/).filter(Boolean).length, fiche.videoId).toBeLessThanOrEqual(PAGE_MOTS_MAX);
        expect(elements.reduce((n, e) => n + (e.type === "ligne" ? 1 : e.type === "preuve" ? e.lignes.length : 0), 0)).toBeLessThanOrEqual(PAGE_LIGNES_MAX);
      }
  });

  it.each(FICHES.map((v) => [v.nom, v.fiche] as const))("%s : la règle 4 accepte si et seulement si la mise en page réussit", (_nom, fiche) => {
    const accepte = reglePageLisible(fiche, contexteExemple(fiche)).length === 0;
    expect(accepte).toBe(miseEnPageReussit(fiche));
  });

  it("les deux issues sont représentées : des fiches tiennent, d'autres non", () => {
    const issues = FICHES.map((v) => miseEnPageReussit(v.fiche));
    expect(issues.filter(Boolean).length).toBeGreaterThanOrEqual(5);
    expect(issues.filter((x) => !x).length).toBeGreaterThanOrEqual(5);
  });

  it("les 4 fiches d'exemple sont acceptées et se mettent en page", () => {
    for (const fiche of Object.values(EXEMPLES)) {
      expect(reglePageLisible(fiche, contexteExemple(fiche))).toEqual([]);
      expect(miseEnPageReussit(fiche)).toBe(true);
    }
  });
});
