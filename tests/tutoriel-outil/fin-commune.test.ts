/**
 * T-EXT-26a : fin commune du tutoriel. « Aucune » par défaut, « Prendre rendez-vous » seulement si choisie ; interrupteur
 * éteint = la carte « Axion IA » d'aujourd'hui. Doubles partout : aucun appel réel, aucune voix, aucun rendu, 0 €.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { LIBELLE_APPEL_RDV } from "@/briques/motion/habillage-commun/sequence-appel";
import { creerMoteurTutorielOutil, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { etatInitial, proprietesTutoriel, type EtatTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { finDuTutoriel } from "@/moteurs/montage-tutoriel-outil/fin";
import { CARTE_FIN_AXION, DUREE_CARTE_FIN_MS, dureeImagesTutoriel, formatDuRatio, HABILLAGE_TUTORIEL, planCarteFin } from "@/moteurs/montage-tutoriel-outil/proprietes";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 20, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
const avecFin = (fin?: unknown): CommandeFabrication => commandeTutoriel({ entrees: { tutorielOutil: { scriptColle: true, ...(fin !== undefined ? { fin } : {}) } } });

/** Plan minimal pour les propriétés (pas de scène : seule la durée compte ici). */
const planDe = (ratio: "4:5" | "9:16" | "1:1"): PlanValide => ({ version: "plan-scenes-1", format: formatDuRatio(ratio), facecam: false, dureeMs: 20_000, habillage: HABILLAGE_TUTORIEL, mots: [], scenes: [] });
const etatAvecPlan = (ratio: "4:5" | "9:16" | "1:1", plus: Partial<EtatTutoriel> = {}): EtatTutoriel => ({ ...etatInitial({ ratios: [ratio] }), plan: { plan: planDe(ratio), remarques: [], source: "claude" as never, empreinteEntree: "x", scenesTouchees: [] } as never, ...plus });

