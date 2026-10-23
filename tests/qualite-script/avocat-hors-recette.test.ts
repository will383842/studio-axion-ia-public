/**
 * LOT H1 · L'avocat est HORS RECETTE COMMUNE (ordre permanent de Will : « ne rien toucher à l'avocat »).
 * Depuis le lot A (#499), la chaîne courte donnait à l'avocat la recette commune (« UNE seule idée », 3,0 mots/s) et les
 * contrôles C95 à C99 s'y appliquaient : ils contredisent son format (« l'essentiel en trois idées », débit mesuré à 4,5).
 * Référence : la consigne que la chaîne courte donnait à l'avocat AVANT #499 (parent 1 de la fusion 952739d7), reconstruite
 * sans appel et épinglée par empreinte SHA-256 ; les autres formats gardent leur consigne d'aujourd'hui, octet pour octet.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { codesLeves, controlerVersion, type EntreeControle } from "@/domaine/controles-script";
import { ANTI_PATTERNS_SCRIPT, FORMATS_HORS_RECETTE_COMMUNE, horsRecetteCommune, RECETTE_SCRIPT } from "@/donnees/generateur/recette-script";
import { REGLES_WILL, REGLES_WILL_AVANT_LOT_A } from "@/donnees/generateur/regles-will";
import {
  CONSIGNE_COURT_ANGLE,
  CONSIGNE_COURT_ANGLE_HORS_RECETTE,
  CONSIGNE_COURT_RELECTURE,
  CONSIGNE_COURT_RELECTURE_HORS_RECETTE,
  CONSIGNE_COURT_SCRIPT,
  CONSIGNE_COURT_SCRIPT_HORS_RECETTE,
  executerChaineCourte,
  ROLES_CHAINE_COURTE,
  roleCourtPour,
} from "@/generateur/chaine-courte";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { formatGenerateur } from "@/formats";
import { CONTEXTE_BANC, SUJETS_BANC } from "../generateur/banc/registre-banc-g4";
import type { ExecuteurRoles } from "@/generateur/chaine";
import { etapeZeroBanc, TOURNURES_G4 } from "../helpers/g4";
import { versionV4 } from "../helpers/v4";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** SHA-256 des consignes d'AVANT #499 (fed29a7a, 1er parent de la fusion) : angle v1, script v3, relecture v1. */
const AVANT_499 = {
  angle: "aea6a53735a5dcc542b8a6d84519b707cf3a936815dffa7b07409d157d5a00c5",
  script: "48ee361bc91850eaca26fb9471975ee46afee76284e53108f11f4ca1a2dfa253",
  relecture: "94a75c73cd0cf537d8b6c3074b527d4d49e0979ba0466ba5d7685740cd09e0e8",
};
/** SHA-256 des consignes d'AUJOURD'HUI (master, après #499), pour tous les autres formats. */
const AUJOURDHUI = {
  angle: "32eebc0ba9e171ccf575bd1614e6365a66a18d5e7690263e8444252c3f7227b5",
  script: "a477eecc03e8eb985c3d1c5ba38e2a907504e75ad2f1ddbc338aa291e6d86acc",
  relecture: "13d3a53c6a8765af0f0a890eaa0826c26990e772b48b230e6f9d49f8a302dc16",
};

const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, tournures: TOURNURES_G4 } as never;

/** Exécute la chaîne courte simulée pour ce format et rend, par rôle, ce qui part vers Claude (consigne en cache, version, variable). */
async function envoye(formatId: string) {
  const z = etapeZeroBanc(SUJETS_BANC[0], undefined, { formatId });
  if (!z.ok) throw new Error(z.manque.ceQuIlFaudrait);
  const vus: { role: string; version: number; consigne: string; contexte: string; variable: string }[] = [];
  const executeur: ExecuteurRoles = {
    async executer(role: DefinitionRole, entree: EntreeRole) {
      vus.push({ role: role.id, version: role.version, consigne: role.consigne, contexte: JSON.stringify(entree.contexte), variable: entree.variable });
      const brut = role.simuler(entree);
      return { ok: true, simule: true, donnees: role.schema ? role.schema.parse(brut) : undefined, coutUsd: 0, modele: "simulation", stopReason: "end_turn" } as never;
    },
  };
  await executerChaineCourte(z.donnees, executeur, { tournures: TOURNURES_G4, contexteWill });
  return vus;
}

