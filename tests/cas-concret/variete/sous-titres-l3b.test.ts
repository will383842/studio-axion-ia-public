/**
 * L3b · variété des sous-titres du cas concret (`sous-titres-variete.ts`, branchée dans `fabriquer.ts`) : aucune mise ou
 * tout « v4 » → appel strictement identique ; variations déterministes selon le tirage ; calme / vif autour de la v4
 * sans casser les règles ; « haute » reste dans la bande des sous-titres, jamais en haut ni sur un titre (#255).
 * Calcul pur et doubles seulement : aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { zonesEcran } from "@/briques/ecrans-motion";
import { controlerSousTitres, donneesCalque, elementDe, fabriquerSousTitres, type DemandeSousTitres } from "@/briques/sous-titres";
import type { SegmentSousTitres } from "@/domaine/types";
import { BANDE_SOUS_TITRES_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";
import { fabriquerCasConcret, LARGEUR_SOUS_TITRES_PCT, STYLE_SOUS_TITRES_DUO, zonesOccupeesSousTitres } from "@/moteurs/montage-cas-concret/fabriquer";
import type { OutilsVariete } from "@/moteurs/montage-cas-concret/outils";
import {
  centreSousTitresCasConcret,
  centreSousTitresHautPct,
  REGLAGES_SOUS_TITRES_CAS_CONCRET,
  SURLIGNAGE_CAS_CONCRET,
  surlignageCasConcret,
  variationSousTitresCasConcret,
  type TirageSousTitres,
} from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { mettre, tirer, TIRAGE_V4, type Mise, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import { centreSousTitresPleineImagePct } from "@/moteurs/montage-cas-concret/zone-objets";
import { doubles, type Doubles } from "../fabriquer/doubles";

const H = 1920;
const BANDE = zonesEcran(ZONE_PLEINE_IMAGE_CAS_CONCRET, 1080, H, BANDE_SOUS_TITRES_CAS_CONCRET).sousTitres;
const QUATRE = ["facebook", "instagram", "tiktok", "linkedin"] as const;

/** Texte réaliste d'un cas concret (corps + fin), ≈ 40 s. */
const TEXTE =
  "Une agence immobilière perdait 9 heures par semaine à répondre aux mêmes questions. Où est la visite ? Le bien est-il encore libre ? " +
  "Chaque soir, la gérante relisait 60 messages un par un. On a branché un assistant qui lit l'annonce et le planning. " +
  "Il répond tout de suite, propose un créneau, et ne transmet que les vraies demandes. Résultat : 9 heures gagnées, et aucune visite oubliée. " +
  "Vous voulez savoir ce que ça donnerait chez vous ? Le diagnostic est gratuit, le lien est en commentaire.";
const DUREE = 41;

const V4: TirageSousTitres = TIRAGE_V4.sousTitres;
const avec = (st: Partial<TirageSousTitres>): TirageSousTitres => ({ ...V4, ...st });

/** Demande de la v4, exactement comme `sousTitresDe` dans `fabriquer.ts` (hors variation). */
function demandeV4(centre = centreSousTitresPleineImagePct(), st?: TirageSousTitres): DemandeSousTitres {
  const style = { ...STYLE_SOUS_TITRES_DUO, positionPct: centre, largeurMaxPct: LARGEUR_SOUS_TITRES_PCT, ...surlignageCasConcret(st) };
  return { texte: TEXTE, dureeSec: DUREE, emphase: ["9 heures", "gratuit"], style, base: "minimal", occupe: zonesOccupeesSousTitres(DUREE), ratio: "9:16", reseaux: [...QUATRE] };
}
const sousTitres = (st?: TirageSousTitres) => fabriquerSousTitres({ ...demandeV4(centreSousTitresCasConcret(st), st), ...variationSousTitresCasConcret(st) });
const compte = (s: SegmentSousTitres[], f: (x: SegmentSousTitres) => boolean) => s.filter(f).length;
const impacts = (s: SegmentSousTitres[]) => s.flatMap((x, i) => (x.style === "impact" ? [i] : []));

describe("L3b · aucune mise ou tout « v4 » : la v4 exacte", () => {
  it("rien n'est ajouté à l'appel ni au style ; même centre", () => {
    for (const st of [undefined, null, V4]) {
      expect(variationSousTitresCasConcret(st)).toEqual({});
      expect(surlignageCasConcret(st)).toEqual({});
      expect(centreSousTitresCasConcret(st)).toBe(centreSousTitresPleineImagePct());
    }
  });

  it("segments identiques (toEqual) à l'appel sans paramètre, sur un texte réaliste", () => {
    const temoin = fabriquerSousTitres(demandeV4());
    expect(temoin.length).toBeGreaterThan(10);
    expect(sousTitres(undefined)).toEqual(temoin);
    expect(sousTitres(V4)).toEqual(temoin);
  });
});

