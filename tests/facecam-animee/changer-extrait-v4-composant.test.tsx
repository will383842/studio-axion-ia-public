/** R4-03-d2a : composant « Changer un extrait » (v4). Monté nulle part, aucune action importée, 0 €. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SourcePanneauV4, TelephonePanneauV4 } from "@/components/formats/facecam-animee/extraits-v4";
import { ChangerExtraitV4, PHRASE_CHANGEMENT_LANCE_V4 } from "@/components/formats/facecam-animee/ChangerExtraitV4";

const telephones: TelephonePanneauV4[] = [
  { rang: 1, libelle: "Téléphone à 12,4 s (3,0 s)", debut: 12.4, fin: 15.4 },
  { rang: 2, libelle: "Téléphone à 20,0 s (3,3 s)", debut: 20, fin: 23.25 },
];
const sources: SourcePanneauV4[] = [{ videoId: "v1", titre: "Vidéo de mardi" }];
const rendre = (t = telephones) => renderToStaticMarkup(createElement(ChangerExtraitV4, { telephones: t, sources, demander: vi.fn() }));

const RACINE = join(__dirname, "..", "..");
function fichiers(d: string, sortie: string[] = []): string[] {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) fichiers(p, sortie);
    else if (/\.(ts|tsx)$/.test(n)) sortie.push(p);
  }
  return sortie;
}

describe("R4-03-d2a : ChangerExtraitV4", () => {
  it("f) rend le panneau avec les téléphones et les vidéos ; aucune phrase de réponse au départ", () => {
    const h = rendre();
    expect(h).toContain("Changer un extrait");
    expect(h).toContain("Téléphone à 12,4 s (3,0 s)");
    expect(h).toContain("Téléphone à 20,0 s (3,3 s)");
    expect(h).toContain("Vidéo de mardi");
    expect(h).not.toContain(PHRASE_CHANGEMENT_LANCE_V4);
  });

  it("f) aucun téléphone → la phrase « aucun téléphone » du panneau", () => {
    expect(rendre([])).toContain("aucun téléphone");
  });

  it("g) aucune action serveur, aucun montant en euros, apostrophes échappées", () => {
    const t = readFileSync(join(RACINE, "src/components/formats/facecam-animee/ChangerExtraitV4.tsx"), "utf8");
    expect(t).not.toMatch(/"use server"|@\/app\/|@\/services\//);
    expect(t).not.toMatch(/€|euros?\b|\bEUR\b/i);
    expect(PHRASE_CHANGEMENT_LANCE_V4).toBe("Le changement est lancé : la vidéo est refaite gratuitement.");
  });

  it("h) rien dans src/ n'importe ChangerExtraitV4 ni changer-extrait-v4-ecran (montés nulle part)", () => {
    const siens = ["src/components/formats/facecam-animee/ChangerExtraitV4.tsx", "src/services/changer-extrait-v4-ecran.ts"].map((f) => join(RACINE, f));
    for (const f of fichiers(join(RACINE, "src"))) {
      if (siens.includes(f)) continue;
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/ChangerExtraitV4|changer-extrait-v4-ecran/);
    }
  });
});
