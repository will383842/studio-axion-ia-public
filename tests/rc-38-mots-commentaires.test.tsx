/**
 * RC-38 : mot-clé, guide et commentaires dans l'aperçu (lecture seule).
 * Le bloc est sans état : les données lui sont fournies (le service des mots n'est jamais appelé ici ni modifié).
 * Données fictives, aucun appel réel.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlocMotsCommentaires, type MotsPublication } from "@/components/calendrier/BlocMotsCommentaires";

const rendre = (el: ReactElement) => renderToStaticMarkup(el);
const lisible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/\s+/g, " ");
const base: MotsPublication = { mot: "DEVIS", guide: "Guide du devis en 5 minutes", commentaires: 12 };
const texte = (m: MotsPublication | null | undefined, reseau = "instagram") => lisible(rendre(<BlocMotsCommentaires reseau={reseau} mots={m} />));

describe("RC-38 : bloc mots et commentaires", () => {
  it("affiche le mot, le guide et le nombre de commentaires", () => {
    const t = texte(base);
    expect(t).toContain("Mot-clé : DEVIS");
    expect(t).toContain("Guide associé : Guide du devis en 5 minutes");
    expect(t).toContain("12 commentaires");
  });
  it("accorde le singulier, dit « Aucun commentaire » à zéro", () => {
    expect(texte({ ...base, commentaires: 1 })).toContain("1 commentaire");
    expect(texte({ ...base, commentaires: 1 })).not.toContain("1 commentaires");
    expect(texte({ ...base, commentaires: 0 })).toContain("Aucun commentaire");
  });
  it("nombre inconnu, négatif, décimal, NaN ou infini : jamais un chiffre inventé", () => {
    for (const c of [null, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const t = texte({ ...base, commentaires: c });
      expect(t).toContain("Nombre de commentaires indisponible");
      expect(t).not.toMatch(/\d+ commentaire|Aucun commentaire/);
    }
  });
  it("pas de mot (absent, vide, espaces, donnée absente) : une phrase claire, ni guide ni chiffre", () => {
    for (const m of [null, undefined, { ...base, mot: null }, { ...base, mot: "" }, { ...base, mot: "   " }]) {
      const t = texte(m);
      expect(t).toContain("Aucun mot-clé sur cette publication");
      expect(t).not.toContain("Guide associé");
    }
  });
  it("mot sans guide : le dit en clair", () => {
    expect(texte({ ...base, guide: null })).toContain("Aucun guide associé");
    expect(texte({ ...base, guide: "  " })).toContain("Aucun guide associé");
  });
  it("échappe le texte reçu (aucune balise vivante)", () => {
    const html = rendre(<BlocMotsCommentaires reseau="instagram" mots={{ ...base, mot: "<b>X</b>", guide: "<script>1</script>" }} />);
    expect(html).not.toContain("<b>X");
    expect(html).not.toContain("<script>");
  });
  it("réponses aux commentaires : à la main sur LinkedIn et TikTok, au mot-clé (bientôt) ailleurs", () => {
    expect(texte(base, "linkedin")).toContain("Réponses aux commentaires : toujours à la main sur LinkedIn.");
    expect(texte(base, "tiktok")).toContain("Réponses aux commentaires : toujours à la main sur TikTok.");
    expect(texte(base, "instagram")).toContain("Réponses aux commentaires : réponse automatique au mot-clé (bientôt).");
    expect(texte(base, "facebook")).toContain("Réponses aux commentaires : réponse automatique au mot-clé (bientôt).");
    expect(texte(null, "linkedin")).toContain("toujours à la main sur LinkedIn");
    expect(texte(null, "instagram")).not.toContain("réponse automatique");
  });
  it("lecture seule : aucun bouton ni champ de saisie", () => {
    const html = rendre(<BlocMotsCommentaires reseau="instagram" mots={base} />);
    expect(html).not.toMatch(/<(button|input|textarea|select|form|a )/);
  });
  it("vocabulaire : jamais « abonné » ni « abonnement »", () => {
    for (const r of ["instagram", "linkedin", "facebook", "tiktok", "inconnu"]) {
      expect(texte(base, r).toLowerCase()).not.toMatch(/abonn/);
      expect(texte(null, r).toLowerCase()).not.toMatch(/abonn/);
    }
  });
  it("réseau inconnu : nom neutre, pas de plantage", () => {
    expect(texte(base, "inconnu")).toContain("Mot-clé : DEVIS");
  });
});
