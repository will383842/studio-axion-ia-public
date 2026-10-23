/**
 * « Nouveau sujet » : un texte déjà écrit (3 phrases ou plus) y sert de matière et sera réécrit. L'écran le dit et
 * renvoie vers « Nouvelle vidéo » pour le garder mot pour mot. Une idée courte : aucun message.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avertissementTexteColle } from "@/domaine/avertissement-texte-colle";

const TEXTE_3_PHRASES = "Les factures de ChatGPT surprennent les dirigeants. Beaucoup ne savent pas ce qu'ils paient. Voici comment reprendre la main.";

describe("avertissement « vous avez déjà votre texte »", () => {
  it("un texte de 3 phrases : le message, avec le format choisi", () => {
    expect(avertissementTexteColle(TEXTE_3_PHRASES, "Avocat")).toBe(
      "Vous avez déjà votre texte ? Pour le garder mot pour mot, collez-le dans Nouvelle vidéo › Avocat. Ici, il sert de matière et sera réécrit.",
    );
  });

  it("une idée courte, vide ou de 2 phrases : aucun message", () => {
    expect(avertissementTexteColle("Les factures ChatGPT", "Avocat")).toBeNull();
    expect(avertissementTexteColle("", "Avocat")).toBeNull();
    expect(avertissementTexteColle("Une phrase. Une autre phrase.", "Avocat")).toBeNull();
  });

  it("sans format choisi, le message reste lisible", () => {
    expect(avertissementTexteColle(TEXTE_3_PHRASES, undefined)).toContain("collez-le dans Nouvelle vidéo › votre format.");
  });

  it("l'écran Nouveau sujet l'affiche sous le champ", () => {
    const src = readFileSync(join(__dirname, "../src/components/generateur/EcranSujet.tsx"), "utf8");
    expect(src).toMatch(/avertissementTexteColle\(idee, reglages\.format\?\.nom\)/);
  });
});
