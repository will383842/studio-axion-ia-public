/**
 * STOP-S5a · le Studio IMPORTE les oppositions connues du site, par conversation (interrupteur OPPOSITIONS_SITE_IMPORT_ENABLED).
 * Données 100 % fictives ; site et port FAUX ; aucun réseau, aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHEMIN_OPPOSITIONS_PAR_CONV,
  construireCorpsParConv,
  lireReponseParConv,
} from "@/domaine/guide-reseau/oppositions-par-conv-contrat";
import { signatureValide } from "@/fournisseurs/site/signature";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import fixture from "./aides/oppositions-par-conv.v1.json";
import {
  COMPTE,
  ENV as ENV_BASE,
  T0,
  cleConversation,
  deposerMessage,
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

let port: ReturnType<typeof fauxPort>;
let sd: ReturnType<typeof siteDouble>;
/** Réponse du faux site pour l'import : un statut, ou un corps libre. */
let statutImport = 200;
let opposeesSite = new Set<string>();
let corpsImport: ((convs: string[]) => unknown) | null = null;
let appelsImport: Array<{ requete: RequeteSignee; convs: string[] }> = [];

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
  if (statutImport === 0) throw new Error("injoignable");
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
/** N conversations avec lien (personnes fictives 0..n-1) en un seul bloc. */
async function semerBeaucoup(n: number, depart = 0): Promise<void> {
  const tout = await conversations();
  for (let i = depart; i < depart + n; i++)
    tout[cleConversation(`p-${i}`)] = graineConv("attente_email", {
      refLienConv: ref(i),
    });
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
}
const registre = () => Com.lireParametre<any[]>(OPP.PARAM_OPPOSITIONS_MOTS, []);
const etatImport = () =>
  Com.lireParametre<any>(OPP.PARAM_OPPOSITIONS_SITE, null);
/** Le parcours relit l'horloge du système (`personneOpposeePartout` sans `maintenantMs`) : on la cale sur l'instant simulé. */
const horloge = (ms: number): void => void vi.setSystemTime(ms);
const importer = (ms = T0, env: Record<string, string | undefined> = ENV) => (
  horloge(ms),
  IMP.importerOppositionsDuSite({ env, maintenantMs: ms })
);
const verdict = (
  id = A,
  ms = T0,
  env: Record<string, string | undefined> = ENV,
) =>
  OPP.personneOpposeePartout(
    { idsBruts: [id], empreintes: [cleConversation(id)] },
    { env, maintenantMs: ms },
  );
