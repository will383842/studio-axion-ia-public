/** CAL-09 · Semaine « Par réseau » : couloirs, densités Compact/Visuel retenues, « + N autres » qui montre toute la case. Aucun appel réel. */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GrilleSemaine, DENSITES_SEMAINE } from "@/components/calendrier/GrilleSemaine";
import { CLE_DENSITE_SEMAINE, SelecteurDensiteSemaine, lireDensiteSemaine, retenirDensiteSemaine } from "@/components/calendrier/Vues";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";

const AUJ = "2026-11-11"; // mercredi
const carte = (i: number, o: Partial<EntreeCarte> = {}): EntreeCarte => ({ cle: `p${i}|linkedin`, jour: AUJ, reseau: "linkedin", type: "video", etat: "brouillon", heure: `${String(8 + i).padStart(2, "0")}:00`, titre: `Titre ${i}`, ...o });
const cinq = [0, 1, 2, 3, 4].map((i) => carte(i));
const rendre = (p: Partial<Parameters<typeof GrilleSemaine>[0]> = {}) => renderToStaticMarkup(<GrilleSemaine semaineDu={AUJ} aujourdhui={AUJ} entrees={cinq} {...p} />);
const nbCartes = (html: string) => (html.match(/data-carte="/g) ?? []).length;
const nbMontrees = (html: string) => nbCartes(html.replace(/<details[\s\S]*?<\/details>/g, ""));

describe("CAL-09 · couloirs", () => {
  it("une ligne par réseau et une colonne par jour", () => {
    const html = rendre({ reseaux: ["linkedin", "tiktok"] });
    expect((html.match(/data-couloir="/g) ?? []).length).toBe(2);
    expect((html.match(/data-entete-jour="/g) ?? []).length).toBe(7);
    expect((html.match(/data-case="/g) ?? []).length).toBe(14);
  });
});

describe("CAL-09 · densités", () => {
  it("Compact montre plus de cartes que Visuel, sans titre ; Visuel montre le titre", () => {
    expect(DENSITES_SEMAINE.compact.max).toBeGreaterThan(DENSITES_SEMAINE.visuel.max);
    const c = rendre({ densite: "compact" });
    const v = rendre({ densite: "visuel" });
    expect(nbMontrees(c)).toBe(DENSITES_SEMAINE.compact.max);
    expect(nbMontrees(v)).toBe(DENSITES_SEMAINE.visuel.max);
    expect(c).not.toContain("Titre 0");
    expect(v).toContain("Titre 0");
  });
  it("au-delà de la place, la case dit « + N autres » avec le bon compte", () => {
    const html = rendre({ densite: "visuel" });
    expect(html).toContain(`+ ${5 - DENSITES_SEMAINE.visuel.max} autres`);
  });
  it("sans « + N autres » nécessaire, rien n'est affiché", () => {
    expect(rendre({ densite: "compact", entrees: cinq.slice(0, 2) })).not.toContain("autre");
  });
  it("un clic sur « + N autres » montre toutes les publications de la case (elles restent dans la page, repliées)", () => {
    const html = rendre({ densite: "visuel" });
    expect(html).toMatch(/<details[^>]*data-plus="linkedin\|2026-11-11"/);
    expect(nbCartes(html)).toBe(5);
  });
  it("un lien ou un geste fourni garde la main sur « + N autres »", () => {
    const html = rendre({ densite: "visuel", lienPlus: (r, j) => `/jour/${j}?r=${r}` });
    expect(html).toContain('href="/jour/2026-11-11?r=linkedin"');
    expect(html).not.toContain("<details");
    expect(nbCartes(html)).toBe(DENSITES_SEMAINE.visuel.max);
  });
  it("maxParCase explicite l'emporte sur la densité", () => {
    expect(nbCartes(rendre({ densite: "compact", maxParCase: 1, onVoirPlus: () => {} }))).toBe(1);
  });
});

describe("CAL-09 · densité retenue", () => {
  let mem: Map<string, string>;
  beforeEach(() => {
    mem = new Map();
    const stockage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    vi.stubGlobal("window", { localStorage: stockage, addEventListener: () => {}, removeEventListener: () => {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("défaut Visuel, valeur illisible ignorée", () => {
    expect(lireDensiteSemaine()).toBe("visuel");
    mem.set(CLE_DENSITE_SEMAINE, "n'importe quoi");
    expect(lireDensiteSemaine()).toBe("visuel");
  });
  it("choisir Compact le retient, et il est relu ensuite", () => {
    retenirDensiteSemaine("compact");
    expect(mem.get(CLE_DENSITE_SEMAINE)).toBe("compact");
    expect(lireDensiteSemaine()).toBe("compact");
  });
  it("mémoire du navigateur fermée : pas d'erreur, Visuel", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("fermée"); }, setItem: () => { throw new Error("fermée"); } }, addEventListener: () => {}, removeEventListener: () => {} });
    expect(() => retenirDensiteSemaine("compact")).not.toThrow();
    expect(lireDensiteSemaine()).toBe("visuel");
  });
  it("le sélecteur propose Compact et Visuel, Visuel pressé au départ", () => {
    const html = renderToStaticMarkup(<SelecteurDensiteSemaine />);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Compact</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Visuel</);
  });
});
