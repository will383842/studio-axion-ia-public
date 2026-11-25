import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POLICES-P5-b-v20l : `ObjetSurPaume` n'écrit la texture de l'écran (canevas, donc polices DÉJÀ chargées) qu'après la
 * promesse du chargeur de la police de marque. React, remotion, trois et le chargeur sont des doubles ; le composant est
 * chargé par chemin CALCULÉ (jamais d'import littéral d'un fichier de studio-rendu/compositions depuis tests/).
 */
const cheminRemotion = (() => {
  try {
    return createRequire(new URL("../../../studio-rendu/package.json", import.meta.url)).resolve("remotion").replace("/cjs/index.js", "/esm/index.mjs");
  } catch {
    return "remotion";
  }
})();
const dossier = (nom: string) => new URL(`../../../studio-rendu/compositions/commune/${nom}`, import.meta.url).pathname;
const MODULE = ["../../../studio-rendu", "compositions", "commune", "effets", "ObjetSurPaume"].join("/");

type Effet = { fn: () => void | (() => void); deps?: unknown[]; dernier?: unknown[]; nettoyage?: void | (() => void); couche: boolean };
const monde = vi.hoisted(() => ({
  slots: [] as unknown[],
  effets: [] as unknown[],
  rang: 0,
  rangEffet: 0,
  refs: [] as { current: unknown }[],
  rerendre: () => {},
  ecrans: 0,
  continues: [] as unknown[],
  annulations: 0,
  pret: null as null | { resoudre: () => void; rejeter: (e: Error) => void },
  vue: [] as string[],
}));

const faux = (): unknown =>
  new Proxy(function () {}, {
    get: (_c, k) => (k === Symbol.toPrimitive ? () => 1 : k === "then" ? undefined : faux()),
    apply: () => faux(),
    construct: () => faux() as object,
    set: () => true,
  });

function installer() {
  monde.slots = [];
  monde.effets = [];
  monde.refs = [];
  monde.ecrans = 0;
  monde.continues = [];
  monde.annulations = 0;
  monde.vue = [];
  vi.resetModules();
  const nettoyage = vi.fn();
  void nettoyage;
  vi.doMock("react", () => {
    const hook = {
      useState: (init: unknown) => {
        const i = monde.rang++;
        if (!(i in monde.slots)) monde.slots[i] = typeof init === "function" ? (init as () => unknown)() : init;
        return [monde.slots[i], (v: unknown) => { monde.slots[i] = v; monde.rerendre(); }];
      },
      useRef: () => {
        const i = monde.rang++;
        if (!(i in monde.slots)) {
          const ordre = monde.refs.length;
          monde.slots[i] = { current: ordre === 0 ? { getContext: () => faux() } : ordre === 1 ? { getContext: () => faux() } : null };
          monde.refs.push(monde.slots[i] as { current: unknown });
        }
        return monde.slots[i];
      },
      useMemo: (fn: () => unknown) => fn(),
      useEffect: (fn: () => void, deps?: unknown[]) => { enregistrer(fn, deps, false); },
      useLayoutEffect: (fn: () => void, deps?: unknown[]) => { enregistrer(fn, deps, true); },
    };
    return { ...hook, default: hook };
  });
  vi.doMock(cheminRemotion, () => ({
    AbsoluteFill: "AbsoluteFill",
    Img: "Img",
    OffthreadVideo: "OffthreadVideo",
    useCurrentFrame: () => 0,
    delayRender: (e: string) => { monde.vue.push(`delay:${e}`); return 7; },
    continueRender: (h: unknown) => { monde.continues.push(h); },
    cancelRender: () => { monde.annulations++; },
  }));
  vi.doMock(dossier("police-marque"), () => ({
    chargerPoliceMarque: () => {},
    policeMarquePrete: () => new Promise<void>((resoudre, rejeter) => { monde.pret = { resoudre, rejeter }; }),
  }));
  vi.doMock(dossier("effets/objets-realistes"), () => ({
    dessinerEcran: () => { monde.ecrans++; return faux(); },
    construireTelephone: () => faux(),
    construireLogo: () => faux(),
  }));
  vi.doMock(dossier("effets/trois"), () => ({ trois: () => faux() }));
  vi.doMock(dossier("effets/objets"), () => ({ construireObjet: () => faux() }));
}

