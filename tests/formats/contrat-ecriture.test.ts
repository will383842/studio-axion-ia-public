/** C1.6 : un format ne peut pas être « actif » sans recette commune, mémoire, contrôles et débit mesuré (sauf exception datée). */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listerFormats } from "@/formats";
import {
  CONTRATS_ECRITURE,
  EXCEPTIONS_ECRITURE,
  FORMATS_HORS_CONTRAT,
  PORTEE_CONTRAT,
  PREUVES_CONTRAT,
  verifierContratEcriture,
  verifierPreuvesContrat,
} from "@/domaine/ecriture-commune/contrat-format";

/** Date injectée : jamais l'horloge réelle (le test ne doit pas devenir instable). */
const AUJOURDHUI = "2026-10-19";
const lireRepo = (chemin: string): string | null => (existsSync(join(process.cwd(), chemin)) ? readFileSync(join(process.cwd(), chemin), "utf8") : null);

const complet = { recetteCommune: true, memoire: true, controles: true, debitMesure: true };

describe("verifierContratEcriture (fonction pure)", () => {
  it("refuse un format actif sans contrat ni exception", () => {
    const v = verifierContratEcriture([{ id: "neuf", statut: "actif" }], {}, []);
    expect(v).toEqual([expect.objectContaining({ formatId: "neuf", manque: ["recetteCommune", "memoire", "controles", "debitMesure"] })]);
  });
  it("nomme exactement ce qui manque", () => {
    const v = verifierContratEcriture([{ id: "neuf", statut: "actif" }], { neuf: { ...complet, memoire: false, debitMesure: false } }, []);
    expect(v[0].manque).toEqual(["memoire", "debitMesure"]);
  });
  it("accepte un contrat complet", () => {
    expect(verifierContratEcriture([{ id: "neuf", statut: "actif" }], { neuf: complet }, [])).toEqual([]);
  });
  it("ne demande rien à un format masqué ou « bientôt »", () => {
    expect(verifierContratEcriture([{ id: "a", statut: "masque" }, { id: "b", statut: "bientot" }], {}, [])).toEqual([]);
  });
  it("traite un format masqué mais ouvert dans la navigation comme actif", () => {
    const v = verifierContratEcriture([{ id: "ouvert", statut: "masque", ouvertDansLaNavigation: true }], {}, []);
    expect(v).toEqual([expect.objectContaining({ formatId: "ouvert" })]);
    expect(verifierContratEcriture([{ id: "ferme", statut: "masque", ouvertDansLaNavigation: false }], {}, [])).toEqual([]);
  });
  it("accepte une exception datée, refuse une exception sans date valide", () => {
    const ok = [{ formatId: "ancien", depuis: "2026-10-18", raison: "format antérieur au lot C1" }];
    expect(verifierContratEcriture([{ id: "ancien", statut: "actif" }], {}, ok)).toEqual([]);
    const mal = [{ formatId: "ancien", depuis: "bientôt", raison: "x" }];
    expect(verifierContratEcriture([{ id: "ancien", statut: "actif" }], {}, mal)).toHaveLength(1);
  });
  it("ignore l'avocat : exclu du contrat, jamais exigé ni excepté", () => {
    expect(verifierContratEcriture([{ id: "avocat", statut: "actif" }], {}, [])).toEqual([]);
  });
});

describe("verifierContratEcriture : format partiel", () => {
  it("un contrat partiel passe seulement si l'exception couvre exactement ce qui manque", () => {
    const formats = [{ id: "p", statut: "actif" }];
    const c = { p: { recetteCommune: true, memoire: true, controles: true, debitMesure: false } };
    const base = { formatId: "p", depuis: "2026-10-18", jusquAu: "2026-12-31", levee: "mesurer le débit", raison: "débit non mesuré" };
    expect(verifierContratEcriture(formats, c, [], { aujourdhui: AUJOURDHUI })[0].manque).toEqual(["debitMesure"]);
    expect(verifierContratEcriture(formats, c, [{ ...base, pieces: ["debitMesure"] }], { aujourdhui: AUJOURDHUI })).toEqual([]);
    expect(verifierContratEcriture(formats, c, [{ ...base, pieces: ["memoire"] }], { aujourdhui: AUJOURDHUI })).toHaveLength(1);
  });
});

