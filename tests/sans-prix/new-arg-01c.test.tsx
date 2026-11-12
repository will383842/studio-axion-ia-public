/**
 * NEW-ARG-01c · aucun montant dans le rendu de l'aperçu, de l'express et de la fabrication.
 * Le rendu serveur de ces écrans exige tout le serveur : on vérifie (1) que chaque message venu du serveur passe par
 * `messageSansMontant` avant l'écran, (2) que la phrase de l'avatar n'est plus celle qui porte un montant.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { messageSansMontant } from "@/components/ui/ConfirmationPrix";

const lire = (f: string) => readFileSync(f, "utf8");
const APERCU = lire("src/assistant/etapes/Apercu.tsx");
const EXPRESS = lire("src/assistant/etapes/Express.tsx");
const FABRICATION = lire("src/assistant/etapes/Fabrication.tsx");
const VOYANT = lire("src/assistant/etapes/lancer-avec-voyant.ts");
const SANS_ARGENT = /€|\$|euros?\b|dollars?\b|\bUSD\b|\bEUR\b/i;

describe("aucun montant à l'écran (lot c)", () => {
  it("l'aperçu n'utilise plus la phrase qui annonce un prix", () => {
    expect(APERCU).not.toContain("phraseAvatarParle");
  });
  it("tout message serveur affiché passe par messageSansMontant", () => {
    for (const [nom, code] of [["Apercu", APERCU], ["Express", EXPRESS], ["Fabrication", FABRICATION]] as const) {
      const nus = code.split("\n").filter((l) => /notifier\.erreur\(r\.message\)|setErreur\(\{ message: r\.message|setConfirmation\(\[r\.message/.test(l));
      expect(nus, nom).toEqual([]);
    }
  });
  it("Express : aucun r.message brut renvoyé à la relecture", () => {
    const bruts = EXPRESS.split("\n").filter((l) => /return \{ ok: false[^}]*message: r\.message/.test(l));
    expect(bruts).toEqual([]);
  });
  it("le lancement avec voyant n'affiche aucun montant lui-même", () => {
    expect(VOYANT).not.toMatch(/€|formaterMontant|formaterDollars/);
  });
  it("le masque retire un montant d'un message serveur", () => {
    for (const m of ["Cela coûte environ 12,50 €.", "Au plus 3 euros, à confirmer.", "Total : $4.20"]) {
      expect(messageSansMontant(m)).not.toMatch(SANS_ARGENT);
      expect(messageSansMontant(m)).not.toMatch(/\d/);
    }
  });
});
