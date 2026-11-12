/**
 * GV-EC-06 · Williams peut valider tel quel un script « à relire » pour des points de FORME seulement.
 * Les points « jamais faux » (chiffre, nom inventé, mot interdit, phrase-choc, question…) restent bloquants.
 * Tout est SIMULÉ : aucun appel réel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CODES_REGLES_FORME_ACCEPTABLES, CODES_REGLES_JAMAIS_FAUX } from "@/moteurs/montage-image-video/ecriture";
import { avancerJusquAArretIV, controleAutomatiqueScriptIV, etatInitialIV, validerCarteIV, validerScriptIV, type DecisionScriptIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

// Manquements forcés par un test (code inconnu, Q10…) : ajoutés au verdict réel de verifierScript.
const forces = vi.hoisted(() => ({ liste: [] as { regle: string; priorite: number; message: string }[] }));
vi.mock("@/moteurs/montage-image-video/regles", async (orig) => {
  const m = await orig<typeof import("@/moteurs/montage-image-video/regles")>();
  return {
    ...m,
    verifierScript: (...a: Parameters<typeof m.verifierScript>) => {
      const v = m.verifierScript(...a);
      return forces.liste.length ? { ...v, ok: false, manquements: [...v.manquements, ...forces.liste] } : v;
    },
  };
});

async function auScript(): Promise<EtatFabricationIV> {
  const o = outilsSimules(carteFixe("C"), monde());
  const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carteFixe("C"))), o);
  const arret = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
  expect(arret.etape).toBe("script-a-valider");
  return arret;
}
const decision = (e: EtatFabricationIV, plus: Partial<DecisionScriptIV> = {}): DecisionScriptIV => ({
  proposition: e.propositionScript!.empreinte,
  choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])),
  ...plus,
});
/** Un point de FORME seulement : un chiffre écrit en chiffres dans un écran (règle Q09, hors liste « jamais faux »). */
function avecPointDeForme(e: EtatFabricationIV) {
  const fiche = structuredClone(e.propositionScript!.fiche);
  fiche.ecrans[1] = { ...fiche.ecrans[1]!, texteDit: `${fiche.ecrans[1]!.texteDit.replace(/\.$/, "")} 3.` };
  return fiche;
}
const phrasesDe = (f: () => unknown): string => {
  try {
    f();
  } catch (err) {
    return [(err as Error).message, ...((err as { phrases?: string[] }).phrases ?? [])].join(" ");
  }
  return "";
};

