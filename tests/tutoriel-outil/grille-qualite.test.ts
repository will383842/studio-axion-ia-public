import { describe, expect, it } from "vitest";
import type { RapportControleImage, ResultatControle } from "../../src/briques/controle-image";
import type { DefautVu, VerdictRegard } from "../../src/briques/regardeur";
import { DUREE_CIBLE_SEC } from "../../src/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { etablirVerdict, type ResultatControleTutoriel, type VerdictControleur } from "../../src/moteurs/montage-tutoriel-outil/equipe/controleur";
import { alertesDeGrille, marqueReussie, noterTutoriel, type EntreeGrille } from "../../src/moteurs/montage-tutoriel-outil/grille-qualite";

const IDS_IMAGE = ["volume", "crete", "image-noire", "image-figee", "duree", "zone-sure", "taille-texte", "contraste", "premiere-image"] as const;
const ci = (id: string, etat: ResultatControle["etat"] = "reussi"): ResultatControle => ({ id: id as ResultatControle["id"], libelle: id, bloquant: true, etat, raison: `raison ${id}` });
const imageOk = (sauf: Record<string, ResultatControle["etat"]> = {}): RapportControleImage => ({ controles: IDS_IMAGE.map((id) => ci(id, sauf[id] ?? "reussi")), verdict: "livrable", nonFaits: 0, resume: "" });
const tc = (id: string, etat: ResultatControleTutoriel["etat"] = "reussi", details = ["ok"]): ResultatControleTutoriel => ({ id, libelle: id, etat, bloquant: true, details });
const controleurOk = (sauf: Record<string, ResultatControleTutoriel["etat"]> = {}): VerdictControleur =>
  etablirVerdict(["TUT-CHIFFRES", "TUT-REGISTRE", "TUT-MOMENTS", "MARQUE-MOTS", "MARQUE-COULEURS", "MARQUE-POLICE"].map((id) => tc(id, sauf[id] ?? "reussi", sauf[id] === "echoue" ? [`écart ${id}`] : ["ok"])));
const defaut = (code: DefautVu["code"], instantSec: number): DefautVu => ({ code, nom: "i01", instantSec, partieId: null, detail: `détail ${code}`, bloquantSiSur: ["phrase-non-choisie", "fin-absente", "page-vide", "texte-coupe"].includes(code) });
const regard = (defauts: DefautVu[] = [], relues = 6): VerdictRegard => ({ defauts, relues, nonRelues: 0, partiesFautives: [] });
const base = (sur: Partial<EntreeGrille> = {}): EntreeGrille => ({ controleImage: imageOk(), controleur: controleurOk(), regardeur: regard(), dureeSec: 47, imageFixeMaxSec: 1, niveauSonoreLufs: -14, ...sur });
const critere = (e: EntreeGrille, id: string) => noterTutoriel(e).criteres.find((c) => c.id === id)!;

