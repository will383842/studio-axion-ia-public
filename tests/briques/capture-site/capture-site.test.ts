/**
 * C3 · capture-site : page entière, frappe sans envoi, mesure d'audience coupée. Navigateur remplacé par un double ;
 * la garde d'envoi (script d'avant chargement) est jouée dans un bac à sable `node:vm`, sans réseau.
 */
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { ErreurRendu } from "../../../studio-rendu/src/contrat";
import {
  adresseAutorisee,
  capturerPage,
  GARDE_ENVOI,
  HOTES_MESURE,
  IGNORER_MESURE,
  lireParametres,
  type PageCapture,
  type ParametresCapture,
} from "../../../studio-rendu/src/operations/capture-site";
import { empreinteTrace, MODES_ANCIENS } from "./trace";

const dossiers: string[] = [];
async function dossier() {
  const d = await mkdtemp(join(tmpdir(), "essai-c3-"));
  dossiers.push(d);
  return d;
}
afterEach(async () => {
  while (dossiers.length) await rm(dossiers.pop()!, { recursive: true, force: true });
});

/** Double complet : enregistre tout, répond aux recherches d'éléments, compte les envois bloqués par la page. */
function double(options: { sansTaper?: boolean; bloques?: number; hauteurPage?: number; manquant?: string } = {}) {
  const appels = { evaluations: [] as string[], tapes: [] as string[], survols: [] as [number, number][], photos: [] as unknown[], bloques: [] as string[][], scripts: [] as string[], ordre: [] as string[], fermee: false };
  const page: PageCapture = {
    async ouvrir(url) {
      appels.ordre.push("ouvrir");
      return url;
    },
    async evaluer<T>(expression: string) {
      appels.evaluations.push(expression);
      if (expression.includes("studio-fleche") && expression.includes("hauteurPage")) return { hauteurPage: options.hauteurPage ?? 5000, titre: "Essai" } as T;
      if (expression.includes("__studioEnvoisBloques")) return (options.bloques ?? 0) as T;
      if (options.manquant && expression.includes(JSON.stringify(options.manquant))) return null as T;
      if (expression.includes("studio-champ")) return { y: 1500, defilement: 1200 } as T;
      if (expression.includes("studio-case")) return true as T;
      if (expression.includes("studio-bouton")) return { x: 210, y: 600 } as T;
      return 0 as T;
    },
    async photographier(zone?: unknown) {
      appels.photos.push(zone);
      return Buffer.from([0xff, 0xd8, 0xff]);
    },
    async survoler(x, y) {
      appels.survols.push([x, y]);
    },
    async fermer() {
      appels.fermee = true;
    },
    async bloquer(motifs) {
      appels.ordre.push("bloquer");
      appels.bloques.push(motifs);
    },
    async avantChargement(script) {
      appels.ordre.push("avantChargement");
      appels.scripts.push(script);
    },
    ...(options.sansTaper
      ? {}
      : {
          async taper(texte: string) {
            appels.tapes.push(texte);
          },
        }),
  };
  return { page, appels };
}

const FRAPPE: ParametresCapture = {
  type: "video",
  format: "9:16",
  mouvement: "frappe",
  dureeSec: 6,
  saisies: [
    { champ: "prenom", texte: "Camille" },
    { champ: "email", texte: "camille@cabinet.fr" },
  ],
  cocher: ["rgpd"],
  survoler: "envoyer",
};

const encoder = (compte?: (n: number) => void) => async (d: string, c: string) => {
  compte?.((await readdir(d)).length);
  await writeFile(c, "mp4");
};

