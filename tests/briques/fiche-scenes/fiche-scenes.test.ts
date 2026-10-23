import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  cleFicheScenes,
  empreinteFiche,
  empreintesScenes,
  migrerFiche,
  validerFiche,
  versionsConnues,
  type ExtensionFormat,
  type MarcheMigration,
  type ProblemeFiche,
} from "../../../src/briques/fiche-scenes";

/* Format d'essai : un seul type d'élément, une règle propre. */
const schemaElement = z.strictObject({ id: z.string(), type: z.literal("note"), texte: z.string().min(1) });
type ElementEssai = z.infer<typeof schemaElement>;
const formatEssai: ExtensionFormat<ElementEssai> = {
  formatId: "format-essai",
  schemaElement,
  regles: [
    {
      nom: "pas de mot interdit",
      verifier: (f) => f.scenes.filter((s) => s.texteDit.includes("interdit")).map((s) => ({ sceneId: s.id, detail: "le mot « interdit » est dit." })),
    },
  ],
};

const scene = (i: number, page: number, extra: Record<string, unknown> = {}) => ({
  id: `s${String(i).padStart(2, "0")}`,
  role: i === 1 ? "accroche" : "etape",
  page,
  texteDit: `Phrase ${i} du script.`,
  elements: [{ id: `e${i}`, type: "note", texte: "Note" }],
  ...extra,
});

function ficheValide(): Record<string, unknown> {
  return {
    version: "fiche-scenes/1",
    formatId: "format-essai",
    videoId: "vid_123",
    versionId: "v1",
    habillage: "charte-video/1",
    stylo: "crayon/1",
    ratio: "9:16",
    structure: "erreur-corrigee",
    serie: { code: "argent", nom: "Argent au quotidien" },
    douleur: "Vous payez trop de frais bancaires.",
    gesteMinute: "Ouvrez votre relevé et cherchez la ligne des frais.",
    appelId: null,
    scenes: [scene(1, 1), scene(2, 1), scene(3, 2), scene(4, 3)],
  };
}

function refus(brute: unknown): ProblemeFiche[] {
  const r = validerFiche(brute, formatEssai);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.problemes;
}

