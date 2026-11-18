/**
 * Ne pas supprimer : adresse encore donnée au diffuseur pour lire la vidéo.
 *
 * Fiche L7-31 : le relais /api/media-buffer/<jeton>/video.mp4 est encore émis à chaque envoi (urlVideoPourBuffer).
 * Ce test (lecture de sources) échoue si l'une des trois conditions devient fausse. Sa suppression, avec celle du relais,
 * relève de la fiche L7-31b, à écrire seulement quand : (a) urlVideoPourBuffer donne /api/medias-publics/... ;
 * (b) 30 jours ont passé depuis le dernier jeton /api/media-buffer émis ; (c) la reprise BF-01 est tranchée.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const racine = process.cwd();
const lire = (chemin: string): string => readFileSync(join(racine, chemin), "utf8");

/** Corps de la fonction `nom` : de sa déclaration jusqu'à la première accolade fermante en début de ligne. */
function corpsFonction(source: string, nom: string): string {
  const debut = source.indexOf(`function ${nom}(`);
  expect(debut, `function ${nom} introuvable`).toBeGreaterThanOrEqual(0);
  const fin = source.indexOf("\n}", debut);
  expect(fin).toBeGreaterThan(debut);
  return source.slice(debut, fin);
}

describe("L7-31 : le relais des médias est encore vivant", () => {
  it("(1) publications.ts appelle adresseRelaisBuffer dans urlVideoPourBuffer", () => {
    const source = lire("src/services/publications.ts");
    expect(source).toMatch(/import \{[^}]*\badresseRelaisBuffer\b[^}]*\} from "\.\/relais-buffer"/);
    expect(corpsFonction(source, "urlVideoPourBuffer")).toMatch(/\badresseRelaisBuffer\(/);
  });

  it("(2) la route /api/media-buffer/[jeton]/[nom] existe", () => {
    expect(existsSync(join(racine, "src/app/api/media-buffer/[jeton]/[nom]/route.ts"))).toBe(true);
  });

  it("(3) proxy.ts laisse passer l'adresse exacte /api/media-buffer/<jeton>/video.mp4", () => {
    const source = lire("src/proxy.ts");
    const ligne = source.split("\n").find((l) => l.includes("const PUBLICS"));
    expect(ligne, "liste PUBLICS introuvable").toBeDefined();
    expect(ligne).toContain(String.raw`/^\/api\/media-buffer\/[A-Za-z0-9_.-]+\/video\.mp4$/`);
  });
});