describe("FORMATS_HORS_RECETTE_COMMUNE : tableau figé", () => {
  it("contient exactement l'avocat, figé, et l'avocat est le format de code « AV »", () => {
    expect([...FORMATS_HORS_RECETTE_COMMUNE]).toEqual(["avocat"]);
    expect(Object.isFrozen(FORMATS_HORS_RECETTE_COMMUNE)).toBe(true);
    expect(formatGenerateur("avocat").codeClassement).toBe("AV");
    expect(horsRecetteCommune("avocat")).toBe(true);
  });
  it("face caméra, central, absent et inconnu restent dans la recette commune", () => {
    for (const f of ["facecam", "central", "tableau-anime", "", undefined, "inconnu"]) expect(horsRecetteCommune(f)).toBe(false);
  });
});

describe("consignes de la chaîne courte : l'avocat retrouve celles d'avant #499", () => {
  it("angle, script et relecture hors recette : identiques (octet pour octet) à celles d'avant #499", () => {
    expect(sha(CONSIGNE_COURT_ANGLE_HORS_RECETTE)).toBe(AVANT_499.angle);
    expect(sha(CONSIGNE_COURT_SCRIPT_HORS_RECETTE)).toBe(AVANT_499.script);
    expect(sha(CONSIGNE_COURT_RELECTURE_HORS_RECETTE)).toBe(AVANT_499.relecture);
  });
  it("le script de l'avocat ne contient ni la recette, ni les anti-patterns, ni « une seule idée », ni « 3,0 mots », ni la ligne « tutoriel »", () => {
    const c = CONSIGNE_COURT_SCRIPT_HORS_RECETTE;
    expect(c).not.toContain(RECETTE_SCRIPT);
    expect(c).not.toContain(ANTI_PATTERNS_SCRIPT);
    expect(c).not.toMatch(/une seule idée/i);
    expect(c).not.toContain("3,0 mots");
    expect(c).not.toContain("RECETTE (vidéo de 45 s");
    expect(c).not.toContain("ANTI-PATTERNS");
    expect(c).not.toContain("Un. Listez");
    expect(c).toContain("dans l'ordre de la structure retenue");
    expect(CONSIGNE_COURT_ANGLE_HORS_RECETTE).not.toContain("TENSION");
    expect(CONSIGNE_COURT_RELECTURE_HORS_RECETTE).not.toContain("plus d'une idée");
  });
  it("REGLES_WILL_AVANT_LOT_A n'est REGLES_WILL que sans la ligne « tutoriel »", () => {
    expect(REGLES_WILL).toContain("Un. Listez");
    expect(REGLES_WILL_AVANT_LOT_A).not.toContain("Un. Listez");
    expect(REGLES_WILL_AVANT_LOT_A.split("\n")).toHaveLength(REGLES_WILL.split("\n").length - 1);
  });
  it("les autres formats : consignes d'aujourd'hui, octet pour octet", () => {
    expect(sha(CONSIGNE_COURT_ANGLE)).toBe(AUJOURDHUI.angle);
    expect(sha(CONSIGNE_COURT_SCRIPT)).toBe(AUJOURDHUI.script);
    expect(sha(CONSIGNE_COURT_RELECTURE)).toBe(AUJOURDHUI.relecture);
    expect(CONSIGNE_COURT_SCRIPT).toContain(RECETTE_SCRIPT);
    expect(CONSIGNE_COURT_SCRIPT).toContain(ANTI_PATTERNS_SCRIPT);
  });
});