const passer = (ms = T0) => (
  horloge(ms),
  C.traiterConversations({
    port: port.port,
    comptesPermis: [COMPTE],
    titreGuide: "Guide d'exemple",
    env: ENV,
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
const envois = () => port.pub.length + port.prive.length + port.envoyes.length;
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
const attendre = async (f: () => Promise<unknown>, code: string) => {
  await expect(f()).rejects.toMatchObject({
    name: "ErreurOppositionIllisible",
    code,
  });
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  IMP.reinitialiserImportOppositionsSite();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  sd = siteDouble();
  statutImport = 200;
  opposeesSite = new Set();
  corpsImport = null;
  appelsImport = [];
  pm.injecterTransportSite(transport);
  await registreGuide();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
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
  it("lecture stricte : tout écart vaut INCONNU (null)", () => {
    const d = fixture.requete.convs;
    const ok = fixture.reponse;
    const mauvais: unknown[] = [
      null,
      "x",
      [],
      { ...ok, ok: false },
      { ...ok, schemaVersion: 2 },
      { ...ok, extra: 1 },
      { ok: true, schemaVersion: 1 },
      { ...ok, resultats: ok.resultats.slice(0, 2) },
      { ...ok, resultats: [...ok.resultats].reverse() },
      {
        ...ok,
        resultats: ok.resultats.map((x) => ({ ...x, opposee: "true" })),
      },
      { ...ok, resultats: ok.resultats.map((x) => ({ ...x, autre: 1 })) },
      {
        ...ok,
        resultats: ok.resultats.map((x, i) => (i === 0 ? { conv: x.conv } : x)),
      },
    ];
    for (const m of mauvais) expect(lireReponseParConv(m, d)).toBeNull();
  });
});

describe("1) éteint : aucun appel, aucune écriture, même verdict qu'avant", () => {
  it("zéro appel au site, aucun paramètre créé, verdict identique avec ou sans l'interrupteur", async () => {
    await semer("attente_email", { refLienConv: ref(1) });
    const avant = JSON.stringify(await depots().parametres.lister(() => true));
    const sansVariable = await verdict(A, T0, ENV_ETEINT);
    for (const v of [undefined, "", "0", "non", "false"]) {
      await importer(T0, {
        ...ENV_ETEINT,
        ...(v === undefined ? {} : { OPPOSITIONS_SITE_IMPORT_ENABLED: v }),
      });
      expect(
        await verdict(A, T0, {
          ...ENV_ETEINT,
          ...(v === undefined ? {} : { OPPOSITIONS_SITE_IMPORT_ENABLED: v }),
        }),
      ).toEqual({ ...sansVariable, jeton: expect.anything() });
    }
    expect(sansVariable.opposee).toBe(false);
    expect(appelsImport).toHaveLength(0);
    expect(sd.vus).toHaveLength(0);
    expect(JSON.stringify(await depots().parametres.lister(() => true))).toBe(
      avant,
    );
    expect(await etatImport()).toBeNull();
  });
  it("éteint : même un cycle périmé ne change pas le verdict (aucune lecture du paramètre)", async () => {
    await semer("attente_email", { refLienConv: ref(1) });
    expect((await verdict(A, T0, ENV_ETEINT)).opposee).toBe(false);
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_SITE, {
      dernierCycleCompletLe: T0 - 10 * H,
    });
    expect((await verdict(A, T0, ENV_ETEINT)).opposee).toBe(false);
  });
});

describe("2) le site dit « opposée »", () => {
  it("ligne au registre (transmise, source site) ; aucun appel aux routes d'opposition ; aucun message à cette personne", async () => {
    await semer("attente_email", {
      refLienConv: ref(1),
      occurredAt: new Date(T0 - H).toISOString(),
      idMessageAdresse: "msg-adr",
    });
    opposeesSite.add(ref(1));
    await importer();
    const lignes = await registre();
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      id: cleConversation(A),
      transmise: true,
      source: "site",
    });
    expect(typeof lignes[0].le).toBe("string");
    // Passage suivant : transmission + rattrapage, puis un message de la personne.
    await transmettre(T0 + 11 * MIN);
    await transmettre(T0 + 2 * H);
    expect(appelsOpposition()).toHaveLength(0);
    lectureParMessage(port, {
      "msg-adr": "mon adresse personne-fictive@example.test",
    });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    await passer(T0 + 12 * MIN);
    await transmettre(T0 + 3 * H);
    expect(envois()).toBe(0);
    expect(sd.guide()).toHaveLength(0);
    expect(appelsOpposition()).toHaveLength(0);
    expect((await conversations())[cleConversation(A)].etat).toBe("oppose");
    // Au tour d'import suivant : la personne n'est plus demandée au site.
    const avant = appelsImport.length;
    await importer(T0 + 20 * MIN);
    expect(appelsImport.slice(avant).flatMap((a) => a.convs)).not.toContain(
      ref(1),
    );
  });
  it("témoin : si le site répond « non opposée », la même scène atteint bien le site (le test est sensible)", async () => {
    await semer("attente_email", { refLienConv: ref(1) });
    await importer();
    expect(await registre()).toHaveLength(0);
    lectureParMessage(port, {
      "msg-adr": "mon adresse personne-fictive@example.test",
    });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    await passer(T0);
    expect(sd.guide().length).toBeGreaterThan(0);
  });
});

describe("3) site indisponible : site_perime, rien ne part aux personnes qui ont un lien", () => {
  it("503 pendant 31 min après un cycle complet : péremption, aucun envoi ; sans lien : non touchée", async () => {
    await semer("attente_email", { refLienConv: ref(1) });
    await semer("attente_email", {}, "sans-lien-1");
    await importer(T0);
    expect((await etatImport()).dernierCycleCompletLe).toBe(T0);
    expect((await verdict(A, T0 + 29 * MIN)).opposee).toBe(false);
    statutImport = 503;
    for (const m of [10, 20, 30]) await importer(T0 + m * MIN);
    expect((await verdict(A, T0 + 30 * MIN)).opposee).toBe(false);
    await importer(T0 + 31 * MIN + 1);
    await attendre(() => verdict(A, T0 + 31 * MIN + 1), "site_perime");
    expect((await verdict("sans-lien-1", T0 + 31 * MIN + 1)).opposee).toBe(
      false,
    );
    // Aucun envoi à la personne qui a un lien.
    lectureParMessage(port, {
      "msg-adr": "mon adresse personne-fictive@example.test",
    });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    await passer(T0 + 32 * MIN);
    expect(envois()).toBe(0);
    expect(sd.guide()).toHaveLength(0);
  });
  it("aucun cycle complet jamais (site en 503 dès le début) : site_perime", async () => {
    await semer("attente_email", { refLienConv: ref(1) });
    statutImport = 503;
    await importer(T0);
    expect(await etatImport()).toMatchObject({ dernierCycleCompletLe: null });
    await attendre(() => verdict(), "site_perime");
  });
  it("une personne déjà opposée reste « opposée » (jamais convertie)", async () => {
    await semer("attente_email", { refLienConv: ref(1) });
    await OPP.enregistrerOpposition(A, "zernio-conversation", { env: ENV });
    const v = await verdict();
    expect(v.opposee).toBe(true);
  });
});

