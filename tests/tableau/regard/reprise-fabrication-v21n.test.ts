/**
 * S-12-BRANCHER-a-v21n : la boucle « page fautive refaite une fois, regardée une seconde fois », pièce PURE du moteur
 * tableau, tout injecté. 0 €, aucun appel réel (doubles).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CodeDefautVu, VerdictRegard } from "../../../src/briques/regardeur";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { pageDePlus } from "../../../src/moteurs/montage-tableau/densite";
import { MAX_REGARDS_PAR_VIDEO as BORNE_GARDE } from "../../../src/moteurs/montage-tableau/garde-regard";
import { MAX_REGARDS_PAR_VIDEO, fabriquerAvecReprise, type PortsReprise } from "../../../src/moteurs/montage-tableau/reprise-fabrication";
import { doubles } from "../fabriquer/doubles";

const temoin = JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as { ficheCalee: FicheTableau };
const fiche: FicheTableau = { ...structuredClone(temoin.ficheCalee), scenes: structuredClone(temoin.ficheCalee.scenes.filter((s) => s.page <= 4)) };
const dit = (f: FicheTableau) => f.scenes.map((s) => s.texteDit).join(" ");

const verdict = (...d: [CodeDefautVu, string | null][]): VerdictRegard =>
  ({
    defauts: d.map(([code, partieId], k) => ({ code, partieId, nom: `i0${k + 1}`, detail: code })),
    relues: 5,
    nonRelues: 0,
    partiesFautives: [...new Set(d.flatMap(([, p]) => (p ? [p] : [])))],
  }) as unknown as VerdictRegard;

function monter(verdicts: (VerdictRegard | Error)[], opts: { regardsFaits?: number | Error; refaireEnPanne?: boolean; ecritureEnPanne?: boolean } = {}) {
  let n = 0;
  const regardsFaits = { valeur: opts.regardsFaits ?? 0 };
  const ecrits: number[] = [];
  const fiches: FicheTableau[] = [];
  const maxAppels: number[] = [];
  /** Journal d'ordre commun : « ecritK » quand le compteur est écrit, « fabK » à l'entrée du K-ième passage. */
  const ordre: string[] = [];
  const fabriquer = vi.fn(async (f: FicheTableau, options: { maxAppels: number }) => {
    fiches.push(f);
    maxAppels.push(options.maxAppels);
    ordre.push(`fab${fiches.length}`);
    if (opts.refaireEnPanne && fiches.length === 2) throw new Error("panne");
    const v = verdicts[n++];
    if (v instanceof Error) throw v;
    return { cles: { video: `video-${fiches.length}` }, verdict: v };
  });
  const ports: PortsReprise = {
    fabriquer,
    lireRegardsFaits: vi.fn(() => {
      if (regardsFaits.valeur instanceof Error) throw regardsFaits.valeur;
      return regardsFaits.valeur as number;
    }),
    ecrireRegardsFaits: vi.fn((k: number) => {
      if (opts.ecritureEnPanne) throw new Error("écriture impossible");
      ecrits.push(k);
      ordre.push(`ecrit${k}`);
      regardsFaits.valeur = k;
    }),
  };
  return { ports, fabriquer, ecrits, fiches, maxAppels, ordre };
}

describe("premier test : deux fiches, deux clés vidéo (CONCEPTION § 6)", () => {
  it("deux fabriquerTableau avec deux fiches différentes rendent deux cles.video différentes", async () => {
    const base = fiche;
    const autre = pageDePlus(base, 3) ?? pageDePlus(base, 2) ?? pageDePlus(base, 1);
    expect(autre).not.toBeNull();
    const a = await fabriquerTableau(doubles(base, { fin: "Enregistrez cette vidéo pour la refaire" }).outils);
    const b = await fabriquerTableau(doubles(autre!, { fin: "Enregistrez cette vidéo pour la refaire" }).outils);
    expect(a.cles.video).not.toBe(b.cles.video);
  });
});

