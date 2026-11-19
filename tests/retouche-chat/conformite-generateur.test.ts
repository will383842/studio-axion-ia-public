/**
 * G14-05 — Conformité : tout générateur du chat de retouche doit passer les mêmes règles de base.
 * La boucle porte sur `GENERATEURS_RETOUCHE` (jamais une liste recopiée) : un générateur ajouté demain est contrôlé tout seul.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TYPES_OPERATIONS_RETOUCHE } from "@/briques/operations";
import { DECLARATIONS, declarationDuFormat } from "@/generateurs/declaration";
import {
  ADAPTATEURS_RETOUCHE,
  CLES_REGLAGE_RETOUCHE,
  GENERATEURS_RETOUCHE,
  GENERATEURS_SCRIPT_VALIDE,
  GENERATEURS_VOIX_PRISE_FILMEE,
  filtrerOperationsGenerateur,
  portsGenerateur,
  retoucheChatActif,
  scriptEstValide,
  voixEstPriseFilmee,
} from "@/services/retouche-chat/generateurs";
import { ciblesDuFormat } from "@/services/retouche-chat/rendu-generateurs";
import type { PortsRetoucheChat } from "@/services/retouche-chat/service";

/** Exception datée : la démo facecam est citée par les règles mais pas encore inscrite au registre. */
const EN_ATTENTE = [{ id: "demo-facecam", raison: "N-26 / G14-09 : inscription au registre", constateLe: "19/11/2026" }];

describe("conformité des générateurs du chat de retouche", () => {
  it("le registre n'est pas vide", () => {
    expect(GENERATEURS_RETOUCHE.length).toBeGreaterThan(0);
  });

  it("les clés de réglage sont distinctes", () => {
    const cles = GENERATEURS_RETOUCHE.map((g) => CLES_REGLAGE_RETOUCHE[g]);
    expect(new Set(cles).size).toBe(GENERATEURS_RETOUCHE.length);
  });

  describe.each([...GENERATEURS_RETOUCHE])("%s", (g) => {
    it("1. est déclaré avec un plan et un découpage", () => {
      const d = declarationDuFormat(g);
      expect(d).toBeDefined();
      expect(d?.formatId).toBe(g);
      expect(d?.artefacts).toContain("plan");
      expect(d?.decoupage).not.toBe("aucun");
      expect(d?.ratios.length).toBeGreaterThan(0);
    });

    it("2. a un interrupteur éteint par défaut", async () => {
      expect(CLES_REGLAGE_RETOUCHE[g]).toMatch(/^retoucheChat\.[A-Za-z]+$/);
      expect(await retoucheChatActif(g, async (_id, defaut) => defaut)).toBe(false);
    });

    it("3. déclare ses portées, sans jamais modifier-script", () => {
      const a = ADAPTATEURS_RETOUCHE[g];
      expect(a.id).toBe(g);
      expect(a.nom.trim()).not.toBe("");
      expect(a.consigne.trim()).not.toBe("");
      expect(a.operations.length).toBeGreaterThan(0);
      expect(new Set(a.operations).size).toBe(a.operations.length);
      for (const o of a.operations) {
        expect((TYPES_OPERATIONS_RETOUCHE as readonly string[]).includes(o)).toBe(true);
        expect(o).not.toBe("modifier-script");
      }
    });

    it("4. suit exactement une règle de voix", () => {
      const consigne = ADAPTATEURS_RETOUCHE[g].consigne;
      const prise = voixEstPriseFilmee(g);
      const valide = scriptEstValide(g);
      expect(prise && valide).toBe(false);
      if (prise) expect(consigne).toContain("même sur demande");
      else if (valide) expect(consigne).toContain("écran de validation");
      else expect(consigne).toContain("sauf demande explicite");
      const r = filtrerOperationsGenerateur(g, [{ type: "modifier-script", ancien: "a", nouveau: "b" }], "plus de punch");
      expect(r.operations).toEqual([]);
    });

    it("5. relit le dernier plan retouché (la fonction de la base est gardée)", () => {
      const lireVersionChoisie = vi.fn();
      const base = { lireVersionChoisie, appeler: vi.fn() } as unknown as PortsRetoucheChat;
      expect(portsGenerateur(g, base).lireVersionChoisie).toBe(lireVersionChoisie);
    });
  });

  it("5 bis. le studio relit la version déjà retouchée avant tout plan de départ", () => {
    const texte = readFileSync(join(process.cwd(), "src/services/retouche-chat/generateurs-studio.ts"), "utf8");
    const debut = texte.indexOf("lireVersionChoisie: async");
    expect(debut).toBeGreaterThan(-1);
    const corps = texte.slice(debut);
    const relit = corps.indexOf("await base.lireVersionChoisie(");
    const depart = corps.indexOf("planDeDepart(");
    expect(relit).toBeGreaterThan(-1);
    expect(depart).toBeGreaterThan(-1);
    expect(relit).toBeLessThan(depart);
  });

  it("6. liste unique : tout identifiant cité est au registre ou en attente datée", () => {
    const cites = new Set<string>([
      ...GENERATEURS_VOIX_PRISE_FILMEE,
      ...GENERATEURS_SCRIPT_VALIDE,
      ...Object.keys(DECLARATIONS).filter((id) => ciblesDuFormat(id) !== null),
    ]);
    const attente = EN_ATTENTE.map((e) => e.id);
    const registre = GENERATEURS_RETOUCHE as readonly string[];
    for (const id of cites) expect(registre.includes(id) || attente.includes(id), `« ${id} » cité mais ni au registre ni en attente`).toBe(true);
    for (const e of EN_ATTENTE) expect(registre.includes(e.id), `« ${e.id} » est inscrit : retirer l'exception (${e.raison})`).toBe(false);
  });
});
