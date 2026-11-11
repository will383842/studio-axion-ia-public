/**
 * Parcours « mot » v2 (décision du 03/11/2026) : textes v2 versionnés, jamais de question d'accord, jamais de STOP dans les textes,
 * champ « accord » retiré du contrat envoyé au site (l'absence est acceptée), « stop » / « arrêtez » écrit par la personne = silence,
 * personne déjà opposée = aucune réponse, aucun guide, mot inconnu = GUIDE. Aucun réseau, adresses en .test.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { corpsDemandeGuide, runValide, signatureZernio, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import { decisionPourMot } from "@/domaine/guide-reseau/decision-mot";
import { TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import { SchemaDemandeGuideReseau } from "./aides/contrat-site-guides-reseau";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const G = await import("@/services/mots-graphe");
const C = await import("@/services/mots-controle");
const T = await import("@/services/mots-textes");
const Opp = await import("@/services/oppositions-mots");

const J = (...p: string[]) => p.join("");
const MENTION = "Message automatique envoyé par Axion IA.";
const IDS = ["mp-m1-v2", "mp-m1-v3", "mp-m1-v4-1", "mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4", "mp-adresse-refusee-v3-1", "mp-adresse-refusee-v3-2", "mp-adresse-refusee-v3-3", "mp-m1-v2-a", "mp-m1-v2-b", "mp-m1-v2-c", "mp-m1-v2-d", "mp-m1-v2-e", "mp-recu-v2", "mp-m2-v1", "mp-adresse-refusee-v2", "mp-merci-v1", "mp-lien-v2", "mp-pub-igfb-v1", "mp-pub-linkedin-v1", "mp-pub-tiktok-v1"] as const;
/** Anciens textes (encore au dictionnaire, statut « actif » ou « retire ») qui portent la mention d'ouverture. Les nouveaux n'en portent aucune. */
const AVEC_MENTION = ["mp-m1-v2", "mp-m1-v2-a", "mp-m1-v2-b", "mp-m1-v2-c", "mp-m1-v2-d", "mp-m1-v2-e", "mp-recu-v2", "mp-m2-v1", "mp-adresse-refusee-v2", "mp-lien-v2"] as const;

