/**
 * QUALL-4 (temps A) : contrôle objectif gratuit du story-board de la vidéo longue (poseur factice), traduction vers les
 * alertes qualité communes, et banc images (analyse pure + deux petites vidéos générées par ffmpeg).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { alertesQualiteDepuisControle } from "@/moteurs/montage-video-longue/controle-alertes";
import { controlerStoryboard } from "@/moteurs/montage-video-longue/controle";
import {
  FORMAT_LONGUE,
  VERSION_STORYBOARD,
  ZONES_LONGUE,
  type ElementPose,
  type LigneSousTitre,
  type PoserScene,
  type PoserSousTitre,
  type Rect,
  type SceneLongue,
  type StoryboardVideoLongue,
} from "@/moteurs/montage-video-longue/storyboard-types";
import { analyserVideo, partNonFond, reperesVides } from "../../../studio-rendu/scripts/controle-images-longue";

/* ---------- Story-board propre, écrit à la main (conforme au contrat) ---------- */

const base = (id: string, chapitreId: string, debutMs: number, finMs: number) => ({ id, chapitreId, debutMs, finMs, fond: "ivoire" as const, entree: "fondu" as const });
const el = (texte: string, apparitionMs: number) => ({ texte, apparitionMs, accent: null });

function storyboardPropre(): StoryboardVideoLongue {
  const scenes: SceneLongue[] = [
    { ...base("s1", "c1", 0, 3000), type: "carton-titre", question: "Comment fonctionne la vidéo longue ?" },
    { ...base("s2", "c1", 3000, 5500), type: "carton-chapitre", rang: 1, total: 2, titre: "Le principe" },
    { ...base("s3", "c1", 5500, 10_000), type: "phrase-cle", phrase: "Tout part du script", motCle: "script", forme: "coche" },
    { ...base("s4", "c1", 10_000, 15_000), type: "liste", titre: "Trois idées", elements: [el("Un script", 10_500), el("Des scènes", 12_000), el("Un contrôle", 13_500)], compte: 3 },
    { ...base("s5", "c1", 15_000, 19_000), type: "chiffre", chiffres: [{ valeur: 12, ecrit: "douze", affiche: "12", unite: "mois", apparitionMs: 15_500 }], contexte: "Douze mois de recul" },
    { ...base("s6", "c1", 19_000, 24_000), type: "avant-apres", avant: "Un fond blanc", apres: "Des scènes dessinées", apparitionApresMs: 21_000 },
    { ...base("s7", "c2", 24_000, 26_500), type: "carton-chapitre", rang: 2, total: 2, titre: "La suite" },
    { ...base("s8", "c2", 26_500, 32_000), type: "etapes", numeroDepart: 1, elements: [el("Écrire", 27_000), el("Dessiner", 29_000), el("Contrôler", 31_000)] },
    { ...base("s9", "c2", 32_000, 36_000), type: "phrase-cle", phrase: "Rien n'est inventé", motCle: null, forme: "cible" },
    { ...base("s10", "c2", 36_000, 41_000), type: "fin", question: "Comment fonctionne la vidéo longue ?", appel: "Prendre rendez-vous", adresse: "axion-ia.com" },
  ];
  const sousTitres: LigneSousTitre[] = [
    { texte: "Tout part du script", debutMs: 5500, finMs: 8000 },
    { texte: "Trois idées simples à retenir", debutMs: 10_000, finMs: 14_000 },
    { texte: "Rien n'est inventé", debutMs: 32_000, finMs: 35_000 },
  ];
  return {
    version: VERSION_STORYBOARD,
    format: FORMAT_LONGUE,
    dureeMs: 41_000,
    question: "Comment fonctionne la vidéo longue ?",
    chapitres: [
      { id: "c1", rang: 1, titre: "Le principe", debutMs: 0, finMs: 24_000 },
      { id: "c2", rang: 2, titre: "La suite", debutMs: 24_000, finMs: 41_000 },
    ],
    scenes,
    sousTitres,
    alertes: [],
  };
}

/* ---------- Poseur factice sain ---------- */

