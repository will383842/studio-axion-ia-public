/**
 * STYLE « blocs/2 » BRANCHÉ DANS LE MOTEUR : seuils de contraste et de taille du style au contrôle d'avant la voix,
 * écran d'appel tiré de la fin retenue (mot saisi ou appel de diagnostic), bruitages sous la voix. Aucun appel.
 */
import { describe, expect, it } from "vitest";
import { controlerVideoTableau } from "../../../src/moteurs/montage-tableau/controles";
import { appelDeLaFin, bruitagesTableau, commandeTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { descriptionsEcrans, mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { finEtAppelDuTableau } from "../../../src/services/tableau-fin";
import { formatTableauAnime } from "../../../src/formats/tableau-anime";
import { contexteFormation, ficheFormation, ficheFormationCalee, motsFormation } from "../style-v2/temoin-formation";

const deja = { coche: true, le: "2026-10-10" };

describe("contrôle d'avant la voix : seuils du style « blocs/2 »", () => {
  it("la fiche témoin « Formation » n'est pas bloquée par la taille ni le contraste", async () => {
    const r = await controlerVideoTableau({ fiche: ficheFormation(), contexte: contexteFormation(), historique: [], dejaVu: deja });
    const image = r.lignes.filter((l) => l.libelle === "Taille du texte" || l.libelle.startsWith("Contraste"));
    expect(image.length).toBeGreaterThan(0);
    expect(image.filter((l) => l.etat === "echoue")).toEqual([]);
  });
});

describe("écran d'appel tiré de la fin retenue", () => {
  const f = ficheFormationCalee().fiche;
  it("le mot saisi se tape dans la bulle (« Écrivez MOT en commentaire »)", () => {
    const d = descriptionsEcrans(f, { mot: "GUIDE" }).at(-1)!;
    expect(d.moment).toBe("appel");
    expect(d.gabarit).toBe("appel-commentaire");
    expect(d.motCommentaire).toBe("GUIDE");
    expect(() => mettreEnPage(f, { appel: { mot: "GUIDE" } })).not.toThrow();
  });
  it("une fin « diagnostic » montre l'écran « Appel de diagnostic »", () => {
    expect(descriptionsEcrans(f, { diagnostic: true }).at(-1)!.gabarit).toBe("appel-diagnostic");
  });
  it("la fin retenue donne le mot (capitales) ou le diagnostic", () => {
    const fin = finEtAppelDuTableau("instagram", "fin-if-mot-envoi", undefined, { mot: "guide" });
    expect(fin).toMatchObject({ ecran: "Écrivez GUIDE en commentaire", type: "commentaire", mot: "GUIDE" });
    expect(appelDeLaFin(fin)).toEqual({ mot: "GUIDE" });
    expect(appelDeLaFin({ id: "fin-if-diagnostic", ecran: "Réservez votre appel de diagnostic" })).toEqual({ diagnostic: true });
    expect(appelDeLaFin({ absente: "x" })).toBeUndefined();
  });
});

describe("bruitages et commande « blocs/2 »", () => {
  const calage = ficheFormationCalee();
  const mots = motsFormation();
  const props = proprietesScenes({ miseEnPage: mettreEnPage(calage.fiche) as unknown as MiseBrique, scenes: calage.fiche.scenes as SceneCalee[], heures: calage.elements, stylo: calage.fiche.stylo, mots, fps: 30 });
  const duree = calage.fiche.scenes.at(-1)!.finMs! / 1000;
  it("les sons du plan sont posés au moins 18 dB sous la voix, jamais dans la dernière seconde", () => {
    const s = bruitagesTableau(props, duree);
    expect(s.places.length).toBeGreaterThan(3);
    for (const b of s.places) {
      expect(b.gainDb).toBeLessThanOrEqual(-18);
      expect(b.debutSec).toBeLessThan(duree - 1);
      expect(s.medias[b.elementId].cle).toMatch(/^\/bruitages\/tableau-(trait|toc|validation)\.wav$/);
    }
  });
  it("la commande coupe les sous-titres de la composition et exporte à 30 i/s", () => {
    const c = commandeTableau({ videoId: "v", fiche: calage.fiche, texteScript: "x", dureeSec: duree, centreSousTitresPct: 80, scenes: [{ id: "s1", debutSec: 0, finSec: duree, cle: "k" }] });
    expect(c.briques["sous-titres"]).toBe(false);
    expect(c.profilRendu?.export?.fps).toBe(30);
  });
  it("le format demande le style des nouvelles fiches, « reference/3 » (gabarit par parties) depuis le 14/10, et est actif", () => {
    expect(formatTableauAnime.pieces?.habillage).toBe("reference/3");
    expect(formatTableauAnime.statut).toBe("actif");
  });
});
