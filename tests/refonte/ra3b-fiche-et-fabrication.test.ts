/** Lot RA3b de la refonte : « Plus » de la fiche d'un sujet garde ses trois commandes ; l'étape n'est affichée que si la donnée la prouve ; la fabrication ne promet « Vous pouvez fermer » que si la boucle tourne. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("RA3b · fiche d'un sujet", () => {
  const src = lire("src/components/generateur/FicheSujet.tsx");
  const debut = src.indexOf("data-plus");
  const fin = src.indexOf("</details>", debut);
  const plus = src.slice(debut, fin);

  it("« Plus » contient Ordre, Tout le sujet et Archiver, avec leurs actions et leurs conditions", () => {
    expect(debut).toBeGreaterThan(0);
    expect(plus).toMatch(/<summary[^>]*min-h-11[^>]*>/);
    expect(plus).toContain('setFeuille("ordre")');
    expect(plus).toContain("Ordre J à J+4");
    expect(plus).toMatch(/p\.aDesVideos \?/);
    expect(plus).toContain("/api/telechargements?sujet=");
    expect(plus).toContain("Tout le sujet");
    expect(plus).toContain("archiverSujetAction(p.id)");
    expect(plus).toContain("Archiver le sujet");
    expect(src.indexOf("<FeuilleOrdre")).toBeGreaterThan(fin);
  });

  it("« Utiliser dans ma vidéo » n'est pas un second orange plein ; le lien Matière ouvre la saisie", () => {
    expect(src).toMatch(/variante="contour-orange"[^>]*>\s*<Link href=\{lienVideo\}>Utiliser dans ma vidéo/);
    expect(src).toContain('href="/ecrire?onglet=matieres&ajout=matiere"');
  });

  it("l'étape n'est affichée que là où la donnée la prouve (même règle que la liste des sujets)", () => {
    expect(src.match(/<PastilleEtapeEcrire[^>]*>/g) ?? []).toEqual(['<PastilleEtapeEcrire etape="ecriture" />']);
    expect(src).toMatch(/!p\.archive && !p\.lignes\.length &&/);
  });
});

describe("RA3b · en-tête de la fabrication (assistant)", () => {
  const src = lire("src/assistant/etapes/Fabrication.tsx");
  const i = src.indexOf("<EnTeteSuivi");
  const appel = src.slice(i, src.indexOf("/>", i));

  it("la phrase dépend de boucleActive", () => {
    expect(appel).toMatch(/phrase=\{[^}]*t\?\.boucleActive/);
    expect(appel).toContain("Quelques minutes de patience.");
  });

  it("en cours, phrase forcée : l'en-tête ne promet pas de fermer", () => {
    const h = texte(renderToStaticMarkup(createElement(EnTeteSuivi, { etat: "en-cours", sansTemps: true, phrase: "Quelques minutes de patience." })));
    expect(h).toContain("Quelques minutes de patience.");
    expect(h).not.toContain("fermer");
  });

  it("arrêtée : le titre ne dit pas qui a arrêté", () => {
    expect(appel).toContain('"Fabrication arrêtée"');
    const h = texte(renderToStaticMarkup(createElement(EnTeteSuivi, { etat: "arretee", sansTemps: true, titre: "Fabrication arrêtée" })));
    expect(h).toContain("Fabrication arrêtée");
    expect(h).not.toContain("Vous avez arrêté");
  });
});
