/**
 * STOP-S5a · VÉRIFICATION À LA DEMANDE, par personne, des oppositions connues du site (interrupteur OPPOSITIONS_SITE_IMPORT_ENABLED).
 * Données 100 % fictives ; site et port FAUX ; aucun réseau, aucun envoi réel.
 * Rouges d'abord : chaque règle de la conception a son test (T1 à T13).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHEMIN_OPPOSITIONS_PAR_CONV,
  RE_REF_CONV,
  construireCorpsParConv,
  lireReponseParConv,
} from "@/domaine/guide-reseau/oppositions-par-conv-contrat";
import {
  signatureZernio,
  type RunLu,
} from "@/domaine/guide-reseau/crochet-zernio";
import { signatureValide } from "@/fournisseurs/site/signature";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import fixture from "./aides/oppositions-par-conv.v1.json";
import {
  COMPTE,
  ENV as ENV_BASE,
  T0,
  cleConversation,
  deposerMessage,
  evenement,
  fauxPort,
  silencerConsole,
  validerGuideAuParcours,
} from "./aides/conversation";
import {
  H,
  MIN,
  graineConv,
  lectureParMessage,
  siteDouble,
} from "./aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const OT = await import("@/services/oppositions-transmission");
const OPP = await import("@/services/oppositions-mots");
const IMP = await import("@/services/oppositions-import-site");
const MS = await import("@/services/mots-service");
const pm = await import("@/services/parcours-mot");
const AT = await import("@/services/a-traiter");
const Com = await import("@/services/_commun");

const ENV = {
  ...ENV_BASE,
  OPPOSITIONS_SITE_IMPORT_ENABLED: "1",
  OPPOSITIONS_PAR_REF_ENABLED: "1",
};
const ENV_ETEINT = { ...ENV_BASE, OPPOSITIONS_PAR_REF_ENABLED: "1" };
const CHEMIN_PAGE = OT.CHEMIN_OPPOSITIONS_PAGE;
const ref = (i: number): string => `c1_${String(i).padStart(22, "0")}`;
const A = "auteur-fictif-400";
const S = 1000;

let port: ReturnType<typeof fauxPort>;
let sd: ReturnType<typeof siteDouble>;
/** Réponse du faux site pour la vérification : un statut (0 = exception, -1 = ne répond jamais), ou un corps libre. */
let statutImport = 200;
let opposeesSite = new Set<string>();
let corpsImport: ((convs: string[]) => unknown) | null = null;
let appelsImport: Array<{ requete: RequeteSignee; convs: string[] }> = [];
let observerVerrou = false;
let etatsVerrou: string[] = [];
let textes: Record<string, string> = {};

const transport = async (r: RequeteSignee) => {
  if (r.chemin !== CHEMIN_OPPOSITIONS_PAR_CONV) return sd.transport(r);
  const h = r.entetes;
  expect(r.methode).toBe("POST");
  expect(
    signatureValide(ENV.SITE_GUIDES_RESEAU_SECRET, {
      methode: r.methode,
      chemin: r.chemin,
      corps: r.corps,
      horodatage: h["x-axion-horodatage"],
      nonce: h["x-axion-nonce"],
      signature: h["x-axion-signature"],
    }),
  ).toBe(true);
  const convs = (JSON.parse(r.corps) as { convs: string[] }).convs;
  expect(construireCorpsParConv(convs)).toBe(r.corps);
  appelsImport.push({ requete: r, convs });
  if (observerVerrou)
    etatsVerrou.push(
      await Promise.race([
        Com.sousVerrou(async () => "libre"),
        new Promise<string>((res) => setTimeout(() => res("pris"), 40)),
      ]),
    );
  if (statutImport === 0) throw new Error("injoignable");
  if (statutImport === -1) await new Promise(() => undefined);
  if (statutImport !== 200) return { statut: statutImport, corps: {} };
  const corps = corpsImport
    ? corpsImport(convs)
    : {
        ok: true,
        schemaVersion: 1,
        resultats: convs.map((c) => ({
          conv: c,
          opposee: opposeesSite.has(c),
        })),
      };
  return { statut: 200, corps };
};

const conversations = () =>
  Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const semer = async (
  etat: string,
  extra: Record<string, unknown> = {},
  id = A,
) =>
  Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    ...(await conversations()),
    [cleConversation(id)]: graineConv(etat, extra),
  });
/** N conversations avec lien (personnes fictives p-0..) en un seul bloc. */
async function semerBeaucoup(
  n: number,
  depart = 0,
  refDe: (i: number) => string = ref,
): Promise<void> {
  const tout = await conversations();
  for (let i = depart; i < depart + n; i++)
    tout[cleConversation(`p-${i}`)] = graineConv("attente_email", {
      refLienConv: refDe(i),
    });
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
}
/** Une personne qui écrit son adresse : conversation (avec ou sans lien) + message en attente. Rend l'identifiant de l'événement. */
async function personne(
  id: string,
  refLien: string | null,
  avance = 0,
): Promise<string> {
  await semer("attente_email", refLien ? { refLienConv: refLien } : {}, id);
  textes[`msg-${id}`] = "mon adresse personne-fictive@example.test";
  return deposerMessage(depots, {
    idExpediteur: id,
    idConversation: `conv-${id}`,
    idMessage: `msg-${id}`,
    avance,
  });
}
const registre = () => Com.lireParametre<any[]>(OPP.PARAM_OPPOSITIONS_MOTS, []);
const parametreSite = () =>
  Com.lireParametre<any>(OPP.PARAM_OPPOSITIONS_SITE, null);
