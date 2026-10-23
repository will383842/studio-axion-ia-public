/**
 * GARDE DE GÉNÉRATION : `banque-base7.generee.ts` est exactement ce que `npm run bases:banque` écrit depuis la copie JSON
 * de la base 7. Un écart (modification à la main, base resynchronisée sans régénérer) fait échouer ce test.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ETATS_BASE, sourceDesBases, tousLesAppels } from "./index";
import { CHEMIN_BANQUE_GENEREE, pageDuGabarit, rendreBanqueGeneree } from "./rendu-banque";

const racine = join(__dirname, "../../..");
const attendu = () => rendreBanqueGeneree(tousLesAppels({ etats: ETATS_BASE }), sourceDesBases().commit ?? null);

describe("banque-base7.generee.ts ⇄ base 7", () => {
  it("le fichier du dépôt est identique à la génération (sinon : npm run bases:banque)", () => {
    expect(readFileSync(join(racine, CHEMIN_BANQUE_GENEREE), "utf8")).toBe(attendu());
  });

  it("la banque ne garde que la page du gabarit de lien : aucune requête, aucun `depuis`", () => {
    const fichier = readFileSync(join(racine, CHEMIN_BANQUE_GENEREE), "utf8");
    expect(fichier).not.toMatch(/"lien":"[^"]*[?#]/);
    expect(pageDuGabarit("https://axion-ia.com/fr/appel?depuis=entete")).toBe("https://axion-ia.com/fr/appel");
    expect(pageDuGabarit("")).toBe("");
  });

  it("une phrase modifiée à la main dans le fichier est détectée", () => {
    const fichier = readFileSync(join(racine, CHEMIN_BANQUE_GENEREE), "utf8");
    const modifie = fichier.replace("Réservez votre diagnostic gratuit.", "Réservez votre diagnostic.");
    expect(modifie).not.toBe(fichier);
    expect(modifie).not.toBe(attendu());
  });

  it("une ligne de la base absente du rendu est détectée", () => {
    const toutes = tousLesAppels({ etats: ETATS_BASE });
    expect(rendreBanqueGeneree(toutes.slice(1), null)).not.toBe(attendu());
  });
});
