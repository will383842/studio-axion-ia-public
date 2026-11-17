/** C2-U9 : étiquette d'outil autonome à la première mention (texte seul, éteinte par défaut). Phrases écrites ici, aucune voix. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { empreinteTexte, instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { autoriserTexte } from "@/briques/charte/axion-2026";
import { poserBandeauNom } from "@/briques/sous-titres/bandeau-nom";
import { ETIQUETTE, ETIQUETTE_AUTONOME, ETIQUETTE_OUTIL_AUTONOME, etiquettesAutonomes, NOMS_OUTILS } from "@/briques/sous-titres/noms-outils";
import { cssEtiquetteOutil, etiquetteAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import { donneesCalque } from "@/briques/sous-titres";
import type { MotRendu, SegmentRendu } from "@/briques/sous-titres/types-rendu";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";

const motsT = (texte: string, debut: number): MotRendu[] => texte.split(" ").map((mot, i) => ({ mot, debutSec: +(debut + i * 0.4).toFixed(3), finSec: +(debut + 0.3 + i * 0.4).toFixed(3) }));
const groupe = (texte: string, debut: number, id: string): SegmentRendu => {
  const ms = motsT(texte, debut);
  return { id, debutSec: ms[0].debutSec, finSec: ms.at(-1)!.finSec + 0.1, mots: ms, style: "base", position: "auto", importance: 1 };
};
const ON = { actif: true };

describe("C2-U9 · éteint par défaut", () => {
  it("la constante est false et la fonction ne rend rien sans l'option", () => {
    expect(ETIQUETTE_OUTIL_AUTONOME).toBe(false);
    expect(etiquettesAutonomes([groupe("je lance Notion", 2, "a")], 20)).toEqual([]);
  });
  it("sans `etiquettesOutils`, la scène et l'empreinte sont inchangées", () => {
    const d = donneesCalque({ segments: [groupe("je lance Notion", 2, "a")], base: "karaoke", style: STYLE_SOUS_TITRES_AVOCAT });
    expect(d.etiquettesOutils).toBeUndefined();
    expect(etiquetteAuTemps(d, 2.5)).toBeNull();
    expect(empreinteTexte({ sousTitres: d, encadre: undefined, incrustations: [] } as never, 2.5)).not.toContain("notion");
  });
});

describe("C2-U9 · pose", () => {
  it("une étiquette par outil, à la première mention, 1,2 s", () => {
    const e = etiquettesAutonomes([groupe("je lance Notion", 2, "a"), groupe("et Notion encore", 6, "b")], 20, ON);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ id: "notion", texte: "NOTION", debutSec: 2.8 });
    expect(e[0].finSec - e[0].debutSec).toBeCloseTo(1.2, 6);
  });
  it("au plus 3 par vidéo", () => {
    const segs = ["Notion", "Excel", "Slack", "Canva"].map((n, i) => groupe(`avec ${n}`, 2 + i * 4, `s${i}`));
    expect(etiquettesAutonomes(segs, 30, ON).map((x) => x.id)).toEqual(["notion", "excel", "slack"]);
  });
  it("aucune avant 0,8 s", () => {
    const e = etiquettesAutonomes([groupe("Notion ici", 0, "a")], 20, ON);
    expect(e.every((x) => x.debutSec >= 0.8 - 1e-9)).toBe(true);
  });
  it("jamais pendant le bandeau ni pendant l'encadré d'ouverture", () => {
    const segs = [groupe("avec Notion", 0.4, "a")];
    expect(etiquettesAutonomes(segs, 20, { ...ON, bandeau: { debutSec: 0.8, finSec: 3.8 } })).toEqual([]);
    expect(etiquettesAutonomes(segs, 20, { ...ON, ouvertureFinSec: 3 })).toEqual([]);
    expect(etiquettesAutonomes([groupe("avec Notion", 5, "a")], 20, { ...ON, bandeau: { debutSec: 0.8, finSec: 3.8 }, ouvertureFinSec: 3 })).toHaveLength(1);
  });
  it("deux étiquettes ne se chevauchent pas ; une étiquette ne dépasse pas la vidéo", () => {
    const deux = etiquettesAutonomes([groupe("Notion et Excel", 2, "a")], 20, ON);
    expect(deux).toHaveLength(1);
    expect(etiquettesAutonomes([groupe("avec Notion", 8.5, "a")], 9.5, ON)).toEqual([]);
  });
  it("un nom ambigu en début de phrase ne déclenche rien", () => {
    expect(etiquettesAutonomes([groupe("Make le fait", 2, "a")], 20, ON)).toEqual([]);
  });
});

describe("C2-U9 · scène", () => {
  const base = donneesCalque({ segments: [groupe("je lance Notion", 2, "a")], base: "karaoke", style: STYLE_SOUS_TITRES_AVOCAT });
  const d: DonneesCalque = { ...base, etiquettesOutils: [{ id: "notion", texte: "NOTION", debutSec: 3, finSec: 4.2 }] };
  it("hors fenêtre : rien ; fondu montant 0,2 s, plateau, fondu descendant 0,2 s", () => {
    expect(etiquetteAuTemps(d, 2.99)).toBeNull();
    expect(etiquetteAuTemps(d, 4.2)).toBeNull();
    expect(etiquetteAuTemps(d, 3)!.opacite).toBeLessThan(0.05);
    expect(etiquetteAuTemps(d, 3.1)!.opacite).toBeGreaterThan(0);
    expect(etiquetteAuTemps(d, 3.1)!.opacite).toBeLessThan(1);
    expect(etiquetteAuTemps(d, 3.6)!.opacite).toBe(1);
    expect(etiquetteAuTemps(d, 4.1)!.opacite).toBeLessThan(1);
  });
  it("posée sur la zone libre haute (hautPct), dans la largeur", () => {
    const e = etiquetteAuTemps(d, 3.6)!;
    expect(e.yPx).toBeCloseTo((d.positions.hautPct / 100) * d.hauteur, 3);
    expect(e.largeurPx).toBeLessThanOrEqual(d.largeurMaxPx + 1e-6);
  });
  it("se replie pendant l'encadré d'ouverture et pendant le bandeau", () => {
    expect(etiquetteAuTemps({ ...d, ouverture: { finSec: 3.5, milieuPct: 40 } }, 3.4)).toBeNull();
    expect(etiquetteAuTemps({ ...d, ouverture: { finSec: 3.5, milieuPct: 40 } }, 3.6)).not.toBeNull();
    const b = poserBandeauNom({ nom: "Marie Durand", fonction: "Avocate", dureeVideoSec: 30, largeur: d.largeur, hauteur: d.hauteur, zone: { haut: 8, droite: 18, bas: 22, gauche: 8 }, basPct: d.positions.basPct })!;
    expect(etiquetteAuTemps({ ...d, bandeauNom: { ...b, debutSec: 3.5, finSec: 6.5 } }, 3.6)).toBeNull();
  });
  it("le contraste passe, aucune couleur hors charte", () => {
    expect(autoriserTexte(ETIQUETTE.texte, ETIQUETTE.fond)).toBe(true);
    const c = cssEtiquetteOutil(etiquetteAuTemps(d, 3.6)!, d, '"Manrope ExtraBold"');
    expect(c.texte.color).toBe(ETIQUETTE.texte);
    expect(c.conteneur.background).toBe(ETIQUETTE.fond);
    expect(c.texte.fontFamily).toBe('"Manrope ExtraBold"');
  });
  it("l'empreinte change quand l'étiquette paraît", () => {
    const p = (dd: DonneesCalque, t: number) => empreinteTexte({ sousTitres: dd, encadre: undefined, incrustations: [] } as never, t);
    expect(p(d, 3.6)).not.toBe(p(base, 3.6));
    expect(p(d, 3.6)).not.toBe(p(d, 3.1));
    const { instants } = instantsTexte({ sousTitres: d, encadre: undefined, incrustations: [], images: 150, fps: 30 } as never);
    expect(instants.length).toBeGreaterThan(1);
  });
});

describe("C2-U9 · module pur et sans marque", () => {
  const source = readFileSync("src/briques/sous-titres/noms-outils.ts", "utf8");
  it("aucun import @/, aucune adresse, aucune image", () => {
    expect(source).not.toMatch(/from\s+["']@\//);
    expect(source).not.toMatch(/https?:\/\/|\.(png|jpe?g|svg|webp|gif)\b/i);
  });
  it("réglages bornés", () => {
    expect(ETIQUETTE_AUTONOME).toMatchObject({ dureeSec: 1.2, fonduSec: 0.2, debutMinSec: 0.8, maxParVideo: 3 });
    expect(NOMS_OUTILS.length).toBeGreaterThan(0);
  });
});
