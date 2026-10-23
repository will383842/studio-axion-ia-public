/**
 * DESSIN 4 · LES QUATRE VIDÉOS RÉELLES fabriquées le 12/10/2026 (`temoins/fiche-*-prod.json`, remises en forme comme en
 * production), jugées dans les cinq sorties (vertical, vertical de TikTok et Shorts, portrait, carré, horizontal).
 * L'ANCIEN rendu (`anciens.json.gz`, mise en page d'avant ce dessin, figée par `anciens.mts`) est REFUSÉ par les
 * contrôles ; le nouveau est accepté. Aucun appel.
 *  1. texte coupé ou recouvert (rendu sans volet, tampons jamais l'un sur l'autre) ;
 *  2. grands cadres vides (cartes réduites à ce qu'elles montrent, qui arrivent avec leur contenu) ;
 *  3. pictogrammes : seulement ceux de la fiche, jamais un rond vide ; sinon le texte grandit ;
 *  4. récapitulatif : chaque ligne écrite une fois ; barre des étapes lisible ;
 *  5. exemple : AVANT / APRÈS selon le préfixe des lignes, jamais selon l'ordre ;
 *  6. semaine seulement si elle a de quoi remplir ses jours ;
 *  7. fin : ÉCRIVEZ / MOT / EN COMMENTAIRE en très gros, quel que soit le format.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { cadresVidesV2, controleRemplissageV2, etiquettesIncoherentesV2, pictogrammesFautifsV2, textesCoupesV2, textesEnDoubleV2 } from "../../../src/briques/tableau-scene/v2/remplissage";
import type { EcranPlace, GeometrieV2 } from "../../../src/briques/tableau-scene/v2/types";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { FICHES_REELLES, SORTIES, ficheReelle, optionsSortie, type NomFicheReelle, type Sortie } from "./fiches-reelles";

type Mise = { geometrie: GeometrieV2; ecrans: EcranPlace[] };
const anciens = JSON.parse(gunzipSync(readFileSync(new URL("./anciens.json.gz", import.meta.url))).toString()) as Record<string, Mise>;
const fiches = Object.fromEntries(FICHES_REELLES.map((f) => [f.nom, ficheReelle(f.nom)])) as Record<NomFicheReelle, FicheTableau>;
const nouveaux = new Map<string, Mise>();
const nouveau = (nom: NomFicheReelle, s: Sortie): Mise => {
  const cle = `${nom}/${s}`;
  if (!nouveaux.has(cle)) nouveaux.set(cle, mettreEnPage(fiches[nom], optionsSortie(fiches[nom], s)).styleV2!);
  return nouveaux.get(cle)!;
};
const ancien = (nom: NomFicheReelle, s: Sortie) => anciens[`${nom}/${s}`];
const ecran = (m: Mise, id: string) => m.ecrans.find((e) => e.id === id)!;
const dessinsDe = (nom: NomFicheReelle, scene: string) => new Set(fiches[nom].scenes.find((x) => x.id === scene)!.elements.flatMap((x) => (x.type === "dessin" ? [x.dessinId] : [])));

/** Toutes les fautes des contrôles du dessin, écran par écran. */
function fautes(nom: NomFicheReelle, m: Mise): Record<string, string[]> {
  const g = m.geometrie;
  const r: Record<string, string[]> = { vide: [], cadre: [], coupe: [], picto: [], etiquette: [], double: [] };
  for (const e of m.ecrans) {
    const v = controleRemplissageV2(e, g);
    if (v) r.vide.push(v);
    r.cadre.push(...cadresVidesV2(e, g).map((x) => `${e.id} ${x}`));
    r.coupe.push(...textesCoupesV2(e, g).map((x) => `${e.id} ${x}`));
    r.picto.push(...pictogrammesFautifsV2(e, dessinsDe(nom, e.sceneId)).map((x) => `${e.id} ${x}`));
    r.etiquette.push(...etiquettesIncoherentesV2(e).map((x) => `${e.id} ${x}`));
    r.double.push(...textesEnDoubleV2(e).map((x) => `${e.id} « ${x} »`));
  }
  return r;
}
const toutes = (r: Record<string, string[]>) => Object.values(r).flat();

