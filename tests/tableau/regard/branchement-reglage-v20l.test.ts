/**
 * S-10-BRANCHER-v20l : le regard de Claude branché sur la sortie PRINCIPALE du tableau, derrière `regardeur.tableau`
 * (allumé par décision Q7 ; `false`, toute valeur autre que `true` et une lecture en échec l'éteignent), la garde
 * S-10-GARDE-A (2 regards au plus) et le plafond propre `tbreg`. Doubles seulement : aucun appel réel, 0 €.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const relecteurTableau = vi.hoisted(() => vi.fn());
vi.mock("../../../src/services/regardeur-tableau", () => ({ relecteurTableau }));

import { PARAM_REGARD_TABLEAU, regardTableauRegle } from "../../../src/services/regard-tableau-reglage";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { RAISON_NON_RELUE } from "../../../src/moteurs/montage-tableau/garde-regard";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { MiseEnPageTableau } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

const FIN = "Enregistrez cette vidéo pour la refaire";
type Video = { cle: string; dureeSec: number; attendre?: () => Promise<void> };
const BASE = { videoId: "v-1", env: "dev" };
const LU = { imagesLues: 6, remarques: [] };
const lireAvec = (v: unknown) => async (id: string, defaut: unknown) => (id === PARAM_REGARD_TABLEAU ? (v === undefined ? defaut : v) : defaut);
const F = ficheDemonstration as FicheTableau;
const M = {} as MiseEnPageTableau;
const video = (cle: string): Video => ({ cle, dureeSec: 30 });

describe("S-10-BRANCHER · réglage regardeur.tableau", () => {
  it("(a) éteint : false, \"true\", 1, lecture qui lève ⇒ aucun crochet (les outils d'avant, à l'identique), 0 regard", async () => {
    expect(PARAM_REGARD_TABLEAU).toBe("regardeur.tableau");
    const relecteur = vi.fn(async () => LU);
    for (const v of [false, "true", 1]) expect(await regardTableauRegle({ ...BASE, lire: lireAvec(v), relecteur }), String(v)).toEqual({});
    expect(await regardTableauRegle({ ...BASE, lire: async () => { throw new Error("base en panne"); }, relecteur })).toEqual({});
    expect(relecteur).not.toHaveBeenCalled();
  });

  it("(b) allumé (absent = décision Q7, ou true) : un crochet ; le relecteur n'est appelé qu'au regard", async () => {
    for (const v of [undefined, true]) {
      const relecteur = vi.fn(async () => LU);
      const r = await regardTableauRegle({ ...BASE, lire: lireAvec(v), relecteur });
      expect(typeof r.relireImagesCles, String(v)).toBe("function");
      expect(relecteur).not.toHaveBeenCalled();
      expect(await r.relireImagesCles!(F, M, video("p.mp4"))).toEqual(LU);
      expect(relecteur).toHaveBeenCalledTimes(1);
    }
  });

  it("(c) garde : jamais plus de 2 regards ; une autre vidéo que la première (sortie voisine « p-carre.mp4 ») n'est pas regardée", async () => {
    const relecteur = vi.fn(async () => LU);
    const r = await regardTableauRegle({ ...BASE, lire: lireAvec(true), relecteur });
    expect(await r.relireImagesCles!(F, M, video("p.mp4"))).toEqual(LU);
    expect((await r.relireImagesCles!(F, M, video("p-carre.mp4"))).remarques[0].raison).toBe(RAISON_NON_RELUE);
    expect(await r.relireImagesCles!(F, M, video("p.mp4"))).toEqual(LU);
    expect((await r.relireImagesCles!(F, M, video("p.mp4"))).remarques[0].raison).toBe(RAISON_NON_RELUE);
    expect(relecteur).toHaveBeenCalledTimes(2);
    // Une garde PAR outils (par vidéo) : un second jeu d'outils a son propre compteur, l'autre n'est pas touché.
    const r2 = await regardTableauRegle({ ...BASE, lire: lireAvec(true), relecteur });
    expect(await r2.relireImagesCles!(F, M, video("q.mp4"))).toEqual(LU);
    expect(relecteur).toHaveBeenCalledTimes(3);
  });

  it("(d) le relecteur du studio reçoit vidéo, environnement, origine et la phrase de fin de la sortie principale", async () => {
    const regard = vi.fn(async () => LU);
    relecteurTableau.mockReset().mockReturnValue(regard);
    const r = await regardTableauRegle({ ...BASE, origine: "usine", lire: lireAvec(true), finEcran: () => FIN });
    expect(relecteurTableau).not.toHaveBeenCalled();
    await r.relireImagesCles!(F, M, video("p.mp4"));
    expect(relecteurTableau).toHaveBeenCalledWith({ videoId: "v-1", env: "dev", origine: "usine", fin: { ecran: FIN } });
    expect(regard).toHaveBeenCalledWith(F, M, video("p.mp4"));
    relecteurTableau.mockReset().mockReturnValue(regard);
    const sansFin = await regardTableauRegle({ ...BASE, lire: lireAvec(true), finEcran: () => undefined });
    await sansFin.relireImagesCles!(F, M, video("p.mp4"));
    expect(relecteurTableau).toHaveBeenCalledWith({ videoId: "v-1", env: "dev" });
  });
});

describe("S-10-BRANCHER · fabrication : la sortie principale seulement", () => {
  it("(e) deux sorties (vertical, carré) : le crochet reçoit la vidéo de la PREMIÈRE sortie seulement", async () => {
    const recus: Video[] = [];
    const d = doubles(ficheDemonstration, { fin: FIN });
    d.outils.sorties = ["vertical", "carre"];
    d.outils.relireImagesCles = (async (_f: unknown, _m: unknown, v: Video) => (recus.push(v), LU)) as never;
    const r = await fabriquerTableau(d.outils);
    expect(r.sorties?.length ?? 2).toBeGreaterThanOrEqual(1);
    expect(recus).toHaveLength(1);
    expect(recus[0].cle).toBe(r.cles.video);
  });

  it("(f) une seule sortie : comportement d'avant (un regard sur la vidéo finie)", async () => {
    const recus: Video[] = [];
    const d = doubles(ficheDemonstration, { fin: FIN });
    d.outils.relireImagesCles = (async (_f: unknown, _m: unknown, v: Video) => (recus.push(v), LU)) as never;
    const r = await fabriquerTableau(d.outils);
    expect(recus.map((v) => v.cle)).toEqual([r.cles.video]);
  });

  it("(g) branchement : tableau-branchements passe par le réglage (import dynamique), sans porte d'argent ajoutée", () => {
    const b = readFileSync("src/services/tableau-branchements.ts", "utf8");
    expect(b).toContain('await import("./regard-tableau-reglage")).regardTableauRegle({ videoId: c.videoId, env: b.env');
    expect(b).not.toContain('"./regardeur-tableau"');
    const reglage = readFileSync("src/services/regard-tableau-reglage.ts", "utf8");
    expect(reglage).toContain('await import("./regardeur-tableau")');
    expect(reglage.match(/garderRegard\(/g)).toHaveLength(1);
    expect(reglage).not.toMatch(/verifierEtReserver|executerRolePourVideo|\d+(,\d+)? ?(€|\$)/);
  });
});