const texte = (id: string, y: number, taillePx: number, role: ElementPose["role"] = "contenu", zone: Rect = ZONES_LONGUE.scene): ElementPose => ({
  id,
  nature: "texte",
  role,
  rect: { x: zone.x, y, largeur: 800, hauteur: Math.round(taillePx * 1.3) },
  opacite: 1,
  couleur: "noir",
  taillePx,
});
const poseurSain: PoserScene = (s) => {
  const zone = s.type === "carton-titre" || s.type === "carton-chapitre" || s.type === "fin" ? ZONES_LONGUE.plein : ZONES_LONGUE.scene;
  return [texte(`${s.id}-grand`, 200, 96, "contenu", zone), texte(`${s.id}-petit`, 400, 52, "contenu", zone), texte(`${s.id}-etiquette`, 120, 32, "etiquette", zone)];
};
const sousTitreSain: PoserSousTitre = (l) => ({
  id: "st",
  nature: "texte",
  role: "contenu",
  rect: { ...ZONES_LONGUE.texteSousTitres },
  opacite: 1,
  couleur: "noir",
  taillePx: 46,
  lignes: [[{ texte: l.texte, accent: false }]],
});
const sain = { scene: poseurSain, sousTitre: sousTitreSain };
const codes = (sb: StoryboardVideoLongue, p = sain) => controlerStoryboard(sb, p).alertes.map((a) => a.code);

/* ---------- Contrôle ---------- */

describe("controlerStoryboard : story-board propre", () => {
  it("note au moins 90, aucune alerte grave", () => {
    const c = controlerStoryboard(storyboardPropre(), sain);
    expect(c.alertes.filter((a) => a.gravite === "grave")).toEqual([]);
    expect(c.note).toBeGreaterThanOrEqual(90);
    expect(Object.keys(c.criteres)).toHaveLength(9);
  });
});

