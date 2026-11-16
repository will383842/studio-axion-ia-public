/**
 * BUF-03a : la feuille d'envoi porte le nom « FeuilleEnvoyer » (comportement identique).
 * Le nouveau fichier existe, l'ancien a disparu ; la barre d'actions utilise le nouveau nom.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const racine = join(__dirname, "..", "..");
const lire = (f: string) => readFileSync(join(racine, f), "utf8");

describe("BUF-03a · nom de la feuille d'envoi", () => {
  it("le fichier FeuilleEnvoyer.tsx existe et exporte FeuilleEnvoyer", () => {
    expect(existsSync(join(racine, "src/components/publication/FeuilleEnvoyer.tsx"))).toBe(true);
    expect(lire("src/components/publication/FeuilleEnvoyer.tsx")).toContain("export function FeuilleEnvoyer()");
  });

  it("l'ancien fichier FeuilleEnvoyerBuffer.tsx n'existe plus", () => {
    expect(existsSync(join(racine, "src/components/publication/FeuilleEnvoyerBuffer.tsx"))).toBe(false);
  });

  it("la barre d'actions importe et affiche FeuilleEnvoyer", () => {
    const barre = lire("src/components/publication/BarreActionsVideo.tsx");
    expect(barre).toContain('import { FeuilleEnvoyer } from "./FeuilleEnvoyer";');
    expect(barre).toContain("<FeuilleEnvoyer />");
    expect(barre).not.toContain("FeuilleEnvoyerBuffer");
    expect(barre).toContain("(Télécharger, Partager, Envoyer)");
  });
});
