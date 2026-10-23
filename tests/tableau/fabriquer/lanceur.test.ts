/**
 * Lanceur de la fabrication du tableau animé (TB-06a) : arguments, coût affiché avant, accord de dépense, simulation
 * sans aucun client réel, vidéo brouillon. Aucun vrai appel : `fetch` est surveillé, le mode réel est un double.
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErreurArguments, branchementsSimules, lancer, lireArguments, TARIF_VOIX_CENTIMES_PAR_CARACTERE, type Branchements } from "../../../scripts/tableau/fabriquer";
import { estimerFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import { copie, ficheDemonstration } from "../regles/exemples";

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
let lignes: string[];
let fetchEspion: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), "tb-lanceur-"));
  lignes = [];
  fetchEspion = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Aucun appel réseau dans les tests."));
});
afterEach(() => {
  fetchEspion.mockRestore();
});

async function fichiers(fiche: unknown = ficheDemonstration): Promise<{ fiche: string; contexte: string }> {
  const f = join(dossier, "fiche.json");
  const c = join(dossier, "contexte.json");
  await writeFile(f, JSON.stringify(fiche));
  await writeFile(c, JSON.stringify(CONTEXTE));
  return { fiche: f, contexte: c };
}

const accordSuffisant = () => (estimerFabrication(ficheDemonstration, TARIF_VOIX_CENTIMES_PAR_CARACTERE).centimes / 100).toFixed(2);

function reelsEspion() {
  const appels: string[] = [];
  const reels = async (personnage: string, videoId: string): Promise<Branchements> => {
    appels.push(`${personnage}/${videoId}`);
    return branchementsSimules(dossier, videoId);
  };
  return { appels, reels };
}

describe("arguments", () => {
  it("lit les options ; simulation par défaut ; accord en euros", () => {
    const a = lireArguments(["--fiche", "f.json", "--personnage", "williams", "--fin", "Une fin", "--accord-depense", "0,50", "--deja-vu", "2026-10-10"]);
    expect(a).toMatchObject({ fiche: "f.json", personnage: "williams", fin: "Une fin", reel: false, accordCentimes: 50, dejaVu: "2026-10-10" });
    expect(lireArguments(["--fiche", "f", "--personnage", "p", "--reel"]).reel).toBe(true);
  });

  it("refuse une option manquante ou inconnue", () => {
    expect(() => lireArguments(["--personnage", "p"])).toThrow(ErreurArguments);
    expect(() => lireArguments(["--fiche", "f"])).toThrow("--personnage");
    expect(() => lireArguments(["--fiche", "f", "--personnage", "p", "--vite"])).toThrow("Option inconnue");
    expect(() => lireArguments(["--fiche", "f", "--personnage", "p", "--accord-depense", "beaucoup"])).toThrow("illisible");
  });
});

describe("lanceur", () => {
  it("fiche invalide : arrêt (code 2) avec les raisons, rien n'est construit", async () => {
    const f = copie(ficheDemonstration);
    f.scenes[0].elements = [];
    const { appels, reels } = reelsEspion();
    const code = await lancer({ ...(await fichiers(f)), personnage: "williams", reel: true, accordCentimes: 100 }, { ecrire: (l) => lignes.push(l), reels });
    expect(code).toBe(2);
    expect(lignes[0]).toBe("Fiche refusée :");
    expect(appels).toEqual([]);
  });

  it("affiche le coût estimé AVANT et s'arrête sans accord (code 3), sans rien construire", async () => {
    const { appels, reels } = reelsEspion();
    const code = await lancer({ ...(await fichiers()), personnage: "williams", reel: true }, { ecrire: (l) => lignes.push(l), reels });
    expect(code).toBe(3);
    expect(lignes[0]).toMatch(/^Coût estimé : \d+,\d{2} € au plus/);
    expect(lignes.at(-1)).toContain("--accord-depense");
    expect(appels).toEqual([]);
  });

  it("accord inférieur au coût : arrêt (code 3)", async () => {
    const { appels, reels } = reelsEspion();
    const code = await lancer({ ...(await fichiers()), personnage: "williams", reel: true, accordCentimes: 0 }, { ecrire: (l) => lignes.push(l), reels });
    expect(code).toBe(3);
    expect(lignes.at(-1)).toContain("inférieur");
    expect(appels).toEqual([]);
  });

  it("sans --reel : aucun client réel construit, aucun appel réseau, vidéo brouillon écrite", async () => {
    const { appels, reels } = reelsEspion();
    const code = await lancer({ ...(await fichiers()), personnage: "williams", reel: false, accordCentimes: Math.round(Number(accordSuffisant()) * 100), dejaVu: "2026-10-10", fin: "Enregistrez-la", dossier }, { ecrire: (l) => lignes.push(l), reels });
    expect(lignes.join("\n")).toContain("Mode SIMULATION");
    expect(code, lignes.join("\n")).toBe(0);
    expect(appels).toEqual([]);
    expect(fetchEspion).not.toHaveBeenCalled();
    const video = JSON.parse(await readFile(join(dossier, "video-brouillon.json"), "utf8"));
    expect(video).toMatchObject({ id: `v-${ficheDemonstration.videoId}`, formatId: "tableau-anime", statut: "brouillon", distribution: [{ role: "voix", personnageId: "williams" }] });
    expect(lignes.join("\n")).toContain("Scènes rendues : s01");
  });

  it("2e lancement identique en simulation : tout est repris, aucune scène rendue", async () => {
    const args = { ...(await fichiers()), personnage: "williams", reel: false, accordCentimes: 100, dejaVu: "2026-10-10", dossier };
    expect(await lancer(args, { ecrire: () => undefined })).toBe(0);
    expect(await lancer(args, { ecrire: (l) => lignes.push(l) })).toBe(0);
    expect(lignes.join("\n")).toContain("Scènes rendues : aucune");
    expect(lignes.join("\n")).toContain("Coût de ce lancement : 0,00 €");
  });

  it("avec --reel et un accord suffisant : les branchements réels sont demandés une fois", async () => {
    const { appels, reels } = reelsEspion();
    const code = await lancer({ ...(await fichiers()), personnage: "williams", reel: true, accordCentimes: 100, dejaVu: "2026-10-10", dossier }, { ecrire: (l) => lignes.push(l), reels });
    expect(code, lignes.join("\n")).toBe(0);
    expect(appels).toEqual([`williams/${ficheDemonstration.videoId}`]);
    expect(lignes.join("\n")).toContain("Mode RÉEL");
  });

  it("déjà-vu non coché : fabrication arrêtée à l'étape « script » (code 4), aucune voix", async () => {
    const code = await lancer({ ...(await fichiers()), personnage: "williams", reel: false, accordCentimes: 100, dossier }, { ecrire: (l) => lignes.push(l) });
    expect(code).toBe(4);
    expect(lignes.join("\n")).toContain("« script »");
  });
});
