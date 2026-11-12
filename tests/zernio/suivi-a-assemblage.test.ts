/* eslint-disable @typescript-eslint/no-explicit-any -- le contrat est abîmé exprès, champ par champ. */
/** SUI-A : assemblage pur du suivi par mot et lecture stricte du contrat du site. Données 100 % fictives. */
import { describe, expect, it } from "vitest";
import {
  lireCompteursSite,
  cleVersionSite,
} from "@/domaine/guide-reseau/compteurs-site-contrat";
import {
  assemblerSuivi,
  type ConversationSuivi,
  type EvenementSuivi,
} from "@/domaine/guide-reseau/suivi-mots";

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const JOUR = 86_400_000;
const il = (jours: number) => new Date(T0 - jours * JOUR).toISOString();
const RACINE_A = "a".repeat(64);
const RACINE_B = "b".repeat(64);
const AUTEUR_FICTIF = "auteur-fictif-998877";

const conv = (o: Partial<ConversationSuivi> & { cle: string }): ConversationSuivi => ({
  mot: "ESSAI",
  nature: "premier",
  etat: "m1_envoye",
  creeLe: il(2),
  m1Le: il(2),
  idPostPlateforme: "post-1",
  reseau: "instagram",
  versionTexteM1: "mp-m1-v4-1",
  ...o,
});
const fenSite = (j7: number, j30: number, total: number) => ({ j7, j30, total });
const corpsSite = () => ({
  v: 1,
  mots: [
    {
      mot: "essai",
      formulaires: fenSite(1, 2, 3),
      envoisEmail: fenSite(1, 1, 2),
      clics: fenSite(4, 5, 6),
    },
  ],
  publications: [{ mot: "essai", postRef: "post-1", formulaires: 3, clics: 6 }],
  versions: [{ mot: "essai", versionTexte: "mp-m1-v4-1", clics: 6 }],
});
const evs: EvenementSuivi[] = [
  { recuLe: il(1), motSeul: "ESSAI", idPostPlateforme: "post-1", reseau: "instagram" },
  { recuLe: il(40), motSeul: "essai", idPostPlateforme: null, reseau: "facebook" },
  { recuLe: il(1), motSeul: "AUTRE" },
];

