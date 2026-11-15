/**
 * Filet C4-U4.0 : U4.1 à U4.13 le gardent vert. Une empreinte ne se régénère jamais sans accord écrit du relecteur.
 *
 * Constat de l'existant, aucune correction : (1) la consigne du réalisateur, (2) le repli sans vidéo, (3) les contrôles v4,
 * (4) le rendu des 26 plaquettes actives à 3 images (empreinte sha256 du HTML). Lecture seule des fichiers v4 protégés.
 * AUCUN rendu vidéo, aucun appel à Claude, aucun réseau.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

/** Les dépendances de studio-rendu ne sont pas installées par les contrôles obligatoires de GitHub : le bloc 4 se saute alors (avec avertissement). */
const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
if (!AVEC_RENDU) console.warn("C4-U4.0 : studio-rendu/node_modules absent, 26 rendus NON vérifiés");
let imageCourante = 60;
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>()/* remotion n'est pas installé dans le contrôle tsc : type neutre, le simulacre garde le vrai module à l'exécution */;
  // @ts-expect-error le react de studio-rendu n'a pas de types ici
  const { createElement: element, Fragment } = (await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
  return { ...vrai, Sequence: (p: { children?: React.ReactNode }) => element(Fragment, null, p.children), Audio: () => null, /* ajout au montage recopié : les plaquettes à vidéo posent OffthreadVideo, qui appelle le vrai Sequence sans composition */ OffthreadVideo: (p: { src?: string }) => element("video", { src: p.src }), useCurrentFrame: () => imageCourante, useVideoConfig: () => ({ fps: 30, width: 1080, height: 1920, durationInFrames: 90, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { blocHistoriqueV4, consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { CATALOGUE_V4, COULISSE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { CODES_BLOQUANT_RENDU_V4, SEUILS_V4, controlerSuiteV4, erreursSousTitresV4, estRendableV4, resoudreElementsV4, type ElementResoluV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";
import type { HistoriqueVideo } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { ESSAIS_REPLI_SANS_VIDEO_V4, IDS_PLAQUETTES_A_VIDEO_V4, elementsPourRepliV4, erreursRepliV4, phraseRepliEchecV4, phraseRepliOkV4 } from "@/moteurs/montage-facecam-animee/repli-sans-video-v4";
import { planValide } from "./plan-reference";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
const { RENDUS_V4 } = AVEC_RENDU ? await import("../../studio-rendu/compositions/interface-claire/motion-v4/registre-v4") : { RENDUS_V4: {} as Record<string, never> };

const DOSSIER = "tests/facecam-animee/fixtures/chantier4";
const lire = (nom: string) => readFileSync(`${DOSSIER}/${nom}`, "utf8");
/** Production initiale des fixtures seulement (jamais en régénération : voir l'en-tête). */
const GENERER = process.env.C4_U4_GENERER === "1";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

const HISTORIQUE_FIXE: HistoriqueVideo[] = [
  { types: [], entrees: [], plaquettesV4: ["EtiquetteTete", "Interjection", "Chrono"], ouvertureV4: "EtiquetteTete" },
  { types: [], entrees: [], plaquettesV4: ["Interjection", "JaugePourcentage"], ouvertureV4: "Interjection" },
];

describe("C4-U4.0 · bloc 1 : consigne du réalisateur figée", () => {
  it("sans historique", () => {
    const t = consigneRealisateur();
    if (GENERER) writeFileSync(`${DOSSIER}/consigne-sans-historique.txt`, t);
    expect(t).toBe(lire("consigne-sans-historique.txt"));
  });
  it("avec un historique fixe de 2 vidéos (consigne et bloc v4)", () => {
    const t = `${consigneRealisateur(HISTORIQUE_FIXE)}\n=====BLOC-HISTORIQUE-V4=====\n${blocHistoriqueV4(HISTORIQUE_FIXE)}\n`;
    if (GENERER) writeFileSync(`${DOSSIER}/consigne-avec-historique.txt`, t);
    expect(t).toBe(lire("consigne-avec-historique.txt"));
  });
});

describe("C4-U4.0 · bloc 2 : repli sans vidéo figé", () => {
  const plan = { elementsV4: [
    { id: "AvantApres", debut: 4, fin: 7, mots: ["AVANT", "APRÈS"], recherches: ["artisan qui charge un camion"], medias: ["m1"] },
    { id: "EtiquetteTete", debut: 8, fin: 9.5, mots: ["DEVIS"] },
    { id: "MosaiqueVideos", debut: 10, fin: 13, recherches: ["a", "b"] },
  ] as ElementV4Plan[] };
  const retirees = [{ id: "AvantApres", rang: 0, debut: 4 }] as never;
  const instantane = () => ({
    ids: IDS_PLAQUETTES_A_VIDEO_V4, essais: ESSAIS_REPLI_SANS_VIDEO_V4,
    elements: elementsPourRepliV4(plan), erreurs: erreursRepliV4(plan, retirees),
    ok: phraseRepliOkV4(retirees), echec: phraseRepliEchecV4(retirees),
  });
  it("même résultat que l'instantané", () => {
    if (GENERER) writeFileSync(`${DOSSIER}/repli.json`, `${JSON.stringify(instantane(), null, 2)}\n`);
    expect(JSON.parse(JSON.stringify(instantane()))).toEqual(JSON.parse(lire("repli.json")));
  });
});

describe("C4-U4.0 · bloc 3 : contrôles v4 figés", () => {
  const ref = planValide();
  const ctx = { duree: ref.duree, finDebut: ref.fin.debut };
  const suite = (els: ElementResoluV4[]) => controlerSuiteV4(els, ctx).erreurs;
  const elementsRef: ElementV4Plan[] = [
    { id: "EtiquetteTete", debut: 1, fin: 2.5, mots: ["DEVIS"] },
    { id: "Interjection", debut: 4, fin: 5, mots: ["ATTENTION."] },
  ];
  const resolue = resoudreElementsV4(elementsRef, ref.duree);
  const d0 = resoudreElementsV4([{ id: "PlaquetteQuiNexistePas", debut: 1, fin: 2 }], ref.duree);
  const h1 = resoudreElementsV4([{ id: "EtiquetteTete", debut: 9, fin: 10.5, mots: ["DEVIS"] }], ref.duree);
  // V1 : une fiche copiée dont l'emprise laisse le visage à moitié caché (copie de test, le catalogue n'est pas modifié).
  const v1 = [{ ...resolue.elements[0], fiche: { ...resolue.elements[0].fiche, imagesVisagePartiel: 9 } }];
  const instantane = () => ({
    seuils: SEUILS_V4, codes: CODES_BLOQUANT_RENDU_V4,
    resolutionReference: resolue.erreurs, suiteReference: suite(resolue.elements),
    d0: { resolution: d0.erreurs, rendable: estRendableV4(d0.erreurs) },
    v1: { suite: suite(v1), rendable: estRendableV4(suite(v1)) },
    h1: { resolution: h1.erreurs, suite: suite(h1.elements), rendable: estRendableV4(suite(h1.elements)) },
    sousTitres: CATALOGUE_V4.map((f) => [f.id, erreursSousTitresV4(f)]).filter(([, e]) => (e as string[]).length),
  });
  it("liste d'erreurs identique à l'instantané", () => {
    if (GENERER) writeFileSync(`${DOSSIER}/controles.json`, `${JSON.stringify(instantane(), null, 2)}\n`);
    expect(JSON.parse(JSON.stringify(instantane()))).toEqual(JSON.parse(lire("controles.json")));
  });
  it("les trois plans fautifs lèvent bien D0, V1 et H1", () => {
    expect(d0.erreurs.some((e) => e.startsWith("D0"))).toBe(true);
    expect(suite(v1).some((e) => e.startsWith("V1"))).toBe(true);
    expect(suite(h1.elements).some((e) => e.startsWith("H1"))).toBe(true);
  });
});

describe("C4-U4.0 · bloc 4 : 26 rendus à 3 images", () => {
  it("le catalogue compte 26 fiches actives et 13 en coulisse", () => {
    expect(CATALOGUE_V4).toHaveLength(26);
    expect(COULISSE_V4).toHaveLength(13);
  });

  /** Élément synthétique : tout ce que la fiche réclame (textes, lignes, instants, nombre, vidéos), des valeurs fixes. */
  const elementDe = (f: (typeof CATALOGUE_V4)[number]): ElementV4Plan => {
    const debut = 5;
    const e: ElementV4Plan = { id: f.id, debut, fin: debut + f.dureeSec[0] };
    if (f.textes[1] > 0) e.mots = Array.from({ length: Math.max(1, f.textes[0]) }, (_, k) => `MOT${k + 1}`);
    if (f.lignes[1] > 0) e.lignes = Array.from({ length: Math.max(1, f.lignes[0]) }, (_, k) => ({ texte: `Ligne ${k + 1}`, a: debut + 0.3 * (k + 1) }));
    if (f.instants[1] > 0) e.instants = Array.from({ length: Math.max(1, f.instants[0]) }, (_, k) => debut + 0.3 * (k + 1));
    if (f.videos[1] > 0) { e.recherches = Array.from({ length: f.videos[1] }, (_, k) => `scène ${k + 1}`); e.medias = e.recherches.map((_, k) => `broll/essai-${k + 1}.mp4`); }
    if (f.exigeNombreDit) e.nombre = 40;
    return e;
  };
  const rendre = (e: ElementV4Plan, image: number): string => {
    imageCourante = image;
    return renderToStaticMarkup(createElement("div", null, (RENDUS_V4[e.id] as unknown as (e: ElementV4Plan, c: never, d: number) => React.ReactNode)(e, { duree: 30, fps: 30 } as never, 90)));
  };
  const IMAGES = [0, 45, 89] as const;
  const empreintes = (): Record<string, string[]> => Object.fromEntries(CATALOGUE_V4.map((f) => [f.id, IMAGES.map((i) => sha(rendre(elementDe(f), i)))]));

  describe.skipIf(!AVEC_RENDU)("empreintes sha256", () => {
    it("26 × 3 empreintes identiques au fichier figé", () => {
      const actuel = empreintes();
      if (GENERER) writeFileSync(`${DOSSIER}/empreintes-rendus.json`, `${JSON.stringify(actuel, null, 2)}\n`);
      const fige = JSON.parse(lire("empreintes-rendus.json")) as Record<string, string[]>;
      expect(Object.keys(fige)).toHaveLength(26);
      expect(actuel).toEqual(fige);
    });
  });
});
