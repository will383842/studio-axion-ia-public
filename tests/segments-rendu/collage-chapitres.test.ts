import { describe, expect, it, vi } from "vitest";

const appels: { commande: string; args: string[] }[] = [];
const telecharges: string[] = [];
const deposes: string[] = [];
vi.mock("../../studio-rendu/src/outils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../studio-rendu/src/outils")>()),
  telecharger: async (url: string) => void telecharges.push(url),
  deposer: async (url: string, chemin: string) => void deposes.push(`${url}|${chemin}`),
  executer: async (commande: string, args: string[]) => (appels.push({ commande, args }), ""),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({ ...(await importOriginal<typeof import("node:fs/promises")>()), writeFile: async () => undefined, stat: async () => ({ size: 1234 }) }));

import { argumentsCollage, argumentsPoseVoix, collageChapitres, contenuListe, lireParametresCollage } from "../../studio-rendu/src/operations/collage-chapitres";
import type { DemandeRendu } from "../../studio-rendu/src/contrat";

const demande = (parametres: Record<string, unknown>, entrees: Record<string, string>): DemandeRendu => ({ idRendu: "r1", operation: "assemblage", file: "longue", entrees, sortie: { urlDepot: "https://depot", cle: "k" }, parametres });
const contexte = { progression: () => {}, dossier: "/tmp/x", signal: new AbortController().signal };

describe("collage-chapitres : paramètres et arguments (purs)", () => {
  it("lit les paramètres et refuse les invalides", () => {
    expect(lireParametresCollage({ morceaux: ["a", "b"], voix: "v" })).toEqual({ morceaux: ["a", "b"], voix: "v" });
    expect(() => lireParametresCollage({ morceaux: [] })).toThrow(/Aucun morceau/);
    expect(() => lireParametresCollage({ morceaux: ["a", "a"] })).toThrow(/deux fois/);
    expect(() => lireParametresCollage({ morceaux: ["a"], voix: "a" })).toThrow(/voix/);
    expect(() => lireParametresCollage({ morceaux: ["a", 3] })).toThrow(/invalide/);
    expect(lireParametresCollage({ morceaux: Array.from({ length: 200 }, (_, i) => `m${i}`) }).morceaux).toHaveLength(200);
    expect(() => lireParametresCollage({ morceaux: Array.from({ length: 201 }, (_, i) => `m${i}`) })).toThrow(/Trop de morceaux/);
  });
  it("liste de concat : apostrophes protégées", () => {
    expect(contenuListe(["/a/b.mp4", "/c/d'e.mp4"])).toBe("file '/a/b.mp4'\nfile '/c/d'\\''e.mp4'\n");
  });
  it("le collage recopie l'image (-c copy), sans son ; la pose de la voix recopie l'image aussi", () => {
    const a = argumentsCollage("l.txt", "o.mp4");
    expect(a).toEqual(expect.arrayContaining(["-f", "concat", "-c", "copy", "-an"]));
    expect(a).not.toContain("libx264");
    const b = argumentsPoseVoix("v.mp4", "voix.wav", "o.mp4");
    expect(b.join(" ")).toContain("-c:v copy");
    expect(b).not.toContain("libx264");
  });
});

describe("collage-chapitres : opération (FFmpeg et réseau simulés)", () => {
  it("colle les morceaux dans l'ordre puis pose la voix à la fin, et dépose le résultat", async () => {
    appels.length = telecharges.length = deposes.length = 0;
    const r = await collageChapitres(demande({ morceaux: ["m0", "m1"], voix: "voix" }, { m0: "u0", m1: "u1", voix: "uv" }), contexte);
    expect(telecharges).toEqual(["u0", "u1", "uv"]);
    expect(appels).toHaveLength(2);
    expect(appels[0].args).toContain("concat");
    expect(appels[1].args).toContain("-c:v");
    expect(deposes[0]).toContain("collage.mp4");
    // AUTORISATION PERMANENTE (b) : valeur attendue qui change, ESS-6L ajoute `taille` (mesure du fichier déposé, ici le faux `stat`) ; aucune attente retirée.
    expect(r.mesures).toEqual({ morceaux: 2, voix: 1, taille: 1234 });
  });
  it("sans voix : une seule passe, fichier muet déposé", async () => {
    appels.length = deposes.length = 0;
    const r = await collageChapitres(demande({ morceaux: ["m0"] }, { m0: "u0" }), contexte);
    expect(appels).toHaveLength(1);
    expect(deposes[0]).toContain("video-muette.mp4");
    // AUTORISATION PERMANENTE (c) : attente ajoutée (ESS-6L), `taille` présente aussi sans voix.
    expect(r.mesures).toEqual({ morceaux: 1, voix: 0, taille: 1234 });
  });
  it("entrée manquante : refus, rien n'est lancé", async () => {
    appels.length = 0;
    await expect(collageChapitres(demande({ morceaux: ["m0", "m1"] }, { m0: "u0" }), contexte)).rejects.toMatchObject({ erreur: { code: "refuse" } });
    expect(appels).toHaveLength(0);
  });
});