describe("L3b · variations selon le tirage", () => {
  it("déterministes : même vidéo, mêmes sous-titres ; des vidéos différentes en donnent de différents", () => {
    const tirages = Array.from({ length: 24 }, (_, i) => tirer({ videoId: `video-l3b-${i}`, canaux: QUATRE, historique: [] }).sousTitres);
    const rendus = tirages.map((st) => JSON.stringify(sousTitres(st)));
    tirages.forEach((st, i) => expect(JSON.stringify(sousTitres(st))).toBe(rendus[i]));
    expect(tirages.every((st) => JSON.stringify(st) === JSON.stringify(tirer({ videoId: `video-l3b-${tirages.indexOf(st)}`, canaux: QUATRE, historique: [] }).sousTitres))).toBe(true);
    expect(new Set(rendus).size).toBeGreaterThan(2);
  });

  it("inverse : le premier Impact penche dans l'autre sens, mêmes groupes en Impact", () => {
    const v4 = sousTitres(V4);
    const inv = sousTitres(avec({ inclinaison: "inverse" }));
    expect(impacts(inv)).toEqual(impacts(v4));
    expect(Math.sign(inv[impacts(inv)[0]].inclinaison!)).toBe(-Math.sign(v4[impacts(v4)[0]].inclinaison!));
  });

  it("calme : moins d'accents ; vif : un peu plus ; jamais deux Impact de suite, écarts tenus", () => {
    const accents = (s: SegmentSousTitres[]) => compte(s, (x) => x.style !== "base") + compte(s, (x) => x.souligne != null);
    const v4 = sousTitres(V4);
    const calme = sousTitres(avec({ intensite: "calme" }));
    const vif = sousTitres(avec({ intensite: "vif" }));
    expect(accents(calme)).toBeLessThan(accents(v4));
    expect(accents(vif)).toBeGreaterThan(accents(v4));
    for (const [s, ecart] of [
      [calme, REGLAGES_SOUS_TITRES_CAS_CONCRET.calme.impactEcartSec],
      [v4, 6],
      [vif, REGLAGES_SOUS_TITRES_CAS_CONCRET.vif.impactEcartSec],
    ] as const) {
      const i = impacts(s);
      for (let k = 1; k < i.length; k++) {
        expect(i[k] - i[k - 1]).toBeGreaterThan(1);
        expect(s[i[k]].debutSec - s[i[k - 1]].debutSec).toBeGreaterThanOrEqual(ecart);
      }
    }
  });

  it("surlignage : l'orange de la charte dans le style, jamais sur un mot coloré", () => {
    expect(surlignageCasConcret(avec({ accent: "surlignage" }))).toEqual({ surlignage: { fond: "#F0703C", texte: "#15100C", fondClair: "#C2532A", texteClair: "#F4EFE7" } });
    const s = sousTitres(avec({ accent: "surlignage" }));
    // Le mot choisi est le même que le soulignement de la v4 : seul son dessin change.
    expect(s).toEqual(sousTitres(V4));
    for (const x of s.filter((y) => y.souligne != null)) expect(x.mots[x.souligne!].enValeur).toBeFalsy();
  });
});

