/**
 * R3 · Analyste de réalisme : un cas par problème, idempotence, aucun chiffre inventé, ton intact, garde « additionneur ».
 * Tout est figé : fixtures et cartes construites à la main, aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completerCarte, type BrouillonCarte, type CarteImage, type NoeudCarte } from "@/domaine/image-video/carte";
import { sceneApresGarde } from "@/domaine/image-video/analyste/garde-additionneur";
import { analyserRealisme, appliquerOperations, calculsFauxDeTexte } from "@/domaine/image-video/analyste/realisme";

const lireFixture = (l: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), `tests/image-video/fixtures/cartes/${l}.json`), "utf8"));
const base = lireFixture("C");

const noeud = (id: string, libelle: string, ordre: number, extra: Partial<NoeudCarte> = {}): NoeudCarte => ({ id, libelle, role: "etape", couleur: "neutre", acteur: "auto", ordre, ...extra });
const lien = (id: string, de: string, vers: string, extra: Record<string, unknown> = {}) => ({ id, de, vers, couleur: "neutre" as const, style: "plein" as const, ...extra });

function carte(p: { noeuds: NoeudCarte[]; liens: ReturnType<typeof lien>[]; groupes?: CarteImage["groupes"]; bandeau?: string[]; titre?: string }): CarteImage {
  const brouillon = {
    ...base,
    titre: p.titre ?? "Un schéma",
    phraseChoc: "0 question sans réponse",
    noeuds: p.noeuds,
    liens: p.liens,
    groupes: p.groupes ?? [],
    bandeau: p.bandeau ?? [],
    pied: [],
    lecture: { ecarts: [], alertes: [] },
    validation: undefined,
  } as unknown as BrouillonCarte;
  return completerCarte({ ...brouillon, types: undefined, chiffres: undefined } as BrouillonCarte);
}

const codes = (c: CarteImage) => analyserRealisme(c).problemes.map((p) => p.code);
const corriger = (c: CarteImage) => appliquerOperations(c, analyserRealisme(c).operationsProposees);
const chaine3 = () => [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Milieu", 2), noeud("c", "Fin", 3, { role: "resultat" })];

describe("cartes de référence : rien de bloquant inventé", () => {
  for (const l of ["A", "B", "C", "D", "E", "F"]) {
    it(`carte ${l}`, () => {
      expect(analyserRealisme(lireFixture(l)).problemes.filter((p) => p.gravite === "bloquant").map((p) => p.code)).toEqual([]);
    });
  }
});

describe("calcul faux affiché", () => {
  it("15 + 4 = 20 : le total devient 19, avec trace, le reste du texte est intact", () => {
    const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Saisie", 2, { detail: "15 min + 4 min = 20 min perdues" }), noeud("c", "Fin", 3, { role: "resultat" })], liens: [lien("l1", "a", "b"), lien("l2", "b", "c")] });
    expect(analyserRealisme(c).problemes).toEqual([{ code: "calcul-faux", blocs: ["b"], gravite: "bloquant" }]);
    const apres = corriger(c);
    expect(apres.noeuds.find((n) => n.id === "b")!.detail).toBe("15 min + 4 min = 19 min perdues");
    expect(apres.lecture.alertes.join(" ")).toContain("15 min + 4 min = 19 min");
    expect(codes(apres)).toEqual([]);
  });

  it("un produit faux est recalculé, un calcul juste n'est pas touché", () => {
    expect(calculsFauxDeTexte("3 × 4 = 13")[0]).toMatchObject({ corrige: "3 × 4 = 12", nouveau: 12 });
    expect(calculsFauxDeTexte("8 + 6 + 5 = 19")).toEqual([]);
    expect(calculsFauxDeTexte("19 × 20 = 6 h 20 ≠ 6 h")).toEqual([]);
  });

  it("ne bouge pas les égalités d'unités différentes, sans unité, ou suivies d'un autre mot", () => {
    for (const t of ["1 h + 30 min = 90 min", "45 sec + 15 sec = 1 min", "2 h + 30 min = 2,5 h", "1 + 1 = 3", "3 outils + 1 IA = 1 seul flux", "8 + 6 + 5 = 20"]) expect(calculsFauxDeTexte(t), t).toEqual([]);
    expect(calculsFauxDeTexte("8 min + 6 min = 14 min")).toEqual([]);
  });

  it("lit toutes les égalités d'un texte", () => {
    expect(calculsFauxDeTexte("2 min + 2 min = 5 min puis 3 € + 3 € = 7 €").map((f) => f.nouveau)).toEqual([4, 6]);
  });

  it("somme d'un groupe (8 + 6 + 5 ≠ 20) : le résultat et le bandeau suivent la vraie somme", () => {
    const c = carte({
      noeuds: [noeud("a", "CRM", 1, { detail: "8 min" }), noeud("b", "Compta", 2, { detail: "6 min" }), noeud("c", "Stock", 3, { detail: "5 min" }), noeud("d", "Total", 4, { role: "resultat", detail: "20 min" })],
      liens: [lien("l1", "a", "b"), lien("l2", "b", "c"), lien("l3", "c", "d")],
      groupes: [{ id: "g1", sorte: "colonne", noeuds: ["a", "b", "c", "d"] }],
      bandeau: ["20 min perdues"],
    });
    expect(codes(c)).toContain("calcul-faux");
    const apres = corriger(c);
    expect(apres.noeuds.find((n) => n.id === "d")!.detail).toBe("19 min");
    expect(apres.bandeau).toEqual(["19 min perdues"]);
    expect(codes(apres)).toEqual([]);
  });

  it("quantités : 15 + 4 ≠ 20, la quantité d'entrée devient 19 (somme des sorties présentes)", () => {
    const c = carte({
      noeuds: [noeud("a", "20 demandes", 1, { role: "declencheur", quantite: 20 }), noeud("b", "Filtre", 2, { role: "decision" }), noeud("c", "Traitées", 3, { quantite: 15 }), noeud("d", "Écartées", 4, { quantite: 4 })],
      liens: [lien("l1", "a", "b"), lien("l2", "b", "c"), lien("l3", "b", "d")],
    });
    expect(codes(c)).toContain("calcul-faux");
    const apres = corriger(c);
    expect(apres.noeuds.find((n) => n.id === "a")!.quantite).toBe(19);
    expect(apres.noeuds.find((n) => n.id === "a")!.libelle).toBe("19 demandes");
    expect(codes(apres)).not.toContain("calcul-faux");
  });
});

describe("quantités : quelle entrée compter", () => {
  const entonnoir = (qa: number | undefined, qb: number | undefined, extraLiens: ReturnType<typeof lien>[] = [], extraNoeuds: NoeudCarte[] = []) =>
    carte({
      noeuds: [noeud("a", "Entrée", 1, { role: "declencheur", ...(qa ? { quantite: qa } : {}) }), noeud("b", "Filtre", 2, { role: "decision", ...(qb ? { quantite: qb } : {}) }), noeud("c", "Gardées", 3, { quantite: 6 }), noeud("d", "Écartées", 4, { quantite: 4 }), ...extraNoeuds],
      liens: [lien("l1", "a", "b"), lien("l2", "b", "c"), lien("l3", "b", "d"), ...extraLiens],
    });

  it("20 -> 10 -> 6 + 4 est juste : la quantité du nœud prime sur celle de son prédécesseur", () => {
    expect(codes(entonnoir(20, 10))).not.toContain("calcul-faux");
  });
  it("un seul prédécesseur chiffré compte si le nœud n'a pas de quantité", () => {
    expect(codes(entonnoir(20, undefined))).toContain("calcul-faux");
  });
  it("plusieurs prédécesseurs : rien n'est signalé", () => {
    expect(codes(entonnoir(20, undefined, [lien("l4", "e", "b")], [noeud("e", "Autre entrée", 5, { quantite: 30 })]))).not.toContain("calcul-faux");
  });
  it("un total hors 1-99 est retiré, pas recalculé", () => {
    const c = carte({
      noeuds: [noeud("a", "Entrée", 1, { role: "declencheur", quantite: 20 }), noeud("c", "Gardées", 3, { quantite: 80 }), noeud("d", "Écartées", 4, { quantite: 40 })],
      liens: [lien("l2", "a", "c"), lien("l3", "a", "d")],
    });
    expect(codes(c)).toContain("calcul-faux");
    expect(corriger(c).noeuds.find((n) => n.id === "a")!.quantite).toBeUndefined();
  });
});

describe("flux sans entrée ni sortie", () => {
  it("un bloc relié à rien est relié à son voisin dans l'ordre de lecture", () => {
    const c = carte({ noeuds: [...chaine3(), noeud("z", "Perdu", 4)], liens: [lien("l1", "a", "b"), lien("l2", "b", "c")] });
    expect(analyserRealisme(c).problemes).toEqual([{ code: "noeud-sans-lien", blocs: ["z"], gravite: "bloquant" }]);
    const apres = corriger(c);
    expect(apres.liens.some((l) => l.vers === "z")).toBe(true);
    expect(codes(apres)).toEqual([]);
  });
});

describe("boucle sans condition de sortie", () => {
  it("la boucle est reliée à un bloc de sortie qui n'avait aucune entrée", () => {
    const c = carte({ noeuds: [noeud("a", "Relire", 1), noeud("b", "Corriger", 2), noeud("s", "Livré", 3, { role: "sortie" })], liens: [lien("l1", "a", "b"), lien("l2", "b", "a")] });
    expect(codes(c)).toContain("boucle-sans-sortie");
    const apres = corriger(c);
    expect(apres.liens.some((l) => l.de === "b" && l.vers === "s")).toBe(true);
    expect(codes(apres)).toEqual([]);
  });

  it("un cycle sans bloc de sortie (PDCA, cercle vertueux) est laissé intact", () => {
    const c = carte({ noeuds: [noeud("a", "Planifier", 1), noeud("b", "Faire", 2), noeud("c", "Vérifier", 3), noeud("d", "Agir", 4)], liens: [lien("l1", "a", "b"), lien("l2", "b", "c"), lien("l3", "c", "d"), lien("l4", "d", "a")] });
    expect(codes(c)).not.toContain("boucle-sans-sortie");
    expect(corriger(c).liens.map((l) => l.id)).toEqual(["l1", "l2", "l3", "l4"]);
  });

  it("une boucle qui a une sortie n'est pas signalée", () => {
    const c = carte({ noeuds: [noeud("a", "Relire", 1), noeud("b", "Corriger", 2, { role: "decision" }), noeud("s", "Livré", 3, { role: "sortie" })], liens: [lien("l1", "a", "b"), lien("l2", "b", "a"), lien("l3", "b", "s")] });
    expect(codes(c)).not.toContain("boucle-sans-sortie");
  });
});

describe("étape irréaliste", () => {
  it("un délai de plus d'un an et un pourcentage au-dessus de 100 sont retirés, rien n'est mis à la place", () => {
    const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Réponse sous 900000 min garantie", 2), noeud("c", "Satisfaction 150 % des clients", 3, { role: "resultat" })], liens: [lien("l1", "a", "b"), lien("l2", "b", "c")] });
    expect(analyserRealisme(c).problemes.filter((p) => p.code === "chiffre-absurde").map((p) => p.blocs[0]).sort()).toEqual(["b", "c"]);
    const apres = corriger(c);
    expect(apres.noeuds.find((n) => n.id === "b")!.libelle).toBe("Réponse sous garantie");
    expect(apres.noeuds.find((n) => n.id === "c")!.libelle).toBe("Satisfaction des clients");
    expect(codes(apres)).toEqual([]);
  });

  it("un texte qui finirait sur une préposition n'est pas retouché : simple avertissement", () => {
    const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Réponse en 900000 min", 2)], liens: [lien("l1", "a", "b")] });
    expect(codes(c)).toEqual(["chiffre-absurde"]);
    expect(analyserRealisme(c).operationsProposees).toEqual([]);
  });

  it("des durées ou pourcentages légitimes ne sont pas absurdes", () => {
    for (const t of ["Jusqu'à 900000 min gagnées par an", "ROI de 250 % sur 3 ans", "Marge de 300 %", "Objectif 400 % du plan", "Croissance + 150 %", "Cumul de 900000 min économisées"]) {
      const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", t, 2)], liens: [lien("l1", "a", "b")] });
      expect(codes(c), t).toEqual([]);
    }
  });

  it("deux chiffres absurdes dans un même texte : un seul passage les retire tous, et c'est idempotent", () => {
    const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Réponse sous 900000 min et satisfaction 150 % des clients", 2)], liens: [lien("l1", "a", "b")] });
    const ops = analyserRealisme(c).operationsProposees;
    const une = appliquerOperations(c, ops);
    expect(une.noeuds.find((n) => n.id === "b")!.libelle).toBe("Réponse sous et satisfaction des clients");
    expect(appliquerOperations(une, ops)).toEqual(une);
    expect(codes(une)).toEqual([]);
  });

  it("une hausse « +150 % » est réaliste", () => {
    const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Ventes +150 %", 2)], liens: [lien("l1", "a", "b")] });
    expect(codes(c)).toEqual([]);
  });

  it("des parts qui font 90 % retirent les parts et leurs étiquettes, sans renormalisation inventée", () => {
    const c = carte({
      noeuds: [noeud("a", "Tri", 1, { role: "decision" }), noeud("b", "Oui", 2), noeud("c", "Non", 3)],
      liens: [lien("l1", "a", "b", { part: 60, etiquette: "60 % — connu" }), lien("l2", "a", "c", { part: 30, etiquette: "30 % — inconnu" })],
    });
    expect(codes(c)).toContain("parts-incorrectes");
    const apres = corriger(c);
    expect(apres.liens.every((l) => l.part === undefined)).toBe(true);
    expect(apres.liens.map((l) => l.etiquette)).toEqual(["connu", "inconnu"]);
    expect(codes(apres)).not.toContain("parts-incorrectes");
  });
});

describe("entonnoir dont les étapes augmentent", () => {
  const c = {
    ...carte({
      noeuds: [noeud("a", "Prospects", 1, { role: "declencheur", quantite: 10 }), noeud("b", "Rendez-vous", 2, { quantite: 40 }), noeud("c", "Clients", 3, { role: "resultat", quantite: 5 })],
      liens: [lien("l1", "a", "b"), lien("l2", "b", "c")],
    }),
    types: ["entonnoir"],
  } as unknown as CarteImage;

  it("est signalé (bloquant) mais jamais réparé : aucune opération", () => {
    expect(analyserRealisme(c).problemes).toEqual([{ code: "entonnoir-croissant", blocs: ["a", "b"], gravite: "bloquant" }]);
    expect(analyserRealisme(c).operationsProposees).toEqual([]);
  });
  it("la garde écarte la scène entonnoir", () => {
    expect(sceneApresGarde("entonnoir", c)).toBe("toile");
  });
});

describe("ordre ambigu", () => {
  it("deux blocs au même rang reçoivent des rangs distincts, l'ordre relatif est gardé", () => {
    const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Milieu", 1), noeud("c", "Fin", 2, { role: "resultat" })], liens: [lien("l1", "a", "b"), lien("l2", "b", "c")] });
    expect(codes(c)).toEqual(["ordre-ambigu"]);
    expect(corriger(c).noeuds.map((n) => [n.id, n.ordre])).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  });
});

describe("garanties communes", () => {
  const fautives = (): CarteImage[] => [
    carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Saisie", 2, { detail: "15 min + 4 min = 20 min" }), noeud("z", "Perdu", 3)], liens: [lien("l1", "a", "b")] }),
    carte({ noeuds: [noeud("a", "Relire", 1), noeud("b", "Corriger", 2), noeud("s", "Livré", 3, { role: "sortie" })], liens: [lien("l1", "a", "b"), lien("l2", "b", "a")] }),
    carte({ noeuds: [noeud("a", "Tri", 1, { role: "decision" }), noeud("b", "Oui", 2), noeud("c", "Non", 3)], liens: [lien("l1", "a", "b", { part: 70, etiquette: "70 % — connu" }), lien("l2", "a", "c", { part: 40, etiquette: "40 % — inconnu" })] }),
  ];

  it("idempotent : appliquer deux fois donne la même carte, et la carte corrigée n'a plus rien à corriger", () => {
    for (const c of fautives()) {
      const ops = analyserRealisme(c).operationsProposees;
      expect(ops.length).toBeGreaterThan(0);
      const une = appliquerOperations(c, ops);
      expect(appliquerOperations(une, ops)).toEqual(une);
      expect(analyserRealisme(une).operationsProposees).toEqual([]);
    }
  });

  it("pur : la carte d'entrée n'est jamais modifiée, deux analyses donnent le même rapport", () => {
    for (const c of fautives()) {
      const copie = structuredClone(c);
      const r = analyserRealisme(c);
      appliquerOperations(c, r.operationsProposees);
      expect(c).toEqual(copie);
      expect(analyserRealisme(c)).toEqual(r);
    }
  });

  it("aucun chiffre inventé : tout nombre d'une carte corrigée existait ou est la somme des termes écrits", () => {
    const c = fautives()[0];
    const apres = corriger(c);
    const nombres = (x: CarteImage) => JSON.stringify([x.titre, x.noeuds.map((n) => [n.libelle, n.detail])]).match(/\d+/g) ?? [];
    const autorises = new Set([...nombres(c), "19"]);
    for (const n of nombres(apres)) expect(autorises.has(n), n).toBe(true);
  });

  it("le ton est intact : phrase-choc, signature et titre restent identiques", () => {
    for (const c of fautives()) {
      const apres = corriger(c);
      expect(apres.phraseChoc).toBe("0 question sans réponse");
      expect(apres.signature).toBe(c.signature);
      expect(apres.titre).toBe(c.titre);
    }
  });

  it("une opération « reformuler » qui changerait un mot est refusée, un simple nombre passe", () => {
    const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Réponse en 4 sec", 2)], liens: [lien("l1", "a", "b")] });
    const ou = { genre: "noeud", id: "b", champ: "libelle" } as const;
    const mot = appliquerOperations(c, [{ op: "reformuler", ou, avant: "Réponse en 4 sec", apres: "Réponse en 5 secondes", trace: "x" }]);
    expect(mot.noeuds.find((n) => n.id === "b")!.libelle).toBe("Réponse en 4 sec");
    const nombre = appliquerOperations(c, [{ op: "reformuler", ou, avant: "Réponse en 4 sec", apres: "Réponse en 5 sec", trace: "y" }]);
    expect(nombre.noeuds.find((n) => n.id === "b")!.libelle).toBe("Réponse en 5 sec");
  });

  it("un total qu'on ne sait pas recalculer peut être retiré (nouveau: null) sans chiffre de remplacement", () => {
    const c = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur", quantite: 20 }), noeud("b", "Fin", 2)], liens: [lien("l1", "a", "b")] });
    const apres = appliquerOperations(c, [{ op: "corrigerTotal", quantite: { noeud: "a", valeur: null }, ancien: 20, nouveau: null, trace: "total retiré" }]);
    expect(apres.noeuds[0].quantite).toBeUndefined();
  });
});

describe("garde aval « additionneur »", () => {
  const fausse = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Total", 2, { detail: "8 min + 6 min + 5 min = 20 min" })], liens: [lien("l1", "a", "b")] });
  const juste = carte({ noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Total", 2, { detail: "8 min + 6 min + 5 min = 19 min" })], liens: [lien("l1", "a", "b")] });

  it("un calcul faux ne finit jamais en scène additionneur", () => {
    expect(sceneApresGarde("additionneur", fausse)).toBe("toile");
    expect(sceneApresGarde("additionneur", null, ["Trois fois la même chose.", "8 min + 6 min + 5 min = 20 min"])).toBe("toile");
  });
  it("un calcul juste garde l'additionneur, les autres scènes ne bougent pas", () => {
    expect(sceneApresGarde("additionneur", juste)).toBe("additionneur");
    expect(sceneApresGarde("entonnoir", fausse)).toBe("entonnoir");
  });
  it("appliquerOperations ne lève jamais : une opération qui casse la carte rend la carte d'origine avec une alerte", () => {
    const base3 = carte({ noeuds: chaine3(), liens: [lien("l1", "a", "b"), lien("l2", "b", "c")] });
    const r = appliquerOperations(base3, [{ op: "relier", id: "ID INVALIDE", de: "a", vers: "c", trace: "x" }]);
    expect(r.liens).toEqual(base3.liens);
    expect(r.lecture.alertes.join(" ")).toContain("non appliquées");
    expect(() => appliquerOperations(base3, [{ op: "corrigerTotal", quantite: { noeud: "zz", valeur: 5 }, ancien: 1, nouveau: 5, trace: "x" }])).not.toThrow();
  });
  it("la carte corrigée repasse la garde", () => {
    expect(sceneApresGarde("additionneur", corriger(fausse))).toBe("additionneur");
  });
});
