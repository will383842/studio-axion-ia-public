/**
 * Tests directs de 8 fonctions exportées de `regles.ts` (tableau animé) qui n'étaient appelées par aucun test par leur
 * nom : sceneAppelPermis, instantAncre, motsClesDouleur, motsDouleurCherches, regleAccrocheCourte, regleTailleTexte,
 * regleFormeEnPlusDeLaCouleur, momentsDuStylo. Entrées construites à la main, dates fixes, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { TENUE_FIN_TOTALE_MS } from "../../../src/briques/tableau-scene/v2/charte";
import type { FicheTableau, SceneTableau } from "../../../src/moteurs/montage-tableau/fiche";
import {
  ACCROCHE_MOTS_MAX,
  DUREES_TRACE_MS,
  FORMES_PAR_ROLE,
  instantAncre,
  momentsDuStylo,
  motsClesDouleur,
  motsDouleurCherches,
  regleAccrocheCourte,
  regleFormeEnPlusDeLaCouleur,
  regleTailleTexte,
  sceneAppelPermis,
  tempsScenes,
  type TempsScene,
} from "../../../src/moteurs/montage-tableau/regles";
import { contexteExemple, copie, ficheErreurCorrigee } from "./exemples";

const base = () => copie(ficheErreurCorrigee);
const ctx = (f: FicheTableau) => contexteExemple(f);

/** Fiche minimale écrite à la main (deux scènes, quatre mots dits chacune). */
function ficheMain(habillage: string, scenes: unknown[]): FicheTableau {
  return { ...base(), habillage, scenes: scenes as SceneTableau[] };
}
const ligne = (id: string, ancre: number, extra: object = {}) => ({ id, type: "ligne", texte: "Un mot", niveau: "texte", role: "titre", ancre, ...extra });

describe("sceneAppelPermis", () => {
  const finAppel = (habillage: string, ecrans: unknown, role = "resultat") =>
    ficheMain(habillage, [
      { id: "s01", role: "accroche", page: 1, texteDit: "un deux trois quatre", elements: [ligne("e01", 0)] },
      { id: "s02", role, page: 2, texteDit: "un deux trois quatre", elements: [ligne("e02", 0)], ...(ecrans ? { ecrans } : {}) },
    ]);

  it("blocs/2 : la dernière scène qui porte l'écran d'appel permet l'appel", () => {
    const f = finAppel("blocs/2", [{ moment: "appel" }]);
    expect(sceneAppelPermis(f, f.scenes[1])).toBe(true);
  });
  it("blocs/2 : une scène qui n'est pas la dernière ne permet jamais l'appel, même avec l'écran d'appel", () => {
    const f = finAppel("blocs/2", [{ moment: "appel" }]);
    f.scenes[0] = { ...f.scenes[0], ecrans: [{ moment: "appel" }] } as SceneTableau;
    expect(sceneAppelPermis(f, f.scenes[0])).toBe(false);
  });
  it("blocs/2 : la dernière scène sans écran d'appel ne le permet pas", () => {
    const f = finAppel("blocs/2", undefined, "fin");
    expect(sceneAppelPermis(f, f.scenes[1])).toBe(false);
  });
  it("style page écrite (charte-video/1) : jamais permis, même avec un écran d'appel", () => {
    const f = finAppel("charte-video/1", [{ moment: "appel" }], "fin");
    expect(sceneAppelPermis(f, f.scenes[1])).toBe(false);
  });
  it("reference/1 : le rôle « fin » de la dernière scène suffit", () => {
    const f = finAppel("reference/1", undefined, "fin");
    expect(sceneAppelPermis(f, f.scenes[1])).toBe(true);
  });
  it("reference/1 : une dernière scène « resultat » sans écran d'appel ne le permet pas", () => {
    const f = finAppel("reference/1", undefined, "resultat");
    expect(sceneAppelPermis(f, f.scenes[1])).toBe(false);
  });
});

describe("instantAncre", () => {
  const scene = { id: "s01" } as SceneTableau;
  const ts = (extra: Partial<TempsScene> = {}): TempsScene => ({ scene, debutMs: 1000, finMs: 5000, mots: ["un", "deux", "trois", "quatre"], ...extra });

  it("répartit les mots à débit égal : le 2e mot sur 4 tombe au milieu de la scène", () => {
    expect(instantAncre(ts(), 2)).toBe(3000);
    expect(instantAncre(ts(), 0)).toBe(1000);
  });
  it("borne l'ancre au nombre de mots : une ancre trop grande tombe à la fin de la scène", () => {
    expect(instantAncre(ts(), 10)).toBe(5000);
  });
  it("sans mot dit : le début de la scène", () => {
    expect(instantAncre(ts({ mots: [] }), 3)).toBe(1000);
  });
  it("avec une fin de parole plus courte que la scène : la fin de parole sert de fin", () => {
    expect(instantAncre(ts({ finParoleMs: 3000 }), 4)).toBe(3000);
    expect(instantAncre(ts({ finParoleMs: 3000 }), 2)).toBe(2000);
  });
});

