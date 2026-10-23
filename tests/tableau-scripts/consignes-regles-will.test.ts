/**
 * TABLEAU · RÈGLES DE WILL (audit du 17/10, lot B1 du 18/10) : plus jamais « refaire le geste seul » ni de tutoriel à
 * l'impératif ; ce qui change se comprend tout de suite, le corps reste neutre, la FIN dit en une phrase courte que
 * l'entreprise le met en place pour le spectateur (témoin v5).
 */
import { describe, expect, it } from "vitest";
import { CONSIGNE_RELECTURE, REGLES_TABLEAU } from "@/services/tableau-scripts/consignes";

describe("consignes du tableau : jamais « faites-le seul »", () => {
  it("les règles ne demandent plus de refaire le geste seul ; la fin positionne l'entreprise", () => {
    expect(REGLES_TABLEAU).not.toMatch(/soir même|refaire le geste seul|s'applique SEUL|sans nous|refaisable/);
    expect(REGLES_TABLEAU).toContain("Ce qui change se comprend tout de suite");
    expect(REGLES_TABLEAU).toContain("Le CORPS reste NEUTRE");
    expect(REGLES_TABLEAU).toMatch(/ne décrit JAMAIS notre façon de travailler ni une prestation/);
    expect(REGLES_TABLEAU).toContain("La FIN dit en UNE phrase courte (15 mots au plus) que l'entreprise le met en place");
    expect(REGLES_TABLEAU).toContain("« [l'entreprise] met cette fiche en place pour vous. Réservez un appel de diagnostic. »");
    expect(REGLES_TABLEAU).toContain("« [l'entreprise] le met en place pour vous. »");
    expect(REGLES_TABLEAU).toContain("Aucune consigne à l'impératif adressée au spectateur avant l'appel : le corps montre ce qui change, la fin dit qu'on le met en place.");
    expect(REGLES_TABLEAU).not.toContain("Un conseil utile est permis dans le corps");
  });

  it("MANQUES : ce qui manquerait pour comprendre le réflexe", () => {
    expect(CONSIGNE_RELECTURE).toContain("ce qui manquerait ENCORE pour comprendre le réflexe");
    expect(CONSIGNE_RELECTURE).not.toMatch(/geste seul|soir même/);
  });
});