describe("textes v2 : registre versionné", () => {
  it("les anciens textes gardés (actifs jusqu'au lot B, ou retirés) portent encore la mention ; elle n'est plus au dictionnaire", () => {
    for (const id of AVEC_MENTION) expect(TEXTES_MP[id].texte.startsWith(`${MENTION} `), id).toBe(true);
    for (const id of IDS) if (!(AVEC_MENTION as readonly string[]).includes(id)) expect(TEXTES_MP[id as keyof typeof TEXTES_MP].texte, id).not.toMatch(/message automatique/i);
    expect(JSON.parse(readFileSync(new URL("../../contrats/dictionnaire-textes-mp.v2.json", import.meta.url), "utf8"))).not.toHaveProperty("mention_ouverture");
  });
  it("le merci ne porte PAS la mention d'ouverture (ton personnel, sans signature)", () => {
    expect(TEXTES_MP["mp-merci-v1"].texte).not.toMatch(/message automatique/i);
  });
  it("mp-m1-v3 : texte exact validé, sans la mention ni signature", () => {
    expect(TEXTES_MP["mp-m1-v3"].texte).toBe("Bonjour ! Merci pour votre commentaire, ça fait plaisir. Comme promis, voici votre guide « [TITRE DU GUIDE] ». Le lien reste ouvert 48 heures : [LIEN]");
    expect(TEXTES_MP["mp-m1-v3"].texte).not.toMatch(/Message automatique/);
  });
  it("tous les identifiants validés existent, avec leur version dans l'identifiant", () => {
    expect(Object.keys(TEXTES_MP).sort()).toEqual([...IDS].sort());
    for (const id of IDS) expect(TEXTES_MP[id].version).toBe(id);
  });
  it("textes exacts (mp-m1-v2, mp-recu-v2, mp-m2-v1, mp-lien-v2, réponses publiques)", () => {
    expect(TEXTES_MP["mp-m1-v2"].texte).toBe(`${MENTION} Merci pour votre commentaire « [MOT] ». Pour vous envoyer le guide « [TITRE DU GUIDE] » par e-mail, répondez à ce message avec votre adresse e-mail.`);
    expect(TEXTES_MP["mp-recu-v2"].texte).toBe(`${MENTION} Merci ! Le guide « [TITRE DU GUIDE] » part à votre adresse dans quelques minutes. Pensez à regarder aussi vos courriers indésirables. Bonne lecture !`);
    expect(TEXTES_MP["mp-m2-v1"].texte).toBe(`${MENTION} Je n'ai pas reconnu d'adresse e-mail dans votre message. Pouvez-vous l'écrire à nouveau, par exemple adresse@entreprise.fr ? Vous préférez ne pas donner d'adresse ? Touchez « Recevoir ici ».`);
    expect(TEXTES_MP["mp-lien-v2"].texte).toBe(`${MENTION} Voici le guide « [TITRE DU GUIDE] » : [LIEN]. Bonne lecture !`);
    expect(TEXTES_MP["mp-pub-igfb-v1"].texte).toBe("Merci pour votre commentaire ! Je vous écris en message privé pour vous envoyer le guide. Si vous ne voyez rien, regardez vos demandes de messages.");
    for (const id of ["mp-pub-linkedin-v1", "mp-pub-tiktok-v1"] as const) expect(TEXTES_MP[id].texte).toBe("Merci pour votre commentaire ! Le guide « [TITRE DU GUIDE] » est disponible ici : [LIEN]. Si le lien ne s'ouvre pas, dites-le-nous en réponse et nous trouverons une autre solution.");
  });
  it("aucune question d'accord, aucun STOP, aucun prix, jamais le nom de la ville interdite, « vous » partout", () => {
    for (const id of IDS) {
      const t = TEXTES_MP[id].texte;
      expect(t, id).not.toMatch(/\bstop\b/i);
      expect(t, id).not.toMatch(/voulez-vous|souhaitez-vous|d'autres informations|conseils par e-mail|\boui\b|\bnon\b/i);
      expect(t, id).not.toMatch(/€|\beuros?\b|\bprix\b|\btarifs?\b/i);
      expect(t.toLowerCase(), id).not.toContain(J("gren", "oble"));
      expect(t, id).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
    }
  });
  it("le dictionnaire de textes est une copie à empreinte figée", () => {
    const brut = readFileSync(new URL("../../contrats/dictionnaire-textes-mp.v2.json", import.meta.url));
    expect(createHash("sha256").update(brut).digest("hex")).toBe("4fe58fd79d150c5f99d04b2f7a98e5129db2016b4c4426bfc5630f0bf703d25a");
    const d = JSON.parse(brut.toString("utf8")) as { textes: Record<string, { texte: string }> };
    for (const id of IDS) expect(d.textes[id].texte).toBe(TEXTES_MP[id].texte);
    expect(JSON.stringify(d)).not.toMatch(/\bstop\b/i);
  });
  it("le rendu remplace les marqueurs et refuse un marqueur resté vide", () => {
    expect(rendreTexteMp("mp-lien-v2", { titre: "Guide IA", lien: "https://exemple.test/g" })).toBe(`${MENTION} Voici le guide « Guide IA » : https://exemple.test/g. Bonne lecture !`);
    expect(rendreTexteMp("mp-m1-v2", { titre: "Guide IA" })).toBeNull();
  });
});

describe("contrôle de sortie v2", () => {
  const base = { mot: "GUIDE", reponsePublique: TEXTES_MP["mp-pub-igfb-v1"].texte, messagePrive: TEXTES_MP["mp-merci-v1"].texte, relance: null, fin: TEXTES_MP["mp-adresse-refusee-v3-1"].texte, etat: "brouillon" as const, empreinteValidee: null };
  it("les nouveaux textes passent le contrôle ; les anciens textes à mention sont refusés comme texte de mot", () => {
    expect(C.controlerTextesMot(base)).toEqual([]);
    expect(C.controlerTextesMot({ ...base, messagePrive: TEXTES_MP["mp-m1-v2"].texte }).map((r) => r.code)).toContain("mention_automatique");
  });
  it("une mention « Message automatique » en ouverture est refusée, dans chaque section ; une signature en fin aussi", () => {
    for (const s of T.SECTIONS) {
      expect(C.controlerTexteSortant(s, `${MENTION} Votre adresse ?`).map((r) => r.code), s).toContain("mention_automatique");
      expect(C.controlerTexteSortant(s, "message  AUTOMATIQUE, votre adresse ?").map((r) => r.code), s).toContain("mention_automatique");
      for (const sig of ["Merci pour votre message. L'équipe Axion IA", "Merci pour votre message. Cordialement", "Merci pour votre message. Axion IA."]) expect(C.controlerTexteSortant(s, sig).map((r) => r.code), `${s} ${sig}`).toContain("signature");
    }
    expect(C.controlerTexteSortant("message_prive", "Bonjour, votre adresse ?")).toEqual([]);
  });
  it("toute mention STOP et toute question d'accord sont refusées, dans chaque section", () => {
    for (const s of T.SECTIONS) {
      expect(C.controlerTexteSortant(s, `${MENTION} Écrivez ${J("ST", "OP")} pour arrêter.`).map((r) => r.code), s).toContain("mention_stop");
      expect(C.controlerTexteSortant(s, `${MENTION} Voulez-vous recevoir d'autres informations ? Répondez oui ou non.`).map((r) => r.code), s).toContain("question_accord");
    }
  });
});

describe("contrat envoyé au site : plus de champ « accord »", () => {
  const RUN: RunLu = { email: "lecteur-fictif@example.test", mot: "guide", reseau: "instagram", guide: "guide-ia", versionTexteM1: "mp-m1-v2" };
  it("un run sans accord est valide, le corps n'a ni accord ni versionTexteM2, ordre des clés fixe", () => {
    expect(runValide(RUN)).toBe(true);
    const corps = corpsDemandeGuide(RUN, "run_exemple_0001");
    expect(Object.keys(JSON.parse(corps))).toEqual(["schemaVersion", "cleIdempotence", "email", "mot", "reseau", "guide", "versionTexteM1", "locale"]);
    expect(corps).toBe(corpsDemandeGuide({ ...RUN }, "run_exemple_0001"));
  });
  it("même un run relu qui porte encore un ancien accord n'envoie rien de tel (rétro-compatibilité)", () => {
    const ancien = { ...RUN, accord: "oui", versionTexteM2: "m2-v1" } as unknown as RunLu;
    expect(runValide(ancien)).toBe(true);
    const o = JSON.parse(corpsDemandeGuide(ancien, "run_exemple_0001"));
    expect(o).not.toHaveProperty("accord");
    expect(o).not.toHaveProperty("versionTexteM2");
  });
  it("le schéma du site (copie) accepte l'absence d'accord", () => {
    expect(SchemaDemandeGuideReseau.safeParse(JSON.parse(corpsDemandeGuide(RUN, "run_exemple_0001"))).success).toBe(true);
  });
});

describe("aiguillage v2", () => {
  const LISTE = ["GUIDE", "DEVIS"];
  const e = { reseau: "instagram", canal: "commentaire" as const, mots: LISTE };
  it("mot inconnu : reçoit GUIDE (jamais « À traiter »), mot retenu indiqué", () => {
    expect(decisionPourMot({ ...e, mot: "ZORG" })).toEqual({ action: "reponse_publique", motRetenu: "GUIDE" });
    expect(decisionPourMot({ ...e, mot: "ZORG", canal: "message_prive" })).toEqual({ action: "message_prive", motRetenu: "GUIDE" });
    expect(decisionPourMot({ ...e, mot: "guide" })).toEqual({ action: "reponse_publique", motRetenu: "GUIDE" });
  });
  it("sans mot GUIDE configuré ou liste illisible : À traiter, rien d'envoyé", () => {
    expect(decisionPourMot({ ...e, mot: "ZORG", mots: ["DEVIS"] })).toEqual({ action: "a_traiter", motif: "mot_inconnu" });
    expect(decisionPourMot({ ...e, mot: "GUIDE", mots: null })).toEqual({ action: "a_traiter", motif: "mot_inconnu" });
  });
  it("personne opposée, ou commentaire « stop » / « arrêtez » : silence", () => {
    expect(decisionPourMot({ ...e, mot: "GUIDE", opposee: true })).toEqual({ action: "silence", motif: "personne_opposee" });
    for (const m of ["stop", "Arrêtez", "ARRETEZ"]) expect(decisionPourMot({ ...e, mot: m })).toEqual({ action: "silence", motif: "opposition" });
  });
});

describe("service d'aiguillage v2", () => {
  it("personne opposée : silence, aucune carte ; mot inconnu : GUIDE", async () => {
    const A = await import("@/services/a-traiter");
    reinitialiserDepots();
    await Opp.enregistrerOpposition("ct_opp_service");
    const depot = A.creerDepotMemoire();
    const o = { env: { A_TRAITER_ENABLED: "1" }, depot, lireMots: async () => ["GUIDE"] };
    const base = { idEvenement: "ev-s1", post: "post-1", reseau: "instagram" as const, canal: "commentaire" as const, commentaire: "GUIDE", mot: "GUIDE" };
    expect(await A.orienterCommentaire({ ...base, idContact: "ct_opp_service" }, o)).toEqual({ issue: "execute", action: "silence", raison: "personne_opposee" });
    expect(await A.orienterCommentaire({ ...base, idEvenement: "ev-s2", mot: "arrêtez", commentaire: "arrêtez" }, o)).toEqual({ issue: "execute", action: "silence", raison: "opposition" });
    expect(await A.orienterCommentaire({ ...base, idEvenement: "ev-s3", mot: "ZORG", commentaire: "ZORG" }, o)).toMatchObject({ action: "reponse_publique", motRetenu: "GUIDE" });
    expect(await depot.lire()).toEqual([]);
  });
});

describe("« stop » / « arrêtez » écrit par la personne", () => {
  it("reconnu (mot seul), sans texte sortant", () => {
    for (const t of ["stop", "STOP.", "Arrêtez", "arretez !", "arrêt"]) expect(G.estMotOpposition(t), t).toBe(true);
    for (const t of ["arrêtez tout svp"]) expect(G.estMotOpposition(t), t).toBe(true); // phrase : reconnue (STU-STOP)
    for (const t of ["guide", "", "stop ne pas"]) expect(G.estMotOpposition(t), t).toBe(false);
    const w = G.construireGrapheStop();
    expect(w.etapes.map((x) => x.type)).toEqual(["mettre_a_l_ecart", "alerter_operateur"]);
    expect(JSON.stringify(w)).not.toMatch(/"texte"/);
  });
  it("le graphe d'un mot ne contient aucune relance ni question d'accord, et l'opposée reste en silence", () => {
    const t = T.validerTextes(T.textesDepuisSaisie({ mot: "GUIDE", reponsePublique: TEXTES_MP["mp-pub-igfb-v1"].texte, messagePrive: TEXTES_MP["mp-merci-v1"].texte, relance: null, fin: TEXTES_MP["mp-adresse-refusee-v3-1"].texte }));
    const g = G.construireGrapheMot(t);
    expect(g.ok && g.workflow.siPersonneOpposee).toBe("silence");
    expect(g.ok && g.workflow.etapes.some((x) => x.type === "relancer")).toBe(false);
  });
});

describe("outbox : personne opposée = aucune réponse, aucun guide ; plus de champ accord", () => {
  const T0 = 1_760_781_600_000;
  const SECRET = "secret-fictif-crochet-mp-v2";
  const ENV = { PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET, SITE_VIDEOS_URL: "https://site.exemple", SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-mp-v2-0123456789abc" };
  const RUN: RunLu = { email: "lecteur-fictif@example.test", mot: "guide", reseau: "instagram", guide: "guide-ia", versionTexteM1: "mp-m1-v2" };
  beforeEach(() => {
    reinitialiserDepots();
    pm.reinitialiserGardesParcours();
    for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    pm.injecterLecteurRuns(null);
    pm.injecterTransportSite(null);
  });
  async function deposer(idEv: string, idContact: string, mot = "GUIDE") {
    const corps = Buffer.from(JSON.stringify({ id: idEv, event: "workflow.run.completed", timestamp: new Date(T0).toISOString(), execution: { id: `run_${idEv}_0001`, status: "completed" }, contact: { id: idContact }, trigger: { type: "keyword", text: mot } }));
    await pm.recevoirCrochetZernio({ corps, idEvenement: idEv, signature: signatureZernio(SECRET, corps) }, { env: ENV, maintenantMs: T0 });
  }
  function brancher() {
    const vus: RequeteSignee[] = [];
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    pm.injecterTransportSite(async (r) => (vus.push(r), { statut: 200, corps: {} }));
    return vus;
  }
  it("envoi normal : aucun accord dans le corps ni dans l'événement conservé", async () => {
    await deposer("evt_mp_1", "ct_normal");
    const vus = brancher();
    expect(await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 })).toMatchObject({ envoyes: 1 });
    expect(JSON.parse(vus[0].corps)).not.toHaveProperty("accord");
    const [ev] = await depots().evenementsFournisseurs.lister((x) => x.idEvenement === "evt_mp_1");
    expect(ev.charge).not.toHaveProperty("accord");
  });
  it("personne déjà opposée : ni lecture, ni appel au site ; l'événement est conservé, mis de côté", async () => {
    await Opp.enregistrerOpposition("ct_opposee");
    expect(await Opp.personneOpposee("ct_opposee")).toBe(true);
    expect(await Opp.personneOpposee("ct_autre")).toBe(false);
    await deposer("evt_mp_2", "ct_opposee");
    const vus = brancher();
    const rap = await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 });
    expect(vus).toHaveLength(0);
    expect(rap).toMatchObject({ envoyes: 0, ecartes: 1 });
    const evts = await depots().evenementsFournisseurs.lister((x) => x.idEvenement === "evt_mp_2");
    expect(evts).toHaveLength(1); // rien n'est supprimé
    expect(evts[0]).toMatchObject({ traite: true, charge: { etat: "ecarte" } });
  });
  it("un événement « stop » n'est jamais envoyé comme demande de guide (il reste à la prise en compte de l'opposition)", async () => {
    await deposer("evt_mp_3", "ct_stop", "stop");
    const vus = brancher();
    await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 });
    expect(vus).toHaveLength(0);
    const [ev] = await depots().evenementsFournisseurs.lister((x) => x.idEvenement === "evt_mp_3");
    expect(ev.traite).toBe(false);
  });
});