describe("C3 · paramètres", () => {
  it("accepte page entière, frappe (saisies, cases, bouton) et sansMesure", () => {
    expect(lireParametres({ type: "page-entiere" })).toMatchObject({ type: "page-entiere", format: "9:16" });
    expect(
      lireParametres({ type: "video", mouvement: "frappe", saisies: [{ champ: "prenom", texte: "Camille" }], cocher: ["rgpd"], survoler: "envoyer", sansMesure: true }),
    ).toMatchObject({ mouvement: "frappe", saisies: [{ champ: "prenom", texte: "Camille" }], cocher: ["rgpd"], survoler: "envoyer", sansMesure: true });
    expect(lireParametres({ type: "image", sansMesure: false })).not.toHaveProperty("sansMesure");
    expect(lireParametres({ type: "image" })).not.toHaveProperty("sansMesure");
  });

  it("refuse un identifiant de champ mal formé, un texte trop long ou une touche Entrée, trop de saisies ou de cases", () => {
    const frappe = (x: Record<string, unknown>) => () => lireParametres({ type: "video", mouvement: "frappe", saisies: [{ champ: "prenom", texte: "A" }], ...x });
    for (const champ of ["1prenom", "pre nom", "#prenom", "a".repeat(65), "", "x\"]"]) expect(frappe({ saisies: [{ champ, texte: "A" }] }), champ).toThrow(ErreurRendu);
    expect(frappe({ saisies: [{ champ: "prenom", texte: "a".repeat(61) }] })).toThrow(ErreurRendu);
    expect(frappe({ saisies: [{ champ: "prenom", texte: "Camille\n" }] })).toThrow(ErreurRendu);
    expect(frappe({ saisies: [] })).toThrow(ErreurRendu);
    expect(frappe({ saisies: Array.from({ length: 5 }, () => ({ champ: "a", texte: "b" })) })).toThrow(ErreurRendu);
    expect(frappe({ cocher: ["a", "b", "c", "d"] })).toThrow(ErreurRendu);
    expect(frappe({ cocher: ["bad id"] })).toThrow(ErreurRendu);
    expect(frappe({ survoler: "a b" })).toThrow(ErreurRendu);
    expect(() => lireParametres({ type: "image", mouvement: "frappe", saisies: [{ champ: "a", texte: "b" }] })).toThrow(ErreurRendu);
    // Un mouvement inconnu reste ramené au défilement (comportement d'avant).
    expect(lireParametres({ type: "video", mouvement: "autre" }).mouvement).toBe("defilement");
  });

  it("une adresse hors axion-ia.com reste refusée, même en frappe", async () => {
    expect(adresseAutorisee("https://exemple.fr/contact")).toBe(false);
    let ouvert = false;
    await expect(capturerPage("https://exemple.fr/contact", FRAPPE, await dossier(), { ouvrir: async () => ((ouvert = true), double().page) })).rejects.toThrow(/axion-ia\.com/);
    expect(ouvert).toBe(false);
  });
});

describe("C3 · page entière", () => {
  it("JPEG de toute la page, 1080 de large, hauteur plafonnée à 12 000 px", async () => {
    const { page, appels } = double({ hauteurPage: 9000 });
    const r = await capturerPage("https://axion-ia.com/fr", { type: "page-entiere", format: "9:16", mouvement: "defilement", dureeSec: 6 }, await dossier(), { ouvrir: async () => page });
    expect(r.mime).toBe("image/jpeg");
    expect(r.mesures).toEqual({ largeur: 1080, hauteur: 12000, hauteurPage: 9000, mouvement: 0 });
    expect(appels.photos).toEqual([{ largeur: 432, hauteur: 4800, echelle: 1 }]);
    const court = double({ hauteurPage: 2000 });
    const r2 = await capturerPage("https://axion-ia.com/fr", { type: "page-entiere", format: "16:9", mouvement: "defilement", dureeSec: 6 }, await dossier(), { ouvrir: async () => court.page });
    expect(r2.mesures).toMatchObject({ largeur: 1080, hauteur: Math.round((2000 * 1080) / 1280), hauteurPage: 2000 });
    expect(court.appels.photos[0]).toEqual({ largeur: 1280, hauteur: 2000, echelle: 1080 / 1920 });
    expect(court.appels.fermee).toBe(true);
  });
});