describe("motsClesDouleur", () => {
  it("garde les racines des mots pleins de la douleur et écarte les mots vides", () => {
    expect([...motsClesDouleur("Vos demandes à l'IA donnent des réponses trop vagues.")].sort()).toEqual(["demand", "donnen", "repons", "vagu"]);
  });
  it("singulier et pluriel donnent la même racine ; une phrase de mots vides ne donne rien", () => {
    expect([...motsClesDouleur("Les réponses, la réponse")]).toEqual(["repons"]);
    expect(motsClesDouleur("").size).toBe(0);
  });
});

describe("motsDouleurCherches", () => {
  const f = base();
  it("sans mots donnés : les mots pleins du champ douleur, tels qu'écrits (accents compris), sans ponctuation", () => {
    expect(motsDouleurCherches(f, {})).toEqual(["demandes", "donnent", "réponses", "vagues"]);
  });
  it("avec des mots donnés : ils remplacent ceux du champ, nettoyés, sans doublon, sans mot vide", () => {
    expect(motsDouleurCherches(f, { motsDouleur: ["  vagues ", "vagues", "le", "réponses trop"] })).toEqual(["vagues", "réponses trop"]);
  });
  it("des mots donnés tous vides : retombe sur les mots du champ douleur", () => {
    expect(motsDouleurCherches(f, { motsDouleur: ["le", "  "] })).toEqual(["demandes", "donnent", "réponses", "vagues"]);
  });
});

describe("regleAccrocheCourte", () => {
  it("accepte l'exemple valide (accroche courte, une ligne dès le premier mot)", () => {
    expect(regleAccrocheCourte(base())).toEqual([]);
  });
  it("sans scène : rien à dire", () => {
    expect(regleAccrocheCourte({ ...base(), scenes: [] })).toEqual([]);
  });
  it("refuse une première scène qui n'est pas l'accroche, en la nommant", () => {
    const f = base();
    f.scenes[0].role = "douleur";
    expect(regleAccrocheCourte(f)).toEqual([{ sceneId: "s01", detail: "la première scène doit être l'accroche, pas « douleur »." }]);
  });
  it("refuse une première scène sans aucune ligne écrite", () => {
    const f = base();
    f.scenes[0].elements = f.scenes[0].elements.filter((e) => e.type !== "ligne");
    expect(regleAccrocheCourte(f)).toEqual([{ sceneId: "s01", detail: "l'accroche doit être écrite sur la page : aucune ligne dans la première scène." }]);
  });
  it(`refuse une accroche de plus de ${ACCROCHE_MOTS_MAX} mots, avec le compte exact`, () => {
    const f = base();
    f.scenes[0].elements = [ligne("e01", 0, { texte: "un deux trois quatre cinq six sept huit neuf" }) as never];
    expect(regleAccrocheCourte(f)).toEqual([{ sceneId: "s01", detail: `l'accroche écrite compte 9 mots ; ${ACCROCHE_MOTS_MAX} au plus.` }]);
  });
  it("accepte exactement 8 mots (la borne est incluse)", () => {
    const f = base();
    f.scenes[0].elements = [ligne("e01", 0, { texte: "un deux trois quatre cinq six sept huit" }) as never];
    expect(regleAccrocheCourte(f)).toEqual([]);
  });
  it("refuse une accroche dont aucune ligne ne part du premier mot", () => {
    const f = base();
    f.scenes[0].elements = [ligne("e01", 2) as never];
    expect(regleAccrocheCourte(f)).toEqual([{ sceneId: "s01", detail: "l'accroche doit être visible dès la première image : une ligne doit partir du premier mot." }]);
  });
});

describe("regleTailleTexte", () => {
  const f = base();
  it("accepte la mise de référence", () => {
    expect(regleTailleTexte(f, ctx(f))).toEqual([]);
  });
  it("refuse un texte prévu à 10 px : 58 px au moins (3 % de la hauteur), une seule fois par niveau", () => {
    expect(regleTailleTexte(f, { ...ctx(f), mise: { taillePx: { texte: 10 } } as never })).toEqual([
      { sceneId: "s02", detail: "le texte de niveau « texte » est prévu à 10 px ; 58 px au moins (3 % de la hauteur de l'image)." },
    ]);
  });
  it("signale chaque niveau trop petit, dans l'ordre des scènes", () => {
    const r = regleTailleTexte(f, { ...ctx(f), mise: { taillePx: { titre: 10, texte: 10 } } as never });
    expect(r.map((m) => m.sceneId)).toEqual(["s01", "s02"]);
    expect(r[0].detail).toContain("« titre » est prévu à 10 px");
  });
  it("style reference/1 : la règle ne contrôle rien ici, même avec une taille minuscule", () => {
    const ref = { ...base(), habillage: "reference/1" };
    expect(regleTailleTexte(ref, { ...ctx(ref), mise: { taillePx: { titre: 1, texte: 1 } } as never })).toEqual([]);
  });
});

