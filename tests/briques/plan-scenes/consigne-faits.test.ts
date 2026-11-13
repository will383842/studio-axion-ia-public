/** GV2-48 : la consigne du modèle ne nomme personne, et le message nourrit le modèle des faits du script et des pièces récentes. */
import { describe, expect, it } from "vitest";
import { construireRequetePlan, consignePlan, type EntreeGenerateurPlan } from "@/briques/plan-scenes/generateur";
import { faitsDuScript } from "@/briques/faits-script/extraire";
import { adapterPlan } from "@/briques/plan-scenes-generateurs/adaptateur";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { DIX_SCRIPTS, motsHorodates } from "../faits-script/dix-scripts";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };

function entree(script: string, extra: Partial<EntreeGenerateurPlan> = {}): EntreeGenerateurPlan {
  return { script, mots: motsHorodates(script), format: FORMAT, facecam: false, ...extra };
}
const texteUtilisateur = (r: RequeteClaude) => r.messages[0]!.contenu as string;

describe("consigne du plan de scènes (GV2-48)", () => {
  it("ne contient aucun prénom, parle du fondateur et demande surMot", () => {
    const c = consignePlan();
    expect(c).not.toMatch(/williams/i);
    expect(c).not.toMatch(/\bwill\b/i);
    expect(c).toContain("fondateur");
    expect(c).toContain("surMot");
    expect(c).toContain("aMs");
    expect(c).toContain("Évitez les pièces listées comme récentes");
    expect(c).not.toContain("fausse interface logicielle, au mot près");
  });

  it("est identique pour deux scripts différents (cache 1 h)", () => {
    const a = construireRequetePlan(entree(DIX_SCRIPTS[0]!));
    const b = construireRequetePlan(entree(DIX_SCRIPTS[1]!, { piecesRecentes: ["compteur"] }));
    expect(a.systeme[0]!.texte).toBe(b.systeme[0]!.texte);
    expect(a.systeme[0]!.cache).toBe("1h");
  });

  it("le message du script 1 contient le passage 2 h → 20 min et les trois étapes", () => {
    const m = texteUtilisateur(construireRequetePlan(entree(DIX_SCRIPTS[0]!)));
    expect(m).toContain("Faits du script (type, mots, valeurs) :");
    const lignes = m.split("\n");
    const passage = lignes.find((l) => l.startsWith("passage"));
    expect(passage).toBeDefined();
    expect(passage).toMatch(/"valeur":2/);
    expect(passage).toMatch(/"valeur":20/);
    const etapes = lignes.find((l) => l.startsWith("etapes"));
    expect(etapes).toBeDefined();
    for (const e of ["trier", "répondre", "classer"]) expect(etapes).toContain(e);
  });

  it("sans fait, aucun bloc de faits ; les pièces récentes vont dans le message, pas dans la consigne", () => {
    const sans = texteUtilisateur(construireRequetePlan(entree("Bonjour à toutes et à tous")));
    expect(sans).not.toContain("Faits du script");
    expect(sans).not.toContain("Pièces récentes à éviter");
    const r = construireRequetePlan(entree(DIX_SCRIPTS[0]!, { piecesRecentes: ["compteur"] }));
    const m = texteUtilisateur(r);
    expect(m).toContain("Pièces récentes à éviter : compteur");
    expect(r.systeme[0]!.texte).toBe(consignePlan());
    expect(texteUtilisateur(construireRequetePlan(entree(DIX_SCRIPTS[0]!, { piecesRecentes: [] })))).not.toContain("Pièces récentes à éviter");
  });

  it("l'adaptateur passe au fournisseur les faits de faitsDuScript sur les mots des segments, et les pièces récentes", async () => {
    const script = DIX_SCRIPTS[0]!;
    const mots = motsHorodates(script);
    const segments = [{ texte: script, debutMs: 0, finMs: mots.at(-1)!.finMs, mots }];
    const vus: RequeteClaude[] = [];
    const appeler = async (r: RequeteClaude): Promise<ReponseClaude> => {
      vus.push(r);
      return { texte: "pas du json", stopReason: "end_turn" } as ReponseClaude;
    };
    const res = await adapterPlan({ generateur: "plan-scenes", script, segments, format: FORMAT, facecam: false, piecesRecentes: ["compteur"] } as never, { appeler });
    expect(res.remarques.length).toBeGreaterThan(0);
    expect(vus.length).toBeLessThanOrEqual(2);
    const attendus = faitsDuScript(mots);
    expect(attendus.length).toBeGreaterThan(0);
    const m = texteUtilisateur(vus[0]!);
    const bloc = m.split("Faits du script (type, mots, valeurs) :\n")[1]!.split("\nPièces récentes à éviter")[0]!.split("\nMinutage")[0]!;
    const lignes = bloc.split("\n").filter(Boolean);
    expect(lignes.length).toBe(attendus.length);
    attendus.forEach((f, i) => expect(lignes[i]!.startsWith(f.type)).toBe(true));
    expect(m).toContain("Pièces récentes à éviter : compteur");
  });
});
