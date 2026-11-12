/**
 * GV-ST-08b : le dessin de la vidéo et l'aperçu de la Bibliothèque suivent le style choisi (Impact, Bandeau).
 * L'aperçu passe par le même calcul que la vidéo ; Karaoké et Minimal restent identiques.
 */
import { describe, expect, it } from "vitest";
import { parametresComposition } from "@/briques/composition";
import { baseRetenue, fabriquerSousTitres } from "@/briques/sous-titres";
import { sceneAuTemps } from "@/briques/sous-titres/scene";
import { segmentsApercu } from "@/components/bibliotheque/SousTitreAnime";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { sousTitresSurDecor } from "@/domaine/decors";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { CommandeFabrication, GabaritSousTitres, IntensiteSousTitres, ValeurStyleSousTitres } from "@/domaine/types";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";
import type { PlanProduit } from "@/moteurs/types";

const MAINTENANT = "2026-10-02T08:00:00.000Z";
const PHRASE = "Votre patron peut-il lire vos mails ? Oui, mais jamais les mails personnels. 35 heures pour tout vérifier.";
const EN_VALEUR = ["mails", "jamais", "personnels."];
const DUREE = PHRASE.split(/\s+/).length / 4.4;

const PLANS: PlanProduit[] = [
  { ordre: 1, debutSec: 0, finSec: 9, texte: "texte", segmentId: "s1", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "trois-quarts" } as PlanProduit,
];

const style = (gabarit: GabaritSousTitres): ValeurStyleSousTitres => ({ ...STYLE_SOUS_TITRES_AVOCAT, gabarit });

function commande(valeur: ValeurStyleSousTitres, decorId = "decor-n1-halo-orange"): CommandeFabrication {
  const d = decorsCatalogue(MAINTENANT).find((x) => x.id === decorId)!;
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-apercu",
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 9,
    ratios: ["9:16"],
    script: { blocs: [{ id: "b", blocRecette: "preuve", segments: [{ id: "s1", texte: PHRASE }] }], texteComplet: PHRASE },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: { lut: null, sousTitres: { id: "st", nom: "Test", valeur }, habillage: null, profilSon: null, musique: null, decor: { id: d.id, nom: d.nom, valeur: d.valeur as never } },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { active: false } as never,
    budgetMax: { centimes: 15000, devise: "EUR" },
    profilRendu: formatAvocat.profilRendu,
    recetteMontage: RECETTE_MONTAGE_AVOCAT,
    construiteLe: MAINTENANT,
    medias: { [d.id]: { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" } },
  } as CommandeFabrication;
}

/** Ce que la vidéo calcule : la base du style, la même intensité. */
const segmentsVideo = (valeur: ValeurStyleSousTitres, intensite: IntensiteSousTitres) =>
  fabriquerSousTitres({ texte: PHRASE, dureeSec: DUREE, emphase: EN_VALEUR, style: valeur, base: baseRetenue(undefined, valeur), intensite });

const composer = (valeur: ValeurStyleSousTitres, intensite: IntensiteSousTitres, decorId?: string) =>
  parametresComposition(commande(valeur, decorId), { ratio: "9:16", plans: PLANS, segments: segmentsVideo(valeur, intensite), dureeSec: 9 }, RECETTE_COMPOSITION_AVOCAT);

describe("la composition prend la base du style", () => {
  for (const g of ["impact", "bandeau", "minimal", "karaoke"] as const) {
    it(`style ${g} : le calque porte la base ${g}`, () => {
      expect(composer(style(g), "equilibre").texte.sousTitres?.base).toBe(g);
    });
  }
  it("une base demandée par la commande l'emporte sur le style", () => {
    const c = { ...commande(style("bandeau")), sousTitres: { base: "karaoke" as const, intensite: "equilibre" as const } };
    const p = parametresComposition(c, { ratio: "9:16", plans: PLANS, segments: segmentsVideo(style("karaoke"), "equilibre"), dureeSec: 9 }, RECETTE_COMPOSITION_AVOCAT);
    expect(p.texte.sousTitres?.base).toBe("karaoke");
  });
  it("décor clair : le passage en bandeau de lisibilité continue de fonctionner", () => {
    // Fond gris moyen : ni le texte crème ni le contour noir ne se détachent assez, la règle impose le bandeau.
    const c = commande(style("karaoke"));
    const clair = { ...c, styles: { ...c.styles, decor: { ...c.styles.decor!, valeur: { ...(c.styles.decor!.valeur as object), teinte: "#8C8C8C" } } } } as CommandeFabrication;
    expect(sousTitresSurDecor((clair.styles.decor!.valeur as never))).toMatchObject({ mode: "bandeau" });
    const p = parametresComposition(clair, { ratio: "9:16", plans: PLANS, segments: segmentsVideo(style("karaoke"), "equilibre"), dureeSec: 9 }, RECETTE_COMPOSITION_AVOCAT);
    expect(p.alertes.some((x) => x.code === "debordement-sous-titres" && x.message.includes("bandeau"))).toBe(true);
    expect(p.texte.sousTitres!.segments.every((s) => s.style === "bandeau")).toBe(true);
  });
});

describe("l'aperçu suit la vidéo", () => {
  for (const g of ["impact", "bandeau", "karaoke", "minimal"] as const) {
    for (const intensite of ["sobre", "equilibre", "tres-dynamique"] as const) {
      it(`${g} / ${intensite} : mêmes segments (style, importance, position) que la vidéo`, () => {
        const valeur = style(g);
        const apercu = segmentsApercu({ style: valeur, phrase: PHRASE, intensite });
        const video = composer(valeur, intensite).texte.sousTitres!.segments;
        const cle = (s: { style?: string; importance?: number; position?: string; inclinaison?: number }) => [s.style, s.importance, s.position, s.inclinaison];
        expect(apercu.map(cle)).toEqual(video.map(cle));
        expect(apercu.map((s) => s.mots.map((m) => m.mot))).toEqual(video.map((s) => s.mots.map((m) => m.mot)));
      });
    }
  }
  it("Bandeau : l'aperçu n'est plus forcé à la main (l'intensité compte)", () => {
    const sobre = segmentsApercu({ style: style("bandeau"), phrase: PHRASE, intensite: "sobre" });
    const dyn = segmentsApercu({ style: style("bandeau"), phrase: PHRASE, intensite: "tres-dynamique" });
    expect(sobre.every((s) => s.style === "bandeau")).toBe(true);
    expect(dyn.every((s) => s.style === "bandeau")).toBe(true);
    expect(sobre.every((s) => s.importance === 3 && s.position === "milieu")).toBe(false);
  });
  it("Karaoké : instantané inchangé", () => {
    const s = segmentsApercu({ style: style("karaoke"), phrase: PHRASE, intensite: "equilibre" });
    expect(s).toEqual(fabriquerSousTitres({ texte: PHRASE, dureeSec: DUREE, emphase: EN_VALEUR, style: style("karaoke"), base: "karaoke", intensite: "equilibre" }));
  });
});

describe("le dessin du calque Bandeau", () => {
  it("un groupe est dessiné avec le gabarit bandeau (fond plein derrière le texte)", () => {
    const calque = composer(style("bandeau"), "equilibre").texte.sousTitres!;
    const el = sceneAuTemps(calque, calque.segments[0].debutSec + 0.3);
    expect(el?.fond).toBeDefined();
  });
});
