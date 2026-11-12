/**
 * MG-STOP01 / S6 · GARDE STATIQUE + scénario de bout en bout : aucun futur envoi ne doit contourner le « stop partout ».
 * (A) lit les sources de `src/` ; (B) rejoue le parcours avec les fausses dépendances existantes (données 100 % fictives).
 *
 * Si une garde (A) rougit : NE CONTOURNE PAS la garde. Ajoute ton envoi à la liste fermée correspondante ci-dessous
 * APRÈS une relecture de sécurité (la vérification « stop partout » passe-t-elle avant l'envoi, et le jeton est-il consommé ?).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  deposerCommentaire,
  deposerMessage,
  fauxPort,
  silencerConsole,
  validerFormulationsAuParcours,
  validerGuideAuParcours,
} from "./aides/conversation";

/* ───────────────────────── (A) GARDE STATIQUE ───────────────────────── */

const RACINE = join(process.cwd(), "src");
const CONSIGNE =
  "Ajoute ton envoi à la liste fermée de tests/zernio/stop-s6-garde.test.ts APRÈS une relecture de sécurité " +
  "(la vérification « stop partout » passe avant l'envoi, le jeton « non opposée » est transporté et consommé).";

/** Liste fermée : fichiers autorisés à appeler les routes d'ÉCRITURE de l'Inbox (par `client.requete`). */
const APPELANTS_ROUTES_ECRITURE_INBOX = ["fournisseurs/zernio-inbox.ts"];
/** Liste fermée : fichiers qui CONSTRUISENT le client bas niveau (`creerClientZernio`). */
const CONSTRUCTEURS_CLIENT_ZERNIO = [
  "fournisseurs/publication/zernio.ts",
  "services/zernio.ts",
];
/** Liste fermée : fichiers qui appellent `.requete(` (hors client lui-même). Les autres n'ont que des méthodes typées sans Inbox. */
const APPELANTS_REQUETE_BRUTE = [
  "fournisseurs/zernio-inbox.ts",
  "fournisseurs/mesures/zernio.ts",
];
/** Liste fermée : fichiers qui construisent le port Inbox (`creerPortInboxZernio`). */
const CONSTRUCTEURS_PORT_INBOX = ["services/branchements-zernio.ts"];
/** Liste fermée : fichiers autorisés à nommer l'émetteur de jetons « non opposée » (hors sa définition). */
const EMETTEURS_JETON_AUTORISES = [
  "domaine/guide-reseau/jeton-non-opposee.ts",
  "services/oppositions-mots.ts",
];
const METHODES_ENVOI = [
  "repondreCommentaire",
  "repondreEnPrive",
  "envoyerMessage",
] as const;

const CLIENT = "fournisseurs/publication/zernio-client.ts";
const PORT = "fournisseurs/zernio-inbox.ts";

function listerSources(dossier: string): string[] {
  const res: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) res.push(...listerSources(p));
    else if (/\.(ts|tsx)$/.test(nom) && !/\.test\.(ts|tsx)$/.test(nom))
      res.push(p);
  }
  return res;
}
/** Retire les commentaires (une phrase de doc qui cite un nom n'est pas un appel). */
function sansCommentaires(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[\s;{}(,])\/\/.*$/gm, "$1");
}
const SOURCES = new Map<string, string>(
  listerSources(RACINE).map((f) => [
    relative(RACINE, f).split("\\").join("/"),
    sansCommentaires(readFileSync(f, "utf8")),
  ]),
);
const fichiersContenant = (re: RegExp): string[] =>
  [...SOURCES]
    .filter(([, s]) => re.test(s))
    .map(([f]) => f)
    .sort();
/** Texte des arguments d'un appel : de la parenthèse ouvrante à sa parenthèse fermante. */
function argumentsDe(s: string, indexParenthese: number): string {
  let niveau = 0;
  for (let i = indexParenthese; i < s.length; i++) {
    if (s[i] === "(") niveau++;
    else if (s[i] === ")" && --niveau === 0)
      return s.slice(indexParenthese, i + 1);
  }
  return s.slice(indexParenthese);
}
const echec = (quoi: string, liste: string[]) =>
  `${quoi} : ${liste.join(", ")}. ${CONSIGNE}`;