describe("L3b · hauteur « haute » : dans la bande, jamais en haut ni sur un titre (#255)", () => {
  const TOUT: TirageSousTitres = { inclinaison: "inverse", intensite: "vif", accent: "surlignage", hauteur: "haute" };

  it("un peu plus haut que la v4, toujours dans la bande des sous-titres", () => {
    const haut = centreSousTitresHautPct();
    expect(centreSousTitresCasConcret(avec({ hauteur: "haute" }))).toBe(haut);
    expect(haut).toBeLessThan(centreSousTitresPleineImagePct());
    expect((haut / 100) * H).toBeGreaterThan(BANDE.y);
    expect((haut / 100) * H).toBeLessThan(BANDE.y + BANDE.hauteur);
  });

  it("chaque ligne de base tient entière dans la bande ; aucun groupe en haut ; contrôle « zone protégée » muet", () => {
    for (const st of [avec({ hauteur: "haute" }), TOUT, ...["calme", "vif"].map((i) => ({ ...TOUT, intensite: i as Tirage["sousTitres"]["intensite"] }))]) {
      const segments = sousTitres(st);
      expect(segments.some((x) => x.position === "haut")).toBe(false);
      expect(segments.filter((x) => x.style === "bandeau").every((x) => x.position === "bas")).toBe(true);
      const style = { ...STYLE_SOUS_TITRES_DUO, positionPct: centreSousTitresCasConcret(st), largeurMaxPct: LARGEUR_SOUS_TITRES_PCT, ...surlignageCasConcret(st) };
      const d = donneesCalque({ segments, base: "minimal", ratio: "9:16", reseaux: [...QUATRE], style });
      expect(d.positions.milieuPct).toBe(centreSousTitresHautPct());
      for (const s of segments.filter((x) => x.style === "base" || !x.style)) {
        const el = elementDe(d, s, s.finSec - 0.01);
        expect(el.yPx - (el.taillePx * 1.1) / 2).toBeGreaterThanOrEqual(BANDE.y - 0.5);
        expect(el.yPx + (el.taillePx * 1.1) / 2).toBeLessThanOrEqual(BANDE.y + BANDE.hauteur + 0.5);
      }
      expect(controlerSousTitres(d, { occupe: zonesOccupeesSousTitres(DUREE) }).filter((a) => a.code === "zone-protegee")).toEqual([]);
    }
  });
});

/** Outils de variété en mémoire, avec une mise héritée imposée. */
function variete(heritee: Mise): OutilsVariete {
  return { lireHistorique: async () => [], ajouter: async () => undefined, miseHeritee: async () => heritee };
}
type Calque = { texte: { sousTitres: { positions: { milieuPct: number }; surlignage?: unknown; segments: SegmentSousTitres[] } } };
const calques = (d: Doubles) => d.compositionsSoumises().map((c) => (c.parametres as Calque).texte.sousTitres);

describe("L3b · chaîne : du tirage au calque des sous-titres", () => {
  it("mise tout « v4 » : paramètres de composition identiques à ceux d'une fabrication sans variété", async () => {
    const temoin = doubles();
    await fabriquerCasConcret(temoin.options);
    const d = doubles();
    d.options.outils.variete = variete({ version: TIRAGE_V4.version, tirage: TIRAGE_V4, ecrans: {} });
    await fabriquerCasConcret(d.options);
    expect(d.compositionsSoumises().map((c) => c.parametres)).toEqual(temoin.compositionsSoumises().map((c) => c.parametres));
  });

  it("l'empreinte du montage suit la variation (même hauteur) ; en v4 elle reste celle d'avant", async () => {
    const ids = async (mise?: Mise) => {
      const d = doubles();
      if (mise) d.options.outils.variete = variete(mise);
      await fabriquerCasConcret(d.options);
      return d.compositionsSoumises().map((c) => c.idRendu);
    };
    const sans = await ids();
    expect(await ids({ version: TIRAGE_V4.version, tirage: TIRAGE_V4, ecrans: {} })).toEqual(sans);
    const surligne = await ids(mettre({ ...TIRAGE_V4, sousTitres: { ...TIRAGE_V4.sousTitres, accent: "surlignage" } }, []));
    const calme = await ids(mettre({ ...TIRAGE_V4, sousTitres: { ...TIRAGE_V4.sousTitres, intensite: "calme" } }, []));
    for (const autre of [surligne, calme]) autre.forEach((id, i) => expect(id).not.toBe(sans[i]));
    expect(calme).not.toEqual(surligne);
  });

  it("inverse + vif + surlignage + haute : le calque les reçoit, sans rien poser en haut", async () => {
    const tirage: Tirage = { ...TIRAGE_V4, sousTitres: { inclinaison: "inverse", intensite: "vif", accent: "surlignage", hauteur: "haute" } };
    const d = doubles();
    d.options.outils.variete = variete(mettre(tirage, []));
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fiche.mise?.tirage.sousTitres).toEqual(tirage.sousTitres);
    const cs = calques(d);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      expect(c.surlignage).toEqual(SURLIGNAGE_CAS_CONCRET);
      expect(c.positions.milieuPct).toBe(centreSousTitresHautPct());
      expect(c.segments.some((s) => s.position === "haut")).toBe(false);
      const premier = c.segments.find((s) => s.style === "impact");
      if (premier) expect(premier.inclinaison).toBeLessThan(0);
    }
  });
});
