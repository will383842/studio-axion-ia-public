/**
 * R2 · La carte s'auto-répare : une carte incohérente ne bloque jamais la vidéo. Un cas par impasse, l'idempotence, et
 * la règle de fer : aucun texte ni chiffre inventé (seuls des blocs, flèches, groupes ou types sont corrigés).
 * Les blocs sans flèche rangés dans une branche relèvent de `reparerOrphelinsDeBranche` (appelé après), pas d'ici.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completerCarte, controlerCarte, type CarteImage } from "@/domaine/image-video/carte";
import { reparerCarte } from "@/domaine/image-video/reparation";
import { etatInitialIV, validerCarteIV } from "@/moteurs/montage-image-video/fabrication";
import { demandeEssai } from "./doubles-fabrication";

const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(__dirname, "fixtures", "cartes", `${nom}.json`), "utf8"));
const C = lire("C");
const D = lire("D");
const noeud = (id: string, libelle: string, ordre: number, plus: Record<string, unknown> = {}) => ({ id, libelle, role: "etape" as const, couleur: "noir" as const, acteur: "auto" as const, ordre, ...plus });
const lien = (id: string, de: string, vers: string, plus: Record<string, unknown> = {}) => ({ id, de, vers, couleur: "noir" as const, style: "plein" as const, ...plus });

/** Chaîne simple a → b → c, sans chiffre. */
function chaine(plus: Partial<CarteImage> = {}): CarteImage {
  return completerCarte({
    ...C,
    noeuds: [noeud("a", "Le client écrit", 1), noeud("b", "L'IA classe", 2), noeud("c", "Vous répondez", 3)],
    liens: [lien("l1", "a", "b"), lien("l2", "b", "c")],
    groupes: [],
    bandeau: [],
    pied: [],
    formulesAbsolues: [],
    ...plus,
  });
}
const textes = (c: CarteImage) => JSON.stringify([c.titre, c.phraseChoc, c.noeuds.map((n) => [n.libelle, n.detail]), c.liens.map((l) => l.etiquette), c.bandeau]);

