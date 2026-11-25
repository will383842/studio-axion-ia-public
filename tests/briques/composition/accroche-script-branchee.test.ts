/** C10-15-b1 : l'accroche du script est branchée à la requête du plan de scènes, ALLUMÉE par défaut (ALLUMER-ACCROCHE-SCRIPT-v21r). Aucun appel réel. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accrocheDuScript } from "@/briques/composition/accroche-script";
import { construireRequetePlan, consignePlan, type EntreeGenerateurPlan } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { DIX_SCRIPTS, motsHorodates } from "../faits-script/dix-scripts";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const entree = (script: string, extra: Partial<EntreeGenerateurPlan> = {}): EntreeGenerateurPlan => ({ script, mots: motsHorodates(script), format: FORMAT, facecam: false, ...extra });
const message = (r: RequeteClaude) => r.messages[0]!.contenu as string;
const lignesAccroche = (r: RequeteClaude) => message(r).split("\n").filter((l) => l.startsWith("Accroche du script"));

const RAPIDE = "On passe de 3 h à 20 min sur les mails.";
const MONTANT = "500 € par mois seulement.";

describe("C10-15-b1 · accroche dans la requête du plan (allumé par défaut)", () => {
  it("(a) éteint = `accroche: false` : aucune ligne pour les 10 scripts, « true » texte = false ; absent = allumé", () => {
    for (const s of DIX_SCRIPTS) {
      const ref = construireRequetePlan(entree(s, { accroche: false }));
      expect(construireRequetePlan(entree(s, { accroche: "true" as unknown as boolean }))).toEqual(ref);
      expect(lignesAccroche(ref)).toEqual([]);
      expect(construireRequetePlan(entree(s))).toEqual(construireRequetePlan(entree(s, { accroche: true })));
    }
  });

  it("(b) allumé : UNE ligne « Accroche du script » avec le texte EXACT dit, après les faits", () => {
    const e = entree(RAPIDE, { accroche: true });
    const attendu = accrocheDuScript(e.mots);
    expect(attendu.type).not.toBe("rien");
    if (attendu.type === "rien") return;
    const r = construireRequetePlan(e);
    const l = lignesAccroche(r);
    expect(l).toHaveLength(1);
    expect(l[0]).toContain(attendu.texte);
    expect(l[0]).toContain(`${attendu.type}\t${attendu.texte}`);
    const lignes = message(r).split("\n");
    expect(lignes.indexOf(l[0]!)).toBeGreaterThan(lignes.indexOf("Faits du script (type, mots, valeurs) :"));
  });

  it("(c) allumé, seul fait rapide = un montant : aucune ligne (argent exclu)", () => {
    const e = entree(MONTANT, { accroche: true });
    expect(lignesAccroche(construireRequetePlan(e))).toEqual([]);
    expect(construireRequetePlan(e)).toEqual(construireRequetePlan(entree(MONTANT)));
  });

  it("(d) allumé, aucun fait avant 2 s : requête identique à l'éteint", () => {
    const e = entree("Bonjour à toutes et à tous", { accroche: true });
    expect(construireRequetePlan(e)).toEqual(construireRequetePlan(entree("Bonjour à toutes et à tous")));
  });

  it("(e) la consigne système est intacte dans tous les cas (cache 1 h)", () => {
    for (const e of [entree(RAPIDE), entree(RAPIDE, { accroche: true }), entree(MONTANT, { accroche: true }), entree(DIX_SCRIPTS[0]!, { accroche: true })]) {
      const r = construireRequetePlan(e);
      expect(r.systeme[0]!.texte).toBe(consignePlan());
      expect(r.systeme[0]!.cache).toBe("1h");
    }
  });

  it("(f) garde statique : import relatif, aucun lireParametre", () => {
    const src = readFileSync("src/briques/plan-scenes/generateur.ts", "utf8");
    expect(src).toMatch(/from\s+["']\.\.\/composition\/accroche-script["']/);
    expect(src).not.toMatch(/lireParametre/);
  });
});
