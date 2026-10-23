/**
 * L3-01 (audit argent, bloquant) — « Réessayer pendant une recharge lue » : aucun interblocage entre le verrou de la
 * boucle (`sousVerrou`) et le verrou des crédits. Chemin déjà existant : SOUS le verrou des crédits, le pré-vol relit un
 * solde, constate une recharge, et `apresRecharge` prend le verrou de la boucle (ordre crédits → boucle). Avant le
 * correctif, « Réessayer » prenait le verrou de la boucle PUIS celui des crédits (ordre inverse) : les deux files en
 * mémoire, sans délai, se figeaient pour toujours (et le verrou Postgres restait tenu). Un délai de garde fait échouer
 * le test au lieu de le figer. Fichier à part : un interblocage laisse les files globales figées pour le reste du fichier.
 * Faux lecteur HeyGen, aucune clé, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const credits = await import("@/services/credits");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "l3-01-interblocage";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligneVoix: LigneCout = { etape: "Voix", fournisseur: "heygen", unite: "forfait", quantite: 1, prixUnitaire: eur(100), total: eur(100), nature: "reel" };
const GARDE_MS = 3_000;

beforeAll(async () => {
  process.env.SESSION_SECRET = "i".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("budget.seuilConfirmation", eur(1_000_000));
  await ecrireParametre("budget.mensuel", eur(1_000_000));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

/** Faux HeyGen : `lireSolde` signale son entrée puis attend `ouvrir()` avant de rendre `solde` (centimes de dollar). */
function heygenRetenu(solde: number) {
  let entre!: () => void;
  let ouvrir!: () => void;
  const estEntre = new Promise<void>((r) => (entre = r));
  const porte = new Promise<void>((r) => (ouvrir = r));
  let retenir = false;
  const lecteur: LecteurCredit = {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      if (retenir) {
        entre();
        await porte;
      }
      return { fournisseur: "heygen", centimes: solde, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…essai", message: "ok", testeLe: new Date().toISOString() };
    },
  };
  return { lecteur, estEntre, ouvrir: () => ouvrir(), retenir: () => void (retenir = true) };
}

async function travailEnEchec(): Promise<string> {
  const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true, simulerEchecEtape: "montage" });
  vi.useFakeTimers({ toFake: ["Date"] });
  for (let i = 0; i < 200; i++) {
    if ((await depots().travaux.obtenir(travailId))?.statut === "echec") break;
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  vi.useRealTimers();
  expect((await depots().travaux.obtenir(travailId))?.statut).toBe("echec");
  return travailId;
}

function avecGarde<T>(p: Promise<T>, quoi: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rejeter) => setTimeout(() => rejeter(new Error(`INTERBLOCAGE : ${quoi} figé au-delà de ${GARDE_MS} ms`)), GARDE_MS))]);
}

describe("L3-01 · « Réessayer » pendant une recharge lue : aucun interblocage", () => {
  it("une étape réserve une voix et constate une recharge HeyGen pendant « Réessayer » : les deux aboutissent", async () => {
    const h = heygenRetenu(2_000_000);
    credits.injecterLecteursPourEssai([h.lecteur], ["heygen"]);
    const travailId = await travailEnEchec();
    // Dernier relevé HeyGen à 1 000 000 c$ vieux de 10 min : le pré-vol le relit, lit 2 000 000 → recharge constatée.
    for (const r of await depots().relevesSoldes.lister()) await depots().relevesSoldes.supprimer(r.id);
    const ilYa = new Date(Date.now() - 10 * 60_000).toISOString();
    await depots().relevesSoldes.enregistrer({ id: "rel-ancien", fournisseur: "heygen", mode: "reel", centimes: 1_000_000, devise: "USD", luLe: ilYa, creeLe: ilYa, modifieLe: ilYa });
    h.retenir();

    // 1. Sous le verrou des crédits : la réservation de la voix relit le solde (retenue à la porte).
    const reservation = credits.verifierEtReserver({ lignes: [ligneVoix], total: eur(100) }, true, "Cette voix", { travailId: "trv-voix" });
    await avecGarde(h.estEntre, "la lecture du solde");
    // 2. « Réessayer » arrive pendant ce temps.
    const relance = travaux.reessayerTravail(travailId);
    await new Promise((r) => setTimeout(r, 100));
    // 3. Le solde lu revient : recharge constatée → apresRecharge prend le verrou de la boucle.
    h.ouvrir();

    await expect(avecGarde(reservation, "la réservation de la voix")).resolves.toBeUndefined();
    const r = await avecGarde(relance, "« Réessayer »");
    expect(r.statut).not.toBe("echec");
    expect(await depots().reservations.compter((x) => x.travailId === "trv-voix" && x.statut === "active")).toBeGreaterThan(0);
    // Les deux verrous sont de nouveau libres : un nouveau passage n'attend pas.
    await avecGarde(boucle.tourDeBoucle(), "le tour de boucle suivant");
  });
});