describe("fiche de scènes · validation", () => {
  it("accepte une fiche conforme sans la modifier", () => {
    const brute = ficheValide();
    const avant = JSON.stringify(brute);
    const r = validerFiche(brute, formatEssai);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(brute)).toBe(avant);
    if (r.ok) expect(r.fiche).toEqual(brute);
  });

  it("règle « version connue » : refuse une version absente ou différente", () => {
    const sans = ficheValide();
    delete sans.version;
    expect(refus(sans)[0].message).toBe("Fiche · règle « version connue » : la version est absente ; « fiche-scenes/1 » est attendue.");
    const p = refus({ ...ficheValide(), version: "fiche-scenes/9" });
    expect(p[0].regle).toBe("version connue");
    expect(p[0].message).toContain("« fiche-scenes/9 »");
  });

  it("règle « schéma exact » : refuse un champ inconnu, sans le retirer", () => {
    const p = refus({ ...ficheValide(), bonus: 1 });
    expect(p[0].message).toBe("Fiche · règle « schéma exact » : champ inconnu : « bonus ».");
  });

  it("règle « schéma exact » : nomme la scène et l'élément fautifs", () => {
    const f = ficheValide();
    (f.scenes as ReturnType<typeof scene>[])[2].elements = [{ id: "e3", type: "note", texte: "" }];
    const p = refus(f);
    expect(p).toHaveLength(1);
    expect(p[0].sceneId).toBe("s03");
    expect(p[0].message).toBe("Scène s03 · règle « schéma exact » : élément 1, champ « texte » : trop court (au moins 1).");
  });

  it("règle « schéma exact » : la série n'a pas de numéro, un texte vide est refusé (jamais rogné)", () => {
    expect(refus({ ...ficheValide(), serie: { code: "a", nom: "b", numero: 2 } })[0].message).toContain("champ « serie » : champ inconnu : « numero »");
    expect(refus({ ...ficheValide(), douleur: "   " })[0].message).toBe("Fiche · règle « schéma exact » : champ « douleur » : le texte est vide.");
    expect(refus({ ...ficheValide(), douleur: "x".repeat(141) })[0].message).toContain("140 caractères au plus");
    expect(refus({ ...ficheValide(), gesteMinute: "x".repeat(121) })[0].message).toContain("120 caractères au plus");
    expect(refus({ ...ficheValide(), ratio: "3:2" })[0].message).toContain("champ « ratio » : valeur refusée");
    expect(refus({ ...ficheValide(), appelId: undefined })[0].message).toContain("champ « appelId » : champ obligatoire absent");
  });

  it("règle « format attendu »", () => {
    const p = refus({ ...ficheValide(), formatId: "autre-format" });
    expect(p[0].message).toBe("Fiche · règle « format attendu » : la fiche est du format « autre-format », le format « format-essai » était attendu.");
  });

  it("règle « nombre de scènes » : de 4 à 10", () => {
    const f = ficheValide();
    f.scenes = [scene(1, 1), scene(2, 1), scene(3, 2)];
    expect(refus(f)[0].message).toBe("Fiche · règle « nombre de scènes » : 3 scènes ; il en faut de 4 à 10.");
    f.scenes = Array.from({ length: 10 }, (_, i) => scene(i + 1, Math.min(6, Math.floor(i / 2) + 1)));
    expect(validerFiche(f, formatEssai).ok).toBe(true);
    f.scenes = Array.from({ length: 11 }, (_, i) => scene(i + 1, Math.min(6, Math.floor(i / 2) + 1)));
    expect(refus(f).some((p) => p.regle === "nombre de scènes")).toBe(true);
  });

  it("règle « identifiants de scène uniques et ordonnés »", () => {
    const f = ficheValide();
    (f.scenes as ReturnType<typeof scene>[])[2].id = "s02";
    const p = refus(f);
    expect(p[0].message).toBe("Scène s02 · règle « identifiants de scène uniques et ordonnés » : l'identifiant « s02 » est déjà pris par une scène précédente.");
    const g = ficheValide();
    (g.scenes as ReturnType<typeof scene>[])[1].id = "s05";
    expect(refus(g)[0].message).toBe("Scène s05 · règle « identifiants de scène uniques et ordonnés » : en position 2, l'identifiant attendu est « s02 ».");
  });

  it("règle « nombre d'éléments » : de 1 à 6", () => {
    const f = ficheValide();
    (f.scenes as ReturnType<typeof scene>[])[1].elements = [];
    expect(refus(f)[0].message).toBe("Scène s02 · règle « nombre d'éléments » : 0 élément ; il en faut de 1 à 6.");
    const g = ficheValide();
    (g.scenes as ReturnType<typeof scene>[])[1].elements = Array.from({ length: 7 }, (_, i) => ({ id: `e${i}`, type: "note", texte: "x" }));
    expect(refus(g)[0].message).toBe("Scène s02 · règle « nombre d'éléments » : 7 éléments ; il en faut de 1 à 6.");
    (g.scenes as ReturnType<typeof scene>[])[1].elements.pop();
    expect(validerFiche(g, formatEssai).ok).toBe(true);
  });

  it("règle « pages croissantes » : commence à 1, ne recule pas, ne saute pas, au plus 6", () => {
    const recule = ficheValide();
    recule.scenes = [scene(1, 1), scene(2, 2), scene(3, 1), scene(4, 2)];
    expect(refus(recule)[0].message).toBe("Scène s03 · règle « pages croissantes » : la page 1 vient après la page 2 ; une page ne revient jamais en arrière.");
    const saute = ficheValide();
    saute.scenes = [scene(1, 1), scene(2, 3), scene(3, 3), scene(4, 4)];
    expect(refus(saute)[0].message).toBe("Scène s02 · règle « pages croissantes » : la page 3 suit la page 1 ; une page ne peut pas être sautée.");
    const debut = ficheValide();
    debut.scenes = [scene(1, 2), scene(2, 2), scene(3, 3), scene(4, 3)];
    expect(refus(debut)[0].message).toBe("Scène s01 · règle « pages croissantes » : la première scène doit être sur la page 1, pas sur la page 2.");
    const trop = ficheValide();
    trop.scenes = Array.from({ length: 7 }, (_, i) => scene(i + 1, i + 1));
    expect(refus(trop)[0].message).toBe("Scène s07 · règle « pages croissantes » : page 7 ; les pages vont de 1 à 6.");
  });

  it("règle « horaires de scène » : début et fin ensemble, dans l'ordre, sans chevauchement", () => {
    const ok = ficheValide();
    ok.scenes = [scene(1, 1, { debutMs: 0, finMs: 1000 }), scene(2, 1, { debutMs: 1000, finMs: 2000 }), scene(3, 2, { debutMs: 2000, finMs: 3000 }), scene(4, 3, { debutMs: 3000, finMs: 4000 })];
    expect(validerFiche(ok, formatEssai).ok).toBe(true);
    const seul = ficheValide();
    (seul.scenes as ReturnType<typeof scene>[])[0] = scene(1, 1, { debutMs: 0 });
    expect(refus(seul)[0].message).toBe("Scène s01 · règle « horaires de scène » : le début et la fin sont posés ensemble par le calage, ou pas du tout.");
    const inverse = ficheValide();
    (inverse.scenes as ReturnType<typeof scene>[])[0] = scene(1, 1, { debutMs: 500, finMs: 500 });
    expect(refus(inverse)[0].message).toBe("Scène s01 · règle « horaires de scène » : la fin (500 ms) doit venir après le début (500 ms).");
    const chevauche = ficheValide();
    chevauche.scenes = [scene(1, 1, { debutMs: 0, finMs: 1000 }), scene(2, 1, { debutMs: 900, finMs: 2000 }), scene(3, 2), scene(4, 3)];
    expect(refus(chevauche)[0].message).toBe("Scène s02 · règle « horaires de scène » : le début (900 ms) chevauche la scène s01, qui finit à 1000 ms.");
    const negatif = ficheValide();
    (negatif.scenes as ReturnType<typeof scene>[])[0] = scene(1, 1, { debutMs: -1, finMs: 10 });
    expect(refus(negatif)[0].message).toBe("Scène s01 · règle « schéma exact » : champ « debutMs » : doit valoir au moins 0.");
  });

  it("exécute les règles fournies par le format, avec la scène et le nom de la règle", () => {
    const f = ficheValide();
    (f.scenes as ReturnType<typeof scene>[])[3].texteDit = "Un mot interdit.";
    expect(refus(f)).toEqual([{ regle: "pas de mot interdit", sceneId: "s04", message: "Scène s04 · règle « pas de mot interdit » : le mot « interdit » est dit." }]);
  });
});