describe("chaque fiche réelle, chaque sortie : l'ancien rendu est refusé, le nouveau accepté", () => {
  for (const { nom } of FICHES_REELLES)
    for (const s of SORTIES)
      it(`${nom} · ${s}`, () => {
        const a = fautes(nom, ancien(nom, s));
        // Toujours au moins un pictogramme de remplissage (rond avec flèche, étoile…) ou un rond qui arrivait vide.
        expect(a.picto.length, "ancien : pictogrammes").toBeGreaterThan(0);
        expect(toutes(a).length).toBeGreaterThan(0);
        expect(toutes(fautes(nom, nouveau(nom, s)))).toEqual([]);
      });

  it("les contrôles de la relecture refusent l'ancien défaut et passent sur le nouveau rendu (lignes nommées)", () => {
    for (const { nom } of FICHES_REELLES)
      for (const s of SORTIES) {
        const fiche = fiches[nom];
        const lignes = controlerImageSortie(fiche, { id: s, libelle: s, fiche, options: optionsSortie(fiche, s) });
        for (const libelle of ["Écran rempli", "Texte écrit une fois", "Cadre rempli", "Pictogrammes de la fiche", "Texte entier", "Avant / après"]) {
          const l = lignes.find((x) => x.libelle === libelle);
          expect.soft(l?.etat, `${nom} · ${s} · ${libelle} : ${l?.raison}`).toBe("reussi");
        }
      }
  }, 120_000);
});

