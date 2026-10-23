/**
 * Écran commun « Relire le script » : les options FACULTATIVES ajoutées pour le tableau animé (brique 7). Sans elles,
 * l'écran ne change pas (`tests/relecture-script-ecran.test.ts`). Rendu statique, aucun réseau.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RelireScript, type ProprietesRelireScript } from "@/components/script/RelireScript";
import { lignesDuTexteTableau } from "@/domaine/relecture-tableau";

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const base: ProprietesRelireScript = { lignes: lignesDuTexteTableau("Une phrase. Une autre."), controler: async () => [], lancer: async () => ({ ok: true }), prixCentimes: 89 };
const rendu = (p: Partial<ProprietesRelireScript>) => renderToStaticMarkup(createElement(RelireScript, { ...base, ...p }));

describe("RelireScript : options du format", () => {
  it("le bouton principal porte le libellé du format (« Découper en scènes ») et son icône", () => {
    const html = rendu({ libelleLancer: "Découper en scènes (≈ 0,89 € au plus)", iconeLancer: "ciseaux" });
    expect(texte(html)).toContain("Découper en scènes (≈ 0,89 € au plus)");
    expect(texte(html)).not.toContain("Lancer la vidéo");
  });

  it("lancement pas encore possible : bouton inactif, la raison est dite", () => {
    const html = rendu({ bloque: "Cochez d'abord la case." });
    expect(texte(html)).toContain("Cochez d'abord la case.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Lancer la vidéo/);
  });

  it("sans option : l'écran validé est inchangé", () => {
    const html = rendu({});
    expect(texte(html)).toContain("Lancer la vidéo (≈ 0,89 €)");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Lancer la vidéo/);
  });
});

describe("RelireScript : socle qualité en observation (option `observation`)", () => {
  it("un encadré repliable de pastilles « info », jamais compté parmi les blocages", () => {
    const html = rendu({ observation: () => [{ niveau: "bloquant", code: "socle-notes", texte: "Socle qualité (observation) : Accroche 10/10." }, { niveau: "bloquant", code: "socle-RT-01", texte: "Une phrase fait 20 mots." }] });
    expect(texte(html)).toContain("Socle qualité (observation) : Accroche 10/10.");
    expect(texte(html)).toContain("Une phrase fait 20 mots.");
    expect(html).toContain("<details");
    // Ramenées en « info » : le bouton n'est pas bloqué.
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Lancer la vidéo/);
  });

  it("une observation qui échoue n'affiche rien et ne casse pas l'écran", () => {
    const html = rendu({
      observation: () => {
        throw new Error("x");
      },
    });
    expect(html).not.toContain("<details");
    expect(texte(html)).toContain("Lancer la vidéo (≈ 0,89 €)");
  });
});
