/**
 * MG-STOP01 / S2 · corrections de l'audit (données 100 % fictives) :
 *  - M1 : un état « oppose » écrit entre la vérification et l'envoi n'est jamais rétrogradé ;
 *  - M2 : si SEULE la vérification « stop partout » tombe en panne, rien ne part et l'événement est reporté (`registre_illisible`) ;
 *  - M3 : l'opposition par l'ÉTAT d'une autre conversation (autre réseau) bloque tout envoi ;
 *  - M5 : une erreur de vérification d'un merci n'arrête pas les autres ;
 *  - chaque envoi fournit un jeton neuf, consommé une seule fois.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import {
  empreintePersonne,
  lireClesEmpreinte,
} from "@/domaine/guide-reseau/empreinte-personne";
import { consommerJetonNonOpposee } from "@/domaine/guide-reseau/jeton-non-opposee";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import {
  ADRESSE_FICTIVE,
  COMPTE,
  ENV,
  T0,
  TITRE,
  cleConversation,
  deposerCommentaire,
  deposerMessage,
  fauxPort,
  silencerConsole,
  validerFormulationsAuParcours,
  validerGuideAuParcours,
} from "./aides/conversation";

const hook = vi.hoisted(() => ({ echecs: 0 }));
// Panne CIBLÉE : seule `personneOpposeePartout` échoue (les `echecs` prochains appels), tout le reste du registre fonctionne.
vi.mock("@/services/oppositions-mots", async (orig) => {
  const r = await orig<Record<string, any>>();
  return {
    ...r,
    personneOpposeePartout: async (...a: unknown[]) => {
      if (hook.echecs > 0) {
        hook.echecs--;
        throw new Error("panne ciblée simulée");
      }
      return r.personneOpposeePartout(...a);
    },
  };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => {
  const r = await orig<Record<string, unknown>>();
  const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
  return {
    ...r,
    siteAccepteVersionM1: (v: string) => VERSIONS_SITE_TEST.has(v),
  };
});
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Opp = await import("@/services/oppositions-mots");

const A = "auteur-fictif-400";
let port: ReturnType<typeof fauxPort>;
let statutSite = 200;
let surLecture: (() => Promise<void>) | null = null;
let surPub: (() => Promise<void>) | null = null;
let consommes: boolean[];
let jetonsVus: unknown[];

const passer = (ms = T0) =>
  C.traiterConversations({
    port: port.port,
    comptesPermis: [COMPTE],
    titreGuide: TITRE,
    env: ENV,
    maintenantMs: ms,
  });
const etatDe = async () =>
  (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[
    cleConversation(A)
  ];
const evenements = () =>
  depots().evenementsFournisseurs.lister(() => true) as Promise<any[]>;

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  hook.echecs = 0;
  statutSite = 200;
  surLecture = null;
  surPub = null;
  consommes = [];
  jetonsVus = [];
  port = fauxPort();
  // Comme le vrai port : chaque envoi CONSOMME son jeton (une fois). Un jeton absent, forgé ou déjà utilisé => envoi refusé.
  for (const nom of [
    "repondreCommentaire",
    "repondreEnPrive",
    "envoyerMessage",
  ] as const) {
    const fauxEnvoi = port.port[nom] as (p: any) => Promise<any>;
    (port.port as any)[nom] = async (p: any) => {
      const ok = consommerJetonNonOpposee(p.nonOpposee);
      consommes.push(ok);
      jetonsVus.push(p.nonOpposee);
      return ok
        ? fauxEnvoi(p)
        : { statut: "refuse", code: "non-opposee-requis" };
    };
  }
  const lire = port.port.lireMessage;
  port.port.lireMessage = async (p) => {
    const r = await lire(p);
    await surLecture?.();
    return r;
  };
  const rep = port.port.repondreCommentaire;
  port.port.repondreCommentaire = async (p) => {
    const r = await rep(p);
    await surPub?.();
    return r;
  };
  pm.injecterTransportSite(async () => ({ statut: statutSite, corps: {} }));
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
    [`GUIDE|${COMPTE}`]: {
      mot: "GUIDE",
      compte: COMPTE,
      etat: "actif",
      idWorkflow: null,
      raison: null,
      modifieLe: "x",
    },
  });
  await validerGuideAuParcours();
  await validerFormulationsAuParcours();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

async function jusquAttenteEmail(): Promise<void> {
  await deposerCommentaire(depots, { idAuteur: A });
  await passer();
  expect((await etatDe()).etat).toBe("attente_email");
}

describe("M1 · un état « oppose » n'est jamais rétrogradé par une écriture d'état", () => {
  it("« stop » écrit juste après la réponse publique : M1 ne part pas et l'état reste « oppose »", async () => {
    await deposerCommentaire(depots, { idAuteur: A });
    surPub = async () => {
      const tout = await Com.lireParametre<Record<string, any>>(
        C.PARAM_CONVERSATIONS,
        {},
      );
      const cle = cleConversation(A);
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
        ...tout,
        [cle]: { ...tout[cle], etat: "oppose" },
      });
    };
    await passer();
    expect(port.pub).toHaveLength(1); // la réponse publique était déjà partie
    expect(port.prive).toHaveLength(0);
    expect((await etatDe()).etat).toBe("oppose");
    await passer(T0 + 600_000);
    expect(port.prive).toHaveLength(0);
    expect((await etatDe()).etat).toBe("oppose");
  });
});

describe("M2 · SEULE la vérification « stop partout » échoue", () => {
  it("M2 : rien ne part, l'événement est reporté avec « registre_illisible », la conversation n'est pas passée à « oppose »", async () => {
    await jusquAttenteEmail();
    port.reponses.texte = () => "bonjour";
    surLecture = async () => {
      hook.echecs = 1; // le contrôle d'entrée est passé ; seul le contrôle juste avant M2 tombe
    };
    await deposerMessage(depots, { idExpediteur: A });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(0);
    expect(consommes.filter(Boolean)).toHaveLength(2); // seulement la réponse publique et M1 de l'étape précédente
    const evs = await evenements();
    const msg = evs.find((e) => e.type === "zernio.message");
    expect(msg.traite).toBe(false);
    expect(msg.charge.dernierCode).toBe("registre_illisible");
    expect((await etatDe()).etat).not.toBe("oppose");
  });
  it("réponse publique : même panne ciblée => aucun envoi, événement reporté", async () => {
    await deposerCommentaire(depots, { idAuteur: A });
    hook.echecs = 3;
    await passer();
    expect(port.pub.length + port.prive.length).toBe(0);
    const ev = (await evenements())[0];
    expect(ev.charge.dernierCode).toBe("registre_illisible");
  });
});

describe("M3 · opposition portée par l'ÉTAT d'une AUTRE conversation (autre réseau)", () => {
  async function opposeParEtatAilleurs(): Promise<void> {
    const k = lireClesEmpreinte(ENV);
    if (!k.ok) throw new Error("clés attendues");
    const autre = empreintePersonne(k.courante, "facebook", A);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [autre]: {
        etat: "oppose",
        reseau: "facebook",
        idCompte: COMPTE,
        idCommentaire: "com-autre",
        alias: [],
        creeLe: new Date(T0 - 3600_000).toISOString(),
      },
    });
  }
  it("aucun envoi (ni réponse publique ni message privé), registre vide", async () => {
    await opposeParEtatAilleurs();
    expect(await Com.lireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [])).toEqual([]);
    await deposerCommentaire(depots, { idAuteur: A });
    await passer();
    await passer(T0 + 600_000);
    expect(port.pub).toHaveLength(0);
    expect(port.prive).toHaveLength(0);
    expect(port.envoyes).toHaveLength(0);
  });
  it("même chose au moment d'un envoi en cours de parcours (M2)", async () => {
    await jusquAttenteEmail();
    port.reponses.texte = () => "bonjour";
    surLecture = opposeParEtatAilleurs;
    await deposerMessage(depots, { idExpediteur: A });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(0);
  });
});

describe("jetons · chaque envoi fournit un jeton NEUF, valide, consommé une seule fois", () => {
  const verifier = () => {
    expect(consommes.length).toBeGreaterThan(0);
    expect(consommes.every(Boolean)).toBe(true); // jamais refusé par le port : jeton émis par la vérification et pas encore utilisé
    expect(new Set(jetonsVus).size).toBe(jetonsVus.length); // aucun jeton réutilisé d'un envoi à l'autre
  };
  it("réponse publique, M1 puis reçu", async () => {
    await jusquAttenteEmail();
    port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idExpediteur: A });
    await passer(T0 + 1000);
    expect(port.envoyes.length).toBe(1);
    expect(consommes).toHaveLength(3);
    verifier();
  });
  it("M2 (adresse non reconnue)", async () => {
    await jusquAttenteEmail();
    port.reponses.texte = () => "bonjour";
    await deposerMessage(depots, { idExpediteur: A });
    await passer(T0 + 1000);
    expect(port.envoyes.length).toBe(1);
    expect(consommes).toHaveLength(3);
    verifier();
  });
  it("message « adresse refusée »", async () => {
    await jusquAttenteEmail();
    statutSite = 422;
    port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idExpediteur: A });
    await passer(T0 + 1000);
    expect(port.envoyes.length).toBe(1);
    expect(consommes).toHaveLength(3);
    verifier();
  });
});

/* --- M5 · merci ------------------------------------------------------------------------------------------------ */
const H = 3600_000;
const ref = (n: number) =>
  createHash("sha256").update(`jeton-fictif-${n}`).digest("hex");

