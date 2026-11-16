/** Suivi par réseau : agrégation pure (somme = total, réseau inconnu, ancien enregistrement sans réseau). Données 100 % fictives. */
import { describe, expect, it } from "vitest";
import { lireCompteursSite } from "@/domaine/guide-reseau/compteurs-site-contrat";
import { assemblerSuivi, type ConversationSuivi, type EvenementSuivi } from "@/domaine/guide-reseau/suivi-mots";
import { classerReseau } from "@/domaine/guide-reseau/suivi-par-reseau";
import { totalReseaux } from "@/components/mots/suivi-affichage";

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const il = (j: number) => new Date(T0 - j * 86_400_000).toISOString();
const ev = (reseau: string | null | undefined, id: string): EvenementSuivi => ({
  recuLe: il(1), motSeul: "ESSAI", idPostPlateforme: "p1", reseau, idEvenement: id,
});
const conv = (n: number, reseau: string | null | undefined): ConversationSuivi => ({
  cle: `${String(n).repeat(64)}:x`, mot: "ESSAI", nature: "premier", etat: "m1_envoye",
  creeLe: il(2), m1Le: il(2), idPostPlateforme: "p1", reseau,
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
  it("aucune donnée par réseau : liste vide, et aucun nom ni clé dans la sortie", () => {
    expect(assemblerSuivi([], [], null, T0).lignes).toEqual([]);
    expect(JSON.stringify(l.parReseau)).not.toMatch(/x"|1111/);
  });
});
