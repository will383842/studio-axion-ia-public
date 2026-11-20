/**
 * CLAUDE-REGARD-c-a : le branchement du relecteur dans `fabriquerTableau` est une dépendance INJECTABLE et facultative,
 * absente par défaut. Sans elle : aucun appel à `relecteurTableau`, aucun appel à Claude, 0 $, sortie identique.
 * Avec une fausse dépendance : elle reçoit la vidéo finie, et son verdict reste indicatif (aucun blocage).
 */
import { describe, expect, it, vi } from "vitest";

const relecteurTableau = vi.hoisted(() => vi.fn());
vi.mock("../../../src/services/regardeur-tableau", () => ({ relecteurTableau }));

import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

const FIN = "Enregistrez cette vidéo pour la refaire";
type Video = { cle: string; dureeSec: number; attendre?: () => Promise<void> };

describe("branchement du relecteur dans fabriquerTableau", () => {
  it("(1) sans dépendance : relecteurTableau jamais appelé, relecture « non faite », sortie inchangée", async () => {
    const a = await fabriquerTableau(doubles(ficheDemonstration, { fin: FIN }).outils);
    const b = await fabriquerTableau(doubles(ficheDemonstration, { fin: FIN }).outils);
    expect(relecteurTableau).not.toHaveBeenCalled();
    const l = a.controles.lignes.find((x) => x.libelle === "Relecture des images clés");
    expect(l?.etat).toBe("non-fait");
    expect(l?.raison).toContain("aucun relecteur fourni");
    expect(JSON.stringify(a.controles)).toBe(JSON.stringify(b.controles));
    expect(a.cles.video).toBe(b.cles.video);
  });

  it("(2) avec une fausse dépendance : elle reçoit la vidéo finie ; ses remarques restent indicatives", async () => {
    const base = await fabriquerTableau(doubles(ficheDemonstration, { fin: FIN }).outils);
    const recus: Video[] = [];
    const d = doubles(ficheDemonstration, { fin: FIN });
    d.outils.relireImagesCles = (async (_f: unknown, _m: unknown, video: Video) => {
      recus.push(video);
      return { imagesLues: 6, remarques: [{ image: 2, raison: "texte coupé." }] };
    }) as never;
    const r = await fabriquerTableau(d.outils);
    expect(recus).toHaveLength(1);
    expect(recus[0].cle).toBe(r.cles.video);
    expect(recus[0].dureeSec).toBeGreaterThan(0);
    expect(r.controles.indicatifs.some((x) => x.libelle === "Relecture des images clés" && x.raison.includes("texte coupé"))).toBe(true);
    expect(r.controles.bloquants).toEqual(base.controles.bloquants);
    expect(r.controles.verdict).toBe("livrable");
    expect(relecteurTableau).not.toHaveBeenCalled();
  });
});
