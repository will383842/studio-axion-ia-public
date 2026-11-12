/** MG-STOP01 / S4 · 2e correction : changement de clé, forme héritée, registre non lisible, clés absentes. Identifiants fictifs. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  signatureZernio,
  type RunLu,
} from "@/domaine/guide-reseau/crochet-zernio";
import { empreinteHeritee } from "@/domaine/guide-reseau/empreinte-personne";
import type { RequeteSignee } from "@/fournisseurs/site/types";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const A = await import("@/services/a-traiter");
const Opp = await import("@/services/oppositions-mots");
const Com = await import("@/services/_commun");
const { EcranATraiter } = await import("@/components/a-traiter/EcranATraiter");

const T0 = 1_760_781_600_000;
const SECRET = "secret-fictif-crochet-stop-s4c";
const ENV = {
  PARCOURS_MOT_ENABLED: "1",
  ZERNIO_WEBHOOK_SECRET: SECRET,
  SITE_VIDEOS_URL: "https://site.exemple",
  SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-stop-s4c-0123456789abcde",
};
const RUN: RunLu = {
  email: "lecteur-fictif@example.test",
  mot: "guide",
  reseau: "instagram",
  guide: "guide-ia",
  versionTexteM1: "mp-m1-v2",
};
const CLE_A = "cle-fictive-ancienne-0123456789-abcdefghij";
const CLE_B = "cle-fictive-nouvelle-0123456789-abcdefghij";
const ORIGINE = {
  c: process.env.STUDIO_EMPREINTE_SECRET,
  a: process.env.STUDIO_EMPREINTE_SECRET_ANCIEN,
};

const rendre = (k: "c" | "a") => {
  const nom =
    k === "c" ? "STUDIO_EMPREINTE_SECRET" : "STUDIO_EMPREINTE_SECRET_ANCIEN";
  if (ORIGINE[k] === undefined) delete process.env[nom];
  else process.env[nom] = ORIGINE[k];
};
beforeEach(() => {
  reinitialiserDepots();
  pm.reinitialiserGardesParcours();
  for (const m of ["log", "error", "warn", "info"] as const)
    vi.spyOn(console, m).mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterLecteurRuns(null);
  pm.injecterTransportSite(null);
  rendre("c");
  rendre("a");
});

const entree = {
  idEvenement: "ev-s4c",
  reseau: "instagram",
  post: "post-1",
  motif: "mot_inconnu",
  mot: "AUTRE",
  commentaire: "AUTRE",
  reponse: "Merci pour votre commentaire !",
};
const env = { A_TRAITER_ENABLED: "1" };
const html = (vue: Awaited<ReturnType<typeof A.lireVueATraiter>>) =>
  renderToStaticMarkup(
    createElement(EcranATraiter, { vue, services: {} as never, compte: "c" }),
  );
const interdits = [
  "Copier la réponse",
  ">Fait<",
  ">STOP<",
  "Réponse proposée",
  "Merci pour votre commentaire",
];
const verifierFermee = (vue: Awaited<ReturnType<typeof A.lireVueATraiter>>) => {
  expect(vue.cartes[0]).toMatchObject({ opposee: true, kit: null });
  const h = html(vue);
  for (const i of interdits) expect(h, i).not.toContain(i);
};

describe("(1) carte « À traiter » et changement de clé", () => {
  it("clé changée après la création, opposition inscrite sous la NOUVELLE clé => carte opposée (règle du kid)", async () => {
    process.env.STUDIO_EMPREINTE_SECRET = CLE_A;
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(
      { ...entree, idContact: "ct_rot_s4c" },
      { env, depot },
    );
    expect(
      (await A.lireVueATraiter({ env, depot })).cartes[0].kit,
    ).toBeTruthy();
    process.env.STUDIO_EMPREINTE_SECRET = CLE_B; // rotation SANS garder l'ancienne clé : l'empreinte figée ne retrouverait rien
    await Opp.enregistrerOpposition("ct_rot_s4c", "facebook");
    verifierFermee(await A.lireVueATraiter({ env, depot }));
  });
  it("clé changée, ancienne clé gardée, opposition écrite sous l'ANCIENNE clé => carte opposée (toutes les formes stockées)", async () => {
    process.env.STUDIO_EMPREINTE_SECRET = CLE_A;
    await Opp.enregistrerOpposition("ct_anc_s4c", "facebook"); // ligne sous la clé A
    process.env.STUDIO_EMPREINTE_SECRET = CLE_B;
    process.env.STUDIO_EMPREINTE_SECRET_ANCIEN = CLE_A;
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(
      { ...entree, idContact: "ct_anc_s4c" },
      { env, depot },
    );
    // carte posée sans kid (comme une carte plus ancienne) pour que SEULES les formes stockées comptent
    const [c] = await depot.lire();
    await depot.ecrire([{ ...c, kid: undefined }]);
    verifierFermee(await A.lireVueATraiter({ env, depot }));
  });
  it("carte venue directement d'enregistrerATraiter, personne connue seulement sous la forme héritée => carte opposée", async () => {
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(
      { ...entree, idContact: "ct_her_s4c" },
      { env, depot },
    );
    const [c] = await depot.lire();
    expect(c.empreintes).toContain(empreinteHeritee("ct_her_s4c"));
    expect(JSON.stringify(c)).not.toContain("ct_her_s4c"); // jamais l'identifiant brut
    expect(
      (await A.lireVueATraiter({ env, depot })).cartes[0].kit,
    ).toBeTruthy();
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [
      {
        id: empreinteHeritee("ct_her_s4c"),
        le: "2026-01-01T00:00:00Z",
        transmise: false,
      },
    ]);
    verifierFermee(await A.lireVueATraiter({ env, depot }));
  });
  it("le kid de la clé courante est stocké, sans identifiant brut", async () => {
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(
      { ...entree, idContact: "ct_kid_s4c" },
      { env, depot },
    );
    const [c] = await depot.lire();
    expect(c.kid).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(c)).not.toContain("ct_kid_s4c");
  });
});

describe("(2) registre des oppositions non lisible (pas un tableau)", () => {
  it("paramètre `{}` avec un identifiant présent => réessai à 60 s, jamais mis de côté, aucun envoi", async () => {
    const corps = Buffer.from(
      JSON.stringify({
        id: "evt_reg_s4c",
        event: "workflow.run.completed",
        timestamp: new Date(T0).toISOString(),
        execution: { id: "run_evt_reg_s4c_0001", status: "completed" },
        contact: { id: "ct_reg_s4c" },
        trigger: { type: "keyword", text: "GUIDE" },
      }),
    );
    await pm.recevoirCrochetZernio(
      {
        corps,
        idEvenement: "evt_reg_s4c",
        signature: signatureZernio(SECRET, corps),
      },
      { env: ENV, maintenantMs: T0 },
    );
    const vus: RequeteSignee[] = [];
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    pm.injecterTransportSite(
      async (r) => (vus.push(r), { statut: 200, corps: {} }),
    );
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, {});
    expect(
      await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 }),
    ).toMatchObject({ aReessayer: 1, ecartes: 0 });
    const [e] = await depots().evenementsFournisseurs.lister(
      (x) => x.idEvenement === "evt_reg_s4c",
    );
    expect(e.traite).toBe(false);
    expect(e.charge).toMatchObject({
      dernierCode: "registre_illisible",
      prochainEssaiLe: T0 + 60_000,
    });
    expect(vus).toHaveLength(0);
  });
});

describe("(3) clés d'empreinte absentes à l'enregistrement", () => {
  it("avec idContact et réponse : kit nul dans le dépôt, pas d'empreintes", async () => {
    delete process.env.STUDIO_EMPREINTE_SECRET;
    delete process.env.STUDIO_EMPREINTE_SECRET_ANCIEN;
    const depot = A.creerDepotMemoire();
    expect(
      await A.enregistrerATraiter(
        { ...entree, idContact: "ct_sanscle_s4c" },
        { env, depot },
      ),
    ).toMatchObject({ issue: "execute", raison: "ajoute" });
    const [c] = await depot.lire();
    expect(c.kit).toBeNull();
    expect(c.empreintes).toBeUndefined();
  });
});
