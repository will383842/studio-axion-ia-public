/**
 * CHAÎNE COURTE · REPLI de l'appel final : quand la banque des fins ne fournit rien pour le réseau, l'ancien
 * comportement est gardé (seul le type est imposé, <appel type=…/>, et le modèle écrit l'appel). Simulation.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/generateur/roles/equipe-commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/generateur/roles/equipe-commun")>()), appelEquipe: () => null }));

const { executerChaineCourte, ROLES_CHAINE_COURTE } = await import("@/generateur/chaine-courte");
const { CONTEXTE_BANC, SUJETS_BANC } = await import("./banc/registre-banc-g4");
const { etapeZeroBanc, executeurSimule, TOURNURES_G4 } = await import("../helpers/g4");

describe("chaîne courte : la banque ne fournit rien pour ce réseau", () => {
  it("le modèle écrit l'appel du type demandé, la relecture peut le resserrer", async () => {
    const z = etapeZeroBanc(SUJETS_BANC[0]);
    if (!z.ok) throw new Error("étape 0");
    const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };
    const { executeur, appels } = executeurSimule({
      "court-relecture": (e) => ({ remarques: [], accroche: /<accroche>([\s\S]*?)<\/accroche>/.exec(e.variable)![1], corrections: [], appel: "Appel resserré.", boucle: "" }),
    });
    const r = await executerChaineCourte(z.donnees, executeur, { tournures: TOURNURES_G4, contexteWill });
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    const script = appels.find((a) => a.role === "court-script")!;
    expect(script.entree.variable).toMatch(/<appel type="[a-z-]+"\/>/);
    expect(script.entree.variable).not.toContain("<appel_impose");
    expect(r.avantRelecture.appel.texte.trim()).not.toBe("");
    expect(r.version.appel.texte).toBe("Appel resserré.");
  });

  it("repli : un script sans appel est refusé (l'appel reste exigé quand rien n'est imposé)", async () => {
    const z = etapeZeroBanc(SUJETS_BANC[0]);
    if (!z.ok) throw new Error("étape 0");
    const sans = executeurSimule({
      "court-script": (e) => {
        const { appel: _a, ...version } = (ROLES_CHAINE_COURTE.script.simuler(e) as { version: Record<string, unknown> }).version;
        void _a;
        return { ...(ROLES_CHAINE_COURTE.script.simuler(e) as object), version };
      },
    });
    const r = await executerChaineCourte(z.donnees, sans.executeur, { tournures: TOURNURES_G4 });
    expect(r.statut).toBe("arretee");
    expect(r.etat.arret?.message).toMatch(/l'appel demandé/);
  });
});