describe("4) réponse incomplète ou invalide : rien n'est écrit, cycle incomplet", () => {
  it("99 éléments pour 100 demandés", async () => {
    await semerBeaucoup(100);
    opposeesSite.add(ref(3));
    corpsImport = (convs) => ({
      ok: true,
      schemaVersion: 1,
      resultats: convs.slice(0, 99).map((c) => ({ conv: c, opposee: true })),
    });
    await importer();
    expect(appelsImport).toHaveLength(1);
    expect(appelsImport[0].convs).toHaveLength(100);
    expect(await registre()).toHaveLength(0);
    expect((await etatImport()).dernierCycleCompletLe).toBeNull();
    await attendre(() => verdict("p-3"), "site_perime");
  });
  it("réponse dans un autre ordre, champ en trop, version 2 : rien n'est écrit", async () => {
    await semerBeaucoup(3);
    const variantes: Array<(c: string[]) => unknown> = [
      (c) => ({
        ok: true,
        schemaVersion: 1,
        resultats: [...c].reverse().map((x) => ({ conv: x, opposee: true })),
      }),
      (c) => ({
        ok: true,
        schemaVersion: 1,
        extra: 1,
        resultats: c.map((x) => ({ conv: x, opposee: true })),
      }),
      (c) => ({
        ok: true,
        schemaVersion: 2,
        resultats: c.map((x) => ({ conv: x, opposee: true })),
      }),
      () => "pas du json attendu",
    ];
    let t = T0;
    for (const v of variantes) {
      corpsImport = v;
      await importer(t);
      t += 11 * MIN;
    }
    expect(await registre()).toHaveLength(0);
    expect((await etatImport()).dernierCycleCompletLe).toBeNull();
  });
});

describe("5) plus de 1 000 conversations : reprise au curseur", () => {
  it("2 500 conversations : 10 lots au plus par passage, « complet » seulement à la fin, au plus un passage / 10 min", async () => {
    await semerBeaucoup(2500);
    opposeesSite.add(ref(2499));
    await importer(T0);
    expect(appelsImport).toHaveLength(10);
    expect(appelsImport.every((a) => a.convs.length === 100)).toBe(true);
    let e = await etatImport();
    expect(e.dernierCycleCompletLe).toBeNull();
    expect(e.curseur).toBe(ref(999));
    await importer(T0 + 5 * MIN); // trop tôt
    expect(appelsImport).toHaveLength(10);
    await importer(T0 + 10 * MIN);
    expect(appelsImport).toHaveLength(20);
    e = await etatImport();
    expect(e.dernierCycleCompletLe).toBeNull();
    expect(e.curseur).toBe(ref(1999));
    await importer(T0 + 20 * MIN);
    expect(appelsImport).toHaveLength(25);
    e = await etatImport();
    expect(e.curseur).toBeNull();
    expect(e.dernierCycleCompletLe).toBe(T0); // date de DÉBUT du cycle : la plus ancienne vérification
    const demandees = appelsImport.flatMap((a) => a.convs);
    expect(demandees).toEqual(Array.from({ length: 2500 }, (_, i) => ref(i)));
    expect(await registre()).toHaveLength(1);
  });
  it("échec au milieu du cycle : le curseur ne bouge pas, le cycle reste incomplet", async () => {
    await semerBeaucoup(250);
    await importer(T0);
    expect((await etatImport()).dernierCycleCompletLe).toBe(T0);
    await semerBeaucoup(250, 250); // 500 au total
    await importer(T0 + 10 * MIN);
    statutImport = 503;
    await semerBeaucoup(50, 500);
    await importer(T0 + 20 * MIN);
    expect((await etatImport()).dernierCycleCompletLe).toBe(T0 + 10 * MIN);
  });
});

