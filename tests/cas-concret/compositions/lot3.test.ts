/**
 * Lot 3 des compositions « Cas concret MD » (R3) : types `etape` et `objet`, vrai écran dans un téléphone, six objets
 * de la vidéo 1 (`telephone-capture`, `telephone-notification`, `pile-notifications`, `chrono`, `contrat-signature`,
 * `dossier-classe`). Les tests appellent les plans purs et lisent les fichiers comme du texte (aucun `.tsx` importé).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boiteDans, imagesEcran, proprietesEcrans, sansBalises, type CaptureEcran, type EcranCale, type ProprietesEcran, type VisuelCale } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { exempleEcran, ZONE_QUATRE_RESEAUX } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { planChrono, valeurDemandee } from "../../../studio-rendu/compositions/cas-concret/plans/Chrono";
import { planContratSignature } from "../../../studio-rendu/compositions/cas-concret/plans/ContratSignature";
import { planDossierClasse } from "../../../studio-rendu/compositions/cas-concret/plans/DossierClasse";
import { planEtape } from "../../../studio-rendu/compositions/cas-concret/plans/Etape";
import { cadrer, planObjet, type ContexteObjet } from "../../../studio-rendu/compositions/cas-concret/plans/Objet";
import { planPileNotifications } from "../../../studio-rendu/compositions/cas-concret/plans/PileNotifications";
import { boiteCapture, imageDuFilm, planTelephoneCapture } from "../../../studio-rendu/compositions/cas-concret/plans/TelephoneCapture";
import { planTelephoneNotification } from "../../../studio-rendu/compositions/cas-concret/plans/TelephoneNotification";
import { DOSSIER, sansCommentaires } from "./outils";

type PEtape = Extract<ProprietesEcran, { type: "etape" }>;
type PObjet = Extract<ProprietesEcran, { type: "objet" }>;

const FICHIERS_R3 = ["Etape", "Objet", "TelephoneCapture", "TelephoneNotification", "PileNotifications", "Chrono", "ContratSignature", "DossierClasse"];
const SOURCES_R3 = FICHIERS_R3.flatMap((n) => [n === "Etape" || n === "Objet" ? `types/${n}.tsx` : `objets/${n}.tsx`, `plans/${n}.ts`]);

/** Les six étapes de la vidéo 1, sur le gabarit constant, avec leurs visuels (captures de la référence). */
const CAPTURES: Record<string, CaptureEcran> = {
  pub: { src: "pub.png", cle: "pub", sorte: "image", largeur: 1080, hauteur: 1350 },
  form: { src: "form.mp4", cle: "form", sorte: "video", largeur: 1080, hauteur: 1920, dureeSec: 6 },
  rdv: { src: "rdv.jpg", cle: "rdv", sorte: "page-entiere", largeur: 1080, hauteur: 4200 },
};
const ETAPES: { titre: string; ligne: string; visuel: VisuelCale; puces: string[]; fond: "sombre" | "ivoire"; duree: number }[] = [
  { titre: "*L'annonce*", ligne: "Elle la voit sur Facebook.", visuel: { capture: { cle: "pub" } }, puces: [], fond: "ivoire", duree: 1320 },
  { titre: "*L'inscription*", ligne: "Toute seule. En vingt secondes.", visuel: { capture: { cle: "form" } }, puces: ["Inscrite"], fond: "ivoire", duree: 1694 },
  { titre: "Les *e-mails*", ligne: "Ils partent tout seuls.", visuel: { objet: "pile-notifications", textes: ["C'est noté", "Votre échange vous attend"] }, puces: [], fond: "sombre", duree: 1880 },
  { titre: "Le *rendez-vous*", ligne: "Elle le choisit elle-même.", visuel: { capture: { cle: "rdv" } }, puces: ["Réservé sans nous"], fond: "ivoire", duree: 1687 },
  { titre: "La *visio*", ligne: "Là, c'est nous.", visuel: { objet: "chrono", textes: ["15", "minutes"] }, puces: [], fond: "sombre", duree: 2279 },
  { titre: "Le *contrat*", ligne: "Il part tout seul.", visuel: { objet: "contrat-signature" }, puces: ["Envoyé tout seul", "Signé"], fond: "ivoire", duree: 3468 },
];

