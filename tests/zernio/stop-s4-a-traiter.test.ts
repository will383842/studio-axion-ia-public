/** MG-STOP01 / S4 : « stop partout » pour le mot commenté (aiguillage et outbox) et pour la carte « À traiter ». Identifiants fictifs. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  signatureZernio,
  type RunLu,
} from "@/domaine/guide-reseau/crochet-zernio";
import type { RequeteSignee } from "@/fournisseurs/site/types";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const A = await import("@/services/a-traiter");
const Opp = await import("@/services/oppositions-mots");
const { EcranATraiter } = await import("@/components/a-traiter/EcranATraiter");

const T0 = 1_760_781_600_000;
const SECRET = "secret-fictif-crochet-stop-s4";
const ENV = {
  PARCOURS_MOT_ENABLED: "1",
  ZERNIO_WEBHOOK_SECRET: SECRET,
  SITE_VIDEOS_URL: "https://site.exemple",
  SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-stop-s4-0123456789abcde",
};
const RUN: RunLu = {
  email: "lecteur-fictif@example.test",
  mot: "guide",
  reseau: "instagram",
  guide: "guide-ia",
  versionTexteM1: "mp-m1-v2",
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
});

const deposer = async (id: string, contact: string) => {
  const corps = Buffer.from(
    JSON.stringify({
      id,
      event: "workflow.run.completed",
      timestamp: new Date(T0).toISOString(),
      execution: { id: `run_${id}_0001`, status: "completed" },
      contact: { id: contact },
      trigger: { type: "keyword", text: "GUIDE" },
    }),
  );
  await pm.recevoirCrochetZernio(
    { corps, idEvenement: id, signature: signatureZernio(SECRET, corps) },
    { env: ENV, maintenantMs: T0 },
  );
};
const brancher = () => {
  const vus: RequeteSignee[] = [];
  pm.injecterLecteurRuns(async () => ({ ...RUN }));
  pm.injecterTransportSite(
    async (r) => (vus.push(r), { statut: 200, corps: {} }),
  );
  return vus;
};
const base = {
  idEvenement: "ev-s4",
  post: "post-1",
  reseau: "instagram" as const,
  canal: "commentaire" as const,
  mot: "GUIDE",
  commentaire: "GUIDE",
};
const optsAT = () => ({
  env: { A_TRAITER_ENABLED: "1" },
  depot: A.creerDepotMemoire(),
  lireMots: async () => ["GUIDE"],
});

describe("mot commenté : « stop partout »", () => {
  it("aiguillage : opposée sur un AUTRE réseau => silence, rien ne part, rien n'est supprimé", async () => {
    await Opp.enregistrerOpposition("ct_ailleurs", "facebook");
    const o = optsAT();
    expect(
      await A.orienterCommentaire({ ...base, idContact: "ct_ailleurs" }, o),
    ).toEqual({
      issue: "execute",
      action: "silence",
      raison: "personne_opposee",
    });
    expect(await o.depot.lire()).toEqual([]);
    expect(await Opp.personneOpposee("ct_ailleurs", "facebook")).toBe(true);
  });
  it("aiguillage : vérification en erreur => rien ne part, réessai", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(
      new Error("base indisponible"),
    );
    expect(
      await A.orienterCommentaire({ ...base, idContact: "ct_panne" }, optsAT()),
    ).toEqual({ issue: "reessai", raison: "registre_illisible" });
  });
  it("aiguillage : personne non opposée => comportement inchangé", async () => {
    expect(
      await A.orienterCommentaire({ ...base, idContact: "ct_libre" }, optsAT()),
    ).toMatchObject({ action: "reponse_publique", motRetenu: "GUIDE" });
  });
  it("outbox : opposée sur un autre réseau => écarté « ignoré : opposition », aucun envoi, événement conservé", async () => {
    await Opp.enregistrerOpposition("ct_ailleurs2", "instagram");
    await deposer("evt_s4_a", "ct_ailleurs2");
    const vus = brancher();
    expect(
      await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 }),
    ).toMatchObject({ envoyes: 0, ecartes: 1 });
    expect(vus).toHaveLength(0);
    const [ev] = await depots().evenementsFournisseurs.lister(
      (x) => x.idEvenement === "evt_s4_a",
    );
    expect(ev).toBeTruthy();
    expect(ev.traite).toBe(true);
    expect(ev.charge.dernierCode).toBe("opposee");
  });
  it("outbox : vérification en erreur => rien ne part, réessai (non traité)", async () => {
    await deposer("evt_s4_b", "ct_panne2");
    const vus = brancher();
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(
      new Error("base indisponible"),
    );
    expect(
      await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 }),
    ).toMatchObject({ envoyes: 0, aReessayer: 1 });
    expect(vus).toHaveLength(0);
    const [ev] = await depots().evenementsFournisseurs.lister(
      (x) => x.idEvenement === "evt_s4_b",
    );
    expect(ev.traite).toBe(false);
  });
  it("outbox : sans identifiant de contact => rien ne part, écarté pour de bon (voir stop-s4-correctifs)", async () => {
    await deposer("evt_s4_c", "ct_x");
    const [ev] = await depots().evenementsFournisseurs.lister(
      (x) => x.idEvenement === "evt_s4_c",
    );
    await depots().evenementsFournisseurs.modifier(ev.id, {
      charge: { ...ev.charge, idContact: null },
    });
    const vus = brancher();
    expect(
      await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 }),
    ).toMatchObject({ envoyes: 0, aReessayer: 0, ecartes: 1 });
    expect(vus).toHaveLength(0);
  });
  it("outbox : non opposée => envoi inchangé", async () => {
    await deposer("evt_s4_d", "ct_libre2");
    const vus = brancher();
    expect(
      await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 }),
    ).toMatchObject({ envoyes: 1, ecartes: 0 });
    expect(vus).toHaveLength(1);
  });
});

describe("carte « À traiter » d'une personne opposée", () => {
  const entree = {
    idEvenement: "ev-carte",
    reseau: "instagram",
    post: "post-1",
    motif: "mot_inconnu",
    mot: "AUTRE",
    commentaire: "AUTRE",
    reponse: "Merci pour votre commentaire !",
  };
  const vueDe = async (opposee: boolean) => {
    const depot = A.creerDepotMemoire();
    const env = { A_TRAITER_ENABLED: "1" };
    await A.enregistrerATraiter({ ...entree, opposee }, { env, depot });
    return A.lireVueATraiter({ env, depot });
  };
  const html = (vue: Awaited<ReturnType<typeof vueDe>>) =>
    renderToStaticMarkup(
      createElement(EcranATraiter, { vue, services: {} as never, compte: "c" }),
    );

  it("aucune action d'envoi : ni copie, ni « Fait », ni STOP, ni réponse proposée ; message d'arrêt et classement seulement", async () => {
    const vue = await vueDe(true);
    expect(vue.cartes[0].kit).toBeNull();
    const h = html(vue);
    expect(h).toContain("Cette personne a demandé l’arrêt : ne rien envoyer.");
    expect(h).toContain("Classer la carte");
    for (const interdit of [
      "Copier la réponse",
      ">Fait<",
      ">STOP<",
      "Réponse proposée",
      "Merci pour votre commentaire",
    ])
      expect(h, interdit).not.toContain(interdit);
  });
  it("même un dépôt qui porte encore une réponse : le kit n'est jamais servi pour une carte opposée", async () => {
    const depot = A.creerDepotMemoire();
    const env = { A_TRAITER_ENABLED: "1" };
    await A.enregistrerATraiter(entree, { env, depot });
    expect(
      (await A.marquerCarteOpposee("ev-carte", { env, depot })).issue,
    ).toBe("execute");
    const vue = await A.lireVueATraiter({ env, depot });
    expect(vue.cartes[0]).toMatchObject({ opposee: true, kit: null });
    expect(html(vue)).not.toContain("Copier la réponse");
  });
  it("carte d'une personne non opposée : actions inchangées", async () => {
    const h = html(await vueDe(false));
    for (const attendu of [
      "Copier la réponse",
      "Fait",
      "Ignorer",
      "STOP",
      "Réponse proposée",
    ])
      expect(h, attendu).toContain(attendu);
    expect(h).not.toContain("a demandé l’arrêt");
  });
  it("le texte de la carte ne contient ni adresse ni identifiant de la personne", async () => {
    const depot = A.creerDepotMemoire();
    const env = { A_TRAITER_ENABLED: "1" };
    await A.enregistrerATraiter(
      {
        ...entree,
        opposee: true,
        commentaire: "écrivez à lecteur@example.test @pseudo_fictif",
      },
      { env, depot },
    );
    const vue = await A.lireVueATraiter({ env, depot });
    const h = html(vue);
    expect(h).not.toMatch(/lecteur@example|pseudo_fictif|ct_/);
    expect(JSON.stringify(vue.cartes)).not.toMatch(
      /lecteur@example|pseudo_fictif/,
    );
  });
});
