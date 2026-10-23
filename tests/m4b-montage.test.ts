/**
 * LOT M4b — corrections de la démonstration M4 et montage accéléré.
 *  1. un montant incrusté n'est jamais écrit deux fois (le groupe de sous-titres qui le dit est masqué) ;
 *  2. ouverture : l'encadré est au moins 80 px sous les sous-titres DESSINÉS (boîtes calculées, aucun chevauchement),
 *     en 9:16, 4:5 et 1:1, même avec un accent agrandi ; la ligne ne saute jamais au milieu d'un groupe ;
 *  3. micro dessiné : capsule entière dans l'image en plan large, poitrine 120 % et zoom lent ; pied jusqu'en bas ;
 *     migration (étape 11) seulement si la valeur du lot M0 n'a pas été touchée ;
 *  4. calques image dans FFmpeg (graphe PUR, puis un vrai rendu court) ; texte : une image par état ; export CRF ;
 *  5. concurrence adaptée aux cœurs ; Remotion Lambda écrit et ÉTEINT (aucun appel).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sceneAuTemps } from "@/briques/sous-titres/scene";
import type { CommandeFabrication, ElementBibliotheque, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, ACCESSOIRE_MICRO_V1, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { coutEstimeLambdaUsd, remotionLambdaConfigure } from "@/fournisseurs/rendu/montage";
import { basSousTitres, boiteEncadre, boiteGroupe, masquerMontantsDits, parametresComposition } from "@/moteurs/montage-avocat/composition";
import { boiteAccessoire, boiteCapsule, chevauchement, contenuDans, fenetreSource, planAuTemps, tailleAccessoire, type PlanScene, type ProprietesImageAvocat } from "@/moteurs/montage-avocat/scene";
import type { PlanProduit } from "@/moteurs/types";
import { argumentsExport, listeConcatTexte, modeExport } from "../studio-rendu/src/composition/ffmpeg";
import { argumentsImageFfmpeg, filtreRecadrage916, imageParFfmpeg, morceaux } from "../studio-rendu/src/composition/image-ffmpeg";
import { empreinteTexte, instantsTexte } from "../studio-rendu/src/composition/texte-instants";
import { concurrenceRendu, coeursDisponibles } from "../studio-rendu/src/remotion";
import { configLambda, rendreSurLambda, type ClientLambda } from "../studio-rendu/src/remotion-lambda";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { migrerDonnees } = await import("@/services/migrations");

const MAINTENANT = "2026-10-02T08:00:00.000Z";
const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

function plan(ordre: number, de: number, a: number, extra: Partial<PlanProduit> = {}): PlanProduit {
  return { ordre, debutSec: de, finSec: a, texte: "texte", segmentId: `s${ordre}`, sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "trois-quarts", ...extra };
}

function commande(extra: Partial<CommandeFabrication> = {}): CommandeFabrication {
  const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-m4b",
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 12,
    ratios: ["9:16", "4:5", "1:1"],
    script: { blocs: [{ id: "b", blocRecette: "preuve", segments: [{ id: "s4", texte: "Un client a économisé 2 500 € comme ça." }] }], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: { id: "lut-avocat-v1", nom: "Clair-obscur", intensite: 70, cible: ["personnage", "illustrations", "rushs", "decor", "accessoire"], origine: "format" },
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never },
    },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { active: false } as never,
    budgetMax: { centimes: 15000, devise: "EUR" },
    accessoires: [{ id: "acc-micro-podcast", nom: "Micro", valeur: ACCESSOIRE_MICRO }],
    profilRealisme: formatAvocat.profilRendu?.realisme,
    profilRendu: formatAvocat.profilRendu,
    recetteMontage: RECETTE_MONTAGE_AVOCAT,
    construiteLe: MAINTENANT,
    sousTitres: { base: "karaoke", intensite: "equilibre" },
    medias: { "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" }, "lut-avocat-v1": { cle: "/luts/axion-buffer-clair-obscur.cube", mime: "application/octet-stream", tailleCube: 65 } },
    ...extra,
  } as CommandeFabrication;
}

/** La démonstration du lot M4, en petit : accent agrandi « DE 135 € ? » pendant l'encadré, plan poitrine à 2,26 s. */
const PLANS: PlanProduit[] = [
  plan(1, 0, 2.26, { texteEcran: { texte: "Amende : l'erreur que tout le monde fait", position: "centre", style: "encadre", positionPct: 60 } }),
  plan(2, 2.26, 3.96, { cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1.2, valeur: "poitrine" } }),
  plan(3, 3.96, 6, { cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, zoomFin: 1.06, valeur: "large" } }),
  plan(4, 6, 8.5, { texte: "Un client a économisé 2 500 € comme ça.", segmentId: "s4", incrustation: { type: "montant", texte: "+ 2 500 €", sens: "gain" } }),
  plan(5, 8.5, 10, { cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1.2, valeur: "poitrine" } }),
];
const mot = (m: string, de: number, a: number, enValeur = false) => ({ mot: m, debutSec: de, finSec: a, enValeur });
const SEGMENTS: SegmentSousTitres[] = [
  { id: "g1", debutSec: 0, finSec: 0.9, mots: [mot("Vous", 0, 0.3), mot("recevez", 0.3, 0.6), mot("un", 0.6, 0.7), mot("PV", 0.7, 0.9)] },
  { id: "g2", debutSec: 0.9, finSec: 2.2, style: "impact", importance: 3, mots: [mot("de", 0.9, 1.1), mot("135", 1.1, 1.6, true), mot("€", 1.6, 1.8, true), mot("?", 1.8, 2.2)] },
  { id: "g3", debutSec: 2.26, finSec: 3.4, mots: [mot("Ne", 2.26, 2.5), mot("le", 2.5, 2.7), mot("payez", 2.7, 3.1), mot("pas", 3.1, 3.4)] },
  { id: "g4", debutSec: 3.4, finSec: 3.96, mots: [mot("tout", 3.4, 3.6), mot("de", 3.6, 3.7), mot("suite", 3.7, 3.96)] },
  { id: "g5", debutSec: 6, finSec: 7, mots: [mot("Un", 6, 6.2), mot("client", 6.2, 6.6), mot("a", 6.6, 6.7), mot("économisé", 6.7, 7)] },
  { id: "g6", debutSec: 7, finSec: 7.8, style: "impact", importance: 3, mots: [mot("2", 7, 7.2, true), mot("500", 7.2, 7.5, true), mot("€", 7.5, 7.8, true)] },
  { id: "g7", debutSec: 7.8, finSec: 8.5, mots: [mot("comme", 7.8, 8.1), mot("ça.", 8.1, 8.5)] },
  { id: "g8", debutSec: 8.5, finSec: 9.6, mots: [mot("Gardez", 8.5, 9), mot("cette", 9, 9.3), mot("vidéo", 9.3, 9.6)] },
];
const entree = (ratio: "9:16" | "4:5" | "1:1") => ({ ratio, plans: PLANS, segments: SEGMENTS, dureeSec: 10, pistesDouble: { "trois-quarts": "pistes/double.webm" } });

