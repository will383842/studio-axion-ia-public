/**
 * 25/10/2026 : relecture finale « zéro blocage » (Règle du 25/10/2026 : jamais d'arrêt pour un défaut de détail ; bloquant seulement
 * si la vidéo est inutilisable), rejouée sur la vidéo v-b54bb4798246 (fixture de `facturation-j30-scene.test.ts`).
 *
 * Cause : `instantsClesIV` prenait le premier événement visible portant le `ref` d'un bloc, même celui d'un plan « emotion » ou
 * dans la fenêtre du bloc de variété d'ouverture (OUV-D, qui remplace les blocs de la 1re phrase au rendu) : à 0,6 s l'écran
 * montrait l'accroche, alors que la légende annonçait « Le bloc « Mission terminée détectée » est à l'écran ».
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { miseEnPageAuxInstantsIV } from "@/moteurs/montage-image-video/emprise-ligne";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { estChiffreFauxIV, estIllisibleGlobalIV, instantsClesIV, jugerRelecture, PART_MANQUES_BLOQUANTE, type RelectureFinale } from "@/moteurs/montage-image-video/relecture-finale";
import { recettePourVersion } from "@/moteurs/montage-image-video/variete/tirage";

interface PisteFixture { version: string; reseaux: string[]; dureeSec: number; finVoixSec: number; motsCorps: number; mots: { mot: string; debutSec: number; finSec: number }[] }
interface FinFixture { id: string; muet: boolean }
const F = JSON.parse(readFileSync(join(__dirname, "fixtures", "facturation-j30-scene.json"), "utf8")) as {
  videoId: string;
  carte: { noeuds: { id: string; libelle: string; photoPersonnes?: boolean }[] };
  fiche: unknown;
  recette: unknown;
  fins: FinFixture[];
  pistes: PisteFixture[];
  versions: { id: string; piste: string; format: "9:16" | "4:5"; reseaux: string[] }[];
};

/** Même assemblage que `sceneDe` (fabrication.ts), repris de facturation-j30-scene.test.ts. */
function entreeDe(v: (typeof F.versions)[number]): EntreeMiseEnSceneIV {
  const p = F.pistes.find((x) => x.version === v.piste)!;
  const fin = F.fins.find((f) => f.id === v.id);
  return {
    carte: F.carte,
    fiche: F.fiche,
    voix: { mots: p.mots, motsCorps: p.motsCorps, dureeSec: p.dureeSec, finVoixSec: p.finVoixSec },
    fin: fin && !fin.muet ? fin : null,
    reseaux: v.reseaux,
    bruitagesValides: BRUITAGES_V4_IV,
    ...(v.format === "4:5" ? { format: v.format } : {}),
    variete: recettePourVersion(F.recette as never, v.reseaux as never, v.format),
    graine: F.videoId,
  } as unknown as EntreeMiseEnSceneIV;
}

const resultats = new Map<number, ResultatMiseEnSceneIV>();
const resultatDe = (k: number): ResultatMiseEnSceneIV => {
  let r = resultats.get(k);
  if (!r) {
    r = mettreEnSceneIV(entreeDe(F.versions[k]));
    resultats.set(k, r);
  }
  return r;
};
const INDEX = F.versions.map((_, k) => k);

