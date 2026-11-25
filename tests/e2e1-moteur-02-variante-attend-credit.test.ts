/**
 * E2E-1 n° 2 (MAJEUR, 03/10) — « Fabriquer les N » : une version qui ne peut pas partir faute de crédit (ou de budget)
 * quand sa mère est prête n'attend plus « la mère » pour toujours. Elle devient un brouillon « lancer dès que
 * possible » (attend du crédit), Will est prévenu, et elle part après la recharge comme les autres vidéos en attente.
 * Tout en simulation (aucun appel payant).
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
const boucle = await import("@/services/boucle");
const fr = await import("@/services/fabrication-reseaux");
const credits = await import("@/services/credits");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { centimes } = await import("@/lib/montants");

const MDP = "e2e1-moteur-variante-credit";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  await ecrireParametre("moteur.avocat", "montage-avocat");
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  vi.useRealTimers();
});

const BRIEF = { idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const };

async function sujetValide() {
  const r = await bg.lancerGeneration(BRIEF);
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
  const vs = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
  await bg.validerVariantes(vs.map((v) => v.id));
  return r.scriptMaitreId;
}

async function tourner(jusqua: () => Promise<boolean>, tours = 120) {
  for (let i = 0; i < tours; i++) {
    if (await jusqua()) return;
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  throw new Error("la fabrication n'avance pas");
}

describe("E2E-1 n° 2 · version bloquée faute de crédit", () => {
  it("mère prête, budget du mois épuisé (repère, 08/11) : les versions partent sans attendre de crédit, aucune « attend du crédit », toutes prêtes sans recharge", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await sujetValide();
    // CORRECTEUR 1 — B6 : l'écran envoie le total que Will a confirmé sur la feuille.
    const r = await fr.fabriquerLesN(id, { operationId: "op-credit", lancer: true, totalConfirme: (await fr.planFabricationSujet(id))!.total.centimes });
    expect(r.travailId).toBeTruthy();
    // Correcteur R8 n° 1 : les versions qui suivront leur mère gardent le moteur confirmé par « Fabriquer les N ».
    for (const vid of r.videoIds.slice(1)) expect(fr.declinaisonDe(await depots().videos.obtenir(vid))?.moteurConfirme).toBe("montage-avocat");
    // La mère est partie ; plus rien ne passe ensuite (budget du mois épuisé).
    await ecrireParametre("budget.mensuel", centimes(1));
    await tourner(async () => (await depots().videos.obtenir(r.mereVideoId))?.statut === "prete");
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    const versions = r.videoIds.slice(1);
    for (const vid of versions) {
      const v = (await depots().videos.obtenir(vid))!;
      // Décision du 08/11 : le budget du mois est un repère, les versions partent (en file ou en fabrication), rien n'attend.
      expect(["en_file", "en_fabrication"]).toContain(v.statut);
      expect(fr.declinaisonDe(v)?.attendMere).toBe(false);
      expect(v.lancementEnAttente).toBeUndefined();
    }
    const etat = await fr.etatFabricationSujet(id);
    for (const e of etat.filter((x) => versions.includes(x.videoId))) expect(e).toMatchObject({ attendMere: false, attendCredit: false });
    expect(await depots().notifications.trouver((n) => /attend du crédit/.test(n.titre))).toBeFalsy();
    // Le dépassement est dit (journal + cloche), une seule fois.
    expect((await depots().notifications.lister()).filter((n) => n.titre === "Budget indicatif du mois dépassé")).toHaveLength(1);
    // Sans aucune recharge, toutes les versions vont au bout ; rien ne reste en attente.
    await tourner(async () => (await Promise.all(versions.map((v) => depots().videos.obtenir(v)))).every((v) => v?.statut === "prete"));
    expect((await credits.lancerVideosEnAttente()).lancees).toEqual([]);
  });
});
