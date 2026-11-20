/** Extraits maison v4 (C4-U4.5a) : de l'archive au candidat choisi. Dépôts en mémoire, aucun réglage, aucun réseau. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque, Licence } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { extraitMaisonPourRecherche } = await import("@/services/extraits-maison-v4");

const NOW = "2026-11-17T10:00:00.000Z";
const ports = () => ({ depots, maintenant: () => NOW });
const lic = (p: Partial<Licence> = {}): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [], ...p });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 12, texte: "Une facture claire", motsCles: ["facture"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
interface Opt { licence: Licence; famille: string[]; plages: PlageExtrait[] }
const el = (id: string, o: Partial<Opt> = {}): ElementBibliotheque =>
  ({
    id, type: "source-extraits", nom: id, motsCles: [], formatsParDefaut: [], marqueId: "m", licence: o.licence ?? lic(),
    creeLe: NOW, modifieLe: NOW,
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId: `v-${id}`, versionId: "ver", sortieId: "s", ratio: "9:16", licence: o.licence ?? lic(),
        famille: o.famille ?? [], plages: o.plages ?? [plage("p1")], rangee: false, sourcePreferee: false,
      },
    },
  }) as unknown as ElementBibliotheque;
const semer = async (...els: ElementBibliotheque[]) => { for (const e of els) await depots().elements.enregistrer(e); };
const entree = (o: Record<string, unknown> = {}) => ({
  recherche: "axion:facture", dureeFenetreSec: 4, videoId: "nouvelle", dejaPris: [] as string[], recents: [] as string[], ...o,
});

beforeEach(() => { reinitialiserDepots(); vi.restoreAllMocks(); });

describe("extraitMaisonPourRecherche", () => {
  it("recherche sans axion: → null et zéro lecture des dépôts", async () => {
    await semer(el("a"));
    const sonde = vi.spyOn(depots().elements, "lister");
    expect(await extraitMaisonPourRecherche(entree({ recherche: "facture" }), ports())).toBeNull();
    expect(sonde).not.toHaveBeenCalled();
  });
  it("archive vide → null", async () => {
    expect(await extraitMaisonPourRecherche(entree(), ports())).toBeNull();
  });
  it("une plage valide est choisie, avec le droit lu de la licence", async () => {
    await semer(el("a"));
    const r = await extraitMaisonPourRecherche(entree(), ports());
    expect(r?.extrait.cle).toBe("extrait:a:p1");
    expect(r?.extrait.licenceOk).toBe(true);
    expect(r?.longueurSec).toBeGreaterThan(0);
  });
  it("une plage au texte incrusté n'est jamais choisie (P-4)", async () => {
    await semer(el("a", { plages: [plage("p1", { texteIncruste: true })] }));
    expect(await extraitMaisonPourRecherche(entree(), ports())).toBeNull();
  });
  it("une plage plus courte que la durée minimale n'est jamais choisie", async () => {
    await semer(el("a", { plages: [plage("p1", { finSec: 2 })] }));
    expect(await extraitMaisonPourRecherche(entree(), ports())).toBeNull();
  });
  it("une plage d'un tiers (licence non commerciale ou à vérifier) n'est jamais choisie", async () => {
    await semer(el("t1", { licence: lic({ usageCommercial: false }) }), el("t2", { licence: lic({ type: "a-verifier" }) }));
    expect(await extraitMaisonPourRecherche(entree(), ports())).toBeNull();
  });
  it("une plage dont la famille contient videoId n'est jamais choisie", async () => {
    await semer(el("a", { famille: ["nouvelle"] }));
    expect(await extraitMaisonPourRecherche(entree(), ports())).toBeNull();
    expect((await extraitMaisonPourRecherche(entree({ videoId: "autre" }), ports()))?.extrait.cle).toBe("extrait:a:p1");
  });
  it("même entrée = même choix (déterminisme)", async () => {
    await semer(el("a"), el("b"), el("c"));
    const un = await extraitMaisonPourRecherche(entree(), ports());
    const deux = await extraitMaisonPourRecherche(entree(), ports());
    expect(un).not.toBeNull();
    expect(deux).toEqual(un);
  });
  it("dejaPris est respecté", async () => {
    await semer(el("a"), el("b"));
    const premier = await extraitMaisonPourRecherche(entree(), ports());
    const cle = premier!.extrait.cle;
    const suite = await extraitMaisonPourRecherche(entree({ dejaPris: [cle] }), ports());
    expect(suite?.extrait.cle).not.toBe(cle);
    expect(await extraitMaisonPourRecherche(entree({ dejaPris: ["extrait:a:p1", "extrait:b:p1"] }), ports())).toBeNull();
  });
  it("aucune écriture", async () => {
    await semer(el("a"));
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    await extraitMaisonPourRecherche(entree(), ports());
    expect(ecrit).not.toHaveBeenCalled();
  });
  it("une erreur de lecture rend null sans lever", async () => {
    const casses = { elements: { lister: async () => { throw new Error("panne"); } }, evenements: { enregistrer: async () => undefined } };
    const faux = (() => casses) as unknown as typeof depots;
    await expect(extraitMaisonPourRecherche(entree(), { depots: faux })).resolves.toBeNull();
  });
});

describe("garde statique", () => {
  const fichiers = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  it("aucun fichier de src/ n'importe extraits-maison-v4", () => {
    // MAJ 2026-11-18 (BR-TELEPHONE-b, voulue, à relire) : `src/services/telephone-extrait-v4.ts` est désormais le seul importeur permis
    // (le branchement du téléphone qui joue un extrait). Garde intacte : tout AUTRE fichier de src/ qui l'importe reste refusé.
    // MAJ 20/11 (FA-SERVICE-INV-v20h, voulue, à relire) : `src/services/facecam-animee.ts` est le second importeur permis, en import
    // dynamique derrière le réglage `facecamAnimee.extraitsMaison` (éteint par défaut, 0 €). Tout AUTRE fichier reste refusé.
    const importeurs = fichiers("src").filter((f) => !f.endsWith("extraits-maison-v4.ts") && !f.endsWith("telephone-extrait-v4.ts") && /extraits-maison-v4/.test(readFileSync(f, "utf8")));
    expect(importeurs.map((f) => f.replace(/\\/g, "/"))).toEqual(["src/services/facecam-animee.ts"]);
    const service = readFileSync("src/services/facecam-animee.ts", "utf8");
    expect(service).not.toMatch(/^import .*extraits-maison-v4/m);
    expect(service.indexOf("if (extraitsMaison)")).toBeLessThan(service.indexOf('import("./extraits-maison-v4")'));
  });
  it("le fichier n'importe ni fournisseurs, ni credits, ni couts, ni facecam-animee, ni reglages", () => {
    const src = readFileSync("src/services/extraits-maison-v4.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
    for (const l of imports) {
      expect(l).not.toMatch(/@\/fournisseurs|credits|couts|services\/facecam-animee|\.\/facecam-animee|reglages/);
    }
  });
});