describe("défaut 1 : un montant n'est jamais écrit deux fois", () => {
  it("le groupe qui DIT le montant est masqué pendant l'incrustation ; les autres groupes restent", () => {
    const inc = [{ deSec: 6, aSec: 8.5, type: "montant" as const, texte: "+ 2 500 €" }];
    const restant = masquerMontantsDits(SEGMENTS, inc).map((s) => s.id);
    expect(restant).not.toContain("g6");
    expect(restant).toEqual(["g1", "g2", "g3", "g4", "g5", "g7", "g8"]);
    // Hors de l'incrustation, ou pour un autre nombre : rien n'est masqué.
    expect(masquerMontantsDits(SEGMENTS, [{ ...inc[0], deSec: 9, aSec: 10 }])).toHaveLength(SEGMENTS.length);
    expect(masquerMontantsDits(SEGMENTS, [{ ...inc[0], texte: "+ 3 000 €" }])).toHaveLength(SEGMENTS.length);
  });

  it("dans la composition de chaque format : aucun sous-titre ne montre « 2 500 » pendant l'incrustation", () => {
    for (const ratio of ["9:16", "4:5", "1:1"] as const) {
      const p = parametresComposition(commande(), entree(ratio));
      const incrustation = p.texte.incrustations.find((i) => i.type === "montant")!;
      expect(incrustation).toBeDefined();
      for (let t = incrustation.deSec; t < incrustation.aSec; t += 0.04) {
        const el = sceneAuTemps(p.texte.sousTitres!, t);
        expect(el?.mots.map((m) => m.texte).join(" ") ?? "").not.toMatch(/500/);
      }
      // Les sous-titres .srt (segments du lot M2) ne sont pas touchés : seule l'image change.
      expect(SEGMENTS.find((s) => s.id === "g6")).toBeDefined();
    }
  });
});