const verifs = async () => OPP.lireVerifs(await parametreSite());
/** Le paramètre `parcours.oppositions.site`, écrit à la main : `{ v: 1, verifs }`. */
const poserVerifs = (
  v: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) =>
  Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_SITE, {
    v: 1,
    verifs: v,
    ...extra,
  });
/** Le parcours relit l'horloge du système (`verifierPartout` ne transmet pas `maintenantMs`) : on la cale sur l'instant simulé. */
const horloge = (ms: number): void => void vi.setSystemTime(ms);
const importer = (ms = T0, env: Record<string, string | undefined> = ENV) => (
  horloge(ms),
  IMP.verifierOppositionsSite({ env, maintenantMs: ms })
);
const verdict = (
  id = A,
  ms = T0,
  env: Record<string, string | undefined> = ENV,
) => OPP.personneOpposeePartout({ idsBruts: [id] }, { env, maintenantMs: ms });
const passer = (ms = T0, env: Record<string, string | undefined> = ENV) => (
  horloge(ms),
  C.traiterConversations({
    port: port.port,
    comptesPermis: [COMPTE],
    titreGuide: "Guide d'exemple",
    env,
    maintenantMs: ms,
  })
);
const transmettre = (ms = T0) => (
  horloge(ms),
  OT.transmettreOppositions({ port: port.port, env: ENV, maintenantMs: ms })
);
const appelsOpposition = () =>
  sd.vus.filter(
    (r) =>
      r.chemin === CHEMIN_PAGE ||
      r.chemin === "/api/interne/oppositions-reseau",
  );
const voirDemandes = (): string[] => {
  const d = OPP.prendreDemandesSite(1_000_000);
  OPP.demanderVerificationSite(d);
  return d;
};
/** Alertes de cette vérification (le dépôt mémoire contient aussi des notifications de démonstration). */
const TITRES_ALERTES = [
  "Oppositions du site non vérifiées",
  "Site non relié (oppositions)",
  "Références de lien illisibles",
];
const alertes = async () =>
  (await depots().notifications.lister((x: any) =>
    TITRES_ALERTES.includes(x.titre),
  )) as any[];
const registreGuide = async () => {
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
};
const attendre = async (
  f: () => Promise<unknown>,
  code = "site_a_verifier",
) => {
  await expect(f()).rejects.toMatchObject({
    name: "ErreurOppositionIllisible",
    code,
  });
};
const nettoyerGlobal = () => {
  delete (globalThis as any).__studioOppositionsSite;
  IMP.reinitialiserImportOppositionsSite();
  OPP.reinitialiserDemandesSite();
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  nettoyerGlobal();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  sd = siteDouble();
  statutImport = 200;
  opposeesSite = new Set();
  corpsImport = null;
  appelsImport = [];
  observerVerrou = false;
  etatsVerrou = [];
  textes = {};
  lectureParMessage(port, textes);
  pm.injecterTransportSite(transport);
  await registreGuide();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  pm.injecterTransportSite(null);
  pm.injecterLecteurRuns(null);
  nettoyerGlobal();
});

describe("contrat pur", () => {
  it("la fixture est conforme : la requête est acceptée, la réponse est lue dans l'ordre", () => {
    expect(construireCorpsParConv(fixture.requete.convs)).toBe(
      JSON.stringify(fixture.requete),
    );
    expect(lireReponseParConv(fixture.reponse, fixture.requete.convs)).toEqual([
      true,
      false,
      false,
    ]);
  });
  it("corps refusé : vide, 101 éléments, doublon, forme non conforme", () => {
    expect(construireCorpsParConv([])).toBeNull();
    expect(
      construireCorpsParConv(Array.from({ length: 101 }, (_, i) => ref(i))),
    ).toBeNull();
    expect(construireCorpsParConv([ref(1), ref(1)])).toBeNull();
    expect(construireCorpsParConv(["c1_trop-court"])).toBeNull();
    expect(
      construireCorpsParConv(Array.from({ length: 100 }, (_, i) => ref(i))),
    ).not.toBeNull();
  });
});

describe("T1 éteint : strictement comme avant", () => {
  it("aucun appel, aucune lecture du paramètre du site, aucune demande, mêmes verdicts avec et sans la variable", async () => {
    await personne(A, ref(1));
    const espion = vi.spyOn(depots().parametres, "obtenir");
    const sansVariable = await verdict(A, T0, ENV_ETEINT);
    expect(sansVariable.opposee).toBe(false);
    for (const v of [undefined, "", "0", "non", "false"]) {
      const env = {
        ...ENV_ETEINT,
        ...(v === undefined ? {} : { OPPOSITIONS_SITE_IMPORT_ENABLED: v }),
      };
      await importer(T0, env);
      expect(await verdict(A, T0, env)).toEqual({
        ...sansVariable,
        jeton: expect.anything(),
      });
      await passer(T0, env);
    }
    // Parcours complet : la personne non opposée reçoit sa réponse comme avant.
    expect(sd.guide().length).toBeGreaterThan(0);
    expect(appelsImport).toHaveLength(0);
    expect(
      sd.vus.filter((r) => r.chemin === CHEMIN_OPPOSITIONS_PAR_CONV),
    ).toHaveLength(0);
    expect(
      espion.mock.calls.filter((c) => c[0] === OPP.PARAM_OPPOSITIONS_SITE),
    ).toHaveLength(0);
    expect(voirDemandes()).toEqual([]);
    expect(await parametreSite()).toBeNull();
  });
  it("éteint : même un paramètre illisible ou périmé ne change pas le verdict", async () => {
    await personne(A, ref(1));
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_SITE, {
      v: 7,
      verifs: "n'importe quoi",
    });
    expect((await verdict(A, T0, ENV_ETEINT)).opposee).toBe(false);
  });
});

