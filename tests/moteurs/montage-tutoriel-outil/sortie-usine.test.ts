/**
 * T-EXT-47 · fiche de sortie `tutoriel-sortie.v1` : pure, sans texte, sans montant, sans date. 0 €, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { ficheSortieTutoriel, lireFicheSortieTutoriel, type EntreeFicheSortie } from "@/moteurs/montage-tutoriel-outil/sortie-usine";

const SCRIPT_DU_DOUBLE = "Bonjour, voici comment gagner une heure chaque matin dans votre cabinet.";

const entree = (extra: Partial<EntreeFicheSortie> = {}): EntreeFicheSortie => ({
  videoId: "v-essai-1",
  versionId: "ver-essai-1",
  ratios: ["4:5", "9:16", "1:1"],
  dureeSec: 47.3,
  gabarits: ["G-Decision"],
  cas: 1,
  fin: "aucune",
  scenes: ["scene:ouverture", "scene:tableau-1", "scene:conclusion"],
  controles: { verdict: "ok", defauts: 0 },
  etapeEditoriale: "validee",
  ...extra,
});

function fiche(extra: Partial<EntreeFicheSortie> = {}) {
  const r = ficheSortieTutoriel(entree(extra));
  if (!r.ok) throw new Error(`fiche refusée : ${r.manque.join(", ")}`);
  return r.fiche;
}

describe("ficheSortieTutoriel", () => {
  it("écrit une fiche complète, relue à l'identique par le lecteur strict", () => {
    const f = fiche();
    expect(f.contrat).toBe("tutoriel-sortie.v1");
    expect(f).toMatchObject({ videoId: "v-essai-1", versionId: "ver-essai-1", dureeSec: 47.3, cas: 1, fin: "aucune", valideeParWilliams: true });
    expect(f.ratios).toEqual(["4:5", "9:16", "1:1"]);
    const relue = lireFicheSortieTutoriel(JSON.parse(JSON.stringify(f)));
    expect(relue).toEqual({ ok: true, fiche: f });
  });

  it("vidéo non validée : valideeParWilliams est faux (toute autre étape que « validee »)", () => {
    for (const etape of ["brouillon", "a_relire", "relue", "", undefined]) expect(fiche({ etapeEditoriale: etape }).valideeParWilliams).toBe(false);
  });

  it("le cas 5 porte deux gabarits ; un autre cas n'en porte qu'un", () => {
    expect(fiche({ cas: 5, gabarits: ["G-Flux", "G-Decision"] }).gabarits).toEqual(["G-Flux", "G-Decision"]);
    expect(ficheSortieTutoriel(entree({ cas: 5, gabarits: ["G-Flux"] })).ok).toBe(false);
    expect(ficheSortieTutoriel(entree({ cas: 3, gabarits: ["G-Flux", "G-Decision"] })).ok).toBe(false);
    expect(ficheSortieTutoriel(entree({ cas: 5, gabarits: ["G-Journee", "G-Journee"] })).ok).toBe(false);
    expect(ficheSortieTutoriel(entree({ cas: 5, gabarits: ["G-Flux", "G-Flux"] })).ok).toBe(false);
    expect(ficheSortieTutoriel(entree({ cas: 5, gabarits: ["G-Journee", "G-Decision"] })).ok).toBe(false);
  });

  it("la fin choisie est transmise telle quelle", () => {
    expect(fiche({ fin: "prendre-rendez-vous" }).fin).toBe("prendre-rendez-vous");
    expect(fiche({ fin: "aucune" }).fin).toBe("aucune");
  });

  it("champ manquant : { ok:false, manque } nomme le champ, sans exception", () => {
    const sans = (champ: keyof EntreeFicheSortie) => {
      const e = { ...entree() };
      delete e[champ];
      return ficheSortieTutoriel(e);
    };
    for (const champ of ["videoId", "versionId", "ratios", "dureeSec", "gabarits", "cas", "fin", "scenes", "controles"] as const) {
      const r = sans(champ);
      expect(r.ok, champ).toBe(false);
      if (!r.ok) expect(r.manque, champ).toContain(champ);
    }
  });

  it("une entrée vide ou absurde ne lève jamais", () => {
    expect(() => ficheSortieTutoriel({})).not.toThrow();
    expect(ficheSortieTutoriel({}).ok).toBe(false);
    expect(() => ficheSortieTutoriel(undefined as unknown as EntreeFicheSortie)).not.toThrow();
    expect(() => ficheSortieTutoriel({ ...entree(), dureeSec: Number.NaN, cas: 9, ratios: ["16:9"] })).not.toThrow();
    expect(ficheSortieTutoriel({ ...entree(), dureeSec: Number.NaN }).ok).toBe(false);
    expect(ficheSortieTutoriel({ ...entree(), cas: 9 }).ok).toBe(false);
  });

  it("refuse 16:9, une durée nulle et une clé de scène qui n'est pas « scene:… »", () => {
    expect(ficheSortieTutoriel(entree({ ratios: ["16:9"] })).ok).toBe(false);
    expect(ficheSortieTutoriel(entree({ dureeSec: 0 })).ok).toBe(false);
    expect(ficheSortieTutoriel(entree({ scenes: ["Bonjour, voici la scène"] })).ok).toBe(false);
  });

  it("aucun texte libre : la sortie sérialisée ne contient ni le script du double, ni « € », ni date", () => {
    // Un texte de vidéo glissé dans un champ libre est refusé, il ne sort jamais.
    expect(ficheSortieTutoriel(entree({ videoId: SCRIPT_DU_DOUBLE })).ok).toBe(false);
    expect(ficheSortieTutoriel(entree({ scenes: [`scene:${SCRIPT_DU_DOUBLE}`] })).ok).toBe(false);
    const json = JSON.stringify(fiche({ fin: "prendre-rendez-vous" }));
    expect(json).not.toContain(SCRIPT_DU_DOUBLE);
    expect(json).not.toContain("€");
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(json).not.toMatch(/commentez/i);
  });

  it("donnees vaut toujours « exemple »", () => {
    expect(fiche().donnees).toBe("exemple");
    const f = fiche();
    expect(lireFicheSortieTutoriel({ ...f, donnees: "reelles" }).ok).toBe(false);
  });
});

describe("lireFicheSortieTutoriel (strict)", () => {
  it("refuse un champ inconnu, sans exception, et le nomme", () => {
    const r = lireFicheSortieTutoriel({ ...fiche(), titre: "Un titre de publication" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.manque).toContain("titre");
    const interne = lireFicheSortieTutoriel({ ...fiche(), controles: { verdict: "ok", defauts: 0, detail: "x" } });
    expect(interne.ok).toBe(false);
  });

  it("refuse un autre contrat, un verdict inconnu, et ce qui n'est pas un objet", () => {
    expect(lireFicheSortieTutoriel({ ...fiche(), contrat: "tutoriel-sortie.v2" }).ok).toBe(false);
    expect(lireFicheSortieTutoriel({ ...fiche(), controles: { verdict: "peut-etre", defauts: 0 } }).ok).toBe(false);
    for (const brut of [null, undefined, 3, "x", []]) expect(lireFicheSortieTutoriel(brut).ok).toBe(false);
  });
});
