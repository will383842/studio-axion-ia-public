/**
 * FIX-RENDU-LIBELLE-CONTROLES : l'historique ne dit plus « 2 alertes » quand aucun contrôle n'a échoué et que
 * 2 contrôles n'ont simplement pas été faits (rendu v-64a273d3580c). Doubles seulement : aucun appel.
 */
import { describe, expect, it } from "vitest";
import { libelleEvenement } from "../../../src/domaine/tracabilite-tableau";
import { fabriquerTableau, type EvenementFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import { copie, ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

describe("libellé de l'événement « controle » (après le montage)", () => {
  it("aucune alerte + contrôles non faits : les nomme", () => {
    const l = libelleEvenement({ type: "controle", donnees: { moment: "apres-montage", alertes: 0, nonFaits: ["Image figée", "Relecture des images clés"] } });
    expect(l).toBe("Contrôles de la vidéo · aucune alerte · 2 contrôles non faits (Image figée, Relecture des images clés)");
  });

  it("un seul contrôle non fait : singulier", () => {
    const l = libelleEvenement({ type: "controle", donnees: { moment: "apres-montage", alertes: 0, nonFaits: ["Image figée"] } });
    expect(l).toBe("Contrôles de la vidéo · aucune alerte · 1 contrôle non fait (Image figée)");
  });

  it("trace d'avant (sans nonFaits) : texte identique à avant", () => {
    expect(libelleEvenement({ type: "controle", donnees: { moment: "apres-montage", alertes: 2 } })).toBe("Contrôles de la vidéo · 2 alertes");
    expect(libelleEvenement({ type: "controle", donnees: { moment: "apres-montage", alertes: 0, nonFaits: [] } })).toBe("Contrôles de la vidéo · aucune alerte");
    expect(libelleEvenement({ type: "controle", donnees: { moment: "apres-montage", alertes: 0, nonFaits: "x" } })).toBe("Contrôles de la vidéo · aucune alerte");
  });
});

describe("chemin réel : la trace des contrôles de la sortie", () => {
  it("mesure d'image figée absente et aucun relecteur : alertes 0 et 2 contrôles non faits", async () => {
    const d = doubles(copie(ficheDemonstration));
    const montage = d.outils.montage!;
    const rendu = montage.rendu();
    const sansFige = { ...rendu, etat: async (id: string) => {
      const e = await rendu.etat(id);
      if (!e.mesures) return e;
      const { imagesFigeesHorsFin: _ignore, ...autres } = e.mesures as Record<string, unknown>;
      return { ...e, mesures: autres } as typeof e;
    } };
    const evenements: EvenementFabrication[] = [];
    await fabriquerTableau({ ...d.outils, montage: { ...montage, rendu: () => sansFige }, tracer: async (e) => void evenements.push(e) });
    const c = evenements.filter((e) => e.type === "controle" && e.cle.startsWith("controle:sortie:"));
    expect(c).toHaveLength(1);
    const donnees = c[0].donnees as { alertes: number; nonFaits: string[] };
    expect(donnees.alertes).toBe(0);
    expect(donnees.nonFaits).toHaveLength(2);
    expect(donnees.nonFaits).toEqual(expect.arrayContaining(["Image figée", "Relecture des images clés"]));
  });
});
