/** MG-STOP01 / S4 · correctifs de relecture : événements sans identifiant, empreinte dans la carte, sans identifiant, doute. Identifiants fictifs. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  signatureZernio,
  type RunLu,
} from "@/domaine/guide-reseau/crochet-zernio";
import {
  empreintePersonne,
  lireClesEmpreinte,
} from "@/domaine/guide-reseau/empreinte-personne";
import type { RequeteSignee } from "@/fournisseurs/site/types";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const A = await import("@/services/a-traiter");
const Opp = await import("@/services/oppositions-mots");
const Com = await import("@/services/_commun");
const { EcranATraiter } = await import("@/components/a-traiter/EcranATraiter");

const T0 = 1_760_781_600_000;
const SECRET = "secret-fictif-crochet-stop-s4b";
const ENV = {
  PARCOURS_MOT_ENABLED: "1",
  ZERNIO_WEBHOOK_SECRET: SECRET,
  SITE_VIDEOS_URL: "https://site.exemple",
  SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-stop-s4b-0123456789abcde",
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

const deposer = async (id: string, contact: string, sansContact = false) => {
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
  if (sansContact) {
    const [ev] = await depots().evenementsFournisseurs.lister(
      (x) => x.idEvenement === id,
    );
    await depots().evenementsFournisseurs.modifier(ev.id, {
      charge: { ...ev.charge, idContact: null },
    });
  }
};
const ev = async (id: string) =>
  (
    await depots().evenementsFournisseurs.lister((x) => x.idEvenement === id)
  )[0];
const brancher = () => {
  const vus: RequeteSignee[] = [];
  pm.injecterLecteurRuns(async () => ({ ...RUN }));
  pm.injecterTransportSite(
    async (r) => (vus.push(r), { statut: 200, corps: {} }),
  );
  return vus;
};
const cleConv = (id: string) => {
  const c = lireClesEmpreinte(process.env);
  if (!c.ok) throw new Error("clé absente");
  return empreintePersonne(c.courante, "zernio-contact", id);
};

describe("(2) événements sans identifiant : écartés pour de bon, la file n'est pas affamée", () => {
  it("deux événements sans identifiant + un normal => le normal part, les deux autres sont écartés sans réessai", async () => {
    await deposer("evt_vide_1", "x", true);
    await deposer("evt_vide_2", "x", true);
    await deposer("evt_normal", "ct_normal_s4b");
    const vus = brancher();
    expect(
      await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 }),
    ).toMatchObject({ envoyes: 1, ecartes: 2, aReessayer: 0 });
    expect(vus).toHaveLength(1);
    for (const id of ["evt_vide_1", "evt_vide_2"]) {
      const e = await ev(id);
      expect(e).toBeTruthy(); // rien supprimé
      expect(e.traite).toBe(true);
      expect(e.charge).toMatchObject({
        etat: "ecarte",
        dernierCode: "personne_inconnue",
      });
    }
    // 60 s plus tard : aucun réessai, aucun appel du plafond horaire consommé
    const r = await pm.traiterOutboxZernio({
      env: ENV,
      maintenantMs: T0 + 60_000,
    });
    expect(r.traites).toBe(0);
    expect(vus).toHaveLength(1);
  });
  it("une vraie panne de lecture reste réessayée à 60 s (non traité)", async () => {
    await deposer("evt_panne_s4b", "ct_panne_s4b");
    const vus = brancher();
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(
      new Error("base indisponible"),
    );
    expect(
      await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 }),
    ).toMatchObject({ aReessayer: 1, ecartes: 0 });
    const e = await ev("evt_panne_s4b");
    expect(e.traite).toBe(false);
    expect(e.charge).toMatchObject({
      dernierCode: "registre_illisible",
      prochainEssaiLe: T0 + 60_000,
    });
    expect(vus).toHaveLength(0);
  });
  it("(5) conversation marquée douteOpposition => rien ne part", async () => {
    await deposer("evt_doute_s4b", "ct_doute_s4b");
    await Com.ecrireParametre("parcours.conversations", {
      [cleConv("ct_doute_s4b")]: {
        etat: "attente_email",
        douteOpposition: true,
      },
    });
    const vus = brancher();
    await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 });
    expect(vus).toHaveLength(0);
  });
});

describe("carte « À traiter » : empreinte, revérification, sans identifiant", () => {
  const entree = {
    idEvenement: "ev-s4b",
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

  it("(3) carte créée avant l'opposition, puis opposition => la carte relue n'offre plus ni copie, ni « Fait », ni STOP", async () => {
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(
      { ...entree, idContact: "ct_avant_s4b" },
      { env, depot },
    );
    const avant = await A.lireVueATraiter({ env, depot });
    expect(avant.cartes[0].kit).toBeTruthy();
    expect(html(avant)).toContain("Copier la réponse");
    expect(JSON.stringify(await depot.lire())).not.toContain("ct_avant_s4b"); // jamais l'identifiant brut
    await Opp.enregistrerOpposition("ct_avant_s4b", "facebook"); // autre réseau
    const apres = await A.lireVueATraiter({ env, depot });
    expect(apres.cartes[0]).toMatchObject({ opposee: true, kit: null });
    const h = html(apres);
    expect(h).toContain("Cette personne a demandé l’arrêt : ne rien envoyer.");
    for (const i of interdits) expect(h, i).not.toContain(i);
  });
  it("(3) vérification en erreur => carte « opposée » (fermé)", async () => {
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(
      { ...entree, idContact: "ct_erreur_s4b" },
      { env, depot },
    );
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(
      new Error("base indisponible"),
    );
    const vue = await A.lireVueATraiter({ env, depot });
    expect(vue.cartes[0]).toMatchObject({ opposee: true, kit: null });
    for (const i of interdits) expect(html(vue), i).not.toContain(i);
  });
  it("(5) conversation douteOpposition => la carte relue est « opposée »", async () => {
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(
      { ...entree, idContact: "ct_doute2_s4b" },
      { env, depot },
    );
    await Com.ecrireParametre("parcours.conversations", {
      [cleConv("ct_doute2_s4b")]: {
        etat: "attente_email",
        douteOpposition: true,
      },
    });
    expect((await A.lireVueATraiter({ env, depot })).cartes[0]).toMatchObject({
      opposee: true,
      kit: null,
    });
  });
  it("(3) personne non opposée : la carte garde sa réponse", async () => {
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(
      { ...entree, idContact: "ct_libre_s4b" },
      { env, depot },
    );
    expect(
      (await A.lireVueATraiter({ env, depot })).cartes[0].kit,
    ).toBeTruthy();
  });
  it("(4) aiguillage sans identifiant de contact : jamais d'envoi, la carte va dans « À traiter » sans réponse", async () => {
    const depot = A.creerDepotMemoire();
    const r = await A.orienterCommentaire(
      {
        idEvenement: "ev-sans-id",
        post: "post-1",
        reseau: "instagram",
        canal: "commentaire",
        mot: "GUIDE",
        commentaire: "GUIDE",
      },
      { env, depot, lireMots: async () => ["GUIDE"] },
    );
    expect(r).toMatchObject({ issue: "execute", action: "a_traiter" });
    const [c] = await depot.lire();
    expect(c.kit).toBeNull();
  });
  it("(5) aiguillage : conversation douteOpposition => rien ne part", async () => {
    await Com.ecrireParametre("parcours.conversations", {
      [cleConv("ct_doute3_s4b")]: {
        etat: "attente_email",
        douteOpposition: true,
      },
    });
    const depot = A.creerDepotMemoire();
    const r = await A.orienterCommentaire(
      {
        idEvenement: "ev-doute",
        post: "post-1",
        reseau: "instagram",
        canal: "commentaire",
        mot: "GUIDE",
        commentaire: "GUIDE",
        idContact: "ct_doute3_s4b",
      },
      { env, depot, lireMots: async () => ["GUIDE"] },
    );
    expect(r).not.toMatchObject({ action: "reponse_publique" });
    expect(r).not.toMatchObject({ action: "message_prive" });
  });
});

describe("(6) protections redondantes : chacune a son test", () => {
  const entree = {
    idEvenement: "ev-red",
    reseau: "instagram",
    post: "post-1",
    motif: "mot_inconnu",
    mot: "AUTRE",
    commentaire: "AUTRE",
    reponse: "Merci pour votre commentaire !",
  };
  const env = { A_TRAITER_ENABLED: "1" };
  it("construireCarte : opposee => kit nul", () => {
    const r = A.construireCarte(
      { ...entree, opposee: true },
      "2026-01-01T00:00:00Z",
    );
    expect(r.ok && r.carte.kit).toBeNull();
  });
  it("lireVueATraiter : un dépôt écrit à la main { opposee: true, kit } est lu sans kit", async () => {
    const depot = A.creerDepotMemoire();
    const r = A.construireCarte(entree, "2026-01-01T00:00:00Z");
    if (!r.ok) throw new Error("carte");
    await depot.ecrire([{ ...r.carte, opposee: true, kit: "x" }]);
    expect((await A.lireVueATraiter({ env, depot })).cartes[0].kit).toBeNull();
  });
  it("marquerCarteOpposee : kit nul dans le dépôt", async () => {
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter(entree, { env, depot });
    await A.marquerCarteOpposee("ev-red", { env, depot });
    expect((await depot.lire())[0]).toMatchObject({ opposee: true, kit: null });
  });
});
