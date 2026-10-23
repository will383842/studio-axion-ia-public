/**
 * PANNES DE LA VIDÉO v-6616b3800357 (17/10/2026, Formation → ardoise, TikTok + Shorts + IG + FB, fin « appel de
 * diagnostic », démonstration en 3 gestes) : toujours aucune vidéo après deux correctifs. Chaque panne, sur le VRAI
 * chemin :
 *  1. « page lisible » : une page qui tient sur la page ivoire ne tient pas dans le style du tableau (ardoise…) ; la
 *     réparation automatique (« la dernière scène passe à une page de plus ») mesurait la page ivoire, et la fabrication
 *     ne la refaisait jamais sur la fiche enregistrée ;
 *  2. « Titre jamais seul » : le titre s'écrivait vite (0,4 à 0,6 s) puis restait seul jusqu'à ce que la voix dise la
 *     phrase suivante ;
 *  3. « 3 jours » + « Ses notes partaient après » : le chiffre extrait du milieu d'une phrase laissait une phrase fausse ;
 *  4. « Reprendre la fabrication » reprenait la mise en page (et les heures) gardées au journal, faites par le code d'avant.
 */
import { describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000 });
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { planPage3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import { STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { problemesAnimation3, titreSeulSec, TITRE_SEUL_TABLEAU_MAX_SEC } from "../../../src/moteurs/montage-tableau/controles-v3";
import { fabriquerTableau, pagesDuStyle } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { IDS_SORTIES } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { chiffreDuTexte, resteDuChiffre } from "../../../src/moteurs/montage-tableau/mise-en-page-tableau";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { doubles } from "../fabriquer/doubles";
import { motsRealistes } from "../reference-3/fiches";
import { contexteBanc, ficheV6616, MOTS_DOULEUR_V6616 } from "./fiches-banc";

const FORMATS = ["vertical", "portrait", "carre", "horizontal"] as const;
const PREUVES = { "mat-compte-rendu-reunion": { phrase: "Posez-moi trois questions", testeLe: "2026-10-09" } };

function proprietes(f: FicheTableau, format: (typeof FORMATS)[number]): ProprietesTableauScene[] {
  const mots = motsRealistes(f);
  const r = calerFicheTableau(f, mots, { contexte: contexteBanc(f, MOTS_DOULEUR_V6616), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!r.ok) throw new Error(r.problemes.join(" | "));
  const m = mettreEnPage(r.fiche, { preuves: PREUVES, ...(format === "vertical" ? {} : { format }) });
  return proprietesScenes({ miseEnPage: m as unknown as MiseBrique, scenes: r.fiche.scenes as SceneCalee[], heures: r.elements, stylo: r.fiche.stylo, preuves: PREUVES, mots, temps3: tempsReference3(r.fiche, mots) });
}
/** La fiche telle que la fabrication la lit : le style posé, les pages réparées dans ce style. */
const v6616 = (style: StyleTableau): FicheTableau => pagesDuStyle({ ...ficheV6616(), styleTableau: style }) as FicheTableau;


describe("panne 3 : un chiffre extrait d'une phrase laisse une phrase correcte", () => {
  const reste = (t: string) => resteDuChiffre(t, chiffreDuTexte(t)!);
  it("chiffre au milieu : la phrase entière reste écrite (le chiffre en grand au-dessus)", () => {
    expect(reste("Ses notes partaient 3 jours après.")).toBe("Ses notes partaient 3 jours après.");
    expect(reste("Il gagne 10 minutes par mail.")).toBe("Il gagne 10 minutes par mail.");
    expect(reste("Ses notes partaient au bout de 3 jours.")).toBe("Ses notes partaient au bout de 3 jours.");
  });
  it("les formes déjà justes ne changent pas", () => {
    expect(reste("10 minutes par mail.")).toBe("par mail");
    expect(reste("Chaque mail lui prenait 10 minutes.")).toBe("par mail");
    expect(reste("Elle relit un brouillon et l'envoie : 3 minutes.")).toBe("Elle relit un brouillon et l'envoie");
  });
  for (const style of STYLES_TABLEAU)
    it(`v-6616b3800357, ${style} : l'« avant » de l'exemple dit encore quand partaient les notes`, () => {
      for (const format of FORMATS) {
        const p = proprietes(v6616(style), format).find((x) => x.scene.id === "s08")!;
        const textes = p.page.elements.filter((e) => e.elementId === "e22").flatMap((e) => e.lignes.map((l) => l.texte));
        const tout = textes.join(" ").replace(/\s+/g, " ");
        expect(tout, format).not.toMatch(/partaient après/);
        expect(tout, format).toMatch(/partaient 3 jours après/);
      }
    });
});

describe("panne 2 : un titre n'est jamais seul (trois styles)", () => {
  for (const style of STYLES_TABLEAU)
    it(`v-6616b3800357, ${style} : aucune page où le titre attend la phrase suivante`, () => {
      for (const format of FORMATS) {
        const props = proprietes(v6616(style), format);
        expect(problemesAnimation3(props).filter((x) => /Titre jamais seul/.test(x)), format).toEqual([]);
        // Page 2 : « Le compte rendu » s'écrit au rythme de la voix et « On y cherche… » suit sans attendre.
        const p2 = props.find((x) => x.page.page === 2)!;
        const plan = planPage3(p2.page, p2.styleReference!, { largeur: p2.largeur, hauteur: p2.hauteur });
        expect(titreSeulSec(plan, p2.page)!.seul, format).toBeLessThanOrEqual(TITRE_SEUL_TABLEAU_MAX_SEC);
      }
    });
  it("le contrôle mesure toujours un titre laissé seul (il n'est pas désactivé)", () => {
    const p2 = proprietes(v6616("ardoise"), "vertical").find((x) => x.page.page === 2)!;
    const plan = planPage3(p2.page, p2.styleReference!, { largeur: p2.largeur, hauteur: p2.hauteur });
    const m = titreSeulSec(plan, p2.page)!;
    // La phrase suivante retardée de 2 s : le titre reste seul, le contrôle le dit.
    for (const a of plan.actions) if (a.id === m.suivant || a.id.startsWith(`${m.suivant}~`)) a.debut += 2;
    expect(titreSeulSec(plan, p2.page)!.seul).toBeGreaterThan(TITRE_SEUL_TABLEAU_MAX_SEC);
  });
});

describe("panne 1 : une page qui ne tient pas dans le style passe d'elle-même à une page de plus", () => {
  it("la fiche gardée (l'exemple entier en page 7) ne tient pas en carré et 16:9 sur l’ardoise ; lue par la fabrication, sa dernière scène passe à la page 8, « Avant » et « Maintenant » ensemble", () => {
    const gardee = { ...ficheV6616(), styleTableau: "ardoise" as const };
    expect(gardee.scenes.find((x) => x.id === "s08")!.page).toBe(7);
    expect(() => mettreEnPage(gardee, { format: "carre" })).toThrow(/ne tient pas/);
    expect(() => mettreEnPage(gardee, { format: "horizontal" })).toThrow(/ne tient pas/);
    const lue = v6616("ardoise");
    const s07 = lue.scenes.find((x) => x.id === "s07")!;
    const s08 = lue.scenes.find((x) => x.id === "s08")!;
    expect([s07.page, s08.page]).toEqual([7, 8]);
    expect(s08.elements.flatMap((e) => (e.type === "ligne" ? [e.bloc] : []))).toEqual(["avant", "apres"]);
    for (const format of FORMATS) expect(() => mettreEnPage(lue, format === "vertical" ? {} : { format })).not.toThrow();
  });
  for (const style of STYLES_TABLEAU)
    it(`${style} : la fabrication passe (toutes les sorties), la dernière scène de la page sur une page de plus`, async () => {
      // La fiche gardée telle quelle (l'exemple entier en page 7), lue par la vraie fabrication.
      const f = { ...ficheV6616(), styleTableau: style };
      const d = doubles(f);
      const r = await fabriquerTableau({ ...d.outils, contexte: contexteBanc(f, MOTS_DOULEUR_V6616), sorties: [...IDS_SORTIES], dejaVu: { coche: true, le: "2026-10-17" } });
      expect(r.manquantes ?? []).toEqual([]);
      expect(r.sorties.map((s) => s.format)).toEqual([...IDS_SORTIES]);
    }, 120_000);
});

describe("« Reprendre la fabrication » recalcule la mise en page et les heures avec le code courant, sans repayer la voix", () => {
  it("une mise en page gardée par le code d'avant n'est pas reprise", async () => {
    const f = v6616("ardoise");
    const d = doubles(f);
    const outils = { ...d.outils, contexte: contexteBanc(f, MOTS_DOULEUR_V6616), sorties: ["vertical" as const], dejaVu: { coche: true, le: "2026-10-17" } };
    await fabriquerTableau(outils);
    expect(d.lectures()).toBe(1);
    // Le journal d'une fabrication arrêtée par le code d'avant : sa mise en page (même empreinte) est fausse.
    const j = d.journal.valeur!;
    const mise = j.etapes["mise-en-page"]!.sortie as { pages: { elements: { px: { y: number } }[] }[] };
    for (const e of mise.pages[1].elements) e.px.y += 5000;
    delete j.etapes.scenes;
    delete j.etapes.composition;
    delete j.scenes;
    delete j.composition;
    const r = await fabriquerTableau(outils);
    expect(r.etapes.find((e) => e.etape === "mise-en-page")?.statut).toBe("faite");
    expect(r.etapes.find((e) => e.etape === "voix")?.statut).toBe("reprise");
    expect(d.lectures()).toBe(1);
    expect(r.coutCentimes).toBe(0);
    // Les propriétés rendues sont celles du code courant (aucune ligne dans la bande des sous-titres).
    expect(r.controles.bloquants).toEqual([]);
  }, 120_000);
  it("rien de changé : la mise en page est reprise telle quelle", async () => {
    const f = v6616("ardoise");
    const d = doubles(f);
    const outils = { ...d.outils, contexte: contexteBanc(f, MOTS_DOULEUR_V6616), sorties: ["vertical" as const], dejaVu: { coche: true, le: "2026-10-17" } };
    await fabriquerTableau(outils);
    const r = await fabriquerTableau(outils);
    expect(r.etapes.find((e) => e.etape === "mise-en-page")?.statut).toBe("reprise");
    expect(r.etapes.find((e) => e.etape === "scenes")?.statut).toBe("reprise");
  }, 120_000);
});
