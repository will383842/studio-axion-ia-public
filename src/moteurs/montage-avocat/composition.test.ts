/**
 * LOT M4 — paramètres de la composition avocat (PUR) : LUT par plan (plan > vidéo > visage > format, « aucune »),
 * décor (méthode hybride), double ancré en bas en 4:5 et 1:1, recadrage sans bord découvert en 9:16, encadré de
 * titre (2 lignes, sous les sous-titres, dans la zone libre), incrustations (bande 52-70 %, jamais pendant
 * l'encadré, montant dit = montant affiché), sous-titres sur décor clair, son et export.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import type { PlanProduit } from "../types";
import { coteContour, decorScene, largeurInter, lutDuPlan, montantDit, parametresComposition, partiesTitre, pausesDesMots, placerEncadre, placerIncrustations, plagesDesLuts } from "./composition";
import { controlesExport, noteDepuisAlertes } from "./controles";
import { basDuDoubleAuBas, DIMENSIONS_SCENE, planAuTemps, transformation, zoomAuTemps } from "./scene";
import { GEOMETRIE_INCRUSTATIONS_AVOCAT, REDUCTION_LARGE_AVOCAT } from "./recette-composition";

const MAINTENANT = "2026-10-02T08:00:00.000Z";
const decor = (id: string) => decorsCatalogue(MAINTENANT).find((d) => d.id === id)!;

function plan(ordre: number, de: number, a: number, extra: Partial<PlanProduit> = {}): PlanProduit {
  return { ordre, debutSec: de, finSec: a, texte: "texte", segmentId: `s${ordre}`, sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "trois-quarts", ...extra };
}

function commande(extra: Partial<CommandeFabrication> = {}): CommandeFabrication {
  const n1 = decor("decor-n1-halo-orange");
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-test",
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 12,
    ratios: ["9:16", "4:5", "1:1"],
    script: { blocs: [{ id: "b", blocRecette: "accroche", segments: [{ id: "s3", texte: "Un client a économisé 2 500 € comme ça." }] }], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1", lutIdVisage: "lut-visage" } } }],
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
    medias: {
      "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" },
      "lut-avocat-v1": { cle: "/luts/axion-buffer-clair-obscur.cube", mime: "application/octet-stream", tailleCube: 65 },
      "lut-visage": { cle: "/luts/axion-buffer-doux.cube", mime: "application/octet-stream", tailleCube: 65 },
      "illu-02": { cle: "/demo/illustrations/illu-02.jpg", mime: "image/jpeg" },
      "illu-09": { cle: "/demo/rushs/couloir.mp4", mime: "video/mp4" },
    },
    ...extra,
  } as CommandeFabrication;
}

const PLANS: PlanProduit[] = [
  plan(1, 0, 2.2, { texteEcran: { texte: "Amende : l'erreur que tout le monde fait", position: "centre", style: "encadre", positionPct: 60 } }),
  plan(2, 2.2, 4, { cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1.2, valeur: "poitrine" } }),
  plan(3, 4, 6, { sourceImage: "illustration", angle: undefined, illustration: { source: "bibliotheque", elementId: "illu-02", verrouille: true, candidats: [] } }),
  plan(4, 6, 9, { cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, zoomFin: 1.06, valeur: "large" }, texte: "Un client a économisé 2 500 € comme ça.", segmentId: "s3", incrustation: { type: "montant", texte: "+ 2 500 €", sens: "gain" } }),
  plan(5, 9, 12, { lutId: "aucune" }),
];
const SEGMENTS: SegmentSousTitres[] = [{ id: "g1", debutSec: 0.1, finSec: 0.8, mots: [{ mot: "Vous", debutSec: 0.1, finSec: 0.3 }, { mot: "recevez", debutSec: 0.3, finSec: 0.8 }] }];

describe("LUT par plan : plan > vidéo > visage > format, « aucune » possible", () => {
  it("défaut du format, remplacé par la LUT du visage sur les plans du double, jamais sur une illustration", () => {
    const c = commande();
    expect(lutDuPlan(c, PLANS[0])).toBe("lut-visage");
    expect(lutDuPlan(c, PLANS[2])).toBe("lut-avocat-v1");
    expect(lutDuPlan(c, PLANS[4])).toBeNull();
    expect(lutDuPlan(c, { ...PLANS[0], lutId: "lut-axion-nuit" })).toBe("lut-axion-nuit");
  });

  it("une LUT choisie par la vidéo passe devant celle du visage ; « Sans LUT » sur la vidéo coupe tout sauf le plan", () => {
    const video = commande({ styles: { ...commande().styles, lut: { id: "lut-axion-nuit", nom: "Nuit", intensite: 50, cible: ["personnage", "illustrations"], origine: "video" } } });
    expect(lutDuPlan(video, PLANS[0])).toBe("lut-axion-nuit");
    const sans = commande({ styles: { ...commande().styles, lut: { id: "aucune", nom: "Sans", intensite: 0, cible: ["personnage", "illustrations"], origine: "video" } } });
    expect(lutDuPlan(sans, PLANS[0])).toBeNull();
    expect(lutDuPlan(sans, { ...PLANS[0], lutId: "lut-axion-doux" })).toBe("lut-axion-doux");
    // Cible sans « illustrations » : l'illustration garde ses couleurs.
    const cible = commande({ styles: { ...commande().styles, lut: { ...commande().styles.lut!, cible: ["personnage"] } } });
    expect(lutDuPlan(cible, PLANS[2])).toBeNull();
  });

  it("plages de temps fusionnées par LUT, coupées sur les coupes", () => {
    const plages = plagesDesLuts(commande(), PLANS);
    expect(plages.get("lut-visage")).toEqual([[0, 4], [6, 9]]);
    expect(plages.get("lut-avocat-v1")).toEqual([[4, 6]]);
    expect([...plages.keys()]).not.toContain("aucune");
  });
});

describe("géométrie : recadrage 9:16, double ancré en bas en 4:5 et 1:1", () => {
  it("9:16 : le plan poitrine agrandit le composé à 120 % sans jamais découvrir un bord", () => {
    const p = { debutSec: 0, finSec: 3, cadrage: { valeur: "poitrine" as const, zoom: 1.2, zoomFin: 1.2, pointX: 0.5, pointY: 0.38 } };
    const t = transformation("9:16", p, 1);
    expect(t.conteneur.echelle).toBeCloseTo(1.2);
    expect(t.conteneur.x).toBeLessThanOrEqual(0);
    expect(t.conteneur.y).toBeLessThanOrEqual(0);
    expect(t.conteneur.x + 1080 * 1.2).toBeGreaterThanOrEqual(1080 - 1e-6);
    expect(t.conteneur.y + 1920 * 1.2).toBeGreaterThanOrEqual(1920 - 1e-6);
    // Point d'intérêt au bord : la fenêtre est bornée.
    const bord = transformation("9:16", { ...p, cadrage: { ...p.cadrage, pointY: 0.02 } }, 1);
    expect(bord.conteneur.y).toBe(-0);
  });

  it("zoom lent linéaire de 100 à 106 % sur la durée du plan ; coupes franches (un seul plan à la fois)", () => {
    const p = { debutSec: 2, finSec: 5, cadrage: { valeur: "large" as const, zoom: 1, zoomFin: 1.06, pointX: 0.5, pointY: 0.4 } };
    expect(zoomAuTemps(p, 2)).toBeCloseTo(1);
    expect(zoomAuTemps(p, 3.5)).toBeCloseTo(1.03);
    expect(zoomAuTemps(p, 5)).toBeCloseTo(1.06);
    expect(planAuTemps([{ debutSec: 0, finSec: 2 }, { debutSec: 2, finSec: 4 }], 2)).toEqual({ debutSec: 2, finSec: 4 });
  });

  it("4:5 et 1:1 : large = double réduit (≈ 85 % et 72 %), poitrine = 100 %, toujours ancré au bas de l'image", () => {
    for (const ratio of ["4:5", "1:1"] as const) {
      const H = DIMENSIONS_SCENE[ratio].hauteur;
      const large = { debutSec: 0, finSec: 3, cadrage: { valeur: "large" as const, zoom: 1, zoomFin: 1.06, pointX: 0.5, pointY: 0.4 } };
      const poitrine = { ...large, cadrage: { ...large.cadrage, valeur: "poitrine" as const, zoom: 1.2, zoomFin: 1.2 } };
      const tl = transformation(ratio, large, 0, REDUCTION_LARGE_AVOCAT);
      expect(tl.double.hauteur / H).toBeCloseTo(ratio === "4:5" ? 0.85 : 0.72, 2);
      expect(transformation(ratio, poitrine, 1, REDUCTION_LARGE_AVOCAT).double.hauteur).toBeCloseTo(H);
      for (const t of [0, 1.5, 3]) {
        expect(basDuDoubleAuBas(ratio, large, t, REDUCTION_LARGE_AVOCAT)).toBe(true);
        expect(basDuDoubleAuBas(ratio, poitrine, t, REDUCTION_LARGE_AVOCAT)).toBe(true);
      }
      // Centré horizontalement, décor étendu sur les côtés.
      expect(tl.double.gauche + tl.double.largeur / 2).toBeCloseTo(540);
    }
  });
});

describe("encadré de titre (B.2) et incrustations (B.2, B.7)", () => {
  const reseaux = formatAvocat.reseauxConseilles;

  it("thème « : » puis l'accroche en majuscules sur 2 lignes, ≤ 70 % de large, 80 px sous les sous-titres, au-dessus de la zone basse", () => {
    expect(partiesTitre("Amende : l'erreur que tout le monde fait")).toEqual({ theme: "Amende", accroche: "l'erreur que tout le monde fait" });
    const { encadre, alertes } = placerEncadre("Amende : l'erreur que tout le monde fait", "9:16", reseaux);
    // Comme la référence mesurée (« Contrôle Routier : / L'ERREUR QUE / TOUT LE MONDE FAIT ») : l'accroche sur 2 lignes.
    expect(encadre.lignes).toEqual(["Amende :", "L'ERREUR QUE TOUT", "LE MONDE FAIT"]);
    expect([0, 3]).toEqual([encadre.deSec, encadre.aSec]);
    expect(encadre.taillePx).toBeGreaterThanOrEqual(54);
    expect(encadre.taillePx).toBeLessThanOrEqual(58);
    for (const l of encadre.lignes) expect(largeurInter(l, encadre.taillePx)).toBeLessThanOrEqual(0.7 * 1080 - 2 * encadre.margeXPx);
    const hauteur = encadre.lignes.length * encadre.taillePx * 1.18 + 2 * encadre.margeYPx;
    const basSousTitres = 0.48 * 1920 + (70 * 1.1) / 2;
    expect(encadre.centreYPx - hauteur / 2).toBeGreaterThanOrEqual(basSousTitres + 80 - 1);
    expect(encadre.centreYPx + hauteur / 2).toBeLessThanOrEqual(0.7 * 1920 + 1);
    expect(alertes).toEqual([]);
  });

  it("au-delà de 8 mots ou 50 caractères : information non bloquante ; trop long pour 2 lignes : signalé", () => {
    const long = placerEncadre("Contrôle routier : la seule erreur que presque tout le monde commet sans le savoir", "9:16", reseaux);
    expect(long.alertes.map((a) => a.code)).toContain("chevauchement");
    expect(long.alertes.some((a) => a.gravite === "info")).toBe(true);
    expect(long.alertes.every((a) => a.gravite !== "bloquant")).toBe(true);
  });

  it("montant vert (gain) ou rouge (perte), dans la bande 52-70 %, jamais pendant l'encadré ; le montant dit est contrôlé", () => {
    expect(montantDit("+ 2 500 €", "Un client a économisé 2 500 € comme ça.")).toBe(true);
    expect(montantDit("67 000 €", "Il a perdu 6 700 €.")).toBe(false);
    const r = placerIncrustations([{ ...PLANS[3], debutSec: 2, finSec: 5 }], "9:16", reseaux, { encadreFinSec: 3, geometrie: GEOMETRIE_INCRUSTATIONS_AVOCAT });
    expect(r.incrustations).toHaveLength(1);
    const inc = r.incrustations[0];
    expect(inc.deSec).toBe(3);
    expect(inc.couleur).toBe("#34C26B");
    expect(inc.centreYPx).toBeGreaterThanOrEqual(0.52 * 1920);
    expect(inc.centreYPx + inc.taillePx / 2).toBeLessThanOrEqual(0.7 * 1920);
    const faux = placerIncrustations([{ ...PLANS[3], texte: "Il a gagné 300 €.", segmentId: "x", incrustation: { type: "montant", texte: "3 000 €", sens: "perte" } }], "9:16", reseaux, { geometrie: GEOMETRIE_INCRUSTATIONS_AVOCAT });
    expect(faux.alertes.map((a) => a.code)).toEqual(["montant"]);
    expect(faux.incrustations[0].couleur).toBe("#E5484D");
  });
});

describe("décor (méthode hybride) et contour", () => {
  it("fond neutre Axion : l'image du catalogue, déjà floue ; Look HeyGen simulé ou à vérifier : repli N1 et alerte", () => {
    const n1 = decorScene(commande());
    expect(n1.decor).toMatchObject({ image: "entree:decor", flouPx: 0, clair: false });
    expect(n1.entrees.decor).toBe("/demo/decors/fond-1-halo-orange.jpg");
    const r1 = decor("decor-r1-bureau-bois");
    const look = decorScene(commande({ styles: { ...commande().styles, decor: { id: r1.id, nom: r1.nom, valeur: r1.valeur as never } } }));
    expect(look.decor.teinte).toBe("#110A05");
    expect(look.alertes.map((a) => a.gravite)).toEqual(["info", "attention"]);
    const photo = decorScene(commande({ styles: { ...commande().styles, decor: { id: "decor-n1-halo-orange", nom: "Photo", valeur: { ...(decor("decor-n1-halo-orange").valeur as never as object), methode: "photo-incrustee", profondeurFlou: 0 } as never } } }));
    expect(photo.decor.flouPx).toBeGreaterThanOrEqual(12);
    expect(coteContour("gauche")).toBe("droite");
    expect(coteContour("face")).toBe("gauche");
  });
});

describe("paramètres complets d'un format", () => {
  it("9:16 : calques image et texte, entrées à signer, LUT à 70 %, grain et vignette, son −14 LUFS / −1,5 dBTP, export 14 Mb/s", () => {
    const p = parametresComposition(commande(), { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 12, audioCle: "studio/dev/audio.wav", mots: [{ mot: "a", debutSec: 0, finSec: 0.5 }, { mot: "b", debutSec: 0.9, finSec: 1.2 }] });
    expect(p.image).toMatchObject({ largeur: 1080, hauteur: 1920, fps: 25, images: 300, doubles: { principal: { type: "silhouette" } } });
    expect(p.image.plans.map((x) => x.type)).toEqual(["double", "double", "illustration", "double", "double"]);
    expect(p.image.plans[2].illustration).toEqual({ url: "entree:illu-3", video: false });
    expect(p.image.accessoire).toMatchObject({ x: 0.78, y: 0.3, largeurPct: 22, flouPx: 3 });
    expect(p.image.contour).toEqual({ couleur: "#C65A2E", cote: "gauche" });
    expect(p.entrees).toMatchObject({ decor: "/demo/decors/fond-1-halo-orange.jpg", "illu-3": "/demo/illustrations/illu-02.jpg", voix: "studio/dev/audio.wav" });
    expect(p.couleurs.luts.map((l) => [l.intensite, l.plages])).toEqual([[0.7, [[0, 4], [6, 9]]], [0.7, [[4, 6]]]]);
    expect(p.couleurs).toMatchObject({ grainPct: 4, grainTaillePx: 2, vignettePct: 8 });
    expect(p.son).toMatchObject({ lufs: -14, toleranceLufs: 1, creteVraieMaxDbtp: -1.5, tonPieceDb: -42.5, passeHautHz: 80, pauses: [[0.53, 0.87]] });
    expect(p.export).toEqual({ fps: 25, debitKbps: 14000, debitMaxKbps: 16000, audioKbps: 256, audioHz: 48000, mode: "crf", crf: 17 });
    expect(p.texte.encadre?.lignes).toHaveLength(3);
    expect(p.texte.incrustations).toHaveLength(1);
    expect(p.texte.sousTitres).toMatchObject({ largeur: 1080, hauteur: 1920, base: "karaoke", facteurOmbre: 1 });
    expect(p.texte.sousTitres?.plansPoitrine).toEqual([{ debutSec: 2.2, finSec: 4 }]);
  });

  it("4:5 et 1:1 : même vidéo recomposée à chaque taille, double ancré en bas, sous-titres recalculés", () => {
    for (const ratio of ["4:5", "1:1"] as const) {
      const p = parametresComposition(commande(), { ratio, plans: PLANS, segments: SEGMENTS, dureeSec: 12 });
      expect(p.image.hauteur).toBe(DIMENSIONS_SCENE[ratio].hauteur);
      expect(p.texte.sousTitres?.hauteur).toBe(DIMENSIONS_SCENE[ratio].hauteur);
      expect(p.alertes.map((a) => a.code)).not.toContain("zone-protegee");
      expect(p.texte.encadre!.centreYPx).toBeLessThan(DIMENSIONS_SCENE[ratio].hauteur);
    }
  });

  it("décor CLAIR (N5 Crème chaud) : ombre des sous-titres renforcée (contraste vérifié), signalé en information", () => {
    const n5 = decor("decor-n5-creme-chaud");
    const p = parametresComposition(commande({ styles: { ...commande().styles, decor: { id: n5.id, nom: n5.nom, valeur: n5.valeur as never } } }), { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 12 });
    expect(p.texte.sousTitres?.facteurOmbre).toBe(2);
    expect(p.alertes.some((a) => a.message.includes("Décor clair"))).toBe(true);
  });

  it("briques coupées : pas de LUT, pas de sous-titres, pas d'encadré ; double détouré réel quand il existe", () => {
    const c = commande({ briques: { ...commande().briques, etalonnage: false, "sous-titres": false }, styles: { ...commande().styles, habillage: null } });
    const p = parametresComposition(c, { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 12, pistesDouble: { "trois-quarts": "studio/dev/visages/double.webm" } });
    expect(p.couleurs.luts).toEqual([]);
    expect(p.texte.sousTitres).toBeUndefined();
    expect(p.texte.encadre).toBeUndefined();
    expect(p.image.doubles.principal).toEqual({ type: "video", url: "entree:double-principal", transparent: true });
    expect(p.entrees["double-principal"]).toBe("studio/dev/visages/double.webm");
    expect(pausesDesMots([{ mot: "a", debutSec: 0, finSec: 1 }, { mot: "b", debutSec: 1.05, finSec: 2 }])).toEqual([]);
  });
});

describe("contrôles sur le fichier exporté (B.8)", () => {
  const son = { lufs: -14, toleranceLufs: 1, creteVraieMaxDbtp: -1.5 };
  const bon = { lufs: -14.2, creteVraieDbtp: -2.1, pauseMinDb: -44, pauseMaxDb: -41, bt709: 1, plageTv: 1, yuv420p: 1, faststart: 1, imageNoireTete: 0, debitKbps: 14100, fps: 25 };

  it("un fichier conforme ne déclenche rien", () => {
    expect(controlesExport(bon, son, { debitKbps: 14000, debitMaxKbps: 16000, fps: 25 })).toEqual([]);
  });

  it("niveau hors ±1, crête au-delà de −1,5 dBTP, pauses hors −48/−35, étiquettes, lecture en ligne, image noire", () => {
    const a = controlesExport({ ...bon, lufs: -16.4, creteVraieDbtp: -0.8, pauseMinDb: -62, bt709: 0, faststart: 0, imageNoireTete: 1, fps: 30 }, son, { debitKbps: 14000, debitMaxKbps: 16000, fps: 25 });
    expect(a.map((x) => x.code)).toEqual(["niveau-sonore", "niveau-sonore", "niveau-sonore", "export", "export", "export", "image-noire"]);
    expect(noteDepuisAlertes(92, a)).toBe(92 - 3 * 6 - 1);
  });
});