function enregistrer(fn: () => void, deps: unknown[] | undefined, couche: boolean) {
  const i = monde.rangEffet++;
  const existant = monde.effets[i] as Effet | undefined;
  if (existant) { existant.fn = fn; existant.deps = deps; existant.couche = couche; return; }
  monde.effets[i] = { fn, deps, couche } satisfies Effet;
}

const PROPS = {
  objet: "telephone",
  largeur: 1080,
  hauteur: 1920,
  surEchantillonnage: 1,
  lumiere: { intensite: 1, temperatureK: 5000, teinte: "#ffffff", ambiance: "#000000", direction: [0, 0, 1] },
  poses: [{ x: 500, y: 900, taille: 300, visible: 1, surPaume: { vitesseX: 0, vitesseY: 0, doigts: [] } }],
  prise: { grain: 0, flouPx: 0 },
  source: "x.mp4",
};

async function monter() {
  const mod = (await import(/* @vite-ignore */ MODULE)) as { ObjetSurPaume: (p: unknown) => unknown };
  const dessiner = () => {
    monde.rang = 0;
    monde.rangEffet = 0;
    mod.ObjetSurPaume(PROPS);
  };
  const vider = () => {
    for (const e of monde.effets as Effet[]) {
      const change = !e.deps || !e.dernier || e.deps.some((d, k) => !Object.is(d, e.dernier![k]));
      if (!change) continue;
      e.dernier = e.deps ? [...e.deps] : undefined;
      try { e.nettoyage = e.fn(); } catch { /* le double de trois peut échouer APRÈS dessinerEcran : seul l'ordre compte */ }
    }
  };
  monde.rerendre = () => { dessiner(); vider(); };
  dessiner();
  vider();
}
const attendre = () => new Promise<void>((r) => setTimeout(r, 0));

describe("ObjetSurPaume attend la police de marque avant d'écrire la texture de l'écran", () => {
  beforeEach(installer);
  afterEach(() => { vi.resetModules(); vi.restoreAllMocks(); });

  it("(a) tant que la promesse du chargeur n'est pas tenue, dessinerEcran n'est jamais appelé et le rendu reste retenu", async () => {
    await monter();
    await attendre();
    expect(monde.pret).not.toBeNull();
    expect(monde.ecrans).toBe(0);
    expect(monde.continues).toEqual([]);
  });

  it("(b) promesse tenue : la texture de l'écran est dessinée une seule fois, puis le rendu est libéré", async () => {
    await monter();
    monde.pret!.resoudre();
    await attendre();
    expect(monde.ecrans).toBe(1);
    expect(monde.continues).toEqual([7]);
  });

  it("(c) chargeur en échec : aucune texture en police de secours, rendu jamais libéré par ce composant", async () => {
    await monter();
    monde.pret!.rejeter(new Error("Police Manrope illisible : 404"));
    await attendre();
    expect(monde.ecrans).toBe(0);
    expect(monde.continues).toEqual([]);
  });

  it("(d) le code appelle policeMarquePrete et ne dessine l'écran qu'après la police (lecture du source)", () => {
    const src = readFileSync(new URL("../../../studio-rendu/compositions/commune/effets/ObjetSurPaume.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/import \{ policeMarquePrete \} from "\.\.\/police-marque";/);
    expect(src).toMatch(/policeMarquePrete\(\)\.then\(/);
    expect(src).toMatch(/!policePrete\) return;/);
    expect(src).toMatch(/if \(policePrete\) continueRender\(attente\)/);
  });
});
