/** MG-2 : chiffres par mot (lecture seule). Valeurs fictives ; aucune donnée réelle. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  agregerStatsMots,
  type ConversationStat,
  type EvenementStat,
} from "@/domaine/guide-reseau/stats-mots";

const MAINTENANT = Date.parse("2026-06-30T12:00:00.000Z");
const JOUR = 86_400_000;
const il_y_a = (ms: number): string => new Date(MAINTENANT - ms).toISOString();

const conv = (
  o: Partial<ConversationStat> & { cle: string },
): ConversationStat => ({
  etat: "attente_email",
  creeLe: il_y_a(JOUR),
  m1Le: il_y_a(JOUR),
  ...o,
});
const stats = (evs: EvenementStat[], convs: ConversationStat[]) =>
  agregerStatsMots(evs, convs, MAINTENANT);
const parMot = (r: ReturnType<typeof stats>, mot: string) =>
  r.find((s) => s.mot === mot);

describe("fenêtres j7 / j30 / total", () => {
  it("compte aux bornes (exactement 7 j et 30 j inclus ; 1 ms de plus = hors fenêtre)", () => {
    const evs: EvenementStat[] = [
      { recuLe: il_y_a(7 * JOUR), motSeul: "GUIDE" }, // pile 7 j : dedans
      { recuLe: il_y_a(7 * JOUR + 1), motSeul: "GUIDE" }, // juste au-delà : j30
      { recuLe: il_y_a(30 * JOUR), motSeul: "GUIDE" }, // pile 30 j : dedans
      { recuLe: il_y_a(30 * JOUR + 1), motSeul: "GUIDE" }, // total seulement
      { recuLe: il_y_a(0), motSeul: "GUIDE" },
    ];
    expect(parMot(stats(evs, []), "GUIDE")!.commentaires).toEqual({
      j7: 2,
      j30: 4,
      total: 5,
    });
  });
  it("une date illisible ou future ne compte que dans le total", () => {
    const evs: EvenementStat[] = [
      { recuLe: "pas une date", motSeul: "GUIDE" },
      { recuLe: new Date(MAINTENANT + JOUR).toISOString(), motSeul: "GUIDE" },
    ];
    expect(parMot(stats(evs, []), "GUIDE")!.commentaires).toEqual({
      j7: 0,
      j30: 0,
      total: 2,
    });
  });
  it("les fenêtres s'appliquent aussi aux messages privés et aux personnes", () => {
    const convs = [
      conv({ cle: "a", m1Le: il_y_a(8 * JOUR), creeLe: il_y_a(8 * JOUR) }),
      conv({ cle: "b", m1Le: il_y_a(JOUR) }),
    ];
    const s = parMot(stats([], convs), "GUIDE")!;
    expect(s.premiersMessages).toEqual({ j7: 1, j30: 2, total: 2 });
    expect(s.personnes).toEqual({ j7: 1, j30: 2, total: 2 });
  });
});

describe("premiers messages privés (D-C)", () => {
  it("un renvoi ne compte pas comme un nouveau message", () => {
    const convs = [
      conv({ cle: "a", nature: "premier" }),
      conv({ cle: "a", nature: "renvoi", m1Le: il_y_a(1000) }),
    ];
    expect(parMot(stats([], convs), "GUIDE")!.premiersMessages.total).toBe(1);
  });
  it("un renvoi seul (sans premier envoi connu) ne compte pas", () => {
    expect(
      parMot(stats([], [conv({ cle: "a", nature: "renvoi" })]), "GUIDE")
        ?.premiersMessages.total ?? 0,
    ).toBe(0);
  });
  it("sans message envoyé (m1Le vide) : rien n'est compté", () => {
    expect(
      parMot(stats([], [conv({ cle: "a", m1Le: null })]), "GUIDE")
        ?.premiersMessages.total ?? 0,
    ).toBe(0);
  });
  it("deux mots vers la même personne comptent chacun une fois", () => {
    const convs = [
      conv({ cle: "a", mot: "GUIDE" }),
      conv({ cle: "a", mot: "PROMO" }),
      conv({ cle: "a", mot: "PROMO", nature: "renvoi" }),
    ];
    const r = stats([], convs);
    expect(parMot(r, "GUIDE")!.premiersMessages.total).toBe(1);
    expect(parMot(r, "PROMO")!.premiersMessages.total).toBe(1);
    expect(parMot(r, "PROMO")!.personnes.total).toBe(1);
  });
  it("même personne et même mot en double : une seule fois", () => {
    const convs = [
      conv({ cle: "a", mot: "GUIDE" }),
      conv({ cle: "a", mot: "GUIDE", m1Le: il_y_a(2 * JOUR) }),
    ];
    expect(parMot(stats([], convs), "GUIDE")!.premiersMessages.total).toBe(1);
  });
});

describe("ancienne conversation", () => {
  it("sans mot ni nature : mot GUIDE, premier envoi", () => {
    const r = stats([], [conv({ cle: "a" })]);
    expect(r.map((s) => s.mot)).toEqual(["GUIDE"]);
    expect(r[0].premiersMessages.total).toBe(1);
  });
  it("mot en minuscules ou invalide : normalisé, ou GUIDE", () => {
    const r = stats(
      [],
      [conv({ cle: "a", mot: "promo" }), conv({ cle: "b", mot: "!" })],
    );
    expect(r.map((s) => s.mot)).toEqual(["GUIDE", "PROMO"]);
  });
});

describe("autres chiffres", () => {
  it("réponses publiques et erreurs", () => {
    const evs: EvenementStat[] = [
      { recuLe: il_y_a(JOUR), motSeul: "GUIDE", etat: "bloque" },
      { recuLe: il_y_a(JOUR), motSeul: null },
    ];
    const convs = [
      conv({ cle: "a", etat: "nouveau", m1Le: null }),
      conv({ cle: "b", etat: "m1_refuse", m1Le: null }),
      conv({ cle: "c", etat: "pub_ok", m1Le: null }),
    ];
    const s = parMot(stats(evs, convs), "GUIDE")!;
    expect(s.commentaires.total).toBe(1);
    expect(s.erreurs.total).toBe(2);
    expect(s.reponsesPubliques.total).toBe(2);
  });
  it("personnes gagnées : seulement « au moins N », jamais un chiffre exact", () => {
    const s = parMot(
      stats([], [conv({ cle: "a", suitLeCompte: true }), conv({ cle: "b" })]),
      "GUIDE",
    )!;
    expect(s.auMoins).toBe(1);
    expect(s.suivent.total).toBe(1);
  });
});

describe("sortie sans identifiant", () => {
  it("aucune clé d'empreinte, aucun identifiant : des mots et des nombres seulement", () => {
    const secret = "empreinte-secrete-fictive-xyz";
    const r = stats(
      [
        {
          recuLe: il_y_a(JOUR),
          motSeul: "GUIDE",
          idAuteur: "id-auteur-fictif",
          idCommentaire: "id-com-fictif",
        } as EvenementStat,
      ],
      [conv({ cle: secret })],
    );
    const texte = JSON.stringify(r);
    for (const interdit of [secret, "id-auteur-fictif", "id-com-fictif"])
      expect(texte).not.toContain(interdit);
    const valeurs = (o: unknown): unknown[] =>
      o && typeof o === "object" ? Object.values(o).flatMap(valeurs) : [o];
    for (const v of valeurs(r.map((x) => ({ ...x, mot: 0 }))))
      expect(typeof v).toBe("number");
  });
});

describe("service : cache de 60 s", () => {
  beforeEach(async () =>
    (await import("@/services/stats-mots")).reinitialiserCacheStatsMots(),
  );
  it("relit après 60 s, pas avant ; erreur de lecture : pas de cache", async () => {
    const { lireStatsMots } = await import("@/services/stats-mots");
    const evenements = vi.fn(
      async () =>
        [{ recuLe: il_y_a(JOUR), motSeul: "GUIDE" }] as EvenementStat[],
    );
    const conversations = vi.fn(async () => [] as ConversationStat[]);
    const lecture = { evenements, conversations };
    const a = await lireStatsMots({ maintenantMs: MAINTENANT, lecture });
    await lireStatsMots({ maintenantMs: MAINTENANT + 59_999, lecture });
    expect(evenements).toHaveBeenCalledTimes(1);
    const b = await lireStatsMots({
      maintenantMs: MAINTENANT + 60_000,
      lecture,
    });
    expect(evenements).toHaveBeenCalledTimes(2);
    expect(a[0].commentaires.total).toBe(b[0].commentaires.total);
    const casse = {
      evenements: vi.fn(async () => {
        throw new Error("panne");
      }),
      conversations,
    };
    await expect(
      lireStatsMots({ maintenantMs: MAINTENANT + 200_000, lecture: casse }),
    ).rejects.toThrow();
    await expect(
      lireStatsMots({ maintenantMs: MAINTENANT + 200_001, lecture: casse }),
    ).rejects.toThrow();
    expect(casse.evenements).toHaveBeenCalledTimes(2);
  });
  it("lecture réelle (dépôts en mémoire) : ne renvoie ni clé ni identifiant", async () => {
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    reinitialiserDepots();
    const { ecrireParametre, depots } = await import("@/services/_commun");
    await ecrireParametre("parcours.conversations", {
      "cle-secrete-fictive": {
        etat: "attente_email",
        creeLe: il_y_a(JOUR),
        m1Le: il_y_a(JOUR),
      },
    });
    await depots().evenementsFournisseurs.enregistrer({
      id: "evf_1",
      fournisseur: "zernio",
      idEvenement: "e1",
      type: "zernio.commentaire",
      recuLe: il_y_a(JOUR),
      traite: true,
      charge: { motSeul: "GUIDE", idAuteur: "auteur-fictif", etat: "a_faire" },
    } as never);
    const { lireStatsMots, reinitialiserCacheStatsMots } =
      await import("@/services/stats-mots");
    reinitialiserCacheStatsMots();
    const r = await lireStatsMots({ maintenantMs: MAINTENANT });
    const texte = JSON.stringify(r);
    expect(texte).not.toContain("cle-secrete-fictive");
    expect(texte).not.toContain("auteur-fictif");
    expect(r[0].commentaires.total).toBe(1);
    expect(r[0].premiersMessages.total).toBe(1);
  });
});
