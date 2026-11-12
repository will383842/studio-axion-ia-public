/** Refonte R3 : éléments communs (statuts, familles, réseaux, orange unique, barre d'étapes, commandes). */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarreEtapesCommune, etatEtape } from "@/components/ui/BarreEtapesCommune";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { repartirCommandes } from "@/components/ui/EnTetePage";
import { PastilleFamille, PastilleReseau, PastilleStatut } from "@/components/ui/PastilleStatut";
import { FAMILLES_CONTENU, ORDRE_STATUTS_USINE, RESEAUX_PASTILLE, STATUTS_USINE } from "@/components/ui/statuts-usine";
import { declarerBoutonPrincipal, nombreBoutonsPrincipaux, varianteNouvelleVideo } from "@/lib/ecran-principal";

describe("statuts de l'usine", () => {
  it("9 statuts, chacun avec son mot et ses jetons --statut-*", () => {
    expect(ORDRE_STATUTS_USINE).toHaveLength(9);
    for (const s of ORDRE_STATUTS_USINE) {
      const d = STATUTS_USINE[s];
      expect(d.fond).toBe(`var(--statut-${s}-fond)`);
      expect(d.texte).toBe(`var(--statut-${s}-texte)`);
      const html = renderToStaticMarkup(createElement(PastilleStatut, { statut: s }));
      expect(html).toContain(d.libelle);
      expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
    }
  });
  it("retouche et refusé en pointillés, publié en contour plein", () => {
    expect(STATUTS_USINE.retouche.bord).toBe("pointille");
    expect(STATUTS_USINE.refuse.bord).toBe("pointille");
    expect(STATUTS_USINE.publie.bord).toBe("plein");
  });
  it("familles et réseaux : toujours le nom écrit, couleurs par jetons", () => {
    for (const f of Object.keys(FAMILLES_CONTENU) as (keyof typeof FAMILLES_CONTENU)[]) {
      expect(renderToStaticMarkup(createElement(PastilleFamille, { famille: f }))).toContain(FAMILLES_CONTENU[f].libelle);
      expect(FAMILLES_CONTENU[f].couleur).toBe(`var(--fam-${f})`);
    }
    for (const r of Object.keys(RESEAUX_PASTILLE) as (keyof typeof RESEAUX_PASTILLE)[]) {
      const html = renderToStaticMarkup(createElement(PastilleReseau, { reseau: r }));
      expect(html).toContain(RESEAUX_PASTILLE[r].libelle);
      expect(html).toContain("var(--res-");
    }
  });
});

describe("carte de contenu à liseré", () => {
  it("le liseré porte le jeton de la famille", () => {
    expect(renderToStaticMarkup(createElement(Carte, { famille: "carrousel" }, "x"))).toContain("border-l-fam-carrousel");
    expect(renderToStaticMarkup(createElement(Carte, null, "x"))).not.toContain("border-l-fam");
  });
});

describe("règle de l'orange : un seul plein par écran", () => {
  it("variantes du bouton : discret et fantôme identiques, un seul principal orange plein", () => {
    const h = (variante: "principal" | "contour" | "contour-orange" | "discret" | "fantome" | "danger") => renderToStaticMarkup(createElement(Bouton, { variante }, "ok"));
    expect(h("principal")).toContain("bg-orange");
    expect(h("contour-orange")).not.toMatch(/(^|[ "])bg-orange/);
    expect(h("contour-orange")).toContain("border-orange");
    expect(h("contour")).toContain("text-texte"); // le contour neutre d'avant la refonte est intact
    expect(h("contour")).toContain("border-trait-fort");
    expect(h("discret")).toContain("text-accent");
    expect(h("fantome")).toContain("text-accent");
    expect(h("danger")).toContain("text-brique");
  });
  it("« Nouvelle vidéo » passe en contour tant qu'un bouton principal est affiché, puis revient", () => {
    expect(nombreBoutonsPrincipaux()).toBe(0);
    expect(varianteNouvelleVideo(nombreBoutonsPrincipaux() > 0)).toBe("plein");
    const retirer = declarerBoutonPrincipal();
    const retirer2 = declarerBoutonPrincipal();
    expect(varianteNouvelleVideo(nombreBoutonsPrincipaux() > 0)).toBe("contour");
    retirer();
    retirer(); // double retrait sans effet
    expect(nombreBoutonsPrincipaux()).toBe(1);
    retirer2();
    expect(varianteNouvelleVideo(nombreBoutonsPrincipaux() > 0)).toBe("plein");
  });
  it("la barre et les onglets du bas appliquent la règle", () => {
    for (const f of ["src/components/coquille/BarreLaterale.tsx", "src/components/coquille/OngletsBas.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s).toContain("useEcranAUnBoutonPrincipal");
      expect(s).toContain("varianteNouvelleVideo");
    }
  });
});

describe("contraste du bouton « Nouvelle vidéo » en contour", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const bloc = (debut: string) => {
    const i = css.indexOf(debut);
    return css.slice(i, css.indexOf("\n}", i));
  };
  const val = (b: string, nom: string) => b.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const rapport = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };
  it("orange-vif sur barre-bouton-fond : au moins 4,5:1 en clair et en sombre", () => {
    for (const b of [bloc(":root {"), bloc(".theme-sombre {")]) {
      const fond = val(b, "barre-bouton-fond");
      const orange = val(b, "orange-vif") || val(bloc(":root {"), "orange-vif");
      expect(fond).toMatch(/^#/);
      expect(rapport(orange, fond)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("la barre n'utilise plus surface-1 pour ce bouton", () => {
    for (const f of ["src/components/coquille/BarreLaterale.tsx", "src/components/coquille/OngletsBas.tsx"]) expect(readFileSync(f, "utf8")).toContain("bg-barre-bouton-fond");
  });
});

describe("barre d'étapes commune", () => {
  it("états faite / ici / à venir", () => {
    expect([0, 1, 2].map((i) => etatEtape(i, 1))).toEqual(["faite", "ici", "a-venir"]);
  });
  it("une seule étape en cours (aria-current), numéros et noms écrits", () => {
    const etapes = ["Sujet", "Réglages", "Relecture"].map((libelle) => ({ cle: libelle, libelle }));
    const html = renderToStaticMarkup(createElement(BarreEtapesCommune, { etapes, courante: 1 }));
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain("Réglages");
    expect(html).toContain("(faite)");
    expect(html).toContain("(en cours)");
  });
});

describe("en-tête de page : 6 commandes au plus", () => {
  it("le surplus passe dans « Plus »", () => {
    expect(repartirCommandes([1, 2, 3])).toEqual({ visibles: [1, 2, 3], plus: [] });
    const r = repartirCommandes([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(r.visibles).toHaveLength(5);
    expect(r.plus).toEqual([6, 7, 8]);
  });
});
