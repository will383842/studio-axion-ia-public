/**
 * RÉPARATION DES FORMES (`src/moteurs/montage-tableau/formes.ts`, et la chaîne `remettreEnForme` du découpage) : le cas
 * de l'essai réel n° 4 (ancre 30 dans une scène de 27 mots) passe ; une fiche témoin valide cassée de 20 façons
 * réparables passe toutes les règles après réparation ; idempotence ; une fiche valide n'est jamais touchée ; ce qui
 * n'est pas sûr reste refusé. Aucun appel : tout est local.
 */
import { describe, expect, it } from "vitest";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { reparerFormes } from "../../../src/moteurs/montage-tableau/formes";
import { reparerRythme } from "../../../src/moteurs/montage-tableau/rythme";
import { mots } from "../../../src/domaine/controles-script/texte";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";
import { contexteHabitude, ficheHabitude } from "../rythme/temoin-habitude";

/* eslint-disable @typescript-eslint/no-explicit-any */
const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const messages = (f: unknown, c = contexteFormation()) => {
  const v = validerFicheTableau(f, c);
  return v.ok ? [] : v.problemes.map((p) => p.message);
};
const textesDits = (f: FicheTableau) => f.scenes.map((s) => s.texteDit);
const textesEcrits = (f: FicheTableau) =>
  f.scenes.flatMap((s) => [
    ...s.elements.flatMap((e) => (e.type === "ligne" || e.type === "mention" ? [e.texte] : e.type === "preuve" ? e.lignes : e.type === "chiffre" ? [e.valeur] : [])),
    ...(s.ecrans ?? []).flatMap((ec) => (ec.liste ?? []).map((it) => it.texte)),
  ]);
const scene = (f: any, id: string) => f.scenes.find((s: any) => s.id === id);
const el = (f: any, id: string) => f.scenes.flatMap((s: any) => s.elements).find((e: any) => e.id === id);

describe("essai réel n° 4 : l'élément « e38 » part du mot 30, la scène s08 n'a que 27 mots", () => {
  /** Le témoin de l'essai n° 3, réparé (valide), avec l'ancre posée au-delà de la fin du texte. */
  const essai4 = () => {
    const f = copie(reparerRythme(ficheHabitude())) as any;
    expect(mots(scene(f, "s08").texteDit)).toHaveLength(27);
    // « part du mot 30 » : l'ancre compte depuis 0.
    el(f, "e38").ancre = 29;
    return f as FicheTableau;
  };

  it("telle que rendue : refusée avec le motif de l'essai (le silence laissé par la ligne déplacée en plus)", () => {
    const m = messages(essai4(), contexteHabitude());
    expect(m).toContain("Scène s08 · règle « références internes » : l'élément « e38 » part du mot 30, mais le texte dit n'a que 27 mots.");
    for (const x of m) expect(x).toMatch(/^Scène s08 · /);
  });

  it("remise en forme : l'ancre est ramenée dans le texte dit et toutes les règles passent", () => {
    const f = remettreEnForme(essai4(), { motsDouleur: ["habitude"] });
    expect(messages(f, contexteHabitude())).toEqual([]);
    expect(el(f, "e38").ancre).toBeLessThanOrEqual(26);
    expect(textesDits(f)).toEqual(textesDits(essai4()));
  });

  it("la réparation des formes seule borne l'ancre au dernier mot", () => {
    expect(el(reparerFormes(essai4()), "e38").ancre).toBe(26);
  });
});

/* ------------------------------------------------------------------ */
/* Vingt façons réparables de casser une fiche valide                     */
/* ------------------------------------------------------------------ */

