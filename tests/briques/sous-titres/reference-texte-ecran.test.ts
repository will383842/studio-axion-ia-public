/**
 * Filet C2-U1 : rejoué sans changement par C2-U2 à C2-U20b, C5-5.04. Toute PR qui change cet instantané doit le dire et le justifier ; un instantané ne se régénère jamais sans accord écrit du relecteur.
 *
 * Il FIGE, sans rien corriger, ce que le moteur unique des sous-titres dessine aujourd'hui : `sceneAuTemps` à 6 instants,
 * `cssElement` à 2 instants et `instantsTexte` (studio-rendu, 30 i/s) pour 9 styles + le tableau. Une même phrase fixe,
 * mots horodatés écrits ici (aucune voix réelle). Les nombres sont arrondis à 4 décimales (même machine ou non).
 */
import { describe, expect, it } from "vitest";
import { instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import { PASTILLE_AXION, PASTILLE_AXION_ARDOISE } from "@/briques/sous-titres/pastille";
import { cssElement, sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { GabaritSousTitres, SegmentSousTitres, ValeurStyleSousTitres } from "@/domaine/types";
import { SURLIGNAGE_CAS_CONCRET } from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { mettreEnPage } from "@/moteurs/montage-tableau/mise-en-page";
import { formatSortie } from "@/moteurs/montage-tableau/formats-sortie";
import { centreBandePct } from "@/moteurs/montage-tableau/fabriquer";
import { bandeDe, bandeDuCalque, sousTitresDynamiquesTableau, sousTitresTableau, STYLE_SOUS_TITRES_ENCRE, supplementsSousTitresTableau } from "@/moteurs/montage-tableau/sous-titres-tableau";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { ficheV6616 } from "../../tableau/banc/fiches-banc";

const PHRASE = "Votre patron peut-il lire vos mails ? Oui, mais jamais les mails personnels. Il faut trois jours pour vérifier.";
const EN_VALEUR = ["mails", "jamais", "personnels."];
const MOTS = PHRASE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(0.5 + i * 0.3).toFixed(3), finSec: +(0.5 + i * 0.3 + 0.26).toFixed(3) }));
const DUREE = +(MOTS.at(-1)!.finSec + 0.4).toFixed(3);
const FPS = 30;

const arrondi = (v: unknown): unknown => (typeof v === "number" ? +v.toFixed(4) : Array.isArray(v) ? v.map(arrondi) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, arrondi(x)])) : v);
const style = (gabarit: GabaritSousTitres, plus: Partial<ValeurStyleSousTitres> = {}): ValeurStyleSousTitres => ({ ...STYLE_SOUS_TITRES_AVOCAT, gabarit, ...plus });

function segmentsDe(st: ValeurStyleSousTitres, gabarit: GabaritSousTitres): SegmentSousTitres[] {
  return fabriquerSousTitres({ texte: PHRASE, dureeSec: DUREE, mots: MOTS, emphase: EN_VALEUR, style: st, base: gabarit === "karaoke" || gabarit === "minimal" ? gabarit : undefined, intensite: "equilibre" });
}

/** Six instants au moins : avant le 1er mot, entrée d'un groupe, mot en valeur allumé, milieu, changement de groupe, après le dernier mot. */
function instants(segs: SegmentSousTitres[]): number[] {
  const valeur = segs.flatMap((s) => s.mots).find((m) => m.enValeur);
  const t = [0.1, segs[0].debutSec + 0.05, (valeur ? valeur.debutSec : segs[0].mots[0].debutSec) + 0.05, DUREE / 2, (segs[1] ?? segs[0]).debutSec + 0.02, DUREE + 1];
  return t.map((x) => +x.toFixed(3));
}

function figer(d: DonneesCalque, segs: SegmentSousTitres[]) {
  const ts = instants(segs);
  const scenes = ts.map((t) => ({ t, scene: arrondi(sceneAuTemps(d, t)) }));
  const css = [ts[2], ts[3]].map((t) => {
    const el = sceneAuTemps(d, t);
    return { t, css: el ? arrondi(cssElement(el, d, "Manrope")) : null };
  });
  const images = Math.ceil(DUREE * FPS);
  const it = instantsTexte({ sousTitres: d, encadre: undefined, incrustations: [], images, fps: FPS });
  return { segments: arrondi(d.segments), scenes, css, instantsTexte: arrondi({ images, ...it }) };
}

const cas = (st: ValeurStyleSousTitres, gabarit: GabaritSousTitres, plus: Partial<Parameters<typeof donneesCalque>[0]> = {}, apres: (d: DonneesCalque) => DonneesCalque = (d) => d) => {
  const segments = segmentsDe(st, gabarit);
  return figer(apres(donneesCalque({ segments, base: gabarit === "minimal" ? "minimal" : gabarit === "karaoke" ? "karaoke" : (gabarit as never), style: st, ...plus })), segments);
};

