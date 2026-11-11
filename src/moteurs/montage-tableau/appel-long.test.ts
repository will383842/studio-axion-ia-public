/**
 * Page d'appel dont la phrase est longue (audit du 11/11/2026) : « Prenez rendez-vous pour un diagnostic IA gratuit »
 * (48 caractères) n'a pas de bouton ; elle s'écrit sur la plaque, en capitales, et ne tenait pas en 2 lignes : la mise
 * en page levait une erreur. Elle essaie maintenant 3 lignes, puis l'écriture courante sans plaque.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { remettreEnForme } from "./decoupage";
import type { FicheTableau } from "./fiche";
import { mettreEnPage } from "./mise-en-page";

const brute = JSON.parse(readFileSync(join(process.cwd(), "tests", "tableau", "temoins", "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8")) as FicheTableau;
const temoin = remettreEnForme(brute, { motsDouleur: ["mails", "temps"] });

/** La fiche témoin en « tableau-blanc », dont la dernière scène ne dit que la demande donnée (seule ligne, sans bouton). */
function avecAppel(demande: string): FicheTableau {
  const scenes = temoin.scenes.map((s, i, t) =>
    i === t.length - 1
      ? { ...s, texteDit: demande, elements: s.elements.filter((e) => e.type === "ligne" && e.bloc === "appel").map((e) => ({ ...e, texte: demande.replace(/\.$/, ""), ancre: 0 })) }
      : s,
  );
  return { ...temoin, styleTableau: "tableau-blanc", scenes } as FicheTableau;
}

const derniere = (f: FicheTableau) => mettreEnPage(f, {}).pages.at(-1)!;

describe("page d'appel : phrase d'appel longue sans bouton", () => {
  it("« Prenez rendez-vous pour un diagnostic IA gratuit » ne fait pas échouer la mise en page (9:16)", () => {
    const f = avecAppel("Prenez rendez-vous pour un diagnostic IA gratuit.");
    expect(() => mettreEnPage(f, {})).not.toThrow();
    const page = derniere(f);
    expect(page.elements.map((e) => e.lignes.map((l) => l.texte).join(" ")).join(" ").toLowerCase()).toContain("diagnostic");
  });

  it("une ligne courte garde la plaque (appel-plein, fond du bouton)", () => {
    const f = avecAppel("Réservez votre diagnostic gratuit.");
    const page = derniere(f);
    const plaque = page.elements.find((e) => e.gabarit?.sorte === "appel-plein");
    expect(plaque).toBeDefined();
    expect(plaque?.gabarit && "fond" in plaque.gabarit ? plaque.gabarit.fond : undefined).toBeDefined();
  });
});