describe("verifierPreuvesContrat (règle d'entrée)", () => {
  const complet4 = { recetteCommune: true, memoire: true, controles: true, debitMesure: true };
  const preuves = {
    neuf: {
      recetteCommune: { module: "a.ts", symbole: "RECETTE" },
      memoire: { module: "b.ts" },
      controles: { module: "c.ts" },
      debitMesure: { module: "d.md" },
    },
  };
  const fichiers: Record<string, string> = { "a.ts": "export const RECETTE = 1;", "b.ts": "x", "c.ts": "x", "d.md": "x" };
  const lire = (c: string): string | null => fichiers[c] ?? null;

  it("un format fictif sans contrat ni exception échoue", () => {
    expect(verifierContratEcriture([{ id: "neuf", statut: "actif" }], {}, [], { aujourdhui: AUJOURDHUI })).toHaveLength(1);
  });
  it("un format avec contrat complet et preuves existantes passe", () => {
    expect(verifierContratEcriture([{ id: "neuf", statut: "actif" }], { neuf: complet4 }, [], { aujourdhui: AUJOURDHUI })).toEqual([]);
    expect(verifierPreuvesContrat({ neuf: complet4 }, preuves, lire)).toEqual([]);
  });
  it("un contrat qui pointe un module absent échoue", () => {
    const v = verifierPreuvesContrat({ neuf: complet4 }, preuves, (c) => (c === "b.ts" ? null : lire(c)));
    expect(v).toEqual([expect.objectContaining({ formatId: "neuf", piece: "memoire" })]);
  });
  it("un contrat qui pointe une constante absente du module échoue", () => {
    const v = verifierPreuvesContrat({ neuf: complet4 }, preuves, (c) => (c === "a.ts" ? "const RECETTE = 1;" : lire(c)));
    expect(v).toEqual([expect.objectContaining({ piece: "recetteCommune" })]);
  });
  it("mutation : un contrat dont le module écrivain n'importe pas le symbole échoue", () => {
    const avec = { neuf: { ...preuves.neuf, recetteCommune: { module: "a.ts", symbole: "RECETTE", utilisePar: "w.ts" } } };
    const f = (w: string) => (c: string): string | null => (c === "w.ts" ? w : lire(c));
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('import { RECETTE } from "./a";'))).toEqual([]);
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('const x = "RECETTE";'))).toEqual([expect.objectContaining({ piece: "recetteCommune" })]);
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, () => null)).not.toEqual([]);
  });
  it("mutation : l'écrivain importe un AUTRE symbole du même module => échec", () => {
    const avec = { neuf: { ...preuves.neuf, recetteCommune: { module: "a.ts", symbole: "RECETTE", utilisePar: "w.ts" } } };
    const f = (w: string) => (c: string): string | null => (c === "w.ts" ? w : lire(c));
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('import { AUTRE } from "./a";'))).toEqual([expect.objectContaining({ piece: "recetteCommune" })]);
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('const { AUTRE } = await import("./a");'))).toEqual([expect.objectContaining({ piece: "recetteCommune" })]);
  });
  it("mutation : symbole homonyme importé d'un AUTRE module => échec", () => {
    const avec = { neuf: { ...preuves.neuf, recetteCommune: { module: "a.ts", symbole: "RECETTE", utilisePar: "w.ts" } } };
    const f = (w: string) => (c: string): string | null => (c === "w.ts" ? w : lire(c));
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('import { RECETTE } from "./ailleurs";'))).toEqual([expect.objectContaining({ piece: "recetteCommune" })]);
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('import { RECETTE } from "./a";\n'))).toEqual([]);
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('const { RECETTE } = await import("./a");'))).toEqual([]);
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('const r = (await import("./a")).RECETTE;'))).toEqual([]);
  });
  it("sans symbole importé, l'import du module de la preuve suffit (statique ou dynamique)", () => {
    const avec = { neuf: { ...preuves.neuf, memoire: { module: "b.ts", symbole: undefined, utilisePar: "w.ts" } } };
    const f = (w: string) => (c: string): string | null => (c === "w.ts" ? w : lire(c));
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('const m = await import("./b");'))).toEqual([]);
    expect(verifierPreuvesContrat({ neuf: complet4 }, avec, f('import { y } from "./autre";'))).toHaveLength(1);
  });
  it("une pièce déclarée sans aucune preuve échoue", () => {
    const v = verifierPreuvesContrat({ neuf: complet4 }, { neuf: { memoire: { module: "b.ts" } } }, lire);
    expect(v.map((x) => x.piece).sort()).toEqual(["controles", "debitMesure", "recetteCommune"]);
  });
});

