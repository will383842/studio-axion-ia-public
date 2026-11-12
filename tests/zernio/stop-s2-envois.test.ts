/**
 * MG-STOP01 / S2 · « stop partout » branché sur CHAQUE envoi du parcours (données 100 % fictives).
 * Pour chaque point d'envoi, trois modes :
 *  - « ok »     : personne non opposée => l'envoi part comme avant, avec le jeton « non opposée » ;
 *  - « autre »  : personne opposée sur un AUTRE réseau (empreinte « instagram » au registre) APRÈS le contrôle précédent => rien ne part ;
 *  - « erreur » : vérification impossible (lecture en erreur) => rien ne part (fermé), l'événement reste à réessayer.
 * L'opposition (ou la panne) est déclenchée à l'instant exact qui précède le point testé : le contrôle précédent n'a rien vu,
 * seul le contrôle du point lui-même peut arrêter l'envoi.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import {
  empreintePersonne,
  lireClesEmpreinte,
} from "@/domaine/guide-reseau/empreinte-personne";
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

const hook = vi.hoisted(() => ({
  apresEcriture: null as null | ((nom: string) => Promise<void>),
  lectureEnErreur: false,
}));
vi.mock("@/services/_commun", async (orig) => {
  const r = await orig<Record<string, any>>();
  return {
    ...r,
    lireParametre: async (nom: string, ...a: unknown[]) => {
      if (hook.lectureEnErreur && nom.endsWith(".alias"))
        throw new Error("panne simulée");
      return r.lireParametre(nom, ...a);
    },
    ecrireParametre: async (nom: string, ...a: unknown[]) => {
      const x = await r.ecrireParametre(nom, ...a);
      await hook.apresEcriture?.(nom);
      return x;
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
const { consommerJetonNonOpposee } =
  await import("@/domaine/guide-reseau/jeton-non-opposee");

const A = "auteur-fictif-400";
type Mode = "ok" | "autre" | "erreur";

let port: ReturnType<typeof fauxPort>;
let sites: RequeteSignee[];
let statutSite = 200;
let surSite: (() => Promise<void>) | null = null;
let jetons: Array<{ via: string; jeton: unknown }>;
let surLecture: (() => Promise<void>) | null = null;
let surPub: (() => Promise<void>) | null = null;
let lireAvant = -1;

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

/** Personne opposée sur un AUTRE réseau : écriture directe au registre (sans verrou : peut être appelée pendant une écriture). */
async function opposerAilleurs(): Promise<void> {
  const k = lireClesEmpreinte(ENV);
  if (!k.ok) throw new Error("clés attendues");
  await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [
    {
      id: empreintePersonne(k.courante, "instagram", A),
      le: "2026-10-18T09:00:00.000Z",
      transmise: false,
    },
  ]);
}
/** Déclenche, à l'instant précis, l'opposition ailleurs ou la panne de vérification. */
async function declencher(mode: Mode): Promise<void> {
  hook.apresEcriture = null;
  if (mode === "autre") await opposerAilleurs();
  if (mode === "erreur") hook.lectureEnErreur = true;
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  hook.apresEcriture = null;
  hook.lectureEnErreur = false;
  statutSite = 200;
  surSite = null;
  sites = [];
  jetons = [];
  surLecture = null;
  surPub = null;
  lireAvant = -1;
  port = fauxPort();
  // Le faux port note le jeton reçu : preuve que chaque envoi le transporte.
  for (const nom of [
    "repondreCommentaire",
    "repondreEnPrive",
    "envoyerMessage",
  ] as const) {
    const reel = port.port[nom] as (p: any) => Promise<any>;
    (port.port as any)[nom] = (p: any) => (
      jetons.push({ via: nom, jeton: p.nonOpposee }),
      reel(p)
    );
  }
  // Le déclencheur s'exécute APRÈS la lecture du message (ou l'envoi de la réponse publique) : après le contrôle précédent, avant le suivant.
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
  pm.injecterTransportSite(async (r) => {
    sites.push(r);
    if (surSite) await surSite();
    return { statut: statutSite, corps: {} };
  });
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

/** Un commentaire GUIDE puis des passages : réponse publique + M1 envoyés, conversation en « attente_email ». */
async function jusquAttenteEmail(): Promise<void> {
  await deposerCommentaire(depots, { idAuteur: A });
  await passer();
  expect((await etatDe()).etat).toBe("attente_email");
}

interface Point {
  nom: string;
  /** Prépare la situation et rend la fonction qui lance le passage, après avoir armé le déclencheur. */
  jouer: (mode: Mode) => Promise<void>;
  /** Nombre d'envois du point testé. */
  cible: () => number;
  /** Nom de l'appel du port attendu pour l'envoi testé (le jeton doit y figurer). */
  via?: string;
}

const points: Point[] = [
  {
    nom: "démarrage d'un parcours (contrôle d'entrée du commentaire)",
    cible: () => port.pub.length + port.prive.length,
    jouer: async (mode) => {
      await deposerCommentaire(depots, { idAuteur: A });
      await declencher(mode);
      await passer();
    },
  },
  {
    nom: "réponse publique",
    cible: () => port.pub.length,
    via: "repondreCommentaire",
    jouer: async (mode) => {
      await deposerCommentaire(depots, { idAuteur: A });
      // Juste après l'écriture de l'état « nouveau » (après le contrôle d'entrée, avant la réponse publique).
      hook.apresEcriture = async (nom) => {
        if (nom === C.PARAM_CONVERSATIONS) await declencher(mode);
      };
      await passer();
    },
  },
  {
    nom: "message privé M1 (avec lien)",
    cible: () => port.prive.length,
    via: "repondreEnPrive",
    jouer: async (mode) => {
      await deposerCommentaire(depots, { idAuteur: A });
      // Juste après la réponse publique (partie), avant M1.
      surPub = () => declencher(mode);
      await passer();
    },
  },
  {
    nom: "contrôle d'entrée d'un message privé",
    cible: () => port.envoyes.length + sites.length,
    jouer: async (mode) => {
      await jusquAttenteEmail();
      port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
      await deposerMessage(depots, { idExpediteur: A });
      await declencher(mode);
      lireAvant = port.lire;
      await passer(T0 + 1000);
    },
  },
  {
    nom: "M2 (adresse non reconnue)",
    cible: () => port.envoyes.length,
    via: "envoyerMessage",
    jouer: async (mode) => {
      await jusquAttenteEmail();
      port.reponses.texte = () => "bonjour";
      surLecture = () => declencher(mode);
      await deposerMessage(depots, { idExpediteur: A });
      await passer(T0 + 1000);
    },
  },
  {
    nom: "demande du guide par e-mail (appel au site)",
    cible: () => sites.length,
    jouer: async (mode) => {
      await jusquAttenteEmail();
      port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
      surLecture = () => declencher(mode);
      await deposerMessage(depots, { idExpediteur: A });
      await passer(T0 + 1000);
    },
  },
  {
    nom: "message « adresse refusée »",
    cible: () => port.envoyes.length,
    via: "envoyerMessage",
    jouer: async (mode) => {
      await jusquAttenteEmail();
      statutSite = 422;
      surSite = async () => declencher(mode); // après le contrôle de la demande, avant le message
      port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
      await deposerMessage(depots, { idExpediteur: A });
      await passer(T0 + 1000);
    },
  },
  {
    nom: "reçu après la demande de guide",
    cible: () => port.envoyes.length,
    via: "envoyerMessage",
    jouer: async (mode) => {
      await jusquAttenteEmail();
      surSite = async () => declencher(mode);
      port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
      await deposerMessage(depots, { idExpediteur: A });
      await passer(T0 + 1000);
    },
  },
];

describe("S2 · chaque point d'envoi passe par la vérification unique « stop partout »", () => {
  for (const p of points) {
    describe(p.nom, () => {
      it("personne non opposée : l'envoi part comme avant, avec le jeton « non opposée »", async () => {
        await p.jouer("ok");
        expect(p.cible()).toBeGreaterThan(0);
        if (p.via) {
          const j = jetons.filter((x) => x.via === p.via).at(-1)?.jeton;
          expect(j).toBeDefined();
          expect(consommerJetonNonOpposee(j)).toBe(true); // jeton réellement émis par la vérification, pas un objet forgé
        }
      });
      it("opposée sur un AUTRE réseau : rien ne part, la conversation passe à « oppose » (données gardées)", async () => {
        await p.jouer("autre");
        expect(p.cible()).toBe(0);
        // Contrôle d'entrée : arrêt AVANT toute lecture du message et, au démarrage, AVANT toute création de conversation.
        if (p.nom.startsWith("contrôle d'entrée"))
          expect(port.lire).toBe(lireAvant);
        if (p.nom.startsWith("démarrage"))
          expect(await etatDe()).toBeUndefined();
        const e = await etatDe();
        if (e) {
          expect(e.etat).toBe("oppose");
          expect(e.idCommentaire).toBeTruthy(); // rien n'est supprimé
        }
        // Un second passage plus tard n'envoie toujours rien.
        await passer(T0 + 600_000);
        expect(p.cible()).toBe(0);
      });
      it("vérification impossible (erreur de lecture) : rien ne part, l'événement reste à réessayer", async () => {
        await p.jouer("erreur");
        expect(p.cible()).toBe(0);
        const evs = await depots().evenementsFournisseurs.lister(
          (x: any) => !x.traite,
        );
        expect(evs.length).toBeGreaterThan(0);
      });
    });
  }

  it("aucun identifiant ni adresse dans les journaux, les alertes et la console", async () => {
    await points[3].jouer("autre");
    await points[4].jouer("erreur").catch(() => undefined);
    const sortie = [
      JSON.stringify(await depots().evenements.lister(() => true)),
      JSON.stringify(await depots().notifications.lister(() => true)),
      JSON.stringify((console.log as any).mock?.calls ?? []),
      JSON.stringify((console.error as any).mock?.calls ?? []),
      JSON.stringify((console.warn as any).mock?.calls ?? []),
    ].join("\n");
    expect(sortie).not.toContain(A);
    expect(sortie).not.toContain(ADRESSE_FICTIVE);
    expect(sortie).not.toContain("conv-fictive-700");
    expect(sortie).not.toContain(cleConversation(A));
  });
});

/* --- Merci après la page (deux points : relecture d, puis relecture j juste avant le réseau) ---------------------- */
const H = 3600_000;
const ref = (n: number) =>
  createHash("sha256").update(`jeton-fictif-${n}`).digest("hex");
const PARAM_JOURNAL = "parcours.merci.journal";

describe("S2 · merci après la page", () => {
  const ENV_MERCI = { ...ENV, PARCOURS_MERCI_ENABLED: "1" };
  let accuses: RequeteSignee[];
  async function preparer(): Promise<void> {
    const empreinteMerci = createHash("sha256")
      .update(`mp-merci-v1\n${TEXTES_MP["mp-merci-v1"].texte}`)
      .digest("hex");
    await Com.ecrireParametre("parcours.validation.merci", {
      empreinte: empreinteMerci,
    });
    const cle = cleConversation(A);
    const m = new Date(T0 - H).toISOString();
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: {
        etat: "attente_email",
        reseau: "instagram",
        idCompte: COMPTE,
        idCommentaire: "com-fictif-1",
        idPostPlateforme: "post-plateforme-fictif-200",
        versionTexteM1: "mp-m1-v4-1",
        guide: "guide-ia",
        cleIdempotenceGuide: `cle-${A}`,
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
        refLienConv: "c1_AbCdEf0123456789_-xyZQ",
        empreintesLien: [ref(1)],
        derniereActiviteLe: m,
        idMessageDernier: "msg-dernier",
      },
    });
    await depots().evenementsFournisseurs.enregistrer({
      id: "evf-msg-dernier",
      fournisseur: "zernio",
      idEvenement: "evt-msg-dernier",
      type: "zernio.message",
      recuLe: m,
      traite: true,
      creeLe: m,
      modifieLe: m,
      charge: {
        idMessage: "msg-dernier",
        idConversation: "conv-fictive-700",
        idCompte: COMPTE,
        idExpediteur: A,
        etat: "termine",
      },
    });
    accuses = [];
    pm.injecterTransportSite(async (r) => {
      if (r.chemin.endsWith("/issue")) accuses.push(r);
      return r.chemin.endsWith("/issue")
        ? { statut: 200, corps: { ok: true, schemaVersion: 1, recus: 1 } }
        : {
            statut: 200,
            corps: {
              ok: true,
              schemaVersion: 1,
              confirmations: [
                { ref: ref(1), valideLe: new Date(T0 - 60_000).toISOString() },
              ],
            },
          };
    });
  }
  const mercis = () => port.envoyes.filter((e) => e.texte.length > 0);
  const lancer = () =>
    C.traiterMercis({
      port: port.port,
      comptesPermis: [COMPTE],
      titreGuide: TITRE,
      env: ENV_MERCI,
      maintenantMs: T0,
    });

  it("non opposée : le merci part avec le jeton", async () => {
    await preparer();
    await lancer();
    expect(mercis()).toHaveLength(1);
    const j = jetons.find((x) => x.via === "envoyerMessage")?.jeton;
    expect(consommerJetonNonOpposee(j)).toBe(true);
  });
  it("opposée sur un autre réseau avant la relecture : aucun merci, conversation à « oppose »", async () => {
    await preparer();
    await opposerAilleurs();
    const vus: string[] = [];
    hook.apresEcriture = async (nom) => {
      if (nom === PARAM_JOURNAL)
        vus.push(
          String(
            Object.values(
              await Com.lireParametre<Record<string, any>>(PARAM_JOURNAL, {}),
            )[0]?.etat,
          ),
        );
    };
    await lancer();
    expect(mercis()).toHaveLength(0);
    expect((await etatDe()).etat).toBe("oppose");
    expect(vus).not.toContain("en_vol"); // arrêtée à la 1re relecture : jamais réservée « en vol »
  });
  it("opposée sur un autre réseau JUSTE avant le réseau (relecture finale) : aucun merci", async () => {
    await preparer();
    hook.apresEcriture = async (nom) => {
      if (nom === PARAM_JOURNAL) await declencher("autre");
    };
    await lancer();
    expect(mercis()).toHaveLength(0);
  });
  it("vérification impossible avant le réseau : aucun merci (fermé)", async () => {
    await preparer();
    hook.apresEcriture = async (nom) => {
      if (nom === PARAM_JOURNAL) await declencher("erreur");
    };
    await lancer().catch(() => undefined);
    expect(mercis()).toHaveLength(0);
  });
});