describe("v-b54bb4798246 : les instants clés tombent sur ce que la légende annonce", () => {
  it.each(INDEX)("version %i : le bloc n01 est relu dans un plan dessiné (e05), jamais dans l'accroche", (k) => {
    const { ligne } = resultatDe(k);
    const n01 = F.carte.noeuds.find((n) => n.id === "n01")!;
    const instants = instantsClesIV(ligne, F.carte as never);
    const i = instants.find((x) => x.sorte === "bloc" && x.ref === "n01");
    expect(i, "instant du bloc n01").toBeDefined();
    const plan = ligne.plans.find((p) => i!.instantSec >= p.debut - 1e-9 && i!.instantSec < p.fin - 1e-9)!;
    expect(plan.sorte).not.toBe("emotion");
    expect(plan.ecran).toBe("e05");
    expect(i!.legende).toContain(`Le bloc « ${n01.libelle} »`);
  });

  it.each(INDEX)("version %i : aucun instant « bloc » dans la fenêtre du bloc de variété d'ouverture", (k) => {
    const { ligne } = resultatDe(k);
    const ouv = ligne.blocs.find((b) => b.sorte === "variete" && b.axe === "ouverture");
    const instants = instantsClesIV(ligne, F.carte as never);
    if (ouv) for (const i of instants.filter((x) => x.sorte === "bloc")) expect(i.instantSec >= ouv.debut && i.instantSec < ouv.fin, `${i.nom} à ${i.instantSec}`).toBe(false);
  });

  it.each(INDEX)("version %i : la mise en page n'a aucun défaut aux nouveaux instants", (k) => {
    const { ligne } = resultatDe(k);
    const instants = instantsClesIV(ligne, F.carte as never).map((i) => i.instantSec);
    expect(miseEnPageAuxInstantsIV(ligne, instants).flatMap((x) => x.defauts)).toEqual([]);
  });
});