describe("corrections de revue : lecture du registre en panne, « stop » commenté, interrupteur des « stop »", () => {
  const T0 = 1_760_781_600_000;
  const SECRET = "secret-fictif-crochet-mp-v2";
  const ENV = { PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET, SITE_VIDEOS_URL: "https://site.exemple", SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-mp-v2-0123456789abc" };
  const RUN: RunLu = { email: "lecteur-fictif@example.test", mot: "guide", reseau: "instagram", guide: "guide-ia", versionTexteM1: "mp-m1-v2" };
  beforeEach(() => {
    reinitialiserDepots();
    pm.reinitialiserGardesParcours();
    for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    pm.injecterLecteurRuns(null);
    pm.injecterTransportSite(null);
  });
  const panneRegistre = () => vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base indisponible"));

  it("lecture du registre en panne : la fonction signale l'erreur, elle ne répond jamais « opposée »", async () => {
    panneRegistre();
    await expect(Opp.personneOpposee("ct_panne")).rejects.toThrow();
  });
  it("outbox : lecture du registre en panne = nouvel essai (non traité, backoff), puis envoi une fois la base revenue", async () => {
    const corps = Buffer.from(JSON.stringify({ id: "evt_panne", event: "workflow.run.completed", timestamp: new Date(T0).toISOString(), execution: { id: "run_evt_panne_0001", status: "completed" }, contact: { id: "ct_panne" }, trigger: { type: "keyword", text: "GUIDE" } }));
    await pm.recevoirCrochetZernio({ corps, idEvenement: "evt_panne", signature: signatureZernio(SECRET, corps) }, { env: ENV, maintenantMs: T0 });
    const vus: RequeteSignee[] = [];
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    pm.injecterTransportSite(async (r) => (vus.push(r), { statut: 200, corps: {} }));
    const espion = panneRegistre();
    const rap = await pm.traiterOutboxZernio({ env: ENV, maintenantMs: T0 });
    expect(rap).toMatchObject({ envoyes: 0, ecartes: 0, aReessayer: 1 });
    expect(vus).toHaveLength(0);
    const [ev] = await depots().evenementsFournisseurs.lister((x) => x.idEvenement === "evt_panne");
    expect(ev.traite).toBe(false);
    expect(ev.charge.etat).toBe("a_reessayer");
    expect(Number(ev.charge.prochainEssaiLe)).toBeGreaterThan(T0);
    espion.mockRestore();
    expect(await pm.traiterOutboxZernio({ env: ENV, maintenantMs: Number(ev.charge.prochainEssaiLe) + 1 })).toMatchObject({ envoyes: 1 });
    expect(vus).toHaveLength(1);
  });
  it("« stop » / « arrêtez » commenté : la personne est mise à l'écart, un GUIDE commenté plus tard reste sans réponse", async () => {
    const A = await import("@/services/a-traiter");
    const depot = A.creerDepotMemoire();
    const o = { env: { A_TRAITER_ENABLED: "1" }, depot, lireMots: async () => ["GUIDE"] };
    const base = { idEvenement: "ev-c1", post: "post-1", reseau: "instagram" as const, canal: "commentaire" as const, idContact: "ct_commente" };
    expect(await A.orienterCommentaire({ ...base, mot: "stop", commentaire: "stop" }, o)).toEqual({ issue: "execute", action: "silence", raison: "opposition" });
    expect(await Opp.personneOpposee("ct_commente")).toBe(true);
    expect(await A.orienterCommentaire({ ...base, idEvenement: "ev-c2", mot: "GUIDE", commentaire: "GUIDE" }, o)).toEqual({ issue: "execute", action: "silence", raison: "personne_opposee" });
    expect(await depot.lire()).toEqual([]);
    // sans identifiant de contact : silence, rien à enregistrer, pas d'erreur
    expect(await A.orienterCommentaire({ ...base, idEvenement: "ev-c3", idContact: null, mot: "arrêtez", commentaire: "arrêtez" }, o)).toMatchObject({ action: "silence" });
  });
  it("aiguillage : registre en panne + « stop » = opposition enregistrée, silence, aucun envoi", async () => {
    const A = await import("@/services/a-traiter");
    const depot = A.creerDepotMemoire();
    const o = { env: { A_TRAITER_ENABLED: "1" }, depot, lireMots: async () => ["GUIDE"] };
    const base = { idEvenement: "ev-p1", post: "post-1", reseau: "instagram" as const, canal: "commentaire" as const, idContact: "ct_stop_panne" };
    const espion = vi.spyOn(depots().parametres, "obtenir").mockRejectedValueOnce(new Error("base indisponible")); // seule la première lecture échoue
    expect(await A.orienterCommentaire({ ...base, mot: "stop", commentaire: "stop" }, o)).toEqual({ issue: "execute", action: "silence", raison: "opposition" });
    espion.mockRestore();
    expect(await Opp.personneOpposee("ct_stop_panne")).toBe(true);
    expect(await depot.lire()).toEqual([]);
  });
  it("aiguillage : registre en panne + GUIDE = nouvel essai, ni silence définitif, ni envoi, ni carte", async () => {
    const A = await import("@/services/a-traiter");
    const depot = A.creerDepotMemoire();
    const o = { env: { A_TRAITER_ENABLED: "1" }, depot, lireMots: async () => ["GUIDE"] };
    const base = { idEvenement: "ev-p2", post: "post-1", reseau: "instagram" as const, canal: "commentaire" as const, idContact: "ct_guide_panne" };
    const espion = panneRegistre();
    expect(await A.orienterCommentaire({ ...base, mot: "GUIDE", commentaire: "GUIDE" }, o)).toEqual({ issue: "reessai", raison: "registre_illisible" });
    espion.mockRestore();
    expect(await Opp.personneOpposee("ct_guide_panne")).toBe(false);
    expect(await depot.lire()).toEqual([]);
    expect(await A.orienterCommentaire({ ...base, mot: "GUIDE", commentaire: "GUIDE" }, o)).toMatchObject({ action: "reponse_publique", motRetenu: "GUIDE" });
  });
  it("« stop » : pris en compte dès que PARCOURS_MOT_ENABLED est allumé, même si MOTS_ENABLED est éteint ; rien d'allumé si les deux le sont", async () => {
    const S = await import("@/services/mots-service");
    const corps = Buffer.from(JSON.stringify({ id: "evt_stop", event: "workflow.run.completed", timestamp: new Date(T0).toISOString(), execution: { id: "run_evt_stop_0001", status: "completed" }, contact: { id: "ct_stop2" }, trigger: { type: "keyword", text: "stop" } }));
    await pm.recevoirCrochetZernio({ corps, idEvenement: "evt_stop", signature: signatureZernio(SECRET, corps) }, { env: ENV, maintenantMs: T0 });
    expect(await S.traiterOppositions({ env: {} })).toEqual({ actif: false, prises: 0, transmises: 0 });
    expect(await Opp.personneOpposee("ct_stop2")).toBe(false);
    expect(await S.traiterOppositions({ env: { PARCOURS_MOT_ENABLED: "1", STUDIO_EMPREINTE_SECRET: "secret-fictif-de-test-empreinte-0123456789" } })).toMatchObject({ actif: true, prises: 1 });
    expect(await Opp.personneOpposee("ct_stop2")).toBe(true);
    expect(S.motsActif({ PARCOURS_MOT_ENABLED: "1" })).toBe(false); // l'interrupteur MOTS_ENABLED n'est pas allumé pour autant
  });
});
