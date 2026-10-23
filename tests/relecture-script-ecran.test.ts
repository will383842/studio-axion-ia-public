/**
 * Écran commun « Relire le script » (brique 1 sur 8) : rendu initial, et l'exemple de l'aperçu (script v4, faux
 * adaptateur au barème de chaque ligne). Aucun réseau.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { controlerEssai, DEBIT_V4, lignesV4, TEXTE_V4 } from "@/app/(studio)/essais/relire-script/_exemple";
import { dureeLisible, RelireScript } from "@/components/script/RelireScript";
import { appliquerSaisie, scriptReluDe } from "@/domaine/relecture-script";

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const rien = async () => [];
const ok = async () => ({ ok: true as const });

describe("RelireScript : rendu", () => {
  const html = renderToStaticMarkup(createElement(RelireScript, { lignes: lignesV4(), controler: rien, lancer: ok, prixCentimes: 420, debit: DEBIT_V4, texteLibre: true }));
  const vu = texte(html);

  it("une carte par phrase, toucher pour modifier ; la ligne verrouillée ne s'ouvre pas", () => {
    expect(html.match(/aria-label="Modifier la phrase \d+"/g)).toHaveLength(19);
    expect(html).toContain('aria-label="Phrase 19, non modifiable"');
    expect(vu).toContain("On recrute nos collaborateurs en quinze minutes.");
  });

  it("le bouton porte le prix, la durée est estimée, le mode texte libre est proposé", () => {
    expect(vu).toContain("Lancer la vidéo (≈ 4,20 €)");
    expect(vu).toMatch(/≈ 4\d s/);
    expect(vu).toContain("Texte libre");
    expect(vu).toContain("Vérification");
  });

  it("sans modification : pas de bouton « Annuler »", () => {
    expect(html).not.toContain("Annuler mes modifications");
  });

  it("durée lisible", () => {
    expect(dureeLisible(42.4)).toBe("42 s");
    expect(dureeLisible(65)).toBe("1 min 05");
  });
});

describe("Aperçu : script v4 et faux adaptateur", () => {
  it("le texte est celui de la voix v4, en 20 phrases", () => {
    const v4 = JSON.parse(readFileSync("docs/formats/v4-reference/voix4.json", "utf8")) as { texte: string; duree: number; mots: unknown[] };
    expect(TEXTE_V4).toBe(v4.texte);
    expect(lignesV4()).toHaveLength(20);
    expect(lignesV4().map((l) => l.dit).join(" ")).toBe(v4.texte);
  });

  it("une phrase trop longue écrite par la machine bloque ; modifiée par Will, elle n'est plus qu'une information", () => {
    const avant = lignesV4();
    const longue = "Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, envoyer le contrat, courir après la signature, encore.";
    const machine = avant.map((l) => (l.id === "p3" ? { ...l, dit: longue } : l));
    expect(controlerEssai(scriptReluDe(machine, machine))).toEqual([{ ligneId: "p3", niveau: "bloquant", code: "C8", texte: "Plus de 20 mots." }]);
    const parWill = appliquerSaisie(avant, "p3", { dit: longue });
    expect(controlerEssai(scriptReluDe(avant, parWill))).toEqual([{ ligneId: "p3", niveau: "info", code: "C8", texte: "Plus de 20 mots." }]);
  });

  it("phrase vidée : bloquant", () => {
    const avant = lignesV4();
    const apres = appliquerSaisie(avant, "p2", { dit: "  " });
    expect(controlerEssai(scriptReluDe(avant, apres))).toEqual([{ ligneId: "p2", niveau: "bloquant", texte: "Phrase vide." }]);
  });
});

describe("Aperçu : débit de la voix v4", () => {
  it("DEBIT_V4 = mots lus / durée de voix4.json", () => {
    const v4 = JSON.parse(readFileSync("docs/formats/v4-reference/voix4.json", "utf8")) as { texte: string; duree: number };
    const mots = v4.texte.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
    expect(DEBIT_V4).toBeCloseTo(mots / v4.duree, 2);
  });
});
