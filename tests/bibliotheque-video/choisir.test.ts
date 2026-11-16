import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { choisir } from "@/briques/bibliotheque-video/choisir";
import { graineDe, rangGraine } from "@/briques/bibliotheque-video/graine";
import type { Candidat, IdCapacite, ProfilVideo } from "@/briques/bibliotheque-video/types";

const A = "texte.pave" as IdCapacite;
const B = "texte.pastille-axion" as IdCapacite;
const profil = (o: Partial<ProfilVideo> = {}): ProfilVideo => ({
  id: "p", formatId: "f", version: 1,
  capacites: { [A]: { permis: true }, [B]: { permis: true } },
  plafonds: {}, memoire: { fenetreVideos: 5, portee: "format" }, verrous: [], ...o,
});
const cands = (n: number, cap = A): Candidat[] => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, capacite: cap, cle: `k${i}` }));
const cles = (r: ReturnType<typeof choisir>) => (r.ok ? r.choisis.map((c) => c.cle) : []);

describe("graine", () => {
  it("stable et distincte", () => {
    expect(graineDe("a", "b")).toBe(graineDe("a", "b"));
    expect(graineDe("a", "b")).not.toBe(graineDe("b", "a"));
    expect(rangGraine("g", "x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("choisir (C1-U4)", () => {
  it("déterminisme, graine, ordre des candidats", () => {
    const c = cands(20);
    const ref = choisir(profil(), { capacite: A, nombre: 5, graine: "g1" }, c, [], []);
    for (let i = 0; i < 10; i++) expect(choisir(profil(), { capacite: A, nombre: 5, graine: "g1" }, c, [], [])).toEqual(ref);
    const autres = ["g2", "g3", "g4", "g5"].map((g) => cles(choisir(profil(), { capacite: A, nombre: 5, graine: g }, c, [], [])));
    expect(autres.some((x) => JSON.stringify(x) !== JSON.stringify(cles(ref)))).toBe(true);
    expect(choisir(profil(), { capacite: A, nombre: 5, graine: "g1" }, [...c].reverse(), [], [])).toEqual(ref);
  });

  it("filtre 1 : absente, permis false, verrou capacité ou famille", () => {
    const c = cands(3);
    const raison = (p: ProfilVideo) => { const r = choisir(p, { capacite: A, graine: "g" }, c, [], []); return r.ok ? "ok" : r.raison; };
    expect(raison(profil({ capacites: {} }))).toBe("capacite-non-permise");
    expect(raison(profil({ capacites: { [A]: { permis: false } } }))).toBe("capacite-non-permise");
    expect(raison(profil({ verrous: ["texte"] }))).toBe("capacite-non-permise");
    expect(raison(profil({ verrous: [A] }))).toBe("capacite-non-permise");
    const r = choisir(profil({ capacites: {} }), { capacite: A, graine: "g" }, c, [], []);
    expect(!r.ok && r.phrase.length > 0).toBe(true);
  });

  it("filtre 2 corrigé : autre capacité, absente ou non permise jamais choisie", () => {
    const autre = "ecran.clip-v4" as IdCapacite;
    const mix = [...cands(3, B), { id: "z", capacite: autre, cle: "z" }, { id: "y", capacite: A, cle: "y" }];
    const r = choisir(profil({ capacites: { [A]: { permis: true }, [B]: { permis: false } } }), { capacite: A, nombre: 9, graine: "g" }, mix, [], []);
    expect(cles(r)).toEqual(["y"]);
    expect(choisir(profil(), { capacite: A, graine: "g" }, mix.filter((m) => m.capacite !== A), [], []).ok).toBe(false);
  });

  it("plafond", () => {
    const p = profil({ capacites: { [A]: { permis: true, maxParVideo: 1 } } });
    const r = choisir(p, { capacite: A, graine: "g" }, cands(3), [], [{ capacite: A, cle: "zz" }]);
    expect(!r.ok && r.raison).toBe("plafond-atteint");
    const p2 = profil({ capacites: { [A]: { permis: true, maxParVideo: 2 } } });
    expect(cles(choisir(p2, { capacite: A, nombre: 3, graine: "g" }, cands(5), [], []))).toHaveLength(2);
    // un déjà-choisi d'une autre capacité ne compte pas ; une clé déjà choisie est écartée
    const r3 = choisir(p2, { capacite: A, nombre: 5, graine: "g" }, cands(3), [], [{ capacite: B, cle: "k0" }, { capacite: A, cle: "k1" }]);
    expect(r3.ok && r3.choisis).toHaveLength(1);
    expect(cles(r3)).not.toContain("k1");
  });

  it("anti-répétition et repli", () => {
    const c = cands(3);
    const h = [{ capacite: A, cle: "k0", videoId: "v" }, { capacite: A, cle: "k1", videoId: "v" }];
    const r = choisir(profil(), { capacite: A, graine: "g" }, c, h, []);
    expect(cles(r)).toEqual(["k2"]);
    expect(r.ok && r.repli).toBeUndefined();
    const tous = [...h, { capacite: A, cle: "k2", videoId: "v" }]; // k2 le moins récent
    const rr = choisir(profil(), { capacite: A, graine: "g" }, c, tous, []);
    expect(cles(rr)).toEqual(["k2"]);
    expect(rr.ok && rr.repli).toBe(true);
  });

  it("liste vide ou candidat mal formé : sans exception", () => {
    const r = choisir(profil(), { capacite: A, graine: "g" }, [], [], []);
    expect(!r.ok && r.raison).toBe("aucun-candidat");
    const mal = [{ id: "x", capacite: A } as unknown as Candidat, null as unknown as Candidat, ...cands(1)];
    expect(cles(choisir(profil(), { capacite: A, graine: "g" }, mal, [], []))).toEqual(["k0"]);
    expect(() => choisir(null as unknown as ProfilVideo, { capacite: A, graine: "g" }, [], [], [])).not.toThrow();
  });

  it("pureté : entrées figées", () => {
    const gel = <T,>(x: T): T => Object.freeze(x);
    const c = gel(cands(4).map(gel));
    const h = gel([gel({ capacite: A, cle: "k0", videoId: "v" })]);
    const p = gel(profil());
    expect(() => choisir(p, { capacite: A, graine: "g" }, c, h, gel([]))).not.toThrow();
    expect(c).toHaveLength(4);
  });
});

describe("garde statique", () => {
  for (const f of ["choisir", "graine", "lecteur"]) {
    it(`${f}.ts : aucun import interdit ni horloge`, () => {
      const src = readFileSync(join(__dirname, "..", "..", `src/briques/bibliotheque-video/${f}.ts`), "utf8");
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code).not.toMatch(/@\/services\//);
      expect(code).not.toMatch(/studio-rendu/);
      expect(code).not.toMatch(/credits|budget-mensuel|mode-budget|autonomie-usine|couts|cle-depense-usine|depense-claude|generation-claude|image-video/);
      expect(code).not.toMatch(/Date\.now|new Date\(|Math\.random/);
    });
  }
});
