/** Fiche bloquée par la porte : le sous-titre donne le nombre de pages du TEXTE (« 3 pages, non rendues »), pas « 0 page ». */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CarteCarrousel } from "@/components/visuels/CarteCarrousel";
import { DepotMemoire } from "@/donnees/memoire";
import type { Porte } from "@/domaine/visuels/contrats";
import { libellePages } from "@/domaine/visuels/statuts";
import type { Visuel } from "@/domaine/visuels/visuel";
import { creerDepuisSujet, refaire, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { ficheCarrousel } from "@/visuels/services/vues";

const SPEC_3 = { version: "carrousel/1", alt: "Carrousel inventé", pages: [{ type: "T01", titre: "Titre inventé" }, { type: "T10", message: "Un message" }, { type: "T21" }] };

describe("libellé des pages", () => {
  it("pages rendues ou gardées : « N pages » ; une seule : « 1 page »", () => {
    expect(libellePages({ nbPages: 3 })).toBe("3 pages");
    expect(libellePages({ nbPages: 1 })).toBe("1 page");
  });
  it("aucun texte gardé mais un texte écrit de 3 pages : « 3 pages, non rendues »", () => {
    expect(libellePages({ nbPages: 0, pagesTexte: 3 })).toBe("3 pages, non rendues");
    expect(libellePages({ nbPages: 0, pagesTexte: 1 })).toBe("1 page, non rendue");
  });
  it("ni texte ni page : « aucune page »", () => {
    expect(libellePages({ nbPages: 0 })).toBe("aucune page");
  });
});

describe("carrousel bloqué par la porte", () => {
  /** Dépendances d'un carrousel dont la porte refuse le texte de 3 pages ; `ecrire` est remplaçable (second tour). */
  const dependances = (ecrire: () => Promise<unknown>) => {
    const depot = new DepotMemoire<Visuel>();
    const porte = vi.fn((() => ({ rapport: { version: "porte-carrousel/1", verdict: "rouge", controles: [{ code: "C1", niveau: "rouge", phrase: "Contrôle inventé" }], corrections: [] } })) as Porte);
    let chaine: Promise<unknown> = Promise.resolve();
    const deps = {
      depot,
      texte: () => ({ mode: "simulation", ecrire }),
      porte,
      contextePorte: async () => ({ interditsDans: () => [], faitsDisponibles: false }),
      allume: async () => true,
      rendre: async () => {
        throw new Error("aucun rendu");
      },
      urlLecture: async (cle: string) => `https://stockage.invente/${cle}`,
      verrou: (f: () => Promise<unknown>) => {
        const suite = chaine.then(f, f);
        chaine = suite.catch(() => undefined);
        return suite;
      },
      maintenant: () => "2026-10-19T10:00:00.000Z",
      lireParametre: async <T,>(_id: string, defaut: T) => defaut,
      ecrireParametre: async () => undefined,
    } as unknown as DependancesCarrousels;
    return { deps, depot };
  };
  const ecritRouge = async () => ({ titre: "Titre écrit", spec: SPEC_3, pourquoi: [], mode: "simulation" });

  it("la fiche et la carte disent « Bloqué par la porte · 3 pages, non rendues »", async () => {
    const { deps } = dependances(ecritRouge);
    const { id } = await creerDepuisSujet("Sujet rouge", deps);
    const fiche = await ficheCarrousel(id, deps);
    expect(fiche.statut).toBe("bloque");
    expect(`${fiche.libelleStatut} · ${libellePages(fiche)}`).toBe("Bloqué par la porte · 3 pages, non rendues");
    expect(renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: fiche }))).toContain("Bloqué par la porte · 3 pages, non rendues");
  });
  it("« Refaire » oublie le nombre de pages de l'ancien texte : une réécriture qui échoue ne dit plus « 3 pages, non rendues »", async () => {
    let tour = 0;
    const { deps, depot } = dependances(async () => {
      if (tour++ === 0) return ecritRouge();
      throw new Error("écriture en panne");
    });
    const { id } = await creerDepuisSujet("Sujet rouge", deps);
    expect((await depot.obtenir(id))?.pagesTexte).toBe(3);
    await refaire(id, deps);
    const v = await depot.obtenir(id);
    expect(v?.statut).toBe("bloque");
    expect(v?.pagesTexte).toBeUndefined();
    expect(libellePages(await ficheCarrousel(id, deps))).toBe("aucune page");
  });
  it("l'en-tête de la fiche passe par `libellePages`", () => {
    expect(readFileSync("src/app/(studio)/carrousels/[id]/page.tsx", "utf8")).toMatch(/sousTitre=\{`\$\{fiche\.libelleStatut\} · \$\{libellePages\(fiche\)\}`\}/);
  });
});
