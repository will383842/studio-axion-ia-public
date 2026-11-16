/** Suivi par réseau : agrégation pure (somme = total, réseau inconnu, ancien enregistrement sans réseau). Données 100 % fictives. */
import { describe, expect, it } from "vitest";
import { lireCompteursSite } from "@/domaine/guide-reseau/compteurs-site-contrat";
import { assemblerSuivi, type ConversationSuivi, type EvenementSuivi } from "@/domaine/guide-reseau/suivi-mots";
import { classerReseau } from "@/domaine/guide-reseau/suivi-par-reseau";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TableauSuiviMots } from "@/components/mots/TableauSuiviMots";
import { totalReseaux, type Fen } from "@/components/mots/suivi-affichage";

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const il = (j: number) => new Date(T0 - j * 86_400_000).toISOString();
const ev = (reseau: string | null | undefined, id: string): EvenementSuivi => ({
  recuLe: il(1), motSeul: "ESSAI", idPostPlateforme: "p1", reseau, idEvenement: id,
});
const conv = (n: number, reseau: string | null | undefined): ConversationSuivi => ({
  cle: `${String(n).repeat(64)}:x`, mot: "ESSAI", nature: "premier", etat: "m1_envoye",
  creeLe: il(2), m1Le: il(2), idPostPlateforme: "p1", reseau,
});
const lsFen = (reseau: string, cible: string, envois: Fen, clics: Fen) => ({
  mot: "ESSAI", reseau, postRef: "p1", versionTexte: null, cible,
  formulaires: f(0, 0, 0), envois, clics,
});
const f = (j7: number, j30: number, total: number) => ({ j7, j30, total });
const site = (lignes: Record<string, unknown>[]) =>
  lireCompteursSite({ v: 1, genereLe: "2026-11-12T10:00:00.000Z", lignes })!;
const ls = (reseau: string, cible: string, envois: number, clics: number) => ({
  mot: "ESSAI", reseau, postRef: "p1", versionTexte: null, cible,
  formulaires: f(0, 0, 0), envois: f(envois, envois, envois), clics: f(clics, clics, clics),
});

describe("classerReseau", () => {
  it("classe, sans exception", () => {
    expect(classerReseau(" TikTok ")).toBe("tiktok");
    expect(classerReseau("mastodon")).toBe("autre");
    expect(classerReseau("linkedin_page")).toBe("linkedin");
    expect(classerReseau("page_guide")).toBe("non_precise");
    for (const v of [null, undefined, "", "  ", 3, {}]) expect(classerReseau(v)).toBe("non_precise");
  });
});

