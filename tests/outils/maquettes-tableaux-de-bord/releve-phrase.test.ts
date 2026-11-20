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
    // seul le plafond de la vidéo est dépassé (création 0,20 $ sous 1 $) : arret doit quand même être vrai
    expect(r.releve.sousLePlafondCreation).toBe(true);
    expect(r.releve.arret).toBe(true);
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
    expect(relevePhrase(JSON.stringify({ plafondUsd: 1, plafondCreationUsd: 1, lignes: [{ role: "maquettiste", coutUsd: -1 }] })).ok).toBe(false);
  });

  it("une ligne à coût négatif ne cache pas un dépassement : export refusé « export illisible »", () => {
    // 0,2 + 1,5 - 1 = 0,7 $ serait sous le plafond vidéo de 1 $ : sans la garde, le dépassement (1,7 $) serait caché.
    const r = relevePhrase(
      JSON.stringify({
        plafondUsd: 1,
        plafondCreationUsd: 0.26,
        lignes: [{ role: "maquettiste", coutUsd: 0.2 }, { role: "tutoriel-voix", coutUsd: 1.5 }, { role: "tutoriel-plan", coutUsd: -1 }],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toContain("export illisible");
  });

  it("dépense égale au plafond de la vidéo : sous le plafond, écart nul, pas d'arrêt", () => {
    const r = relevePhrase(
      JSON.stringify({ plafondUsd: 0.5, plafondCreationUsd: 0.26, lignes: [{ role: "maquettiste", coutUsd: 0.2 }, { role: "tutoriel-plan", coutUsd: 0.3 }] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.releve.depenseUsd).toBe(0.5);
    expect(r.releve.sousLePlafond).toBe(true);
    expect(r.releve.ecart).toBe(0);
    expect(r.releve.arret).toBe(false);
  });

  it("dépense égale au plafond de création : sous le plafond de création, écart nul, pas d'arrêt", () => {
    const r = relevePhrase(
      JSON.stringify({ plafondUsd: 1, plafondCreationUsd: 0.26, lignes: [{ role: "maquettiste", coutUsd: 0.13 }, { role: "maquettiste", coutUsd: 0.13 }] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.releve.sousLePlafondCreation).toBe(true);
    expect(r.releve.ecartCreation).toBe(0);
    expect(r.releve.arret).toBe(false);
  });

  it("un centime au-dessus de chaque plafond : arrêt, pour la vidéo comme pour la création", () => {
    const video = relevePhrase(JSON.stringify({ plafondUsd: 0.5, plafondCreationUsd: 1, lignes: [{ role: "maquettiste", coutUsd: 0.2 }, { role: "tutoriel-plan", coutUsd: 0.31 }] }));
    expect(video.ok && video.releve.sousLePlafond).toBe(false);
    expect(video.ok && video.releve.arret).toBe(true);
    const creation = relevePhrase(JSON.stringify({ plafondUsd: 5, plafondCreationUsd: 0.26, lignes: [{ role: "maquettiste", coutUsd: 0.27 }] }));
    expect(creation.ok && creation.releve.sousLePlafondCreation).toBe(false);
    expect(creation.ok && creation.releve.arret).toBe(true);
  });

  it("plafond de la vidéo absent, négatif, non numérique ou nul (null) : export refusé ; zéro permis comme plafond mais tout coût le dépasse", () => {
    const lignes = [{ role: "maquettiste", coutUsd: 0.1 }];
    const base = { plafondCreationUsd: 1, lignes };
    expect(relevePhrase(JSON.stringify(base)).ok).toBe(false);
    expect(relevePhrase(JSON.stringify({ ...base, plafondUsd: -1 })).ok).toBe(false);
    expect(relevePhrase(JSON.stringify({ ...base, plafondUsd: "1" })).ok).toBe(false);
    expect(relevePhrase(JSON.stringify({ ...base, plafondUsd: null })).ok).toBe(false);
    const zero = relevePhrase(JSON.stringify({ ...base, plafondUsd: 0 }));
    expect(zero.ok && zero.releve.sousLePlafond).toBe(false);
    expect(zero.ok && zero.releve.arret).toBe(true);
  });

  it("plafond de création non numérique ou null : export refusé", () => {
    const lignes = [{ role: "maquettiste", coutUsd: 0.1 }];
    expect(relevePhrase(JSON.stringify({ plafondUsd: 1, plafondCreationUsd: "1", lignes })).ok).toBe(false);
    expect(relevePhrase(JSON.stringify({ plafondUsd: 1, plafondCreationUsd: null, lignes })).ok).toBe(false);
  });

  it("lignes mal formées : export refusé (pas un tableau, ligne non objet, rôle vide ou absent, coût absent, texte ou null)", () => {
    const base = { plafondUsd: 1, plafondCreationUsd: 1 };
    const bon = { role: "maquettiste", coutUsd: 0.1 };
    const refuse = (lignes: unknown) => relevePhrase(JSON.stringify({ ...base, lignes })).ok;
    expect(refuse(undefined)).toBe(false);
    expect(refuse("maquettiste")).toBe(false);
    expect(refuse({ 0: bon })).toBe(false);
    expect(refuse([bon, null])).toBe(false);
    expect(refuse([bon, 3])).toBe(false);
    expect(refuse([bon, { role: "", coutUsd: 0.1 }])).toBe(false);
    expect(refuse([bon, { coutUsd: 0.1 }])).toBe(false);
    expect(refuse([bon, { role: 5, coutUsd: 0.1 }])).toBe(false);
    expect(refuse([bon, { role: "tutoriel-plan" }])).toBe(false);
    expect(refuse([bon, { role: "tutoriel-plan", coutUsd: "0.1" }])).toBe(false);
    expect(refuse([bon, { role: "tutoriel-plan", coutUsd: null }])).toBe(false);
    expect(refuse([bon])).toBe(true);
  });

  it("export qui n'est pas un objet (null, tableau, nombre) ou coût non fini (1e999 lu comme Infinity) : refusé", () => {
    expect(relevePhrase("null").ok).toBe(false);
    expect(relevePhrase("[]").ok).toBe(false);
    expect(relevePhrase("3").ok).toBe(false);
    expect(relevePhrase('{"plafondUsd":1,"plafondCreationUsd":1,"lignes":[{"role":"maquettiste","coutUsd":1e999}]}').ok).toBe(false);
    expect(relevePhrase('{"plafondUsd":1e999,"plafondCreationUsd":1,"lignes":[{"role":"maquettiste","coutUsd":0.1}]}').ok).toBe(false);
    expect(relevePhrase('{"plafondUsd":1,"plafondCreationUsd":1e999,"lignes":[{"role":"maquettiste","coutUsd":0.1}]}').ok).toBe(false);
  });

  it("un seul appel du maquettiste (limite basse) et exactement 2 (limite haute) sont permis ; 0 et 3 refusés", () => {
    for (const n of [1, 2]) expect(relevePhrase(exporter(Array(n).fill("maquettiste"))).ok).toBe(true);
    for (const n of [0, 3]) expect(relevePhrase(exporter(["tutoriel-plan", ...Array(n).fill("maquettiste")])).ok).toBe(false);
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