describe("T2 vérification à la demande, par personne", () => {
  it.each([10, 5000])(
    "%i conversations avec lien en stock, aucune vérifiée : une personne répond => 1 appel avec SES références seulement, l'envoi part",
    async (n) => {
      await semerBeaucoup(n);
      await personne(A, ref(9000));
      await passer(T0); // pas de preuve : rien ne part, la demande est posée
      expect(sd.guide()).toHaveLength(0);
      await importer(T0);
      expect(appelsImport).toHaveLength(1);
      expect(appelsImport[0].convs).toEqual([ref(9000)]);
      await passer(T0 + 61 * S);
      expect(sd.guide().length).toBeGreaterThan(0);
      expect(appelsImport).toHaveLength(1);
    },
  );
  it("proactif : un événement dû demande sa vérification sans attendre un premier refus ; le jeton rendu est jeté", async () => {
    await personne(A, ref(9000));
    await importer(T0);
    expect(appelsImport).toHaveLength(1);
    expect(appelsImport[0].convs).toEqual([ref(9000)]);
    await passer(T0 + S);
    expect(sd.guide().length).toBeGreaterThan(0);
  });
  it("3 h sans trafic : la preuve est périmée ; un nouvel envoi => 1 nouvel appel, aucun blocage", async () => {
    await personne(A, ref(9000));
    await importer(T0);
    await passer(T0 + S);
    expect(sd.guide().length).toBeGreaterThan(0);
    const avant = sd.guide().length;
    await personne("auteur-q", ref(9001), 3 * H);
    await passer(T0 + 3 * H);
    await importer(T0 + 3 * H);
    expect(appelsImport).toHaveLength(2);
    expect(appelsImport[1].convs).toEqual([ref(9001)]);
    await passer(T0 + 3 * H + 61 * S);
    expect(sd.guide().length).toBeGreaterThan(avant);
  });
});

describe("T3 site en 503", () => {
  it("la personne avec lien attend (rien ne part, événement à réessayer, pas « oppose », registre inchangé) ; sans lien : part ; une alerte cloche par heure ; rétabli : part après 60 s", async () => {
    const idEv = await personne(A, ref(1));
    statutImport = 503;
    await passer(T0);
    await importer(T0);
    expect(appelsImport).toHaveLength(1);
    await passer(T0 + 61 * S);
    expect(sd.guide()).toHaveLength(0);
    const ev = await evenement(depots, idEv);
    expect(ev.traite).toBe(false);
    expect(ev.charge.etat).toBe("a_reessayer");
    expect((await conversations())[cleConversation(A)].etat).not.toBe("oppose");
    expect(await registre()).toHaveLength(0);
    // Sans lien : part.
    await personne("sans-lien", null, 61 * S);
    await passer(T0 + 62 * S);
    expect(sd.guide().length).toBeGreaterThan(0);
    // Pause de 60 s : même rétabli, aucun nouvel appel avant la fin.
    statutImport = 200;
    await importer(T0 + 30 * S);
    expect(appelsImport).toHaveLength(1);
    // Une seule alerte à la cloche, un nombre seulement, jamais de push.
    await importer(T0 + 61 * S); // réussit : proof
    const al = await alertes();
    expect(al).toHaveLength(1);
    expect(al[0].envoi).toBeUndefined();
    expect(al[0].message.match(/\d+/g)).toHaveLength(1);
    // Rétabli : la personne avec lien part.
    const avant = sd.guide().length;
    await passer(T0 + 130 * S);
    expect(sd.guide().length).toBeGreaterThan(avant);
  });
  it("site toujours en panne : une alerte par heure, pas plus ; une nouvelle après une heure", async () => {
    await personne(A, ref(1));
    statutImport = 503;
    await passer(T0);
    for (let i = 0; i < 6; i++) await importer(T0 + i * 61 * S);
    expect(await alertes()).toHaveLength(1);
    await importer(T0 + H + 61 * S);
    expect(await alertes()).toHaveLength(2);
  });
});

