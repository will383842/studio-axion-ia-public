/** ALLUMER-ACCROCHE-SCRIPT-v21r : l'accroche tirée du script est ALLUMÉE par défaut dans la requête du plan de scènes. Doubles seulement, 0 €. */
import { describe, expect, it } from "vitest";
import { ACCROCHE_SCRIPT_ACTIVE, accrocheDuScript } from "@/briques/composition/accroche-script";
import { construireRequetePlan, consignePlan, genererPlan, type EntreeGenerateurPlan } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { DIX_SCRIPTS, motsHorodates } from "../faits-script/dix-scripts";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const entree = (script: string, extra: Partial<EntreeGenerateurPlan> = {}): EntreeGenerateurPlan => ({ script, mots: motsHorodates(script), format: FORMAT, facecam: false, ...extra });
const message = (r: RequeteClaude) => r.messages[0]!.contenu as string;
const lignesAccroche = (r: RequeteClaude) => message(r).split("\n").filter((l) => l.startsWith("Accroche du script"));

const RAPIDE = "On passe de 3 h à 20 min sur les mails.";
const MONTANT = "500 € par mois seulement.";
const LENT = "Bonjour à toutes et à tous";

/** Copie figée du message utilisateur de master (95aa5af, accroche éteinte) pour RAPIDE. */
const MESSAGE_MASTER_RAPIDE =
  "Format : 1080 × 1920, 25 i/s. Face caméra : non.\nScript :\nOn passe de 3 h à 20 min sur les mails.\nMinutage des mots (indice, texte, début ms, fin ms) :\n0\tOn\t0\t350\n1\tpasse\t350\t700\n2\tde\t700\t1050\n3\t3\t1050\t1400\n4\th\t1400\t1750\n5\tà\t1750\t2100\n6\t20\t2100\t2450\n7\tmin\t2450\t2800\n8\tsur\t2800\t3150\n9\tles\t3150\t3500\n10\tmails.\t3500\t3850\nFaits du script (type, mots, valeurs) :\npassage\t3-7\t{\"texte\":\"3 h à 20 min\",\"avant\":{\"valeur\":3,\"unite\":\"h\",\"surMot\":3},\"apres\":{\"valeur\":20,\"unite\":\"min\",\"surMot\":6}}";

describe("ALLUMER-ACCROCHE-SCRIPT-v21r · accroche allumée par défaut", () => {
  it("(a) constante allumée", () => {
    expect(ACCROCHE_SCRIPT_ACTIVE).toBe(true);
  });

  it("(b) défaut allumé : sans champ `accroche`, UNE ligne « Accroche du script », texte EXACT dit, après « Faits du script »", () => {
    const e = entree(RAPIDE);
    expect(e.accroche).toBeUndefined();
    const attendu = accrocheDuScript(e.mots);
    expect(attendu.type).toBe("passage");
    if (attendu.type === "rien") return;
    const r = construireRequetePlan(e);
    const l = lignesAccroche(r);
    expect(l).toEqual([`Accroche du script (dite avant 2 s, mots 3-7) : passage\t3 h à 20 min`]);
    expect(RAPIDE).toContain(attendu.texte);
    const lignes = message(r).split("\n");
    expect(lignes.indexOf(l[0]!)).toBeGreaterThan(lignes.indexOf("Faits du script (type, mots, valeurs) :"));
  });

  it("(c) `accroche: false` = master : requête identique à la copie figée de master, sans la ligne", () => {
    const r = construireRequetePlan(entree(RAPIDE, { accroche: false }));
    expect(message(r)).toBe(MESSAGE_MASTER_RAPIDE);
    expect(r.messages).toHaveLength(1);
    expect(lignesAccroche(r)).toEqual([]);
    expect(message(construireRequetePlan(entree(RAPIDE)))).toBe(`${MESSAGE_MASTER_RAPIDE}\nAccroche du script (dite avant 2 s, mots 3-7) : passage\t3 h à 20 min`);
  });

  it("(d) argent exclu : un montant dit en ouverture, sans champ → aucune ligne", () => {
    const r = construireRequetePlan(entree(MONTANT));
    expect(lignesAccroche(r)).toEqual([]);
    expect(message(r)).not.toMatch(/Accroche/);
    expect(r).toEqual(construireRequetePlan(entree(MONTANT, { accroche: false })));
  });

  it("(e) rien avant 2 s : requête identique à `accroche: false`", () => {
    expect(construireRequetePlan(entree(LENT))).toEqual(construireRequetePlan(entree(LENT, { accroche: false })));
    expect(lignesAccroche(construireRequetePlan(entree(LENT)))).toEqual([]);
  });

  it("(f) consigne système intacte dans tous les cas (cache 1 h)", () => {
    const cas = [entree(RAPIDE), entree(RAPIDE, { accroche: false }), entree(RAPIDE, { accroche: true }), entree(MONTANT), entree(LENT), ...DIX_SCRIPTS.map((s) => entree(s))];
    for (const e of cas) {
      const r = construireRequetePlan(e);
      expect(r.systeme).toHaveLength(1);
      expect(r.systeme[0]!.texte).toBe(consignePlan());
      expect(r.systeme[0]!.cache).toBe("1h");
    }
  });

  it("(g) aucun appel ajouté : même nombre d'appels allumé / éteint (1 si la réponse est bonne, 2 au plus)", async () => {
    const compter = async (e: EntreeGenerateurPlan, texte: string) => {
      let n = 0;
      await genererPlan(e, async () => {
        n++;
        return { texte, stopReason: "end_turn" } as ReponseClaude;
      });
      return n;
    };
    for (const texte of ['{"scenes":[]}', "pas du json"]) {
      const allume = await compter(entree(RAPIDE), texte);
      const eteint = await compter(entree(RAPIDE, { accroche: false }), texte);
      expect(allume).toBe(eteint);
      expect(allume).toBeLessThanOrEqual(2);
    }
    expect(await compter(entree(RAPIDE), '{"scenes":[]}')).toBe(1);
    expect(await compter(entree(RAPIDE), "pas du json")).toBe(2);
  });

  it("(h) borne de jetons : allumé − éteint ≤ 200 caractères pour les 10 scripts", () => {
    for (const s of DIX_SCRIPTS) {
      const diff = message(construireRequetePlan(entree(s))).length - message(construireRequetePlan(entree(s, { accroche: false }))).length;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(200);
    }
  });
});
