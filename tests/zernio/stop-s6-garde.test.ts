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
import ts from "typescript";
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
/**
 * Liste fermée : fichiers qui appellent `.requete(` (hors client lui-même), SANS filtre sur l'import.
 * `higgsfield/client.ts` est documenté hors Zernio : son `.requete(` est celui d'un contrat Higgsfield (pas du client Zernio).
 */
const APPELANTS_REQUETE_BRUTE = [
  "fournisseurs/zernio-inbox.ts",
  "fournisseurs/mesures/zernio.ts",
  "fournisseurs/higgsfield/client.ts",
];
/**
 * Liste fermée : fichiers où `.requete` n'est PAS le client Zernio : champ de données (`plan.illustration.requete`,
 * `p.requete`…) ou client Heygen/Claude (`.requete<T>(…)`). Un nouveau fichier qui touche `.requete` rougit.
 */
const ACCES_REQUETE_AUTRE_QUE_ZERNIO = [
  "assistant/etapes/Apercu.tsx",
  "briques/intensite/montage.ts",
  "briques/schema-motion/emprise.ts",
  "briques/schema-motion/plan-objets.ts",
  "domaine/illustrations.ts",
  "fournisseurs/claude/lots.ts",
  "fournisseurs/credits/heygen.ts",
  "fournisseurs/heygen/looks.ts",
  "fournisseurs/heygen/rendus.ts",
  "fournisseurs/heygen/videos-compte.ts",
  "fournisseurs/heygen/voix.ts",
  "fournisseurs/illustration/fal.ts",
  "moteurs/montage-avocat/decoupage.ts",
  "moteurs/montage-avocat/fabrication-illustrations.ts",
  "moteurs/montage-facecam-animee/images/index.ts",
  "services/boucle-visibilite.ts",
  "services/comite-editorial.ts",
  "services/decors.ts",
  "services/gardien-chiffres.ts",
  "services/illustrations.ts",
  "services/retouche-chat/generateurs.ts",
  "services/videos.ts",
];
/** Fichiers où un nom de méthode d'envoi n'est pas celui du port Inbox (fonction `envoyerMessage` propre à Claude). */
const HORS_PORT_ENVOI = /^fournisseurs\/claude\//;
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
/**
 * Retire les commentaires avec le compilateur TypeScript (il connaît les chaînes, gabarits et regex :
 * "image/*" ou " //" dans une chaîne n'effacent plus de vrai code).
 */
function sansCommentaires(s: string, nomFichier = "x.ts"): string {
  const genre = nomFichier.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts
    .createPrinter({ removeComments: true })
    .printFile(
      ts.createSourceFile(nomFichier, s, ts.ScriptTarget.Latest, false, genre),
    );
}
const SOURCES = new Map<string, string>(
  listerSources(RACINE).map((f) => [
    relative(RACINE, f).split("\\").join("/"),
    sansCommentaires(readFileSync(f, "utf8"), f),
  ]),
);
const fichiersContenantDans = (
  sources: ReadonlyMap<string, string>,
  re: RegExp,
): string[] =>
  [...sources]
    .filter(([, s]) => re.test(normaliser(s)))
    .map(([f]) => f)
    .sort();
const fichiersContenant = (re: RegExp): string[] =>
  fichiersContenantDans(SOURCES, re);
/** Texte du client avec les `\/` d'une regex littérale remis en `/` : une route écrite `/^\/v1\/inbox\/…$/` reste visible. */
const normaliser = (s: string): string => s.replace(/\\\//g, "/");

/** Routes Inbox du tableau ROUTES : écritures (POST), toutes, et décompte indépendant des mentions d'inbox dans le tableau. */
function routesInbox(clientBrut: string) {
  const client = normaliser(clientBrut);
  const ecritures = [
    ...client.matchAll(
      /methode:\s*"POST",\s*motif:[^\n]*?\/v1\/inbox[^\n]*?route:\s*"([a-z-]+)"/g,
    ),
  ]
    .map((m) => m[1])
    .sort();
  const tous = [
    ...client.matchAll(/motif:[^\n]*?\/v1\/inbox[^\n]*?route:\s*"([a-z-]+)"/g),
  ]
    .map((m) => m[1])
    .sort();
  // Tableau ROUTES isolé (de `const ROUTES` jusqu'au `];` qui le ferme), blancs écrasés : une route écrite sur
  // PLUSIEURS lignes compte comme les autres. -1 = tableau introuvable (la garde rougit).
  const bloc = /const ROUTES\b[\s\S]*?\n\];/.exec(client)?.[0];
  const lignesInbox = bloc
    ? [...bloc.replace(/\s+/g, " ").matchAll(/inbox/gi)].length
    : -1;
  return { ecritures, tous, lignesInbox };
}

