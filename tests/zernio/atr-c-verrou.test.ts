/**
 * ATR-C (verrous) : mêmes essais sur le VRAI dépôt de la file (creerDepotParametre, paramètres simulés). Copier un texte (réponse, message privé LinkedIn) pour le coller À LA MAIN. Aucun envoi, aucun appel au port.
 * Données 100 % fictives ; le dépôt des cartes est la mémoire du service ; les oppositions sont celles du vrai registre (mémoire).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { candidatsEmpreinte, lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { ENV as ENV_BASE, TITRE, silencerConsole, validerFormulationsAuParcours } from "./aides/conversation";
import { VERSIONS_SITE_TEST } from "./aides/versions-site-test";

const evenements = vi.hoisted(() => [] as string[]);
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => {
  const r = await orig<Record<string, unknown>>();
  const { VERSIONS_SITE_TEST: V } = await import("./aides/versions-site-test");
  return { ...r, siteAccepteVersionM1: (v: string) => V.has(v) };
});
vi.mock("@/domaine/guide-reseau/textes-mp", async (orig) => {
  const r = await orig<typeof import("@/domaine/guide-reseau/textes-mp")>();
  return {
    ...r,
    rendreTexteMp: (id: never, v: { lien?: string }) => {
      if (v.lien && v.lien.startsWith("https://axion-ia.com/")) evenements.push("rendu");
      return r.rendreTexteMp(id, v as never);
    },
  };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const A = await import("@/services/a-traiter");
const { creerDepotParametre } = await import("@/services/a-traiter-depot");
const Copie = await import("@/services/a-traiter-copie");
const Com = await import("@/services/_commun");

const T0 = 1_760_781_600_000;
const SECRET_LIEN = "secret-fictif-lien-page-guide-0123456789-abcdef";
const COMPTE = "compte-fictif-linkedin-01";
const ENV = { ...ENV_BASE, A_TRAITER_ENABLED: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const CONTACT = "contact-fictif-linkedin-777";

const cles = lireClesEmpreinte(ENV);
if (!cles.ok) throw new Error("clés de test");
const EMPREINTES = [...new Set(["zernio-contact"].flatMap((e) => candidatsEmpreinte(cles, e as never, CONTACT)))];

const carte = (sur: Record<string, unknown> = {}) => ({
  idEvenement: "evt-fictif-001",
  reseau: "linkedin",
  post: "post_fictif_001",
  lienPost: null,
  mot: "GUIDE",
  motif: "mot_manuel",
  extrait: "Je veux le guide",
  creeLe: new Date(T0 - 3600_000).toISOString(),
  statut: "a_traiter",
  kit: "Merci pour votre intérêt !",
  empreintes: EMPREINTES,
  kid: cles.courante.kid,
  idCompte: COMPTE,
  cible: "guide-ia",
  titreCible: TITRE,
  message: "a_fabriquer",
  ...sur,
}) as never;


let depot: ReturnType<typeof creerDepotParametre>;
const copier = (o: Record<string, unknown> = {}) => Copie.copierMessageCarte("evt-fictif-001", { env: ENV, maintenantMs: T0, depot, ...o });
const lue = async () => (await depot.lire())[0];

beforeEach(async () => {
  reinitialiserDepots();
  evenements.length = 0;
  silencerConsole();
  depot = creerDepotParametre();
  await validerFormulationsAuParcours();
  await depot.ecrire([carte()]);
});
afterEach(() => {
  vi.restoreAllMocks();
  VERSIONS_SITE_TEST.add("mp-m1-v4-1");
});

describe("copie sur le vrai dépôt persistant", () => {
  it("un stop posé en même temps que le clic : le stop reste et aucun texte n'est rendu", async () => {
    let premiere = true;
    let stop: Promise<unknown> = Promise.resolve();
    const espion = {
      ecrire: depot.ecrire,
      lire: async () => {
        const l = await depot.lire();
        if (premiere) {
          premiere = false;
          stop = A.marquerCarteOpposee("evt-fictif-001", { env: ENV, depot }); // le stop passe pendant le clic
        }
        return l;
      },
    };
    const r = await copier({ depot: espion });
    await stop;
    expect(r.ok).toBe(false);
    expect(evenements).toEqual([]);
    const c = await lue();
    expect(c.opposee).toBe(true);
    expect(c.copieLe).toBeUndefined();
  }, 2000);

  it("un stop posé pendant l'écriture de la date : le stop reste (jamais annulé par une liste périmée)", async () => {
    let n = 0;
    let stop: Promise<unknown> = Promise.resolve();
    const espion = {
      ecrire: depot.ecrire,
      lire: async () => {
        const l = await depot.lire();
        if (++n === 3) stop = A.marquerCarteOpposee("evt-fictif-001", { env: ENV, depot }); // lecture de noterCopieCarte
        return l;
      },
    };
    await copier({ depot: espion });
    await stop;
    expect(n).toBeGreaterThanOrEqual(3);
    expect((await lue()).opposee).toBe(true);
  }, 2000);

  it("deux clics simultanés : pas d'interblocage (moins de 2 s), une date par clic, jamais de doublon dans la carte", async () => {
    const debut = Date.now();
    const [a, b] = await Promise.all([copier(), copier({ maintenantMs: T0 + 1000 })]);
    expect(Date.now() - debut).toBeLessThan(2000);
    expect(a.ok && b.ok).toBe(true);
    const c = await lue();
    expect(typeof c.copieLe).toBe("string"); // une seule date sur la carte
    const table = await Com.lireParametre<Record<string, string[]>>(Copie.PARAM_COPIES_A_TRAITER, {});
    expect(table[EMPREINTES[0]]).toHaveLength(2);
    expect(new Set(table[EMPREINTES[0]]).size).toBe(2);
  }, 2000);

  it("quatrième copie en 24 h : refusée, trois sont permises", async () => {
    for (let i = 0; i < 3; i++) expect((await copier({ maintenantMs: T0 + i * 1000 })).ok).toBe(true);
    const r = await copier({ maintenantMs: T0 + 5000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phrase).toMatch(/trois messages/i);
    expect(evenements.filter((e) => e === "rendu")).toHaveLength(3);
  }, 2000);

  it("noterCopieCarte : ne change que copieLe de cette carte ; refuse une carte opposée ou plus à traiter", async () => {
    await depot.ecrire([carte({ idEvenement: "evt-fictif-002" })]);
    expect(await A.noterCopieCarte("evt-fictif-001", "2026-01-01T00:00:00.000Z", { depot })).toBe(true);
    const l = await depot.lire();
    expect(l.find((c) => c.idEvenement === "evt-fictif-001")).toEqual({ ...carte(), copieLe: "2026-01-01T00:00:00.000Z" });
    expect(l.find((c) => c.idEvenement === "evt-fictif-002")).toEqual(carte({ idEvenement: "evt-fictif-002" }));
    await depot.ecrire([carte({ opposee: true })]);
    expect(await A.noterCopieCarte("evt-fictif-001", "x", { depot })).toBe(false);
    await depot.ecrire([carte({ statut: "fait", opposee: false })]);
    expect(await A.noterCopieCarte("evt-fictif-001", "x", { depot })).toBe(false);
    expect(await A.noterCopieCarte("inconnue", "x", { depot })).toBe(false);
  });
});
