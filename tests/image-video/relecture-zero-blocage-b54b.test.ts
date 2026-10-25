/**
 * 25/10/2026 : relecture finale « zéro blocage » (règle de Will : jamais d'arrêt pour un défaut de détail ; bloquant seulement
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
import { instantsClesIV, jugerRelecture, PART_MANQUES_BLOQUANTE, type RelectureFinale } from "@/moteurs/montage-image-video/relecture-finale";
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
  it("« faux » : 1 bloquant", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 2 ? { faux: "30 % au lieu de 20 %" } : {})), INSTANTS);
    expect(j.bloquants).toHaveLength(1);
    expect(j.bloquants[0]).toMatch(/faux : 30 % au lieu de 20 %/);
  });
  it("« illisible » : 1 bloquant", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 5 ? { illisible: "texte coupé par le bord" } : {})), INSTANTS);
    expect(j.bloquants).toHaveLength(1);
    expect(j.bloquants[0]).toMatch(/illisible : texte coupé par le bord/);
  });
  it("6 « manque » sur 10 : 1 bloquant (plancher dépassé)", () => {
    const j = jugerRelecture(relecture((_, k) => (k < 6 ? { toutMontre: false, manque: "un bloc" } : {})), INSTANTS);
    expect(j.bloquants).toHaveLength(1);
    expect(j.remarques).toEqual([]);
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
  it("aucune image relue : bloquant", () => {
    const j = jugerRelecture({ images: [], absentDeLaVideo: "" }, INSTANTS);
    expect(j.bloquants).toHaveLength(1);
  });
  it("« hors charte » et suggestions restent des indications", () => {
    const j = jugerRelecture(relecture((_, k) => (k === 0 ? { horsCharte: "orange clair", suggestion: "logo" } : {})), INSTANTS);
    expect(j.bloquants).toEqual([]);
    expect(j.remarques).toEqual([]);
    expect(j.indications).toHaveLength(2);
  });
});
