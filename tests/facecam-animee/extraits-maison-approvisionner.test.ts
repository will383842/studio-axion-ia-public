/** C4-U4.4a : enveloppe injectable d'approvisionnement `axion:`. Aucun appel réel : tout par ports factices. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { avecExtraitsMaisonV4, type PortsAxionV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/approvisionner";

type Defaut = Parameters<typeof avecExtraitsMaisonV4<{ k: number }>>[0];
type Plan = Parameters<Defaut>[0];

const fen = (recherche: string) => ({ debut: 2, fin: 5, media: "fenetre-1", recherche });
const planDe = (recherche: string): Plan => Object.freeze({ fenetres: [Object.freeze(fen(recherche))] }) as unknown as Plan;
const extrait = { cle: "archive/v1", debutSec: 4, longueurSec: 3 };
const retourDefaut = { plan: { fenetres: [] }, choix: [], manques: [], supprimees: [], empreintes: ["d"] };

function montage(ports: Partial<PortsAxionV4> = {}) {
  const defaut = vi.fn(async (_p: Plan, _o: { k: number }) => retourDefaut as unknown as Awaited<ReturnType<Defaut>>);
  const p = { trouver: vi.fn(async () => extrait), preparer: vi.fn(async () => "fenetre-1" as string | null), ...ports } as PortsAxionV4;
  return { defaut, p, f: avecExtraitsMaisonV4<{ k: number }>(defaut, p) };
}

describe("avecExtraitsMaisonV4", () => {
  it("sans axion: : defaut appelé avec les mêmes références, ports intacts", async () => {
    const { defaut, p, f } = montage();
    const plan = planDe("un bureau"); const o = { k: 1 };
    expect(await f(plan, o)).toBe(retourDefaut);
    expect(defaut).toHaveBeenCalledTimes(1);
    expect(defaut.mock.calls[0][0]).toBe(plan);
    expect(defaut.mock.calls[0][1]).toBe(o);
    expect(p.trouver).not.toHaveBeenCalled();
    expect(p.preparer).not.toHaveBeenCalled();
  });

  it("axion: trouvé : résultat servi par l'archive, defaut jamais appelé", async () => {
    const { defaut, p, f } = montage();
    const plan = planDe("axion:Will parle café");
    const r = await f(plan, { k: 1 });
    expect(defaut).not.toHaveBeenCalled();
    expect(p.trouver).toHaveBeenCalledTimes(1);
    expect(p.trouver).toHaveBeenCalledWith("will parle café", 3);
    expect(p.preparer).toHaveBeenCalledTimes(1);
    expect(p.preparer).toHaveBeenCalledWith(extrait, "fenetre-1");
    expect(r.plan.fenetres[0]).toMatchObject({ media: "fenetre-1", video: true, depuisSec: 0 });
    expect(r.choix).toEqual([expect.objectContaining({ fenetre: 0, mediaInitial: "fenetre-1", source: "mes-images", id: "archive/v1", genre: "video", cle: "fenetre-1", scene: "axion:Will parle café" })]);
    expect(r.manques).toEqual([]); expect(r.supprimees).toEqual([]); expect(r.empreintes).toEqual(["archive/v1"]);
    expect(plan.fenetres[0]).toEqual(fen("axion:Will parle café"));
  });

  it("axion: trouvé : le media et la cle rendus sont la clé FINALE déposée, mediaInitial reste celui de la fenêtre", async () => {
    const finale = "studio/dev/facecam-animee/v-1/videos/v4-0-0.mp4";
    const { defaut, p, f } = montage({ preparer: vi.fn(async () => finale) });
    const plan = Object.freeze({ fenetres: [Object.freeze({ debut: 0, fin: 3, media: "v4-0-0.mp4", recherche: "axion:café" })] }) as unknown as Plan;
    const r = await f(plan, { k: 1 });
    expect(defaut).not.toHaveBeenCalled();
    expect(p.preparer).toHaveBeenCalledWith(extrait, "v4-0-0.mp4");
    expect(r.plan.fenetres[0].media).toBe(finale);
    expect(r.choix[0].cle).toBe(finale);
    expect(r.choix[0].mediaInitial).toBe("v4-0-0.mp4");
  });

  it("axion: sans mot utile : repli ordinaire sans préfixe, ports jamais appelés", async () => {
    const { defaut, p, f } = montage();
    expect(await f(planDe("axion: le de"), { k: 1 })).toBe(retourDefaut);
    expect(p.trouver).not.toHaveBeenCalled();
    expect(defaut.mock.calls[0][0].fenetres[0].recherche.startsWith("axion")).toBe(false);
  });

  const cas: [string, Partial<PortsAxionV4>][] = [
    ["introuvable", { trouver: async () => null }],
    ["préparation ratée", { preparer: async () => null }],
    ["port qui lève", { trouver: async () => { throw new Error("boum"); } }],
    ["préparation qui lève", { preparer: async () => { throw new Error("boum"); } }],
  ];
  it.each(cas)("axion: %s : defaut avec recherche sans préfixe (≤ 60)", async (_n, ports) => {
    const { defaut, f } = montage(ports);
    const longue = "axion:" + "café ".repeat(30);
    const plan = planDe(longue);
    expect(await f(plan, { k: 2 })).toBe(retourDefaut);
    expect(defaut).toHaveBeenCalledTimes(1);
    const rech = defaut.mock.calls[0][0].fenetres[0].recherche;
    expect(rech.startsWith("axion")).toBe(false);
    expect(rech.length).toBeGreaterThan(0);
    expect(rech.length).toBeLessThanOrEqual(60);
    expect(plan.fenetres[0].recherche).toBe(longue);
  });

  it("garde statique : imports interdits, et rien dans src/ ne l'importe", () => {
    const src = readFileSync("src/moteurs/montage-facecam-animee/extraits-maison/approvisionner.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join("\n");
    expect(imports).not.toMatch(/@\/services\/|credits|budget|depense|couts|videos-v4-studio/i);
    const parcourir = (d: string): string[] => readdirSync(d).flatMap((n) => {
      const c = join(d, n);
      return statSync(c).isDirectory() ? parcourir(c) : /\.(ts|tsx)$/.test(n) && !c.endsWith("extraits-maison/approvisionner.ts") ? [c] : [];
    });
    const importeurs = parcourir("src").filter((c) => /extraits-maison\/approvisionner/.test(readFileSync(c, "utf8")));
    // MAJ 20/11 (FA-SERVICE-INV-v20h, voulue, à relire) : le service de la face caméra animée est le seul importeur permis, en import
    // dynamique derrière le réglage `facecamAnimee.extraitsMaison` (éteint par défaut). Tout AUTRE fichier de src/ qui l'importe reste refusé.
    expect(importeurs).toEqual(["src/services/facecam-animee.ts"]);
    const service = readFileSync("src/services/facecam-animee.ts", "utf8");
    expect(service).not.toMatch(/^import .*extraits-maison\/approvisionner/m);
    expect(service.indexOf("if (extraitsMaison)")).toBeGreaterThan(-1);
    expect(service.indexOf("if (extraitsMaison)")).toBeLessThan(service.indexOf('import("@/moteurs/montage-facecam-animee/extraits-maison/approvisionner")'));
  });
});
