/** MG-3 : corrections du suivi chiffré par mot. Valeurs fictives ; aucune donnée réelle ; aucun réseau. */
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
const guide = (evs: EvenementStat[], convs: ConversationStat[]) =>
  agregerStatsMots(evs, convs, MAINTENANT).find((s) => s.mot === "GUIDE")!;

describe("agrégation : incertains, bloqués, refusés", () => {
  it("un envoi incertain n'est pas compté en envoyé", () => {
    const s = guide(
      [],
      [
        conv({ cle: "a", etat: "m1_a_verifier" }),
        conv({ cle: "b", etat: "m1_consommee" }),
        conv({ cle: "c" }),
      ],
    );
    expect(s.incertains.total).toBe(2);
    expect(s.premiersMessages.total).toBe(1);
    expect(s.envoyes.total).toBe(1);
  });
  it("bloqués (commentaires) et refusés (envois) restent séparés, sans double compte", () => {
    const s = guide(
      [
        { recuLe: il_y_a(JOUR), motSeul: "GUIDE", etat: "bloque" },
        { recuLe: il_y_a(JOUR), motSeul: "GUIDE", etat: "a_faire" },
      ],
      [
        conv({ cle: "a", etat: "m1_refuse", m1Le: null }),
        conv({ cle: "b", etat: "site_refuse", m1Le: null }),
      ],
    );
    expect(s.commentairesBloques.total).toBe(1);
    expect(s.envoisRefuses.total).toBe(2);
    expect(s.erreurs.total).toBe(3);
  });
  it("le refus est daté par refuseLe s'il est lisible, sinon par creeLe", () => {
    const s = guide(
      [],
      [
        conv({
          cle: "a",
          etat: "m1_refuse",
          creeLe: il_y_a(20 * JOUR),
          refuseLe: il_y_a(JOUR),
        }),
        conv({
          cle: "b",
          etat: "m1_refuse",
          creeLe: il_y_a(2 * JOUR),
          refuseLe: "illisible",
        }),
        conv({ cle: "c", etat: "m1_refuse", creeLe: il_y_a(20 * JOUR) }),
      ],
    );
    expect(s.envoisRefuses).toEqual({ j7: 2, j30: 3, total: 3 });
  });
  it("un état vide n'est pas une réponse publique", () => {
    const s = guide([], [conv({ cle: "a", etat: "" }), conv({ cle: "b" })]);
    expect(s.reponsesPubliques.total).toBe(1);
  });
});

describe("service : copie figée et lecture partagée", () => {
  beforeEach(async () =>
    (await import("@/services/stats-mots")).reinitialiserCacheStatsMots(),
  );
  const lectureFictive = () => ({
    evenements: vi.fn(
      async () =>
        [{ recuLe: il_y_a(JOUR), motSeul: "GUIDE" }] as EvenementStat[],
    ),
    conversations: vi.fn(async () => [] as ConversationStat[]),
  });
  it("muter le résultat ne change pas l'appel suivant", async () => {
    const { lireStatsMots } = await import("@/services/stats-mots");
    const lecture = lectureFictive();
    await lireStatsMots({ maintenantMs: MAINTENANT, lecture });
    // Deuxième appel : servi par le cache. C'est lui qu'on tente d'abîmer.
    const a = await lireStatsMots({ maintenantMs: MAINTENANT + 1, lecture });
    expect(lecture.evenements).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a[0])).toBe(true);
    expect(Object.isFrozen(a[0].commentaires)).toBe(true);
    try {
      (a[0].commentaires as { total: number }).total = 99;
    } catch {
      /* gelé : l'écriture est refusée */
    }
    const b = await lireStatsMots({ maintenantMs: MAINTENANT + 2, lecture });
    expect(b[0].commentaires.total).toBe(1);
    expect(b).not.toBe(a);
  });
  it("deux appels simultanés = une seule lecture", async () => {
    const { lireStatsMots } = await import("@/services/stats-mots");
    const lecture = lectureFictive();
    await Promise.all([
      lireStatsMots({ maintenantMs: MAINTENANT, lecture }),
      lireStatsMots({ maintenantMs: MAINTENANT, lecture }),
    ]);
    expect(lecture.evenements).toHaveBeenCalledTimes(1);
    expect(lecture.conversations).toHaveBeenCalledTimes(1);
  });
  it("une erreur n'est jamais mise en cache", async () => {
    const { lireStatsMots } = await import("@/services/stats-mots");
    const lecture = lectureFictive();
    lecture.evenements.mockRejectedValueOnce(new Error("panne"));
    await expect(
      lireStatsMots({ maintenantMs: MAINTENANT, lecture }),
    ).rejects.toThrow();
    const r = await lireStatsMots({ maintenantMs: MAINTENANT, lecture });
    expect(r[0].commentaires.total).toBe(1);
  });
});