function etapesVideo1(): PEtape[] {
  let debut = 13840;
  const ecrans: EcranCale[] = ETAPES.map((e, i) => {
    const c: EcranCale = { id: `e${String(i + 5).padStart(2, "0")}`, type: "etape", numero: i + 1, nombreEtapes: ETAPES.length, titre: e.titre, ligne: e.ligne, visuel: e.visuel, puces: e.puces, fond: e.fond, debutMs: debut, finMs: debut + e.duree, evenements: [] };
    debut += e.duree;
    return c;
  });
  return proprietesEcrans({ ecrans, captures: CAPTURES, zoneProtegee: ZONE_QUATRE_RESEAUX }) as PEtape[];
}

function objetsVideo1(): PObjet[] {
  const ecrans: EcranCale[] = [
    { id: "e09", type: "objet", titre: "Elle *oublie ?*", ligne: "Le rappel part tout seul.", visuel: { objet: "telephone-notification", textes: ["Rappel : notre échange demain à 14:00"] }, fond: "sombre", debutMs: 20420, finMs: 22600, evenements: [{ cible: "notification", ms: 21300 }] },
    { id: "e13", type: "objet", titre: "Dossier *classé.*", visuel: { objet: "dossier-classe" }, fond: "sombre", debutMs: 29440, finMs: 30440, evenements: [] },
  ];
  return proprietesEcrans({ ecrans, captures: {}, zoneProtegee: ZONE_QUATRE_RESEAUX }) as PObjet[];
}

/** Images de début, de milieu et de fin d'un écran. */
const troisImages = (p: ProprietesEcran) => {
  const n = imagesEcran(p);
  return [0, Math.floor(n / 2), n - 1];
};

/** Contexte d'objet de test : une boîte, un instant, un fond. */
const contexte = (o: Partial<ContexteObjet> = {}): ContexteObjet => ({ boite: { x: 0, y: 0, largeur: 470, hauteur: 920 }, t: 0, tVideo: 0, fond: "ivoire", dureeEcran: 2, evenements: [], ...o });

const proportions = (b: { largeur: number; hauteur: number }) => b.largeur / b.hauteur;

