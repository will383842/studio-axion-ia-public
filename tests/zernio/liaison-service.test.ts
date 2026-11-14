/**
 * LIA-C · le service « un envoi par personne ET par mot » (réglage « plusieurs mots » ALLUMÉ) et son silence quand il est éteint.
 * Données 100 % fictives ; faux port, faux site, faux catalogue : aucun réseau, aucun envoi réel.
 * Le réglage est simulé par un faux module (aucune clé littérale ici) ; le catalogue du site par un faux `lireCiblesSite`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  empreintePersonne,
  lireClesEmpreinte,
} from "@/domaine/guide-reseau/empreinte-personne";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import {
  ADRESSE,
  alertes,
  AUTEUR,
  banc,
  C,
  Com,
  COMPTE,
  depots,
  ENV,
  graineConv,
  lireTexteDe,
  MS,
  nettoyer,
  passer,
  pm,
  preparer,
  T0,
  TITRE,
  toutesLesConversations,
} from "./filet-guide/_amorce";
import {
  cleConversation,
  deposerCommentaire,
  deposerMessage,
  evenement,
  validerFormulationsAuParcours,
} from "./aides/conversation";

const etat = vi.hoisted(() => ({
  allume: false,
  lectures: 0,
  catalogue: null as unknown,
  appelsCatalogue: 0,
  versionsSite: new Set<string>(),
  // Couture de test : `true` simule « une validation par mot existe » (lot suivant) ; la production, elle, n'en a pas (valeur réelle = GUIDE seul).
  parMot: true,
  // Doute simulé : à partir du n-ième contrôle « doute bloquant », la vérification « stop partout » répond « doute ». `null` = jamais.
  douteAuControle: null as number | null,
  controlesDoute: 0,
}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/parcours-mots-multiples", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  motsMultiplesActifs: async () => (etat.lectures++, etat.allume),
}));
vi.mock("@/services/parcours-dossier", async (orig) => {
  const reel = await orig<Record<string, any>>();
  return {
    ...reel,
    textesValidesPourLeMot: (mot: string, cible: string) =>
      etat.parMot ? true : reel.textesValidesPourLeMot(mot, cible),
    validationPourEnvoi: (...a: unknown[]) =>
      etat.parMot ? null : reel.validationPourEnvoi(...a),
  };
});
vi.mock("@/services/oppositions-mots", async (orig) => {
  const reel = await orig<Record<string, any>>();
  return {
    ...reel,
    personneOpposeePartout: async (
      p: unknown,
      o?: { douteBloque?: boolean },
    ) => {
      if (
        o?.douteBloque &&
        etat.douteAuControle !== null &&
        ++etat.controlesDoute >= etat.douteAuControle
      )
        return { opposee: true, source: "doute" };
      return reel.personneOpposeePartout(p, o);
    },
  };
});
vi.mock("@/services/cibles-site", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  lireCiblesSite: async () => (etat.appelsCatalogue++, etat.catalogue),
}));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  siteAccepteVersionM1: (v: string) => etat.versionsSite.has(v),
}));

const { reserverParcours, PLAFOND_MP_PERSONNE_JOUR } =
  await import("@/services/parcours-dossier");

const H = 3600_000;
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const ENV_LIEN = {
  ...ENV,
  PARCOURS_LIEN_GUIDE: "1",
  GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN,
  LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale`,
};
const FORMULATIONS = [
  "mp-m1-v4-1",
  "mp-adresse-refusee-v3-1",
  "mp-deja-envoye-v1-1",
  "mp-lien-v3-1",
];
const ancienSecret = "secret-fictif-ANCIEN-conversation-0123456789";
const nouveauSecret = "secret-fictif-NOUVEAU-conversation-0123456789";

const racine = (id: string = AUTEUR) => cleConversation(id);
const cles = (env: Record<string, string | undefined> = ENV) => {
  const k = lireClesEmpreinte(env);
  if (!k.ok) throw new Error("clés attendues");
  return k;
};
const catalogue = (
  liaisons: Array<[string, string]> = [],
  codes: string[] = [],
) => ({
  catalogue: ["guide-ia", ...codes].map((code) => ({
    code,
    type: "guide" as const,
    titre: `Titre ${code}`,
    actif: true,
    test: false,
  })),
  liaisons: liaisons.map(([mot, codeCible]) => ({
    mot,
    reseau: "tous" as const,
    codeCible,
    actif: true,
  })),
  luLe: T0,
  ignores: 0,
  depuisCopie: false,
});
async function activer(...mots: string[]): Promise<void> {
  const reg: Record<string, unknown> = {};
  for (const mot of ["GUIDE", ...mots])
    reg[`${mot}|${COMPTE}`] = {
      mot,
      compte: COMPTE,
      etat: "actif",
      idWorkflow: null,
      raison: null,
      modifieLe: "x",
    };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
}
/** Dépose un commentaire (événement injecté) près de l'instant `a` (ms) : jamais périmé. */
const commenter = (
  mot: string,
  o: { auteur?: string; id?: string; a?: number } = {},
) =>
  deposerCommentaire(depots, {
    idAuteur: o.auteur ?? AUTEUR,
    idCommentaire: o.id,
    motSeul: mot,
    ageMs: 1000 - ((o.a ?? T0) - T0),
    reseau: "facebook",
  });