describe("S6 (A) garde statique · aucune porte d'envoi ne contourne « stop partout »", () => {
  it("la garde lit bien les sources (sinon elle serait vide)", () => {
    expect(SOURCES.has(CLIENT)).toBe(true);
    expect(SOURCES.has(PORT)).toBe(true);
    expect(SOURCES.has("services/oppositions-mots.ts")).toBe(true);
    expect(SOURCES.size).toBeGreaterThan(100);
  });

  it("(1) les routes d'écriture de l'Inbox (liste fermée du client) ne sont appelées que depuis zernio-inbox.ts", () => {
    const client = SOURCES.get(CLIENT)!;
    // Routes Inbox d'ÉCRITURE = lignes POST de la table ROUTES dont le motif vise /v1/inbox.
    const ecritures = [
      ...client.matchAll(
        /methode:\s*"POST",\s*motif:[^\n]*?\/v1\/inbox[^\n]*?route:\s*"([a-z-]+)"/g,
      ),
    ]
      .map((m) => m[1])
      .sort();
    expect(
      ecritures,
      "La liste fermée des routes d'écriture Inbox a changé : relecture de sécurité obligatoire, puis mets cette garde à jour.",
    ).toEqual(["envoyer-message", "repondre-commentaire", "reponse-privee"]);
    // Aucun GET inbox déguisé en écriture ni écriture hors table : seuls les 4 chemins Inbox existent.
    const tousInbox = [
      ...client.matchAll(
        /motif:[^\n]*?\/v1\/inbox[^\n]*?route:\s*"([a-z-]+)"/g,
      ),
    ]
      .map((m) => m[1])
      .sort();
    expect(tousInbox).toEqual([
      "envoyer-message",
      "lire-messages",
      "repondre-commentaire",
      "reponse-privee",
    ]);
    // Qui écrit un chemin d'écriture Inbox ? (chemin littéral ou gabarit)
    const appelants = fichiersContenant(/\/v1\/inbox/).filter(
      (f) => f !== CLIENT,
    );
    expect(
      appelants,
      echec("Chemin /v1/inbox écrit hors de la liste fermée", appelants),
    ).toEqual(APPELANTS_ROUTES_ECRITURE_INBOX);
    // Appel brut `.requete(` : liste fermée aussi (un autre appelant pourrait viser l'Inbox par un chemin construit).
    const importeClient = new Set(fichiersContenant(/zernio-client"/));
    const bruts = fichiersContenant(/\.requete\(/).filter(
      (f) => f !== CLIENT && importeClient.has(f),
    );
    expect(bruts, echec("Appel direct à client.requete(", bruts)).toEqual(
      [...APPELANTS_REQUETE_BRUTE].sort(),
    );
    // Chemin Inbox construit à distance (« inbox/comments », « inbox/conversations ») : mêmes appelants.
    const construits = fichiersContenant(
      /inbox\/(comments|conversations)/,
    ).filter((f) => f !== CLIENT);
    expect(
      construits,
      echec("Chemin Inbox construit hors de la liste fermée", construits),
    ).toEqual(APPELANTS_ROUTES_ECRITURE_INBOX);
  });

  it("(2) hors zernio-inbox.ts, personne n'importe le client d'envoi bas niveau de l'Inbox", () => {
    // Aide d'idempotence Inbox : propre au port.
    const idem = fichiersContenant(/\benteteIdempotenceInbox\b/).filter(
      (f) => f !== CLIENT,
    );
    expect(
      idem,
      echec("Aide d'envoi Inbox utilisée hors du port", idem),
    ).toEqual([PORT]);
    // Fabrique du client bas niveau : liste fermée.
    const fabriques = fichiersContenant(/\bcreerClientZernio\b/).filter(
      (f) => f !== CLIENT,
    );
    expect(
      fabriques,
      echec("Fabrique du client Zernio bas niveau utilisée", fabriques),
    ).toEqual([...CONSTRUCTEURS_CLIENT_ZERNIO].sort());
    // Fabrique du port : liste fermée.
    const ports = fichiersContenant(/\bcreerPortInboxZernio\b/).filter(
      (f) => f !== PORT,
    );
    expect(ports, echec("Port Inbox construit", ports)).toEqual(
      CONSTRUCTEURS_PORT_INBOX,
    );
    // Le port ne contourne pas son propre jeton : chaque méthode d'écriture teste le jeton avant d'écrire.
    const port = SOURCES.get(PORT)!;
    expect(port).toMatch(/consommerJetonNonOpposee/);
    for (const m of METHODES_ENVOI) {
      const i = port.indexOf(`${m}:`);
      expect(i, `${m} absente du port`).toBeGreaterThan(-1);
      const bloc = port.slice(i, i + 400);
      expect(
        bloc,
        `${m} doit refuser sans jeton avant tout appel réseau. ${CONSIGNE}`,
      ).toMatch(/jetonRefuse\(p\.nonOpposee\)/);
      const iEcrire = bloc.indexOf("ecrire(");
      expect(
        iEcrire === -1 || bloc.indexOf("jetonRefuse") < iEcrire,
        `${m} : le jeton doit être testé AVANT l'écriture. ${CONSIGNE}`,
      ).toBe(true);
    }
  });

  it("(3) aucun appel à personneOpposee( mono-espace dans le parcours, le mot et à-traiter", () => {
    for (const f of [
      "services/parcours-conversation.ts",
      "services/parcours-mot.ts",
      "services/a-traiter.ts",
    ]) {
      const s = SOURCES.get(f)!;
      expect(s, `${f} introuvable`).toBeDefined();
      expect(
        s,
        `${f} : appel mono-espace personneOpposee( interdit. Utilise personneOpposeePartout. ${CONSIGNE}`,
      ).not.toMatch(/\bpersonneOpposee\b/);
      expect(
        s,
        `${f} doit vérifier tous les espaces (personneOpposeePartout)`,
      ).toMatch(/\bpersonneOpposeePartout\(/);
    }
  });

  it("(4) chaque appel des 3 méthodes d'envoi du port transporte un jeton nonOpposee", () => {
    let total = 0;
    for (const [f, s] of SOURCES) {
      if (f === PORT) continue;
      for (const m of METHODES_ENVOI) {
        // Accès sans appel (référence passée, alias) ou par chaîne : on ne peut plus prouver le jeton => refus.
        const refs = [...s.matchAll(new RegExp(`\\.${m}\\b(?!\\()`, "g"))];
        expect(
          refs.length,
          `${f} : ${m} utilisée sans être appelée directement. ${CONSIGNE}`,
        ).toBe(0);
        expect(s, `${f} : accès par chaîne à ${m}. ${CONSIGNE}`).not.toMatch(
          new RegExp(`["'\`]${m}["'\`]`),
        );
        for (const a of s.matchAll(new RegExp(`\\.${m}\\(`, "g"))) {
          total++;
          const args = argumentsDe(s, a.index! + a[0].length - 1);
          expect(args, `${f} : ${m}(...) sans nonOpposee. ${CONSIGNE}`).toMatch(
            /\bnonOpposee\w*\b/,
          );
          // Jeton réel (variable issue de la vérification), jamais forgé en ligne.
          expect(
            args,
            `${f} : ${m}(...) avec un jeton forgé en ligne. ${CONSIGNE}`,
          ).not.toMatch(/nonOpposee\s*:\s*(\{|undefined|null|true|as\b|<)/);
        }
      }
    }
    expect(
      total,
      "le parcours doit appeler les 3 méthodes (garde vide sinon)",
    ).toBeGreaterThanOrEqual(6);
  });

  it("(5) l'émetteur de jetons n'est nommé que par les fichiers de vérification autorisés", () => {
    const f = fichiersContenant(/\bemettreJetonNonOpposee\b/);
    expect(f, echec("Émetteur de jetons « non opposée » utilisé", f)).toEqual(
      [...EMETTEURS_JETON_AUTORISES].sort(),
    );
  });
});

/* ───────────────── (B) SCÉNARIO DE BOUT EN BOUT (fausses dépendances) ───────────────── */

const hook = vi.hoisted(() => ({
  apresEcriture: null as null | ((nom: string) => Promise<void>),
}));
vi.mock("@/services/_commun", async (orig) => {
  const r = await orig<Record<string, any>>();
  return {
    ...r,
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

const A = "auteur-fictif-s6-400";
let port: ReturnType<typeof fauxPort>;
let sites: RequeteSignee[];
let surPub: (() => Promise<void>) | null = null;

const passer = (ms = T0) =>
  C.traiterConversations({
    port: port.port,
    comptesPermis: [COMPTE],
    titreGuide: TITRE,
    env: ENV,
    maintenantMs: ms,
  });
const rienNeParti = () => {
  expect(port.pub).toHaveLength(0); // réponse publique
  expect(port.prive).toHaveLength(0); // message privé
  expect(port.envoyes).toHaveLength(0); // messages de la conversation
  expect(sites).toHaveLength(0); // e-mail (demande du guide au site)
};
/** Opposition inscrite sous l'empreinte du réseau « instagram » (la personne a écrit « stop » là-bas). */
async function opposerSurInstagram(): Promise<void> {
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

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  hook.apresEcriture = null;
  surPub = null;
  sites = [];
  port = fauxPort();
  const rep = port.port.repondreCommentaire;
  port.port.repondreCommentaire = async (p) => {
    const r = await rep(p);
    await surPub?.();
    return r;
  };
  pm.injecterTransportSite(
    async (r) => (sites.push(r), { statut: 200, corps: {} }),
  );
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

describe("S6 (B) scénario de bout en bout", () => {
  it("opposée sur Instagram, commentaire GUIDE sur Facebook : aucun envoi (ni public, ni privé, ni e-mail)", async () => {
    await opposerSurInstagram();
    await deposerCommentaire(depots, { idAuteur: A, reseau: "facebook" });
    await passer();
    await passer(T0 + 600_000);
    rienNeParti();
  });

  it("opposée sur Instagram APRÈS une demande d'e-mail en attente : le message avec l'adresse n'envoie rien (ni e-mail, ni message)", async () => {
    await deposerCommentaire(depots, { idAuteur: A, reseau: "facebook" });
    await passer();
    expect(port.prive).toHaveLength(1); // le parcours habituel a démarré
    await opposerSurInstagram();
    port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idExpediteur: A });
    const avant = { pub: port.pub.length, prive: port.prive.length };
    await passer(T0 + 1000);
    expect(port.pub).toHaveLength(avant.pub);
    expect(port.prive).toHaveLength(avant.prive);
    expect(port.envoyes).toHaveLength(0);
    expect(sites).toHaveLength(0);
  });

  it("registre illisible : aucun envoi, l'événement reste à réessayer, et le réessai envoie une fois le registre réparé", async () => {
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, "registre-abime");
    await deposerCommentaire(depots, { idAuteur: A, reseau: "facebook" });
    await passer();
    rienNeParti();
    const restants = await depots().evenementsFournisseurs.lister(
      (x: any) => !x.traite,
    );
    expect(restants.length).toBeGreaterThan(0); // réessai prévu
    // Le registre est réparé : le réessai fait partir les envois habituels.
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, []);
    await passer(T0 + 600_000);
    expect(port.pub).toHaveLength(1);
    expect(port.prive).toHaveLength(1);
  });

  it("personne non opposée : les envois habituels partent (réponse publique + message privé)", async () => {
    await deposerCommentaire(depots, { idAuteur: A, reseau: "facebook" });
    await passer();
    expect(port.pub).toHaveLength(1);
    expect(port.prive).toHaveLength(1);
  });

  it("opposition inscrite entre la réponse publique et le message privé : le message privé ne part pas", async () => {
    surPub = () => opposerSurInstagram();
    await deposerCommentaire(depots, { idAuteur: A, reseau: "facebook" });
    await passer();
    expect(port.pub).toHaveLength(1); // déjà partie avant l'opposition
    expect(port.prive).toHaveLength(0);
    expect(port.envoyes).toHaveLength(0);
    expect(sites).toHaveLength(0);
    await passer(T0 + 600_000);
    expect(port.prive).toHaveLength(0);
  });
});
