/**
 * LIA-G · listes ouvertes. Réglage éteint = comportement d'aujourd'hui (liste par défaut : GUIDE seul ; port : [titre]).
 * Réglage allumé : mots actifs du registre pour les commentaires, titres des cibles « guide » actives pour le port.
 * Le réglage est simulé par la fonction `motsMultiplesActifs` (la clé n'est jamais citée ici). Données fictives, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runValide } from "@/domaine/guide-reseau/crochet-zernio";

const etat = {
  allume: false,
  catalogue: null as null | { catalogue: unknown[]; liaisons: unknown[] },
};
const creerPort = vi.fn((o: unknown) => (void o, { faux: "port" }));
const traiterConversations = vi.fn(
  async (d: unknown) => (
    void d,
    {
      actif: true,
      traites: 0,
      enAttente: 0,
    }
  ),
);

vi.mock("@/services/parcours-mots-multiples", () => ({
  motsMultiplesActifs: async () => etat.allume,
}));
vi.mock("@/services/cibles-site", async (orig) => ({
  ...(await orig<typeof import("@/services/cibles-site")>()),
  lireCiblesSite: async () => etat.catalogue,
}));
vi.mock("@/fournisseurs/zernio-inbox", () => ({
  creerPortInboxZernio: (o: unknown) => creerPort(o),
}));
vi.mock("@/services/zernio", async (orig) => ({
  ...(await orig<typeof import("@/services/zernio")>()),
  clientZernio: () => ({}),
}));
vi.mock("@/services/parcours-conversation", async (orig) => ({
  ...(await orig<typeof import("@/services/parcours-conversation")>()),
  traiterConversations: (d: unknown) => traiterConversations(d),
}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const { banc, Com, MS, crochetCommentaire, nettoyer, preparer, COMPTE } =
  await import("./filet-guide/_amorce");
const B = await import("@/services/branchements-zernio");

const ligne = (mot: string, etatLigne: string) => ({
  mot,
  compte: COMPTE,
  etat: etatLigne,
  idWorkflow: null,
  raison: null,
  modifieLe: "x",
});

beforeEach(async () => {
  await preparer();
  etat.allume = false;
  etat.catalogue = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
});
afterEach(() => {
  nettoyer();
  vi.unstubAllGlobals();
});

describe("commentaire : liste des mots", () => {
  it("éteint : CHATGPT n'est pas déposé, même s'il est actif au registre", async () => {
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
      [`GUIDE|${COMPTE}`]: ligne("GUIDE", "actif"),
      [`CHATGPT|${COMPTE}`]: ligne("CHATGPT", "actif"),
    });
    const r = await crochetCommentaire("CHATGPT");
    expect(r.statut).toBe(200);
    expect(r.deposes).toEqual([]);
    expect((await crochetCommentaire("GUIDE")).deposes).toHaveLength(1);
  });
  it("allumé et CHATGPT actif : déposé avec motSeul CHATGPT", async () => {
    etat.allume = true;
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
      [`GUIDE|${COMPTE}`]: ligne("GUIDE", "actif"),
      [`CHATGPT|${COMPTE}`]: ligne("CHATGPT", "actif"),
    });
    const r = await crochetCommentaire("CHATGPT");
    expect(r.deposes).toHaveLength(1);
    expect(r.deposes[0].motSeul).toBe("CHATGPT");
  });
  it("allumé : un mot en pause n'est pas déposé", async () => {
    etat.allume = true;
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
      [`CHATGPT|${COMPTE}`]: ligne("CHATGPT", "pause"),
    });
    expect((await crochetCommentaire("CHATGPT")).deposes).toEqual([]);
    expect((await crochetCommentaire("GUIDE")).deposes).toHaveLength(1);
  });
  it.each([["texte"], [["tableau"]], [null]])(
    "allumé + registre illisible (%j) : non déposé, GUIDE reste accepté",
    async (v) => {
      etat.allume = true;
      await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, v);
      expect((await crochetCommentaire("CHATGPT")).deposes).toEqual([]);
      expect((await crochetCommentaire("GUIDE")).deposes).toHaveLength(1);
    },
  );
});

describe("port : titres de guides permis", () => {
  const ENV = {
    PARCOURS_CONVERSATION_ENABLED: "1",
    ZERNIO_API_KEY: "cle-fictive-zernio",
    SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-0123456789-0123456789",
    STUDIO_EMPREINTE_SECRET: "secret-fictif-empreinte-0123456789-ab",
    PARCOURS_CONVERSATION_COMPTES: "ig_1",
    PARCOURS_CONVERSATION_TITRE_GUIDE: "Guide fictif",
  };
  const cat = (e: Record<string, unknown>) => ({
    code: "gde-aaaaaa",
    type: "guide",
    titre: "Autre guide",
    actif: true,
    test: false,
    ...e,
  });
  async function passer1(): Promise<string[]> {
    B.brancherParcoursZernio(ENV);
    await Com.ecrireParametre("zernio.comptes", {
      lusLe: "2026-11-07T10:00:00.000Z",
      comptes: [{ id: "ig_1", reseau: "instagram", nom: "A" }],
    });
    await B.passageParcoursZernio({
      env: ENV,
      maintenantMs: Date.UTC(2026, 10, 7, 12),
    });
    return (creerPort.mock.calls[0][0] as { titresGuidesPermis: string[] })
      .titresGuidesPermis;
  }
  beforeEach(() => {
    creerPort.mockClear();
    delete (globalThis as Record<symbol, unknown>)[
      Symbol.for("studio-axion-ia.branchements-zernio")
    ];
  });
  it("éteint : [titre]", async () => {
    etat.catalogue = { catalogue: [cat({})], liaisons: [] };
    expect(await passer1()).toEqual(["Guide fictif"]);
  });
  it("allumé et catalogue lisible : titre + guides actifs (pas les inactifs ni les adresses)", async () => {
    etat.allume = true;
    etat.catalogue = {
      catalogue: [
        cat({}),
        cat({ code: "gde-bbbbbb", titre: "Inactif", actif: false }),
        cat({ code: "adr-cccccc", type: "adresse", titre: "Adresse" }),
      ],
      liaisons: [],
    };
    expect(await passer1()).toEqual(["Guide fictif", "Autre guide"]);
  });
  it("allumé et catalogue illisible : [titre]", async () => {
    etat.allume = true;
    expect(await passer1()).toEqual(["Guide fictif"]);
  });
});

describe("runValide : liste de guides", () => {
  const run = {
    email: "a@exemple.test",
    mot: "GUIDE",
    reseau: "facebook",
    guide: "gde-xxxxxx",
    versionTexteM1: "mp-m1-v2",
  };
  it("sans 3e paramètre : refuse gde-xxxxxx", () =>
    expect(runValide(run)).toBe(false));
  it("avec la liste : l'accepte", () =>
    expect(runValide(run, undefined, ["guide-ia", "gde-xxxxxx"])).toBe(true));
  it("guide-ia reste accepté par défaut", () =>
    expect(runValide({ ...run, guide: "guide-ia" })).toBe(true));
});

void banc;