const decrire = async (idEvt: string) => {
  const e = await evenement(depots, idEvt);
  return `${e.charge.etat}/${e.charge.dernierCode ?? "-"}`;
};
const cleG = (n: string) => n.padEnd(64, "0");
/** Un parcours déjà en base, sous une clé de dossier `racine|n`. */
async function semer(
  n: string,
  etatParcours: string,
  extra: Record<string, unknown> = {},
  r: string = racine(),
): Promise<string> {
  const cle = cleParcours(r, cleG(n));
  const conv = await toutesLesConversations();
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    ...conv,
    [cle]: {
      ...graineConv(etatParcours, {
        cleIdempotenceGuide: cleG(n),
        idCommentaire: `com-graine-${n}`,
        mot: "GUIDE",
        nature: "premier",
        groupeM1: "m1-lien",
      }),
      ...extra,
    },
  });
  return cle;
}
const compter = () => ({
  pub: banc.port.pub.length,
  prive: banc.port.prive.length,
  envoyes: banc.port.envoyes.length,
  lire: banc.port.lire,
});
const cleDuDossier = (conv: Record<string, unknown>) =>
  Object.keys(conv).filter((k) => k.includes("|"));

beforeEach(async () => {
  await preparer();
  etat.allume = true;
  etat.lectures = 0;
  etat.appelsCatalogue = 0;
  etat.catalogue = null;
  etat.parMot = true;
  etat.douteAuControle = null;
  etat.controlesDoute = 0;
  etat.versionsSite = new Set([
    "mp-m1-v3",
    "mp-m1-v4-1",
    "mp-deja-envoye-v1-1",
    "mp-lien-v3-1",
  ]);
  await activer();
});
afterEach(nettoyer);