describe("défaut 2 : ouverture — l'encadré ne touche jamais les sous-titres", () => {
  for (const ratio of ["9:16", "4:5", "1:1"] as const) {
    it(`${ratio} : au moins 80 px sous le bas réel des sous-titres, image par image, et au-dessus de la zone basse`, () => {
      const p = parametresComposition(commande(), entree(ratio));
      const e = p.texte.encadre!;
      const boite = boiteEncadre(e, p.texte.largeur);
      const bas = basSousTitres(p.texte.sousTitres!, e.deSec, e.aSec, 25)!;
      expect(boite.haut - bas).toBeGreaterThanOrEqual(80 - 0.5);
      for (let i = 0; i < e.aSec * 25; i++) {
        const el = sceneAuTemps(p.texte.sousTitres!, i / 25);
        if (el) expect(chevauchement(boiteGroupe(el, p.texte.largeur), boite)).toBe(false);
      }
      expect(p.alertes.filter((a) => /trop près/.test(a.message))).toEqual([]);
      // Bas de l'encadré au-dessus de la limite basse (70 % en 9:16 avec Instagram).
      if (ratio === "9:16") expect(boite.haut + boite.hauteur).toBeLessThanOrEqual(0.7 * 1920 + 0.5);
    });
  }

  it("la ligne ne saute pas au milieu d'un groupe : un groupe commencé pendant l'encadré garde sa place ; après, la poitrine reprend", () => {
    const p = parametresComposition(commande(), entree("9:16"));
    const d = p.texte.sousTitres!;
    const y = (t: number) => sceneAuTemps(d, t)!.yPx;
    // g3 commence à 2,26 s (plan poitrine) pendant l'encadré et finit après 3 s : même hauteur avant et après 3 s.
    expect(y(2.9)).toBe(y(3.2));
    // g4 commence à 3,4 s, dans le même plan poitrine, après l'encadré : il descend sur la poitrine (51 %).
    expect(y(3.5)).toBeCloseTo(0.51 * 1920, 0);
    // g8 (plan poitrine à 8,5 s) : descente normale.
    expect(y(9)).toBeCloseTo(0.51 * 1920, 0);
  });
});

