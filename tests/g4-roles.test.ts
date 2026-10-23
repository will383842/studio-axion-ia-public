/**
 * Lot G4 · les rôles d'écriture (plan v5 B.3.1, B.7.3, B.7.4) : modules versionnés, consignes courtes et nettes,
 * évaluations écrites AVANT la consigne, schémas acceptés par la sortie structurée, simulation sans clé, et les ordres
 * de Will du 03/10 (domaine d'Axion-IA, récit du cas client, rien d'inventé, aucune consigne propre à Excel).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ETAPE_DU_ROLE, EVALUATIONS_DES_ROLES, ROLES_ECRITURE, versionsRoles } from "@/generateur/roles";
import { QUESTIONS_JUGES } from "@/generateur/roles/questions";
import { construireRequete, PHRASES_FIXES, schemaJson, type DefinitionRole } from "@/generateur/roles/types";
import { blocsEnCache } from "@/generateur/contexte";
import { CADRE_AXION } from "@/donnees/generateur/domaine-axion";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { executerChaine } from "@/generateur/chaine";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "./helpers/g4";

const ROLES = Object.entries(ROLES_ECRITURE) as [keyof typeof ROLES_ECRITURE, DefinitionRole][];
const MODULES: Record<string, string> = { stratege: "stratege", fond: "fond", accroches: "accroches", juge: "juge", plan: "plan", prose: "prose", preference: "preference", reecriture: "reecriture", declinaison: "declinaison" };

function cles(x: unknown, acc: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((y) => cles(y, acc));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) {
      acc.push(k);
      cles(v, acc);
    }
  return acc;
}

describe("G4 · les rôles du générateur", () => {
  it("chaque rôle est un module versionné : id, version, consigne, schéma zod, modèle, effort explicite, maxTokens", () => {
    for (const [nom, r] of ROLES) {
      expect(r.id, nom).toBe(nom);
      expect(r.version).toBeGreaterThanOrEqual(1);
      expect(r.consigne.trim().length).toBeGreaterThan(100);
      expect(r.schema, nom).toBeDefined();
      expect(["claude-opus-5-5", "claude-sonnet-5-5"]).toContain(r.modele);
      expect(["low", "medium", "high"]).toContain(r.effort);
      expect(r.maxTokens).toBeGreaterThanOrEqual(2000);
      expect(ETAPE_DU_ROLE[nom].length).toBeGreaterThan(0);
    }
    // Les 3 rôles de la chaîne courte (chaîne de production) et les 4 de la chaîne « équipe » sont aussi dans la fiche figée.
    expect(Object.keys(versionsRoles())).toHaveLength(ROLES.length + 3 + 4);
    expect(versionsRoles()).toMatchObject({ "court-angle": 2, "court-script": 4, "court-relecture": 2 });
  });

  it("écriture par Opus, juges et déclinaisons par Sonnet (B.3.2)", () => {
    for (const n of ["stratege", "fond", "accroches", "plan", "prose", "reecriture"] as const) expect(ROLES_ECRITURE[n].modele).toBe("claude-opus-5-5");
    for (const n of ["juge", "preference", "declinaison"] as const) expect(ROLES_ECRITURE[n].modele).toBe("claude-sonnet-5-5");
  });

  it("consigne courte (< 500 lignes), avec les phrases fixes de B.3.1 ajoutées à chaque requête", () => {
    for (const [, r] of ROLES) {
      expect(r.consigne.split("\n").length).toBeLessThan(500);
      const req = construireRequete(r, { contexte: {}, variable: "x" });
      const systeme = req.systeme.map((b) => b.texte).join("\n");
      for (const p of PHRASES_FIXES) expect(systeme).toContain(p);
    }
  });

  it("évaluations écrites AVANT la consigne, dans chaque module", () => {
    for (const [nom, fichier] of Object.entries(MODULES)) {
      const src = readFileSync(join("src", "generateur", "roles", `${fichier}.ts`), "utf8");
      const ev = src.indexOf("export const EVALUATIONS_");
      const co = src.indexOf("export const CONSIGNE_");
      expect(ev, nom).toBeGreaterThan(0);
      expect(co, nom).toBeGreaterThan(ev);
      expect(EVALUATIONS_DES_ROLES[nom as keyof typeof EVALUATIONS_DES_ROLES].length).toBeGreaterThan(0);
    }
  });

  it("schémas acceptés par la sortie structurée : objets fermés, aucune borne numérique ni longueur", () => {
    for (const [nom, r] of ROLES) {
      const j = schemaJson(r.schema!);
      const k = cles(j);
      for (const interdite of ["minimum", "maximum", "minLength", "maxLength", "exclusiveMinimum", "exclusiveMaximum"]) expect(k, `${nom} : ${interdite}`).not.toContain(interdite);
      expect(JSON.stringify(j)).toContain('"additionalProperties":false');
    }
  });

  it("aucune consigne ne contient « Excel » en dur (les règles sont générales, ordre de Will du 03/10)", () => {
    for (const [nom, r] of ROLES) expect(/excel/i.test(r.consigne), nom).toBe(false);
  });

  it("le domaine d'Axion-IA, le récit du cas client et le « rien d'inventé » sont dans les consignes d'écriture", () => {
    for (const n of ["stratege", "plan", "prose"] as const) {
      const c = ROLES_ECRITURE[n].consigne;
      expect(c, n).toMatch(/est venu nous voir/);
      expect(c, n).toMatch(/faux témoignage/);
      expect(c, n).toMatch(/chiffres-non-prouves/);
      expect(c, n).toMatch(/se dire « c'est exactement moi »/);
    }
    for (const n of ["stratege", "accroches", "plan", "prose"] as const) expect(ROLES_ECRITURE[n].consigne, n).toMatch(/PROBLÈME RÉEL|COÛT|ISSUE/);
    // Le format « type avocat » : sa phrase est lue par la seule recette avocat (Will, 14/10).
    expect(parametresGenerateur("avocat").cadreFormat).toMatch(/STYLE de vidéo/);
    expect(parametresGenerateur("avocat").cadreFormat).toMatch(/jamais de droit/);
    expect(CADRE_AXION).toMatch(/Permis : réserver un appel/);
  });

  it("les modèles de ton : 2-3 extraits RÉELS des vidéos modèles, marqués données, dans le bloc mis en cache", () => {
    const z = etapeZeroBanc(SUJETS_BANC[0]);
    if (!z.ok) throw new Error("étape 0");
    // Le bloc <gagnants> suit les modèles de ton du format (banc : avocat → la v4 de Will, puis l'avocat de référence).
    const cache = blocsEnCache(z.donnees, parametresGenerateur(z.donnees.sujet.formatId));
    expect(cache.gagnants).toMatch(/<modele code="W01"/);
    expect(cache.gagnants).toMatch(/<modele code="D01"/);
    expect(cache.gagnants).toMatch(/<modele code="D06"/);
    expect(cache.gagnants).toMatch(/jamais un contenu à reprendre/);
    // Le cadre du format part dans la recette, après le socle commun (cache partagé, 15/10).
    expect(cache.recette).toContain("STYLE de vidéo");
    expect(cache.contexteAxion).not.toContain("STYLE de vidéo");
  });

  it("les juges : questions oui/non versionnées, dont PROB-01 et REC-01 (le spectateur se reconnaît)", () => {
    const ids = QUESTIONS_JUGES.map((q) => q.id);
    for (const q of ["ACC-01", "ACC-05", "SCR-01", "CRED-01", "VOIX-02", "PROM-01", "ENV-03", "BCL-01", "PROB-01", "REC-01"]) expect(ids).toContain(q);
    expect(new Set(ids).size).toBe(ids.length);
    expect(QUESTIONS_JUGES.find((q) => q.id === "REC-01")!.texte).toBe("Un dirigeant de la cible se reconnaîtrait-il dans ce client ?");
  });

  it("simulation sans clé : chaque rôle répond selon son schéma et passe ses évaluations critiques sur le banc", async () => {
    for (const s of SUJETS_BANC) {
      const z = etapeZeroBanc(s);
      if (!z.ok) throw new Error(s.code);
      const { executeur, appels } = executeurSimule();
      const r = await executerChaine(z.donnees, executeur, { tournures: TOURNURES_G4 });
      expect(r.statut, s.code).toBe("terminee");
      for (const nom of ["stratege", "fond", "accroches", "plan", "prose", "declinaison", "juge"]) expect(appels.some((a) => a.role === nom), `${s.code} ${nom}`).toBe(true);
      expect(r.etat.journal.filter((j) => j.resultat === "invalide")).toEqual([]);
    }
  });
});