describe("6) rejeu", () => {
  it("la même réponse rejouée : une seule ligne", async () => {
    await semer("attente_email", { refLienConv: ref(1) });
    const cle = cleConversation(A);
    await OPP.enregistrerOppositionsImportees([cle, cle], { env: ENV });
    await OPP.enregistrerOppositionsImportees([cle], { env: ENV });
    expect(await registre()).toHaveLength(1);
    opposeesSite.add(ref(1));
    await importer(T0);
    await importer(T0 + 11 * MIN);
    expect(await registre()).toHaveLength(1);
  });
});

describe("7) aucune donnée en clair", () => {
  it("le paramètre ne contient ni @ ni identifiant Zernio ; l'alerte n'a qu'un nombre", async () => {
    await semer("attente_email", {
      refLienConv: ref(1),
      occurredAt: new Date(T0).toISOString(),
    });
    opposeesSite.add(ref(1));
    await importer(T0);
    statutImport = 503;
    await importer(T0 + 11 * MIN);
    const p = JSON.stringify(await etatImport());
    expect(p).not.toContain("@");
    for (const interdit of [
      COMPTE,
      "conv-fictive-700",
      A,
      "post-plateforme-fictif-200",
      "com-graine",
    ])
      expect(p).not.toContain(interdit);
    expect(Object.keys(await etatImport()).sort()).toEqual([
      "alerteLe",
      "curseur",
      "cycleCommenceLe",
      "dernierCycleCompletLe",
    ]);
    for (const n of await depots().notifications.lister(() => true)) {
      expect(JSON.stringify(n)).not.toContain("@");
      expect(JSON.stringify(n)).not.toContain(ref(1));
    }
  });
});

describe("8) tout ce qui n'est pas un 200 valide est INCONNU", () => {
  it.each([0, 401, 422, 429, 500, 503])(
    "statut %i : rien n'écrit, cycle incomplet",
    async (s) => {
      await semer("attente_email", { refLienConv: ref(1) });
      opposeesSite.add(ref(1));
      statutImport = s;
      await importer();
      expect(appelsImport).toHaveLength(1);
      expect(await registre()).toHaveLength(0);
      expect((await etatImport()).dernierCycleCompletLe).toBeNull();
      await attendre(() => verdict(), "site_perime");
    },
  );
  it("alerte à la cloche, une par heure, un nombre seulement, jamais de push", async () => {
    await semerBeaucoup(3);
    statutImport = 429;
    await importer(T0);
    await importer(T0 + 11 * MIN);
    await importer(T0 + 22 * MIN);
    const alertes = async () =>
      (await depots().notifications.lister(() => true)).filter(
        (x: any) => x.titre === "Oppositions du site non importées",
      );
    let n = await alertes();
    expect(n).toHaveLength(1);
    expect(n[0].envoi).toBeUndefined();
    expect(n[0].message).toContain("3 conversation");
    await importer(T0 + 61 * MIN + 1);
    n = await alertes();
    expect(n).toHaveLength(2);
  });
  it("site non relié (secret absent) : aucun appel, cycle incomplet", async () => {
    await semer("attente_email", { refLienConv: ref(1) });
    await importer(T0, { ...ENV, SITE_GUIDES_RESEAU_SECRET: undefined });
    expect(appelsImport).toHaveLength(0);
    expect((await etatImport()).dernierCycleCompletLe).toBeNull();
  });
});

describe("conversations prises en compte", () => {
  it("sans lien, déjà « oppose », ou déjà importée : non demandées ; triées par référence", async () => {
    await semer("attente_email", { refLienConv: ref(9) }, "z");
    await semer("attente_email", { refLienConv: ref(2) }, "y");
    await semer("attente_email", {}, "sans-lien");
    await semer("oppose", { refLienConv: ref(5) }, "deja-oppose");
    await semer("attente_email", { refLienConv: ref(7) }, "deja-site");
    await OPP.enregistrerOppositionsImportees([cleConversation("deja-site")], {
      env: ENV,
    });
    await importer();
    expect(appelsImport.flatMap((a) => a.convs)).toEqual([ref(2), ref(9)]);
  });
});

describe("ordre du passage", () => {
  it("l'import vient APRÈS « Tout arrêter » et AVANT « conversations »", () => {
    const src = readFileSync(
      join(process.cwd(), "src/services/branchements-zernio.ts"),
      "utf8",
    );
    const iArret = src.indexOf(
      'await toutArreter(env);\n  await etape("import des oppositions du site"',
    );
    const iImport = src.indexOf('etape("import des oppositions du site"');
    const iConv = src.indexOf('etape("conversations"');
    expect(iArret).toBeGreaterThan(-1);
    expect(iImport).toBeGreaterThan(iArret);
    expect(iConv).toBeGreaterThan(iImport);
  });
});
