/**
 * GARDE-FOUS BUDGET (audit du 15/10) · la grande chaîne, en simulation (aucun appel réel).
 *  - un seul corps et aucune reprise par défaut (options gardées : `deuxCorps`, `reprises`) ;
 *  - pire cas de TOUTE la chaîne prévue, calculé avant le premier appel (somme des pires cas, `tarifs.ts`) ;
 *  - réponse coupée (`max_tokens`) : arrêt, le texte brut est gardé, aucun nouvel appel identique.
 */
import { describe, expect, it } from "vitest";
import { executerChaine, type ExecuteurRoles, type SortieExecution } from "@/generateur/chaine";
import { pireCasChaine } from "@/generateur/pire-cas";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { z } from "zod";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "./helpers/g4";

const OPTS = { tournures: TOURNURES_G4 };

function donnees(n = 0) {
  const z = etapeZeroBanc(SUJETS_BANC[n]);
  if (!z.ok) throw new Error(`étape 0 : ${z.manque.type}`);
  return z.donnees;
}

describe("Garde-fous · options par défaut de la grande chaîne", () => {
  it("sans option : un seul corps, aucun duel (deuxCorps à faux par défaut)", async () => {
    const { executeur, appels } = executeurSimule();
    const r = await executerChaine(donnees(2), executeur, OPTS);
    expect(r.statut).toBe("terminee");
    expect(r.etat.corps).toHaveLength(1);
    expect(appels.filter((a) => a.role === "preference")).toHaveLength(0);
    expect(appels.filter((a) => a.role === "plan")).toHaveLength(1);
  });

  it("sans option : une sortie invalide n'est pas reprise (reprises à faux par défaut)", async () => {
    const { executeur, appels } = executeurSimule();
    const avecErreur: ExecuteurRoles = {
      async executer<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<SortieExecution<z.infer<S>>> {
        if (role.id === "fond") {
          appels.push({ role: role.id, entree });
          return { ok: true, invalide: "sortie vide", coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
        }
        return executeur.executer(role, entree);
      },
    };
    await executerChaine(donnees(0), avecErreur, OPTS);
    expect(appels.filter((a) => a.role === "fond")).toHaveLength(1);
  });

  it("options gardées : deuxCorps et reprises demandés explicitement font toujours deux corps et une reprise", async () => {
    const { executeur, appels } = executeurSimule();
    const r = await executerChaine(donnees(2), executeur, { ...OPTS, deuxCorps: true, reprises: true });
    expect(r.etat.corps?.length).toBe(2);
    expect(appels.filter((a) => a.role === "preference")).toHaveLength(2);
  });
});

describe("Garde-fous · pire cas de toute la chaîne, avant le premier appel", () => {
  it("somme des pires cas de tous les appels prévus ; plus cher avec deux corps et les reprises", () => {
    const d = donnees(0);
    const apres = pireCasChaine("grande", { donnees: d, options: OPTS });
    const avant = pireCasChaine("grande", { donnees: d, options: { ...OPTS, deuxCorps: true, reprises: true } });
    expect(apres.usd).toBeGreaterThan(0);
    expect(apres.appels).toBeGreaterThan(10);
    expect(avant.usd).toBeGreaterThan(apres.usd * 1.5);
    expect(avant.appels).toBeGreaterThan(apres.appels);
  });

  it("au moins le coût de sortie maximal de chaque appel (jamais sous-estimé)", () => {
    const d = donnees(0);
    const p = pireCasChaine("grande", { donnees: d, options: OPTS });
    // Sorties seules (Opus 20 $/M, Sonnet 10 $/M) : stratège, fond, accroches, juge, plan × 2, prose × 2, juge,
    // réécriture × 2, déclinaison × 3 par réseau, juge.
    const r = d.sujet.reseaux.length;
    const sorties = (12000 + 8000 + 10000 + 2 * 8000 + 2 * 9000 + 2 * 6000) * 20e-6 + (3 * 5000 + 3 * r * 6000) * 10e-6;
    expect(p.usd).toBeGreaterThanOrEqual(sorties);
  });

  it("reprise après l'étape 4 : seules les étapes restantes sont comptées", () => {
    const d = donnees(0);
    const tout = pireCasChaine("grande", { donnees: d, options: OPTS });
    const reste = pireCasChaine("grande", { donnees: d, options: OPTS, etatDepart: { version: 1, etape: 4, coutUsd: 0, journal: [] } });
    expect(reste.usd).toBeLessThan(tout.usd);
    expect(reste.appels).toBeLessThan(tout.appels);
  });
});

describe("Garde-fous · réponse coupée (max_tokens)", () => {
  it("la chaîne s'arrête, garde le texte brut, et ne rappelle PAS le rôle à l'identique", async () => {
    const { executeur, appels } = executeurSimule();
    const coupe: ExecuteurRoles = {
      async executer<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<SortieExecution<z.infer<S>>> {
        if (role.id === "fond") {
          appels.push({ role: role.id, entree });
          return { ok: true, texte: '{"appuiPrincipal":"début coupé', invalide: "JSON illisible", coutUsd: 0.17, modele: "claude-opus-5-5", stopReason: "max_tokens" };
        }
        return executeur.executer(role, entree);
      },
    };
    const sauves: unknown[] = [];
    const r = await executerChaine(donnees(0), coupe, { ...OPTS, reprises: true }, undefined, async (e) => void sauves.push(structuredClone(e)));
    expect(r.statut).toBe("coupee");
    expect(appels.filter((a) => a.role === "fond")).toHaveLength(1);
    expect(appels.some((a) => a.role === "accroches")).toBe(false);
    expect(r.etat.etape).toBe(1);
    expect(r.etat.reponseCoupee).toMatchObject({ etape: 2, role: "fond", texte: '{"appuiPrincipal":"début coupé' });
    expect(r.etat.coutUsd).toBeCloseTo(0.17, 6);
    expect(r.etat.journal.at(-1)).toMatchObject({ role: "fond", resultat: "coupe" });
    expect(r.statut === "coupee" && r.message).toMatch(/coupée/);
    expect(sauves.length).toBeGreaterThan(0);
  });
});