describe("regleFormeEnPlusDeLaCouleur", () => {
  const f = base();
  it("accepte les formes par défaut : chaque rôle utilisé a sa propre forme", () => {
    expect(regleFormeEnPlusDeLaCouleur(f, ctx(f))).toEqual([]);
  });
  it("refuse un rôle qui n'a qu'une couleur, en le nommant", () => {
    const formesParRole = { ...FORMES_PAR_ROLE, alerte: { couleur: "#000000" } };
    expect(regleFormeEnPlusDeLaCouleur(f, { ...ctx(f), formesParRole })).toEqual([
      { sceneId: "s02", detail: "le rôle « alerte » n'a qu'une couleur ; il lui faut aussi une forme (pictogramme, cadre ou soulignement)." },
    ]);
  });
  it("refuse deux rôles qui partagent la même forme", () => {
    const formesParRole = { ...FORMES_PAR_ROLE, alerte: FORMES_PAR_ROLE.regle };
    expect(regleFormeEnPlusDeLaCouleur(f, { ...ctx(f), formesParRole })).toEqual([
      { sceneId: "s04", detail: "les rôles « alerte » et « regle » ont la même forme ; seule la couleur les distinguerait." },
    ]);
  });
});

describe("momentsDuStylo", () => {
  const deux = (habillage: string, calee: boolean) =>
    ficheMain(habillage, [
      {
        id: "s01", role: "accroche", page: 1, texteDit: "un deux trois quatre",
        ...(calee ? { debutMs: 0, finMs: 4000 } : {}),
        elements: [ligne("e01", 0), { id: "e02", type: "dessin", dessinId: "bulle", cote: "droite", ancre: 2 }],
      },
      {
        id: "s02", role: "resultat", page: 2, texteDit: "un deux trois quatre",
        ...(calee ? { debutMs: 4000, finMs: 8000 } : {}),
        elements: [{ id: "e03", type: "chiffre", valeur: "3", ancre: 4 }],
      },
    ]);

  it("style page écrite, fiche calée : ligne simple (pas un événement), dessin, page tournée, chiffre, triés par instant", () => {
    const r = momentsDuStylo(deux("charte-video/1", true));
    expect(r.moments).toEqual([
      { ms: 0, duree: DUREES_TRACE_MS.ligne, evenement: false },
      { ms: 2000, duree: DUREES_TRACE_MS.dessin, evenement: true },
      { ms: 4000, duree: DUREES_TRACE_MS.pageTournee, evenement: true },
      { ms: 8000, duree: DUREES_TRACE_MS.chiffre, evenement: true },
    ]);
    expect(r.finMs).toBe(8000);
  });
  it("une ligne marquée (entourée) est un événement même en style page écrite", () => {
    const f = deux("charte-video/1", true);
    f.scenes[0].elements[0] = ligne("e01", 0, { marque: "entoure" }) as never;
    expect(momentsDuStylo(f).moments[0]).toEqual({ ms: 0, duree: DUREES_TRACE_MS.ligne, evenement: true });
  });
  it("même page pour deux scènes : aucune page tournée", () => {
    const f = deux("charte-video/1", true);
    f.scenes[1].page = 1;
    expect(momentsDuStylo(f).moments.some((m) => m.duree === DUREES_TRACE_MS.pageTournee)).toBe(false);
  });
  it("style reference/1, fiche calée : la ligne écrite est un événement et la tenue de fin est retranchée de la durée", () => {
    const r = momentsDuStylo(deux("reference/1", true));
    expect(r.moments[0]).toEqual({ ms: 0, duree: DUREES_TRACE_MS.ligne, evenement: true });
    expect(r.finMs).toBe(Math.max(4000, 8000 - TENUE_FIN_TOTALE_MS));
  });
  it("fiche non calée : les instants viennent du débit (même résultat que tempsScenes), sans tenue de fin", () => {
    const f = deux("charte-video/1", false);
    const fin = tempsScenes(f)[1].finMs;
    const r = momentsDuStylo(f);
    expect(r.finMs).toBe(fin);
    expect(r.moments).toHaveLength(4);
    expect(r.moments[0].ms).toBe(0);
    expect(r.moments[2].ms).toBe(tempsScenes(f)[1].debutMs);
  });
  it("sans scène : aucun moment, durée nulle", () => {
    expect(momentsDuStylo({ ...base(), scenes: [] })).toEqual({ moments: [], finMs: 0 });
  });
});
