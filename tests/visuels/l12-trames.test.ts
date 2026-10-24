/** L12 : trois trames par intention (éveil, méthode, preuve). Le moteur choisit l'enchaînement des pages selon l'intention ; sans intention, rien ne change. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import { PAGES, TYPES_COUVERTURE, TYPES_PAGE, type TypePage } from "@/briques/visuels/registre-pages";
import { consigneTrame, ecartsTrame, estIntention, INTENTIONS, TRAMES, typesDeLaTrame, TYPES_DENSES } from "@/briques/visuels/trames";
import { noterCarrousel } from "@/domaine/controles-visuel/note";
import { controlerCarrousel } from "@/domaine/controles-visuel/porte";
import { interditsDans, interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import type { ContextePorte, DemandeTexteCarrousel } from "@/domaine/visuels/contrats";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import { creerDepuisSujet, refaire, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { creerDepuisFormulaire } from "@/visuels/services/creation";
import { CONSIGNE_API, consigneApi, creerFournisseurApi } from "@/visuels/texte/api";
import { FIXTURES_AXION } from "@/visuels/texte/fixtures";
import { FIXTURES_TRAMES } from "@/visuels/texte/fixtures-trames";
import { creerFournisseurSimulation } from "@/visuels/texte/simulation";

const ctxProduction: ContextePorte = {
  faitsDisponibles: false,
  interditsDans: (t) => [...new Set([...interditsDans(t, "ecrire").map((i) => i.libelle), ...interditsTousEcrivains(t)])],
};
const famille = (t: string) => PAGES[t as TypePage].famille;

describe("données des trames", () => {
  it("trois intentions, chacune avec sa trame", () => {
    expect([...INTENTIONS]).toEqual(["eveil", "methode", "preuve"]);
    for (const i of INTENTIONS) expect(TRAMES[i].intention).toBe(i);
    expect(estIntention("eveil")).toBe(true);
    expect(estIntention("autre")).toBe(false);
    expect(estIntention(undefined)).toBe(false);
  });

  it("chaque trame, résolue sur le registre actuel, a de 6 à 10 pages et respecte la variété", () => {
    for (const i of INTENTIONS) {
      const types = typesDeLaTrame(i);
      expect(types.length, i).toBeGreaterThanOrEqual(6);
      expect(types.length, i).toBeLessThanOrEqual(10);
      expect((TYPES_COUVERTURE as readonly string[]).includes(types[0]), i).toBe(true);
      expect(types.at(-1), i).toBe("T21");
      expect(types.filter((t) => t === "T21"), i).toHaveLength(1);
      for (const t of types) expect((TYPES_PAGE as readonly string[]).includes(t), `${i} ${t}`).toBe(true);
      for (let k = 1; k < types.length; k++) expect(famille(types[k]), `${i} pages ${k}-${k + 1}`).not.toBe(famille(types[k - 1]));
      expect(new Set(types).size, i).toBeGreaterThanOrEqual(types.length >= 8 ? 5 : 4);
      for (let k = 2; k < types.length; k++) expect([types[k - 2], types[k - 1], types[k]].every((t) => TYPES_DENSES.has(t)), `${i} pages ${k - 1}-${k + 1}`).toBe(false);
      expect(ecartsTrame(types), i).toEqual([]);
    }
  });

  it("les enchaînements suivent l'intention", () => {
    expect(typesDeLaTrame("eveil")).toEqual(expect.arrayContaining(["T22", "T23"]));
    expect(typesDeLaTrame("methode")).toEqual(expect.arrayContaining(["T02", "T20", "T27", "T28"]));
    expect(typesDeLaTrame("preuve")).toEqual(expect.arrayContaining(["T26", "T24", "T28"]));
    const preuve = typesDeLaTrame("preuve");
    expect(preuve.indexOf("T26")).toBeLessThan(preuve.indexOf("T24"));
  });

  it("T29 « relance » est facultative : absente du registre, elle est retirée de la trame", () => {
    for (const i of INTENTIONS) {
      const relance = TRAMES[i].etapes.find((e) => e.type === "T29");
      expect(relance?.facultatif, i).toBe(true);
      if (!(TYPES_PAGE as readonly string[]).includes("T29")) expect(typesDeLaTrame(i), i).not.toContain("T29");
    }
  });

  it("ecartsTrame signale une suite de même famille, trop peu de types, trois pages denses de suite, une page sombre mal placée", () => {
    expect(ecartsTrame(["T01", "T22", "T24", "T10", "T06", "T21"]).join(" ")).toMatch(/famille/u);
    expect(ecartsTrame(["T01", "T06", "T10", "T06", "T10", "T06", "T10", "T21"]).join(" ")).toMatch(/types/u);
    expect(ecartsTrame(["T01", "T02", "T20", "T27", "T10", "T21"]).join(" ")).toMatch(/denses/u);
    expect(ecartsTrame(["T01", "T06", "T21", "T10", "T22", "T23"]).join(" ")).toMatch(/sombre/u);
    // Règle de la note : la page sombre (T21) ferme le carrousel, jamais en page 2.
    expect(ecartsTrame(["T01", "T21", "T06", "T10", "T22", "T23"]).join(" ")).toMatch(/sombre/u);
  });
});

describe("consignes de plan et d'écriture", () => {
  it("chaque consigne de trame donne l'enchaînement exact des pages et la cible", () => {
    for (const i of INTENTIONS) {
      const c = consigneTrame(i);
      const ordre = typesDeLaTrame(i).map((t) => c.indexOf(`${t} :`));
      expect(ordre.every((n) => n >= 0), i).toBe(true);
      expect([...ordre].sort((a, b) => a - b), i).toEqual(ordre);
      expect(c, i).toContain(TRAMES[i].nom);
      expect(c, i).toMatch(/TPE et PME/u);
      expect(c, i).not.toMatch(/J['’]aide|Aucun gain garanti|%/iu);
    }
  });

  it("la consigne de l'API ajoute la trame seulement avec une intention", async () => {
    expect(consigneApi()).toBe(CONSIGNE_API);
    expect(consigneApi("preuve")).toContain(CONSIGNE_API);
    expect(consigneApi("preuve")).toContain(consigneTrame("preuve"));
  });

  it("la consigne de session documente les trois trames avec les mêmes enchaînements", () => {
    const md = readFileSync(join(process.cwd(), "scripts/visuels/consigne-session-carrousel.md"), "utf8");
    for (const i of INTENTIONS) {
      const ligne = md.split("\n").find((l) => l.startsWith(`| \`${i}\` |`));
      expect(ligne, i).toBeDefined();
      const suite = TRAMES[i].etapes.map((e) => (e.facultatif ? `(${e.type})` : e.type)).join(" → ");
      expect(ligne, i).toContain(suite);
    }
  });
});

describe("contenus d'essai par trame", () => {
  it("suivent leur trame, passent la porte en vert et la note sans bloquant de variété", () => {
    for (const i of INTENTIONS) {
      const f = FIXTURES_TRAMES[i];
      expect(f.spec.pages.map((p) => p.type), i).toEqual(typesDeLaTrame(i));
      expect(CarrouselSpec.safeParse(f.spec).success, i).toBe(true);
      expect(f.pourquoi, i).toHaveLength(f.spec.pages.length);
      const { rapport } = controlerCarrousel(f.spec, ctxProduction);
      expect(rapport.controles, i).toEqual([]);
      expect(rapport.verdict, i).toBe("vert");
      const note = noterCarrousel(f.spec);
      expect(note.bloquants, i).toEqual([]);
      expect(note.criteres.find((c) => c.nom === "Diversité")?.niveau, i).toBe("vert");
      expect(JSON.stringify(f.spec), i).not.toMatch(/J['’]aide|Aucun gain garanti|%/iu);
    }
  });
});

describe("choix de la trame par l'intention", () => {
  const f = creerFournisseurSimulation();
  const SUJETS = ["Se lancer dans l'IA", "Gagner du temps au bureau", "Répondre plus vite aux clients", "Mieux préparer ses devis"];

  it("avec une intention, la simulation suit la trame de cette intention", async () => {
    for (const i of INTENTIONS) {
      for (const sujet of SUJETS) {
        const r = await f.ecrire({ type: "sujet", sujet, intention: i });
        expect((r.spec as CarrouselSpecType).pages.map((p) => p.type), `${i} ${sujet}`).toEqual(typesDeLaTrame(i));
        expect(CarrouselSpec.safeParse(r.spec).success).toBe(true);
      }
    }
  });

  it("avec une intention, « Refaire » (version 2) change le texte sans changer la trame", async () => {
    for (const i of INTENTIONS) {
      for (const sujet of SUJETS) {
        const v1 = await f.ecrire({ type: "sujet", sujet, intention: i, version: 1 });
        const v2 = await f.ecrire({ type: "sujet", sujet, intention: i, version: 2 });
        expect((v2.spec as CarrouselSpecType).pages.map((p) => p.type), `${i} ${sujet}`).toEqual(typesDeLaTrame(i));
        expect(CarrouselSpec.safeParse(v2.spec).success).toBe(true);
        expect(JSON.stringify(v2.spec), `${i} ${sujet}`).not.toBe(JSON.stringify(v1.spec));
        expect(await f.ecrire({ type: "sujet", sujet, intention: i, version: 2 })).toEqual(v2);
      }
    }
  });

  it("sans intention, la sortie est identique à aujourd'hui (modèles Axion, même choix)", async () => {
    const ids = new Set(FIXTURES_AXION.map((x) => JSON.stringify(x.pourquoi)));
    for (const sujet of SUJETS) {
      for (const version of [1, 2, 3]) {
        const sans = await f.ecrire({ type: "sujet", sujet, version });
        const vide = await f.ecrire({ type: "sujet", sujet, version, intention: undefined });
        expect(vide).toEqual(sans);
        expect(ids.has(JSON.stringify(sans.pourquoi)), sujet).toBe(true);
      }
    }
  });

  it("le fournisseur API reste verrouillé, intention ou non", async () => {
    const appeler = vi.fn(async () => "{}");
    const api = creerFournisseurApi({ appeler });
    await expect(api.ecrire({ type: "sujet", sujet: "Un sujet", intention: "methode" })).rejects.toMatchObject({ code: "API_PAYANTE_VERROUILLEE" });
    expect(appeler).toHaveBeenCalledTimes(0);
  });
});

function monter() {
  const depot = new DepotMemoire<Visuel>();
  const demandes: DemandeTexteCarrousel[] = [];
  const spec = FIXTURES_TRAMES.eveil.spec;
  // Porte rouge : le brouillon est « bloqué », donc « Refaire » est permis.
  const rapport = { version: "porte-carrousel/1" as const, verdict: "rouge" as const, controles: [{ code: "C1", niveau: "rouge" as const, phrase: "Contrôle inventé" }], corrections: [] };
  let chaine: Promise<unknown> = Promise.resolve();
  const deps: DependancesCarrousels = {
    depot,
    texte: () => ({ mode: "simulation", ecrire: async (d: DemandeTexteCarrousel) => (demandes.push(d), { titre: "Titre", spec, pourquoi: [...FIXTURES_TRAMES.eveil.pourquoi], mode: "simulation" as const }) }),
    porte: () => ({ rapport }),
    contextePorte: async () => ({ interditsDans: () => [], faitsDisponibles: false }),
    allume: async () => true,
    rendre: async () => {
      throw new Error("non utilisé");
    },
    urlLecture: async (cle) => `https://stockage.invente/${cle}`,
    verrou: (fn) => {
      const suite = chaine.then(fn, fn);
      chaine = suite.catch(() => undefined);
      return suite;
    },
    maintenant: () => "2026-10-19T10:00:00.000Z",
    lireParametre: async <T,>(_id: string, defaut: T) => defaut,
    ecrireParametre: async () => undefined,
  };
  return { deps, depot, demandes };
}

describe("service : l'intention suit le carrousel", () => {
  it("creerDepuisSujet transmet l'intention et la garde pour « Refaire »", async () => {
    const m = monter();
    const { id } = await creerDepuisSujet("Se lancer dans l'IA", m.deps, "preuve");
    expect(m.demandes[0]).toEqual({ type: "sujet", sujet: "Se lancer dans l'IA", intention: "preuve" });
    expect((await m.depot.obtenir(id))?.entree).toEqual({ type: "sujet", sujet: "Se lancer dans l'IA", intention: "preuve" });
    await refaire(id, m.deps);
    expect(m.demandes[1]).toEqual({ type: "sujet", sujet: "Se lancer dans l'IA", intention: "preuve", version: 2 });
  });

  it("sans intention, la demande et l'entrée restent celles d'aujourd'hui", async () => {
    const m = monter();
    const { id } = await creerDepuisSujet("Se lancer dans l'IA", m.deps);
    expect(m.demandes[0]).toEqual({ type: "sujet", sujet: "Se lancer dans l'IA" });
    expect((await m.depot.obtenir(id))?.entree).toEqual({ type: "sujet", sujet: "Se lancer dans l'IA" });
    await refaire(id, m.deps);
    expect(m.demandes[1]).toEqual({ type: "sujet", sujet: "Se lancer dans l'IA", version: 2 });
  });

  it("le formulaire lit un champ « intention » facultatif ; une valeur inconnue est ignorée", async () => {
    for (const [valeur, attendue] of [["methode", "methode"], ["inconnue", undefined], [null, undefined]] as const) {
      const m = monter();
      const donnees = new FormData();
      donnees.set("type", "sujet");
      donnees.set("sujet", "Se lancer dans l'IA");
      if (valeur !== null) donnees.set("intention", valeur);
      await creerDepuisFormulaire(donnees, m.deps);
      expect(m.demandes[0]?.type === "sujet" ? m.demandes[0].intention : "absent", String(valeur)).toBe(attendue);
    }
  });
});
