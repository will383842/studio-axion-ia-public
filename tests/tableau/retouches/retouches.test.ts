/**
 * TB-20 : retouche par boutons, côté moteur — chaque opération du catalogue fermé (cas valide, refus), le calcul de ce
 * qui est refait (une retouche d'image ne refait jamais la voix ; les scènes des autres pages ne sont pas refaites),
 * gratuit ou payant. Fonctions pures, aucun appel.
 */
import { describe, expect, it } from "vitest";
import { CATALOGUE_RETOUCHES, TYPES_OPERATION_RETOUCHE, apercuRetouche, type ContexteRetouche, type OperationRetouche } from "../../../src/moteurs/montage-tableau/retouches";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { contexteExemple, copie, ficheDemonstration } from "../regles/exemples";

const F = ficheDemonstration;
const { texteScript: _script, ...regles } = contexteExemple(F);
void _script;
const CTX: ContexteRetouche = { ...regles, appels: ["fin-commune", "fin-question"] };

const voir = (op: OperationRetouche | OperationRetouche[], fiche: FicheTableau = F) => apercuRetouche(fiche, op, CTX);
const scene = (f: FicheTableau, id: string) => f.scenes.find((s) => s.id === id)!;
const element = (f: FicheTableau, sid: string, eid: string) => scene(f, sid).elements.find((e) => e.id === eid) as Record<string, unknown> | undefined;

/** Refusée : la fiche de départ, inchangée (même objet), rien de refait, au moins une phrase en vouvoiement ou claire. */
function refusee(op: OperationRetouche | OperationRetouche[], motif?: RegExp) {
  const avant = JSON.stringify(F);
  const r = voir(op);
  expect(r.ok).toBe(false);
  expect(r.fiche).toBe(F);
  expect(JSON.stringify(F)).toBe(avant);
  expect(r).toMatchObject({ scenesRefaites: [], voixRefaite: false, finRefaite: false, caracteresARelire: 0, payant: false });
  expect(r.refus.length).toBeGreaterThan(0);
  for (const p of r.refus) expect(p).toMatch(/^[A-ZÀ-Ý]/);
  if (motif) expect(r.refus.join(" ")).toMatch(motif);
  return r;
}

/** Acceptée sans toucher la voix : seules les pages montrées sont refaites, gratuit. */
function imageSeule(op: OperationRetouche | OperationRetouche[], scenes: string[]) {
  const r = voir(op);
  expect(r.refus).toEqual([]);
  expect(r.ok).toBe(true);
  expect(r).toMatchObject({ voixRefaite: false, caracteresARelire: 0, payant: false, finRefaite: false });
  expect(r.scenesRefaites).toEqual(scenes);
  expect(r.fiche.habillage).toBe(F.habillage);
  expect(r.fiche.stylo).toBe(F.stylo);
  return r;
}

// Page 1 : s01 s02 · page 2 : s03 s04 · page 3 : s05 s06. Une page touchée = ses scènes + la première de la suivante.
const PAGE1 = ["s01", "s02", "s03"];
const PAGE2 = ["s03", "s04", "s05"];
const PAGE3 = ["s05", "s06"];

describe("catalogue fermé", () => {
  it("chaque opération a un libellé en français, ce qu'elle refait, et seule la voix coûte", () => {
    expect(TYPES_OPERATION_RETOUCHE).toHaveLength(11);
    for (const t of TYPES_OPERATION_RETOUCHE) {
      const d = CATALOGUE_RETOUCHES[t];
      expect(d.libelle.length).toBeGreaterThan(5);
      expect(d.payant).toBe(d.refait === "voix");
    }
    expect(TYPES_OPERATION_RETOUCHE.filter((t) => CATALOGUE_RETOUCHES[t].payant)).toEqual(["modifierTexteDit"]);
  });

  it("une opération hors catalogue, ou des coordonnées libres, sont refusées sans rien changer", () => {
    refusee({ type: "deplacerElement", sceneId: "s01", elementId: "e01", x: 10, y: 20 } as unknown as OperationRetouche, /boutons proposés/);
    refusee({ type: "remplacerDessin", sceneId: "s01", elementId: "e02", dessinId: "loupe", x: 3 } as unknown as OperationRetouche, /boutons proposés/);
    refusee([], /Aucune retouche/);
  });

  it("une opération qui ne change rien est refusée", () => {
    refusee({ type: "ajouterMarque", sceneId: "s01", elementId: "e01", marque: "entoure" }, /ne change rien/);
  });
});

