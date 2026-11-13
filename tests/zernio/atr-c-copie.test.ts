/**
 * ATR-C : copier un texte (réponse, message privé LinkedIn) pour le coller À LA MAIN. Aucun envoi, aucun appel au port.
 * Données 100 % fictives ; le dépôt des cartes est la mémoire du service ; les oppositions sont celles du vrai registre (mémoire).
 */
import { readFileSync } from "node:fs";
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
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerDepotMemoire } = await import("@/services/a-traiter");
const Copie = await import("@/services/a-traiter-copie");
const Opp = await import("@/services/oppositions-mots");
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

let depot: ReturnType<typeof creerDepotMemoire>;
const poser = async (c = carte()) => depot.ecrire([c]);
const copier = (o: Record<string, unknown> = {}) => Copie.copierMessageCarte("evt-fictif-001", { env: ENV, maintenantMs: T0, depot, ...o });
const lue = async () => (await depot.lire())[0];

beforeEach(async () => {
  reinitialiserDepots();
  evenements.length = 0;
  silencerConsole();
  depot = creerDepotMemoire();
  await validerFormulationsAuParcours();
  await poser();
});
afterEach(() => {
  vi.restoreAllMocks();
  VERSIONS_SITE_TEST.add("mp-m1-v4-1");
});

describe("copierMessageCarte", () => {
  it("rend un message dont le lien porte reseau=linkedin (jeton décodé), et note la copie", async () => {
    const r = await copier();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const jeton = /https:\/\/axion-ia\.com\/guide-reseau\?j=([A-Za-z0-9_.-]+)/.exec(r.texte)![1];
    const charge = JSON.parse(Buffer.from(jeton.split(".")[0], "base64url").toString("utf8"));
    expect(charge).toMatchObject({ reseau: "linkedin", mot: "GUIDE", guide: "guide-ia", compte: "page_principale", post_ref: "post_fictif_001", version_m1: "mp-m1-v4-1" });
    expect((await lue()).copieLe).toBe(new Date(T0).toISOString());
    const table = await Com.lireParametre<Record<string, string[]>>(Copie.PARAM_COPIES_A_TRAITER, {});
    expect(table[EMPREINTES[0]]).toEqual([new Date(T0).toISOString()]);
  });

  it("opposition entre la création de la carte et le clic : refus, rien de copié", async () => {
    await Opp.enregistrerOpposition(CONTACT, "zernio-contact", { env: ENV });
    const r = await copier();
    expect(r.ok).toBe(false);
    expect((await lue()).copieLe).toBeUndefined();
    expect(await Com.lireParametre(Copie.PARAM_COPIES_A_TRAITER, null)).toBeNull();
    expect(evenements).toEqual([]);
  });

  it("clé d'empreinte changée depuis la création : refus (fermé)", async () => {
    await poser(carte({ kid: "p1.00000000.autre" }));
    expect((await copier()).ok).toBe(false);
  });

  it("quatrième copie en 24 h : refus, trois copies sont permises", async () => {
    for (let i = 0; i < 3; i++) expect((await copier({ maintenantMs: T0 + i * 1000 })).ok).toBe(true);
    const r = await copier({ maintenantMs: T0 + 5000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phrase).toMatch(/trois messages/i);
    // 24 h plus tard : de nouveau possible
    expect((await copier({ maintenantMs: T0 + 25 * 3600_000 })).ok).toBe(true);
  });

  it("formulation non validée : refus", async () => {
    await Com.ecrireParametre("parcours.validation.formulations", {});
    const r = await copier();
    expect(r.ok).toBe(false);
    expect((await lue()).copieLe).toBeUndefined();
  });

  it("version inconnue du site : refus avec la phrase prévue", async () => {
    VERSIONS_SITE_TEST.delete("mp-m1-v4-1");
    const r = await copier();
    expect(r).toEqual({ ok: false, phrase: expect.stringMatching(/le site ne connaît pas encore cette formulation/i) });
    expect((await lue()).copieLe).toBeUndefined();
  });

  it("carte TikTok, carte faite, message indisponible : refus", async () => {
    for (const sur of [{ reseau: "tiktok" }, { statut: "fait" }, { message: "indisponible" }, { opposee: true }]) {
      await poser(carte(sur));
      expect((await copier()).ok).toBe(false);
    }
  });

  it("la date de copie est écrite AVANT le rendu du texte", async () => {
    const ecrire = depot.ecrire.bind(depot);
    depot.ecrire = async (c) => (evenements.push("ecriture"), ecrire(c));
    expect((await copier()).ok).toBe(true);
    expect(evenements).toEqual(["ecriture", "rendu"]);
  });

  it("sans dépôt fourni ou interrupteur éteint : refus, rien n'est écrit", async () => {
    expect((await Copie.copierMessageCarte("evt-fictif-001", { env: ENV, maintenantMs: T0 })).ok).toBe(false);
    expect((await copier({ env: { ...ENV, A_TRAITER_ENABLED: "0" } })).ok).toBe(false);
    expect((await lue()).copieLe).toBeUndefined();
  });

  it("registre des oppositions illisible : « vérification impossible », rien n'est proposé", async () => {
    await Com.ecrireParametre("mots.oppositions", "pas une liste");
    const r = await copier();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phrase).toMatch(/vérification impossible, rien n’est proposé/i);
  });

  it("journal sans le texte, le lien ni une personne ; aucun appel au port", async () => {
    const r = await copier();
    const evts = await depots().evenements.lister(() => true);
    const brut = JSON.stringify(evts);
    expect(brut).toContain("message_copie");
    if (r.ok) expect(brut).not.toContain(r.texte.slice(0, 20));
    for (const interdit of [CONTACT, SECRET_LIEN, "axion-ia.com", COMPTE, "evt-fictif-001"]) expect(brut).not.toContain(interdit);
    const source = readFileSync("src/services/a-traiter-copie.ts", "utf8");
    expect(source).not.toMatch(/zernio-inbox["']|\.requete|\/v1\/inbox|emettreJetonNonOpposee/);
  });
});

describe("copierReponseCarte", () => {
  const reponse = (o: Record<string, unknown> = {}) => Copie.copierReponseCarte("evt-fictif-001", { env: ENV, maintenantMs: T0, depot, ...o });
  it("rend le texte déjà contrôlé, sans plafond", async () => {
    for (let i = 0; i < 5; i++) expect(await reponse()).toEqual({ ok: true, texte: "Merci pour votre intérêt !" });
  });
  it("stop revérifié : une personne opposée n'obtient rien", async () => {
    await Opp.enregistrerOpposition(CONTACT, "zernio-contact", { env: ENV });
    expect((await reponse()).ok).toBe(false);
  });
  it("sans réponse proposée : refus", async () => {
    await poser(carte({ kit: null }));
    expect((await reponse()).ok).toBe(false);
  });
});