describe("défaut 3 : le micro dessiné est entier et reconnaissable", () => {
  const acc = { ...ACCESSOIRE_MICRO.positionParAngle["trois-quarts"]!, flouPx: ACCESSOIRE_MICRO.flouPx };
  it("capsule entière dans l'image en plan large, poitrine 120 % et zoom lent, dans les 3 formats ; pied jusqu'au bas du cadre", () => {
    const capsule = boiteCapsule(acc);
    const plans: PlanScene[] = [
      { debutSec: 0, finSec: 2, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } },
      { debutSec: 2, finSec: 4, type: "double", angle: "principal", cadrage: { valeur: "poitrine", zoom: 1.2, zoomFin: 1.2, pointX: 0.5, pointY: 0.38 } },
      { debutSec: 2, finSec: 4, type: "double", angle: "principal", cadrage: { valeur: "poitrine", zoom: 1.22, zoomFin: 1.22, pointX: 0.5, pointY: 0.38 } },
      { debutSec: 4, finSec: 8, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1.06, pointX: 0.5, pointY: 0.38 } },
    ];
    for (const ratio of ["9:16", "4:5", "1:1"] as const) for (const pl of plans) for (const t of [pl.debutSec, (pl.debutSec + pl.finSec) / 2, pl.finSec - 1e-3]) expect(contenuDans(capsule, fenetreSource(ratio, pl, t), 3 * acc.flouPx)).toBe(true);
    const b = boiteAccessoire(acc);
    expect(b.haut + b.hauteur).toBe(1920);
    // Du côté où regarde l'orateur (à droite), sans couvrir le visage (centre x ≈ 575 px dans le cadre source).
    expect(capsule.gauche).toBeGreaterThan(700);
    expect(ACCESSOIRE_MICRO.flouPx).toBeLessThanOrEqual(4);
    // Image de l'accessoire seul : paire, marge de flou, coin à gauche / au-dessus de la boîte.
    const t = tailleAccessoire(acc);
    expect(t.largeur % 2).toBe(0);
    expect(t.hauteur % 2).toBe(0);
    expect(t.x).toBeLessThan(b.gauche);
  });

  it("migration (étape 11) : le micro du lot M0 est replacé ; un micro modifié par Will n'est jamais réécrit", async () => {
    const d = reinitialiserDepots();
    await migrerDonnees(d, MAINTENANT);
    await d.elements.modifier("acc-micro-podcast", { valeur: ACCESSOIRE_MICRO_V1 });
    const r = await migrerDonnees(d, "2026-10-02T09:00:00.000Z");
    expect(r.microReplace).toBe(true);
    expect((await d.elements.obtenir("acc-micro-podcast"))?.valeur).toEqual(ACCESSOIRE_MICRO);
    const perso = { ...ACCESSOIRE_MICRO_V1, flouPx: 9 };
    await d.elements.modifier("acc-micro-podcast", { valeur: perso });
    const r2 = await migrerDonnees(d, "2026-10-02T10:00:00.000Z");
    expect(r2.microReplace).toBeUndefined();
    expect(((await d.elements.obtenir("acc-micro-podcast")) as ElementBibliotheque).valeur).toEqual(perso);
  });
});