describe("telephone-capture : la capture entière, jamais rognée", () => {
  const ecran = { largeur: 442, hauteur: 892 };

  it("la boîte de la capture garde ses proportions pour trois tailles d'image", () => {
    for (const [l, h] of [
      [1080, 1920],
      [1200, 628],
      [1080, 1350],
    ]) {
      for (const t of [0, 0.7, 1.9]) {
        const b = boiteCapture({ sorte: "image", largeur: l, hauteur: h }, ecran, t, 2);
        expect(proportions(b), `${l}×${h}`).toBeCloseTo(l / h, 9);
        // Entière : dans l'écran du téléphone.
        expect(boiteDans(b, { x: 0, y: 0, ...ecran }), `${l}×${h} à ${t} s`).toBe(true);
        // Cadrée en largeur dès qu'elle est moins haute que l'écran.
        if (h / l <= ecran.hauteur / ecran.largeur) expect(b.largeur).toBeCloseTo(ecran.largeur, 9);
      }
    }
  });

  it("page entière : cadrée en largeur, proportions gardées, elle défile du haut jusqu'au bas", () => {
    const c = { sorte: "page-entiere" as const, largeur: 1080, hauteur: 4200 };
    const debut = boiteCapture(c, ecran, 0, 1.7);
    const fin = boiteCapture(c, ecran, 1.7, 1.7);
    expect(debut.largeur).toBeCloseTo(ecran.largeur, 9);
    expect(proportions(debut)).toBeCloseTo(1080 / 4200, 9);
    expect(debut.y).toBe(-0);
    expect(fin.y + fin.hauteur).toBeCloseTo(ecran.hauteur, 6);
    let avant = 1;
    for (let t = 0; t <= 1.7; t += 0.04) {
      const y = boiteCapture(c, ecran, t, 1.7).y;
      expect(y).toBeLessThanOrEqual(avant + 1e-9);
      avant = y;
    }
  });

  it("film de frappe : entier, et la progression de l'écran pilote le temps du film", () => {
    const b = boiteCapture({ sorte: "video", largeur: 1080, hauteur: 1920 }, ecran, 1, 2);
    expect(proportions(b)).toBeCloseTo(1080 / 1920, 9);
    expect(boiteDans(b, { x: 0, y: 0, ...ecran })).toBe(true);
    expect(imageDuFilm(6, 0)).toBe(0);
    expect(imageDuFilm(6, 1)).toBe(149);
    expect(imageDuFilm(6, 0.5)).toBe(75);
    const p = (t: number) => planTelephoneCapture(contexte({ t, dureeEcran: 1.7, capture: { src: "f.mp4", sorte: "video", largeur: 1080, hauteur: 1920 }, dureeCaptureSec: 6 }));
    let avant = -1;
    for (let i = 0; i <= 42; i++) {
      const im = p(i / 25).capture!.imageFilm!;
      expect(im).toBeGreaterThanOrEqual(avant);
      avant = im;
    }
    expect(p(0).capture!.imageFilm).toBe(0);
    expect(p(1.7).capture!.imageFilm).toBe(149);
  });

  it("onde orange au point touché : à l'événement `onde`, ou à la fin de la frappe", () => {
    const capture = { src: "f.mp4", sorte: "video" as const, largeur: 1080, hauteur: 1920 };
    const avec = (t: number) => planTelephoneCapture(contexte({ t, capture, dureeCaptureSec: 4, evenements: [{ cible: "onde", ms: 500 }] })).onde;
    expect(avec(0.4).opacite).toBe(0);
    expect(avec(0.62).opacite).toBeGreaterThan(0.5);
    expect(avec(1.2).opacite).toBe(0);
    expect(avec(0.62).couleur).toBe(COULEURS_DUO.orangeVif);
    const sans = planTelephoneCapture(contexte({ t: 1.8, capture, dureeEcran: 2 }));
    expect(sans.onde.opacite).toBeGreaterThan(0);
    // Une image fixe n'a pas d'onde sans événement.
    expect(planTelephoneCapture(contexte({ t: 1.8, capture: { ...capture, sorte: "image" } })).onde.opacite).toBe(0);
  });

  it("le téléphone garde les proportions de la référence (470 × 920) et sans capture l'écran reste blanc", () => {
    for (const boite of [
      { x: 0, y: 0, largeur: 470, hauteur: 920 },
      { x: 0, y: 0, largeur: 820, hauteur: 700 },
      { x: 0, y: 0, largeur: 300, hauteur: 1000 },
    ]) {
      const t = planTelephoneCapture(contexte({ boite }));
      expect(proportions(t.corps)).toBeCloseTo(470 / 920, 9);
      expect(boiteDans(t.corps, boite)).toBe(true);
      expect(t.capture).toBeNull();
      expect(t.fondEcran).toBe(COULEURS_DUO.blanc);
    }
  });
});

