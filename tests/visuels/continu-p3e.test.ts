import { describe, expect, it } from "vitest";
import { GABARITS, GABARITS_PRODUCTION } from "../../src/briques/visuels/continu/registre-gabarits";
import { premierChiffre } from "../../src/domaine/controles-visuel/texte";
import { COMPOSANTS_PLAQUETTES } from "../../studio-rendu/compositions/visuels/continu/registre-composants";

const TYPES = ["D01", "D02", "D03"] as const;
const def = (t: string) => GABARITS.find((g) => g.type === t)!;
const exemple = (t: string) => def(t).exemple as Record<string, unknown>;

/** Table attendue, d'après la maquette v3 : `dk:1` → sombre, `or:1` → orangeFort. */
const ATTENDU: Record<string, { nom: string; sombre: boolean; orangeFort: boolean; actif: boolean; exigeFait?: true; exigeAccord?: true }> = {
  D01: { nom: "Grand chiffre", sombre: false, orangeFort: false, actif: false, exigeFait: true },
  D02: { nom: "Citation", sombre: false, orangeFort: false, actif: false, exigeAccord: true },
  D03: { nom: "Trois barres", sombre: false, orangeFort: false, actif: true },
};

/** Champs texte (chaînes) de l'exemple, parcourus à plat. */
function textesDe(valeur: unknown, chemin = ""): [string, string][] {
  if (typeof valeur === "string") return [[chemin, valeur]];
  if (Array.isArray(valeur)) return valeur.flatMap((v, i) => textesDe(v, `${chemin}[${i}]`));
  if (valeur && typeof valeur === "object") return Object.entries(valeur).flatMap(([k, v]) => textesDe(v, chemin ? `${chemin}.${k}` : k));
  return [];
}

describe("continu P3e : registre des données et citations", () => {
  it("D01, D02 et D03 sont déclarés dans la famille « donnees »", () => {
    for (const t of TYPES) {
      expect(def(t), t).toBeDefined();
      expect(def(t).famille).toBe("donnees");
      expect(def(t).nom).toBe(ATTENDU[t].nom);
    }
  });
  it("sombre, orangeFort, actif, exigeFait et exigeAccord sont conformes à la maquette", () => {
    for (const t of TYPES) {
      const a = ATTENDU[t];
      expect(def(t).sombre, t).toBe(a.sombre);
      expect(def(t).orangeFort, t).toBe(a.orangeFort);
      expect(def(t).actif, t).toBe(a.actif);
      expect(def(t).exigeFait, t).toBe(a.exigeFait);
      expect(def(t).exigeAccord, t).toBe(a.exigeAccord);
    }
  });
  it("version >= 1 et bords libres déclarés", () => {
    for (const t of TYPES) {
      expect(def(t).version, t).toBeGreaterThanOrEqual(1);
      expect(def(t).bordsLibres.gauche.length, t).toBeGreaterThan(0);
      expect(def(t).bordsLibres.droite.length, t).toBeGreaterThan(0);
    }
  });
  it("D01 et D02 sont hors de GABARITS_PRODUCTION, D03 dedans", () => {
    const prod = GABARITS_PRODUCTION.map((g) => g.type);
    expect(prod).not.toContain("D01");
    expect(prod).not.toContain("D02");
    expect(prod).toContain("D03");
  });
  it("le composant de chaque type est déclaré dans le registre des composants", () => {
    for (const t of TYPES) expect(typeof COMPOSANTS_PLAQUETTES[t], t).toBe("function");
  });
});

describe("continu P3e : schémas stricts et budgets", () => {
  it("chaque exemple passe son schéma, et une clé inconnue (étiquette) est refusée", () => {
    for (const t of TYPES) {
      expect(def(t).schema.safeParse(exemple(t)).success, t).toBe(true);
      expect(def(t).schema.safeParse({ ...exemple(t), etiquette: "Exemple illustratif" }).success, t).toBe(false);
    }
  });
  it("un texte au budget + 1 échoue, au budget passe (tout champ texte libre de l'exemple)", () => {
    for (const t of TYPES) {
      const base = exemple(t);
      for (const [cle, valeur] of Object.entries(base)) {
        if (typeof valeur !== "string" || ["type", "faitId"].includes(cle)) continue;
        const max = (def(t).schema.shape as Record<string, { maxLength?: number | null }>)[cle]?.maxLength;
        if (!max || max > 400) continue;
        expect(def(t).schema.safeParse({ ...base, [cle]: "a".repeat(max) }).success, `${t}.${cle} au budget`).toBe(true);
        expect(def(t).schema.safeParse({ ...base, [cle]: "a".repeat(max + 1) }).success, `${t}.${cle} au budget + 1`).toBe(false);
      }
    }
  });
  it("D01 : faitId au format F000, source et date obligatoires", () => {
    const b = exemple("D01");
    expect(def("D01").schema.safeParse({ ...b, faitId: "F012" }).success).toBe(true);
    for (const mauvais of ["", "f012", "F12", "F0123", "X012"]) expect(def("D01").schema.safeParse({ ...b, faitId: mauvais }).success, mauvais).toBe(false);
    for (const cle of ["faitId", "source", "date"]) {
      const { [cle]: _retire, ...sans } = b;
      expect(def("D01").schema.safeParse(sans).success, cle).toBe(false);
    }
  });
  it("D03 : la variante choisit l'un des 3 profils, aucune autre valeur", () => {
    const b = exemple("D03");
    const profils = ["descendant", "montant", "pic"];
    for (const v of profils) expect(def("D03").schema.safeParse({ ...b, variante: v }).success, v).toBe(true);
    expect(def("D03").schema.safeParse({ ...b, variante: "plat" }).success).toBe(false);
  });
  it("D03 : aucune chaîne d'exemple ne contient de chiffre", () => {
    for (const [cle, texte] of textesDe(exemple("D03"))) {
      if (cle === "type" || cle === "variante") continue;
      expect(premierChiffre(texte), `${cle} : ${texte}`).toBeUndefined();
    }
  });
  it("D03 : refuse un libellé de barre contenant un chiffre ou un nombre de barres différent de 3", () => {
    const b = exemple("D03") as { libelles: string[] };
    expect(def("D03").schema.safeParse({ ...b, libelles: [...b.libelles.slice(0, 2)] }).success).toBe(false);
    expect(def("D03").schema.safeParse({ ...b, libelles: [...b.libelles, "Plus"] }).success).toBe(false);
    expect(def("D03").schema.safeParse({ ...b, libelles: ["Saisie", "Relances", "Métier 2"] }).success).toBe(false);
    expect(def("D03").schema.safeParse({ ...b, titre: "Où part 40 %" }).success).toBe(false);
  });
});