describe("fiche de scènes · migration", () => {
  const marches: MarcheMigration[] = [
    { de: "fiche-scenes/0", vers: "fiche-scenes/1", migrer: (f) => { const { titreSerie, ...reste } = f; return { ...reste, serie: { code: "x", nom: String(titreSerie) } }; } },
  ];

  it("la version courante passe telle quelle, en copie", () => {
    const brute = ficheValide();
    const r = migrerFiche(brute);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fiche).toEqual(brute);
      expect(r.fiche).not.toBe(brute);
    }
  });

  it("passe d'une version à la suivante, sans modifier l'entrée, puis la fiche se valide", () => {
    const ancienne: Record<string, unknown> = { ...ficheValide(), version: "fiche-scenes/0", titreSerie: "Argent" };
    delete ancienne.serie;
    const avant = JSON.stringify(ancienne);
    const r = migrerFiche(ancienne, marches);
    expect(JSON.stringify(ancienne)).toBe(avant);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fiche.version).toBe("fiche-scenes/1");
      expect(validerFiche(r.fiche, formatEssai).ok).toBe(true);
    }
    expect(versionsConnues(marches)).toEqual(["fiche-scenes/0", "fiche-scenes/1"]);
  });

  it("refuse une version inconnue ou absente, sans deviner", () => {
    const r = migrerFiche({ ...ficheValide(), version: "fiche-scenes/7" }, marches);
    expect(r).toEqual({
      ok: false,
      problemes: [{ regle: "version connue", message: "Fiche · règle « version connue » : la version « fiche-scenes/7 » est inconnue ; versions connues : « fiche-scenes/0 », « fiche-scenes/1 »." }],
    });
    const sans = ficheValide();
    delete sans.version;
    expect(migrerFiche(sans).ok).toBe(false);
    expect(migrerFiche({ ...ficheValide(), version: "fiche-scenes/0" }).ok).toBe(false);
  });

  it("refuse une chaîne de versions qui boucle", () => {
    const boucle: MarcheMigration[] = [
      { de: "a", vers: "b", migrer: (f) => f },
      { de: "b", vers: "a", migrer: (f) => f },
    ];
    const r = migrerFiche({ version: "a" }, boucle);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemes[0].message).toContain("chaîne de versions incohérente");
  });
});

