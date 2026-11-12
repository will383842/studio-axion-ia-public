/**
 * GV-ST-05 : la démo face caméra dessine ses sous-titres avec le style de la Bibliothèque (calque commun) ; sans style,
 * ou pour un rendu déjà en file (anciennes propriétés), la pastille fixe d'avant reste.
 */
import { describe, expect, it } from "vitest";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { MotHorodate } from "@/domaine/types";
import { calqueSousTitresDemo, etatDemoInitial, proprietesDemo, styleSousTitresDemo } from "@/moteurs/montage-demo-facecam/chaine";
import { lireEntreesDemo } from "@/moteurs/montage-demo-facecam/entrees";
import { commandeTutoriel } from "../tutoriel-outil/doubles";
import { planDeRepli, validerPlan } from "@/briques/plan-scenes/validateur";
import { formatPlanDemo } from "@/moteurs/montage-demo-facecam/chaine";

const MOTS: MotHorodate[] = "Voici comment créer votre premier tableau de bord en une minute chrono".split(" ").map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
const AVEC_STYLE = commandeTutoriel({ styles: { sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT }, decor: null, profilSon: null, lut: null, musique: null } });

function etatEtEntrees() {
  const commande = commandeTutoriel({ moteurId: "montage-demo-facecam", formatId: "demo-facecam" });
  const entrees = { ...lireEntreesDemo(commande), facecam: { cle: "f.mp4", largeur: 1920, hauteur: 1080, dureeSec: 10 } } as ReturnType<typeof lireEntreesDemo>;
  const contexte = { mots: MOTS.map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.round(m.finSec * 1000) })), format: formatPlanDemo(), facecam: false, dureeMs: 10000 };
  const etat = { ...etatDemoInitial(), mots: MOTS, dureeSec: 10, synchro: { mode: "aucune" as const, decalageSec: 0 }, plan: validerPlan(planDeRepli(contexte), contexte).plan };
  return { etat, entrees };
}

describe("démo face caméra : style de sous-titres", () => {
  it("avec un style : calqueSousTitres présent, texte validé mot pour mot, anciens groupes gardés", () => {
    const { etat, entrees } = etatEtEntrees();
    const p = proprietesDemo(etat, entrees, "4:5", styleSousTitresDemo(AVEC_STYLE));
    expect(p.calqueSousTitres).toBeDefined();
    const mots = p.calqueSousTitres!.segments.flatMap((s) => s.mots.map((m) => m.mot));
    expect(mots).toEqual(MOTS.map((m) => m.mot));
    expect(p.sousTitres.length).toBeGreaterThan(0);
  });

  it("sans style : propriétés d'avant, sans calqueSousTitres (pastille conservée)", () => {
    const { etat, entrees } = etatEtEntrees();
    expect(styleSousTitresDemo(commandeTutoriel())).toBeNull();
    const p = proprietesDemo(etat, entrees, "4:5", null);
    expect("calqueSousTitres" in p).toBe(false);
    expect(proprietesDemo(etat, entrees, "4:5")).toEqual(p);
  });

  it("une position de style sur la moitié facecam est ramenée dans la zone des sous-titres, avec signalement", () => {
    const st = { prononciations: [], style: { ...STYLE_SOUS_TITRES_AVOCAT, positionPct: 85 } };
    const r = calqueSousTitresDemo(MOTS, "4:5", st)!;
    expect(r.deplace).toBe(true);
    expect(r.calque.positions.milieuPct).toBeLessThan(50);
    const libre = calqueSousTitresDemo(MOTS, "4:5", { prononciations: [], style: { ...STYLE_SOUS_TITRES_AVOCAT, positionPct: 30 } })!;
    // Dans la moitié écran : le centre choisi par le style n'est pas touché.
    expect(libre.calque.positions.milieuPct).toBe(30);
  });

  it("sans mot : pas de calque", () => {
    expect(calqueSousTitresDemo([], "4:5", { prononciations: [] })).toBeNull();
  });
});