type Casse = [string, (f: any) => void];
const CASSES: Casse[] = [
  ["ancre d'une ligne au-delà du texte", (f) => (el(f, "e13").ancre = 999)],
  ["ancre d'un chiffre au-delà du texte", (f) => (el(f, "e14").ancre = 40)],
  ["ancre négative", (f) => (el(f, "e20").ancre = -3)],
  ["ancre non entière", (f) => (el(f, "e19").ancre = 2.6)],
  ["ancre absente sur une ligne", (f) => delete el(f, "e24").ancre],
  ["ancre écrite en texte", (f) => (el(f, "e17").ancre = "0")],
  ["ancre posée sur une mention", (f) => (el(f, "e28").ancre = 4)],
  ["élément de liste au-delà du texte", (f) => (scene(f, "s07").ecrans[0].liste[3].ancre = 200)],
  ["élément de liste à ancre négative", (f) => (scene(f, "s05").ecrans[0].liste[0].ancre = -1)],
  ["second écran au-delà du texte", (f) => (scene(f, "s10").ecrans[1].ancre = 500)],
  ["second écran sans ancre", (f) => delete scene(f, "s10").ecrans[1].ancre],
  ["premier écran qui ne part pas avec la scène", (f) => (scene(f, "s03").ecrans[0].ancre = 3)],
  ["mots forts en groupes", (f) => (scene(f, "s01").ecrans[0].motsForts = ["3 fois", "laissé tomber"])],
  ["mots importants en groupe", (f) => (el(f, "e15").importants = ["une seule tâche"])],
  ["geste qui vise un élément absent", (f) => (el(f, "e29").cibleId = "e99")],
  ["geste qui se vise lui-même", (f) => (el(f, "e29").cibleId = "e29")],
  ["identifiant d'élément en double", (f) => (el(f, "e26").id = "e25")],
  ["identifiant d'élément mal formé", (f) => (el(f, "e31").id = "e 31")],
  ["identifiants de scène mal numérotés", (f) => (f.scenes[2].id = "s3")],
  ["page qui revient en arrière", (f) => (f.scenes[4].page = 1)],
  ["page sautée", (f) => (f.scenes[1].page = 4)],
  ["première scène sur la page 2", (f) => (f.scenes[0].page = 2)],
  ["page non entière", (f) => (f.scenes[3].page = 3.2)],
  ["liste vide", (f) => (scene(f, "s02").ecrans[0].liste = [])],
  ["trou de rythme (éléments de liste tassés au début)", (f) => scene(f, "s07").ecrans[0].liste.forEach((it: any) => (it.ancre = 0))],
];

