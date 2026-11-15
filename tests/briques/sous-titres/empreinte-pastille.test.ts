/**
 * C2-U2 : l'animation du mot dit de la Pastille (`echelle`, `monteePx`) entre dans l'empreinte du texte.
 * (a) éteint = identique : pour tout style sans ces deux champs, l'empreinte est celle d'avant, octet pour octet ;
 * (b) Pastille : deux instants de l'arrivée d'un mot donnent deux empreintes différentes (égales avant) ;
 * (c) `instantsTexte` de la Pastille rend plus d'images qu'avant, et la somme des durées reste égale à `images`.
 */
import { describe, expect, it } from "vitest";
import { empreinteTexte, instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { encadreVisible, incrustationsAuTemps } from "../../../src/briques/composition/scene";
import { donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import { PASTILLE_AXION } from "@/briques/sous-titres/pastille";
import { sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { GabaritSousTitres, ValeurStyleSousTitres } from "@/domaine/types";
import { SURLIGNAGE_CAS_CONCRET } from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { STYLE_SOUS_TITRES_ENCRE } from "@/moteurs/montage-tableau/sous-titres-tableau";

const PHRASE = "Votre patron peut-il lire vos mails ? Oui, mais jamais les mails personnels. Il faut trois jours pour vérifier.";
const MOTS = PHRASE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(0.5 + i * 0.3).toFixed(3), finSec: +(0.5 + i * 0.3 + 0.26).toFixed(3) }));
const DUREE = +(MOTS.at(-1)!.finSec + 0.4).toFixed(3);
const FPS = 30;
const IMAGES = Math.ceil(DUREE * FPS);

type P = Parameters<typeof empreinteTexte>[0];

/** Copie de la formule de `master` (ligne 24 de texte-instants.ts avant C2-U2). */
function ancienneEmpreinte(p: P, t: number): string {
  const el = p.sousTitres ? sceneAuTemps(p.sousTitres, t) : null;
  const sous = el
    ? [el.cle, el.taillePx, +el.yPx.toFixed(2), el.rotationDeg, +el.echelle.toFixed(4), +el.opacite.toFixed(4), +el.decalageYPx.toFixed(2), el.mots.map((m) => [m.texte, m.couleur, +m.opacite.toFixed(4), +m.souligne.toFixed(4)])]
    : null;
  const inc = incrustationsAuTemps(p.incrustations, t).map((i) => p.incrustations.indexOf(i));
  return JSON.stringify([sous, encadreVisible(p.encadre, t), inc]);
}

function nombreImagesAvant(d: DonneesCalque): number {
  let n = 0;
  let precedente: string | null = null;
  for (let i = 0; i < IMAGES; i++) {
    const e = ancienneEmpreinte({ sousTitres: d, encadre: undefined, incrustations: [] }, i / FPS);
    if (e !== precedente) n++;
    precedente = e;
  }
  return n;
}

const style = (gabarit: GabaritSousTitres, plus: Partial<ValeurStyleSousTitres> = {}): ValeurStyleSousTitres => ({ ...STYLE_SOUS_TITRES_AVOCAT, gabarit, ...plus });

function calque(st: ValeurStyleSousTitres, gabarit: GabaritSousTitres, plus: Partial<Parameters<typeof donneesCalque>[0]> = {}, apres: (d: DonneesCalque) => DonneesCalque = (d) => d): DonneesCalque {
  const segments = fabriquerSousTitres({ texte: PHRASE, dureeSec: DUREE, mots: MOTS, emphase: ["mails", "jamais", "personnels."], style: st, base: gabarit === "karaoke" || gabarit === "minimal" ? gabarit : undefined, intensite: "equilibre" });
  return apres(donneesCalque({ segments, base: gabarit === "minimal" ? "minimal" : gabarit === "karaoke" ? "karaoke" : (gabarit as never), style: st, ...plus }));
}

const pastille = () => calque(style("karaoke", { pastille: "axion" }), "karaoke", {}, (d) => ({ ...d, pastille: PASTILLE_AXION }));

describe("C2-U2 · éteint = identique (styles sans pastille)", () => {
  const styles: Record<string, DonneesCalque> = {
    karaoke: calque(style("karaoke"), "karaoke"),
    minimal: calque(style("minimal"), "minimal"),
    impact: calque(style("impact"), "impact"),
    bandeau: calque(style("bandeau"), "bandeau"),
    surlignage: calque({ ...style("karaoke"), surlignage: SURLIGNAGE_CAS_CONCRET } as never, "karaoke"),
    encre: calque(STYLE_SOUS_TITRES_ENCRE, "minimal", { couleurs: { texte: "#15100c", accent: "#15100c", contour: "#FAF9F5" } }, (d) => ({ ...d, encre: true, passagesClairs: [{ debutSec: 2, finSec: 5, texte: "#15100c" }] })),
  };
  for (const [nom, d] of Object.entries(styles)) {
    it(nom, () => {
      const p: P = { sousTitres: d, encadre: undefined, incrustations: [] };
      for (let k = 0; k < 10; k++) {
        const t = +((DUREE * k) / 9).toFixed(3);
        expect(empreinteTexte(p, t)).toBe(ancienneEmpreinte(p, t));
      }
      for (let i = 0; i < IMAGES; i++) expect(empreinteTexte(p, i / FPS)).toBe(ancienneEmpreinte(p, i / FPS));
    });
  }
});

describe("C2-U2 · Pastille Axion", () => {
  it("pendant l'arrivée d'un mot, deux instants ont deux empreintes différentes (égales avant)", () => {
    const d = pastille();
    const p: P = { sousTitres: d, encadre: undefined, incrustations: [] };
    const arrivee = PASTILLE_AXION.arriveeMotMs / 1000;
    const debut = MOTS[2].debutSec;
    const t1 = +(debut + 0.01).toFixed(3);
    const t2 = +(debut + arrivee * 0.6).toFixed(3);
    const e1 = sceneAuTemps(d, t1)!.mots.find((m) => m.echelle !== undefined)?.echelle;
    const e2 = sceneAuTemps(d, t2)!.mots.find((m) => m.echelle !== undefined)?.echelle;
    expect(e1).not.toBe(e2);
    expect(ancienneEmpreinte(p, t1)).toBe(ancienneEmpreinte(p, t2));
    expect(empreinteTexte(p, t1)).not.toBe(empreinteTexte(p, t2));
  });

  it("instantsTexte rend plus d'images qu'avant et la somme des durées reste égale à images", () => {
    const d = pastille();
    const r = instantsTexte({ sousTitres: d, encadre: undefined, incrustations: [], images: IMAGES, fps: FPS });
    expect(r.instants.length).toBeGreaterThan(nombreImagesAvant(d));
    expect(r.durees.reduce((a, b) => a + b, 0)).toBe(IMAGES);
  });
});