describe("T4 INCONNU : ni preuve ni ligne au registre, références remises en demande", () => {
  const cas: Array<[string, () => void, Record<string, string | undefined>?]> =
    [
      [
        "99 éléments pour 100 demandés",
        () =>
          (corpsImport = (c) => ({
            ok: true,
            schemaVersion: 1,
            resultats: c.slice(0, 99).map((x) => ({ conv: x, opposee: true })),
          })),
      ],
      [
        "autre ordre",
        () =>
          (corpsImport = (c) => ({
            ok: true,
            schemaVersion: 1,
            resultats: [...c]
              .reverse()
              .map((x) => ({ conv: x, opposee: false })),
          })),
      ],
      [
        "champ en trop",
        () =>
          (corpsImport = (c) => ({
            ok: true,
            schemaVersion: 1,
            extra: 1,
            resultats: c.map((x) => ({ conv: x, opposee: false })),
          })),
      ],
      [
        "version 2",
        () =>
          (corpsImport = (c) => ({
            ok: true,
            schemaVersion: 2,
            resultats: c.map((x) => ({ conv: x, opposee: false })),
          })),
      ],
      [
        "ok:false",
        () =>
          (corpsImport = (c) => ({
            ok: false,
            schemaVersion: 1,
            resultats: c.map((x) => ({ conv: x, opposee: false })),
          })),
      ],
      ["401", () => (statutImport = 401)],
      ["422", () => (statutImport = 422)],
      ["429", () => (statutImport = 429)],
      ["503", () => (statutImport = 503)],
      ["exception du transport", () => (statutImport = 0)],
      [
        "site non relié",
        () => undefined,
        { ...ENV, SITE_GUIDES_RESEAU_SECRET: undefined },
      ],
    ];
  it.each(cas)("%s", async (_nom, regler, env) => {
    await semerBeaucoup(100);
    const toutes = Array.from({ length: 100 }, (_, i) => ref(i));
    OPP.demanderVerificationSite(toutes);
    regler();
    await importer(T0, env ?? ENV);
    expect(await registre()).toHaveLength(0);
    expect(await verifs()).toEqual({});
    expect([...voirDemandes()].sort()).toEqual(toutes);
    if (env) expect(appelsImport).toHaveLength(0);
    else expect(appelsImport).toHaveLength(1);
  });
  it("délai de plus de 5 s : INCONNU", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(T0);
    await semerBeaucoup(3);
    OPP.demanderVerificationSite([ref(0), ref(1), ref(2)]);
    statutImport = -1;
    const p = importer(T0);
    await vi.advanceTimersByTimeAsync(5001);
    await p;
    expect(appelsImport).toHaveLength(1);
    expect(await verifs()).toEqual({});
    expect(await registre()).toHaveLength(0);
    expect(voirDemandes()).toHaveLength(3);
  });
  it("site non relié : un message d'alerte distinct, sans chiffre", async () => {
    OPP.demanderVerificationSite([ref(1)]);
    await importer(T0, { ...ENV, SITE_GUIDES_RESEAU_SECRET: undefined });
    const al = await alertes();
    expect(al).toHaveLength(1);
    expect(al[0].message).toContain("pas relié");
    expect(al[0].message).not.toMatch(/\d/);
    expect(al[0].envoi).toBeUndefined();
  });
});

describe("T5 le site dit « opposée »", () => {
  const sceneOpposee = async () => {
    await semer("attente_email", {
      refLienConv: ref(1),
      occurredAt: new Date(T0 - H).toISOString(),
      idMessageAdresse: "msg-adr",
    });
    textes["msg-adr"] = "mon adresse personne-fictive@example.test";
    opposeesSite.add(ref(1));
    OPP.demanderVerificationSite([ref(1)]);
  };
  it("ligne au registre {transmise:true, source:site} sous chaque clé portant la référence ; aucun envoi ; ni file ni page écrites ; puis le rattrapage met la personne en file UNE fois par voie", async () => {
    await sceneOpposee();
    // Une deuxième clé de la même personne porte la même référence.
    const R = cleConversation(A);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      ...(await conversations()),
      [`${R}|b`]: graineConv("attente_email", { refLienConv: ref(1) }),
    });
    const p = depots().parametres;
    const orig = p.enregistrer.bind(p);
    const ecrits: string[] = [];
    vi.spyOn(p, "enregistrer").mockImplementation(
      async (x: any) => (ecrits.push(x.id), orig(x)),
    );
    await importer(T0);
    const lignes = await registre();
    expect(lignes.map((l) => l.id).sort()).toEqual([R, `${R}|b`].sort());
    for (const l of lignes)
      expect(l).toMatchObject({ transmise: true, source: "site" });
    expect(ecrits).not.toContain(OT.PARAM_OPPOSITIONS_FILE);
    expect(ecrits).not.toContain(OT.PARAM_OPPOSITIONS_PAGE);
    expect(await Com.lireParametre(OT.PARAM_OPPOSITIONS_FILE, {})).toEqual({});
    expect(await Com.lireParametre(OT.PARAM_OPPOSITIONS_PAGE, {})).toEqual({});
    expect(appelsOpposition()).toHaveLength(0);
    // Le rattrapage (autre module) met en file, une seule fois.
    horloge(T0 + 20 * MIN);
    await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 + 20 * MIN });
    const f1 = await Com.lireParametre<Record<string, any>>(
      OT.PARAM_OPPOSITIONS_FILE,
      {},
    );
    const p1 = await Com.lireParametre<Record<string, any>>(
      OT.PARAM_OPPOSITIONS_PAGE,
      {},
    );
    expect(Object.keys(f1).length).toBeGreaterThan(0);
    expect(Object.keys(p1).length).toBeGreaterThan(0);
    horloge(T0 + 40 * MIN);
    await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 + 40 * MIN });
    expect(
      Object.keys(await Com.lireParametre(OT.PARAM_OPPOSITIONS_FILE, {})),
    ).toEqual(Object.keys(f1));
    expect(
      Object.keys(await Com.lireParametre(OT.PARAM_OPPOSITIONS_PAGE, {})),
    ).toEqual(Object.keys(p1));
    // Aucun message à cette personne.
    await deposerMessage(depots, { idMessage: "msg-adr" });
    await passer(T0 + 41 * MIN);
    expect(sd.guide()).toHaveLength(0);
  });
  it("témoin : « non opposée » => la même scène atteint bien le site (le test est sensible)", async () => {
    await personne(A, ref(1));
    await importer(T0);
    expect(await registre()).toHaveLength(0);
    await passer(T0 + S);
    expect(sd.guide().length).toBeGreaterThan(0);
  });
});