describe("une fiche témoin valide, cassée de façons réparables, passe toutes les règles après réparation", () => {
  it("le témoin est valide", () => {
    expect(messages(ficheFormation())).toEqual([]);
    expect(CASSES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(CASSES)("%s : refusée telle quelle, acceptée après réparation, sans un texte changé", (_nom, casser) => {
    const f = copie(ficheFormation()) as any;
    casser(f);
    expect(messages(f)).not.toEqual([]);
    const r = remettreEnForme(f) as FicheTableau;
    expect(messages(r)).toEqual([]);
    expect(textesDits(r)).toEqual(textesDits(ficheFormation()));
    expect(textesEcrits(r)).toEqual(textesEcrits(f));
    // Idempotente : la fiche réparée, réparée encore, ne change plus.
    expect(remettreEnForme(r)).toEqual(r);
  });

  it("toutes les casses à la fois : acceptée après réparation, idempotente", () => {
    const f = copie(ficheFormation()) as any;
    // Les casses d'identifiant de scène et d'élément visent le témoin d'origine : appliquées en dernier.
    const parId = CASSES.filter(([n]) => !/identifiant/.test(n));
    const ids = CASSES.filter(([n]) => /identifiant/.test(n));
    for (const [, casser] of [...parId, ...ids]) casser(f);
    const r = remettreEnForme(f) as FicheTableau;
    expect(messages(r)).toEqual([]);
    expect(textesDits(r)).toEqual(textesDits(ficheFormation()));
    expect(remettreEnForme(r)).toEqual(r);
  });
});

describe("ce qui est réparé, et comment", () => {
  it("un geste orphelin est rattaché à la dernière ligne déjà écrite à son ancre", () => {
    const f = copie(ficheFormation()) as any;
    el(f, "e29").cibleId = "e99";
    expect(el(reparerFormes(f), "e29").cibleId).toBe("e26");
  });

  it("un geste « barrer » orphelin est retiré (barrer une autre ligne changerait le sens)", () => {
    const f = copie(ficheFormation()) as any;
    scene(f, "s09").elements.find((e: any) => e.id === "e29").geste = "barrer";
    el(f, "e29").cibleId = "e99";
    const r = reparerFormes(f) as any;
    expect(el(r, "e29")).toBeUndefined();
    expect(scene(r, "s09").elements).toHaveLength(4);
  });

  it("un identifiant en double est renuméroté ; le geste de sa scène le suit", () => {
    const f = copie(ficheFormation()) as any;
    el(f, "e27").id = "e01";
    el(f, "e29").cibleId = "e01";
    const r = reparerFormes(f) as any;
    const s09 = scene(r, "s09");
    const preuve = s09.elements.find((e: any) => e.type === "preuve");
    expect(preuve.id).toBe("s09r1");
    expect(s09.elements.find((e: any) => e.id === "e29").cibleId).toBe("s09r1");
    expect(scene(r, "s01").elements[0].id).toBe("e01");
  });

  it("les pages sont remises en ordre sans changer l'ordre des scènes", () => {
    const f = copie(ficheFormation()) as any;
    f.scenes[4].page = 1;
    const r = reparerFormes(f) as any;
    // Une seule page changée (la plus proche de celle posée), la suite juste.
    expect(r.scenes.map((s: any) => s.page)).toEqual([1, 2, 3, 3, 3, 4, 5, 5, 6, 6]);
    expect(r.scenes.map((s: any) => s.texteDit)).toEqual(textesDits(ficheFormation()));
  });
});

describe("une fiche valide n'est jamais touchée", () => {
  it("témoin « Formation » et témoin réparé de l'essai n° 3 : rendus tels quels (même objet)", () => {
    const formation = ficheFormation();
    expect(reparerFormes(formation)).toBe(formation);
    expect(remettreEnForme(formation)).toEqual(ficheFormation());
    const habitude = reparerRythme(ficheHabitude());
    expect(reparerFormes(habitude)).toBe(habitude);
  });

  it("une entrée illisible est rendue telle quelle, sans lever", () => {
    for (const x of [null, "texte", 3, [], { scenes: [] }, { scenes: "non" }, { scenes: [null] }]) expect(reparerFormes(x)).toBe(x);
  });
});

describe("ce qui n'est pas sûr reste refusé", () => {
  const refusee = (casser: (f: any) => void, motif: RegExp) => {
    const f = copie(ficheFormation()) as any;
    casser(f);
    const r = remettreEnForme(f);
    expect(messages(r).some((m) => motif.test(m))).toBe(true);
  };

  it("mot du commentaire absent des lignes", () => refusee((f) => (scene(f, "s10").ecrans[1].motCommentaire = "SIX"), /mot à écrire en commentaire « SIX »/));
  it("étape plus grande que le total", () => refusee((f) => (scene(f, "s08").ecrans[0].etape.n = 5), /doit valoir au plus|dépasse le nombre d'étapes/));
  it("champ inconnu", () => refusee((f) => (el(f, "e25").couleur = "rouge"), /champ inconnu/));
  it("geste sans aucune ligne à viser dans la scène", () =>
    refusee((f) => {
      const s04 = scene(f, "s04");
      s04.elements = [{ id: "e14", type: "chiffre", valeur: "5", unite: "jours", sourceId: "script-formation", ancre: 2 }, { id: "g1", type: "geste", geste: "pointer", cibleId: "e99", ancre: 3 }];
    }, /le geste « g1 » vise « e99 »/));
});