describe("GV-EC-06 · points de forme acceptés par Williams", () => {
  it("le script de départ passe sans drapeau (base saine) et le point de forme n'est pas « jamais faux »", async () => {
    const e = await auScript();
    expect(() => validerScriptIV(e, decision(e))).not.toThrow();
    expect(CODES_REGLES_JAMAIS_FAUX).not.toContain("Q09");
  });

  it("point de forme SANS drapeau : refus comme avant", async () => {
    const e = await auScript();
    expect(() => validerScriptIV(e, decision(e, { fiche: avecPointDeForme(e) }))).toThrow(/ne passe pas encore/);
    expect(() => validerScriptIV(e, decision(e, { fiche: avecPointDeForme(e), formeAcceptee: false }))).toThrow(/ne passe pas encore/);
  });

  it("point de forme AVEC drapeau, script tel que montré : validé, étape voix, journal présent", async () => {
    const e = await auScript();
    forces.liste = [{ regle: "Q09", priorite: 5, message: "Un point d'écriture." }];
    try {
      const v = validerScriptIV(e, decision(e, { formeAcceptee: true }));
      expect(v.etape).toBe("voix");
      expect(v.script).toBeDefined();
      expect(v.journal.join("\n")).toMatch(/Script validé par Williams malgré 1 point\(s\) de forme : /);
    } finally {
      forces.liste = [];
    }
  });

  it.each(["Q07", "CHAPITRES"])("point de forme %s seul AVEC drapeau, script tel que montré : validé, étape voix", async (code) => {
    const e = await auScript();
    forces.liste = [{ regle: code, priorite: 5, message: "Un point d'écriture." }];
    try {
      const v = validerScriptIV(e, decision(e, { formeAcceptee: true }));
      expect(v.etape).toBe("voix");
      expect(v.script).toBeDefined();
    } finally {
      forces.liste = [];
    }
  });

  it("mot interdit (jamais faux) AVEC drapeau, script tel que montré : refus qui nomme le point", async () => {
    const e = await auScript();
    forces.liste = [{ regle: "Q08", priorite: 1, message: "Le mot « machine » est interdit." }];
    try {
      const texte = phrasesDe(() => validerScriptIV(e, decision(e, { formeAcceptee: true })));
      expect(texte).toMatch(/Ce point ne peut pas être accepté tel quel/);
      expect(texte).toMatch(/machine/);
    } finally {
      forces.liste = [];
    }
  });

  it("point de forme ET point « jamais faux » ensemble, avec drapeau : refus, rien n'est accepté", async () => {
    const e = await auScript();
    forces.liste = [
      { regle: "Q09", priorite: 5, message: "Un point d'écriture." },
      { regle: "Q08", priorite: 1, message: "Le mot « machine » est interdit." },
    ];
    try {
      expect(() => validerScriptIV(e, decision(e, { formeAcceptee: true }))).toThrow(/Ce point ne peut pas être accepté tel quel/);
    } finally {
      forces.liste = [];
    }
  });

  it("formule absolue non tranchée (Q05bis) reste bloquante, même avec drapeau", async () => {
    const e = await auScript();
    expect(e.propositionScript!.formules.length).toBeGreaterThan(0);
    expect(() => validerScriptIV(e, { proposition: e.propositionScript!.empreinte, formeAcceptee: true })).toThrow(/Ce point ne peut pas être accepté tel quel/);
  });

  it("lot automatique : le contrôle ne pose jamais le drapeau, le point de forme met le script de côté", async () => {
    const e = await auScript();
    const mauvais = structuredClone(e);
    mauvais.propositionScript!.fiche = avecPointDeForme(e);
    const apres = controleAutomatiqueScriptIV(mauvais);
    expect(apres.etape).not.toBe("voix");
    expect(apres.script).toBeUndefined();
  });

  it("liste blanche : seulement Q07, Q09 et CHAPITRES (ni Q10, ni un code « jamais faux »)", () => {
    expect([...CODES_REGLES_FORME_ACCEPTABLES].sort()).toEqual(["CHAPITRES", "Q07", "Q09"]);
    for (const c of CODES_REGLES_FORME_ACCEPTABLES) expect(CODES_REGLES_JAMAIS_FAUX).not.toContain(c);
  });

  it("code inconnu (futur) AVEC drapeau : refus, même seul", async () => {
    const e = await auScript();
    forces.liste = [{ regle: "Q99", priorite: 5, message: "Un point d'une règle inconnue." }];
    try {
      const texte = phrasesDe(() => validerScriptIV(e, decision(e, { formeAcceptee: true })));
      expect(texte).toMatch(/Ce point ne peut pas être accepté tel quel/);
      expect(texte).toMatch(/règle inconnue/);
    } finally {
      forces.liste = [];
    }
  });

  it("durée trop longue (Q10) AVEC drapeau : refus qui le nomme", async () => {
    const e = await auScript();
    forces.liste = [{ regle: "Q10", priorite: 5, message: "Le script est beaucoup trop long." }];
    try {
      const texte = phrasesDe(() => validerScriptIV(e, decision(e, { formeAcceptee: true })));
      expect(texte).toMatch(/Ce point ne peut pas être accepté tel quel/);
      expect(texte).toMatch(/trop long/);
    } finally {
      forces.liste = [];
    }
  });

  it("script NON modifié (fiche identique envoyée) + forme + drapeau : validé", async () => {
    const e = await auScript();
    forces.liste = [{ regle: "Q09", priorite: 5, message: "Un point d'écriture." }];
    try {
      const v = validerScriptIV(e, decision(e, { fiche: structuredClone(e.propositionScript!.fiche), formeAcceptee: true }));
      expect(v.etape).toBe("voix");
    } finally {
      forces.liste = [];
    }
  });

  it("script MODIFIÉ + point de forme + drapeau : refus comme avant (le drapeau est ignoré)", async () => {
    const e = await auScript();
    expect(() => validerScriptIV(e, decision(e, { fiche: avecPointDeForme(e), formeAcceptee: true }))).toThrow(/ne passe pas encore/);
  });

  it("script « reformulé » (choix des formules changé) + drapeau : drapeau ignoré", async () => {
    const e = await auScript();
    forces.liste = [{ regle: "Q09", priorite: 5, message: "Un point d'écriture." }];
    try {
      const d = decision(e, { formeAcceptee: true });
      const cle = Object.keys(d.choixFormules!)[0]!;
      d.choixFormules![cle] = "reformuler";
      expect(() => validerScriptIV(e, d)).toThrow(/ne passe pas encore/);
    } finally {
      forces.liste = [];
    }
  });

  it("script collé + drapeau : refus aussi, les contrôles du script collé ne sont pas contournés", async () => {
    const e = await auScript();
    const colle = structuredClone(e);
    colle.demande.scriptColle = true;
    colle.demande.texte = "Un client écrit la nuit.";
    forces.liste = [{ regle: "Q08", priorite: 1, message: "Le mot « machine » est interdit.", interdit: true } as never];
    try {
      const sans = phrasesDe(() => validerScriptIV(colle, decision(colle)));
      const avec = phrasesDe(() => validerScriptIV(colle, decision(colle, { formeAcceptee: true })));
      expect(avec).toMatch(/Ce point ne peut pas être accepté tel quel/);
      expect(sans).toMatch(/ne passe pas encore/);
    } finally {
      forces.liste = [];
    }
  });
});

describe("GV-EC-06b · service : le drapeau doit être le booléen vrai", () => {
  beforeEach(async () => (await import("@/donnees/memoire")).reinitialiserDepots());

  it('formeAcceptee: "true" (chaîne) est ignoré → refus comme sans drapeau ; true (booléen) passe', async () => {
    const { publierVitrineIV } = await import("@/services/image-video-lanceur");
    const { validerScriptImageVideo } = await import("@/services/image-video-scripts");
    const e = await auScript();
    await publierVitrineIV({ videoId: "v-iv-forme", titre: "Essai", etat: e, entrees: {} });
    const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
    forces.liste = [{ regle: "Q09", priorite: 5, message: "Un point d'écriture." }];
    try {
      await expect(validerScriptImageVideo("v-iv-forme", { choixFormules, formeAcceptee: "true" as never })).rejects.toMatchObject({ code: "SCRIPT_REFUSE" });
      await expect(validerScriptImageVideo("v-iv-forme", { choixFormules })).rejects.toMatchObject({ code: "SCRIPT_REFUSE" });
      await expect(validerScriptImageVideo("v-iv-forme", { choixFormules, formeAcceptee: true })).resolves.toBeDefined();
    } finally {
      forces.liste = [];
    }
  });
});
