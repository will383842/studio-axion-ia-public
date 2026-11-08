/**
 * Lot E (1) : chaque phrase envoyée à la voix se termine par une ponctuation, et deux phrases ne sont plus collées
 * « Bonjour à vous Merci » (la voix « continuait » et la fin de phrase ne retombait pas). Rouge avant `voix-phrases.ts`.
 */
import { describe, expect, it } from "vitest";
import { joindrePhrasesPourVoix, ponctuerPhrase } from "@/domaine/voix-phrases";
import { texteDuCorps, texteDuCorpsPourVoix, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";

describe("point final automatique", () => {
  it("ajoute un point à une phrase qui n'en a pas, garde ? ! … et remplace une virgule ou deux-points final", () => {
    expect(ponctuerPhrase("Bonjour à vous")).toBe("Bonjour à vous.");
    expect(ponctuerPhrase("  Vous le faites ?  ")).toBe("Vous le faites ?");
    expect(ponctuerPhrase("Super !")).toBe("Super !");
    expect(ponctuerPhrase("Et voilà…")).toBe("Et voilà…");
    expect(ponctuerPhrase("D'abord,")).toBe("D'abord.");
    expect(ponctuerPhrase("Trois choses :")).toBe("Trois choses.");
    expect(ponctuerPhrase("Il dit « oui »")).toBe("Il dit « oui ».");
    expect(ponctuerPhrase("Il dit « oui. »")).toBe("Il dit « oui. »");
    expect(ponctuerPhrase("   ")).toBe("");
  });

  it("deux phrases ne sont jamais collées sans ponctuation", () => {
    const t = joindrePhrasesPourVoix(["Bonjour à vous", "Merci", "", "On commence ?"]);
    expect(t).toBe("Bonjour à vous. Merci. On commence ?");
    expect(t).not.toMatch(/vous Merci/);
  });

  it("le corps du cas concret envoyé à la voix a un point par écran ; le texte de la fiche reste intact", () => {
    const fiche = { ecrans: [{ texteDit: "Vous perdez du temps" }, { texteDit: "Axion IA le fait pour vous." }, { texteDit: "Et chez vous" }] } as unknown as FicheEcrans;
    expect(texteDuCorps(fiche)).toBe("Vous perdez du temps Axion IA le fait pour vous. Et chez vous");
    expect(texteDuCorpsPourVoix(fiche)).toBe("Vous perdez du temps. Axion IA le fait pour vous. Et chez vous.");
  });
});