describe("T6 aucune boucle", () => {
  it("50 passages, site toujours « opposée », routes d'opposition en 200 : au plus 1 transmission par voie et par clé ; registre stable ; rejeu = une ligne", async () => {
    await semer("attente_email", {
      refLienConv: ref(1),
      occurredAt: new Date(T0 - H).toISOString(),
      idMessageAdresse: "msg-adr",
    });
    textes["msg-adr"] = "mon adresse personne-fictive@example.test";
    opposeesSite.add(ref(1));
    OPP.demanderVerificationSite([ref(1)]);
    let longueur = -1;
    for (let i = 0; i < 50; i++) {
      const t = T0 + i * 4 * MIN;
      await importer(t);
      await transmettre(t);
      await passer(t);
      const l = (await registre()).length;
      if (longueur >= 0) expect(l).toBe(longueur);
      longueur = l;
      if (i > 0) OPP.demanderVerificationSite([ref(1)]);
    }
    expect(longueur).toBe(1);
    expect(
      appelsOpposition().filter((r) => r.chemin === CHEMIN_PAGE).length,
    ).toBeLessThanOrEqual(1);
    expect(
      appelsOpposition().filter(
        (r) => r.chemin === "/api/interne/oppositions-reseau",
      ).length,
    ).toBeLessThanOrEqual(1);
    const rejeu = (await registre()).length;
    await OPP.enregistrerOppositionsImportees(
      [cleConversation(A), cleConversation(A)],
      { env: ENV },
    );
    expect(await registre()).toHaveLength(rejeu);
  });
});

describe("T7 désordre", () => {
  it("« opposée » puis « non opposée » pour la même référence : reste opposée", async () => {
    await personne(A, ref(1));
    opposeesSite.add(ref(1));
    OPP.demanderVerificationSite([ref(1)]);
    await importer(T0);
    expect((await verdict(A, T0)).opposee).toBe(true);
    opposeesSite.clear();
    OPP.demanderVerificationSite([ref(1)]);
    await importer(T0 + 20 * S);
    expect(await registre()).toHaveLength(1);
    expect((await verdict(A, T0 + 21 * S)).opposee).toBe(true);
  });
  it("une preuve plus ancienne n'écrase pas une plus récente", async () => {
    await personne(A, ref(1));
    await poserVerifs({ [ref(1)]: T0 + 5 * S });
    OPP.demanderVerificationSite([ref(1)]);
    horloge(T0 + 5 * S); // l'horloge réelle a avancé : la preuve de T0 + 5 s n'est pas dans le futur
    await IMP.verifierOppositionsSite({ env: ENV, maintenantMs: T0 });
    expect((await verifs())[ref(1)]).toBe(T0 + 5 * S);
  });
  it("preuve datée dans le futur, ou de plus de 10 min : non fraîche ; limite exacte de 10 min : fraîche", async () => {
    await personne(A, ref(1));
    await poserVerifs({ [ref(1)]: T0 + 60 * S });
    await attendre(() => verdict(A, T0));
    await poserVerifs({ [ref(1)]: T0 - 10 * MIN - 1 });
    await attendre(() => verdict(A, T0));
    await poserVerifs({ [ref(1)]: T0 - 10 * MIN });
    expect((await verdict(A, T0)).opposee).toBe(false);
    await poserVerifs({ [ref(1)]: "pas un nombre" });
    await attendre(() => verdict(A, T0));
    await poserVerifs({ [ref(1)]: T0 + 0.5 });
    await attendre(() => verdict(A, T0));
  });
  it("paramètre de forme invalide ou version différente de 1 : tout fermé, sans erreur de lecture", async () => {
    await personne(A, ref(1));
    for (const brut of [
      null,
      "x",
      [],
      { v: 2, verifs: { [ref(1)]: T0 } },
      { verifs: { [ref(1)]: T0 } },
      { v: 1, verifs: [] },
      { v: 1 },
    ]) {
      await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_SITE, brut);
      await attendre(() => verdict(A, T0));
      expect(OPP.lireVerifs(brut)).toEqual({});
    }
  });
});

describe("T8 ordre d'écriture : registre d'abord, preuves ensuite", () => {
  it("si l'écriture du registre lève : aucune preuve pour le lot, même les « non opposée » ; références remises en demande", async () => {
    await semerBeaucoup(3);
    opposeesSite.add(ref(0));
    OPP.demanderVerificationSite([ref(0), ref(1), ref(2)]);
    const p = depots().parametres;
    const orig = p.enregistrer.bind(p);
    vi.spyOn(p, "enregistrer").mockImplementation(async (x: any) => {
      if (x.id === OPP.PARAM_OPPOSITIONS_MOTS)
        throw new Error("panne de base fictive");
      return orig(x);
    });
    await importer(T0);
    expect(await verifs()).toEqual({});
    expect(await registre()).toHaveLength(0);
    expect([...voirDemandes()].sort()).toEqual([ref(0), ref(1), ref(2)]);
    expect((await alertes()).length).toBe(1);
  });
  it("une référence « opposée » sans aucune clé de conversation reste INCONNUE", async () => {
    await semerBeaucoup(2);
    opposeesSite.add(ref(7));
    OPP.demanderVerificationSite([ref(0), ref(7)]);
    await importer(T0);
    expect(Object.keys(await verifs())).toEqual([ref(0)]);
    expect(voirDemandes()).toEqual([ref(7)]);
  });
});