describe("controlerStoryboard : défauts un par un", () => {
  it("bande de sous-titres touchée", () => {
    const poser: PoserScene = (s) => (s.id === "s3" ? [...poseurSain(s, 0), { ...texte("intrus", 880, 52), rect: { x: 200, y: 880, largeur: 600, hauteur: 80 } }] : poseurSain(s, 0));
    expect(codes(storyboardPropre(), { ...sain, scene: poser })).toContain("sur-la-bande");
  });
  it("trou de 1,2 s entre deux scènes", () => {
    const sb = storyboardPropre();
    sb.scenes[3] = { ...sb.scenes[3], debutMs: 11_200 };
    expect(codes(sb)).toContain("image-vide");
  });
  it("un trou de 0,5 s est toléré", () => {
    const sb = storyboardPropre();
    sb.scenes[3] = { ...sb.scenes[3], debutMs: 10_500 };
    expect(codes(sb)).not.toContain("image-vide");
  });
  it("plus d'une seconde sans contenu dans une scène", () => {
    const poser: PoserScene = (s) => (s.id === "s5" ? [texte("deco", 300, 60, "decor")] : poseurSain(s, 0));
    expect(codes(storyboardPropre(), { ...sain, scene: poser })).toContain("image-vide");
  });
  it("texte de 40 px", () => {
    const poser: PoserScene = (s) => (s.id === "s6" ? [texte("mini", 300, 40), texte("gros", 500, 90)] : poseurSain(s, 0));
    const a = controlerStoryboard(storyboardPropre(), { ...sain, scene: poser }).alertes.find((x) => x.code === "texte-trop-petit");
    expect(a?.gravite).toBe("grave");
  });
  it("titre « Chapitre 2 »", () => {
    const sb = storyboardPropre();
    sb.chapitres[1].titre = "Chapitre 2";
    expect(codes(sb)).toContain("titre-generique");
  });
  it("fin absente", () => {
    const sb = storyboardPropre();
    sb.scenes = sb.scenes.slice(0, -1);
    sb.scenes[sb.scenes.length - 1] = { ...sb.scenes[sb.scenes.length - 1], finMs: sb.dureeMs };
    expect(codes(sb)).toContain("fin-absente");
  });
  it("chapitre de 6 s", () => {
    const sb = storyboardPropre();
    sb.chapitres[1].debutMs = 35_000;
    expect(codes(sb)).toContain("chapitre-court");
  });
  it("carton de chapitre absent", () => {
    const sb = storyboardPropre();
    sb.scenes = sb.scenes.filter((s) => s.id !== "s7");
    sb.scenes[5] = { ...sb.scenes[5], finMs: 26_500 };
    expect(codes(sb)).toContain("carton-absent");
  });
  it("orange sur ivoire, et couleur inconnue", () => {
    const poser: PoserScene = (s) => (s.id === "s3" ? poseurSain(s, 0).map((e) => ({ ...e, couleur: "orange" as const })) : poseurSain(s, 0));
    expect(codes(storyboardPropre(), { ...sain, scene: poser })).toContain("couleur-hors-charte");
    const bleu: PoserScene = (s) => poseurSain(s, 0).map((e) => ({ ...e, couleur: "bleu" as unknown as "noir" }));
    expect(codes(storyboardPropre(), { ...sain, scene: bleu })).toContain("couleur-hors-charte");
  });
  it("4 scènes du même type de suite", () => {
    const sb = storyboardPropre();
    sb.scenes = [4, 5, 6, 7].map((n, i) => ({ ...base(`m${n}`, "c1", i * 5000, (i + 1) * 5000), type: "phrase-cle" as const, phrase: "Une idée", motCle: null, forme: "coche" as const }));
    expect(codes(sb)).toContain("monotonie");
  });
  it("scène figée", () => {
    const sb = storyboardPropre();
    sb.scenes[2] = { ...sb.scenes[2], finMs: 20_000 } as SceneLongue;
    sb.scenes[3] = { ...sb.scenes[3], debutMs: 20_000 } as SceneLongue;
    expect(codes(sb)).toContain("scene-figee");
  });
  it("chevauchement, hors cadre, hiérarchie plate", () => {
    const poser: PoserScene = (s) => (s.id === "s9" ? [texte("a", 300, 60), { ...texte("b", 320, 60), rect: { x: 200, y: 320, largeur: 800, hauteur: 80 } }, { ...texte("c", 600, 60), rect: { x: 1700, y: 600, largeur: 400, hauteur: 80 } }] : poseurSain(s, 0));
    const c = codes(storyboardPropre(), { ...sain, scene: poser });
    expect(c).toEqual(expect.arrayContaining(["chevauchement", "hors-cadre", "sans-hierarchie"]));
  });
  it("un texte dans sa carte n'est pas un chevauchement", () => {
    const poser: PoserScene = (s) => [
      { ...texte(`${s.id}-carte`, 200, 52), id: `${s.id}-carte`, nature: "carte", role: "contenu", rect: { x: 120, y: 190, largeur: 900, hauteur: 300 } },
      { ...texte(`${s.id}-titre`, 210, 96), dans: `${s.id}-carte` },
      { ...texte(`${s.id}-corps`, 350, 52), dans: `${s.id}-carte` },
    ];
    expect(codes(storyboardPropre(), { ...sain, scene: poser })).not.toContain("chevauchement");
  });
  it("sous-titres : trop courts, trop rapides, sur 3 lignes, pendant un carton", () => {
    const sb = storyboardPropre();
    sb.sousTitres = [
      { texte: "Bref", debutMs: 5500, finMs: 6200 },
      { texte: "un deux trois quatre cinq six sept huit neuf dix onze douze", debutMs: 10_000, finMs: 13_000 },
      { texte: "Normal", debutMs: 32_000, finMs: 35_000 },
      { texte: "Pendant la fin", debutMs: 37_000, finMs: 40_000 },
    ];
    const poser: PoserSousTitre = (l) => ({ ...sousTitreSain(l, 0)!, lignes: [[{ texte: "a", accent: false }], [{ texte: "b", accent: false }], [{ texte: "c", accent: false }]] });
    const c = controlerStoryboard(sb, { scene: poseurSain, sousTitre: poser });
    expect(c.alertes.filter((a) => a.code === "sous-titre-illisible").length).toBeGreaterThanOrEqual(3);
    expect(c.alertes.some((a) => a.code === "sur-la-bande" && a.sceneId === "s10")).toBe(true);
  });
});

describe("controlerStoryboard : tout ensemble", () => {
  it("alertes attendues et note au plus 60", () => {
    const sb = storyboardPropre();
    sb.chapitres[1].titre = "Chapitre 2";
    sb.chapitres[1].debutMs = 35_000;
    sb.scenes = [
      { ...base("a1", "c1", 0, 5000), type: "phrase-cle", phrase: "Une idée", motCle: null, forme: "coche" },
      { ...base("a2", "c1", 5000, 25_000), type: "phrase-cle", phrase: "Une autre", motCle: null, forme: "coche" },
      { ...base("a3", "c1", 25_000, 30_000), type: "phrase-cle", phrase: "Encore", motCle: null, forme: "coche" },
      { ...base("a4", "c2", 31_200, 41_000), type: "phrase-cle", phrase: "Toujours", motCle: null, forme: "coche" },
    ];
    const poser: PoserScene = (s) => [
      { ...texte(`${s.id}-t`, 300, 40), couleur: "orange" },
      { ...texte(`${s.id}-bande`, 880, 60), rect: { x: 200, y: 880, largeur: 600, hauteur: 80 } },
    ];
    const c = controlerStoryboard(sb, { scene: poser, sousTitre: sousTitreSain });
    const present = new Set(c.alertes.map((a) => a.code));
    for (const code of ["sur-la-bande", "image-vide", "texte-trop-petit", "titre-generique", "fin-absente", "chapitre-court", "couleur-hors-charte", "monotonie", "scene-figee", "carton-absent"] as const)
      expect(present, code).toContain(code);
    expect(c.note).toBeLessThanOrEqual(60);
  });
  it("est pur : mêmes entrées, même sortie", () => {
    const sb = storyboardPropre();
    expect(controlerStoryboard(sb, sain)).toEqual(controlerStoryboard(sb, sain));
  });
});

