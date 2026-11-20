import { afterEach, describe, expect, it, vi } from "vitest";
import { relevePhrase } from "../../../outils/maquettes-tableaux-de-bord/essai-reel/releve-phrase";

const exporter = (roles: string[], plafondUsd = 1, plafondCreationUsd = 1) =>
  JSON.stringify({ plafondUsd, plafondCreationUsd, lignes: roles.map((role) => ({ role, coutUsd: 0.1 })) });

afterEach(() => vi.unstubAllGlobals());

describe("relevé de l'essai parti d'une phrase", () => {
  it("1 appel maquettiste + rôles V1 : sous le plafond", () => {
    const r = relevePhrase(exporter(["maquettiste", "tutoriel-plan", "tutoriel-script"]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.releve.appelsMaquettiste).toBe(1);
      expect(r.releve.appelsParRole).toEqual({ maquettiste: 1, "tutoriel-plan": 1, "tutoriel-script": 1 });
      expect(r.releve.depenseUsd).toBeCloseTo(0.3, 6);
      expect(r.releve.sousLePlafond).toBe(true);
      expect(r.releve.ecart).toBeCloseTo(0.7, 6);
    }
  });

  it("2 appels maquettiste (une proposition + une autre) restent permis ; au-dessus du plafond le dit", () => {
    const r = relevePhrase(exporter(["maquettiste", "maquettiste"], 0.1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.releve.appelsMaquettiste).toBe(2);
    expect(r.releve.sousLePlafond).toBe(false);
    expect(r.releve.ecart).toBeLessThan(0);
  });

  it("2 appels maquettiste sous le plafond : permis et sous le plafond (le seuil de 2 est bien « au plus »)", () => {
    const r = relevePhrase(exporter(["maquettiste", "maquettiste"], 1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.releve.appelsMaquettiste).toBe(2);
      expect(r.releve.sousLePlafond).toBe(true);
    }
  });

  it("argent au-dessus du plafond (0,40 $ pour 0,26 $) : relevé ok mais sousLePlafond faux, écart négatif", () => {
    const r = relevePhrase(JSON.stringify({ plafondUsd: 0.26, plafondCreationUsd: 0.26, lignes: [{ role: "maquettiste", coutUsd: 0.4 }] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.releve.sousLePlafond).toBe(false);
      expect(r.releve.ecart).toBeCloseTo(-0.14, 6);
    }
  });

  it("3 appels maquettiste : refus « dépassement »", () => {
    const r = relevePhrase(exporter(["maquettiste", "maquettiste", "maquettiste"]));
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.raison).toContain("dépassement");
  });

  it("aucune ligne maquettiste : « aucune création relevée »", () => {
    const r = relevePhrase(exporter(["tutoriel-plan"]));
    // 1 ligne à 0,1 $ pour un plafond de 1 $ : le total et le plafond sont montrés (terminal seulement).
    expect(r).toEqual({ ok: false, raison: "aucune création relevée : vérifier le réglage (dépense relevée 0.1 $ pour un plafond de 1 $)" });
  });

  it("aucune ligne maquettiste (rôle mal nommé) mais dépense au-dessus du plafond : la dépense est montrée, arrêt", () => {
    const r = relevePhrase(JSON.stringify({ plafondUsd: 0.26, plafondCreationUsd: 0.26, lignes: [{ role: "Maquettiste ", coutUsd: 0.4 }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.raison).toContain("aucune création relevée");
      expect(r.raison).toContain("0.4 $");
      expect(r.raison).toContain("0.26 $");
      expect(r.raison).toContain("AU-DESSUS DU PLAFOND");
    }
  });

  it("2 appels maquettiste à 0,20 $ pour un plafond de création de 0,26 $ : signalé, même sous un plafond vidéo large", () => {
    const r = relevePhrase(
      JSON.stringify({ plafondUsd: 2, plafondCreationUsd: 0.26, lignes: [{ role: "maquettiste", coutUsd: 0.2 }, { role: "maquettiste", coutUsd: 0.2 }] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.releve.sousLePlafond).toBe(true); // 0,40 $ sous 2 $ : le plafond vidéo seul ne voit rien
    expect(r.releve.depenseMaquettisteUsd).toBeCloseTo(0.4, 6);
    expect(r.releve.sousLePlafondCreation).toBe(false);
    expect(r.releve.ecartCreation).toBeCloseTo(-0.14, 6);
    expect(r.releve.arret).toBe(true);
  });

  it("les rôles V1 ne font pas dépasser le plafond de création : 2 x 0,13 $ + 0,01 $ pour 0,26 $", () => {
    const r = relevePhrase(
      JSON.stringify({
        plafondUsd: 1,
        plafondCreationUsd: 0.26,
        lignes: [{ role: "maquettiste", coutUsd: 0.13 }, { role: "maquettiste", coutUsd: 0.13 }, { role: "tutoriel-plan", coutUsd: 0.01 }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.releve.depenseMaquettisteUsd).toBeCloseTo(0.26, 6);
    expect(r.releve.sousLePlafondCreation).toBe(true);
    expect(r.releve.arret).toBe(false);
  });

  it("plafond de création absent, nul ou négatif : export refusé", () => {
    const ligne = [{ role: "maquettiste", coutUsd: 0.1 }];
    expect(relevePhrase(JSON.stringify({ plafondUsd: 1, lignes: ligne })).ok).toBe(false);
    expect(relevePhrase(JSON.stringify({ plafondUsd: 1, plafondCreationUsd: 0, lignes: ligne })).ok).toBe(false);
    expect(relevePhrase(JSON.stringify({ plafondUsd: 1, plafondCreationUsd: -1, lignes: ligne })).ok).toBe(false);
  });

  it("3 appels maquettiste : la raison montre aussi la dépense et le plafond (terminal seulement)", () => {
    const r = relevePhrase(exporter(["maquettiste", "maquettiste", "maquettiste"]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toContain("dépense relevée 0.3 $ pour un plafond de 1 $");
  });

  it("export illisible refusé", () => {
    expect(relevePhrase("pas du json").ok).toBe(false);
    expect(relevePhrase(JSON.stringify({ plafondUsd: 1, plafondCreationUsd: 1, lignes: [{ role: "x", coutUsd: -1 }] })).ok).toBe(false);
  });

  it("aucune lecture réseau", () => {
    const piege = vi.fn(() => {
      throw new Error("réseau interdit");
    });
    vi.stubGlobal("fetch", piege);
    relevePhrase(exporter(["maquettiste"]));
    relevePhrase(exporter(["maquettiste", "maquettiste", "maquettiste"]));
    expect(piege).not.toHaveBeenCalled();
  });
});