describe("grille de qualité chiffrée", () => {
  it("rien à signaler : 100 et proposable", () => {
    const g = noterTutoriel(base());
    expect(g.note).toBe(100);
    expect(g.proposable).toBe(true);
    expect(g.criteres.every((c) => c.etat === "reussi")).toBe(true);
  });

  it("son : juste au seuil passe, juste à côté échoue (±0,5)", () => {
    expect(critere(base({ niveauSonoreLufs: -14.5 }), "son").etat).toBe("reussi");
    expect(critere(base({ niveauSonoreLufs: -13.5 }), "son").etat).toBe("reussi");
    expect(critere(base({ niveauSonoreLufs: -14.51 }), "son").etat).toBe("echoue");
    expect(critere(base({ niveauSonoreLufs: -13.51 }), "son").etat).toBe("reussi");
    expect(critere(base({ niveauSonoreLufs: -13.49 }), "son").etat).toBe("echoue");
    // sans mesure directe : le contrôle de l'image commun
    expect(critere(base({ niveauSonoreLufs: undefined, controleImage: imageOk({ volume: "echoue" }) }), "son").etat).toBe("echoue");
    expect(critere(base({ niveauSonoreLufs: null, controleImage: imageOk({ volume: "non-fait" }) }), "son").etat).toBe("non-fait");
  });

  it("durée : bornes de DUREE_CIBLE_SEC, à la milliseconde", () => {
    const [bas, haut] = DUREE_CIBLE_SEC;
    expect(critere(base({ dureeSec: bas }), "duree").etat).toBe("reussi");
    expect(critere(base({ dureeSec: bas - 0.001 }), "duree").etat).toBe("echoue");
    expect(critere(base({ dureeSec: haut }), "duree").etat).toBe("reussi");
    expect(critere(base({ dureeSec: haut + 0.001 }), "duree").etat).toBe("echoue");
    expect(critere(base({ dureeSec: Number.NaN }), "duree").etat).toBe("non-fait");
  });

  it("durée : une remarque, jamais un refus (gravité « mineur », sans effet sur proposable)", () => {
    const [bas, haut] = DUREE_CIBLE_SEC;
    expect(critere(base(), "duree").gravite).toBe("mineur");
    const hors = noterTutoriel(base({ dureeSec: haut + 1 }));
    expect(hors.criteres.find((c) => c.id === "duree")!.etat).toBe("echoue");
    // 100 − 2 (un mineur) = 98 : pas de perte de 25 points, toujours proposable
    expect(hors.note).toBe(noterTutoriel(base()).note - 2);
    expect(hors.proposable).toBe(true);
    expect(noterTutoriel(base({ dureeSec: bas - 5 })).proposable).toBe(true);
    expect(noterTutoriel(base({ dureeSec: Number.NaN })).proposable).toBe(true);
    // l'alerte reste une simple information, pas une « attention »
    const al = alertesDeGrille(hors).find((a) => a.message.startsWith("À vérifier · Durée"));
    expect(al?.bloquant).toBe(false);
  });

  it("image fixe : 1,5 s passe, 1,501 s échoue, absente = non fait", () => {
    expect(critere(base({ imageFixeMaxSec: 1.5 }), "image-fixe").etat).toBe("reussi");
    expect(critere(base({ imageFixeMaxSec: 1.501 }), "image-fixe").etat).toBe("echoue");
    expect(critere(base({ imageFixeMaxSec: null }), "image-fixe").etat).toBe("non-fait");
    expect(critere(base({ imageFixeMaxSec: undefined }), "image-fixe").etat).toBe("non-fait");
  });

  it.each([
    ["crete", "image-crete"],
    ["image-noire", "image-image-noire"],
    ["taille-texte", "image-taille-texte"],
    ["contraste", "image-contraste"],
    ["zone-sure", "image-zone-sure"],
  ])("contrôle de l'image « %s » : échoue → bloquant ; non fait → à corriger", (ctl, id) => {
    const echec = noterTutoriel(base({ controleImage: imageOk({ [ctl]: "echoue" }) }));
    expect(echec.criteres.find((c) => c.id === id)).toMatchObject({ etat: "echoue", gravite: "bloquant" });
    expect(echec.note).toBe(75);
    expect(echec.proposable).toBe(false);
    const nf = noterTutoriel(base({ controleImage: imageOk({ [ctl]: "non-fait" }) }));
    expect(nf.criteres.find((c) => c.id === id)?.etat).toBe("non-fait");
    expect(nf.note).toBe(92);
    expect(nf.proposable).toBe(true);
  });

  it("chiffres, marque, registre : un écart bloque", () => {
    for (const id of ["TUT-CHIFFRES", "TUT-REGISTRE"]) {
      const g = noterTutoriel(base({ controleur: controleurOk({ [id]: "echoue" }) }));
      expect(g.criteres.find((c) => c.id === id)?.etat).toBe("echoue");
      expect(g.proposable).toBe(false);
    }
    const m = noterTutoriel(base({ controleur: controleurOk({ "MARQUE-MOTS": "echoue" }) }));
    expect(m.criteres.find((c) => c.id === "marque")).toMatchObject({ etat: "echoue", gravite: "bloquant" });
    expect(marqueReussie(m)).toBe(false);
    expect(marqueReussie(noterTutoriel(base()))).toBe(true);
  });

  it("marque absente du contrôleur : non fait, jamais réussi", () => {
    const g = noterTutoriel(base({ controleur: etablirVerdict([tc("TUT-CHIFFRES"), tc("TUT-REGISTRE"), tc("TUT-MOMENTS")]) }));
    expect(g.criteres.find((c) => c.id === "marque")?.etat).toBe("non-fait");
    expect(marqueReussie(g)).toBe(false);
  });

  it("moments : échec = à corriger (pas bloquant), note 92", () => {
    const g = noterTutoriel(base({ controleur: controleurOk({ "TUT-MOMENTS": "echoue" }) }));
    expect(g.criteres.find((c) => c.id === "TUT-MOMENTS")).toMatchObject({ etat: "echoue", gravite: "a-corriger" });
    expect(g.note).toBe(92);
    expect(g.proposable).toBe(true);
  });

  it("regardeur : image de début noire → à corriger, pas comptée deux fois", () => {
    const g = noterTutoriel(base({ regardeur: regard([defaut("noire", 0.5)]) }));
    expect(g.criteres.find((c) => c.id === "regard-debut")?.etat).toBe("echoue");
    expect(g.criteres.find((c) => c.id === "regard-a-corriger")?.etat).toBe("reussi");
    expect(g.note).toBe(92);
  });

  it("regardeur : défauts bloquants (phrase non choisie, fin absente, page vide, texte coupé) → bloquant", () => {
    for (const code of ["phrase-non-choisie", "fin-absente", "page-vide", "texte-coupe"] as const) {
      const g = noterTutoriel(base({ regardeur: regard([defaut(code, 10)]) }));
      expect(g.criteres.find((c) => c.id === "regard-bloquants")).toMatchObject({ etat: "echoue", gravite: "bloquant" });
      expect(g.proposable, code).toBe(false);
    }
  });

  it("regardeur : hors-cadre, désynchro, noire, illisible (hors début) → à corriger", () => {
    for (const code of ["hors-cadre", "desynchro", "noire", "illisible"] as const) {
      const g = noterTutoriel(base({ regardeur: regard([defaut(code, 10)]) }));
      expect(g.criteres.find((c) => c.id === "regard-a-corriger")?.etat, code).toBe("echoue");
      expect(g.note, code).toBe(92);
    }
  });

  it("regardeur : image non relue → non fait nommé ; image de début non relue → non fait", () => {
    const g = noterTutoriel(base({ regardeur: regard([defaut("non-relue", 10)]) }));
    expect(g.criteres.find((c) => c.id === "regard-non-relues")?.etat).toBe("non-fait");
    const t = noterTutoriel(base({ regardeur: regard([defaut("non-relue", 0.5)]) }));
    expect(t.criteres.find((c) => c.id === "regard-debut")?.etat).toBe("non-fait");
  });

  it("regardeur absent ou aucune image relue : rien n'est « réussi »", () => {
    for (const r of [undefined, regard([], 0)]) {
      const g = noterTutoriel(base({ regardeur: r }));
      for (const id of ["regard-debut", "regard-bloquants", "regard-a-corriger"]) expect(g.criteres.find((c) => c.id === id)?.etat, id).toBe("non-fait");
    }
    const sans = noterTutoriel(base({ regardeur: undefined }));
    // bloquant non fait compte « à corriger » (3 × 8 + regard-non-relues absent = 4 × 8)
    expect(sans.note).toBe(68);
    expect(sans.proposable).toBe(false);
  });

  it("un seul bloquant : pas proposable même si la note est ≥ 85", () => {
    const g = noterTutoriel(base({ controleImage: imageOk({ contraste: "echoue" }) }));
    expect(g.note).toBe(75);
    const h = noterTutoriel(base({ imageFixeMaxSec: 2 }));
    expect(h.note).toBe(75);
    expect(h.proposable).toBe(false);
  });

  it("note 85 pile : proposable ; 84 : non", () => {
    // 100 − 8 − 8 = 84 (deux à corriger) ; 100 − 8 = 92
    const deux = noterTutoriel(base({ controleur: controleurOk({ "TUT-MOMENTS": "echoue" }), regardeur: regard([defaut("hors-cadre", 10)]) }));
    expect(deux.note).toBe(84);
    expect(deux.proposable).toBe(false);
  });

  it("bornes [0, 100]", () => {
    const tout = noterTutoriel({ controleImage: imageOk(Object.fromEntries(IDS_IMAGE.map((i) => [i, "echoue" as const]))), controleur: etablirVerdict([]), dureeSec: 5, imageFixeMaxSec: 9, niveauSonoreLufs: -30 });
    expect(tout.note).toBe(0);
    expect(tout.proposable).toBe(false);
    expect(noterTutoriel(base()).note).toBeLessThanOrEqual(100);
  });

  it("déterministe, et ne lève jamais sur des entrées vides", () => {
    expect(noterTutoriel(base())).toEqual(noterTutoriel(base()));
    expect(() => noterTutoriel({ controleImage: undefined as unknown as RapportControleImage, controleur: undefined as unknown as VerdictControleur, dureeSec: Number.NaN })).not.toThrow();
    expect(noterTutoriel({ controleImage: undefined as unknown as RapportControleImage, controleur: undefined as unknown as VerdictControleur, dureeSec: Number.NaN }).proposable).toBe(false);
  });

  it("alertes : une par critère non réussi, « À vérifier · … (seuil …) », sans sigle ni montant", () => {
    const g = noterTutoriel(base({ niveauSonoreLufs: -20, imageFixeMaxSec: null }));
    const a = alertesDeGrille(g);
    expect(a).toHaveLength(2);
    expect(a.every((x) => /^À vérifier · .+ : .+ \(seuil .+\)$/.test(x.message))).toBe(true);
    expect(a.find((x) => x.message.includes("Niveau du son"))?.bloquant).toBe(true);
    expect(a.find((x) => x.message.includes("Écran immobile"))?.bloquant).toBe(false);
    for (const x of a) expect(x.message).not.toMatch(/LUFS|dBTP|€|\$/);
    expect(alertesDeGrille(noterTutoriel(base()))).toEqual([]);
  });
});