describe("assemblage", () => {
  it("2 mots dans 2 dossiers composés → 1 personne par mot", () => {
    const t = assemblerSuivi(
      [],
      [
        conv({ cle: `${RACINE_A}|aaaa`, mot: "ESSAI" }),
        conv({ cle: `${RACINE_A}|bbbb`, mot: "ESSAI" }),
        conv({ cle: `${RACINE_A}|cccc`, mot: "AUTRE" }),
        conv({ cle: `${RACINE_A}|dddd`, mot: "AUTRE" }),
      ],
      null,
      T0,
    );
    expect(t.lignes.map((l) => [l.mot, l.premiersMessages.total])).toEqual([
      ["AUTRE", 1],
      ["ESSAI", 1],
    ]);
  });

  it("comptage et fenêtres : commentaires, réponses, premiers messages, renvois", () => {
    const t = assemblerSuivi(
      evs,
      [
        conv({ cle: `${RACINE_A}|x`, creeLe: il(3), m1Le: il(3) }),
        conv({ cle: `${RACINE_B}|x`, creeLe: il(20), m1Le: il(20) }),
        conv({ cle: `${RACINE_B}|y`, nature: "renvoi", creeLe: il(1), m1Le: il(1) }),
        conv({ cle: "c".repeat(64), etat: "nouveau", m1Le: null, creeLe: "illisible" }),
        conv({ cle: "d".repeat(64), mot: null, creeLe: il(0.5), m1Le: il(0.5) }),
      ],
      null,
      T0,
    );
    const e = t.lignes.find((l) => l.mot === "ESSAI")!;
    expect(e.commentaires).toEqual({ j7: 1, j30: 1, total: 2 });
    expect(e.premiersMessages).toEqual({ j7: 1, j30: 2, total: 2 });
    expect(e.renvois).toEqual({ j7: 1, j30: 1, total: 1 });
    // « nouveau » = pas de réponse publique ; date illisible : seulement dans total.
    expect(e.reponsesPubliques).toEqual({ j7: 1, j30: 2, total: 2 });
    const g = t.lignes.find((l) => l.mot === "GUIDE")!;
    expect(g.premiersMessages.total).toBe(1);
  });

  it("gagnées seulement pour « gagne » ; un seul compte par personne et par mot", () => {
    const t = assemblerSuivi(
      [],
      [
        conv({ cle: `${RACINE_A}|x`, suiviIg: "gagne", lienIgLe: il(1), okRecus: 2 }),
        conv({ cle: `${RACINE_B}|x`, suiviIg: "deja_suivi", lienIgLe: il(1), okRecus: 1 }),
        conv({ cle: "c".repeat(64), suiviIg: "sans_suivre", lienIgLe: il(1) }),
        conv({ cle: "d".repeat(64), suiviIg: "inconnu", lienIgLe: il(1) }),
        conv({ cle: "e".repeat(64) }),
      ],
      null,
      T0,
    );
    const l = t.lignes[0];
    expect(l.instagram.gagnees).toEqual({ j7: 1, j30: 1, total: 1 });
    expect(l.instagram.dejaSuivi.total).toBe(1);
    expect(l.instagram.sansSuivre.total).toBe(1);
    expect(l.instagram.inconnu.total).toBe(1);
    expect(l.instagram.reponsesOk.total).toBe(2);
    expect(l.auMoinsGagnees).toBe(1);
    expect(l.parPublication[0].auMoinsGagnees).toBe(1);
  });

  it("champs Instagram absents = 0 (lecture tolérante)", () => {
    const l = assemblerSuivi([], [conv({ cle: RACINE_A })], null, T0).lignes[0];
    expect(l.instagram.reponsesOk.total).toBe(0);
    expect(l.instagram.gagnees.total).toBe(0);
    expect(l.auMoinsGagnees).toBe(0);
  });

  it("site null → champs du site à null, siteDisponible false", () => {
    const t = assemblerSuivi(evs, [conv({ cle: `${RACINE_A}|x` })], null, T0);
    expect(t.siteDisponible).toBe(false);
    const l = t.lignes.find((x) => x.mot === "ESSAI")!;
    expect(l.formulaires).toBeNull();
    expect(l.envoisEmail).toBeNull();
    expect(l.clics).toBeNull();
    for (const p of l.parPublication) {
      expect(p.formulaires).toBeNull();
      expect(p.clics).toBeNull();
    }
    for (const f of l.formulations) expect(f.clics).toBeNull();
  });

  it("jointure par publication et par version", () => {
    const site = lireCompteursSite(corpsSite());
    expect(site).not.toBeNull();
    const t = assemblerSuivi(
      evs,
      [conv({ cle: `${RACINE_A}|x`, formulations: { "m1-lien": "mp-m1-v4-2" } })],
      site,
      T0,
    );
    expect(t.siteDisponible).toBe(true);
    const l = t.lignes.find((x) => x.mot === "ESSAI")!;
    expect(l.formulaires).toEqual(fenSite(1, 2, 3));
    expect(l.clics).toEqual(fenSite(4, 5, 6));
    const p1 = l.parPublication.find((p) => p.post === "post-1")!;
    expect(p1).toMatchObject({ reseau: "instagram", commentaires: 1, premiersMessages: 1, formulaires: 3, clics: 6 });
    const sans = l.parPublication.find((p) => p.post === "sans-publication")!;
    expect(sans).toMatchObject({ reseau: "facebook", commentaires: 1, formulaires: 0, clics: 0 });
    expect(l.formulations).toEqual([
      { version: "mp-m1-v4-1", envois: 1, clics: 6 },
      { version: "mp-m1-v4-2", envois: 1, clics: 0 },
    ]);
    expect(site!.versions.get(cleVersionSite("ESSAI", "mp-m1-v4-1"))).toBe(6);
  });

  it("la sortie ne contient ni « cle », ni hexadécimal de 64 caractères, ni l'identifiant d'auteur", () => {
    const t = assemblerSuivi(
      [{ ...evs[0], ...({ idAuteur: AUTEUR_FICTIF } as object) }],
      [conv({ cle: `${RACINE_A}|x`, ...({ idAuteur: AUTEUR_FICTIF } as object) })],
      lireCompteursSite(corpsSite()),
      T0,
    );
    const s = JSON.stringify(t);
    expect(s).not.toMatch(/cle/i);
    expect(s).not.toMatch(/[0-9a-f]{64}/);
    expect(s).not.toContain(AUTEUR_FICTIF);
  });
});

describe("lecture stricte du contrat du site", () => {
  it("forme correcte acceptée", () => expect(lireCompteursSite(corpsSite())).not.toBeNull());
  it.each([
    ["négatif", (c: any) => (c.mots[0].clics.j7 = -1)],
    ["décimal", (c: any) => (c.publications[0].clics = 1.5)],
    ["champ manquant", (c: any) => delete c.mots[0].envoisEmail],
    ["version fausse", (c: any) => (c.v = 2)],
    ["version absente du tableau", (c: any) => delete c.versions],
    ["nombre en texte", (c: any) => (c.versions[0].clics = "3")],
    ["mot invalide", (c: any) => (c.mots[0].mot = "x")],
    ["mot en double", (c: any) => c.mots.push({ ...c.mots[0] })],
  ])("%s → null pour toute la réponse", (_n, abimer) => {
    const c = corpsSite();
    abimer(c);
    expect(lireCompteursSite(c)).toBeNull();
  });
  it.each([null, undefined, "x", 3, [], {}])("pas un contrat : %j → null", (v) =>
    expect(lireCompteursSite(v)).toBeNull(),
  );
});
