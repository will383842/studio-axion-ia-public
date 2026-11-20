import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { PHRASE_LECTEUR_EPUISE, lireDemande } from "@/services/retouche-chat/lecteur-demande";
import {
  LECTURES_MAX_PAR_VIDEO,
  appelSousBarriere,
  compterLectures,
  demandeCentimes,
  lecturesRestantes,
  sousPlafond,
  type DepsLectures,
} from "@/services/retouche-chat/plafond-lectures";

const ETAPE = "Retouche chat ·";
const PREFIXE = "txtpub-rtcht-";
const dep = (etape: string) => ({ lignes: [{ etape }] });
const res = (travailId?: string) => ({ travailId });
function deps(depenses: ReturnType<typeof dep>[], reservations: ReturnType<typeof res>[] = []): DepsLectures {
  return { etape: ETAPE, prefixeAppel: PREFIXE, lireDepenses: async () => depenses, lireReservationsActives: async () => reservations };
}

describe("plafond des lectures du chat (C7-17)", () => {
  it("a) 0..4 lectures → 3,2,1,0,0 ; réservation active comptée ; autres étapes/préfixes ignorés", async () => {
    const l = dep(`${ETAPE} lecture`);
    expect(LECTURES_MAX_PAR_VIDEO).toBe(3);
    for (const [n, att] of [[0, 3], [1, 2], [2, 1], [3, 0], [4, 0]] as const) {
      expect(await lecturesRestantes("v", deps(Array(n).fill(l)))).toBe(att);
    }
    expect(await lecturesRestantes("v", deps([l, l], [res(`${PREFIXE}abc`)]))).toBe(0);
    expect(await lecturesRestantes("v", deps([dep("Tableau · découpage"), dep("Monteur · discussion")], [res("txtpub-tbdec-x"), res(undefined)]))).toBe(3);
    expect(compterLectures("v", { etape: ETAPE, prefixeAppel: PREFIXE, depenses: [l], reservationsActives: [res(`${PREFIXE}1`)] })).toBe(2);
  });

  it("b) port qui lève ou nombre non fini → 0", async () => {
    const d = deps([]);
    expect(await lecturesRestantes("v", { ...d, lireDepenses: async () => { throw new Error("x"); } })).toBe(0);
    const nan = { ...d, lireDepenses: async () => [{ lignes: null as unknown as [] }] };
    expect(await lecturesRestantes("v", nan)).toBe(0);
  });

  it("c) sousPlafond : frontière, plafond 0, pire invalide, arrondis", () => {
    const pire = 0.045;
    expect(demandeCentimes(0.045)).toBe(6);
    expect(demandeCentimes(0.05)).toBe(6);
    expect(sousPlafond({ engageCentimes: 27 - 6, plafondUsd: 0.27, pireUsd: pire })).toBe(true);
    expect(sousPlafond({ engageCentimes: 27 - 6 + 1, plafondUsd: 0.27, pireUsd: pire })).toBe(false);
    expect(sousPlafond({ engageCentimes: 0, plafondUsd: 0, pireUsd: pire })).toBe(false);
    for (const p of [0, -1, Number.NaN, Infinity]) expect(sousPlafond({ engageCentimes: 0, plafondUsd: 1, pireUsd: p })).toBe(false);
    expect(sousPlafond({ engageCentimes: Number.NaN, plafondUsd: 1, pireUsd: pire })).toBe(false);
    expect(sousPlafond({ engageCentimes: 0, plafondUsd: -1, pireUsd: pire })).toBe(false);
  });

  it("d) appelSousBarriere : refus sans appel, phrase sans montant ; accord → 1 appel", async () => {
    const reponse = { texte: "{}" } as Awaited<ReturnType<AppelClaude>>;
    const requete = { messages: [] } as unknown as Parameters<AppelClaude>[0];
    for (const verifier of [async () => false, async () => { throw new Error("x"); }]) {
      const appeler = vi.fn(async () => reponse);
      const err = await appelSousBarriere(appeler, verifier)(requete).catch((e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).not.toMatch(/\d|€|\$/);
      expect(appeler).not.toHaveBeenCalled();
    }
    const appeler = vi.fn(async () => reponse);
    expect(await appelSousBarriere(appeler, async () => true)(requete)).toBe(reponse);
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(appeler.mock.calls[0]).toEqual([requete]);
  });

  it("e) par le vrai lecteur : 3 lectures → épuisé, 0 appel ; 2 lectures → 1 appel", async () => {
    const plan = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
    const l = dep(`${ETAPE} lecture`);
    for (const [n, appels] of [[3, 0], [2, 1]] as const) {
      const appeler = vi.fn(async () => ({ texte: "{}" }) as never);
      const r = await lireDemande(
        { phrase: "fais quelque chose de joli pour moi", plan },
        { appeler, claudeAllume: async () => true, lecturesRestantes: () => lecturesRestantes("v", deps(Array(n).fill(l))) },
      );
      expect(appeler).toHaveBeenCalledTimes(appels);
      if (n === 3) expect(r.remarques).toEqual([PHRASE_LECTEUR_EPUISE]);
    }
  });

  it("f) gardes de texte : aucun import d'argent ni _commun, aucun importeur", () => {
    const src = readFileSync("src/services/retouche-chat/plafond-lectures.ts", "utf8");
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      expect(m[1]).not.toMatch(/_commun|credits|depense-claude-video|budget-mensuel|server-only/);
    }
    const fichiers = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (n === "node_modules") return [];
        const p = join(d, n);
        return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    for (const f of fichiers("src")) {
      if (f.endsWith("plafond-lectures.ts")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/plafond-lectures/);
    }
  });
});