describe("LIA-C · réglage allumé : un parcours par personne ET par mot", () => {
  it("0 · le réglage est lu UNE seule fois par passage ; GUIDE sans catalogue : réponse publique puis M1, clé de dossier, mot et cible notés", async () => {
    const evt = await commenter("GUIDE");
    await passer(T0);
    expect(etat.lectures).toBe(1);
    expect(compter()).toMatchObject({ pub: 1, prive: 1 });
    expect(await decrire(evt)).toBe("attente_email/-");
    const conv = await toutesLesConversations();
    const [cle] = cleDuDossier(conv);
    expect(cle.startsWith(`${racine()}|`)).toBe(true);
    expect(conv[cle]).toMatchObject({
      mot: "GUIDE",
      nature: "premier",
      groupeM1: "m1-lien",
      guide: "guide-ia",
      titreCible: TITRE,
    });
    await passer(T0 + 60_000);
    expect(etat.lectures).toBe(2);
  });

  it("(a) deux réservations simultanées, même personne, même cible : un seul `demarrer`", async () => {
    const k = cles();
    const demande = (idCommentaire: string) =>
      reserverParcours({
        cles: k,
        idAuteur: AUTEUR,
        idCommentaire,
        ageMs: 1000,
        maintenantMs: T0,
        code: "guide-ia",
        creer: (o) =>
          graineConv("nouveau", {
            cleIdempotenceGuide: o.cleGuide,
            idCommentaire,
            mot: "GUIDE",
            nature: o.nature,
            groupeM1: o.groupeM1,
          }) as never,
      });
    const [r1, r2] = await Promise.all([
      demande("com-sim-1"),
      demande("com-sim-2"),
    ]);
    expect([r1.decision.action, r2.decision.action].sort()).toEqual([
      "demarrer",
      "public_seul",
    ]);
    expect(Object.keys(await toutesLesConversations())).toHaveLength(1);
  });

  it("(b) rotation du secret entre l'écriture `nouveau` et la reprise : même clé, pas de 2e enregistrement", async () => {
    const creer =
      (idCommentaire: string) =>
      (o: {
        cleGuide: string;
        nature: "premier" | "renvoi";
        groupeM1: "m1-lien" | "deja-envoye" | "lien-rappel";
      }) =>
        graineConv("nouveau", {
          cleIdempotenceGuide: o.cleGuide,
          idCommentaire,
          mot: "GUIDE",
          nature: o.nature,
          groupeM1: o.groupeM1,
        }) as never;
    const avant = await reserverParcours({
      cles: cles(),
      idAuteur: AUTEUR,
      idCommentaire: "com-rot",
      ageMs: 1000,
      maintenantMs: T0,
      code: "guide-ia",
      creer: creer("com-rot"),
    });
    expect(avant.decision.action).toBe("demarrer");
    const apres = await reserverParcours({
      cles: cles({
        ...ENV,
        STUDIO_EMPREINTE_SECRET: nouveauSecret,
        STUDIO_EMPREINTE_SECRET_ANCIEN: ENV.STUDIO_EMPREINTE_SECRET,
      }),
      idAuteur: AUTEUR,
      idCommentaire: "com-rot",
      ageMs: 2000,
      maintenantMs: T0 + 1000,
      code: "guide-ia",
      creer: creer("com-rot"),
    });
    expect(apres.decision.action).toBe("reprendre");
    expect(apres.cle).toBe(avant.cle);
    expect(Object.keys(await toutesLesConversations())).toEqual([avant.cle]);
  });

  it("(c) stop après deux mots : les deux parcours `oppose`, deux entrées en file, rien sur un 3e mot", async () => {
    const t = new Date(T0 - H).toISOString();
    const a = await semer("a", "attente_email", {
      guide: "gde-aaaaaa",
      mot: "ALPHA",
      occurredAt: t,
    });
    const b = await semer("b", "attente_email", {
      guide: "gde-bbbbbb",
      mot: "BETA",
      occurredAt: t,
    });
    await activer("ALPHA", "BETA", "GAMMA");
    etat.catalogue = catalogue([["GAMMA", "guide-ia"]]);
    await commenter("STOP");
    await passer(T0);
    const conv = await toutesLesConversations();
    expect([conv[a].etat, conv[b].etat]).toEqual(["oppose", "oppose"]);
    expect(
      Object.keys(
        await Com.lireParametre("parcours.oppositions.file", {}),
      ).sort(),
    ).toEqual([a, b].sort());
    const avant = compter();
    const evt = await commenter("GAMMA", { id: "com-troisieme" });
    await passer(T0 + 60_000);
    expect(compter()).toEqual(avant);
    expect((await decrire(evt)).startsWith("silence/")).toBe(true);
  });

  it("(d) plafond : quatre mots différents en 1 h = trois messages privés ; le 4e reste une réponse publique seule", async () => {
    // Quatre cibles différentes : décisions du service de réservation (la validation par cible n'existe pas encore, voir la PR).
    const k = cles();
    const actions: string[] = [];
    for (const [i, code] of [
      "gde-aaaaaa",
      "gde-bbbbbb",
      "gde-cccccc",
      "gde-dddddd",
    ].entries()) {
      const r = await reserverParcours({
        cles: k,
        idAuteur: AUTEUR,
        idCommentaire: `com-p-${i}`,
        ageMs: 1000,
        maintenantMs: T0 + i * 60_000,
        code,
        creer: (o) =>
          graineConv("nouveau", {
            cleIdempotenceGuide: o.cleGuide,
            idCommentaire: `com-p-${i}`,
            guide: code,
            mot: `M${i}`,
            nature: o.nature,
            groupeM1: o.groupeM1,
          }) as never,
      });
      actions.push(
        r.decision.action === "public_seul"
          ? `public_seul:${r.decision.raison}`
          : r.decision.action,
      );
    }
    expect(PLAFOND_MP_PERSONNE_JOUR).toBe(3);
    expect(actions).toEqual([
      "demarrer",
      "demarrer",
      "demarrer",
      "public_seul:plafond_personne",
    ]);
  });

  it("(d bis) trois messages privés déjà partis dans l'heure (autres cibles) : un 4e mot répond en public seulement", async () => {
    await semer("p1", "attente_email", {
      guide: "gde-aaaaaa",
      mot: "ALPHA",
      m1Le: new Date(T0 - 10 * 60_000).toISOString(),
    });
    await semer("p2", "attente_email", {
      guide: "gde-bbbbbb",
      mot: "BETA",
      m1Le: new Date(T0 - 20 * 60_000).toISOString(),
    });
    await semer("p3", "attente_email", {
      guide: "gde-cccccc",
      mot: "GAMMA",
      m1Le: new Date(T0 - 30 * 60_000).toISOString(),
    });
    const evt = await commenter("GUIDE");
    await passer(T0);
    expect(compter()).toMatchObject({ pub: 1, prive: 0 });
    expect(await decrire(evt)).toBe("public_seul/plafond_personne");
    expect(cleDuDossier(await toutesLesConversations())).toHaveLength(3);
  });

  describe("(e) même mot retapé", () => {
    beforeEach(async () => {
      await validerFormulationsAuParcours(FORMULATIONS);
    });
    const jeton = (texte: string) => /j=([A-Za-z0-9_.-]+)/.exec(texte)?.[1];
    async function premierEnvoi(): Promise<string> {
      await commenter("GUIDE", { id: "com-e-1" });
      await passer(T0, { env: ENV_LIEN });
      expect(compter()).toMatchObject({ pub: 1, prive: 1 });
      return cleDuDossier(await toutesLesConversations())[0];
    }
    const livrer = async (cle: string) => {
      const conv = await toutesLesConversations();
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
        ...conv,
        [cle]: { ...conv[cle], etat: "guide_demande" },
      });
    };

    it("livré : moins de 24 h = public seul ; 25 h après = `deja-envoye` avec un lien neuf", async () => {
      const cle = await premierEnvoi();
      await livrer(cle);
      const premierLien = jeton(banc.port.prive[0].texte);
      expect(premierLien).toBeTruthy();
      await commenter("GUIDE", { id: "com-e-2", a: T0 + 23 * H });
      await passer(T0 + 23 * H, { env: ENV_LIEN });
      expect(compter()).toMatchObject({ pub: 2, prive: 1 });
      await commenter("GUIDE", { id: "com-e-3", a: T0 + 25 * H });
      await passer(T0 + 25 * H, { env: ENV_LIEN });
      expect(compter()).toMatchObject({ pub: 3, prive: 2 });
      const conv = await toutesLesConversations();
      const neuf = Object.values(conv).find(
        (x: any) => x.nature === "renvoi",
      ) as any;
      expect(neuf).toMatchObject({
        groupeM1: "deja-envoye",
        etat: "attente_email",
        guide: "guide-ia",
      });
      expect(neuf.versionTexteM1.startsWith("mp-deja-envoye-v1-")).toBe(true);
      const nouveauLien = jeton(banc.port.prive[1].texte);
      expect(nouveauLien).toBeTruthy();
      expect(nouveauLien).not.toBe(premierLien);
      expect(neuf.refLienConv).toMatch(/^c1_/);
      expect(neuf.refLienConv).not.toBe(conv[cle].refLienConv);
      expect(neuf.empreintesLien).toHaveLength(1);
    });

    it("non livré : sous 48 h = public seul ; après 48 h = `lien-rappel`", async () => {
      await premierEnvoi();
      await commenter("GUIDE", { id: "com-e-2", a: T0 + 47 * H });
      await passer(T0 + 47 * H, { env: ENV_LIEN });
      expect(compter()).toMatchObject({ pub: 2, prive: 1 });
      await commenter("GUIDE", { id: "com-e-3", a: T0 + 49 * H });
      await passer(T0 + 49 * H, { env: ENV_LIEN });
      expect(compter()).toMatchObject({ pub: 3, prive: 2 });
      const neuf = Object.values(await toutesLesConversations()).find(
        (x: any) => x.nature === "renvoi",
      ) as any;
      expect(neuf).toMatchObject({ groupeM1: "lien-rappel" });
      expect(neuf.versionTexteM1.startsWith("mp-lien-v3-")).toBe(true);
    });

    it("renvoi impossible (lien éteint) : réponse publique, AUCUN message privé, `m1_refuse` / `renvoi_impossible`, jamais le texte qui demande l'adresse", async () => {
      const cle = await premierEnvoi();
      await livrer(cle);
      const evt = await commenter("GUIDE", { id: "com-e-4", a: T0 + 25 * H });
      await passer(T0 + 25 * H, {
        env: { ...ENV_LIEN, PARCOURS_LIEN_GUIDE: undefined },
      });
      expect(compter()).toMatchObject({ pub: 2, prive: 1 });
      expect(await decrire(evt)).toBe("m1_refuse/renvoi_impossible");
      const neuf = Object.values(await toutesLesConversations()).find(
        (x: any) => x.nature === "renvoi",
      ) as any;
      expect(neuf).toMatchObject({
        etat: "m1_refuse",
        dernierCode: "renvoi_impossible",
      });
    });
  });

  it("(f) deux mots vers la même cible : un seul envoi", async () => {
    await activer("ALPHA");
    etat.catalogue = catalogue([["ALPHA", "guide-ia"]]);
    await commenter("GUIDE", { id: "com-f-1" });
    const second = await commenter("ALPHA", { id: "com-f-2" });
    await passer(T0);
    expect(compter()).toMatchObject({ pub: 2, prive: 1 });
    expect(await decrire(second)).toBe("public_seul/deja_envoye");
    expect(cleDuDossier(await toutesLesConversations())).toHaveLength(1);
  });

  it("(g) personne connue sous une ANCIENNE clé de chiffrement : la nouvelle clé est `ancienne|…` (racine = clé ancienne), la forme courante devient un alias", async () => {
    const vieille = lireClesEmpreinte({
      ...ENV,
      STUDIO_EMPREINTE_SECRET: ancienSecret,
    });
    if (!vieille.ok) throw new Error("clés");
    const racineAncienne = empreintePersonne(
      vieille.courante,
      "zernio-conversation",
      AUTEUR,
    );
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [racineAncienne]: graineConv("termine", {
        guide: "gde-aaaaaa",
        m1Le: new Date(T0 - 30 * H).toISOString(),
        creeLe: new Date(T0 - 30 * H).toISOString(),
      }),
    });
    const env = {
      ...ENV,
      STUDIO_EMPREINTE_SECRET: nouveauSecret,
      STUDIO_EMPREINTE_SECRET_ANCIEN: ancienSecret,
    };
    const courante = empreintePersonne(
      cles(env).courante,
      "zernio-conversation",
      AUTEUR,
    );
    await commenter("GUIDE");
    await passer(T0, { env });
    const conv = await toutesLesConversations();
    const [cle] = cleDuDossier(conv);
    expect(cle.startsWith(`${racineAncienne}|`)).toBe(true);
    expect(cle.startsWith(courante)).toBe(false);
    expect(await Com.lireParametre(C.PARAM_CONVERSATIONS_ALIAS, {})).toEqual({
      [courante]: racineAncienne,
    });
    expect(compter()).toMatchObject({ pub: 1, prive: 1 });
  });

  it("(h) merci : la fenêtre est ouverte par un message reçu sur l'AUTRE parcours (activité notée sur tous les parcours du compte)", async () => {
    const ref = createHash("sha256").update("jeton-fictif-h").digest("hex");
    await activer("ALPHA");
    const ancien = await semer("h1", "attente_email", {
      guide: "guide-ia",
      mot: "ALPHA",
      versionTexteM1: "mp-m1-v4-1",
      m1Le: new Date(T0 - 5 * H).toISOString(),
      creeLe: new Date(T0 - 5 * H).toISOString(),
      refLienConv: "c1_AbCdEf0123456789_-xyZQ",
      empreintesLien: [ref],
    });
    const recent = await semer("h2", "attente_email", {
      guide: "guide-ia",
      versionTexteM1: "mp-m1-v4-1",
      m1Le: new Date(T0 - 3 * H).toISOString(),
      creeLe: new Date(T0 - 3 * H).toISOString(),
    });
    await deposerMessage(depots, {
      idMessage: "msg-h-1",
      idExpediteur: AUTEUR,
      idConversation: "conv-fictive-700",
    });
    lireTexteDe("Merci beaucoup");
    await passer(T0);
    const conv = await toutesLesConversations();
    expect(conv[ancien].derniereActiviteLe).toBeTruthy();
    expect(conv[recent].derniereActiviteLe).toBeTruthy();
    // La page du parcours « ALPHA » est validée : le merci part (fenêtre ouverte), sur la bonne conversation.
    const b = TEXTES_MP["mp-merci-v1"];
    await Com.ecrireParametre("parcours.validation.merci", {
      empreinte: createHash("sha256")
        .update(`${b.version}\n${b.texte}`)
        .digest("hex"),
    });
    const vus: RequeteSignee[] = [];
    pm.injecterTransportSite(async (r: RequeteSignee) => {
      vus.push(r);
      return r.chemin === C.CHEMIN_CONFIRMATIONS
        ? {
            statut: 200,
            corps: {
              ok: true,
              schemaVersion: 1,
              confirmations: [{ ref, valideLe: new Date(T0).toISOString() }],
            },
          }
        : { statut: 200, corps: { ok: true } };
    });
    const rapport = await C.traiterMercis({
      port: banc.port.port,
      comptesPermis: [COMPTE],
      titreGuide: TITRE,
      env: { ...ENV, PARCOURS_MERCI_ENABLED: "1" },
      maintenantMs: T0 + 60_000,
    });
    expect(rapport.envoyes).toBe(1);
    expect((await toutesLesConversations())[ancien].merciEtat).toBe("envoye");
  });

  it("(j) rejeu du même commentaire (autre identifiant d'événement) : rien de plus", async () => {
    await commenter("GUIDE", { id: "com-j" });
    await passer(T0);
    const avant = compter();
    const rejeu = await commenter("GUIDE", { id: "com-j" });
    await passer(T0 + 30_000);
    expect(compter()).toEqual(avant);
    expect(await decrire(rejeu)).toBe("silence/deja_traite");
    expect(cleDuDossier(await toutesLesConversations())).toHaveLength(1);
  });

  it("(j bis) rejeu d'un commentaire déjà traité en réponse publique seule : rien de plus", async () => {
    await semer("j1", "attente_email", {
      m1Le: new Date(T0 - 10 * 60_000).toISOString(),
    });
    await commenter("GUIDE", { id: "com-jb" });
    await passer(T0);
    expect(compter()).toMatchObject({ pub: 1, prive: 0 });
    const rejeu = await commenter("GUIDE", { id: "com-jb" });
    await passer(T0 + 30_000);
    expect(compter()).toMatchObject({ pub: 1, prive: 0 });
    expect(await decrire(rejeu)).toBe("silence/deja_traite");
  });

  it("(k) arrêt pendant `m1_en_vol` : `m1_a_verifier` au redémarrage, jamais de 2e envoi", async () => {
    const cle = await semer("k1", "m1_en_vol", {
      mot: "GUIDE",
      prochainEssaiLe: null,
    });
    C.reinitialiserParcoursConversation(); // le processus a redémarré : plus rien « en vol »
    await commenter("GUIDE", { id: "com-k-2" });
    await passer(T0);
    expect((await toutesLesConversations())[cle].etat).toBe("m1_a_verifier");
    expect(compter()).toMatchObject({ pub: 1, prive: 0 });
  });

  it("(l) doute d'opposition : SILENCE TOTAL, aucun appel du port (ni réponse publique, ni privé, ni lecture)", async () => {
    await semer("l1", "attente_email", {
      guide: "gde-aaaaaa",
      mot: "ALPHA",
      douteOpposition: true,
    });
    const evt = await commenter("GUIDE");
    await passer(T0);
    expect(banc.port.total()).toBe(0);
    expect(await decrire(evt)).toBe("silence/doute_opposition");
  });

  it("cible introuvable (liaison vers une cible inactive) : événement écarté `cible_inconnue`, alerte cloche, rien ne part", async () => {
    await activer("ALPHA");
    const cat = catalogue([["ALPHA", "gde-inactif1"]], ["gde-inactif1"]);
    cat.catalogue[1] = { ...cat.catalogue[1], actif: false };
    etat.catalogue = cat;
    const evt = await commenter("ALPHA");
    await passer(T0);
    expect(banc.port.total()).toBe(0);
    expect(await decrire(evt)).toBe("ecarte/cible_inconnue");
    expect(
      (await depots().evenements.lister((e: any) => /ALERTE/.test(e.message)))
        .length,
    ).toBe(1);
  });

  it("catalogue illisible pour un mot autre que GUIDE : reporté de 60 s (`catalogue_illisible`) ; pour GUIDE : `guide-ia`", async () => {
    await activer("ALPHA");
    etat.catalogue = null;
    const evt = await commenter("ALPHA");
    await passer(T0);
    const e = await evenement(depots, evt);
    expect(e.charge).toMatchObject({
      etat: "a_reessayer",
      dernierCode: "catalogue_illisible",
      prochainEssaiLe: T0 + 60_000,
    });
    expect(banc.port.total()).toBe(0);
  });

  it("mot dont la ligne `mot|compte` n'est pas active : écarté (raison « mot »)", async () => {
    const evt = await commenter("ALPHA");
    await passer(T0);
    expect(await decrire(evt)).toBe("ecarte/mot");
    expect(banc.port.total()).toBe(0);
  });

  it("message : M2 et accusé portent sur le parcours retenu ; le mot envoyé au site est celui du parcours", async () => {
    await activer("ALPHA");
    await semer("m1", "attente_email", {
      guide: "guide-ia",
      mot: "ALPHA",
      versionTexteM1: "mp-m1-v2",
    });
    await deposerMessage(depots, {
      idMessage: "msg-adresse",
      idExpediteur: AUTEUR,
      idConversation: "conv-fictive-700",
    });
    lireTexteDe(`voici mon adresse ${ADRESSE}`);
    await passer(T0);
    const corps = banc.site.vus.map((r: RequeteSignee) => JSON.parse(r.corps));
    expect(corps).toHaveLength(1);
    expect(corps[0]).toMatchObject({ mot: "ALPHA", guide: "guide-ia" });
  });

  it("message : « stop » écrit en privé = tout le dossier `oppose`, une entrée en file par parcours", async () => {
    const t = new Date(T0 - H).toISOString();
    const a = await semer("s1", "attente_email", {
      guide: "gde-aaaaaa",
      mot: "ALPHA",
      occurredAt: t,
    });
    const b = await semer("s2", "attente_email", {
      guide: "guide-ia",
      occurredAt: t,
      m1Le: new Date(T0 - 1800_000).toISOString(),
    });
    await deposerMessage(depots, {
      idMessage: "msg-stop",
      idExpediteur: AUTEUR,
      idConversation: "conv-fictive-700",
    });
    lireTexteDe("stop");
    await passer(T0);
    const conv = await toutesLesConversations();
    expect([conv[a].etat, conv[b].etat]).toEqual(["oppose", "oppose"]);
    expect(
      Object.keys(
        await Com.lireParametre("parcours.oppositions.file", {}),
      ).sort(),
    ).toEqual([a, b].sort());
  });
});

