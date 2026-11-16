/**
 * G13-05 : les scènes du tableau animé exposées comme segments, lues dans le journal (sans changer `fabriquer.ts`).
 */
import { describe, expect, it } from "vitest";
import { fabriquerTableau, ID_SCENE_FIN, VERSION_FABRICATION, type JournalFabrication } from "../../src/moteurs/montage-tableau/fabriquer";
import { segmentsTableau } from "../../src/moteurs/montage-tableau/segments";
import { contexteBanc } from "./banc/fiches-banc";
import { EXEMPLES, ficheDemonstration } from "./regles/exemples";
import { doubles } from "./fabriquer/doubles";

const FIN = "Enregistrez cette vidéo pour la refaire";
const nomFichier = (cle: string) => cle.slice(cle.lastIndexOf("/") + 1).replace(/\.mp4$/, "");

describe("segmentsTableau", () => {
  it("rend une entrée par scène, dans l'ordre, avec l'empreinte de fabriquer.ts", async () => {
    const d = doubles(ficheDemonstration, { fin: FIN });
    const r = await fabriquerTableau(d.outils);
    const segments = segmentsTableau(d.journal.valeur);
    const ids = [...ficheDemonstration.scenes.map((s) => s.id), ID_SCENE_FIN];
    expect(segments.map((s) => s.id)).toEqual(ids);
    for (const s of segments) {
      expect(s.cle).toBe(r.cles.scenes[s.id]);
      expect(s.empreinte).toMatch(/^[0-9a-f]{32}$/);
      expect(s.empreinte).toBe(nomFichier(s.cle));
      expect(Number.isInteger(s.debutMs) && Number.isInteger(s.finMs)).toBe(true);
      expect(s.finMs).toBeGreaterThan(s.debutMs);
    }
    // Mêmes empreintes que celles des scènes réellement soumises au rendu.
    expect(segments.map((s) => s.cle).sort()).toEqual(d.scenesSoumises().map((x) => x.sortie.cle).sort());
  });

  it("couvre les 4 fiches d'exemple", async () => {
    for (const fiche of Object.values(EXEMPLES)) {
      const d = doubles(fiche, { fin: FIN });
      await fabriquerTableau(d.outils);
      expect(segmentsTableau(d.journal.valeur)).toHaveLength(fiche.scenes.length + 1);
    }
  });

  it("journal absent, vide ou d'une autre version : []", async () => {
    expect(segmentsTableau(null)).toEqual([]);
    expect(segmentsTableau({ version: VERSION_FABRICATION, etapes: {} })).toEqual([]);
    const d = doubles(ficheDemonstration, { fin: FIN });
    await fabriquerTableau(d.outils);
    const autre = { ...structuredClone(d.journal.valeur), version: "fabrication-tableau/0" } as unknown as JournalFabrication;
    expect(segmentsTableau(autre)).toEqual([]);
  });

  it("sortie non verticale : empreintes préfixées du format", async () => {
    const d = doubles(ficheDemonstration, { fin: FIN });
    await fabriquerTableau({ ...d.outils, contexte: contexteBanc(ficheDemonstration, []), sorties: ["vertical", "carre"], dejaVu: { coche: true, le: "2026-10-17" } });
    const j = d.journal.valeur as JournalFabrication;
    const carre = segmentsTableau(j, "carre");
    expect(carre.length).toBeGreaterThan(0);
    for (const s of carre) expect(s.empreinte.startsWith("carre-")).toBe(true);
    expect(carre.map((s) => s.empreinte).every((e, i) => e === nomFichier(carre[i].cle))).toBe(true);
    expect(segmentsTableau(j, "vertical").every((s) => !s.empreinte.startsWith("carre-"))).toBe(true);
    expect(segmentsTableau(j, "horizontal")).toEqual([]);
  });
});