describe("C3 · frappe sans envoi", () => {
  it("garde posée AVANT le chargement ; lettres à 2 images, cases à 6, bouton survolé, mesures rendues", async () => {
    const { page, appels } = double({ bloques: 2 });
    let images = 0;
    const r = await capturerPage("https://axion-ia.com/fr/contact", FRAPPE, await dossier(), { ouvrir: async () => page, encoder: encoder((n) => (images = n)) });
    expect(appels.ordre.slice(0, 3)).toEqual(["bloquer", "avantChargement", "ouvrir"]);
    for (const h of HOTES_MESURE) expect(appels.bloques[0].some((m) => m.includes(h))).toBe(true);
    expect(appels.scripts[0]).toContain(GARDE_ENVOI);
    expect(appels.scripts[0]).not.toContain(IGNORER_MESURE);
    expect(appels.tapes.join("")).toBe("Camillecamille@cabinet.fr");
    expect(appels.tapes.every((t) => [...t].length === 1)).toBe(true);
    const lettres = "Camille".length + "camille@cabinet.fr".length;
    // Défilement (30) + 2 par lettre + 6 par case + trajet de la flèche (24) + tenue (15).
    expect(images).toBe(30 + lettres * 2 + 6 + 24 + 15);
    expect(appels.photos.length).toBe(30 + lettres + 1 + 24 + 1);
    expect(r.mime).toBe("video/mp4");
    expect(r.mesures).toMatchObject({ mouvement: 2, saisies: 2, requetesBloquees: 2, images, largeur: 1080, hauteur: 1920 });
    expect(r.mesures.dureeSec).toBeCloseTo(images / 30, 2);
    expect(appels.survols.at(-1)).toEqual([210, 600]);
    expect(appels.fermee).toBe(true);
  });

  it("aucun clic, aucune touche Entrée, aucun envoi demandé à la page", async () => {
    const { page, appels } = double();
    await capturerPage("https://axion-ia.com/fr/contact", FRAPPE, await dossier(), { ouvrir: async () => page, encoder: encoder() });
    const apresPreparation = appels.evaluations.slice(1);
    for (const e of apresPreparation) {
      expect(e).not.toMatch(/\.click\(|\.submit\(|requestSubmit|dispatchMouseEvent|new MouseEvent|"click"|'click'/);
    }
    expect(appels.tapes.some((t) => /[\r\n]/.test(t))).toBe(false);
  });

  it("une requête POST pendant la frappe est bloquée et comptée (garde jouée dans un bac à sable)", async () => {
    const envoyes: string[] = [];
    const ecouteurs: { type: string; f: (e: { preventDefault(): void; stopImmediatePropagation(): void }) => void }[] = [];
    class XHR {
      methode = "GET";
      open(m: string) {
        this.methode = m;
      }
      send() {
        envoyes.push(`xhr ${this.methode}`);
      }
    }
    class Formulaire {
      method = "post";
      submit() {
        envoyes.push("form");
      }
    }
    const fenetre: Record<string, unknown> = {
      fetch: async (_u: unknown, init?: { method?: string }) => (envoyes.push(`fetch ${init?.method ?? "GET"}`), "ok"),
      XMLHttpRequest: XHR,
      HTMLFormElement: Formulaire,
      navigator: { sendBeacon: () => (envoyes.push("beacon"), true) },
      addEventListener: (type: string, f: (typeof ecouteurs)[number]["f"]) => ecouteurs.push({ type, f }),
      Promise,
      TypeError,
      WeakMap,
      Object,
      String,
    };
    fenetre.window = fenetre;
    runInNewContext(GARDE_ENVOI, fenetre);
    const w = fenetre as { fetch: (u: string, i?: { method?: string }) => Promise<unknown>; navigator: { sendBeacon(u: string): boolean }; __studioEnvoisBloques: number };
    await expect(w.fetch("/api/candidature", { method: "POST" })).rejects.toThrow();
    await expect(w.fetch("/page", { method: "get" })).resolves.toBe("ok");
    await w.fetch("/page");
    const x = new (fenetre.XMLHttpRequest as typeof XHR)();
    x.open("PUT");
    x.send();
    const y = new (fenetre.XMLHttpRequest as typeof XHR)();
    y.open("HEAD");
    y.send();
    expect(w.navigator.sendBeacon("/mesure")).toBe(false);
    new (fenetre.HTMLFormElement as typeof Formulaire)().submit();
    let annule = 0;
    for (const e of ecouteurs.filter((l) => l.type === "submit")) e.f({ preventDefault: () => annule++, stopImmediatePropagation: () => undefined });
    expect(annule).toBe(1);
    expect(envoyes).toEqual(["fetch get", "fetch GET", "xhr HEAD"]);
    expect(w.__studioEnvoisBloques).toBe(5);
  });

  it("un double sans `taper` refuse la frappe (non réessayable), page refermée, rien d'ouvert", async () => {
    const { page, appels } = double({ sansTaper: true });
    const e = await capturerPage("https://axion-ia.com/fr/contact", FRAPPE, await dossier(), { ouvrir: async () => page, encoder: encoder() }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurRendu);
    expect((e as ErreurRendu).erreur).toMatchObject({ code: "refuse", reessayable: false });
    expect(appels.ordre).not.toContain("ouvrir");
    expect(appels.fermee).toBe(true);
  });

  it("garde refusée par le navigateur : la frappe est refusée (repli côté studio)", async () => {
    const { page, appels } = double();
    page.bloquer = async () => {
      throw new Error("Network.setBlockedURLs inconnu");
    };
    const e = await capturerPage("https://axion-ia.com/fr/contact", FRAPPE, await dossier(), { ouvrir: async () => page, encoder: encoder() }).catch((x: unknown) => x);
    expect((e as ErreurRendu).erreur).toMatchObject({ code: "refuse", reessayable: false });
    expect(appels.ordre).not.toContain("ouvrir");
  });

  it("champ introuvable : refus, aucune vidéo", async () => {
    const { page } = double({ manquant: "email" });
    let encode = false;
    const e = await capturerPage("https://axion-ia.com/fr/contact", FRAPPE, await dossier(), { ouvrir: async () => page, encoder: async () => void (encode = true) }).catch((x: unknown) => x);
    expect((e as ErreurRendu).erreur).toMatchObject({ code: "refuse", reessayable: false });
    expect(encode).toBe(false);
  });
});

describe("C3 · mesure d'audience coupée", () => {
  it("sansMesure : plausible_ignore posé avant le chargement, hôtes de mesure bloqués", async () => {
    const { page, appels } = double();
    const r = await capturerPage("https://axion-ia.com/fr", { type: "image", format: "9:16", mouvement: "defilement", dureeSec: 6, sansMesure: true }, await dossier(), { ouvrir: async () => page });
    expect(appels.ordre.slice(0, 3)).toEqual(["bloquer", "avantChargement", "ouvrir"]);
    expect(appels.scripts[0]).toContain(IGNORER_MESURE);
    expect(appels.scripts[0]).not.toContain(GARDE_ENVOI);
    expect(IGNORER_MESURE).toContain('"plausible_ignore", "true"');
    expect([...HOTES_MESURE].sort()).toEqual(["clarity.ms", "connect.facebook.net", "google-analytics.com", "googletagmanager.com", "plausible.io"]);
    expect(r.mesures).toMatchObject({ mouvement: 0 });
  });

  it("sans sansMesure : la suite des appels au double est identique à celle d'avant C3 (image, défilement, survol)", async () => {
    const attendu: Record<string, { appels: number; empreinte: string }> = {
      image: { appels: 4, empreinte: "98e40b208eae39a9" },
      defilement: { appels: 243, empreinte: "22460679e2a8fb2f" },
      survol: { appels: 327, empreinte: "fdf2717670862c56" },
    };
    for (const m of MODES_ANCIENS) expect(await empreinteTrace(m, await dossier()), m.nom).toEqual(attendu[m.nom]);
  });

  it("les mesures rendent toujours `mouvement` (0 défilement, 1 survol)", async () => {
    for (const [mouvement, code] of [["defilement", 0], ["survol", 1]] as const) {
      const { page } = double();
      const r = await capturerPage("https://axion-ia.com/fr", { type: "video", format: "9:16", mouvement, dureeSec: 4 }, await dossier(), { ouvrir: async () => page, encoder: encoder() });
      expect(r.mesures.mouvement).toBe(code);
    }
  });
});
