/**
 * E2E-1 générateur n° 9, 2e moitié (MAJEUR, 03/10) — une limite PROPOSÉE PAR LA MACHINE, validée d'un toucher (« C'est
 * juste »), était rangée comme matière « Limite » de Will et reprise toute seule au sujet suivant, déjà « validée ».
 * Attendu : elle ne sert qu'à SON sujet ; elle n'apparaît ni dans « Mes matières » ni dans la jauge, et n'est jamais
 * choisie pour un autre sujet. Tout en simulation.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const mat = await import("@/services/matieres");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "e2e1-restes-limite";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  // Aucune limite dictée par Will : la machine en propose une.
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres).filter((x) => x.type !== "limite")) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => bg.arreterBoucleGeneration());

async function ecrire(idee: string) {
  const r = await bg.lancerGeneration({ idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  return r.scriptMaitreId;
}

describe("E2E-1 n° 9 · limite proposée par la machine", () => {
  it("validée d'un toucher, elle reste au sujet : absente de « Mes matières », jamais reprise ailleurs", async () => {
    const a = await ecrire(SUJETS_BANC[0].idee);
    const ma = (await depots().scriptsMaitres.obtenir(a))!;
    expect(ma.exception?.source).toBe("proposition-machine");
    await bg.validerException(a, "c-est-juste");
    const limiteId = (await depots().scriptsMaitres.obtenir(a))!.exception!.matiereId!;
    const limite = (await depots().matieres.obtenir(limiteId))!;
    expect(limite.saisiePar).toBe("proposee-machine");

    // « Mes matières » et la jauge : rien de la machine.
    const liste = await mat.listerMatieres();
    expect(liste.map((x) => x.matiere.id)).not.toContain(limiteId);
    expect(liste.some((x) => x.matiere.saisiePar === "proposee-machine")).toBe(false);
    const avant = await mat.lireJauge();

    // Un autre sujet, même pilier : la limite du premier n'est ni son ancrage, ni sa limite, ni citée.
    for (const idee of [SUJETS_BANC[0].idee, SUJETS_BANC[1]?.idee ?? SUJETS_BANC[0].idee]) {
      const b = await ecrire(idee);
      const mb = (await depots().scriptsMaitres.obtenir(b))!;
      expect(mb.ancrages.map((x) => x.matiereId)).not.toContain(limiteId);
      expect(mb.exception?.matiereId).not.toBe(limiteId);
      expect(mb.exception?.valideeParWill ?? false).toBe(false);
      const scripts = await depots().scripts.lister((s) => s.scriptMaitreId === b);
      const cites = scripts.flatMap((s) => s.blocs.flatMap((bl) => bl.segments.flatMap((g) => g.matiereIds ?? [])));
      expect(cites).not.toContain(limiteId);
    }
    // La jauge ne compte pas la limite de la machine comme une limite de Will.
    expect((await mat.lireJauge()).parType.limite).toBe(avant.parType.limite);
    expect(avant.parType.limite).toBe(0);
  });

  it("seule matière restante : un autre sujet ne la prend jamais comme matière (écriture et choix du fond)", async () => {
    const gen = await import("@/services/generateur");
    const choix = await import("@/services/choix-generateur");
    const a = await ecrire(SUJETS_BANC[0].idee);
    await bg.validerException(a, "c-est-juste");
    const limiteId = (await depots().scriptsMaitres.obtenir(a))!.exception!.matiereId!;
    // Toutes les autres matières sont rangées : il ne reste que la limite réservée au sujet A.
    for (const m of await depots().matieres.lister((x) => x.id !== limiteId)) await depots().matieres.modifier(m.id, { archiveLe: new Date().toISOString() });

    const b = await gen.creerSujet({ idee: "Remplacer Excel par un tableau de bord", reseaux: ["tiktok"], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id });
    const e = await gen.ecrireSujetSimule(b.id);
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.manque).toBe("ANCRAGE_MANQUANT");

    const c = await gen.creerSujet({ idee: "Remplacer Excel par un tableau de bord", reseaux: ["tiktok"], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id });
    const r = await choix.reserverCombinaison(c.id);
    if (r.ok) expect(r.retenue.ancrages.map((x) => x.matiereId)).not.toContain(limiteId);
    else expect((await depots().scriptsMaitres.obtenir(c.id))!.manque?.type).toBe("ANCRAGE_MANQUANT");
  });
});
