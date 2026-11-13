/**
 * GV2-28 : voix sans horodatage des mots : la recette est quand même soumise (UN morceau [0, durée], filtres, niveau
 * sonore, 0,8 s de silence, SANS fondu de sortie) ; l'alerte dit que les sous-titres sont approximatifs.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "../../../src/domaine/types";
import { parametresRecette, planRecetteSansMots, RECETTE_VOIX_TABLEAU, reglagesRecette } from "../../../src/moteurs/montage-tableau/recette-voix";
import { avancerRecetteVariante, avancerVoixTableau, type EtatVoixTableau } from "../../../src/moteurs/montage-tableau/voix-tableau";
import { copie, ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

const MOTS: MotHorodate[] = [
  { mot: "Bonjour", debutSec: 0, finSec: 0.5 },
  { mot: "tous.", debutSec: 0.5, finSec: 1 },
];
const brut = { fichierCle: "studio/dev/brut.mp3", dureeSec: 8.5, mots: MOTS, coutCentimes: 3, fournisseur: "simulation", caracteres: 50, approximatif: "non-relie" as const };

describe("planRecetteSansMots (pur)", () => {
  it("un seul morceau, silence 0,8 s, pas de fondu, id de la recette inchangé", () => {
    const p = planRecetteSansMots(8.5);
    expect(p.morceaux).toEqual([{ debutSec: 0, finSec: 8.5 }]);
    expect(p.silenceFinSec).toBe(0.8);
    expect(p.fonduSortieSec).toBe(0);
    expect(p.dureeSec).toBeCloseTo(9.3, 3);
    expect(p.mots).toEqual([]);
    expect(RECETTE_VOIX_TABLEAU.id).toBe("voix-tableau/3");
    expect(reglagesRecette().id).toBe("voix-tableau/3");
    expect(parametresRecette(p)).toMatchObject({ mode: "recette", morceaux: [{ debutSec: 0, finSec: 8.5 }], silenceFinSec: 0.8, fonduSortieSec: 0 });
  });
});

describe("repli sans horodatage : la recette est soumise quand même", () => {
  it("voix unique : une demande nettoyage-audio à un morceau, puis un audio traité qui dit « sous-titres approximatifs »", async () => {
    const d = doubles(copie(ficheDemonstration));
    const outils = { ...d.outils.voix, idBase: "tb-essai", texte: () => "x", empreinte: () => "e", caler: () => false };
    let e: EtatVoixTableau = await avancerVoixTableau({ phase: "a-analyser", brut }, outils);
    expect(e.phase).toBe("recette");
    const demandes = d.soumises.filter((x) => x.operation === "nettoyage-audio");
    expect(demandes).toHaveLength(1);
    expect(demandes[0].parametres).toMatchObject({ mode: "recette", morceaux: [{ debutSec: 0, finSec: 8.5 }], silenceFinSec: 0.8, fonduSortieSec: 0 });
    e = await avancerVoixTableau(e, outils);
    expect(e.phase).toBe("faite");
    if (e.phase !== "faite") return;
    expect(e.audio.mots).toEqual(MOTS);
    expect(e.audio.sousTitresApproximatifs).toBe("non-relie");
    expect(e.audio.recette).toMatchObject({ id: RECETTE_VOIX_TABLEAU.id, appliquee: true, partielle: true });
    expect(e.audio.recette?.raison).toMatch(/approximatifs/);
  });

  it("variante sans phrase de fin : même repli", async () => {
    const d = doubles(copie(ficheDemonstration));
    const outils = { ...d.outils.voix, idBase: "tb-essai", texte: () => "x", empreinte: () => "e", caler: () => false };
    let e = await avancerRecetteVariante({ phase: "a-soumettre" }, { corps: brut }, { coutCentimes: 3, caracteres: 50 }, outils);
    expect(e.phase).toBe("recette");
    expect(d.soumises.at(-1)?.parametres).toMatchObject({ mode: "recette", morceaux: [{ debutSec: 0, finSec: 8.5 }], silenceFinSec: 0.8, fonduSortieSec: 0 });
    e = await avancerRecetteVariante(e, { corps: brut }, { coutCentimes: 3, caracteres: 50 }, outils);
    expect(e).toMatchObject({ phase: "faite", audio: { mots: MOTS, recette: { appliquee: true, partielle: true } } });
  });

  it("plan qui lève (mots en désordre) : même repli, raison dite", async () => {
    const d = doubles(copie(ficheDemonstration));
    const outils = { ...d.outils.voix, idBase: "tb-essai", texte: () => "x", empreinte: () => "e", caler: () => false };
    const desordre = { ...brut, approximatif: undefined, mots: [{ mot: "a", debutSec: 1, finSec: 1.2 }, { mot: "b", debutSec: 0.5, finSec: 0.7 }] };
    const e = await avancerVoixTableau({ phase: "a-analyser", brut: desordre }, outils);
    expect(e.phase).toBe("recette");
    expect(d.soumises.at(-1)?.parametres).toMatchObject({ morceaux: [{ debutSec: 0, finSec: 8.5 }], fonduSortieSec: 0 });
  });
});
