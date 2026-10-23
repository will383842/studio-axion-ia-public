/**
 * Lanceur et formats de sortie : `--sorties` lu et refusé s'il est inconnu ; en SIMULATION (aucun appel réseau), une
 * vidéo par sortie, le compte rendu et le journal listent chaque sortie.
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErreurArguments, lancer, lireArguments } from "../../../scripts/tableau/fabriquer";
import type { JournalFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import { ficheDemonstration } from "../regles/exemples";

const CONTEXTE = {
  aujourdhui: "2026-10-11",
  sourcesChiffres: ["source-delai-relance"],
  preuves: [{ id: "preuve-compte-rendu", statut: "validee", perimeLe: "2027-01-09" }],
  matieres: [
    { id: "matiere-demo-questions", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" },
    { id: "matiere-demo-idees", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" },
    { id: "matiere-demo-relance", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" },
  ],
  contenusPreuves: { "matiere-demo-idees": { phrase: "Donnez-moi trois idées", testeLe: "2026-10-09" } },
};

let dossier: string;
let fetchEspion: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), "tb-sorties-"));
  fetchEspion = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Aucun appel réseau dans les tests."));
});
afterEach(() => fetchEspion.mockRestore());

describe("--sorties", () => {
  it("lu, dédoublonné ; absent : rien (vertical par défaut) ; inconnu : refusé", () => {
    expect(lireArguments(["--fiche", "f", "--personnage", "p", "--sorties", "vertical,carre,horizontal"]).sorties).toEqual(["vertical", "carre", "horizontal"]);
    expect(lireArguments(["--fiche", "f", "--personnage", "p"]).sorties).toBeUndefined();
    expect(() => lireArguments(["--fiche", "f", "--personnage", "p", "--sorties", "carre,cinema"])).toThrow(ErreurArguments);
  });

  it("simulation à trois sorties : une vidéo par sortie, listées dans le compte rendu et le journal", async () => {
    const fiche = join(dossier, "fiche.json");
    const contexte = join(dossier, "contexte.json");
    await writeFile(fiche, JSON.stringify(ficheDemonstration));
    await writeFile(contexte, JSON.stringify(CONTEXTE));
    const lignes: string[] = [];
    const code = await lancer({ fiche, contexte, personnage: "williams", reel: false, accordCentimes: 100, dejaVu: "2026-10-10", dossier, sorties: ["vertical", "portrait", "carre"] }, { ecrire: (l) => lignes.push(l) });
    expect(code, lignes.join("\n")).toBe(0);
    expect(fetchEspion).not.toHaveBeenCalled();
    const texte = lignes.join("\n");
    expect(texte).toContain("Sorties :");
    expect(texte).toContain("Vertical 9:16 (1080 × 1920) pour TikTok, Reels Instagram");
    expect(texte).toContain("Portrait 4:5 (1080 × 1350) pour Fil Instagram, Fil Facebook");
    expect(texte).toContain("Carré 1:1 (1080 × 1080) pour LinkedIn, Fil Facebook");
    const journal = JSON.parse(await readFile(join(dossier, "journal.json"), "utf8")) as JournalFabrication;
    expect(journal.resume?.map((s) => [s.format, s.largeur, s.hauteur])).toEqual([
      ["vertical", 1080, 1920],
      ["portrait", 1080, 1350],
      ["carre", 1080, 1080],
    ]);
    const video = JSON.parse(await readFile(join(dossier, "video-brouillon.json"), "utf8"));
    expect(video.ratios).toEqual(["9:16", "4:5", "1:1"]);
  });
});
