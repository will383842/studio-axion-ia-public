/**
 * TESTS SEULEMENT (correctif après relecture du 15/10 : le crochet a quitté le code de production). Les parcours de bout
 * en bout qui ne portent PAS sur le budget (Claude doublé) remplacent le pire cas de la chaîne par un montant fixe :
 *
 *   vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
 *
 * puis `injecterPireCasChainePourEssai(0)` (et `null` pour revenir au vrai calcul). Le budget lui-même est testé SANS ce
 * crochet (`garde-fous-budget*.test.ts`).
 */
import type * as PireCas from "@/generateur/pire-cas";

const etat: { usd: number | null } = { usd: null };

export function injecterPireCasChainePourEssai(usd: number | null): void {
  etat.usd = usd;
}

export function pireCasInjectable(orig: typeof PireCas): typeof PireCas {
  return {
    ...orig,
    pireCasChaine: (chaine, o) => {
      const vrai = orig.pireCasChaine(chaine, o);
      return etat.usd === null ? vrai : { ...vrai, usd: etat.usd };
    },
  };
}