/** Le port : `ecrire` (définition + 3 appels, un par méthode d'envoi : 4 mentions au total, aucune référence nue) et `client.requete(` (ecrire + lireMessage GET). */
function analysePort(port: string): string[] {
  const erreurs: string[] = [];
  if (!/consommerJetonNonOpposee/.test(port)) erreurs.push("jeton absent");
  // TOUTES les mentions (une référence nue comme `masquer: ecrire` compte aussi) : 1 définition + 3 appels.
  const nbEcrire = [...port.matchAll(/\becrire\b/g)].length;
  if (nbEcrire !== 4)
    erreurs.push(`ecrire( : ${nbEcrire} occurrences au lieu de 4`);
  const requetes = [...port.matchAll(/\bclient\.requete\(/g)];
  if (requetes.length !== 2)
    erreurs.push(
      `client.requete( : ${requetes.length} occurrences au lieu de 2`,
    );
  const iLire = port.indexOf("async lireMessage(");
  const iReq = requetes.map((m) => m.index!);
  if (iLire === -1 || !iReq.some((i) => i > iLire))
    erreurs.push("client.requete( de lireMessage absent");
  else {
    const argLire = argumentsDe(
      port,
      port.indexOf("(", port.indexOf("client.requete(", iLire)),
    );
    if (!/methode:\s*"GET"/.test(argLire))
      erreurs.push("lireMessage doit appeler client.requete en GET");
  }
  const defEcrire = port.search(/function\s+ecrire\(/);
  if (defEcrire === -1 || !iReq.some((i) => i > defEcrire && i < iLire))
    erreurs.push("client.requete( d'ecrire absent");
  // Chaque méthode : jeton testé AVANT son (unique) appel à ecrire( dans SON bloc.
  const debuts = METHODES_ENVOI.map((m) => ({ m, i: port.indexOf(`${m}:`) }));
  for (const { m, i } of debuts) {
    if (i === -1) {
      erreurs.push(`${m} absente du port`);
      continue;
    }
    const suivants = [...debuts.map((d) => d.i), iLire].filter((x) => x > i);
    const fin = suivants.length ? Math.min(...suivants) : port.length;
    const bloc = port.slice(i, fin);
    const n = [...bloc.matchAll(/\becrire\b/g)].length;
    if (n !== 1) erreurs.push(`${m} : ${n} appel(s) à ecrire( au lieu de 1`);
    const iJeton = bloc.search(/jetonRefuse\(p\.nonOpposee\)/);
    const iEcrire = bloc.search(/\becrire\(/);
    if (iJeton === -1 || (iEcrire !== -1 && iJeton > iEcrire))
      erreurs.push(`${m} : le jeton doit être testé AVANT l'écriture`);
  }
  return erreurs;
}

/** Accès à `requete` : `.requete` (appel, `.call(`, référence passée) ou `["requete"]` entre crochets. */
const ACCES_REQUETE = /\.requete\b|\[\s*["'`]requete["'`]\s*\]/;
/** Appelants de `.requete` hors client, SANS regarder les imports. */
const appelantsBruts = (sources: ReadonlyMap<string, string>): string[] =>
  fichiersContenantDans(sources, ACCES_REQUETE).filter(
    (f) => f !== CLIENT && !ACCES_REQUETE_AUTRE_QUE_ZERNIO.includes(f),
  );

/**
 * Hors du port, hors `fournisseurs/claude/` et hors lignes `import`, chaque méthode d'envoi doit avoir autant de
 * mentions `\bM\b` que d'appels `.M(`. Toute autre mention (déstructuration simple, en paramètre, imbriquée, alias,
 * référence passée) fait rougir. Sur le code actuel : aucune exception (les mentions en commentaire sont déjà retirées).
 */
function mentionsNonAppelees(sources: ReadonlyMap<string, string>): string[] {
  const res: string[] = [];
  for (const [f, s] of sources) {
    if (f === PORT || HORS_PORT_ENVOI.test(f)) continue;
    const lignes = s
      .split("\n")
      .filter((l) => !/^\s*import\b/.test(l))
      .join("\n");
    for (const m of METHODES_ENVOI) {
      const mentions = [...lignes.matchAll(new RegExp(`\\b${m}\\b`, "g"))]
        .length;
      const appels = [...lignes.matchAll(new RegExp(`\\.${m}\\(`, "g"))].length;
      if (mentions !== appels) res.push(`${f} (${m})`);
    }
  }
  return res.sort();
}
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
    const { ecritures, tous, lignesInbox } = routesInbox(client);
    expect(
      ecritures,
      "La liste fermée des routes d'écriture Inbox a changé : relecture de sécurité obligatoire, puis mets cette garde à jour.",
    ).toEqual(["envoyer-message", "repondre-commentaire", "reponse-privee"]);
    // Aucun GET inbox déguisé en écriture ni écriture hors table : seuls les 4 chemins Inbox existent.
    expect(tous).toEqual([
      "envoyer-message",
      "lire-messages",
      "repondre-commentaire",
      "reponse-privee",
    ]);
    // Décompte indépendant (insensible à la casse) : une route écrite d'une façon que les regex ne voient pas fait rougir.
    expect(
      lignesInbox,
      "Une ligne de ROUTES parle d'inbox sans être reconnue (ou une 5e route existe) : relecture de sécurité.",
    ).toBe(4);
    // Qui écrit un chemin d'écriture Inbox ? (chemin littéral ou gabarit)
    const appelants = fichiersContenant(/\/v1\/inbox/).filter(
      (f) => f !== CLIENT,
    );
    expect(
      appelants,
      echec("Chemin /v1/inbox écrit hors de la liste fermée", appelants),
    ).toEqual(APPELANTS_ROUTES_ECRITURE_INBOX);
    // Appel brut `.requete(` : liste fermée aussi (un autre appelant pourrait viser l'Inbox par un chemin construit).
    const bruts = appelantsBruts(SOURCES);
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

  it("(2) l'aide d'idempotence Inbox, la fabrique du client (creerClientZernio) et celle du port (creerPortInboxZernio) restent dans leurs listes fermées, et le port teste le jeton avant d'écrire", () => {
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
    const erreursPort = analysePort(SOURCES.get(PORT)!);
    expect(erreursPort, `${erreursPort.join(" ; ")}. ${CONSIGNE}`).toEqual([]);
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
    const destr = mentionsNonAppelees(SOURCES);
    expect(
      destr,
      echec("Mention non appelée d'une méthode d'envoi du port", destr),
    ).toEqual([]);
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

/* ───────── (A bis) PREUVES : chaque garde rougit sur un texte fautif construit en mémoire ───────── */

describe("S6 (A bis) preuves que les gardes détectent les cas pièges", () => {
  const clientOk = SOURCES.get(CLIENT)!;
  const portOk = SOURCES.get(PORT)!;

  it("les vrais fichiers passent (point de départ des mutations)", () => {
    expect(routesInbox(clientOk).lignesInbox).toBe(4);
    expect(analysePort(portOk)).toEqual([]);
    expect(mentionsNonAppelees(SOURCES)).toEqual([]);
  });

  it("(1) une route Inbox écrite en regex littérale est vue, et une 5e route fait bouger le décompte", () => {
    const iFin = clientOk.indexOf("\n];", clientOk.indexOf("const ROUTES"));
    const fautif =
      clientOk.slice(0, iFin) +
      '\n  { methode: "POST", motif: /^\\/v1\\/inbox\\/secret\\/[a-z]+$/, route: "envoi-secret" },' +
      clientOk.slice(iFin);
    const r = routesInbox(sansCommentaires(fautif, CLIENT));
    expect(r.ecritures).toContain("envoi-secret");
    expect(r.tous).toContain("envoi-secret");
    expect(r.lignesInbox).toBe(5);
    // un appelant qui écrit le chemin en regex littérale est vu aussi
    const sources = new Map([
      ["x/appelant.ts", "const re = /^\\/v1\\/inbox\\/comments/;"],
    ]);
    expect(fichiersContenantDans(sources, /\/v1\/inbox/)).toEqual([
      "x/appelant.ts",
    ]);
  });

  it("(2) \"image/*\" dans une chaîne n'efface plus de vrai code : l'envoi sans jeton reste visible", () => {
    const texte = [
      'const types = "image/*";',
      "await port.envoyerMessage({ texte });",
      "/* fin */",
    ].join("\n");
    const propre = sansCommentaires(texte);
    expect(propre).toContain("envoyerMessage");
    expect(propre).toContain('"image/*"');
    expect(propre).not.toContain("fin");
    const avecSlashes = sansCommentaires(
      'const u = " //"; port.repondreEnPrive({ a }); // vrai commentaire',
    );
    expect(avecSlashes).toContain("repondreEnPrive");
    expect(avecSlashes).not.toContain("vrai commentaire");
    // ... et la garde (4) rougit : appel sans jeton repéré
    const args = argumentsDe(
      propre,
      propre.indexOf("(", propre.indexOf(".envoyerMessage")),
    );
    expect(args).not.toMatch(/\bnonOpposee\w*\b/);
  });

  it("(3) un ecrire( caché dans le port ou une requête de plus fait rougir analysePort", () => {
    const cache = portOk.replace(
      "async lireMessage(p) {",
      'async lireMessage(p) {\n      void ecrire({ methode: "POST", chemin: "/v1/inbox/x" } as never);',
    );
    expect(cache).not.toBe(portOk);
    expect(analysePort(cache).join(" ")).toMatch(/ecrire\( : 5 occurrences/);
    const requeteEnPlus = portOk.replace(
      "async lireMessage(p) {",
      'async lireMessage(p) {\n      await client.requete({ methode: "POST", chemin: "/v1/inbox/y" } as never);',
    );
    expect(analysePort(requeteEnPlus).join(" ")).toMatch(
      /client\.requete\( : 3/,
    );
    // écriture avant le jeton dans une méthode
    const avant = portOk.replace(
      "repondreEnPrive: (p) => {\n",
      "repondreEnPrive: (p) => {\n      void ecrire({} as never);\n",
    );
    expect(avant).not.toBe(portOk);
    expect(analysePort(avant).length).toBeGreaterThan(0);
    // lireMessage qui n'est plus en GET
    const pasGet = portOk.replace('methode: "GET"', 'methode: "POST"');
    expect(analysePort(pasGet).join(" ")).toMatch(/GET/);
  });

  it("(4) un fichier qui appelle .requete( sans importer zernio-client est repéré", () => {
    const sources = new Map(SOURCES);
    sources.set(
      "services/intrus.ts",
      'export const f = (c: any) => c.requete({ methode: "POST", chemin: `/v1/inbox/${a}` });',
    );
    expect(appelantsBruts(SOURCES)).toEqual(
      [...APPELANTS_REQUETE_BRUTE].sort(),
    );
    expect(appelantsBruts(sources)).toContain("services/intrus.ts");
    expect(appelantsBruts(sources)).not.toEqual(
      [...APPELANTS_REQUETE_BRUTE].sort(),
    );
  });

  it("(5) une déstructuration d'une méthode d'envoi hors du port est repérée (import et Claude ignorés)", () => {
    const sources = new Map<string, string>([
      ["services/a.ts", "const { repondreEnPrive } = port;"],
      ["services/b.ts", "const { x, envoyerMessage: e, y } = port;"],
      ["services/c.ts", 'import { envoyerMessage } from "./z";'],
      ["fournisseurs/claude/d.ts", "const { envoyerMessage } = outils;"],
      [PORT, "const { repondreCommentaire } = autre;"],
    ]);
    expect(mentionsNonAppelees(sources)).toEqual([
      "services/a.ts (repondreEnPrive)",
      "services/b.ts (envoyerMessage)",
    ]);
  });

  it("(6) une référence nue à ecrire dans le port fait rougir", () => {
    const nue = portOk.replace(
      "async lireMessage(p) {",
      "async lireMessage(p) {\n      void { masquer: ecrire };",
    );
    expect(nue).not.toBe(portOk);
    expect(analysePort(nue).join(" ")).toMatch(/ecrire\( : 5 occurrences/);
    expect(analysePort("masquer: ecrire,\n" + portOk)).not.toEqual([]);
  });

  it("(7) un appel .requete entre crochets, .call( ou passé sans appel est repéré", () => {
    for (const code of [
      'export const f = (c: any) => c["requete"]({ methode: "POST" });',
      "export const f = (c: any) => c[`requete`]({});",
      "export const f = (c: any) => c.requete.call(c, {});",
      "export const f = (c: any) => autre(c.requete);",
    ]) {
      const sources = new Map(SOURCES);
      sources.set("services/intrus.ts", code);
      expect(appelantsBruts(sources), code).toContain("services/intrus.ts");
    }
  });

  it("(8) une 5e route POST Inbox écrite sur plusieurs lignes fait bouger le décompte", () => {
    const iFin = clientOk.indexOf("\n];", clientOk.indexOf("const ROUTES"));
    expect(iFin).toBeGreaterThan(-1);
    const fautif =
      clientOk.slice(0, iFin) +
      '\n  {\n    methode: "POST",\n    motif: /^\\/v1\\/inbox\\/secret$/,\n    route: "envoi-secret",\n  },' +
      clientOk.slice(iFin);
    expect(routesInbox(fautif).lignesInbox).toBe(5);
    expect(routesInbox("export const X = 1;").lignesInbox).toBe(-1);
  });

  it("(9) déstructuration en paramètre ou imbriquée : repérée", () => {
    const sources = new Map<string, string>([
      [
        "services/p.ts",
        "export async function _y({ envoyerMessage }: any) { return envoyerMessage; }",
      ],
      ["services/q.ts", "const { port: { repondreCommentaire } } = d;"],
    ]);
    expect(mentionsNonAppelees(sources)).toEqual([
      "services/p.ts (envoyerMessage)",
      "services/q.ts (repondreCommentaire)",
    ]);
  });
});

/* ───────────────── (B) SCÉNARIO DE BOUT EN BOUT (fausses dépendances) ───────────────── */

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