describe("T9 bornes", () => {
  it("2 000 références demandées : demandes <= 500, au plus 2 appels de 100 par passage, au plus 1 passage par 15 s", async () => {
    OPP.demanderVerificationSite(
      Array.from({ length: 2000 }, (_, i) => ref(i)),
    );
    expect(voirDemandes()).toHaveLength(500);
    expect(voirDemandes()[0]).toBe(ref(1500)); // les plus anciennes sont retirées
    await importer(T0);
    expect(appelsImport).toHaveLength(2);
    expect(appelsImport.every((a) => a.convs.length === 100)).toBe(true);
    await importer(T0 + 14 * S);
    expect(appelsImport).toHaveLength(2);
    await importer(T0 + 15 * S);
    expect(appelsImport).toHaveLength(4);
    expect(voirDemandes()).toHaveLength(100);
  });
  it("les demandes sont dédoublonnées et une preuve récente (moins de 8 min) n'est pas redemandée", async () => {
    await poserVerifs({ [ref(1)]: T0 - 5 * MIN, [ref(2)]: T0 - 9 * MIN });
    OPP.demanderVerificationSite([ref(1), ref(2), ref(2), ref(3), ref(3)]);
    await importer(T0);
    expect(appelsImport).toHaveLength(1);
    expect(appelsImport[0].convs).toEqual([ref(2), ref(3)]);
  });
  it("preuves : au plus 1 000, entrées de plus de 10 min, du futur ou non conformes élaguées", async () => {
    const v: Record<string, unknown> = {};
    for (let i = 0; i < 1500; i++) v[ref(100 + i)] = T0 - 1000 - i; // fraîches
    for (let i = 0; i < 20; i++) v[ref(5000 + i)] = T0 - 11 * MIN; // trop vieilles
    v[ref(6000)] = T0 + 40 * MIN; // futur
    v["pas-une-ref"] = T0;
    v[ref(6001)] = "x";
    await poserVerifs(v);
    OPP.demanderVerificationSite([ref(1)]);
    await importer(T0);
    const res = await verifs();
    expect(Object.keys(res).length).toBeLessThanOrEqual(1000);
    expect(res[ref(1)]).toBe(T0);
    for (const [k, t] of Object.entries(res)) {
      expect(RE_REF_CONV.test(k)).toBe(true);
      expect(T0 - t).toBeLessThanOrEqual(10 * MIN);
      expect(t).toBeLessThanOrEqual(T0);
    }
    expect(res[ref(5000)]).toBeUndefined();
    expect(res[ref(6000)]).toBeUndefined();
  });
  it("le paramètre ne contient ni « @ » ni identifiant Zernio ; l'alerte n'a qu'un nombre ; aucun journal ne porte de référence", async () => {
    await personne(A, ref(1));
    await passer(T0);
    await importer(T0);
    statutImport = 503;
    await passer(T0 + 61 * S);
    OPP.demanderVerificationSite([ref(2)]);
    await importer(T0 + 70 * S);
    const p = JSON.stringify(await parametreSite());
    expect(p).not.toContain("@");
    for (const interdit of [
      COMPTE,
      `conv-${A}`,
      A,
      "post-plateforme-fictif-200",
      "com-graine",
    ])
      expect(p).not.toContain(interdit);
    expect(Object.keys(await parametreSite()).sort()).toEqual([
      "alerteLe",
      "v",
      "verifs",
    ]);
    for (const n of await depots().notifications.lister(() => true)) {
      expect(JSON.stringify(n)).not.toContain("@");
      expect(JSON.stringify(n)).not.toContain(ref(1));
    }
    for (const j of await depots().evenements.lister(() => true)) {
      expect(JSON.stringify(j)).not.toMatch(/c1_[A-Za-z0-9_-]{22}/);
    }
  });
  it("l'appel réseau se fait HORS verrou", async () => {
    observerVerrou = true;
    OPP.demanderVerificationSite([ref(1), ref(2)]);
    await importer(T0);
    expect(appelsImport).toHaveLength(1);
    expect(etatsVerrou).toEqual(["libre"]);
  });
  it("sources : aucun `.requete(`, aucune écriture des files, aucun import de la transmission ni du parcours", () => {
    const src = lignes("src/services/oppositions-import-site.ts").join("\n");
    expect(src).not.toContain(".requete(");
    // Le texte de l'en-tête peut CITER les files ; seul le code compte : lignes hors commentaires.
    const code = lignes("src/services/oppositions-import-site.ts")
      .filter((x) => !/^\s*(\/\*|\*|\/\/)/.test(x))
      .join("\n");
    expect(code).not.toMatch(
      /parcours\.oppositions\.(file|page)|PARAM_OPPOSITIONS_(FILE|PAGE)|oppositions-transmission|parcours-conversation/,
    );
    const mots = lignes("src/services/oppositions-mots.ts").join("\n");
    expect(mots).not.toMatch(
      /from "\.\/(oppositions-import-site|parcours-conversation)"/,
    );
    expect(mots).not.toContain("PEREMPTION_IMPORT_SITE_MS");
    expect(mots).not.toContain("site_perime");
  });
});