describe("type etape", () => {
  it("le fil vaut 0 à l'étape 1 image 0 et 100 % à la dernière image de la dernière étape", () => {
    const e = etapesVideo1();
    expect(planEtape(e[0], 0).fil.fraction).toBe(0);
    const derniere = e[e.length - 1];
    expect(planEtape(derniere, imagesEcran(derniere) - 1).fil.fraction).toBe(1);
    // Il ne recule jamais d'une étape à l'autre.
    let avant = -1;
    for (const p of e)
      for (const i of troisImages(p)) {
        const f = planEtape(p, i).fil.fraction;
        expect(f).toBeGreaterThanOrEqual(avant);
        avant = f;
      }
    expect(planEtape(e[0], 0).fil.couleur).toBe(COULEURS_DUO.orangeVif);
  });

  it("gabarit constant : « Étape 0n », titre, ligne aux images de début, de milieu et de fin ; tous les mots opaques à la fin", () => {
    for (const p of etapesVideo1()) {
      const [debut, milieu, fin] = troisImages(p);
      for (const i of [debut, milieu, fin]) {
        const e = planEtape(p, i);
        expect(e.etiquette.texte).toBe(`Étape 0${p.numero}`);
        expect(e.titre.mots.map((m) => m.mot).join(" ")).toBe(sansBalises(p.titre));
        expect(e.ligne.pose.texte).toBe(p.ligne);
        expect(e.marque.texte).toBe("axion-ia.com");
      }
      expect(planEtape(p, debut).titre.mots.every((m) => m.opacite < 1)).toBe(true);
      const e = planEtape(p, fin);
      expect(e.titre.mots.every((m) => m.opacite === 1)).toBe(true);
      expect(e.ligne.opacite).toBe(1);
      expect(e.titre.mots.some((m) => m.accent)).toBe(true);
    }
  });

  it("aucun texte hors de la zone utile, visuel et fil dans la zone de dessin ; les puces surgissent et tiennent dans la zone", () => {
    for (const p of etapesVideo1()) {
      const fin = planEtape(p, imagesEcran(p) - 1);
      // B1c : le visuel (sans texte porteur de sens) et le fil peuvent aller jusqu'au bord de la zone de dessin.
      for (const b of [fin.marque.boite, fin.etiquette.boite, fin.titre.pose.boite, fin.ligne.pose.boite, ...fin.puces.map((x) => x.boite)]) expect(boiteDans(b, p.zone), p.id).toBe(true);
      for (const b of [fin.visuel.boite, fin.fil.boite]) expect(boiteDans(b, p.dessin!), p.id).toBe(true);
      expect(fin.titre.pose.tient, p.id).toBe(true);
      expect(fin.puces.map((x) => x.texte)).toEqual(p.puces);
      for (const pu of fin.puces) expect(pu.opacite).toBe(1);
      for (const pu of planEtape(p, 0).puces) expect(pu.opacite).toBe(0);
    }
  });

  it("le visuel : un vrai écran passe par le téléphone, un objet garde ses proportions", () => {
    const e = etapesVideo1();
    expect(e.map((p) => planEtape(p, 10).visuel.objet)).toEqual(["telephone-capture", "telephone-capture", "pile-notifications", "telephone-capture", "chrono", "contrat-signature"]);
    expect(proportions(planEtape(e[0], 10).visuel.boite)).toBeCloseTo(470 / 920, 9);
    expect(proportions(planEtape(e[5], 10).visuel.boite)).toBeCloseTo(620 / 800, 9);
    const ctx = planEtape(e[1], 10).visuel.contexte;
    expect(ctx.capture).toEqual({ src: "form.mp4", sorte: "video", largeur: 1080, hauteur: 1920 });
    expect(ctx.dureeCaptureSec).toBe(6);
    expect(ctx.dureeEcran).toBeCloseTo(1.694, 9);
    expect(planEtape(e[0], 0).visuel.opacite).toBe(0);
    expect(planEtape(e[0], imagesEcran(e[0]) - 1).visuel.opacite).toBe(1);
  });

  it("l'exemple du socle (téléphone sans capture) se dessine, déterministe", () => {
    const p = exempleEcran("etape") as PEtape;
    expect(JSON.stringify(planEtape(p, 30))).toBe(JSON.stringify(planEtape(p, 30)));
    expect(planEtape(p, 30).visuel.objet).toBe("telephone-capture");
  });
});

describe("type objet", () => {
  it("titre et ligne dans la zone utile, objet dans la zone de dessin, aux images de début, de milieu et de fin", () => {
    for (const p of objetsVideo1()) {
      for (const i of troisImages(p)) {
        const e = planObjet(p, i);
        expect(e.titre.mots.map((m) => m.mot).join(" ")).toBe(sansBalises(p.titre));
        expect(e.ligne?.pose.texte).toBe(p.ligne);
        for (const b of [e.marque.boite, e.titre.pose.boite, ...(e.ligne ? [e.ligne.pose.boite] : [])]) expect(boiteDans(b, p.zone), p.id).toBe(true);
        expect(boiteDans(e.visuel.boite, p.dessin!), p.id).toBe(true);
      }
      expect(planObjet(p, imagesEcran(p) - 1).titre.mots.every((m) => m.opacite === 1)).toBe(true);
    }
  });
});