describe("M5 · une erreur de vérification d'un merci n'arrête pas les autres", () => {
  const ENV_MERCI = { ...ENV, PARCOURS_MERCI_ENABLED: "1" };
  const B = "auteur-fictif-401";
  async function preparer(): Promise<void> {
    const empreinteMerci = createHash("sha256")
      .update(`mp-merci-v1\n${TEXTES_MP["mp-merci-v1"].texte}`)
      .digest("hex");
    await Com.ecrireParametre("parcours.validation.merci", {
      empreinte: empreinteMerci,
    });
    const m = new Date(T0 - H).toISOString();
    const base = (n: number, msg: string) => ({
      etat: "attente_email",
      reseau: "instagram",
      idCompte: COMPTE,
      idCommentaire: `com-fictif-${n}`,
      idPostPlateforme: "post-plateforme-fictif-200",
      versionTexteM1: "mp-m1-v4-1",
      guide: "guide-ia",
      cleIdempotenceGuide: `cle-${n}`,
      creeLe: new Date(T0 - 2 * H).toISOString(),
      m1Le: new Date(T0 - 2 * H).toISOString(),
      occurredAt: null,
      m2Envoye: false,
      essaisSite: 0,
      essaisPub: 0,
      essaisM1: 0,
      prochainEssaiLe: null,
      dernierCode: null,
      alias: [],
      refLienConv: `c${n}_AbCdEf0123456789_-xyZQ`,
      empreintesLien: [ref(n)],
      derniereActiviteLe: m,
      idMessageDernier: msg,
    });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cleConversation(A)]: base(1, "msg-dernier-a"),
      [cleConversation(B)]: base(2, "msg-dernier-b"),
    });
    for (const [msg, exp] of [
      ["msg-dernier-a", A],
      ["msg-dernier-b", B],
    ] as const)
      await depots().evenementsFournisseurs.enregistrer({
        id: `evf-${msg}`,
        fournisseur: "zernio",
        idEvenement: `evt-${msg}`,
        type: "zernio.message",
        recuLe: m,
        traite: true,
        creeLe: m,
        modifieLe: m,
        charge: {
          idMessage: msg,
          idConversation: `conv-${msg}`,
          idCompte: COMPTE,
          idExpediteur: exp,
          etat: "termine",
        },
      } as any);
    pm.injecterTransportSite(async (r: RequeteSignee) =>
      r.chemin.endsWith("/issue")
        ? { statut: 200, corps: { ok: true, schemaVersion: 1, recus: 1 } }
        : {
            statut: 200,
            corps: {
              ok: true,
              schemaVersion: 1,
              confirmations: [
                { ref: ref(1), valideLe: new Date(T0 - 60_000).toISOString() },
                { ref: ref(2), valideLe: new Date(T0 - 60_000).toISOString() },
              ],
            },
          },
    );
  }
  const lancer = () =>
    C.traiterMercis({
      port: port.port,
      comptesPermis: [COMPTE],
      titreGuide: TITRE,
      env: ENV_MERCI,
      maintenantMs: T0,
    });

  it("la vérification du 1er merci échoue : il n'est pas envoyé (fermé), le 2e part, le passage ne plante pas", async () => {
    await preparer();
    hook.echecs = 1;
    const rapport = await lancer();
    expect(rapport.envoyes).toBe(1);
    expect(port.envoyes).toHaveLength(1);
    const journal = await Com.lireParametre<Record<string, any>>(
      "parcours.merci.journal",
      {},
    );
    expect(journal[ref(1)]).toBeUndefined(); // le 1er n'est ni envoyé ni marqué : le site le re-proposera
    expect(journal[ref(2)]).toBeDefined();
  });
  it("la vérification échoue pour tous : aucun merci, aucune erreur propagée", async () => {
    await preparer();
    hook.echecs = 100;
    await expect(lancer()).resolves.toBeDefined();
    expect(port.envoyes).toHaveLength(0);
  });
});