describe("opérations sur l'image (gratuites)", () => {
  it("changer le texte écrit d'une ligne : seules les scènes qui montrent sa page", () => {
    const r = imageSeule({ type: "remplacerTexteLigne", sceneId: "s03", elementId: "e05", texte: "Demandez trois bonnes idées" }, PAGE2);
    expect(element(r.fiche, "s03", "e05")?.texte).toBe("Demandez trois bonnes idées");
    expect(scene(r.fiche, "s03").texteDit).toBe(scene(F, "s03").texteDit);
  });

  it("changer le texte écrit : refusé s'il porte un appel ou un mot interdit", () => {
    refusee({ type: "remplacerTexteLigne", sceneId: "s03", elementId: "e05", texte: "Abonnez-vous vite" }, /n'est pas possible/);
    refusee({ type: "remplacerTexteLigne", sceneId: "s03", elementId: "e06", texte: "Autre" }, /n'est pas une ligne écrite/);
    refusee({ type: "remplacerTexteLigne", sceneId: "s09", elementId: "e05", texte: "Autre" }, /La scène « s09 » n'existe pas/);
  });

  it("mettre un mot en valeur, puis le retirer", () => {
    const r = imageSeule({ type: "marquerMotImportant", sceneId: "s06", elementId: "e11", mot: "chercher" }, PAGE3);
    expect(element(r.fiche, "s06", "e11")?.importants).toEqual(["chercher"]);
    const retire = apercuRetouche(r.fiche, { type: "retirerMotImportant", sceneId: "s06", elementId: "e11", mot: "chercher" }, CTX);
    expect(retire.ok).toBe(true);
    expect(element(retire.fiche, "s06", "e11")?.importants).toBeUndefined();
    expect(retire.scenesRefaites).toEqual(PAGE3);
  });

  it("mot important : refusé s'il n'est pas dans la ligne, ou pas mis en valeur", () => {
    refusee({ type: "marquerMotImportant", sceneId: "s06", elementId: "e11", mot: "voiture" }, /n'est pas dans la ligne/);
    refusee({ type: "retirerMotImportant", sceneId: "s06", elementId: "e11", mot: "chercher" }, /n'est pas mis en valeur/);
  });

  it("changer le texte d'une ligne oublie les mots importants qui n'y sont plus", () => {
    const depart = apercuRetouche(F, { type: "marquerMotImportant", sceneId: "s06", elementId: "e11", mot: "chercher" }, CTX).fiche;
    const r = apercuRetouche(depart, { type: "remplacerTexteLigne", sceneId: "s06", elementId: "e11", texte: "Publiez plus vite" }, CTX);
    expect(r.ok).toBe(true);
    expect(element(r.fiche, "s06", "e11")?.importants).toBeUndefined();
  });

  it("souligner, entourer ou barrer une ligne ; enlever le trait", () => {
    const r = imageSeule({ type: "ajouterMarque", sceneId: "s06", elementId: "e11", marque: "souligne" }, PAGE3);
    expect(element(r.fiche, "s06", "e11")?.marque).toBe("souligne");
    const sans = imageSeule({ type: "retirerMarque", sceneId: "s03", elementId: "e05" }, PAGE2);
    expect(element(sans.fiche, "s03", "e05")).not.toHaveProperty("marque");
    refusee({ type: "retirerMarque", sceneId: "s06", elementId: "e11" }, /pas de trait/);
    refusee({ type: "ajouterMarque", sceneId: "s06", elementId: "e11", marque: "clignote" } as unknown as OperationRetouche, /boutons proposés/);
  });

  it("changer un dessin parmi ceux de la banque ; un dessin inconnu est refusé", () => {
    const r = imageSeule({ type: "remplacerDessin", sceneId: "s01", elementId: "e02", dessinId: "loupe" }, PAGE1);
    expect(element(r.fiche, "s01", "e02")?.dessinId).toBe("loupe");
    refusee({ type: "remplacerDessin", sceneId: "s01", elementId: "e02", dessinId: "licorne-inventee" }, /pas dans la banque/);
    refusee({ type: "remplacerDessin", sceneId: "s01", elementId: "e01", dessinId: "loupe" }, /n'est pas un dessin/);
  });

  it("retirer un élément ; refusé s'il est visé par un geste, absent, ou si les règles l'exigent", () => {
    const r = imageSeule({ type: "supprimerElement", sceneId: "s04", elementId: "e08" }, PAGE2);
    expect(scene(r.fiche, "s04").elements.map((e) => e.id)).toEqual(["e07"]);
    refusee({ type: "supprimerElement", sceneId: "s06", elementId: "e11" }, /Un geste du stylo vise cet élément/);
    refusee({ type: "supprimerElement", sceneId: "s06", elementId: "e99" }, /n'est pas dans la scène s06/);
    refusee([{ type: "supprimerElement", sceneId: "s05", elementId: "e10" }, { type: "supprimerElement", sceneId: "s05", elementId: "e09" }], /garde au moins un élément/);
    // Sans sa ligne entourée, la première scène n'écrit plus la douleur : les règles refusent.
    refusee({ type: "supprimerElement", sceneId: "s01", elementId: "e01" }, /n'est pas possible/);
  });

  it("changer le geste du stylo (souligner, entourer, barrer, cocher)", () => {
    const r = imageSeule({ type: "changerGeste", sceneId: "s06", elementId: "e12", geste: "souligner" }, PAGE3);
    expect(element(r.fiche, "s06", "e12")?.geste).toBe("souligner");
    refusee({ type: "changerGeste", sceneId: "s06", elementId: "e12", geste: "pointer" } as unknown as OperationRetouche, /boutons proposés/);
    refusee({ type: "changerGeste", sceneId: "s06", elementId: "e11", geste: "barrer" }, /n'est pas un geste du stylo/);
  });

  it("passer une scène à la page d'avant : ses deux pages sont refaites, pas la page 3", () => {
    const r = voir({ type: "deplacerScene", sceneId: "s03", vers: "page-precedente" });
    expect(r.refus).toEqual([]);
    expect(r.fiche.scenes.map((s) => s.page)).toEqual([1, 1, 1, 2, 3, 3]);
    expect(r).toMatchObject({ ok: true, voixRefaite: false, payant: false });
    expect(r.scenesRefaites).toEqual(["s01", "s02", "s03", "s04", "s05"]);
    expect(r.scenesRefaites).not.toContain("s06");
  });

  it("passer une scène à la page d'après ; refusé au milieu d'une page ou pour la première scène", () => {
    const r = voir({ type: "deplacerScene", sceneId: "s02", vers: "page-suivante" });
    expect(r.refus).toEqual([]);
    expect(r.fiche.scenes.map((s) => s.page)).toEqual([1, 2, 2, 2, 3, 3]);
    expect(r.scenesRefaites).not.toContain("s06");
    refusee({ type: "deplacerScene", sceneId: "s01", vers: "page-precedente" }, /première scène reste sur la première page/);
    refusee({ type: "deplacerScene", sceneId: "s04", vers: "page-precedente" }, /Seule la première scène d'une page/);
    refusee({ type: "deplacerScene", sceneId: "s03", vers: "page-suivante" }, /Seule la dernière scène d'une page/);
  });

  it("changer la fin : seulement parmi la bibliothèque des appels ; seule la fin est refaite", () => {
    const r = voir({ type: "changerFin", appelId: "fin-question" });
    expect(r).toMatchObject({ ok: true, scenesRefaites: [], finRefaite: true, voixRefaite: false, payant: false, caracteresARelire: 0 });
    expect(r.fiche.appelId).toBe("fin-question");
    refusee({ type: "changerFin", appelId: "abonnez-vous-maintenant" }, /bibliothèque des appels/);
  });
});

describe("opération sur la voix (payante, annoncée avant)", () => {
  it("changer ce qui est dit : voix relue en entier, toutes les scènes et la fin refaites, caractères comptés", () => {
    const texte = "Geste deux : demandez trois idées de publication à partir de la question.";
    const r = voir({ type: "modifierTexteDit", sceneId: "s03", texte });
    expect(r.refus).toEqual([]);
    expect(r).toMatchObject({ ok: true, voixRefaite: true, payant: true, finRefaite: true });
    expect(scene(r.fiche, "s03").texteDit).toBe(texte);
    expect(r.scenesRefaites).toEqual(F.scenes.map((s) => s.id));
    expect(r.caracteresARelire).toBe(r.fiche.scenes.map((s) => s.texteDit).join(" ").length);
  });

  it("changer ce qui est dit : refusé si un mot interdit ou un appel y entre, ou si un élément perd son mot", () => {
    refusee({ type: "modifierTexteDit", sceneId: "s03", texte: "Geste deux : demandez trois idées de publication demain, à partir de cette question." }, /n'est pas possible/);
    refusee({ type: "modifierTexteDit", sceneId: "s03", texte: "Geste deux : abonnez-vous à la chaîne pour trois idées de publication." }, /n'est pas possible/);
    refusee({ type: "modifierTexteDit", sceneId: "s03", texte: "Demandez trois idées." }, /n'est pas possible/);
  });

  it("une retouche d'image ne refait jamais la voix, quelle qu'elle soit", () => {
    const images: OperationRetouche[] = [
      { type: "remplacerTexteLigne", sceneId: "s01", elementId: "e01", texte: "Des idées de publications" },
      { type: "ajouterMarque", sceneId: "s06", elementId: "e11", marque: "souligne" },
      { type: "remplacerDessin", sceneId: "s03", elementId: "e06", dessinId: "loupe" },
      { type: "changerGeste", sceneId: "s05", elementId: "e10", geste: "souligner" },
      { type: "deplacerScene", sceneId: "s05", vers: "page-precedente" },
      { type: "changerFin", appelId: "fin-commune" },
    ];
    for (const op of images) {
      const r = voir(op);
      expect(r.refus, op.type).toEqual([]);
      expect(r, op.type).toMatchObject({ voixRefaite: false, payant: false, caracteresARelire: 0 });
      expect(CATALOGUE_RETOUCHES[op.type].payant).toBe(false);
    }
  });

  it("la fiche de départ n'est jamais modifiée en place", () => {
    const f = copie(F);
    const avant = JSON.stringify(f);
    apercuRetouche(f, { type: "modifierTexteDit", sceneId: "s03", texte: "Geste deux : demandez trois idées de publication à partir de la question." }, CTX);
    apercuRetouche(f, { type: "deplacerScene", sceneId: "s03", vers: "page-precedente" }, CTX);
    expect(JSON.stringify(f)).toBe(avant);
  });
});
