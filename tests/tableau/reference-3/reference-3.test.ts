/**
 * Style « reference/3 » (gabarit par parties, 14/10/2026) : regard de Will sur la vidéo v-f1739d6a4f51 (« pas assez
 * clair… on n'a pas dès le début le problème… c'est une douleur et une solution »). Chaque défaut vu sur le défilement
 * a son test : étiquettes de partie (jamais « problème »), accroche entière à 0 s, pages remplies, 3 blocs au plus,
 * écriture finie à la fin de la phrase dite, aucune page vide, visuels de la solution, barré réservé à l'idée reçue,
 * appel plein cadre lisible avant la fin.
 */
import { describe, expect, it } from "vitest";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { planPage3, poseCrayon3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { blocsDeLaPage, controlerAnimation3 } from "../../../src/moteurs/montage-tableau/controles-v3";
import { CONSIGNE_DECOUPAGE, habillageDe, partiesDuDecoupage, remettreEnForme, roleDecoupageTableau, variableDecoupage, type EntreeDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { STYLE_PAR_DEFAUT_TABLEAU, validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { regleGabarit } from "../../../src/moteurs/montage-tableau/gabarit";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { chapitresDesParties3, nomChapitre3 } from "../../../src/briques/tableau-scene/reference/charte";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { caleeTemoin3, contexteTemoin3, ficheTemoin3, ficheTemoin3Brute, MOTS_DOULEUR_TEMOIN } from "./fiches";

const proprietesDe = (format?: (typeof IDS_FORMATS_SORTIE)[number]) => {
  const { fiche, mots, elements } = caleeTemoin3();
  const mise = mettreEnPage(fiche, format && format !== "vertical" ? { format } : {});
  return proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: elements, stylo: fiche.stylo, mots, temps3: tempsReference3(fiche, mots) });
};
const sans = (f: FicheTableau, modif: (f: FicheTableau) => void): FicheTableau => {
  const g = structuredClone(f);
  modif(g);
  return g;
};
const refus = (f: FicheTableau) => {
  const v = validerFicheTableau(f, contexteTemoin3(f));
  return v.ok ? [] : v.problemes.map((p) => p.message);
};

describe("style par défaut et fiche témoin", () => {
  it("les nouvelles fiches naissent en « reference/3 » ; le témoin (même texte dit, mot pour mot) est valide et se cale", () => {
    expect(STYLE_PAR_DEFAUT_TABLEAU).toBe("reference/3");
    expect(habillageDe({})).toBe("reference/3");
    expect(refus(ficheTemoin3())).toEqual([]);
    expect(caleeTemoin3().fiche.scenes.length).toBeGreaterThan(8);
  });

  it("la réparation automatique coupe une page de 4 blocs (la scène trop chargée passe à une page de plus)", () => {
    const f = ficheTemoin3Brute();
    expect(f.scenes.find((s) => s.id === "s05")!.elements.length).toBe(7);
    const r = remettreEnForme(f, { motsDouleur: MOTS_DOULEUR_TEMOIN });
    expect(refus(r)).toEqual([]);
  });
});

describe("règle 18 au style « reference/3 »", () => {
  const f = ficheTemoin3();
  it("aucune page « problème » : le rôle est refusé, avec ce qu'il faut faire", () => {
    const g = sans(f, (x) => (x.scenes[1].gabarit = { role: "probleme" }));
    expect(refus(g).some((m) => /jamais de page « problème »/.test(m))).toBe(true);
  });
  it("la page 1 est l'accroche, écrite au mot 0 ; la dernière page est l'appel", () => {
    expect(refus(sans(f, (x) => (x.scenes[0].gabarit = { role: "douleur" }))).some((m) => /page 1 est l'ACCROCHE/.test(m))).toBe(true);
    expect(refus(sans(f, (x) => (x.scenes.at(-1)!.gabarit = { role: "retenir" }))).some((m) => /dernière page est la page d'APPEL/.test(m))).toBe(true);
  });
  it("3 blocs au plus par page (une liste compte pour un)", () => {
    const g = sans(f, (x) => {
      const s = x.scenes.find((y) => y.gabarit?.role === "douleur")!;
      s.elements.push({ id: "e99", type: "ligne", texte: "Vous l'apprenez par hasard.", niveau: "texte", role: "regle", bloc: "detail", ancre: 0 });
    });
    expect(refus(g).some((m) => /blocs ; 3 au plus/.test(m) || /4 blocs/.test(m))).toBe(true);
  });
  it("seule une idée reçue est barrée", () => {
    const g = sans(f, (x) => {
      const l = x.scenes[1].elements.find((e) => e.type === "ligne" && e.bloc === "phrase-cle");
      if (l && l.type === "ligne") l.marque = "barre";
    });
    expect(refus(g).some((m) => /seule une idée reçue/.test(m))).toBe(true);
  });
  it("visuels : pastille sans couleur, transformation sans flèche refusées", () => {
    const g = sans(f, (x) => {
      for (const s of x.scenes)
        for (const e of s.elements) {
          if (e.type === "ligne" && e.bloc === "code") delete e.code;
          if (e.type === "ligne" && e.bloc === "transformation") e.texte = e.texte.replace("→", "devient");
        }
    });
    const r = refus(g);
    expect(r.some((m) => /n'a pas de « code »/.test(m))).toBe(true);
    expect(r.some((m) => /s'écrit « avant → après »/.test(m))).toBe(true);
  });
  it("au style « reference/2 », les parties et les blocs de « reference/3 » sont refusés", () => {
    const g = { ...f, habillage: "reference/2" };
    expect(regleGabarit(g).some((m) => /n'existe qu'au style « reference\/3 »/.test(m.detail))).toBe(true);
  });
});

describe("mise en page, dans les quatre sorties", () => {
  const f = ficheTemoin3();
  for (const format of IDS_FORMATS_SORTIE) {
    it(`${format} : chapitre nommé pour chaque page, jamais « problème », 3 blocs au plus, page remplie à 60 %, contrôles réussis`, () => {
      const m = mettreEnPage(f, format === "vertical" ? {} : { format });
      expect(m.styleReference?.style).toBe("reference/3");
      // Barre des chapitres nommés en haut de la zone sûre, ses noms dessous ; aucun contenu n'y monte.
      const r = m.styleReference!;
      const z = m.zoneSure.px;
      const n = r.nomsChapitres!;
      expect(r.barre!.y).toBeGreaterThanOrEqual(z.y);
      expect(r.barre!.x + r.barre!.largeur).toBeLessThanOrEqual(z.x + z.largeur);
      expect(n.y).toBeGreaterThanOrEqual(r.barre!.y + r.barre!.hauteur);
      const chapitres = chapitresDesParties3(m.pages.map((p) => r.parties?.[p.page] ?? "")).map(nomChapitre3);
      m.pages.forEach((p, i) => {
        expect(chapitres[i], `page ${p.page}`).toMatch(/^(Douleur|Solution|Exemple|À vous)$/);
        for (const e of p.elements) expect(e.encombrement.px.y, e.elementId).toBeGreaterThanOrEqual(n.y + n.hauteur);
        const partie = p.elements.find((e) => e.gabarit?.sorte === "partie");
        if (partie) expect(partie.lignes[0].texte).toBe("Exemple illustratif");
      });
      for (const p of m.pages) {
        expect(blocsDeLaPage(p).length).toBeLessThanOrEqual(3);
        expect(p.occupation).toBeGreaterThanOrEqual(0.6);
      }
      expect(JSON.stringify(m.pages)).not.toMatch(/probl[eè]me/i);
      const lignes = controlerImageSortie(f, { id: format, libelle: format, options: format === "vertical" ? {} : { format } });
      const echecs = lignes.filter((l) => l.etat === "echoue" && l.bloquant);
      expect(echecs.map((l) => `${l.libelle} : ${l.raison}`)).toEqual([]);
    });
  }

  it("l'accroche est alignée à gauche (maquette A), en très grand (112 px de référence au moins), ses mots de la douleur repérés", () => {
    const m = mettreEnPage(f, {});
    const a = m.pages[0].elements.find((e) => e.gabarit?.sorte === "accroche")!;
    expect(a.taillePx).toBeGreaterThanOrEqual(112);
    if (a.gabarit?.sorte !== "accroche") throw new Error("accroche");
    expect(a.gabarit.mots.length).toBeGreaterThanOrEqual(3);
    expect(a.gabarit.couleur).toBe("#993F1E"); // orange assombri des traits du crayon (contraste, 15/10)
    const z = m.zoneSure.px;
    expect(a.lignes.every((l) => l.px.x === a.lignes[0].px.x)).toBe(true);
    expect(a.lignes[0].px.x - z.x).toBeLessThan(40);
  });

  it("la solution est montrée : pastilles à l'encre (✓ / ✎ / ✕), cases à cocher, « M. Dupont → Client A » dans une carte", () => {
    const m = mettreEnPage(f, {});
    const sortes = m.pages.flatMap((p) => p.elements.map((e) => e.gabarit));
    expect(sortes.filter((g) => g?.sorte === "code").map((g) => (g?.sorte === "code" ? g.code : ""))).toEqual(["vert", "orange", "rouge"]);
    expect(sortes.filter((g) => g?.sorte === "case").length).toBeGreaterThanOrEqual(8);
    const t = m.pages.flatMap((p) => p.elements).find((e) => e.gabarit?.sorte === "transformation")!;
    expect(t.lignes.map((l) => l.texte)).toEqual(["M. Dupont", "Client A"]);
    if (t.gabarit?.sorte !== "transformation") throw new Error("transformation");
    expect(t.gabarit.fond).toBe("#ECE1D0");
    expect(sortes.filter((g) => g?.sorte === "code").every((g) => g?.sorte === "code" && g.couleur === "#110A05")).toBe(true);
  });

  it("la page d'appel garde le fond ivoire : la phrase finale en grand (fin en orange), le bouton, axion-ia.com dessous", () => {
    const m = mettreEnPage(f, {});
    const p = m.pages.at(-1)!;
    const appel = p.elements.find((e) => e.gabarit?.sorte === "appel-plein")!;
    if (appel.gabarit?.sorte !== "appel-plein") throw new Error("appel");
    expect(appel.gabarit.fond).toBe("#F6F1E8");
    expect(appel.gabarit.accent).toBe(appel.lignes.length - 1);
    expect(appel.lignes.map((l) => l.texte).join(" ")).not.toMatch(/réservez/i);
    expect(appel.taillePx).toBeGreaterThanOrEqual(90);
    const bouton = p.elements.find((e) => e.gabarit?.sorte === "bouton")!;
    expect(bouton.lignes.map((l) => l.texte).join(" ")).toBe("Réservez un appel de diagnostic");
    expect(bouton.couleurTexte).toBe("#F6F1E8");
    expect(p.elements.some((e) => e.lignes.some((l) => l.texte === "axion-ia.com"))).toBe(true);
  });
});

describe("animation (heures d'une voix réaliste)", () => {
  it("contrôles : accroche pleine à 0 s, blocs écrits à l'heure, aucune page vide, appel lisible ≥ 2,5 s — dans les quatre sorties", () => {
    for (const format of IDS_FORMATS_SORTIE) {
      const c = controlerAnimation3(proprietesDe(format));
      expect(c.map((x) => x.libelle)).toEqual(["Accroche pleine à 0 s", "Blocs écrits à l'heure", "Aucune page vide", "Titre jamais seul", "Appel lisible", "Appel à l'heure et animé"]);
      expect(c.flatMap((x) => x.fautes.map((f) => `${format} · ${x.libelle} : ${f.message}`))).toEqual([]);
    }
  });

  it("les mots de la douleur sont entourés PENDANT que la voix les dit", () => {
    const props = proprietesDe();
    const p = props[0];
    const plan = planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
    const t3 = p.styleReference!.temps3!;
    const entoures = plan.actions.filter((a) => a.trace === "entoure");
    expect(entoures.length).toBeGreaterThanOrEqual(3);
    const premier = entoures[0];
    expect(Math.abs(premier.debut - t3[`${premier.id}~mot:0`] / 1000)).toBeLessThan(0.1);
  });

  it("chaque nouvelle page arrive en « fondu + montée » depuis la page d'avant ; le crayon ne tremble pas", () => {
    const props = proprietesDe();
    const ouvertures = props.filter((p, i) => i > 0 && props[i - 1].scene.page !== p.scene.page);
    expect(ouvertures.every((p) => p.pagePrecedente)).toBe(true);
    // Au repos entre deux actions, le crayon reste exactement immobile (aucun tremblement), puis glisse.
    let repos = 0;
    for (const p of props) {
      const plan = planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
      plan.actions.forEach((a, i) => {
        const b = plan.actions[i + 1];
        const fin = a.debut + a.duree;
        if (!b || b.debut - fin < 0.45 || b.debut - fin > 0.85) return;
        expect(poseCrayon3(plan, fin + 0.05)).toEqual(poseCrayon3(plan, fin + 0.2));
        repos++;
      });
    }
    expect(repos).toBeGreaterThan(0);
  });

  it("la fin : « À retenir » court (4 s au plus), puis l'appel", () => {
    const { fiche } = caleeTemoin3();
    const retenir = fiche.scenes.filter((s) => s.gabarit?.role === "retenir");
    expect(retenir.reduce((d, s) => d + s.finMs! - s.debutMs!, 0)).toBeLessThanOrEqual(4000);
    expect(fiche.scenes.at(-1)!.gabarit?.role).toBe("appel");
  });
});

describe("découpage : consigne version 12 et parties du script", () => {
  it("la consigne décrit le gabarit par parties, sans page « problème », avec l'exemple validé (15/10)", () => {
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(14);
    expect(CONSIGNE_DECOUPAGE).toMatch(/GABARIT PAR PARTIES/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/JAMAIS de page « problème »/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/M\. Dupont → Client A/);
  });
  it("les parties du générateur, quand elles sont données, vont dans la demande ; mal formées, elles sont ignorées", () => {
    // Lecture au contrat exact (REGLES § 9) : une entrée mal formée rend le tout illisible (le texte est relu sans elles).
    expect(partiesDuDecoupage([{ partie: "douleur", libelle: "Douleur", texte: "Vous ne le savez pas.", ecran: ["Vous ne le savez pas"] }])).toEqual([{ partie: "douleur", libelle: "Douleur", texte: "Vous ne le savez pas.", ecran: ["Vous ne le savez pas"] }]);
    expect(partiesDuDecoupage([{ partie: "douleur", libelle: "Douleur", texte: "Vous ne le savez pas.", ecran: [] }, { x: 1 }])).toBeUndefined();
    expect(partiesDuDecoupage("non")).toBeUndefined();
    const f = ficheTemoin3();
    const e: EntreeDecoupage = { texteScript: "x", structure: f.structure, serie: f.serie, douleur: f.douleur, gesteMinute: f.gesteMinute, preuves: [], dessins: [], videoId: "v", versionId: "r", stylo: "crayon/1", ratio: "9:16", controle: contexteTemoin3(f) };
    expect(variableDecoupage(e)).not.toMatch(/<parties>/);
    expect(variableDecoupage({ ...e, parties: [{ partie: "accroche", libelle: "Accroche", texte: "Un salarié…", ecran: [] }] })).toMatch(/<parties>\naccroche · Accroche · Un salarié…\n<\/parties>/);
  });
});