describe("alertesQualiteDepuisControle", () => {
  it("traduit vers les codes communs, jamais « bloquant »", () => {
    const sb = storyboardPropre();
    sb.chapitres[1].titre = "Chapitre 2";
    sb.scenes = sb.scenes.slice(0, -1);
    sb.scenes[sb.scenes.length - 1] = { ...sb.scenes[sb.scenes.length - 1], finMs: sb.dureeMs };
    sb.sousTitres = [{ texte: "un deux trois quatre cinq six sept huit neuf dix onze douze", debutMs: 10_000, finMs: 13_000 }];
    const alertes = alertesQualiteDepuisControle(controlerStoryboard(sb, sain));
    expect(alertes.length).toBeGreaterThan(0);
    expect(alertes.every((a) => a.gravite === "attention" || a.gravite === "info")).toBe(true);
    const c = alertes.map((a) => a.code);
    expect(c).toEqual(expect.arrayContaining(["fin", "defaut-visuel", "vitesse-lecture"]));
    expect(alertesQualiteDepuisControle({ note: 100, criteres: controlerStoryboard(sb, sain).criteres, alertes: [] })).toEqual([]);
  });
});

/* ---------- Banc images ---------- */

describe("banc images : analyse pure", () => {
  const L = 480;
  const H = 270;
  const uni = (r: number, v: number, b: number) => {
    const t = new Uint8Array(L * H * 3);
    for (let i = 0; i < L * H; i++) t.set([r, v, b], i * 3);
    return t;
  };
  it("fond uni : part nulle", () => expect(partNonFond(uni(250, 249, 245), L, H)).toBe(0));
  it("un bloc de texte : part mesurée, bande des sous-titres ignorée", () => {
    const t = uni(250, 249, 245);
    for (let y = 0; y < 27; y++) for (let x = 0; x < 480; x++) t.set([20, 20, 19], (y * L + x) * 3); // 10 % de 270, tout au-dessus de 225
    expect(partNonFond(t, L, H)).toBeCloseTo(27 / 225, 3);
    for (let y = 230; y < 270; y++) for (let x = 0; x < 480; x++) t.set([0, 0, 0], (y * L + x) * 3);
    expect(partNonFond(t, L, H)).toBeCloseTo(27 / 225, 3);
  });
  it("repère les passages vides de plus d'une seconde seulement", () => {
    const parts = [0.2, 0.2, 0.01, 0.01, 0.01, 0.01, 0.01, 0.2, 0.01, 0.01, 0.01, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0];
    expect(reperesVides(parts, 4)).toEqual([
      { debutS: 0.5, finS: 1.75 },
      { debutS: 3, finS: 4.25 },
    ]);
    expect(reperesVides([0.2, 0.02, 0.02, 0.02, 0.02, 0.2], 4)).toEqual([]);
  });
});

const ffmpegLa = existsSync("/usr/bin/ffmpeg");
describe.skipIf(!ffmpegLa)("banc images : vraies vidéos ffmpeg", () => {
  const dossier = mkdtempSync(join(tmpdir(), "quall4-"));
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));
  const generer = (nom: string, source: string) => {
    const f = join(dossier, nom);
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", source, "-t", "3", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-y", f]);
    return f;
  };
  it("ivoire uni : vide ; mire : pleine", async () => {
    const uniF = await analyserVideo(generer("ivoire.mp4", "color=c=0xFAF9F5:s=320x180:r=10"));
    const mireF = await analyserVideo(generer("mire.mp4", "testsrc=s=320x180:r=10"));
    expect(uniF.length).toBeGreaterThanOrEqual(11);
    expect(reperesVides(uniF)).toHaveLength(1);
    expect(Math.max(...uniF)).toBeLessThan(0.03);
    expect(reperesVides(mireF)).toEqual([]);
    expect(Math.min(...mireF)).toBeGreaterThan(0.3);
  }, 60_000);
});