describe("fabriquerAvecReprise (S-12-BRANCHER-a-v21n)", () => {
  it("(1) sans défaut : 1 fabriquer, 1 regard, refaites 0", async () => {
    const m = monter([verdict()]);
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(m.fabriquer).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ regards: 1, refaites: 0, arret: "rien" });
    expect(m.maxAppels).toEqual([1]);
    expect(r.fiche).toBe(fiche);
  });

  it("(2) texte-coupe page 3 : 2 fabriquer, 2 regards, 1 page de plus, mêmes mots", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"]), verdict()]);
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(m.fabriquer).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ regards: 2, refaites: 1 });
    expect(Math.max(...m.fiches[1].scenes.map((s) => s.page))).toBe(Math.max(...fiche.scenes.map((s) => s.page)) + 1);
    expect(dit(m.fiches[1])).toBe(dit(fiche));
    expect(r.cles).toEqual({ video: "video-2" });
    expect(m.maxAppels).toEqual([1, 1]);
  });

  it("(3) second verdict encore fautif : rendu avec la liste exacte, pas de 3e passage", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"]), verdict(["texte-coupe", "page-3"])]);
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(m.fabriquer).toHaveBeenCalledTimes(2);
    expect(r.arret).toBe("rendre");
    expect(r.raisons.length).toBeGreaterThan(0);
    expect(m.maxAppels).toEqual([1, 1]);
  });

  it("(4) regards = 2 déjà faits : 0 regard, sortie « non relue »", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"])], { regardsFaits: 2 });
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(m.fabriquer).toHaveBeenCalledTimes(1);
    expect(r.refaites).toBe(0);
    expect(r.regards).toBe(0);
    expect(r.arret).toBe("non-relue");
    expect(m.ecrits).toEqual([]);
    expect(m.maxAppels).toEqual([0]);
  });

  it("(4 bis) compteur illisible : 0 regard", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"])], { regardsFaits: new Error("illisible") });
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(r.regards).toBe(0);
    expect(r.arret).toBe("non-relue");
    expect(m.maxAppels).toEqual([0]);
  });

  it("(4 ter) 1 regard déjà fait : un seul regard encore permis, pas de page refaite lue deux fois", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"]), verdict()], { regardsFaits: 1 });
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(r.regards).toBeLessThanOrEqual(1);
    expect(m.ecrits.every((k) => k <= 2)).toBe(true);
  });

  it("(5) fabriquer lève au 2e passage : vidéo d'avant gardée (refaire-en-panne)", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"])], { refaireEnPanne: true });
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(r.arret).toBe("refaire-en-panne");
    expect(r.cles).toEqual({ video: "video-1" });
    expect(r.fiche).toBe(fiche);
  });

  it("(6) actif: false : exactement 1 fabriquer, aucun regard compté, sortie identique", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"])]);
    const r = await fabriquerAvecReprise({ fiche, actif: false }, m.ports);
    expect(m.fabriquer).toHaveBeenCalledTimes(1);
    expect(m.ecrits).toEqual([]);
    expect(m.maxAppels).toEqual([0]);
    expect(r.fiche).toBe(fiche);
    expect(r.refaites).toBe(0);
    expect(r.cles).toEqual({ video: "video-1" });
  });

  it("(6 bis) actif doit être exactement true", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"])]);
    await fabriquerAvecReprise({ fiche, actif: "oui" as unknown as boolean }, m.ports);
    expect(m.fabriquer).toHaveBeenCalledTimes(1);
    expect(m.maxAppels).toEqual([0]);
    expect(m.ecrits).toEqual([]);
  });

  it.each([["phrase-non-choisie", null], ["fin-absente", null], ["desynchro", "page-2"]] as [CodeDefautVu, string | null][])("(7) %s : rien refait", async (code, partie) => {
    const m = monter([verdict([code, partie])]);
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(m.fabriquer).toHaveBeenCalledTimes(1);
    expect(r.refaites).toBe(0);
  });

  it("(8) le compteur est écrit AVANT chaque passage qui regarde : ordre exact", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"]), verdict()]);
    await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(m.ordre).toEqual(["ecrit1", "fab1", "ecrit2", "fab2"]);
    expect(m.ecrits).toEqual([1, 2]);
  });

  it("(8 bis) l'écriture du compteur échoue : fabriquer est appelé SANS regard (maxAppels 0), 0 regard rendu", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"])], { ecritureEnPanne: true });
    const r = await fabriquerAvecReprise({ fiche, actif: true }, m.ports);
    expect(m.maxAppels).toEqual([0]);
    expect(r.regards).toBe(0);
    expect(r.refaites).toBe(0);
    expect(m.fabriquer).toHaveBeenCalledTimes(1);
  });

  it("(9) aucune exception : ports qui lèvent partout", async () => {
    const ports: PortsReprise = { fabriquer: async () => { throw new Error("x"); }, lireRegardsFaits: () => { throw new Error("x"); }, ecrireRegardsFaits: () => { throw new Error("x"); } };
    await expect(fabriquerAvecReprise({ fiche, actif: true }, ports)).resolves.toBeDefined();
    await expect(fabriquerAvecReprise({ fiche, actif: false }, ports)).resolves.toBeDefined();
  });

  it("la borne de la reprise est celle de la garde (2)", () => {
    expect(MAX_REGARDS_PAR_VIDEO).toBe(BORNE_GARDE);
    expect(MAX_REGARDS_PAR_VIDEO).toBe(2);
  });

  it("éteint : un seul importeur dans src/**, la fiche d'entrée reste intacte, module pur", () => {
    const racine = new URL("../../../src", import.meta.url).pathname;
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) parcourir(f); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(f); } };
    parcourir(racine);
    expect(fichiers.filter((f) => !f.endsWith("reprise-fabrication.ts") && readFileSync(f, "utf8").includes("reprise-fabrication"))).toEqual([]);
    const source = readFileSync(new URL("../../../src/moteurs/montage-tableau/reprise-fabrication.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "@\/(services|fournisseurs)\//);
    expect(source).not.toContain("depense-claude-video");
    expect(source).not.toContain("server-only");
  });
});