describe("objets de la vidéo 1", () => {
  it("le chrono vaut la valeur demandée à la fin (et 0 au départ)", () => {
    for (const [valeur, attendu] of [
      ["15", 15],
      ["100", 100],
      ["7", 7],
    ] as const) {
      const c = (t: number) => planChrono(contexte({ t, fond: "sombre", boite: { x: 0, y: 0, largeur: 740, hauteur: 740 }, textes: [valeur, "minutes"] }));
      expect(c(0).valeur).toBe(0);
      expect(c(0).anneau.decalage).toBeCloseTo(c(0).anneau.circonference, 9);
      expect(c(2).valeur).toBe(attendu);
      expect(c(2).nombre.texte).toBe(String(attendu));
      expect(c(2).anneau.decalage).toBeCloseTo(0, 9);
      expect(c(2).nombre.echelle).toBe(1);
      expect(c(2).unite.texte).toBe("minutes");
    }
    // Au moment de l'événement, puis 0,55 s plus tard.
    const ev = (t: number) => planChrono(contexte({ t, textes: ["15"], evenements: [{ cible: "chrono", ms: 1000 }] })).valeur;
    expect(ev(1)).toBe(0);
    expect(ev(1.55)).toBe(15);
    expect(valeurDemandee(["Quinze"])).toBe(0);
    expect(valeurDemandee(["2,5 h"])).toBe(2.5);
  });

  it("chrono : le nombre et l'unité tiennent dans l'anneau", () => {
    const c = planChrono(contexte({ t: 2, fond: "sombre", textes: ["100", "secondes"] }));
    const dansAnneau = { x: c.anneau.centre.x - c.anneau.rayon, y: c.anneau.centre.y - c.anneau.rayon, largeur: 2 * c.anneau.rayon, hauteur: 2 * c.anneau.rayon };
    expect(boiteDans(c.nombre.boite, dansAnneau)).toBe(true);
    expect(boiteDans(c.unite.boite, dansAnneau)).toBe(true);
  });

  it("téléphone à notification : la notification tombe à son mot, le téléphone vibre puis se pose, le sujet tient dans la carte", () => {
    const n = (t: number, sujet = "Rappel : notre échange demain à 14:00") => planTelephoneNotification(contexte({ t, fond: "sombre", textes: [sujet], evenements: [{ cible: "notification", ms: 800 }] }));
    expect(n(0.5).carte.opacite).toBe(0);
    expect(n(0.5).rotation).toBe(0);
    expect(n(1.2).carte.opacite).toBe(1);
    expect(n(2).rotation).toBeCloseTo(0, 9);
    expect(n(1.2).carte.sujet.texte).toBe("Rappel : notre échange demain à 14:00");
    expect(n(1.2).heure.texte).toBe("09:41");
    const long = n(1.2, "Rappel : votre échange avec notre équipe est confirmé pour demain matin à neuf heures trente, à tout à l'heure");
    expect(long.carte.sujet.lignes.length).toBeLessThanOrEqual(3);
    const carte = long.carte.boite;
    expect(carte.y + carte.hauteur).toBeLessThanOrEqual(long.ecran.hauteur);
  });

  it("pile de notifications : une carte par sujet, l'une après l'autre, cochées", () => {
    const pile = (t: number) => planPileNotifications(contexte({ t, boite: { x: 0, y: 0, largeur: 820, hauteur: 600 }, textes: ["C'est noté", "Votre échange vous attend"] }));
    expect(pile(0).cartes.map((c) => c.sujet.texte)).toEqual(["C'est noté", "Votre échange vous attend"]);
    expect(pile(0).cartes.every((c) => c.opacite === 0)).toBe(true);
    expect(pile(0.6).cartes.map((c) => c.opacite)).toEqual([1, 0]);
    expect(pile(2).cartes.every((c) => c.opacite === 1 && c.coche.opacite === 1)).toBe(true);
    for (const c of pile(2).cartes) expect(boiteDans(c.boite, { x: 0, y: 0, largeur: 820, hauteur: 600 })).toBe(true);
    expect(planPileNotifications(contexte()).cartes).toHaveLength(2);
  });

  it("contrat : les lignes s'écrivent, la signature se trace en entier", () => {
    const c = (t: number) => planContratSignature(contexte({ t, evenements: [{ cible: "signature", ms: 1500 }] }));
    expect(c(0).lignes.every((l) => l.largeur === 0)).toBe(true);
    expect(c(0).signature.trace).toBe(0);
    expect(c(1.5).signature.trace).toBe(0);
    expect(c(3).signature.trace).toBe(1);
    expect(c(3).signature.decalage).toBe(0);
    expect(c(3).lignes[0].couleur).toBe(COULEURS_DUO.orange);
    expect(proportions(c(0).boite)).toBeCloseTo(620 / 800, 9);
  });

  it("dossier : la feuille descend, la coche surgit, tout reste dans la boîte", () => {
    const d = (t: number) => planDossierClasse(contexte({ t, boite: { x: 0, y: 0, largeur: 600, hauteur: 900 } }));
    expect(d(0).feuille.decalageY).toBe(0);
    expect(d(0).coche.opacite).toBe(0);
    expect(d(2).coche.opacite).toBe(1);
    const fin = d(2);
    expect(fin.feuille.boite.y + fin.feuille.decalageY + fin.feuille.boite.hauteur).toBeLessThanOrEqual(fin.boite.hauteur + 1e-9);
    for (const b of [fin.dos.boite, fin.onglet.boite, fin.avant.boite, fin.coche.boite]) expect(boiteDans(b, { x: 0, y: 0, largeur: fin.boite.largeur, hauteur: fin.boite.hauteur })).toBe(true);
  });

  it("cadrer garde les proportions et reste dans la place", () => {
    for (const r of [0.3, 1, 2.5]) {
      const b = cadrer(r, { x: 10, y: 20, largeur: 500, hauteur: 400 });
      expect(proportions(b)).toBeCloseTo(r, 9);
      expect(boiteDans(b, { x: 10, y: 20, largeur: 500, hauteur: 400 })).toBe(true);
    }
  });

  it("déterministe", () => {
    const ctx = contexte({ t: 0.9, textes: ["15"] });
    for (const f of [planChrono, planContratSignature, planDossierClasse, planPileNotifications, planTelephoneCapture, planTelephoneNotification]) expect(JSON.stringify(f(ctx))).toBe(JSON.stringify(f(ctx)));
  });
});