describe("filet C2-U1 : texte à l'écran, état d'aujourd'hui", () => {
  it("cas-01-karaoke", () => expect(cas(style("karaoke"), "karaoke")).toMatchSnapshot());
  it("cas-02-minimal", () => expect(cas(style("minimal"), "minimal")).toMatchSnapshot());
  it("cas-03-impact", () => expect(cas(style("impact"), "impact")).toMatchSnapshot());
  it("cas-04-bandeau", () => expect(cas(style("bandeau"), "bandeau")).toMatchSnapshot());
  it("cas-05-pastille-axion", () => expect(cas(style("karaoke", { pastille: "axion" }), "karaoke", {}, (d) => ({ ...d, pastille: PASTILLE_AXION }))).toMatchSnapshot());
  it("cas-06-pastille-axion-ardoise", () => expect(cas(style("karaoke", { pastille: "axion-ardoise" }), "karaoke", {}, (d) => ({ ...d, pastille: PASTILLE_AXION_ARDOISE }))).toMatchSnapshot());
  it("cas-07-surlignage", () => expect(cas({ ...style("karaoke"), surlignage: SURLIGNAGE_CAS_CONCRET } as never, "karaoke")).toMatchSnapshot());
  it("cas-08-encre-passages-clairs", () =>
    expect(
      cas(STYLE_SOUS_TITRES_ENCRE, "minimal", { couleurs: { texte: "#15100c", accent: "#15100c", contour: "#FAF9F5" } }, (d) => ({ ...d, encre: true, passagesClairs: [{ debutSec: 2, finSec: 5, texte: "#15100c" }] })),
    ).toMatchSnapshot());
  it("cas-09-16-9-echelle-jonction", () =>
    expect(cas(style("karaoke"), "karaoke", { ratio: "16:9" }, (d) => ({ ...d, echelleTexte: 0.9, passagesJonction: [{ debutSec: 2, finSec: 5, centrePct: 52 }] }))).toMatchSnapshot());
});

/**
 * Cas 10 : le tableau. Ce qui distingue « blocs/2 » de « reference/3 » côté sous-titres : `sousTitresTableau` ne lit que
 * `habillage` (reference/3 → style central « Avocat ») et `styleTableau` (fond ardoise / tableau blanc / paperboard → central
 * aussi). Une fiche « blocs/2 » sans `styleTableau` retombe sur l'Encre. On fige donc les deux.
 */
describe("cas-10-tableau", () => {
  const mise = mettreEnPage(ficheV6616(), {});
  const fs = formatSortie("vertical");
  const bande = bandeDe(mise, "9:16", true, []);
  const sous = (fiche: Pick<FicheTableau, "habillage" | "styleTableau">) => {
    const st = sousTitresTableau({ fiche, positionPct: centreBandePct(mise), bande });
    const sup = supplementsSousTitresTableau({ st, mise, ratio: "9:16", verticale: true, dynamiques: true });
    const base = segmentsDe(st.style.valeur, st.gabarit);
    const segments = sousTitresDynamiquesTableau(base, { st, intensite: "equilibre", dureeSec: DUREE });
    // Comme `parametres.ts` : un style à encre passe ses couleurs (texte, accent, contour = page) ; `facteurOmbre` = 1
    // (encre, ou aucun décor dans ce test : `sousTitresSurDecor(undefined)` rend 1).
    const encre = st.style.valeur.encre;
    const calque0 = donneesCalque({ segments, base: st.base, ratio: "9:16", style: st.style.valeur, ...(encre ? { couleurs: { texte: encre.texte, accent: encre.accent ?? encre.texte, contour: encre.page } } : {}) });
    const calque: DonneesCalque = { ...calque0, facteurOmbre: 1, ...(sup.glissementSousTitres === false ? { glissement: false as const } : {}), ...(sup.bandeFondSousTitres ? { bandeFond: sup.bandeFondSousTitres } : {}), ...(st.style.valeur.encre ? { encre: true } : {}) };
    return { style: { id: st.style.id, gabarit: st.gabarit, base: st.base, accents: st.accents, motsEnValeur: st.motsEnValeur, positionPct: st.positionPct, bandeFond: st.bandeFond, echelle: st.echelle }, supplements: arrondi(sup), bandeCalque: arrondi(bandeDuCalque(mise, calque)), ...figer(calque, segments), dimensions: { l: fs.largeur, h: fs.hauteur } };
  };
  it("blocs/2 (fond d'avant : Encre)", () => expect(arrondi(sous({ habillage: "blocs/2" } as never))).toMatchSnapshot());
  it("reference/3 (fond tableau blanc : style central + bande de fond)", () => expect(arrondi(sous({ habillage: "reference/3", styleTableau: "tableau-blanc" } as never))).toMatchSnapshot());
  it("reference/3 (ardoise : sans bande de fond)", () => expect(arrondi(sous({ habillage: "reference/3", styleTableau: "ardoise" } as never))).toMatchSnapshot());
});