describe("fiche de scènes · empreintes", () => {
  const lire = (brute: unknown) => {
    const r = validerFiche(brute, formatEssai);
    if (!r.ok) throw new Error(r.problemes.map((p) => p.message).join("\n"));
    return r.fiche;
  };

  it("deux lectures de la même fiche donnent la même empreinte, quel que soit l'ordre des clés", () => {
    const texte = JSON.stringify(ficheValide());
    const a = lire(JSON.parse(texte));
    const b = lire(JSON.parse(texte));
    const melangee = Object.fromEntries(Object.entries(JSON.parse(texte) as Record<string, unknown>).reverse());
    (melangee.scenes as Record<string, unknown>[]) = (melangee.scenes as Record<string, unknown>[]).map((s) => Object.fromEntries(Object.entries(s).reverse()));
    const c = lire(melangee);
    expect(empreinteFiche(a)).toBe(empreinteFiche(b));
    expect(empreinteFiche(a)).toBe(empreinteFiche(c));
    expect(empreintesScenes(a)).toEqual(empreintesScenes(c));
    expect(empreinteFiche(a)).toMatch(/^fiche-[0-9a-f]{16}-[0-9a-z]+$/);
  });

  it("une scène modifiée change sa seule empreinte de scène, et celle de la fiche", () => {
    const a = lire(ficheValide());
    const f = ficheValide();
    (f.scenes as ReturnType<typeof scene>[])[2].texteDit = "Autre phrase.";
    const b = lire(f);
    const ea = empreintesScenes(a);
    const eb = empreintesScenes(b);
    expect(eb.s03).not.toBe(ea.s03);
    expect([eb.s01, eb.s02, eb.s04]).toEqual([ea.s01, ea.s02, ea.s04]);
    expect(empreinteFiche(b)).not.toBe(empreinteFiche(a));
  });

  it("le début et la fin comptent dans l'empreinte de scène, comme le cadre figé (stylo)", () => {
    const a = lire(ficheValide());
    const f = ficheValide();
    f.scenes = [scene(1, 1, { debutMs: 0, finMs: 1200 }), scene(2, 1), scene(3, 2), scene(4, 3)];
    expect(empreintesScenes(lire(f)).s01).not.toBe(empreintesScenes(a).s01);
    expect(empreintesScenes(lire({ ...ficheValide(), stylo: "crayon/2" })).s02).not.toBe(empreintesScenes(a).s02);
  });
});

describe("fiche de scènes · clé de rangement", () => {
  it("suit la convention studio/<env>/<type>/<entité>/<fichier>.<ext>", () => {
    expect(cleFicheScenes("prod", "vid_123", "v1")).toBe("studio/prod/fiches-scenes/vid_123/v1.json");
    expect(cleFicheScenes("dev", "a-b", "c_d")).toBe("studio/dev/fiches-scenes/a-b/c_d.json");
  });

  it("refuse un identifiant qui sortirait de son dossier", () => {
    expect(() => cleFicheScenes("prod", "../x", "v1")).toThrow("identifiant de vidéo « ../x » refusé");
    expect(() => cleFicheScenes("prod", "vid", "a/b")).toThrow("identifiant de version « a/b » refusé");
    expect(() => cleFicheScenes("test" as "prod", "vid", "v1")).toThrow("environnement « test » inconnu");
  });
});
