/**
 * DÉCOUPAGE ET GABARIT AU GABARIT CADRÉ DES SCRIPTS (15/10/2026) : l'exemple validé par Will (« Ce devis collé dans
 * ChatGPT contient trois données de trop »), découpé comme le ferait la consigne version 12 (fiche de test,
 * `temoins/fiche-gabarit-cadre-reference-3.json`), passe les règles, se cale sur une voix posée (16,5 caractères par
 * seconde) et se met en page dans les quatre sorties sans échec bloquant. « À retenir » = l'idée en une phrase (plus de
 * liste des étapes obligatoire), « Étape x sur N » avec le vrai N, et une page trop vide n'est plus un refus qui fait
 * ajouter du texte.
 */
import { describe, expect, it } from "vitest";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { CONSIGNE_DECOUPAGE } from "../../../src/moteurs/montage-tableau/decoupage";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { regleGabarit } from "../../../src/moteurs/montage-tableau/gabarit";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { exempleV4 } from "../../tableau-scripts/exemples-v4";
import { texteDitDe } from "../../../src/domaine/scripts-tableau-controles";
import { CPS_VOIX_POSEE, caleeGabaritCadre, contexteGabaritCadre, ficheGabaritCadre } from "./fiches";
import { ficheReference2 } from "../reference-2/fiches";
import { chapitresDesParties3, nomChapitre3 } from "../../../src/briques/tableau-scene/reference/charte";

const refus = (f: FicheTableau) => {
  const v = validerFicheTableau(f, contexteGabaritCadre(f));
  return v.ok ? [] : v.problemes.map((p) => p.message);
};

describe("l'exemple validé passe le découpage et la mise en page", () => {
  it("la fiche dit le script validé mot pour mot, passe toutes les règles et se cale sur une voix posée", () => {
    const f = ficheGabaritCadre();
    expect(f.scenes.map((s) => s.texteDit).join(" ")).toBe(texteDitDe(exempleV4("01-formation").ecriture.script));
    expect(refus(f)).toEqual([]);
    const c = caleeGabaritCadre();
    expect(CPS_VOIX_POSEE).toBeGreaterThanOrEqual(16);
    expect(CPS_VOIX_POSEE).toBeLessThanOrEqual(17);
    expect(c.mots.at(-1)!.finSec).toBeGreaterThan(70);
    expect(c.mots.at(-1)!.finSec).toBeLessThan(90);
  });

  it("six passages, une page par étape, « Étape x sur 3 » avec le vrai nombre d'étapes", () => {
    // Charte Axion (#251) : la partie est nommée par la barre des chapitres ; « Étape x sur N » suit la pastille d'étape,
    // « Exemple illustratif » reste écrit en repère sur la page de l'exemple.
    const mise = mettreEnPage(caleeGabaritCadre().fiche);
    const r = mise.styleReference!;
    const chapitres = chapitresDesParties3(mise.pages.map((p) => r.parties?.[p.page] ?? "")).map(nomChapitre3);
    const etiquettes = mise.pages.map((p, i) => {
      const pastille = p.elements.find((x) => x.gabarit?.sorte === "pastille")?.gabarit;
      const partie = p.elements.find((x) => x.gabarit?.sorte === "partie");
      return [r.parties?.[p.page], chapitres[i], pastille?.sorte === "pastille" ? pastille.etape?.texte : undefined, partie?.lignes.map((l) => l.texte).join(" ")].filter(Boolean).join(" · ");
    });
    expect(etiquettes).toEqual([
      "accroche · Douleur",
      "douleur · Douleur",
      "douleur · Douleur",
      "solution · Solution",
      "solution · Solution · Étape 1 sur 3",
      "solution · Solution · Étape 2 sur 3",
      "solution · Solution · Étape 3 sur 3",
      "exemple · Exemple · Exemple illustratif",
      "retenir · À vous",
      "appel · À vous",
    ]);
  });

  for (const format of ["vertical", "portrait", "carre", "horizontal"] as const) {
    it(`${format} : aucun échec bloquant ; « Page remplie » n'est jamais bloquant et ne demande pas d'ajouter du texte`, () => {
      const lignes = controlerImageSortie(caleeGabaritCadre().fiche, { id: format, libelle: format, options: format === "vertical" ? {} : { format } });
      expect(lignes.filter((l) => l.etat === "echoue" && l.bloquant).map((l) => `${l.libelle} : ${l.raison}`)).toEqual([]);
      const remplie = lignes.find((l) => l.libelle === "Page remplie")!;
      expect(remplie.bloquant).toBe(false);
      if (remplie.etat === "echoue") {
        expect(remplie.raison).toMatch(/Rien à réécrire/);
        expect(remplie.raison).not.toMatch(/ajoutez/i);
      }
    });
  }
});