describe("fichiers de R3", () => {
  const lire = (f: string) => sansCommentaires(readFileSync(join(DOSSIER, f), "utf8"));

  it("aucune couleur en dur, aucun nom de couleur ni de police", () => {
    for (const f of SOURCES_R3) {
      const t = lire(f);
      expect(t.match(/#[0-9a-f]{3,8}\b/gi) ?? [], f).toEqual([]);
      expect(t.match(/rgba?\(|hsla?\(/g) ?? [], f).toEqual([]);
      expect(t.match(/["'`](black|white|red|orange|green|gray|grey)["'`]|\b(Anton|Inter|serif|sans-serif|Arial|Helvetica)\b/g) ?? [], f).toEqual([]);
    }
  });

  it("les plans sont purs ; les composants dessinent leur plan", () => {
    for (const n of FICHIERS_R3) {
      const plan = lire(`plans/${n}.ts`);
      expect(plan, n).not.toMatch(/from\s+["'](remotion|react)["']/);
      expect(plan, n).toMatch(new RegExp(`export function plan${n}\\(`));
      const composant = lire(n === "Etape" || n === "Objet" ? `types/${n}.tsx` : `objets/${n}.tsx`);
      expect(composant, n).toContain(`plan${n}(`);
      expect(composant, n).not.toMatch(/ObjetProvisoire|EcranProvisoire/);
    }
  });

  it("aucun personnage, aucune silhouette", () => {
    for (const f of SOURCES_R3) expect(lire(f), f).not.toMatch(/personnage|silhouette|visage/i);
  });
});