describe("M4b : calques image dans FFmpeg (graphe PUR)", () => {
  const image = (ratio: "9:16" | "4:5" | "1:1"): ProprietesImageAvocat => parametresComposition(commande({ medias: { ...commande().medias, "illu-02": { cle: "/demo/illustrations/illu-02.jpg", mime: "image/jpeg" } } }), { ...entree(ratio), plans: [...PLANS.slice(0, 2), plan(3, 3.96, 6, { sourceImage: "illustration", angle: undefined, illustration: { source: "bibliotheque", elementId: "illu-02", verrouille: true, candidats: [] } }), ...PLANS.slice(3)] }).image;

  it("le double simulé (silhouette) reste au navigateur ; webm et image détourée passent par FFmpeg", () => {
    expect(imageParFfmpeg({ doubles: { principal: { type: "silhouette", tenue: "#000", peau: "#fff" } } })).toBe(false);
    expect(imageParFfmpeg({ doubles: { principal: { type: "video", url: "x.webm", transparent: true } } })).toBe(true);
    expect(imageParFfmpeg({ doubles: { principal: { type: "image", url: "x.png" } } })).toBe(true);
  });

  it("morceaux : une partition exacte des images, chaque image dans le plan que `planAuTemps` choisit", () => {
    const p = image("9:16");
    const m = morceaux(p.plans, p.images, p.fps);
    expect(m[0].debut).toBe(0);
    expect(m.at(-1)!.fin).toBe(p.images);
    for (let i = 1; i < m.length; i++) expect(m[i].debut).toBe(m[i - 1].fin);
    for (const x of m) for (let f = x.debut; f < x.fin; f++) expect(planAuTemps(p.plans, f / p.fps)).toBe(p.plans[x.index]);
  });

  it("recadrage 9:16 : poitrine 120 % = fenêtre 900 × 1600 au Lanczos ; zoom lent par zoompan ; 100 % : rien", () => {
    const p = image("9:16");
    expect(filtreRecadrage916(p.plans[1], { debut: 57, fin: 99 }, 25)).toBe("crop=900:1600:90:0,scale=1080:1920:flags=lanczos");
    expect(filtreRecadrage916(p.plans[0], { debut: 0, fin: 57 }, 25)).toBe("");
    const lent: PlanScene = { ...p.plans[0], cadrage: { ...p.plans[0].cadrage, zoom: 1, zoomFin: 1.06 } };
    expect(filtreRecadrage916(lent, { debut: 0, fin: 57 }, 25)).toMatch(/^zoompan=z='1\+0\.06\*clip\(/);
  });

  it("une seule passe : webm transparent lu par libvpx, liseré, accessoire, morceaux mis bout à bout, LUT, grain, master PCM", () => {
    const p = image("9:16");
    const args = argumentsImageFfmpeg(p, { grainPct: 4, grainTaillePx: 2, vignettePct: 8 }, { decor: "decor-pret.png", doubles: { principal: { fichier: "double.webm", video: true } }, accessoire: { fichier: "accessoire.png", x: 700, y: 560, largeur: 260, hauteur: 1380 }, illustrations: { 2: { fichier: "illu-02.jpg", video: false } }, luts: [{ fichier: "lut.cube", plages: [[0, 10]] }], son: "son.wav" }, 10, "master.mov");
    const texte = args.join(" ");
    expect(texte).toContain("-c:v libvpx-vp9 -i double.webm");
    expect(texte).toContain("lutrgb=r=198:g=90:b=46");
    expect(texte).toContain("overlay=x=700:y=560:format=gbrp");
    expect(texte).toContain(`concat=n=${morceaux(p.plans, p.images, 25).length}:v=1:a=0`);
    expect(texte).toContain("lut3d=file=lut.cube:interp=tetrahedral");
    expect(texte).toContain("blend=c0_mode=overlay");
    expect(texte).toContain("-c:a pcm_s24le");
    expect(texte).toContain("-preset ultrafast -crf 12");
    expect(args).not.toContain("-shortest");
    // 4:5 : le double est réduit (85 %) et ancré en bas ; 1:1 : 72 %.
    const a45 = argumentsImageFfmpeg(image("4:5"), { grainPct: 0, grainTaillePx: 2, vignettePct: 0 }, { doubles: { principal: { fichier: "double.webm", video: true } }, illustrations: {}, luts: [], son: "son.wav" }, 10, "m.mov").join(" ");
    expect(a45).toContain(`scale=${Math.round(1350 * 0.85 * (1080 / 1920))}:${Math.round(1350 * 0.85)}:flags=lanczos`);
    expect(a45).toContain(`overlay=x=${Math.round((1080 - 1350 * 0.85 * (1080 / 1920)) / 2)}:y=${Math.round(1350 - 1350 * 0.85)}:format=gbrp`);
  });

  it.skipIf(!ffmpegPresent)("vrai rendu court : exactement une image par image, 1080 × 1920, étiquettes BT.709, le liseré et le recadrage visibles", () => {
    const dossier = mkdtempSync(join(tmpdir(), "studio-m4b-"));
    const run = (args: string[]) => {
      const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { cwd: dossier });
      if (r.status !== 0) throw new Error(r.stderr.toString());
    };
    // Double d'essai : un rectangle opaque au centre d'une image transparente, webm VP9 avec alpha (2 s).
    run(["-f", "lavfi", "-i", "color=c=0x334455@0.0:s=1080x1920:r=25:d=2,format=yuva420p,drawbox=x=340:y=600:w=400:h=1000:color=0xC4967A@1:t=fill:replace=1", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "double.webm"]);
    run(["-f", "lavfi", "-i", "color=c=0x110A05:s=1080x1920", "-frames:v", "1", "decor-pret.png"]);
    run(["-f", "lavfi", "-i", "sine=f=220:d=2.1:sample_rate=48000", "son.wav"]);
    const p: ProprietesImageAvocat = {
      ratio: "9:16",
      largeur: 1080,
      hauteur: 1920,
      fps: 25,
      images: 50,
      decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
      doubles: { principal: { type: "video", url: "entree:double", transparent: true } },
      contour: { couleur: "#C65A2E", cote: "gauche" },
      plans: [
        { debutSec: 0, finSec: 1, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } },
        { debutSec: 1, finSec: 2, type: "double", angle: "principal", cadrage: { valeur: "poitrine", zoom: 1.2, zoomFin: 1.2, pointX: 0.5, pointY: 0.38 } },
      ],
    };
    run(argumentsImageFfmpeg(p, { grainPct: 0, grainTaillePx: 2, vignettePct: 0 }, { decor: "decor-pret.png", doubles: { principal: { fichier: "double.webm", video: true } }, illustrations: {}, luts: [], son: "son.wav" }, 2, "master.mov").slice(2));
    const probe = JSON.parse(spawnSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v", "-show_entries", "stream=nb_read_frames,width,height,color_primaries,color_space", "-of", "json", join(dossier, "master.mov")]).stdout.toString()).streams[0];
    expect(probe).toMatchObject({ nb_read_frames: "50", width: 1080, height: 1920, color_primaries: "bt709", color_space: "bt709" });
    const pixel = (t: number, x: number, y: number) => [...spawnSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", join(dossier, "master.mov"), "-frames:v", "1", "-vf", `format=rgb24,crop=1:1:${x}:${y}`, "-f", "rawvideo", "-"]).stdout];
    // Plan large : bord gauche du double à x = 340 ; le liseré orange (2 px à gauche) est à x = 338-339.
    const lisere = pixel(0.5, 339, 1000);
    expect(lisere[0]).toBeGreaterThan(150);
    expect(lisere[2]).toBeLessThan(90);
    // Plan poitrine (120 %) : le bord du double s'est déplacé à (340 − 90) × 1,2 = 300 px ; à 330 px, c'est le double.
    const peau = pixel(1.5, 330, 1000);
    expect(peau[0]).toBeGreaterThan(160);
    const fond = pixel(0.5, 330, 1000);
    expect(fond[0]).toBeLessThan(60);
  }, 120_000);
});

describe("M4b : calques texte (une image par état) et export", () => {
  it("chaque image de la vidéo est dessinée à l'identique par l'image rendue qui la représente ; beaucoup moins d'images", () => {
    const p = parametresComposition(commande(), entree("9:16"));
    const { instants, durees } = instantsTexte(p.texte);
    expect(durees.reduce((a, b) => a + b, 0)).toBe(p.texte.images);
    expect(instants.length).toBeLessThan(p.texte.images / 2);
    let f = 0;
    for (const [i, t] of instants.entries()) {
      for (let k = 0; k < durees[i]; k++, f++) expect(empreinteTexte(p.texte, f / 25)).toBe(empreinteTexte(p.texte, t));
    }
  });

  it("liste `concat` (durées exactes, dernière image répétée) ; export CRF 17 plafonné à 16 Mb/s en UNE passe ; 2 passes sur demande", () => {
    expect(listeConcatTexte(["t-000000.png", "t-000001.png"], [3, 47], 25)).toBe("ffconcat version 1.0\nfile 't-000000.png'\nduration 0.120000\nfile 't-000001.png'\nduration 1.880000\nfile 't-000001.png'\n");
    const e = { fps: 25, debitKbps: 14000, debitMaxKbps: 16000, audioKbps: 256, audioHz: 48000, mode: "crf" as const, crf: 17 };
    const a = argumentsExport("master.mov", "texte/liste.txt", e, "passe", "video.mp4");
    expect(a.passe1).toEqual([]);
    const t = a.passe2.join(" ");
    expect(t).toContain("-f concat -safe 0 -i texte/liste.txt");
    expect(t).toContain("[1:v]format=gbrap[t]");
    expect(t).not.toContain("fps=25");
    expect(argumentsExport("m.mov", "liste.txt", e, "p", "v.mp4", 6).passe2.join(" ")).toMatch(/^-hide_banner -y -filter_complex_threads 6 .* -threads 6 /);
    expect(t).toContain("-preset faster -profile:v high -level:v 4.1 -crf 17 -maxrate 16000k -bufsize 24000k");
    expect(t).toContain("-c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart");
    expect(modeExport(e, { STUDIO_RENDU_EXPORT: "2-passes" })).toBe("2-passes");
    expect(modeExport({}, {})).toBe("2-passes");
    expect(argumentsExport("m.mov", "texte/texte.mov", e, "p", "v.mp4").passe2.join(" ")).toContain("-i texte/texte.mov");
  });

  it.skipIf(!ffmpegPresent)("vrai export depuis la liste : la bonne image de texte au bon instant, exactement 50 images", () => {
    const dossier = mkdtempSync(join(tmpdir(), "studio-m4b-texte-"));
    const run = (args: string[]) => {
      const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { cwd: dossier });
      if (r.status !== 0) throw new Error(r.stderr.toString());
    };
    run(["-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=25:d=2", "-f", "lavfi", "-i", "sine=f=220:d=2.1:sample_rate=48000", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-pix_fmt", "yuv420p", "-c:a", "pcm_s24le", "master.mov"]);
    run(["-f", "lavfi", "-i", "color=c=0xFF0000@1:s=1080x1920", "-frames:v", "1", "t-000000.png"]);
    run(["-f", "lavfi", "-i", "color=c=0x00FF00@1:s=1080x1920", "-frames:v", "1", "t-000001.png"]);
    writeFileSync(join(dossier, "liste.txt"), listeConcatTexte(["t-000000.png", "t-000001.png"], [13, 37], 25));
    const e = { fps: 25, debitKbps: 14000, debitMaxKbps: 16000, audioKbps: 256, audioHz: 48000, mode: "crf" as const, crf: 17 };
    run(argumentsExport("master.mov", "liste.txt", e, "passe", "video.mp4").passe2.slice(2));
    const n = spawnSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", join(dossier, "video.mp4")]).stdout.toString().trim();
    expect(n).toBe("50");
    const image = (i: number) => [...spawnSync("ffmpeg", ["-v", "error", "-i", join(dossier, "video.mp4"), "-vf", `select=eq(n\\,${i}),format=rgb24,crop=1:1:540:960`, "-frames:v", "1", "-f", "rawvideo", "-"]).stdout];
    expect(image(12)[0]).toBeGreaterThan(200);
    expect(image(13)[1]).toBeGreaterThan(200);
    expect(image(13)[0]).toBeLessThan(60);
    expect(readFileSync(join(dossier, "liste.txt"), "utf8")).toContain("duration 0.520000");
  }, 60_000);
});

describe("M4b : cœurs, concurrence, Remotion Lambda éteint", () => {
  it("cœurs du conteneur lus dans le quota (cpus: 6 → 6) ; navigateur : la moitié, de 1 à 4 ; la variable l'impose", () => {
    expect(coeursDisponibles(() => "600000 100000\n", 8)).toBe(6);
    expect(coeursDisponibles(() => "max 100000\n", 8)).toBe(8);
    expect(coeursDisponibles(() => null, 12)).toBe(12);
    expect(coeursDisponibles(() => "200000 100000", 8)).toBe(2);
    expect(concurrenceRendu({}, 6)).toBe(3);
    expect(concurrenceRendu({}, 12)).toBe(4);
    expect(concurrenceRendu({}, 2)).toBe(1);
    expect(concurrenceRendu({ STUDIO_RENDU_CONCURRENCE: "2" }, 12)).toBe(2);
    expect(concurrenceRendu({ STUDIO_RENDU_CONCURRENCE: "" }, 8)).toBe(4);
  });

  it("éteint par défaut : aucune configuration sans REMOTION_LAMBDA_ACTIVE=true ET toutes les variables ; pas inscrit au registre", () => {
    const complet = { REMOTION_LAMBDA_ACTIVE: "true", REMOTION_LAMBDA_REGION: "eu-central-1", REMOTION_LAMBDA_FONCTION: "remotion-render", REMOTION_LAMBDA_SITE: "https://site", AWS_ACCESS_KEY_ID: "a", AWS_SECRET_ACCESS_KEY: "b" };
    expect(configLambda({})).toBeNull();
    expect(configLambda({ ...complet, REMOTION_LAMBDA_ACTIVE: "false" })).toBeNull();
    expect(configLambda({ ...complet, AWS_SECRET_ACCESS_KEY: "" })).toBeNull();
    expect(configLambda(complet)).toMatchObject({ region: "eu-central-1", fonction: "remotion-render", site: "https://site" });
    expect(remotionLambdaConfigure({})).toBe(false);
    expect(remotionLambdaConfigure(complet)).toBe(true);
    // 45 s en 3 formats ≈ 9 centimes de dollar (estimation à recaler sur le coût mesuré).
    expect(coutEstimeLambdaUsd(45, 3)).toBe(9);
  });

  it("rendu sur Lambda (client simulé) : ProRes 4444 transparent, suivi jusqu'à la fin, sortie téléchargée, coût relevé ; échec → réessayable", async () => {
    const appels: string[] = [];
    let tour = 0;
    const client: ClientLambda = {
      async renderMediaOnLambda(o) {
        appels.push(`rendu ${o.composition} ${o.codec} ${o.proResProfile} ${o.privacy}`);
        return { renderId: "r1", bucketName: "b1" };
      },
      async getRenderProgress() {
        tour++;
        return { overallProgress: tour / 3, done: tour >= 3, outputFile: tour >= 3 ? "https://s3.eu-central-1.amazonaws.com/b1/renders/r1/out.mov" : null, fatalErrorEncountered: false, errors: [], costs: { accruedSoFar: 0.012, currency: "USD" } };
      },
      async presignUrl(o) {
        appels.push(`signe ${o.objectKey}`);
        return "https://signee";
      },
    };
    const config = configLambda({ REMOTION_LAMBDA_ACTIVE: "true", REMOTION_LAMBDA_REGION: "eu-central-1", REMOTION_LAMBDA_FONCTION: "f", REMOTION_LAMBDA_SITE: "https://site", AWS_ACCESS_KEY_ID: "a", AWS_SECRET_ACCESS_KEY: "b" })!;
    const telecharges: string[] = [];
    const r = await rendreSurLambda(config, client, { composition: "AvocatTexte", inputProps: {}, transparent: true }, "texte.mov", { attendre: async () => undefined, telecharger: async (url, chemin) => void telecharges.push(`${url} → ${chemin}`) });
    expect(appels).toEqual(["rendu AvocatTexte prores 4444 private", "signe renders/r1/out.mov"]);
    expect(telecharges).toEqual(["https://signee → texte.mov"]);
    expect(r.coutUsd).toBe(0.012);
    const echec: ClientLambda = { ...client, async getRenderProgress() { return { overallProgress: 0, done: false, outputFile: null, fatalErrorEncountered: true, errors: [{ message: "délai dépassé" }], costs: { accruedSoFar: 0, currency: "USD" } }; } };
    await expect(rendreSurLambda(config, echec, { composition: "AvocatTexte", inputProps: {}, transparent: true }, "x.mov", { attendre: async () => undefined })).rejects.toMatchObject({ erreur: { reessayable: true } });
  });
});