describe("T10 clés composées", () => {
  const dossier = async () => {
    const R = cleConversation("ct-r");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [R]: graineConv("termine", {}),
      [`${R}|a`]: graineConv("attente_email", { refLienConv: ref(1) }),
      [`${R}|b`]: graineConv("attente_email", { refLienConv: ref(2) }),
    });
    return R;
  };
  it("une seule référence fraîche ne suffit pas : lève ; la demande porte la référence manquante", async () => {
    await dossier();
    await poserVerifs({ [ref(1)]: T0 });
    await attendre(() => verdict("ct-r", T0));
    expect(voirDemandes()).toEqual([ref(2)]);
    await poserVerifs({ [ref(1)]: T0, [ref(2)]: T0 });
    expect((await verdict("ct-r", T0)).opposee).toBe(false);
  });
  it("le site dit B opposée : tout le dossier est opposé", async () => {
    const R = await dossier();
    await poserVerifs({ [ref(1)]: T0 });
    opposeesSite.add(ref(2));
    OPP.demanderVerificationSite([ref(2)]);
    await importer(T0);
    expect((await registre()).map((l) => l.id)).toEqual([`${R}|b`]);
    expect((await verdict("ct-r", T0)).opposee).toBe(true);
  });
  it("une même référence dans deux clés : une seule entrée dans le corps", async () => {
    const R = cleConversation("ct-r");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [`${R}|a`]: graineConv("attente_email", { refLienConv: ref(1) }),
      [`${R}|b`]: graineConv("attente_email", { refLienConv: ref(1) }),
    });
    await attendre(() => verdict("ct-r", T0));
    expect(voirDemandes()).toEqual([ref(1)]);
    await importer(T0);
    expect(appelsImport[0].convs).toEqual([ref(1)]);
    expect((await verdict("ct-r", T0)).opposee).toBe(false);
  });
  it("référence illisible : lève, compte, alerte (un nombre), sans appel", async () => {
    await semer("attente_email", { refLienConv: "pas-conforme" });
    await attendre(() => verdict(A, T0));
    expect(OPP.refsIllisiblesSite()).toBe(1);
    await semer("attente_email", { refLienConv: 12 });
    await attendre(() => verdict(A, T0));
    expect(OPP.refsIllisiblesSite()).toBe(2);
    await importer(T0);
    expect(appelsImport).toHaveLength(0);
    const al = await alertes();
    expect(al).toHaveLength(1);
    expect(al[0].message.match(/\d+/g)).toHaveLength(1);
    expect(al[0].envoi).toBeUndefined();
    expect(OPP.refsIllisiblesSite()).toBe(0);
  });
});

describe("T11 autres appelants (parcours de conversation éteint)", () => {
  const ENV_PM = {
    PARCOURS_MOT_ENABLED: "1",
    ZERNIO_WEBHOOK_SECRET: "secret-fictif-crochet-stop-s5",
    SITE_VIDEOS_URL: "https://site.exemple",
    SITE_GUIDES_RESEAU_SECRET: ENV.SITE_GUIDES_RESEAU_SECRET,
    STUDIO_EMPREINTE_SECRET: ENV.STUDIO_EMPREINTE_SECRET,
    OPPOSITIONS_SITE_IMPORT_ENABLED: "1",
  };
  const RUN: RunLu = {
    email: "lecteur-fictif@example.test",
    mot: "guide",
    reseau: "instagram",
    guide: "guide-ia",
    versionTexteM1: "mp-m1-v2",
  };
  const brancherProcessus = () => {
    vi.stubEnv("STUDIO_EMPREINTE_SECRET", ENV.STUDIO_EMPREINTE_SECRET);
    vi.stubEnv("OPPOSITIONS_SITE_IMPORT_ENABLED", "1");
  };
  it("parcours-mot : une personne avec lien => réessai (pas écartée) ; après un passage de vérification => passe", async () => {
    brancherProcessus();
    await semer("attente_email", { refLienConv: ref(1) }, "ct-p");
    const corps = Buffer.from(
      JSON.stringify({
        id: "evt_s5_a",
        event: "workflow.run.completed",
        timestamp: new Date(T0).toISOString(),
        execution: { id: "run_evt_s5_a_0001", status: "completed" },
        contact: { id: "ct-p" },
        trigger: { type: "keyword", text: "GUIDE" },
      }),
    );
    await pm.recevoirCrochetZernio(
      {
        corps,
        idEvenement: "evt_s5_a",
        signature: signatureZernio(ENV_PM.ZERNIO_WEBHOOK_SECRET, corps),
      },
      { env: ENV_PM, maintenantMs: T0 },
    );
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    horloge(T0);
    expect(
      await pm.traiterOutboxZernio({ env: ENV_PM, maintenantMs: T0 }),
    ).toMatchObject({ envoyes: 0, ecartes: 0, aReessayer: 1 });
    expect(sd.guide()).toHaveLength(0);
    const ev = (
      await depots().evenementsFournisseurs.lister(
        (x: any) => x.idEvenement === "evt_s5_a",
      )
    )[0] as any;
    expect(ev.traite).toBe(false);
    await importer(T0); // rafraîchissement
    expect(appelsImport).toHaveLength(1);
    horloge(T0 + 61 * S);
    expect(
      await pm.traiterOutboxZernio({ env: ENV_PM, maintenantMs: T0 + 61 * S }),
    ).toMatchObject({ envoyes: 1 });
    expect(sd.guide()).toHaveLength(1);
  });
  const base = {
    idEvenement: "ev-s5",
    post: "post-1",
    reseau: "instagram" as const,
    canal: "commentaire" as const,
    mot: "GUIDE",
    commentaire: "GUIDE",
  };
  it("orienterCommentaire (mot non « stop ») : réessai et AUCUNE ligne au registre", async () => {
    brancherProcessus();
    await semer("attente_email", { refLienConv: ref(1) }, "ct-p");
    const o = {
      env: { A_TRAITER_ENABLED: "1" },
      depot: AT.creerDepotMemoire(),
      lireMots: async () => ["GUIDE"],
    };
    expect(
      await AT.orienterCommentaire({ ...base, idContact: "ct-p" }, o),
    ).toEqual({ issue: "reessai", raison: "registre_illisible" });
    expect(await registre()).toHaveLength(0);
    expect(await o.depot.lire()).toEqual([]);
  });
  it("carte « À traiter » : opposée tant que non vérifiée", async () => {
    brancherProcessus();
    const depot = AT.creerDepotMemoire();
    const env = { A_TRAITER_ENABLED: "1" };
    await AT.enregistrerATraiter(
      {
        idEvenement: "ev-carte",
        reseau: "instagram",
        post: "post-1",
        motif: "mot_inconnu",
        mot: "AUTRE",
        commentaire: "AUTRE",
        reponse: "Merci !",
        idContact: "ct-p",
      },
      { env, depot },
    );
    const carte = (await depot.lire())[0] as any;
    expect(carte.empreintes?.length).toBeGreaterThan(0);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [carte.empreintes[0]]: graineConv("attente_email", {
        refLienConv: ref(1),
      }),
    });
    const vue = await AT.lireVueATraiter({ env, depot });
    expect(vue.cartes[0]).toMatchObject({ opposee: true, kit: null });
    // Vérifiée « non opposée » : la carte n'est plus bloquée.
    await poserVerifs({ [ref(1)]: Date.now() });
    expect(
      (await AT.lireVueATraiter({ env, depot })).cartes[0].opposee,
    ).toBeFalsy();
  });
});