describe("jugerRelecture : seul le inutilisable bloque", () => {
  const INSTANTS = Array.from({ length: 10 }, (_, k) => ({ nom: `i${String(k + 1).padStart(2, "0")}`, instantSec: k + 1 }));
  const rien = (nom: string) => ({ nom, toutMontre: true, manque: "", faux: "", illisible: "", horsCharte: "", suggestion: "" });
  const relecture = (modif: (nom: string, k: number) => Partial<ReturnType<typeof rien>> = () => ({}), o: Partial<RelectureFinale> = {}): RelectureFinale => ({
    images: INSTANTS.map((i, k) => ({ ...rien(i.nom), ...modif(i.nom, k) })),
    absentDeLaVideo: "",
    ...o,
  });

  it("garde-fou : plancher 50 %", () => {
    expect(PART_MANQUES_BLOQUANTE).toBe(0.5);
  });
  it("tout va bien : rien", () => {
    const j = jugerRelecture(relecture(), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toEqual([]);
  });
  it("un seul « manque » : 0 bloquant, 1 remarque", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 3 ? { toutMontre: false, manque: "20 %" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(1);
    expect(j.remarques[0]).toMatch(/il manque : 20 %/);
    expect(j.remarques[0]).toMatch(/\(détail, la vidéo continue\)\.$/);
  });
  it("les défauts de détail d'une vidéo réelle (trav-dd7a8a2c50d4) : 0 bloquant, des remarques", () => {
    const defauts = [
      // Textes de défauts du travail réel, rangés dans leurs vrais champs (le rapport d'origine n'est pas dans le dépôt public :
      // formulations reconstituées d'après le constat, pas copiées mot pour mot).
      { illisible: "le surtitre SITUATION TYPE est masqué par le bandeau orange" },
      { faux: "VALIDE coiffe Autoliquidation" },
      { illisible: "le texte du bloc est coupé par le bord droit" },
      { faux: "l'étiquette de la flèche ne correspond pas au bloc annoncé" },
      { illisible: "la légende est tronquée en bas de l'écran" },
    ];
    const tournures = [
      { illisible: "le texte de l'image est illisible" },
      { illisible: "le texte de l'image est flou" },
      { illisible: "l'écran est masqué par le bandeau orange" },
    ];
    for (const d of [...defauts, ...tournures]) {
      const j2 = jugerRelecture(relecture((_, k) => (k === 0 ? d : {})), INSTANTS);
      expect(j2.bloquants, JSON.stringify(d)).toEqual([]);
    }
    const j = jugerRelecture(relecture((_, k) => (k < defauts.length ? defauts[k] : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(5);
    expect(j.remarques[0]).toMatch(/illisible : le surtitre SITUATION TYPE/);
    expect(j.remarques[1]).toMatch(/faux : VALIDE coiffe Autoliquidation/);
    for (const r of j.remarques) expect(r).toMatch(/\(détail, la vidéo continue\)\.$/);
    for (const d of defauts) for (const t of Object.values(d)) expect(estIllisibleGlobalIV(t) || estChiffreFauxIV(t), t).toBe(false);
  });
  it("chiffre faux (« 30 % au lieu de 20 % ») : 1 bloquant", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 2 ? { faux: "30 % au lieu de 20 %" } : {})), INSTANTS);
    expect(j.bloquants).toHaveLength(1);
    expect(j.bloquants[0]).toMatch(/faux : 30 % au lieu de 20 %/);
  });
  it("chiffre ordinal faux (« 1er jour est devenu 2e jour ») : 1 bloquant", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 2 ? { faux: "le chiffre 1er jour est devenu 2e jour" } : {})), INSTANTS);
    expect(j.bloquants).toHaveLength(1);
  });
  it("« au lieu de » avec deux fois le même nombre : remarque, pas de bloquant", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 2 ? { faux: "20 % au lieu de 20 euros" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(1);
  });
  it("point d'interrogation à la place d'un bloc : remarque", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 1 ? { faux: "affiche un point d'interrogation à la place de Mission terminée détectée" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(1);
  });
  it("« illisible » dans un détail de texte : remarque", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 5 ? { illisible: "texte coupé par le bord" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(1);
    expect(j.remarques[0]).toMatch(/illisible : texte coupé par le bord \(détail, la vidéo continue\)\.$/);
  });
  it("une seule image entièrement noire sur 10 (prise pendant une transition) : remarque, pas de blocage", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 5 ? { illisible: "image entièrement noire" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(1);
    expect(j.remarques[0]).toMatch(/illisible : image entièrement noire/);
  });
  it("toutes les images entièrement noires : bloquant", () => {
    const j = jugerRelecture(relecture(() => ({ illisible: "image entièrement noire" })), INSTANTS);
    expect(j.bloquants.some((b) => /illisible dans son ensemble/.test(b))).toBe(true);
    expect(j.bloquants.some((b) => /illisible : image entièrement noire/.test(b))).toBe(true);
  });
  it("une ou deux images relues : une seule illisible = remarque, toutes illisibles = bloquant", () => {
    const deux = INSTANTS.slice(0, 2);
    const r = (f: (k: number) => object) => ({ images: deux.map((i, k) => ({ nom: i.nom, toutMontre: true, manque: "", faux: "", illisible: "", horsCharte: "", suggestion: "", ...f(k) })), absentDeLaVideo: "" }) as RelectureFinale;
    expect(jugerRelecture(r((k) => (k === 0 ? { illisible: "écran tout noir" } : {})), deux).bloquants).toEqual([]);
    expect(jugerRelecture(r(() => ({ illisible: "écran tout noir" })), deux).bloquants.some((b) => /dans son ensemble/.test(b))).toBe(true);
    const une = INSTANTS.slice(0, 1);
    const r1 = { images: [{ nom: une[0].nom, toutMontre: true, manque: "", faux: "", illisible: "écran tout noir", horsCharte: "", suggestion: "" }], absentDeLaVideo: "" } as RelectureFinale;
    expect(jugerRelecture(r1, une).bloquants.some((b) => /dans son ensemble/.test(b))).toBe(true);
  });
  it("6 images globalement illisibles sur 10 : bloquant « illisible dans son ensemble »", () => {
    const j = jugerRelecture(relecture((_, k) => (k < 6 ? { illisible: "image floue" } : {})), INSTANTS);
    expect(j.bloquants.some((b) => /illisible dans son ensemble/.test(b))).toBe(true);
  });
  it("6 images avec un simple texte coupé sur 10 : aucun bloquant, 6 remarques", () => {
    const j = jugerRelecture(relecture((_, k) => (k < 6 ? { illisible: "texte coupé" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(6);
  });
  it("5 images illisibles sur 10 : pas bloquant", () => {
    const j = jugerRelecture(relecture((_, k) => (k < 5 ? { illisible: "texte coupé" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(5);
  });
  it("6 « manque » sur 10 : des remarques, plus de blocage (comme Q12)", () => {
    const j = jugerRelecture(relecture((_, k) => (k < 6 ? { toutMontre: false, manque: "un bloc" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(6);
  });
  it("5 « manque » sur 10 : au plancher, pas encore bloquant", () => {
    const j = jugerRelecture(relecture((_, k) => (k < 5 ? { toutMontre: false, manque: "un bloc" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(5);
  });
  it("« absent de la vidéo » : remarque", () => {
    const j = jugerRelecture(relecture(() => ({}), { absentDeLaVideo: "la flèche finale" }), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(1);
    expect(j.remarques[0]).toMatch(/absent de toute la vidéo : la flèche finale/);
  });
  it("une image sans réponse parmi 10 : remarque", () => {
    const r = relecture();
    const j = jugerRelecture({ ...r, images: r.images.slice(0, 9) }, INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(1);
    expect(j.remarques[0]).toMatch(/n'a pas été relue/);
  });
  it("6 sans réponse sur 10 : remarques (relecture presque vide)", () => {
    const r = relecture();
    const j = jugerRelecture({ ...r, images: r.images.slice(0, 4) }, INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(6);
  });
  it("1 sans réponse sur 10 : remarque", () => {
    const r = relecture();
    const j = jugerRelecture({ ...r, images: r.images.slice(0, 9) }, INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toHaveLength(1);
  });
  it("aucune image relue : remarque (la relecture elle-même est « non relue »)", () => {
    const j = jugerRelecture({ images: [], absentDeLaVideo: "" }, INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques.join()).toMatch(/aucune image n'a été relue/);
  });
  it("« hors charte » et suggestions restent des indications", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 0 ? { horsCharte: "orange clair", suggestion: "logo" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toEqual([]);
    expect(j.indications).toHaveLength(2);
  });
});

describe("estChiffreFauxIV / estIllisibleGlobalIV", () => {
  it("chiffre faux : deux nombres différents reliés", () => {
    expect(estChiffreFauxIV("30 % au lieu de 20 %")).toBe(true);
    expect(estChiffreFauxIV("1er jour à la place de 2e jour")).toBe(true);
    expect(estChiffreFauxIV("affiche 45 jours remplacé par 30 jours")).toBe(true);
    expect(estChiffreFauxIV("1 000 € et non 100 €")).toBe(true);
  });
  it("pas un chiffre faux", () => {
    expect(estChiffreFauxIV("20 % au lieu de 20,0 %")).toBe(false);
    expect(estChiffreFauxIV("un point d'interrogation à la place de Mission terminée")).toBe(false);
    expect(estChiffreFauxIV("le bandeau masque 30 % du titre, le titre est coupé et sans rapport au lieu de 20")).toBe(false);
    expect(estChiffreFauxIV("")).toBe(false);
  });
  it("illisible dans son ensemble", () => {
    for (const t of ["image entièrement noire", "image vide", "image blanche", "rien n'est lisible", "aucun texte lisible", "l'image est entièrement floue", "illisible dans son ensemble"]) expect(estIllisibleGlobalIV(t), t).toBe(true);
  });
  it.each([
    "écran noir", "écran entièrement noir", "l'image est illisible", "image floue", "toute la vidéo est illisible",
    "la vidéo est totalement noire", "le plan est complètement vide", "toute l'image est floue", "l'écran reste noir",
  ])("image entière illisible : %s", (t) => expect(estIllisibleGlobalIV(t)).toBe(true));
  it.each([
    "le surtitre est complètement illisible", "le titre est totalement flou", "plan vide à droite du schéma",
    "l'image n'est pas illisible", "l'écran n'est pas entièrement noir", "l'image n'est pas entièrement noire", "la vidéo n'est pas floue", "pas d'écran noir",
  ])("pas une image entière illisible : %s", (t) => expect(estIllisibleGlobalIV(t)).toBe(false));
  it.each([
    "30 au lieu de 20", "30 au lieu des 20", "30 au lieu du 20", "30 au lieu d'20", "30 à la place de 20", "30 à la place des 20", "30 à la place du 20", "30 à la place d'20",
    "la vidéo montre 30 alors que l'image dit 20", "la vidéo affiche 30 alors que la carte indique 20", "30 jours contre 20 jours", "30 devient 20", "passe de 30 à 20",
    "l'image dit 20, la vidéo montre 30", "la carte affiche 20 mais l'écran montre 30",
  ])("chiffre faux : %s", (t) => expect(estChiffreFauxIV(t)).toBe(true));
  it.each([
    "le titre apparaît à 3 s au lieu de 2 s", "le titre apparaît à 3 sec au lieu de 2 sec", "3 secondes au lieu de 2 secondes", "largeur 300 px au lieu de 200 px",
    "étape 3 au lieu de étape 2", "bloc 3 à la place du bloc 2", "plan 4 au lieu du plan 3", "image 3 au lieu de l'image 2", "écran 3 au lieu de écran 2",
  ])("durée, pixels ou numéro de bloc : pas un chiffre faux : %s", (t) => expect(estChiffreFauxIV(t)).toBe(false));
  it.each([
    "le surtitre de l'image est illisible", "le texte de l'image est flou", "la légende de l'image est illisible", "le titre en haut de l'image est flou",
    "le bas de l'image est vide", "le haut de l'écran est illisible", "le texte au premier plan est illisible", "le texte du plan est illisible", "arrière-plan flou",
    "le texte de la vidéo est flou", "le texte des images est flou", "le texte d'écran est illisible", "le texte du second plan est flou",
  ])("détail, pas une image entière : %s", (t) => expect(estIllisibleGlobalIV(t)).toBe(false));
  it.each(["écran tout noir", "image très floue", "l'image entière est floue", "noir complet", "tout est flou", "toute l'image est entièrement noire", "l'écran est tout blanc"])(
    "image entière illisible (adverbes, « entière », « tout ») : %s",
    (t) => expect(estIllisibleGlobalIV(t)).toBe(true),
  );
  it.each(["30 % est faux, l'image indique 20 %", "le chiffre 30 % devrait être 20 %", "30 % affiché, 20 % attendu", "montre 45 jours (image : 30 jours)", "30 %, attendu 20 %", "30 %, l'image (source) dit 20 %"])(
    "chiffre faux (nouvelles formes) : %s",
    (t) => expect(estChiffreFauxIV(t)).toBe(true),
  );
  it.each(["le 3e bloc est collé contre 2 icônes", "le bloc 3 est collé contre le bord, 2 icônes", "le chiffre 20 % devrait être 20 %", "20 % affiché, 20 % attendu"])(
    "pas un chiffre faux (nouvelles formes) : %s",
    (t) => expect(estChiffreFauxIV(t)).toBe(false),
  );
  // Un chiffre faux cité entre guillemets ou avec une parenthèse reste un chiffre faux (bloquant).
  it("guillemets français : « 30 % au lieu de 20 % »", () => expect(estChiffreFauxIV("« 30 % au lieu de 20 % »")).toBe(true));
  it('guillemets droits : "30 % au lieu de 20 %"', () => expect(estChiffreFauxIV('"30 % au lieu de 20 %"')).toBe(true));
  it("guillemets : le chiffre « 30 % » devrait être « 20 % »", () => expect(estChiffreFauxIV("le chiffre « 30 % » devrait être « 20 % »")).toBe(true));
  it("guillemets : la vidéo affiche « 45 jours » alors que l'image indique « 30 jours »", () =>
    expect(estChiffreFauxIV("la vidéo affiche « 45 jours » alors que l'image indique « 30 jours »")).toBe(true));
  it("guillemets : l'image indique « 20 % », la vidéo montre « 30 % »", () => expect(estChiffreFauxIV("l'image indique « 20 % », la vidéo montre « 30 % »")).toBe(true));
  it("parenthèse avant attendu : 30 % (attendu : 20 %)", () => expect(estChiffreFauxIV("30 % (attendu : 20 %)")).toBe(true));
  it("parenthèse avant l'image source : affiche 30 % (l'image source dit 20 %)", () => expect(estChiffreFauxIV("affiche 30 % (l'image source dit 20 %)")).toBe(true));
  it("illisible de détail", () => {
    for (const t of ["texte coupé par le bord", "VALIDE coiffe Autoliquidation", "le titre est flou"]) expect(estIllisibleGlobalIV(t), t).toBe(false);
  });
});