describe("chaîne courte exécutée : ce qui part vers Claude", () => {
  it("l'avocat : consignes et versions d'avant #499, aucune recette commune dans le cache ni dans la partie variable", async () => {
    const vus = await envoye("avocat");
    const par = (id: string) => vus.find((v) => v.role === id)!;
    expect(sha(par("court-angle").consigne)).toBe(AVANT_499.angle);
    expect(sha(par("court-script").consigne)).toBe(AVANT_499.script);
    expect(sha(par("court-relecture").consigne)).toBe(AVANT_499.relecture);
    expect([par("court-angle").version, par("court-script").version, par("court-relecture").version]).toEqual([1, 3, 1]);
    for (const v of vus) {
      for (const t of [RECETTE_SCRIPT, ANTI_PATTERNS_SCRIPT, "UNE seule idée", "3,0 mots par seconde"]) {
        expect(v.consigne, v.role).not.toContain(t);
        expect(v.contexte, v.role).not.toContain(t);
        expect(v.variable, v.role).not.toContain(t);
      }
    }
  });
  it("face caméra : consignes d'aujourd'hui, versions d'aujourd'hui, recette présente", async () => {
    const vus = await envoye("facecam");
    const par = (id: string) => vus.find((v) => v.role === id)!;
    expect(sha(par("court-angle").consigne)).toBe(AUJOURDHUI.angle);
    expect(sha(par("court-script").consigne)).toBe(AUJOURDHUI.script);
    expect(sha(par("court-relecture").consigne)).toBe(AUJOURDHUI.relecture);
    expect([par("court-angle").version, par("court-script").version, par("court-relecture").version]).toEqual([2, 4, 2]);
    expect(par("court-script").consigne).toContain(RECETTE_SCRIPT);
  });
  it("roleCourtPour : l'avocat reçoit la variante, les autres formats le rôle lui-même ; même id et même schéma", () => {
    for (const r of Object.values(ROLES_CHAINE_COURTE) as DefinitionRole[]) {
      const a = roleCourtPour({ p: { formatId: "avocat" } } as never, r);
      expect(a).not.toBe(r);
      expect(a.id).toBe(r.id);
      expect(a.schema).toBe(r.schema);
      expect(a.maxTokens).toBe(r.maxTokens);
      expect(roleCourtPour({ p: { formatId: "facecam" } } as never, r)).toBe(r);
    }
  });
});

describe("contrôles C95 à C99 : sans objet pour l'avocat, inchangés pour les autres", () => {
  const AUTRES = ["C95", "C96", "C97", "C98", "C99"];
  const avec = (formatId: string | undefined, auteur: "machine" | "will" = "machine") =>
    versionV4(auteur, (e: EntreeControle) => {
      // Un texte qui lève les cinq : tutoriel numéroté et « faites-le vous-même », aucune question, rien sur « on s'en occupe », fin qui redit l'accroche.
      const mots = (t: string) => t;
      e.corps[0].segments.forEach((s, i) => {
        s.texte = mots(["Un. Listez vos devis.", "Deux. Cochez ceux ouverts.", "Trois. Relancez les autres.", "Faites-le vous-même en dix minutes."][i] ?? "Ainsi.");
      });
      e.fin[0].segments[e.fin[0].segments.length - 1].texte = "Faites-le vous-même en dix minutes.";
      e.maitre = formatId === undefined ? e.maitre : { ...e.maitre!, brief: { ...(e.maitre?.brief ?? {}), formatId } as never };
    });

  it("avocat : aucun C95, C96, C97, C98, C99, quel que soit l'auteur", () => {
    for (const auteur of ["machine", "will"] as const) {
      const r = controlerVersion(avec("avocat", auteur));
      expect(codesLeves(r).filter((c) => AUTRES.includes(c)), auteur).toEqual([]);
    }
  });
  it("face caméra et central : les mêmes contrôles qu'aujourd'hui, C95 bloquant pour la machine", () => {
    for (const f of ["facecam", "central"]) {
      const r = controlerVersion(avec(f));
      const codes = codesLeves(r);
      expect(codes, String(f)).toContain("C95");
      expect(r.violations.find((v) => v.controle === "C95")?.bloquant, String(f)).toBe(true);
      expect(codes.filter((c) => AUTRES.includes(c)).length, String(f)).toBeGreaterThanOrEqual(2);
    }
  });
  it("le reste des contrôles est le même pour l'avocat et pour face caméra (seuls C95 à C99 sautent)", () => {
    const hors = (f: string) => codesLeves(controlerVersion(avec(f))).filter((c) => !AUTRES.includes(c));
    expect(hors("avocat")).toEqual(hors("facecam"));
  });
});