async function mener(o: OutilsTutoriel, c: CommandeFabrication) {
  const moteur = creerMoteurTutorielOutil({ outils: une(o) });
  let t = await moteur.lancer(c, { travailId: "t-fin", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  for (let i = 0; i < 600; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return t;
}
const compositions = (j: Journal) => j.rendus.filter((d) => d.operation === "composition");
const props = (j: Journal, i = 0) => compositions(j)[i].parametres.proprietes as { fin?: { titre: string; sousTitre: string }; finMs: number; plan: { dureeMs: number }; sousTitres?: unknown };

describe("tutoriel d'outil : fin commune (T-EXT-26a)", () => {
  it("interrupteur absent : la carte « Axion IA » de 2500 ms, pour 4:5, 9:16 et 1:1, durée inchangée", () => {
    for (const ratio of ["4:5", "9:16", "1:1"] as const) {
      const p = proprietesTutoriel(etatAvecPlan(ratio), ratio, true, {}, undefined, avecFin("rendez-vous"));
      expect(p.fin).toEqual(CARTE_FIN_AXION);
      expect(p.finMs).toBe(DUREE_CARTE_FIN_MS);
      expect(dureeImagesTutoriel(p)).toBe(20 * 25 + Math.ceil((2500 * 25) / 1000));
    }
  });

  it("interrupteur « true » (chaîne) ou 1 : éteint", () => {
    for (const actif of ["true", 1]) {
      expect(finDuTutoriel("rendez-vous", actif as never === true)).toMatchObject({ choix: "carte-axion", finMs: 2500 });
      const p = proprietesTutoriel(etatAvecPlan("4:5"), "4:5", true, { fin: { actif: actif as never } }, undefined, avecFin("aucune"));
      expect(p.fin).toEqual(CARTE_FIN_AXION);
      expect(p.finMs).toBe(2500);
    }
  });

  it("allumé, aucune entrée ou « aucune » : aucune carte, finMs 0, durée = plan seul", () => {
    for (const fin of [undefined, "aucune"]) {
      const p = proprietesTutoriel(etatAvecPlan("4:5"), "4:5", true, { fin: { actif: true } }, undefined, avecFin(fin));
      expect(p.fin).toBeUndefined();
      expect(p.finMs).toBe(0);
      expect(dureeImagesTutoriel(p)).toBe(20 * 25);
    }
  });

  it("allumé + « rendez-vous » : titre = LIBELLE_APPEL_RDV, 2500 ms, aucune voix ni sous-titre ajoutés", () => {
    const e = finDuTutoriel("rendez-vous", true);
    expect(e.fin?.titre).toBe(LIBELLE_APPEL_RDV);
    expect(e.fin?.titre).toBe("Prendre rendez-vous");
    expect(e.finMs).toBe(2500);
    const p = proprietesTutoriel(etatAvecPlan("9:16"), "9:16", true, { fin: { actif: true } }, undefined, avecFin("rendez-vous"));
    expect(p.fin?.titre).toBe(LIBELLE_APPEL_RDV);
    expect(p.sousTitres).toBeUndefined();
    expect(planCarteFin(p).scenes[0].parametres).toMatchObject({ texte: "Prendre rendez-vous", style: "titre" });
    expect(planCarteFin(p).mots).toEqual([]);
  });

  it("allumé + « commentez » ou toute autre valeur : traité comme « aucune »", () => {
    for (const fin of ["commentez", "Commentez MOT", "", 3, null, {}]) {
      expect(lireEntreesTutoriel(avecFin(fin).entrees).fin).toBeUndefined();
      const p = proprietesTutoriel(etatAvecPlan("4:5"), "4:5", true, { fin: { actif: true } }, undefined, avecFin(fin));
      expect(p.fin).toBeUndefined();
      expect(p.finMs).toBe(0);
    }
  });

  it("la valeur « prendre-rendez-vous » déjà lue par l'équipe vaut « rendez-vous »", () => {
    expect(lireEntreesTutoriel(avecFin("prendre-rendez-vous").entrees).fin).toBe("rendez-vous");
  });

  it("bout en bout (doubles), allumé : la demande de rendu porte finMs 0 et la durée attendue suit", async () => {
    const j = journalVide();
    const t = await mener({ ...outilsDoubles(j), fin: { actif: true } }, avecFin());
    expect(t.statut).toBe("termine");
    expect(compositions(j).length).toBeGreaterThan(0);
    for (let i = 0; i < compositions(j).length; i++) {
      expect(props(j, i).finMs).toBe(0);
      expect(props(j, i).fin).toBeUndefined();
    }
  });

  it("bout en bout (doubles), éteint : la carte d'aujourd'hui part dans la demande de rendu", async () => {
    const j = journalVide();
    const t = await mener(outilsDoubles(j), avecFin("rendez-vous"));
    expect(t.statut).toBe("termine");
    expect(props(j).finMs).toBe(2500);
    expect(props(j).fin).toEqual(CARTE_FIN_AXION);
  });

  it("bout en bout (doubles), allumé + « rendez-vous » : la carte de rendez-vous, 2500 ms", async () => {
    const j = journalVide();
    await mener({ ...outilsDoubles(j), fin: { actif: true } }, avecFin("rendez-vous"));
    expect(props(j).finMs).toBe(2500);
    expect(props(j).fin?.titre).toBe(LIBELLE_APPEL_RDV);
  });

  it("réexport : la fin du parent est reprise telle quelle, même si l'entrée ou l'interrupteur ont changé", () => {
    const parent = finDuTutoriel("rendez-vous", true);
    const p = proprietesTutoriel(etatAvecPlan("4:5", { parent: { fin: parent } }), "4:5", true, { fin: { actif: true } }, undefined, avecFin("aucune"));
    expect(p.fin?.titre).toBe(LIBELLE_APPEL_RDV);
    expect(p.finMs).toBe(2500);
    const garde = proprietesTutoriel(etatAvecPlan("4:5", { fin: finDuTutoriel(undefined, true) }), "4:5", true, {}, undefined, avecFin("rendez-vous"));
    expect(garde.finMs).toBe(0);
  });
});
