/**
 * Corbeille de 30 jours · écrans : « Mettre à la corbeille » remplace « Supprimer » ; l'onglet Corbeille liste les vidéos
 * des 30 derniers jours avec « Supprimée dans N jours », « Restaurer » et « Supprimer définitivement » (confirmation).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOTE_RESTAURATION, joursRestants, messageCorbeille, noteRestauration, phraseSuppressionDans } from "@/domaine/corbeille";

const { OngletsMesVideos } = await import("@/components/videos/OngletsMesVideos");
const lire = (f: string) => readFileSync(f, "utf8");

describe("corbeille · textes", () => {
  it("jours restants et phrases", () => {
    const t = Date.parse("2026-10-18T10:00:00.000Z");
    expect(joursRestants("2026-10-18T10:00:00.000Z", t)).toBe(30);
    expect(joursRestants("2026-10-18T10:00:00.000Z", t + 29 * 86_400_000)).toBe(1);
    expect(joursRestants("2026-10-18T10:00:00.000Z", t + 31 * 86_400_000)).toBe(0);
    expect(phraseSuppressionDans(12)).toBe("Supprimée dans 12 jours");
    expect(phraseSuppressionDans(1)).toBe("Supprimée dans 1 jour");
  });
  it("message de confirmation : restaurable 30 jours, brouillons Buffer", () => {
    expect(messageCorbeille(1, 0)).toBe("Vidéo mise à la corbeille. Restaurable pendant 30 jours.");
    expect(messageCorbeille(2, 3)).toBe("2 vidéos mises à la corbeille. Restaurable pendant 30 jours. 3 brouillons restent dans Buffer : à supprimer dans Buffer.");
  });
});

describe("corbeille · écrans", () => {
  it("l'onglet Corbeille est visible avec son compteur", () => {
    const html = renderToStaticMarkup(createElement(OngletsMesVideos, { actif: "toutes", compteParFormat: {}, nbToutes: 2, nbBrouillons: 0, nbArchivees: 0, nbCorbeille: 3 }));
    expect(html).toContain("/videos?vue=corbeille");
    expect(html).toContain("Corbeille");
  });
  it("galerie et fiche : « Mettre à la corbeille », la suppression définitive passe par la confirmation", () => {
    for (const f of ["src/components/videos/EnTeteVideo.tsx", "src/components/videos/GalerieVideos.tsx"]) {
      const source = lire(f);
      expect(source, f).toContain("Mettre à la corbeille");
      expect(source, f).not.toMatch(/supprimerVideosAction/);
      for (const appel of source.matchAll(/viderCorbeilleAction\(/g)) expect(source.slice(Math.max(0, appel.index! - 400), appel.index), f).toMatch(/suppression\.demander\(/);
    }
    const galerie = lire("src/components/videos/GalerieVideos.tsx");
    expect(galerie).toContain("restaurerDeLaCorbeilleAction");
    expect(galerie).toContain("phraseSuppressionDans");
  });
  it("aucune action serveur ne supprime sans passer par la corbeille", () => {
    const actions = lire("src/app/(studio)/videos/actions.ts");
    expect(actions).not.toMatch(/export async function supprimerVideosAction/);
    expect(actions).not.toMatch(/supprimerVideosDefinitivement/);
  });
  it("la restauration dit que la page du site n'est pas remise (galerie, bandeau, fiche)", () => {
    expect(NOTE_RESTAURATION).toContain("sa page du site n'est pas remise");
    for (const f of ["src/components/videos/GalerieVideos.tsx", "src/components/videos/BandeauArchivee.tsx", "src/components/videos/EnTeteVideo.tsx"]) expect(lire(f), f).toContain("noteRestauration(");
  });
  it("la note n'est dite que pour une vidéo venue de la corbeille (une simple archive ne retire rien du site)", () => {
    expect(noteRestauration("2026-10-01T00:00:00.000Z")).toBe(`; ${NOTE_RESTAURATION}`);
    expect(noteRestauration(undefined)).toBe("");
  });
  it("la page liste la corbeille dans sa vue", () => {
    const page = lire("src/app/(studio)/videos/page.tsx");
    expect(page).toContain("listerCorbeille");
    expect(page).toContain('corbeille={vue === "corbeille"}');
  });
});