describe("recevabilité des dates d'exception (par la fonction elle-même)", () => {
  const formats = [{ id: "ancien", statut: "actif" }];
  const base = { formatId: "ancien", jusquAu: "2026-12-31", levee: "brancher la recette", raison: "format antérieur au lot C1" };
  it("un `depuis` dans le futur est refusé", () => {
    const ex = [{ ...base, depuis: "2026-11-01" }];
    expect(verifierContratEcriture(formats, {}, ex, { aujourdhui: AUJOURDHUI })).toHaveLength(1);
    expect(verifierContratEcriture(formats, {}, ex, { aujourdhui: "2026-11-01" })).toEqual([]);
  });
  it("un `depuis` postérieur à `jusquAu` est refusé", () => {
    const ex = [{ ...base, depuis: "2027-01-05", jusquAu: "2026-12-31" }];
    expect(verifierContratEcriture(formats, {}, ex, { aujourdhui: "2027-01-06" })).toHaveLength(1);
    expect(verifierContratEcriture(formats, {}, ex)).toHaveLength(1);
  });
});

describe("registre réel", () => {
  const formats = listerFormats({ inclureMasques: true }).map((f) => ({ id: f.id, statut: f.statut, ouvertDansLaNavigation: f.ouvertDansLaNavigation }));
  it("tous les formats actifs sont en règle", () => {
    expect(verifierContratEcriture(formats, CONTRATS_ECRITURE, EXCEPTIONS_ECRITURE, { aujourdhui: AUJOURDHUI, portees: PORTEE_CONTRAT })).toEqual([]);
  });
  it("les exceptions sont datées et visent exactement facecam (2 : débit + périmètre), tableau-anime, cas-concret, facecam-animee, image-video", () => {
    expect(EXCEPTIONS_ECRITURE.map((e) => e.formatId).sort()).toEqual(["cas-concret", "facecam", "facecam", "facecam-animee", "image-video", "tableau-anime"]);
    for (const e of EXCEPTIONS_ECRITURE) {
      expect(e.depuis).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.raison.length).toBeGreaterThan(10);
    }
  });
  it("chaque exception a une date de fin et une condition de levage", () => {
    for (const e of EXCEPTIONS_ECRITURE) {
      expect(e.jusquAu, e.formatId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.jusquAu! > e.depuis, e.formatId).toBe(true);
      expect((e.levee ?? "").length, e.formatId).toBeGreaterThan(10);
    }
  });
  it("une exception dépassée fait échouer la règle (date injectée)", () => {
    const formats = [{ id: "ancien", statut: "actif" }];
    const ex = [{ formatId: "ancien", depuis: "2026-10-18", jusquAu: "2026-12-31", levee: "brancher la recette", raison: "format antérieur au lot C1" }];
    expect(verifierContratEcriture(formats, {}, ex, { aujourdhui: "2026-12-31" })).toEqual([]);
    const v = verifierContratEcriture(formats, {}, ex, { aujourdhui: "2027-01-01" });
    expect(v).toEqual([expect.objectContaining({ formatId: "ancien" })]);
    expect(v[0].message).toContain("2026-12-31");
  });
  it("les exceptions réelles ne sont pas échues à la date injectée, et le seraient après leur fin", () => {
    const formats = listerFormats({ inclureMasques: true }).map((f) => ({ id: f.id, statut: f.statut, ouvertDansLaNavigation: f.ouvertDansLaNavigation }));
    expect(verifierContratEcriture(formats, CONTRATS_ECRITURE, EXCEPTIONS_ECRITURE, { aujourdhui: AUJOURDHUI, portees: PORTEE_CONTRAT })).toEqual([]);
    const fin = EXCEPTIONS_ECRITURE.map((e) => e.jusquAu!).sort().at(-1)!;
    const apres = new Date(Date.parse(fin) + 86_400_000).toISOString().slice(0, 10);
    expect(verifierContratEcriture(formats, CONTRATS_ECRITURE, EXCEPTIONS_ECRITURE, { aujourdhui: apres, portees: PORTEE_CONTRAT }).length).toBeGreaterThan(0);
  });
  it("tableau, cas concret et face caméra ont un contrat réel ; image-video et face caméra animée n'en ont pas", () => {
    expect(Object.keys(CONTRATS_ECRITURE).sort()).toEqual(["cas-concret", "facecam", "tableau-anime"]);
    expect(CONTRATS_ECRITURE["facecam"]).toMatchObject({ recetteCommune: true, memoire: true, controles: true });
    expect(CONTRATS_ECRITURE["tableau-anime"]).toMatchObject({ recetteCommune: true, memoire: true, controles: true });
    expect(CONTRATS_ECRITURE["cas-concret"]).toMatchObject({ memoire: true, controles: true });
  });
  it("une exception d'un format sous contrat ne couvre que ce qui manque réellement", () => {
    for (const e of EXCEPTIONS_ECRITURE.filter((x) => CONTRATS_ECRITURE[x.formatId] && !x.perimetre)) {
      const manque = Object.entries(CONTRATS_ECRITURE[e.formatId]).filter(([, v]) => !v).map(([k]) => k).sort();
      expect([...(e.pieces ?? [])].sort(), e.formatId).toEqual(manque);
    }
  });
  it("les preuves du registre réel pointent des modules et constantes qui existent", () => {
    expect(verifierPreuvesContrat(CONTRATS_ECRITURE, PREUVES_CONTRAT, lireRepo)).toEqual([]);
  });
  it("face caméra : contrat « chaîne courte seulement », exception à périmètre grande + equipe, sans laquelle la règle échoue", () => {
    expect(PORTEE_CONTRAT["facecam"]).toBe("chaîne courte seulement");
    const sans = EXCEPTIONS_ECRITURE.filter((e) => !(e.formatId === "facecam" && e.perimetre));
    const v = verifierContratEcriture(formats, CONTRATS_ECRITURE, sans, { aujourdhui: AUJOURDHUI, portees: PORTEE_CONTRAT });
    expect(v).toEqual([expect.objectContaining({ formatId: "facecam", manque: ["recetteCommune", "memoire", "controles"] })]);
    const e = EXCEPTIONS_ECRITURE.find((x) => x.formatId === "facecam" && x.perimetre)!;
    expect(e.perimetre).toMatch(/grande/);
    expect(e.perimetre).toMatch(/equipe/);
    expect(e.jusquAu).toBe("2026-12-31");
    expect(e.levee).toContain("brancher recette, mémoire et ressemblance sur la grande chaîne et sur equipe, ou retirer ces deux chaînes");
  });
  it("l'exception à périmètre de face caméra échue fait échouer la règle", () => {
    const v = verifierContratEcriture(formats, CONTRATS_ECRITURE, EXCEPTIONS_ECRITURE, { aujourdhui: "2027-01-01", portees: PORTEE_CONTRAT });
    expect(v.some((x) => x.formatId === "facecam" && x.message.includes("périmètre"))).toBe(true);
  });
  it("un contrat déclaré pour un format absent du registre est refusé", () => {
    const v = verifierContratEcriture(formats, { ...CONTRATS_ECRITURE, fantome: complet }, EXCEPTIONS_ECRITURE, { aujourdhui: AUJOURDHUI, portees: PORTEE_CONTRAT });
    expect(v).toEqual([expect.objectContaining({ formatId: "fantome", manque: [] })]);
  });
  it("chaque preuve du registre réel nomme le module écrivain du format", () => {
    for (const [id, pieces] of Object.entries(PREUVES_CONTRAT)) for (const [piece, p] of Object.entries(pieces)) expect(p?.utilisePar, `${id}.${piece}`).toBeTruthy();
  });
  it("l'avocat est hors contrat et n'a pas d'exception", () => {
    expect(FORMATS_HORS_CONTRAT).toContain("avocat");
    expect(EXCEPTIONS_ECRITURE.some((e) => e.formatId === "avocat")).toBe(false);
  });
  it("une exception ne couvre qu'un format qui existe", () => {
    const ids = new Set(formats.map((f) => f.id));
    for (const e of EXCEPTIONS_ECRITURE) expect(ids.has(e.formatId)).toBe(true);
  });
});