describe("parReseau", () => {
  const evs = [ev("facebook", "1"), ev("facebook", "2"), ev("instagram", "3"), ev("mastodon", "4"), ev(null, "5"), ev(undefined, "6")];
  const convs = [conv(1, "facebook"), conv(2, "instagram"), conv(3, null), conv(4, "mastodon")];
  const s = [ls("facebook", "c1", 2, 3), ls("instagram", "c2", 1, 5), ls("mastodon", "c3", 4, 1), ls("tiktok", "c4", 0, 0)];
  const l = assemblerSuivi(evs, convs, site(s), T0).lignes[0];
  const r = (cle: string) => l.parReseau!.find((x) => x.reseau === cle);

  it("la somme des réseaux égale le total du mot", () => {
    for (const fen of ["j7", "j30", "total"] as const) {
      expect(totalReseaux(l.parReseau!, "commentaires", fen)).toBe(l.commentaires[fen]);
      expect(totalReseaux(l.parReseau!, "premiersMessages", fen)).toBe(l.premiersMessages[fen]);
      expect(totalReseaux(l.parReseau!, "envoisEmail", fen)).toBe(l.envoisEmail![fen]);
      expect(totalReseaux(l.parReseau!, "clics", fen)).toBe(l.clics![fen]);
    }
  });
  it("réseau inconnu → autre ; absent → non précisé", () => {
    expect(r("autre")!.commentaires.total).toBe(1);
    expect(r("autre")!.envoisEmail!.total).toBe(4);
    expect(r("non_precise")!.commentaires.total).toBe(2);
    expect(r("non_precise")!.premiersMessages.total).toBe(1);
  });
  it("réseaux sans donnée masqués, ordre fixe", () => {
    expect(r("tiktok")).toBeUndefined();
    expect(r("linkedin")).toBeUndefined();
    expect(l.parReseau!.map((x) => x.reseau)).toEqual(["facebook", "instagram", "autre", "non_precise"]);
  });
  it("site indisponible : e-mails et clics à null, jamais 0", () => {
    const x = assemblerSuivi(evs, convs, null, T0).lignes[0].parReseau!;
    expect(x.every((y) => y.envoisEmail === null && y.clics === null)).toBe(true);
    expect(x.find((y) => y.reseau === "facebook")!.commentaires.total).toBe(2);
  });
  it("aucune donnée par réseau : liste vide ; chaque ligne n'a que les clés d'agrégats", () => {
    expect(assemblerSuivi([], [], null, T0).lignes).toEqual([]);
    for (const x of l.parReseau!)
      expect(Object.keys(x).sort()).toEqual(["clics", "commentaires", "envoisEmail", "gagnees", "premiersMessages", "reseau"]);
  });
  it("linkedin_page du Studio est rangé sous LinkedIn", () => {
    const x = assemblerSuivi([ev("linkedin_page", "9")], [], site([ls("linkedin_page", "c9", 2, 1)]), T0).lignes[0];
    expect(x.parReseau!.map((y) => y.reseau)).toEqual(["linkedin"]);
    expect(x.parReseau![0].envoisEmail!.total).toBe(2);
  });
  it("personnes gagnées : la somme des réseaux égale le total", () => {
    const cs = [
      { ...conv(1, "instagram"), suiviIg: "gagne", lienIgLe: il(1) },
      { ...conv(2, "facebook"), suiviIg: "gagne", lienIgLe: il(10) },
      { ...conv(3, "instagram"), suiviIg: "deja_suivi", lienIgLe: il(1) },
    ];
    const x = assemblerSuivi([], cs, null, T0).lignes[0];
    for (const fen of ["j7", "j30", "total"] as const)
      expect(totalReseaux(x.parReseau!, "gagnees", fen)).toBe(x.instagram.gagnees[fen]);
    expect(x.instagram.gagnees).toEqual({ j7: 1, j30: 2, total: 2 });
  });
  it("fixture du site où j7, j30 et total diffèrent : sommes par fenêtre", () => {
    const s2 = site([
      lsFen("facebook", "a", f(1, 3, 6), f(0, 2, 5)),
      lsFen("tiktok", "b", f(2, 4, 9), f(1, 1, 7)),
    ]);
    const x = assemblerSuivi([ev("facebook", "1")], [], s2, T0).lignes[0];
    expect(totalReseaux(x.parReseau!, "envoisEmail", "j7")).toBe(3);
    expect(totalReseaux(x.parReseau!, "envoisEmail", "j30")).toBe(7);
    expect(totalReseaux(x.parReseau!, "envoisEmail", "total")).toBe(15);
    expect(totalReseaux(x.parReseau!, "clics", "total")).toBe(12);
    expect(x.envoisEmail).toEqual({ j7: 3, j30: 7, total: 15 });
  });
  it("ancien enregistrement du service sans ventilation : l'écran dit « Pas encore de chiffres par réseau »", () => {
    const x = assemblerSuivi([ev("facebook", "1")], [], null, T0);
    const { parReseau: _retire, ...ancienne } = x.lignes[0];
    expect(_retire!.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(TableauSuiviMots, { suivi: { ...x, lignes: [ancienne] } }));
    expect(html).toContain("Pas encore de chiffres par réseau");
    expect(html).not.toContain("Détail par réseau");
  });
  it("écran : « Personnes gagnées » sur toutes les lignes, le Total égale la somme des lignes visibles", () => {
    const cs = [
      { ...conv(1, "instagram"), suiviIg: "gagne", lienIgLe: il(1) },
      { ...conv(2, "facebook"), suiviIg: "gagne", lienIgLe: il(1) },
      { ...conv(3, "facebook"), suiviIg: "gagne", lienIgLe: il(1) },
    ];
    const x = assemblerSuivi([], cs, null, T0);
    const html = renderToStaticMarkup(createElement(TableauSuiviMots, { suivi: x }));
    expect(html).toContain("Personnes gagnées (compte Instagram)");
    const tableau = html.slice(html.indexOf("Détail par réseau"));
    const corps = tableau.slice(tableau.indexOf("<tbody>"), tableau.indexOf("</tbody>"));
    const lignes = [...corps.matchAll(/<tr>.*?<\/tr>/g)].map((m) => [...m[0].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/g)].map((c) => c[1]));
    const derniere = (t: string[]) => t[t.length - 1];
    const somme = lignes.map(derniere).map((v) => Number(/\d+/.exec(v)?.[0] ?? 0)).reduce((a, b) => a + b, 0);
    expect(lignes.map(derniere).every((v) => v.startsWith("au moins"))).toBe(true);
    const pied = tableau.slice(tableau.indexOf("<tfoot>"));
    const totalAffiche = Number(/au moins (\d+)/.exec(pied)?.[1]);
    expect(somme).toBe(3);
    expect(totalAffiche).toBe(somme);
  });
});