describe("1. texte jamais coupé ni recouvert", () => {
  it("le rendu ne montre plus un texte derrière un volet (entrée et sortie en fondu, glissé court)", () => {
    const rendu = readFileSync(new URL("../../../studio-rendu/compositions/tableau/v2/EcranV2.tsx", import.meta.url), "utf8");
    expect(rendu).not.toMatch(/masqueX/);
    expect(rendu).not.toMatch(/-760 \* k/);
    expect(rendu).not.toMatch(/-1300 \* k/);
    expect(rendu).toMatch(/ENTREE_GAUCHE_PX = 70/);
  });

  it("taches-repetitives, vertical, scène 1 : les trois tampons ne sont plus l'un sur l'autre", () => {
    expect(textesCoupesV2(ecran(ancien("taches-repetitives", "vertical"), "s01~e0"), ancien("taches-repetitives", "vertical").geometrie).join(" ")).toMatch(/se recouvrent/);
    const m = nouveau("taches-repetitives", "vertical");
    expect(textesCoupesV2(ecran(m, "s01~e0"), m.geometrie)).toEqual([]);
  });

  it("le contrôle repère un texte hors de l'image, hors de son cadre ou sur un autre", () => {
    const m = nouveau("consigne-ia", "vertical");
    const e = ecran(m, "s01~e0");
    const t = e.textes.find((x) => !x.horsContenu && !x.rotation)!;
    expect(textesCoupesV2({ ...e, textes: [...e.textes, { ...t, id: "x", source: "x", x: -40 }] }, m.geometrie).join(" ")).toMatch(/sort de l'image/);
    expect(textesCoupesV2({ ...e, textes: [...e.textes, { ...t, id: "x", source: "x", x: t.x + 4 }] }, m.geometrie).join(" ")).toMatch(/se recouvrent/);
    const carte = e.formes.find((f) => f.sorte === "carte")!;
    expect(textesCoupesV2({ ...e, textes: [...e.textes, { ...t, id: "x", source: "x", x: carte.x + carte.largeur - 120, y: carte.y + 20, largeur: 300 }] }, m.geometrie).join(" ")).toMatch(/déborde de son cadre/);
  });
});

describe("2. jamais un grand cadre vide", () => {
  it("consigne-ia scène 2 et habitude-equipe scène 2 : la carte de l'idée reçue s'arrête à ce qu'elle montre", () => {
    for (const [nom, id] of [["consigne-ia", "s02~e0"], ["habitude-equipe", "s02~e0"]] as const)
      for (const s of ["vertical"] as const) {
        const a = ancien(nom, s);
        expect(cadresVidesV2(ecran(a, id), a.geometrie).join(" "), `${nom} ${s}`).toMatch(/est vide aux/);
        const m = nouveau(nom, s);
        const e = ecran(m, id);
        expect(cadresVidesV2(e, m.geometrie)).toEqual([]);
        expect(e.formes.filter((f) => f.sorte === "carte").every((f) => !f.horsZone && f.y + f.hauteur <= m.geometrie.bande.y)).toBe(true);
      }
  });

  it("aucune carte n'arrive vide : celle de l'exemple et de l'idée reçue attend son contenu", () => {
    for (const { nom } of FICHES_REELLES)
      for (const s of SORTIES)
        for (const e of nouveau(nom, s).ecrans.filter((x) => x.gabarit === "exemple" || x.gabarit === "idee-recue")) {
          const carte = e.formes.find((f) => f.id === `${e.id}#carte`);
          if (!carte) continue;
          expect(carte.attend, `${nom} ${s} ${e.id}`).toBeTruthy();
          expect([...e.formes, ...e.textes].some((x) => x.id === carte.attend)).toBe(true);
        }
  });
});

describe("3. pictogrammes : ceux de la fiche seulement, jamais un rond vide", () => {
  it("l'ancien rendu montrait des pictogrammes génériques (engrenage, étoile, flèche…) ; le nouveau aucun", () => {
    const generiques = new Set<string>();
    for (const { nom } of FICHES_REELLES)
      for (const s of SORTIES) {
        for (const e of ancien(nom, s).ecrans) for (const f of e.formes) if (f.sorte === "dessin" && !dessinsDe(nom, e.sceneId).has(f.dessin!)) generiques.add(f.dessin!);
        for (const e of nouveau(nom, s).ecrans) for (const f of e.formes) if (f.sorte === "dessin") expect(dessinsDe(nom, e.sceneId).has(f.dessin!), `${nom} ${s} ${e.id} ${f.dessin}`).toBe(true);
      }
    for (const d of ["engrenage", "etoile", "fleche-droite"]) expect(generiques.has(d), d).toBe(true);
  });

  it("le contrôle refuse un rond sans pictogramme et un rond qui arrive avant le sien", () => {
    const m = nouveau("relances", "vertical");
    const e = ecran(m, "s03~e0");
    const autorises = dessinsDe("relances", "s03");
    expect(pictogrammesFautifsV2(e, autorises)).toEqual([]);
    expect(pictogrammesFautifsV2({ ...e, formes: e.formes.filter((f) => f.sorte !== "dessin") }, autorises).join(" ")).toMatch(/rond vide/);
    expect(pictogrammesFautifsV2({ ...e, formes: e.formes.map((f) => (f.sorte === "dessin" ? { ...f, decalageMs: 120 } : f)) }, autorises).join(" ")).toMatch(/arrive avant son pictogramme/);
    expect(pictogrammesFautifsV2(e, new Set()).join(" ")).toMatch(/absent de la fiche/);
  });

  it("relances (vidéo validée) : les étapes gardent les pictogrammes de leur fiche, sans pictogramme ajouté", () => {
    for (const s of ["vertical", "portrait"] as const)
      for (const [scene, dessins] of [["s03", ["crayon", "calendrier"]], ["s04", ["enveloppe", "horloge"]], ["s05", ["bulle", "gomme"]]] as const) {
        const e = ecran(nouveau("relances", s), `${scene}~e0`);
        expect(e.formes.filter((f) => f.sorte === "dessin").map((f) => f.dessin)).toEqual(dessins);
      }
  });
});

describe("4. récapitulatif écrit une fois, barre des étapes lisible", () => {
  it("consigne-ia : « Livrable, lecteur » et « Critère, interdit » ne sont plus écrits au-dessus de la liste", () => {
    for (const s of SORTIES) {
      const a = ecran(ancien("consigne-ia", s), "s09~e0");
      expect(textesEnDoubleV2(a).length, s).toBeGreaterThan(0);
      const e = ecran(nouveau("consigne-ia", s), "s09~e0");
      expect(textesEnDoubleV2(e)).toEqual([]);
      expect(e.textes.filter((t) => /#rt\d+$/.test(t.id)).map((t) => t.texte)).toEqual(["LIVRABLE", "LECTEUR", "CRITÈRE", "INTERDIT"]);
      expect(e.textes.some((t) => /^e4[01]#/.test(t.id))).toBe(false);
    }
  });

  it("taches-repetitives en portrait (5 étapes) : l'étape en cours garde son nom entier, rien sous 18 px", () => {
    const m = nouveau("taches-repetitives", "portrait");
    for (const [id, nom] of [["s03~e0", "1 · FEUILLE"], ["s06~e0", "5 · ENTRÉE, SORTIE"]]) {
      const e = ecran(m, id);
      const barre = e.textes.filter((t) => t.id.startsWith("barre#t"));
      expect(barre.map((t) => t.texte)).toContain(nom);
      for (const t of barre) expect(t.taille).toBeGreaterThanOrEqual(18 * m.geometrie.k - 0.1);
    }
  });
});

describe("5. exemple : AVANT / APRÈS selon les lignes de la fiche", () => {
  it("habitude-equipe scène 8 : plus de « AVANT » sur « Fin du mois : toute l'agence »", () => {
    for (const s of SORTIES) {
      expect(etiquettesIncoherentesV2(ecran(ancien("habitude-equipe", s), "s08~e0")).join(" "), s).toMatch(/AVANT/);
      const e = ecran(nouveau("habitude-equipe", s), "s08~e0");
      expect(etiquettesIncoherentesV2(e)).toEqual([]);
      expect(e.textes.find((t) => t.id === "s08~e0#ave")?.texte).toBe("FIN DU MOIS");
    }
  });

  it("consigne-ia scène 7 : « Paragraphes polis, à réécrire » n'est plus sous « APRÈS » ; habitude-equipe scène 7 : avant et après suivent leurs lignes", () => {
    for (const s of SORTIES) {
      expect(etiquettesIncoherentesV2(ecran(ancien("consigne-ia", s), "s07~e0")).join(" ")).toMatch(/APRÈS/);
      const c = ecran(nouveau("consigne-ia", s), "s07~e0");
      expect(etiquettesIncoherentesV2(c)).toEqual([]);
      expect(c.textes.some((t) => t.texte === "APRÈS")).toBe(false);
      const h = ecran(nouveau("habitude-equipe", s), "s07~e0");
      const texte = (p: string) => h.textes.filter((t) => t.id.startsWith(`s07~e0#${p}t`)).map((t) => t.texte).join(" ");
      expect(texte("av")).toMatch(/^Avant :/);
      expect(texte("ap")).toMatch(/^Après :/);
    }
  });
});

describe("6. semaine seulement si elle remplit ses jours", () => {
  it("taches-repetitives scène 2 : plus une carte « L » perdue dans un grand vide", () => {
    for (const s of SORTIES) {
      expect(ecran(ancien("taches-repetitives", s), "s02~e1").gabarit).toBe("semaine");
      const e = ecran(nouveau("taches-repetitives", s), "s02~e1");
      expect(e.gabarit).not.toBe("semaine");
      expect(e.textes.some((t) => t.texte === "L")).toBe(false);
    }
  });
});

describe("7. la fin a toujours la hiérarchie de la première vidéo", () => {
  for (const { nom } of FICHES_REELLES)
    it(`${nom} : ÉCRIVEZ / le mot en très gros / EN COMMENTAIRE (une rangée), puis la bulle, dans les quatre formats`, () => {
      for (const s of ["vertical", "portrait", "carre", "horizontal"] as const) {
        const e = nouveau(nom, s).ecrans.at(-1)!;
        expect(e.gabarit).toBe("appel-commentaire");
        const titres = e.textes.filter((t) => /^[^#]+#\d+\.\d+$/.test(t.id));
        const mot = titres.filter((t) => t.source.endsWith("~mot"));
        const apres = titres.filter((t) => t.source.endsWith("~apres"));
        const ecrivez = titres.filter((t) => titres.some((m) => m.source === `${t.source}~mot`));
        expect(mot.map((t) => t.texte).join(" "), s).toBe(fiches[nom].scenes.at(-1)!.ecrans![0].motCommentaire!.toLocaleUpperCase("fr-FR"));
        expect(ecrivez.map((t) => t.texte).join(" ")).toBe("ÉCRIVEZ");
        expect(apres.map((t) => t.texte).join(" ")).toBe("EN COMMENTAIRE");
        // « EN COMMENTAIRE » sur une seule rangée ; le mot le plus grand ; les autres lignes plus petites qu'« ÉCRIVEZ ».
        expect(new Set(apres.map((t) => t.y)).size).toBe(1);
        const tMot = Math.min(...mot.map((t) => t.taille));
        for (const t of titres.filter((x) => !mot.includes(x))) expect(t.taille, `${s} ${t.texte}`).toBeLessThanOrEqual(tMot + 0.1);
        for (const t of titres.filter((x) => !mot.includes(x) && !apres.includes(x) && !ecrivez.includes(x))) expect(t.taille).toBeLessThan(ecrivez[0].taille);
        expect(e.formes.some((f) => f.id === `${e.id}#bulle`)).toBe(true);
      }
    });
});