describe("T12 réduction des identifiants", () => {
  const ENV_RED = { ...ENV, PARCOURS_REDUCTION_IDS: "1" };
  const J = 24 * H;
  const semerEvenements = async (n: number) => {
    const tout = await conversations();
    for (let i = 0; i < n; i++) {
      tout[cleConversation(`r-${i}`)] = graineConv("termine", {
        refLienConv: ref(i),
      });
      const date = new Date(T0 - 31 * J).toISOString();
      await depots().evenementsFournisseurs.enregistrer({
        id: `evf-red-${i}`,
        fournisseur: "zernio",
        idEvenement: `evt-red-${i}`,
        type: "zernio.commentaire",
        recuLe: date,
        traite: true,
        creeLe: date,
        modifieLe: date,
        charge: {
          idCommentaire: `com-red-${i}`,
          idPostPlateforme: "post-plateforme-fictif-200",
          idCompte: COMPTE,
          reseau: "instagram",
          idAuteur: `r-${i}`,
          proprio: false,
          motSeul: "GUIDE",
          estReponse: false,
          etat: "termine",
          dernierCode: null,
        },
      } as any);
    }
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
  };
  const reduites = async () =>
    (
      await depots().evenementsFournisseurs.lister(
        (e: any) => typeof e.charge.idsReduitsLe === "string",
      )
    ).length;
  it("30 personnes avec lien, site OK : toutes réduites en 31 passages au plus", async () => {
    await semerEvenements(30);
    let t = T0;
    let passages = 0;
    while ((await reduites()) < 30 && passages < 40) {
      horloge(t);
      await C.reduireIdentifiants({ env: ENV_RED, maintenantMs: t });
      await importer(t);
      t += 16 * S;
      passages++;
    }
    expect(await reduites()).toBe(30);
    expect(passages).toBeLessThanOrEqual(31);
    expect(
      await depots().evenementsFournisseurs.lister(() => true),
    ).toHaveLength(30);
  });
  it("site en panne : aucune réduite, rien supprimé ; reprise ensuite", async () => {
    await semerEvenements(5);
    statutImport = 503;
    let t = T0;
    for (let i = 0; i < 6; i++) {
      horloge(t);
      await C.reduireIdentifiants({ env: ENV_RED, maintenantMs: t });
      await importer(t);
      t += 61 * S;
    }
    expect(await reduites()).toBe(0);
    expect(
      await depots().evenementsFournisseurs.lister(() => true),
    ).toHaveLength(5);
    statutImport = 200;
    for (let i = 0; i < 8; i++) {
      horloge(t);
      await C.reduireIdentifiants({ env: ENV_RED, maintenantMs: t });
      await importer(t);
      t += 61 * S;
    }
    expect(await reduites()).toBe(5);
  });
});

const lignes = (chemin: string): string[] =>
  readFileSync(join(process.cwd(), chemin), "utf8").split(/\r?\n/);

describe("T13 ordre du passage (lecture du source)", () => {
  it("l'étape est en tête de passageParcoursZernio : avant le premier retour anticipé et avant « conversations » ; gardée par l'interrupteur", () => {
    const l = lignes("src/services/branchements-zernio.ts");
    const debut = l.findIndex((x) =>
      x.includes("export async function passageParcoursZernio"),
    );
    const iEtape = l.findIndex((x) =>
      x.includes('etape("vérification des oppositions du site"'),
    );
    const iRetour = l.findIndex((x, i) => i > debut && /\breturn;/.test(x));
    const iConv = l.findIndex((x) => x.includes('etape("conversations"'));
    expect(debut).toBeGreaterThan(-1);
    expect(iEtape).toBeGreaterThan(debut);
    expect(iEtape).toBeLessThan(iRetour);
    expect(iEtape).toBeLessThan(iConv);
    expect(l[iEtape]).toContain("if (importSiteActif(env))");
    expect(l[iEtape]).toContain('import("./oppositions-import-site")');
    expect(l.filter((x) => x.includes("oppositions-import-site"))).toHaveLength(
      1,
    );
    expect(l.some((x) => x.includes("import des oppositions du site"))).toBe(
      false,
    );
  });
});
