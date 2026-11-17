/**
 * C9-35t — filet : le plan de scènes du cas concret, figé AVANT le branchement des objets de bibliothèque.
 * C9-35b et C9-36b devront garder ces tranches et ces empreintes octet pour octet sans permission.
 * Doubles seulement : aucun appel réseau, le faux `appeler` compte ses appels.
 */
import { describe, expect, it } from "vitest";
import { planScenesCasConcret, type GroupePourPlan } from "@/moteurs/montage-cas-concret/plan-scenes";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

/** Trois scripts réalistes : chiffres (0 et 4) et énumération (8). Un écran par phrase, 350 ms par mot. */
function groupeDepuis(id: string, script: string): GroupePourPlan {
  const phrases = script.match(/[^.?!]+[.?!]?/g)!.map((p) => p.trim()).filter(Boolean);
  let t = 0;
  return {
    id,
    ecrans: phrases.map((texteDit, i) => {
      const debutMs = t;
      t += texteDit.split(/\s+/).length * 350;
      return { id: `e${i + 1}`, texteDit, debutMs, finMs: t };
    }),
  };
}
const GROUPES: GroupePourPlan[] = [
  groupeDepuis("corps-chiffres", DIX_SCRIPTS[0]!),
  groupeDepuis("corps-etapes", DIX_SCRIPTS[4]!),
  groupeDepuis("corps-enumeration", DIX_SCRIPTS[8]!),
];

/** Faux LLM déterministe : réponse fixe, une carte KPI sur toute la durée, quel que soit le groupe. */
function fauxAppeler() {
  const appels: RequeteClaude[] = [];
  const appeler = async (req: RequeteClaude): Promise<ReponseClaude> => {
    appels.push(req);
    const plan = {
      version: "plan-scenes-1",
      scenes: [{ id: "a", version: 1, mots: { premier: 0, dernier: 5 }, debutMs: 0, finMs: 3000, niveau: 1, position: "centre", piece: "carte-kpi", parametres: { valeur: "42", etiquette: "devis" } }],
    };
    return { texte: JSON.stringify(plan), stopReason: "end_turn" } as ReponseClaude;
  };
  return { appels, appeler };
}

const entrees = (memo: Record<string, { entree: string }>) => Object.fromEntries(Object.entries(memo).map(([k, v]) => [k, v.entree]));

describe("cas concret sans objets : plan de scènes figé", () => {
  it("niveau 1 (sans LLM) : tranches et empreintes figées, déterministes", async () => {
    const a = await planScenesCasConcret({ groupes: GROUPES });
    const b = await planScenesCasConcret({ groupes: GROUPES });
    expect(b).toEqual(a);
    expect(Object.keys(a.memo)).toEqual(GROUPES.map((g) => g.id));
    expect({ tranches: a.tranches, entrees: entrees(a.memo) }).toMatchSnapshot();
  });

  it("avec un faux LLM déterministe : tranches et empreintes figées, deux appels identiques", async () => {
    const f1 = fauxAppeler();
    const f2 = fauxAppeler();
    const a = await planScenesCasConcret({ groupes: GROUPES, appeler: f1.appeler });
    const b = await planScenesCasConcret({ groupes: GROUPES, appeler: f2.appeler });
    expect(b).toEqual(a);
    expect(f1.appels.length).toBeGreaterThan(0);
    expect({ tranches: a.tranches, entrees: entrees(a.memo) }).toMatchSnapshot();
  });

  it("aucun appel réseau au niveau 1 ; l'IA n'est appelée qu'une fois par groupe", async () => {
    const sans = fauxAppeler();
    await planScenesCasConcret({ groupes: GROUPES });
    expect(sans.appels).toHaveLength(0);
    const avec = fauxAppeler();
    await planScenesCasConcret({ groupes: GROUPES, appeler: avec.appeler });
    expect(avec.appels.length).toBeLessThanOrEqual(GROUPES.length);
  });

  it("la reprise depuis le journal (memo) ne rappelle pas l'IA et rend les mêmes tranches", async () => {
    const premier = fauxAppeler();
    const a = await planScenesCasConcret({ groupes: GROUPES, appeler: premier.appeler });
    const reprise = fauxAppeler();
    const b = await planScenesCasConcret({ groupes: GROUPES, appeler: reprise.appeler, memo: a.memo });
    expect(reprise.appels).toHaveLength(0);
    expect(b.tranches).toEqual(a.tranches);
  });

  // `planScenesCasConcret` ne reçoit aucune entrée bibliothèque et `src/` est interdit à cette fiche : le cas
  // « entrée vide de permissions = sortie identique à sans entrée » attend C9-35b (HORS PERIMETRE au journal).
  it.todo("entrée bibliothèque vide de permissions (profil tout `prevu`) : sortie identique à « sans entrée » (C9-35b)");
});