describe("réparation de la carte", () => {
  it("ne touche pas une carte saine", () => {
    for (const k of ["A", "B", "C", "D", "E", "F"]) {
      const r = reparerCarte(lire(k));
      expect(r.reparations).toEqual([]);
      expect(r.carte).toEqual(lire(k));
    }
  });

  it("fusionne un bloc décrit deux fois (le premier gagne, les champs manquants sont repris)", () => {
    const base = chaine();
    const carte = { ...base, noeuds: [...base.noeuds, noeud("b", "Autre texte", 9, { detail: "Un détail" })] };
    expect(controlerCarte(carte).ok).toBe(false);
    const r = reparerCarte(carte);
    expect(r.reparations.map((x) => x.code)).toEqual(["bloc-en-double"]);
    expect(r.carte.noeuds.filter((n) => n.id === "b")).toHaveLength(1);
    expect(r.carte.noeuds.find((n) => n.id === "b")).toMatchObject({ libelle: "L'IA classe", detail: "Un détail", ordre: 2 });
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("fusion d'un bloc double : le libellé écarté est cité", () => {
    const base = chaine();
    const r = reparerCarte({ ...base, noeuds: [...base.noeuds, noeud("b", "Autre texte", 9)] });
    expect(r.reparations[0]!.detail).toContain("« Autre texte »");
  });

  it("jette une flèche en double exacte (mêmes extrémités)", () => {
    const base = chaine();
    const r = reparerCarte({ ...base, liens: [...base.liens, lien("l1", "a", "b")] });
    expect(r.reparations.map((x) => x.code)).toEqual(["fleche-en-double"]);
    expect(r.carte.liens).toHaveLength(2);
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("renomme (et garde) une flèche de même identifiant mais d'autres extrémités : aucun bloc isolé", () => {
    const base = chaine();
    const carte = { ...base, noeuds: [...base.noeuds, noeud("d", "Un suivi", 4)], liens: [...base.liens, lien("l1", "c", "d")] };
    const r = reparerCarte(carte);
    expect(r.reparations.map((x) => x.code)).toEqual(["fleche-renommee"]);
    expect(r.carte.liens.map((l) => l.id)).toEqual(["l1", "l2", "l1-2"]);
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("flèche vers un bloc absent qui laisse un bloc sans flèche : la phrase le dit", () => {
    const base = chaine();
    const carte = { ...base, noeuds: [...base.noeuds, noeud("d", "Un suivi", 4)], liens: [...base.liens, lien("l9", "d", "fantome")] };
    const r = reparerCarte(carte);
    expect(r.reparations[0]!.detail).toContain("Le bloc d n'est plus relié à rien.");
  });

  it("retire une flèche qui pointe vers un bloc absent", () => {
    const base = chaine();
    const r = reparerCarte({ ...base, liens: [...base.liens, lien("l9", "c", "fantome")] });
    expect(r.reparations.map((x) => x.code)).toEqual(["fleche-vers-bloc-absent"]);
    expect(r.carte.liens.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("retire d'un groupe le bloc absent, supprime le groupe vidé et l'appartenance à un groupe absent", () => {
    const base = chaine();
    const carte = {
      ...base,
      noeuds: base.noeuds.map((n) => (n.id === "a" ? { ...n, groupe: "gx" } : n)),
      groupes: [
        { id: "g1", sorte: "colonne" as const, noeuds: ["b", "fantome"] },
        { id: "g2", sorte: "colonne" as const, noeuds: ["fantome"] },
      ],
    };
    const r = reparerCarte(carte);
    expect(r.carte.groupes).toEqual([{ id: "g1", sorte: "colonne", noeuds: ["b"] }]);
    expect(r.carte.noeuds.find((n) => n.id === "a")?.groupe).toBeUndefined();
    expect(r.reparations.map((x) => x.code).sort()).toEqual(["groupe-sans-bloc", "groupe-vers-bloc-absent", "groupe-vers-bloc-absent", "bloc-vers-groupe-absent"].sort());
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("casse l'arête la plus faible quand le schéma tourne en rond plus d'une fois", () => {
    const base = chaine();
    // Deux retours : c→a (étiquetée, plus forte) et c→b (pointillée, sans étiquette : la plus faible).
    const carte = { ...base, liens: [...base.liens, lien("r1", "c", "a", { etiquette: "On recommence" }), lien("r2", "c", "b", { style: "pointille" as const })] };
    expect(controlerCarte(carte).erreurs).toContain("Le schéma tourne en rond plus d'une fois.");
    const r = reparerCarte(carte);
    expect(r.reparations.map((x) => x.code)).toEqual(["cycle-casse"]);
    expect(r.carte.liens.map((l) => l.id).sort()).toEqual(["l1", "l2", "r1"]);
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("cycle : ne retire pas la flèche qui isolerait un bloc ; une flèche étiquetée seulement en dernier recours (étiquette citée)", () => {
    const base = chaine();
    // d n'est relié que par c→d (hors cycle) : jamais candidate. r2 (sans étiquette) part avant r1 (étiquetée).
    const carte = { ...base, noeuds: [...base.noeuds, noeud("d", "Un suivi", 4)], liens: [...base.liens, lien("l3", "c", "d"), lien("r1", "c", "a", { etiquette: "On recommence" }), lien("r2", "c", "b")] };
    const r = reparerCarte(carte);
    expect(r.reparations).toHaveLength(1);
    expect(r.carte.liens.map((l) => l.id)).toEqual(["l1", "l2", "l3", "r1"]);
    expect(controlerCarte(r.carte).ok).toBe(true);
    // Seules des flèches étiquetées peuvent casser le cycle : l'étiquette retirée est citée.
    const seule = { ...base, liens: [lien("l1", "a", "b", { etiquette: "Début" }), lien("l2", "b", "c", { etiquette: "Suite" }), lien("r1", "c", "a", { etiquette: "On recommence" }), lien("r2", "c", "b", { etiquette: "Encore" })] };
    const r2 = reparerCarte(seule);
    expect(r2.reparations[0]!.detail).toMatch(/« (Début|Suite|On recommence|Encore) »/);
    expect(controlerCarte(r2.carte).erreurs).toEqual([]);
  });

  it("cycle : une flèche hors de tout cycle n'est jamais retirée", () => {
    const base = chaine();
    const carte = { ...base, liens: [...base.liens, lien("r1", "c", "a"), lien("r2", "c", "b")] };
    const r = reparerCarte(carte);
    expect(r.carte.liens.map((l) => l.id)).toContain("l1");
    expect(r.carte.liens.map((l) => l.id)).toContain("l2");
  });

  it("casse aussi un bloc relié à lui-même quand il y a déjà un cycle", () => {
    const base = chaine();
    const r = reparerCarte({ ...base, liens: [...base.liens, lien("r1", "c", "a"), lien("s1", "b", "b")] });
    expect(r.reparations.length).toBeGreaterThan(0);
    expect(r.reparations.every((x) => x.code === "cycle-casse")).toBe(true);
    expect(controlerCarte(r.carte).erreurs).toEqual([]);
  });

  it("rabat un embranchement sans bifurcation sur un type sûr", () => {
    const carte = { ...chaine(), types: ["embranchement"] as CarteImage["types"] };
    expect(controlerCarte(carte).ok).toBe(false);
    const r = reparerCarte(carte);
    expect(r.reparations.map((x) => x.code)).toEqual(["type-rabattu"]);
    expect(r.carte.types).toEqual(["chaine"]);
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("rabat un avant / après sans ses deux groupes", () => {
    const carte = { ...chaine(), types: ["avant-apres"] as CarteImage["types"] };
    const r = reparerCarte(carte);
    expect(r.carte.types).toEqual(["chaine"]);
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("entonnoir sans sorties chiffrées : le type est rabattu, le nombre d'objets et tous les textes sont gardés", () => {
    const carte = completerCarte({
      ...C,
      noeuds: [noeud("e", "Les e-mails reçus", 1, { quantite: 20 }), noeud("f", "L'IA trie", 2), noeud("s1", "Répondu", 3), noeud("s2", "Pour vous", 4)],
      liens: [lien("l1", "e", "f"), lien("l2", "f", "s1"), lien("l3", "f", "s2")],
      groupes: [],
      bandeau: [],
      pied: [],
      formulesAbsolues: [],
    });
    const fort = { ...carte, types: ["entonnoir"] as CarteImage["types"] };
    expect(controlerCarte(fort).ok).toBe(false);
    const r = reparerCarte(fort);
    expect(r.reparations.map((x) => x.code)).toEqual(["type-rabattu"]);
    expect(r.carte.types[0]).not.toBe("entonnoir");
    expect(r.carte.noeuds.find((n) => n.id === "e")?.quantite).toBe(20);
    expect(r.reparations[0]!.detail).toContain("ne correspond pas au schéma : remplacé par");
    expect(textes(r.carte)).toBe(textes(fort));
    expect(controlerCarte(r.carte).ok).toBe(true);
    // Un entonnoir complet (fixture D) reste entier.
    expect(reparerCarte(D).carte.types).toEqual(D.types);
  });

  it("recalcule la liste des chiffres devenue fausse après une réparation, sans en inventer", () => {
    const base = completerCarte({
      ...C,
      noeuds: [noeud("a", "Le client écrit", 1), noeud("b", "L'IA classe", 2)],
      liens: [lien("l1", "a", "b"), lien("l9", "b", "fantome", { etiquette: "80 %", part: 80 })],
      groupes: [],
      bandeau: ["12 min gagnées"],
      pied: [],
      formulesAbsolues: [],
    });
    expect(base.chiffres.some((c) => c.dansLien === "l9")).toBe(true);
    const r = reparerCarte(base);
    expect(r.carte.chiffres.some((c) => c.dansLien === "l9")).toBe(false);
    expect(r.carte.chiffres.some((c) => c.brut.includes("80"))).toBe(false);
    expect(r.carte.chiffres.map((c) => c.brut)).toEqual(base.chiffres.filter((c) => c.dansLien !== "l9").map((c) => c.brut));
    expect(controlerCarte(r.carte).ok).toBe(true);
  });

  it("garde les phrases affirmatives du texte", () => {
    const base = chaine({ phraseChoc: "0 question sans réponse" });
    const r = reparerCarte({ ...base, liens: [...base.liens, lien("l9", "c", "fantome")] });
    expect(r.carte.phraseChoc).toBe("0 question sans réponse");
  });

  it("ne change JAMAIS l'offre ni l'automatisation quand le type est rabattu", () => {
    for (const [offre, automatisation] of [["formation", false], ["formation", true], ["integration", false], ["integration", true]] as const) {
      const carte = { ...chaine(), types: ["embranchement"] as CarteImage["types"], offre, automatisation };
      const r = reparerCarte(carte);
      expect(r.carte.offre).toBe(offre);
      expect(r.carte.automatisation).toBe(automatisation);
    }
  });

  it("type choisi par Will : la phrase le dit", () => {
    const carte = { ...chaine(), types: ["embranchement"] as CarteImage["types"] };
    expect(reparerCarte(carte, { typeChoisi: true }).reparations[0]!.detail).toBe("Le type que vous avez choisi (embranchement) ne correspond pas au schéma : remplacé par chaine.");
  });

  it("un lien déduit ne satisfait pas l'exigence du type (même règle que controlerCarte)", () => {
    const base = chaine();
    const carte = { ...base, types: ["embranchement"] as CarteImage["types"], liens: [...base.liens, lien("d-a-c", "a", "c", { deduit: true })] };
    expect(controlerCarte(carte).erreurs.join(" ")).toContain("embranchement");
    expect(reparerCarte(carte).carte.types).toEqual(["chaine"]);
  });

  it("est idempotente et ne modifie pas son entrée", () => {
    const base = chaine();
    const abime = {
      ...base,
      types: ["embranchement"] as CarteImage["types"],
      noeuds: [...base.noeuds, noeud("b", "Autre", 9)],
      liens: [...base.liens, lien("l1", "c", "a"), lien("l9", "c", "fantome"), lien("r1", "c", "a"), lien("r2", "c", "b")],
      groupes: [{ id: "g", sorte: "colonne" as const, noeuds: ["a", "fantome"] }],
    };
    const copie = structuredClone(abime);
    const une = reparerCarte(abime);
    expect(abime).toEqual(copie);
    expect(controlerCarte(une.carte).ok).toBe(true);
    const deux = reparerCarte(une.carte);
    expect(deux.carte).toEqual(une.carte);
    expect(deux.reparations).toEqual([]);
  });
});

describe("validerCarteIV avec une carte abîmée", () => {
  it("la carte est réparée seule, validée, et les réparations sont dites", () => {
    const base = chaine();
    const abime: CarteImage = { ...base, liens: [...base.liens, lien("l9", "c", "fantome"), lien("r1", "c", "a"), lien("r2", "c", "b")] };
    const e = etatInitialIV(demandeEssai(base));
    e.etape = "carte-a-valider";
    e.propositionCarte = { carte: base, controle: controlerCarte(base), doutes: [], empreinte: "prop-1" };
    const apres = validerCarteIV(e, { proposition: "prop-1", carte: abime, le: "2026-10-25T08:00:00.000Z" });
    expect(apres.etape).toBe("ecriture");
    expect(apres.carte!.carte.liens.map((l) => l.id).sort()).toEqual(["l1", "l2", "r2"]);
    expect(apres.journal.some((j) => j.includes("réparée"))).toBe(true);
    expect(apres.carte!.carte.adaptations?.some((a) => a.startsWith("Adapté automatiquement : "))).toBe(true);
  });
});