describe("LIA-C · correctifs de l'audit (réglage allumé)", () => {
  const alertesCloche = async (re: RegExp) =>
    await depots().notifications.lister((n: any) => re.test(n.message));

  describe("règle de validation : seul le mot GUIDE lié à `guide-ia` a des textes validés", () => {
    beforeEach(() => {
      etat.parMot = false; // la vraie règle
    });

    it("25 commentaires d'un mot non validé + 1 GUIDE : le GUIDE est traité au même passage, les 25 sont clos `ecarte`, UNE seule alerte, sans push", async () => {
      await activer("ALPHA");
      etat.catalogue = catalogue([["ALPHA", "guide-ia"]]);
      const evts: string[] = [];
      for (let i = 0; i < 25; i++)
        evts.push(
          await commenter("ALPHA", {
            id: `com-v-${i}`,
            auteur: `auteur-v-${i}`,
            a: T0 + i * 10,
          }),
        );
      const guide = await commenter("GUIDE", {
        id: "com-v-guide",
        a: T0 + 900,
      });
      await passer(T0);
      for (const e of evts)
        expect(await decrire(e)).toBe("ecarte/validation_absente");
      expect((await evenement(depots, guide)).charge.etat).not.toBe("a_faire");
      expect(compter()).toMatchObject({ pub: 1, prive: 1 });
      const cloches = await alertesCloche(/n'a pas de textes validés/);
      expect(cloches).toHaveLength(1);
      expect(cloches[0].message).toBe(
        "Le mot ALPHA n'a pas de textes validés : aucun message ne part pour ce mot.",
      );
      expect(await alertes()).toBe(1);
    });

    it("mot CHATGPT actif, lié à `guide-ia` : événement clos `ecarte`, zéro appel du port", async () => {
      await activer("CHATGPT");
      etat.catalogue = catalogue([["CHATGPT", "guide-ia"]]);
      const evt = await commenter("CHATGPT");
      await passer(T0);
      expect(await decrire(evt)).toBe("ecarte/validation_absente");
      expect(banc.port.total()).toBe(0);
      expect(cleDuDossier(await toutesLesConversations())).toHaveLength(0);
    });

    it("GUIDE lié à une autre cible : clos `ecarte`, rien ne part", async () => {
      etat.catalogue = catalogue([["GUIDE", "gde-alpha01"]], ["gde-alpha01"]);
      const evt = await commenter("GUIDE");
      await passer(T0);
      expect(await decrire(evt)).toBe("ecarte/validation_absente");
      expect(banc.port.total()).toBe(0);
    });
  });

  it("cible d'essai (`test: true`) : traitée comme inconnue, `cible_inconnue`, événement clos, rien ne part", async () => {
    await activer("ALPHA");
    const cat = catalogue([["ALPHA", "gde-essai01"]], ["gde-essai01"]);
    cat.catalogue[1] = { ...cat.catalogue[1], test: true };
    etat.catalogue = cat;
    const evt = await commenter("ALPHA");
    await passer(T0);
    expect(await decrire(evt)).toBe("ecarte/cible_inconnue");
    expect(banc.port.total()).toBe(0);
  });

  describe("guides connus du site (3e paramètre de `runValide`)", () => {
    const adresseEnvoyee = async () => {
      await activer("ALPHA");
      await semer("g1", "attente_email", {
        guide: "gde-aaaaaa",
        mot: "ALPHA",
        versionTexteM1: "mp-m1-v2",
      });
      await deposerMessage(depots, {
        idMessage: "msg-guide",
        idExpediteur: AUTEUR,
        idConversation: "conv-fictive-700",
      });
      lireTexteDe(`voici mon adresse ${ADRESSE}`);
      await passer(T0);
      return banc.site.vus.map((r: RequeteSignee) => JSON.parse(r.corps));
    };

    it("cible `guide` active du catalogue : le site reçoit la demande", async () => {
      etat.catalogue = catalogue([["ALPHA", "gde-aaaaaa"]], ["gde-aaaaaa"]);
      expect(await adresseEnvoyee()).toMatchObject([
        { mot: "ALPHA", guide: "gde-aaaaaa" },
      ]);
    });

    it("cible d'essai ou inactive : refus local `run_invalide`, le site n'est pas appelé", async () => {
      const cat = catalogue([["ALPHA", "gde-aaaaaa"]], ["gde-aaaaaa"]);
      cat.catalogue[1] = { ...cat.catalogue[1], test: true };
      etat.catalogue = cat;
      expect(await adresseEnvoyee()).toHaveLength(0);
      expect(Object.values(await toutesLesConversations())[0]).toMatchObject({
        etat: "site_refuse",
        dernierCode: "run_invalide",
      });
    });

    it("catalogue illisible : liste par défaut (`guide-ia` seul), une autre cible est refusée localement", async () => {
      etat.catalogue = null;
      expect(await adresseEnvoyee()).toHaveLength(0);
    });
  });

  describe("règle du doute juste avant chaque envoi", () => {
    it("doute posé entre l'étape 5 et la réponse publique : zéro appel du port", async () => {
      etat.douteAuControle = 2; // 1er contrôle = étape 5 (propre) ; 2e = juste avant la réponse publique
      const evt = await commenter("GUIDE");
      await passer(T0);
      expect(banc.port.total()).toBe(0);
      expect(await decrire(evt)).toBe("silence/opposee");
    });

    it("doute posé juste avant le premier message privé : la réponse publique est partie, AUCUN message privé", async () => {
      etat.douteAuControle = 3;
      const evt = await commenter("GUIDE");
      await passer(T0);
      expect(compter()).toMatchObject({ pub: 1, prive: 0 });
      expect(await decrire(evt)).toBe("silence/opposee");
    });
  });
});

describe("LIA-C · (m) réglage ÉTEINT : comportement inchangé", () => {
  it("aucun appel au catalogue, aucune clé `|` écrite, réglage lu une fois par passage", async () => {
    etat.allume = false;
    await commenter("GUIDE");
    await passer(T0);
    await deposerMessage(depots, {
      idMessage: "msg-m",
      idExpediteur: AUTEUR,
      idConversation: "conv-fictive-700",
    });
    lireTexteDe("bonjour");
    await passer(T0 + 60_000);
    expect(etat.appelsCatalogue).toBe(0);
    expect(etat.lectures).toBe(2);
    const conv = await toutesLesConversations();
    expect(Object.keys(conv)).toEqual([racine()]);
    expect(
      Object.keys(
        await Com.lireParametre(C.PARAM_CONVERSATIONS_ALIAS, {}),
      ).some((k) => k.includes("|")),
    ).toBe(false);
    expect(compter()).toMatchObject({ pub: 1, prive: 1 });
  });
});

describe("LIA-C · borne d'un passage quand le traitement lève (M1)", () => {
  /** Dès que la liste des événements dus est lue, toute lecture de paramètre lève (registre illisible / base en panne). */
  async function casserApresLaListe(): Promise<void> {
    const ev = depots().evenementsFournisseurs;
    const listerReel = ev.lister.bind(ev);
    const param = depots().parametres;
    const obtenirReel = param.obtenir.bind(param);
    let casse = false;
    vi.spyOn(ev, "lister").mockImplementation(async (...a: any[]) => {
      const r = await (listerReel as any)(...a);
      casse = true;
      return r;
    });
    vi.spyOn(param, "obtenir").mockImplementation(async (id: string) => {
      if (casse) throw new Error("base en panne (test)");
      return obtenirReel(id);
    });
  }
  const trenteCommentaires = async () => {
    for (let i = 0; i < 30; i++)
      await commenter("GUIDE", {
        id: `com-m1-${i}`,
        auteur: `auteur-m1-${i}`,
        a: T0 + i * 10,
      });
  };

  it("éteint : 30 événements dont le traitement lève => au plus 20 traités dans le passage", async () => {
    etat.allume = false;
    await trenteCommentaires();
    await casserApresLaListe();
    const rap = await passer(T0);
    expect(rap.enAttente).toBeLessThanOrEqual(20);
    expect(rap.enAttente).toBe(20);
    expect(compter()).toMatchObject({ pub: 0, prive: 0 });
  });

  it("allumé : même cas => le compte ne dépasse pas la borne prévue (un lot de 20)", async () => {
    etat.allume = true;
    await trenteCommentaires();
    await casserApresLaListe();
    const rap = await passer(T0);
    expect(rap.enAttente).toBeLessThanOrEqual(20);
    expect(rap.enAttente).toBe(20);
    expect(compter()).toMatchObject({ pub: 0, prive: 0 });
  });
});

describe("LIA-C · éteint : aucune lecture du catalogue, même jusqu'à la demande de guide (M2)", () => {
  it("parcours mené jusqu'à la demande de guide : ZÉRO appel à `lireCiblesSite`", async () => {
    etat.allume = false;
    await commenter("GUIDE");
    await passer(T0);
    await deposerMessage(depots, {
      idMessage: "msg-m2",
      idExpediteur: AUTEUR,
      idConversation: "conv-fictive-700",
    });
    lireTexteDe(`voici mon adresse ${ADRESSE}`);
    await passer(T0 + 60_000);
    expect(banc.site.vus.length).toBeGreaterThan(0); // la demande de guide est bien partie
    expect(etat.appelsCatalogue).toBe(0);
  });
});