describe("« À retenir » = l'idée en une phrase (gabarit.ts, gabarit-3.ts)", () => {
  it("reference/3 : une seule phrase clé suffit ; une page « À retenir » vide est refusée ; une ancienne liste reste permise", () => {
    const f = ficheGabaritCadre();
    const retenir = f.scenes.find((s) => s.gabarit?.role === "retenir")!;
    expect(retenir.elements.map((e) => (e.type === "ligne" ? e.bloc : e.type))).toEqual(["phrase-cle"]);
    expect(refus(f)).toEqual([]);
    const vide = structuredClone(f);
    vide.scenes.find((s) => s.gabarit?.role === "retenir")!.elements = [{ id: "e42", type: "dessin", dessinId: "ampoule", cote: "droite", ancre: 0 }];
    expect(refus(vide).some((m) => /« À retenir » écrit l'idée de la vidéo/.test(m))).toBe(true);
    const liste = structuredClone(f);
    liste.scenes.find((s) => s.gabarit?.role === "retenir")!.elements = [{ id: "e42", type: "ligne", texte: "Rien qui reconnaisse le client", niveau: "texte", role: "regle", bloc: "liste", ancre: 0 }];
    expect(refus(liste).filter((m) => /retenir/i.test(m))).toEqual([]);
  });

  it("reference/2 : la page « À retenir » peut écrire l'idée en phrase clé au lieu de la liste des étapes", () => {
    const f = ficheReference2("relances");
    const s = f.scenes.find((x) => x.id === "s08")!;
    s.texteDit = "Écrites une fois. Programmées. Supprimées dès la réponse.";
    s.elements = s.elements.map((e) => (e.type === "ligne" && e.bloc === "liste" && e.id === "e31" ? { ...e, bloc: "phrase-cle" as const, texte: "Écrites une fois, programmées, supprimées dès la réponse." } : e)).filter((e) => !(e.type === "ligne" && e.bloc === "liste"));
    expect(regleGabarit(f).filter((m) => /retenir/i.test(m.detail))).toEqual([]);
    s.elements = s.elements.filter((e) => !(e.type === "ligne" && e.bloc === "phrase-cle"));
    expect(regleGabarit(f).some((m) => /écrit l'idée de la vidéo/.test(m.detail))).toBe(true);
  });
});

describe("consigne du découpage (version 12)", () => {
  it("suit les six passages et 2 à 3 constats « ce qui change » (lot B2b) ; « À retenir » est l'idée ; jamais de texte ajouté pour remplir une page", () => {
    expect(CONSIGNE_DECOUPAGE).toMatch(/LE SCRIPT SUIT SIX PASSAGES/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/2 à 3 constats/);
    expect(CONSIGNE_DECOUPAGE).not.toMatch(/2 à 5 étapes|PAR ÉTAPE \(2 à 5\)/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/« À RETENIR » : L'IDÉE en UNE phrase clé/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/N'ajoute JAMAIS de texte écrit qui n'est pas dit pour la remplir/);
  });
  it("ne prend plus pour exemples les scripts refusés ni l'ancienne structure", () => {
    for (const ancien of ["Le vrai problème :", "Interdire ne sert à rien", "Listez. Classez. Montrez.", "Le geste avant l'erreur", "Le problème n'est pas leur mémoire", "« Le vrai problème »", "Relisez. Écrivez une fois. Rangez.", '"texte":"Le problème"', "Ce n'est pas leur mémoire", "Prenons un plombier", "« Listez »", '"role":"idee-recue"'])
      expect(CONSIGNE_DECOUPAGE, ancien).not.toContain(ancien);
    expect(CONSIGNE_DECOUPAGE).toContain("Le seul qui connaît ce dossier client est en congé.");
  });
});
