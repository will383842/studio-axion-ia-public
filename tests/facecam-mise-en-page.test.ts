/**
 * PLAN FACECAM v4 — LOT G : mise en page `miseEnPage{cote|vignette}` réellement rendue (B.23). Will à droite ou à gauche
 * (visage à 40 % de la largeur depuis son bord, l'animation de l'autre côté) ; petite version de Will dans un coin (30 %
 * de la largeur, jamais agrandie par rapport à la source 4K). Déclenchée par le fil (« mets-moi à droite », « petite
 * version de moi »), branchée dans l'habillage et la composition finale. Vrai rendu FFmpeg court quand il est là.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import { geometrieCote, geometrieVignette, poserMisesEnPage, REGLES_MISE_EN_PAGE } from "@/briques/habillage-facecam/mise-en-page";
import { parametresComposition } from "@/briques/composition";
import type { PlanScene, ProprietesImageComposition } from "@/briques/composition/scene";
import { habillageFacecam, RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { cartePosee, cartesDesPassages } from "@/moteurs/montage-facecam/raccords";
import { operationsParRegles } from "@/moteurs/montage-facecam/monteur/role";
import type { PassageMonteur } from "@/moteurs/montage-facecam/monteur";
import { argumentsImageFfmpeg } from "../studio-rendu/src/composition/image-ffmpeg";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

const MOTS: MotHorodate[] = "Voici les trois raisons de former votre équipe à l'intelligence artificielle dès cette année avec un financement OPCO".split(" ").map((mot, i) => ({ mot, debutSec: i * 0.5, finSec: i * 0.5 + 0.4 }));

describe("lot G · géométrie de la mise en page", () => {
  it("côté : colonne de Will à 55 %, visage à 40 % de la largeur depuis son bord, carte de l'autre côté", () => {
    const d = geometrieCote(1080, "droite");
    expect(d).toEqual({ sourceX: 378, largeurPersonne: 594, xPersonne: 486, xCarte: 0, largeurCarte: 486 });
    // Le visage (au centre de l'image composée, x = 540) arrive à 1080 − 40 % = 648 px.
    expect(d.xPersonne + (540 - d.sourceX)).toBe(648);
    const g = geometrieCote(1080, "gauche");
    expect(g.xPersonne + (540 - g.sourceX)).toBe(432);
    expect(g.xCarte).toBe(594);
    // Entre 35 et 45 % pour un visage décentré aussi (la colonne reste dans l'image).
    const decale = geometrieCote(1080, "gauche", { centreXPct: 0.3 });
    expect(decale.sourceX).toBeGreaterThanOrEqual(0);
  });

  it("vignette : 28 à 35 % de la largeur, visage net (échelle ≤ 1 sur la source 4K), en haut dans le coin", () => {
    const v = geometrieVignette(1080, 1920, "droite");
    expect(v.place.largeur / 1080).toBeGreaterThanOrEqual(0.28);
    expect(v.place.largeur / 1080).toBeLessThanOrEqual(0.35);
    expect(v.echelleSource).toBeLessThanOrEqual(1);
    expect(v.place.x + v.place.largeur).toBe(1080 - Math.round(1080 * REGLES_MISE_EN_PAGE.margePct));
    expect(v.place.y).toBe(192);
    expect(v.recadrage.x + v.recadrage.largeur).toBeLessThanOrEqual(1080);
    // Sur un punch-in fort (moins de pixels de source par pixel composé), le recadrage s'élargit : jamais agrandi.
    const serre = geometrieVignette(1080, 1920, "gauche", { largeurPct: 0.1 }, 0.5);
    expect(serre.echelleSource).toBeLessThanOrEqual(1.001);
    expect(serre.place.x).toBe(54);
  });
});

describe("lot G · déclenchée par le fil, branchée dans l'habillage", () => {
  const consigne = (texte: string) => ({ id: "fil", texte, origine: "fil" as const, ancre: { debutMot: 2, finMot: 10 } });

  it("« mets-moi à droite » et « petite version de moi » deviennent l'opération `miseEnPage`", () => {
    expect(operationsParRegles(consigne("Mets-moi à droite pendant l'explication"))).toEqual([expect.objectContaining({ type: "miseEnPage", mode: "cote", cote: "droite" })]);
    expect(operationsParRegles(consigne("Fais une petite version de moi dans le coin"))).toEqual([expect.objectContaining({ type: "miseEnPage", mode: "vignette" })]);
  });

  const passage = (id: string, debutSec: number, finSec: number, operation: Record<string, unknown>) => ({ id, type: "autre", debutSec, finSec, origine: "demande", ancre: { debutPriseSec: debutSec, finPriseSec: finSec }, operation }) as unknown as PassageMonteur;
  const LISTE = passage("pas-1", 2, 7, { type: "ajouterCarte", debutMot: 2, finMot: 12, modele: "liste", textes: ["Trois raisons", "Temps", "Équipe", "OPCO"], html: null, disposition: "ecran-partage", description: "Les trois raisons", animationGardeeId: null });

  it("la mise en page habille la carte qu'elle recouvre ; seule, elle a une carte faite de sa description", () => {
    const cote = passage("pas-2", 2.5, 6.5, { type: "miseEnPage", debutMot: 3, finMot: 11, mode: "cote", cote: "droite", description: "Mets-moi à droite pendant l'explication" });
    const cartes = cartesDesPassages([LISTE, cote]);
    expect(cartes).toHaveLength(1);
    expect(cartes[0]).toMatchObject({ id: "pas-1", disposition: "plein-ecran", miseEnPage: { mode: "cote", cote: "droite" } });
    const seule = cartesDesPassages([passage("pas-3", 8, 12, { type: "miseEnPage", debutMot: 16, finMot: 20, mode: "vignette", cote: null, description: "Petite version de moi : financement OPCO" })]);
    expect(seule[0].miseEnPage).toEqual({ mode: "vignette", cote: "droite" });
    const posee = cartePosee(seule[0]);
    expect(posee?.carte?.modele).toBeTruthy();
    expect(posee?.miseEnPage).toEqual({ mode: "vignette", cote: "droite" });
    // « Divise l'écran » (écranPartage) a aussi sa carte.
    expect(cartesDesPassages([passage("pas-4", 1, 5, { type: "ecranPartage", debutMot: 1, finMot: 8, description: "Les 3 étapes", textes: ["Étape 1", "Étape 2", "Étape 3"] })])[0]).toMatchObject({ disposition: "moitie-haute" });
  });

  it("l'habillage rend la carte du côté à la largeur de sa colonne et pose les mises en page dans la composition", () => {
    const cartes = cartesDesPassages([LISTE, passage("pas-2", 2.5, 6.5, { type: "miseEnPage", debutMot: 3, finMot: 11, mode: "cote", cote: "gauche", description: "Mets-moi à gauche" })]).map((c) => cartePosee(c)!);
    const h = habillageFacecam({ pisteMonteeCle: "facecam/v/ver/montage.mov", dureeSec: 12, mots: MOTS, cartes, prefixeCartes: "facecam/v/ver/cartes" });
    expect((h.cartes[0].parametres.proprietes as { largeur: number }).largeur).toBe(486);
    expect(h.entree.ecransPartages).toBeUndefined();
    expect(h.entree.misesEnPage).toEqual([expect.objectContaining({ carteCle: "facecam/v/ver/cartes/pas-1.mp4", mode: "cote", cote: "gauche", geometrie: { cote: expect.objectContaining({ xPersonne: 0, xCarte: 594 }) } })]);
  });

  it("composition : plans coupés aux bornes, entrée en 9 images, sous-titres dans la colonne de Will", () => {
    const c = { videoId: "v", formatId: "facecam", moteurId: "montage-facecam", ratios: ["9:16"], dureeCibleSec: 12, script: { blocs: [], texteComplet: "" }, distribution: [{ role: "Face caméra", source: "rush" }], briques: { etalonnage: true, "sous-titres": true, "mention-ia": false }, styles: { lut: null }, entrees: {}, reglages: {}, plans: [], prononciations: [], sousTitres: { base: "simple", intensite: "equilibre" } } as unknown as CommandeFabrication;
    const geometrie = { cote: geometrieCote(1080, "droite") };
    const plans = [{ ordre: 1, debutSec: 0, finSec: 12, texte: "", segmentId: "facecam", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "face" }] as never;
    const segments = [{ id: "g1", debutSec: 4, finSec: 5, mots: [{ mot: "Trois", debutSec: 4, finSec: 4.4 }, { mot: "raisons", debutSec: 4.4, finSec: 5 }] }];
    const p = parametresComposition(c, { ratio: "9:16", plans, segments, dureeSec: 12, audioCle: "m.mov", pistesDouble: { face: "m.mov" }, pistesDepuisLook: true, sourcePreCadree: true, source10bits: true, positionSousTitresPct: 62, misesEnPage: [{ debutSec: 3, finSec: 7, carteCle: "cartes/pas-1.mp4", mode: "cote", cote: "droite", geometrie }] }, RECETTE_COMPOSITION_FACECAM);
    const poses = p.image.plans.filter((x) => x.miseEnPage);
    expect(poses.map((x) => [x.debutSec, x.finSec, x.miseEnPage!.entreeImages])).toEqual([[3, 7, 9]]);
    expect(p.entrees["carte-mp-1"]).toBe("cartes/pas-1.mp4");
    // Les autres plans restent plein cadre.
    expect(p.image.plans.filter((x) => !x.miseEnPage).map((x) => [x.debutSec, x.finSec])).toEqual([[0, 3], [7, 12]]);
    expect(p.texte.sousTitres?.passagesJonction).toEqual([{ debutSec: 3, finSec: 7, centrePct: 62, colonne: { gauchePx: 486, largeurPx: 594 } }]);
  });

  it("un écran partagé déjà posé reste prioritaire sur une mise en page au même instant", () => {
    const plan: PlanScene = { debutSec: 0, finSec: 4, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.4 }, ecranPartage: { carte: "entree:x", hauteurHaut: 960, sourceY: 320, entreeImages: 9, carteDebutSec: 0 } };
    expect(poserMisesEnPage([plan], [{ debutSec: 0, finSec: 4, carte: "y", mode: "vignette", cote: "droite", geometrie: { vignette: geometrieVignette(1080, 1920) } }])[0].miseEnPage).toBeUndefined();
  });
});

describe("lot G · vrai rendu FFmpeg (côté puis vignette)", () => {
  it.skipIf(!ffmpegPresent)("Will à droite (carte à gauche), puis petite version de Will dans le coin, sur la carte plein écran", () => {
    const dossier = mkdtempSync(join(tmpdir(), "studio-facecam-mp-"));
    const run = (args: string[]) => {
      const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { cwd: dossier });
      if (r.status !== 0) throw new Error(r.stderr.toString());
    };
    // Piste pré-cadrée d'essai : fond rouge, « visage » blanc au centre (x 440-640, y 520-720). Carte : bleue.
    run(["-f", "lavfi", "-i", "color=c=0xAA2222:s=1080x1920:r=25:d=2,drawbox=x=440:y=520:w=200:h=200:color=white:t=fill", "-c:v", "libx264", "-pix_fmt", "yuv420p", "will.mp4"]);
    run(["-f", "lavfi", "-i", "color=c=0x2244CC:s=1080x1920:r=25:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "carte.mp4"]);
    run(["-f", "lavfi", "-i", "color=c=0x110A05:s=1080x1920", "-frames:v", "1", "decor.png"]);
    run(["-f", "lavfi", "-i", "sine=f=220:d=2.1:sample_rate=48000", "son.wav"]);
    const plans = poserMisesEnPage(
      [{ debutSec: 0, finSec: 2, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } }],
      [
        { debutSec: 0, finSec: 1, carte: "carte-mp-1", mode: "cote", cote: "droite", geometrie: { cote: geometrieCote(1080, "droite") } },
        { debutSec: 1, finSec: 2, carte: "carte-mp-2", mode: "vignette", cote: "droite", geometrie: { vignette: geometrieVignette(1080, 1920, "droite", { yeuxPct: 620 / 1920, largeurPct: 0.19 }) } },
      ],
    );
    const p: ProprietesImageComposition = { ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 50, decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false }, doubles: { principal: { type: "video", url: "entree:double", transparent: false } }, plans, sourcePreCadree: true } as ProprietesImageComposition;
    run(argumentsImageFfmpeg(p, { grainPct: 0, grainTaillePx: 2, vignettePct: 0 }, { decor: "decor.png", doubles: { principal: { fichier: "will.mp4", video: true } }, illustrations: {}, luts: [], son: "son.wav", cartes: { "carte-mp-1": "carte.mp4", "carte-mp-2": "carte.mp4" } }, 2, "master.mov").slice(2));
    const pixel = (t: number, x: number, y: number) => [...spawnSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", join(dossier, "master.mov"), "-frames:v", "1", "-vf", `format=rgb24,crop=1:1:${x}:${y}`, "-f", "rawvideo", "-"]).stdout];
    const bleu = (c: number[]) => c[2] > 150 && c[0] < 90;
    const blanc = (c: number[]) => c[0] > 200 && c[1] > 200 && c[2] > 200;
    const rouge = (c: number[]) => c[0] > 130 && c[2] < 90;
    // Côté (après l'entrée de 9 images) : la carte à gauche, le visage à 60 % de la largeur, Will à droite.
    expect(bleu(pixel(0.7, 200, 1000))).toBe(true);
    expect(blanc(pixel(0.7, 648, 620))).toBe(true);
    expect(rouge(pixel(0.7, 1000, 1500))).toBe(true);
    // Vignette : la carte partout, la petite version de Will (visage blanc) dans le coin haut droit.
    const v = geometrieVignette(1080, 1920, "droite", { yeuxPct: 620 / 1920, largeurPct: 0.19 });
    expect(bleu(pixel(1.5, 200, 1500))).toBe(true);
    expect(blanc(pixel(1.5, v.place.x + v.place.largeur / 2, v.place.y + Math.round(v.place.hauteur * 0.42)))).toBe(true);
    expect(rouge(pixel(1.5, v.place.x + 6, v.place.y + v.place.hauteur - 6))).toBe(true);
  }, 120_000);
});
