/**
 * PR C · un commentaire LinkedIn/TikTok en doute d'opposition (« stop pls ») : déposé par le crochet, puis traité par a-traiter-manuel.
 * Jamais d'opposition inscrite ni d'envoi ; une carte « À traiter » sans texte du commentaire. Données 100 % fictives, aucun réseau.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";
import { VARIABLE_SECRET_EMPREINTE } from "@/domaine/guide-reseau/empreinte-personne";
import type { EvenementFournisseur } from "@/domaine/types";

const opp = vi.hoisted(() => ({ appels: [] as unknown[][] }));
const interrupteur = vi.hoisted(() => ({ simule: false }));
const TEXTES = { mot: "DEMO", reponsePublique: "Merci pour votre message, le guide arrive.", messagePrive: "Bonjour, voici le guide.", relance: null, fin: "Bonne lecture.", etat: "valide", empreinteValidee: null };
vi.mock("@/services/mots-service", async (orig) => ({ ...(await orig<typeof import("@/services/mots-service")>()), chargerTextesFichier: vi.fn(async () => ({ ok: true, textes: TEXTES })) }));
vi.mock("@/services/a-traiter", async (orig) => {
  const m = await orig<typeof import("@/services/a-traiter")>();
  return { ...m, enregistrerATraiter: vi.fn(async (...a: Parameters<typeof m.enregistrerATraiter>) => (interrupteur.simule ? { issue: "simule" as const, raison: "interrupteur_eteint" as const } : m.enregistrerATraiter(...a))) };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/oppositions-mots", async (orig) => {
  const m = await orig<typeof import("@/services/oppositions-mots")>();
  return { ...m, enregistrerOpposition: vi.fn(async (...a: unknown[]) => { opp.appels.push(a); return (m.enregistrerOpposition as any)(...a); }) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");
const { creerDepotParametre } = await import("@/services/a-traiter-depot");
const { extraitLisible } = await import("@/services/a-traiter-types");
const { traiterCommentairesManuels, PARAM_RESEAUX_MANUELS } = await import("@/services/a-traiter-manuel");
const { enregistrerATraiter, marquerCarteFaite, lireVueATraiter } = await import("@/services/a-traiter");
const { copierReponseCarte, copierMessageCarte } = await import("@/services/a-traiter-copie");
const { PARAM_REGISTRE_MOTS, PARAM_VALIDATIONS_MOTS } = await import("@/services/mots-service");
const { PARAM_COMPTES_ZERNIO } = await import("@/services/zernio");
const { empreinteTextes } = await import("@/services/mots-textes");

const SECRET = "secret-fictif-crochet-doute-c";
const SECRET_EMP = "secret-fictif-doute-c-0123456789-abcdefghij";
const T = Date.parse("2026-10-18T10:00:10.000Z");
const ENV = { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET, A_TRAITER_ENABLED: "1" };
const AUTEUR = "auteur-fictif-400";
const AUTRE = "auteur-fictif-401";
const FIXE = "Demande d'arrêt possible : à vérifier, rien n'est proposé";
const TITRE_NOTIF = "À traiter : LinkedIn et TikTok";
const MSG_DOUTE = "Un commentaire LinkedIn ou TikTok contient peut-être une demande d'arrêt. Rien n'a été envoyé ni proposé. À vérifier dans la file À traiter.";
const MSG_SANS_CARTE = "Un commentaire LinkedIn ou TikTok contient peut-être une demande d'arrêt, mais sa carte n'a pas pu être créée. Rien n'a été envoyé. À vérifier dans les commentaires du réseau.";
let n = 0;
const manuel = (plateforme: string, texte: string, c: Record<string, unknown> = {}) => ({
  id: `evt_c_${plateforme}_${++n}`, event: "comment.received", timestamp: "2026-10-18T10:00:00.000Z",
  account: { accountId: "compte-fictif-100", platform: plateforme },
  comment: { id: `com-c-${n}`, platformPostId: "post-plateforme-fictif-200", text: texte, author: { id: AUTEUR }, ...c },
});
const envoyer = (o: unknown) => {
  const corps = Buffer.from(JSON.stringify(o));
  return pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET, corps) }, { env: ENV, maintenantMs: T });
};
const lancer = () => traiterCommentairesManuels({ env: ENV, maintenantMs: T, depot: creerDepotParametre() });
const cartes = () => creerDepotParametre().lire();
const evenements = () => depots().evenementsFournisseurs.lister(() => true);
const notifications = () => depots().notifications.lister((n) => !n.estDemo); // hors exemples du jeu de départ
const PHRASE_STOP = /a demandé l.arrêt/;
let m = 0;
/** Événement « zernio.commentaire_manuel » déposé à la main (même forme que le dépôt du crochet). */
const evt = async (p: string, charge: Record<string, unknown> = {}) => {
  const id = `evt_d_${p}_${++m}`;
  const ev = {
    id: `evf_${id}`, fournisseur: "zernio", idEvenement: id, type: "zernio.commentaire_manuel", recuLe: `2026-01-01T00:00:${String(m).padStart(2, "0")}.000Z`, traite: false,
    charge: { etat: "a_faire", idCommentaire: `com_${id}`, idCompte: p === "tiktok" ? "tt_1" : "li_1", reseau: p === "tiktok" ? "tiktok" : "linkedin_page", repere: "post_1", lienPost: null, idAuteur: AUTEUR, proprio: false, motSeul: null, doute: true, ...charge },
    creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z",
  } as unknown as EvenementFournisseur;
  await depots().evenementsFournisseurs.enregistrer(ev);
  return ev;
};
const guide = (p: string, charge: Record<string, unknown> = {}) => evt(p, { motSeul: "DEMO", doute: undefined, ...charge });
const etatEv = async (id: string) => (await depots().evenementsFournisseurs.lister((e) => e.idEvenement === id))[0];
const poserMot = async () => {
  await Com.ecrireParametre(PARAM_COMPTES_ZERNIO, { lusLe: "2026-01-01T00:00:00.000Z", comptes: [{ id: "tt_1", reseau: "tiktok", nom: "Compte" }, { id: "li_1", reseau: "linkedin", nom: "Compte" }] });
  await Com.ecrireParametre(PARAM_REGISTRE_MOTS, Object.fromEntries(["tt_1", "li_1"].map((c) => [`DEMO|${c}`, { mot: "DEMO", compte: c, etat: "actif", idWorkflow: null, raison: null, modifieLe: "2026-01-01T00:00:00.000Z" }])));
  await Com.ecrireParametre(PARAM_VALIDATIONS_MOTS, { DEMO: empreinteTextes(TEXTES) });
};
const opposee = async () => (await Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { douteBloque: true })).opposee;

beforeEach(async () => {
  reinitialiserDepots();
  opp.appels.length = 0;
  interrupteur.simule = false;
  vi.stubEnv(VARIABLE_SECRET_EMPREINTE, SECRET_EMP);
  for (const f of ["log", "error", "warn", "info"] as const) vi.spyOn(console, f).mockImplementation(() => undefined);
  await poserMot();
  await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe.each(["linkedin", "tiktok"])("%s · doute « stop pls »", (p) => {
  it("C1 · enregistrerOpposition jamais appelé, registre inchangé, événement clos", async () => {
    await envoyer(manuel(p, "stop pls"));
    expect(await evenements()).toHaveLength(1);
    expect(await lancer()).toMatchObject({ actif: true, traites: 1, reportes: 0 });
    expect(opp.appels).toEqual([]);
    expect(await opposee()).toBe(false);
    const [ev] = await evenements();
    expect(ev.traite).toBe(true);
    expect(ev.charge.etat).not.toBe("opposition");
  });
  it("C2 · une carte, sans texte du commentaire, mot null, opposée, extrait fixe (une notification peut l'accompagner)", async () => {
    await envoyer(manuel(p, "stop pls"));
    await lancer();
    const l = await cartes();
    expect(l).toHaveLength(1);
    const c = l[0];
    expect(c).toMatchObject({ mot: null, opposee: true, kit: null, motif: "mot_manuel", message: "indisponible", statut: "a_traiter", reseau: p === "tiktok" ? "tiktok" : "linkedin" });
    expect(extraitLisible(c.extrait)).toBe(FIXE);
    expect(JSON.stringify(l)).not.toContain(AUTEUR); // la carte ne garde que des empreintes opaques
    expect(await notifications()).toHaveLength(1);
  });
  it("C2 · aucun fragment du commentaire (marqueur unique) dans les cartes, événements, notifications et journaux de console", async () => {
    const MARQUEUR = "zorglub77qx";
    await envoyer(manuel(p, `stop pls ${MARQUEUR}`));
    expect((await evenements())[0].charge.doute).toBe(true); // la détection classe bien ce texte en doute
    await lancer();
    expect(await cartes()).toHaveLength(1);
    const consoles = (["log", "error", "warn", "info"] as const).flatMap((f) => (console[f] as any).mock.calls);
    const brut = JSON.stringify({ l: await cartes(), e: await evenements(), n: await notifications(), consoles }).toLowerCase();
    expect(brut).not.toContain(MARQUEUR);
  });
  it("C5 · rejeu du même événement : une seule carte", async () => {
    const x = manuel(p, "stop pls");
    await envoyer(x);
    await envoyer(x);
    await lancer();
    await lancer();
    expect(await cartes()).toHaveLength(1);
  });
  it("C5 · événement relancé à la main (rouvert) : toujours une seule carte", async () => {
    await envoyer(manuel(p, "stop pls"));
    await lancer();
    const [ev] = await evenements();
    await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, etat: "a_faire" } });
    await lancer();
    expect(await cartes()).toHaveLength(1);
  });
  it("C6 · doute du compte propriétaire : rien (ni dépôt, ni carte ; chargé à la main : clos propre compte)", async () => {
    await envoyer(manuel(p, "stop pls", { author: { id: "compte-fictif-100" } }));
    expect(await evenements()).toHaveLength(0);
    await depots().evenementsFournisseurs.enregistrer({
      id: "evf_prop", fournisseur: "zernio", idEvenement: "prop", type: "zernio.commentaire_manuel", recuLe: "2026-01-01T00:00:00.000Z", traite: false,
      charge: { etat: "a_faire", idCommentaire: "c", idCompte: "compte-fictif-100", reseau: p, repere: "post_1", lienPost: null, idAuteur: "compte-fictif-100", proprio: true, motSeul: null, doute: true },
      creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z",
    } as any);
    await lancer();
    expect(await cartes()).toEqual([]);
    expect(opp.appels).toEqual([]);
    expect((await evenements())[0].charge.etat).toBe("propre_compte");
  });
  it("T15 · personne déjà opposée : silence, aucune carte, aucune alerte, état final « personne_opposee »", async () => {
    await Opp.enregistrerOpposition(AUTEUR, Opp.ESPACE_CONTACT_ZERNIO);
    opp.appels.length = 0;
    await envoyer(manuel(p, "stop pls"));
    const [d] = await evenements();
    await lancer();
    expect(await cartes()).toEqual([]);
    expect(opp.appels).toEqual([]);
    expect(await notifications()).toEqual([]);
    expect(await etatEv(d.idEvenement)).toMatchObject({ traite: true, charge: { etat: "personne_opposee", prochainEssaiLe: null } });
    expect(await opposee()).toBe(true); // l'opposition existante est intacte, rien n'est inscrit de plus
  });
  it("C3 · « STOP » clair : inscrit au registre, aucune carte", async () => {
    await envoyer(manuel(p, "STOP"));
    await lancer();
    expect(opp.appels).toHaveLength(1);
    expect(await opposee()).toBe(true);
    expect(await cartes()).toEqual([]);
  });
  it("C4 · un GUIDE manuel : carte comme avant (mot, extrait = le mot, non opposée)", async () => {
    await envoyer(manuel(p, "GUIDE"));
    await lancer();
    const l = await cartes();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ mot: "GUIDE", extrait: "GUIDE", motif: "mot_inconnu" });
    expect(l[0].opposee).toBeUndefined();
    expect(opp.appels).toEqual([]);
  });
});

describe("C7 · aucun schéma persisté nouveau", () => {
  it("MOTIFS inchangé", async () => {
    const t = await import("@/services/a-traiter-types");
    expect([...t.MOTIFS]).toEqual(["echec_envoi", "mot_dans_phrase", "mot_inconnu", "mot_manuel"]);
  });
  it("le fichier des types garde les mêmes réseaux et raisons (aucune énumération ajoutée)", () => {
    const src = readFileSync(new URL("../../src/services/a-traiter-types.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/doute/i);
  });
});

describe.each(["linkedin", "tiktok"])("%s · doute permanent, carte et alerte", (p) => {
  const guideAvecKit = async (idAuteur = AUTEUR) => {
    const ev = await guide(p, { idAuteur });
    await lancer();
    const c = (await cartes()).find((x) => x.idEvenement === ev.idEvenement)!;
    expect(c.kit).toBe(TEXTES.reponsePublique); // préparation : mot actif et textes validés, la carte porte bien un kit
    return c;
  };
  const OPTS = { env: ENV, maintenantMs: T };
  /** Doute dont l'identifiant d'événement est invalide : refus définitif (non réparable). */
  const evtIdInvalide = async () => {
    const d = await evt(p);
    await depots().evenementsFournisseurs.modifier(d.id, { idEvenement: "id invalide" });
    return d;
  };

  it("T1 · doute puis GUIDE de la même personne : une seule carte (le doute), GUIDE clos « doute_opposition », aucun kit", async () => {
    const d = await evt(p);
    await lancer();
    const g = await guide(p);
    await lancer();
    const l = await cartes();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ idEvenement: d.idEvenement, opposee: true, kit: null });
    expect(l.filter((c) => c.kit !== null)).toEqual([]);
    expect(await etatEv(g.idEvenement)).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
  });
  it("T2 · GUIDE avec kit puis doute : la carte GUIDE reste à traiter mais opposée, sans kit ; la copie est refusée", async () => {
    const c = await guideAvecKit();
    await evt(p);
    await lancer();
    const l = await cartes();
    expect(l).toHaveLength(2);
    const g = l.find((x) => x.idEvenement === c.idEvenement)!;
    expect(g).toMatchObject({ statut: "a_traiter", opposee: true, kit: null });
    const depot = creerDepotParametre();
    for (const copier of [copierReponseCarte, copierMessageCarte]) {
      const r = await copier(c.idEvenement, { ...OPTS, depot });
      expect(r.ok).toBe(false);
      expect((r as { phrase: string }).phrase).toMatch(PHRASE_STOP);
    }
  });
  it("T2b · la carte GUIDE d'une autre personne n'est pas touchée", async () => {
    const autre = await guideAvecKit(AUTRE);
    await evt(p);
    await lancer();
    const a = (await cartes()).find((x) => x.idEvenement === autre.idEvenement)!;
    expect(a.kit).toBe(TEXTES.reponsePublique);
    expect(a.opposee).toBeUndefined();
  });
  it("T2c · une carte GUIDE déjà « fait » reste « fait », sans opposee ajouté", async () => {
    const c = await guideAvecKit();
    expect((await marquerCarteFaite(c.idEvenement, { ...OPTS, depot: creerDepotParametre() })).issue).toBe("execute");
    await evt(p);
    await lancer();
    const g = (await cartes()).find((x) => x.idEvenement === c.idEvenement)!;
    expect(g.statut).toBe("fait");
    expect(g.opposee).toBeUndefined();
  });
  it.each(["http://exemple.test/post-1", "https://exemple.test/post 1"])("T3 · refus réparable (lienPost %s) : carte créée sans lien, événement clos « doute_opposition »", async (lien) => {
    const d = await evt(p, { lienPost: lien });
    await lancer();
    const l = await cartes();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ idEvenement: d.idEvenement, lienPost: null, opposee: true, kit: null });
    expect((await etatEv(d.idEvenement)).charge.etat).toBe("doute_opposition");
    expect((await etatEv(d.idEvenement)).traite).toBe(true);
  });
  it("T4 · refus définitif (id_invalide) : aucune carte, UNE notification fixe sans donnée, événement clos « doute_opposition »", async () => {
    await evtIdInvalide();
    expect(await lancer()).toMatchObject({ traites: 1, reportes: 0 });
    expect(await cartes()).toEqual([]);
    const ns = await notifications();
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ type: "echec", titre: TITRE_NOTIF, message: MSG_SANS_CARTE, lien: "/a-traiter" });
    const brut = JSON.stringify(ns);
    for (const interdit of [AUTEUR, "id invalide", "repere", "espace"]) expect(brut).not.toContain(interdit);
    expect(await etatEv("id invalide")).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
  });
  it("T5 · refus définitif et notification en échec : événement REPORTÉ (T + 5 min), non clos", async () => {
    vi.spyOn(depots().notifications, "enregistrer").mockRejectedValue(new Error("panne notification"));
    await evtIdInvalide();
    expect(await lancer()).toMatchObject({ traites: 0, reportes: 1 });
    expect(await cartes()).toEqual([]);
    expect(await etatEv("id invalide")).toMatchObject({ traite: false, charge: { etat: "a_faire", prochainEssaiLe: T + 5 * 60_000 } });
  });
  it("T6 · registre des oppositions illisible : report, aucune carte, aucune notification", async () => {
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, "x");
    const d = await evt(p);
    expect(await lancer()).toMatchObject({ traites: 0, reportes: 1 });
    expect(await cartes()).toEqual([]);
    expect(await notifications()).toEqual([]);
    expect(await etatEv(d.idEvenement)).toMatchObject({ traite: false, charge: { etat: "a_faire", prochainEssaiLe: T + 5 * 60_000 } });
  });
  it("T7 · interrupteur simulé : report, aucune notification, aucune clôture", async () => {
    interrupteur.simule = true;
    const d = await evt(p);
    expect(await lancer()).toMatchObject({ traites: 0, reportes: 1 });
    expect(await notifications()).toEqual([]);
    expect(await cartes()).toEqual([]);
    expect(await etatEv(d.idEvenement)).toMatchObject({ traite: false, charge: { etat: "a_faire" } });
  });
  it("T8 · doute sans identifiant d'auteur : une notification, clôture « doute_opposition » (plus « ecarte »)", async () => {
    const d = await evt(p, { idAuteur: null });
    await lancer();
    expect(await cartes()).toEqual([]);
    const ns = await notifications();
    expect(ns).toHaveLength(1);
    expect(ns[0].message).toBe(MSG_SANS_CARTE);
    expect(await etatEv(d.idEvenement)).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
  });
  it("T9 · course : le doute est inscrit juste après la première lecture du traitement d'un GUIDE : la carte GUIDE finit opposée, sans kit", async () => {
    const g = await guide(p);
    const reel = creerDepotParametre();
    let piege = false;
    const depot = {
      ecrire: reel.ecrire,
      lire: async () => {
        const r = await reel.lire();
        if (!piege) {
          piege = true;
          await enregistrerATraiter(
            { idEvenement: "evt_doute_course", reseau: p === "tiktok" ? "tiktok" : "linkedin", post: "post_1", lienPost: null, mot: null, motif: "mot_manuel", commentaire: "x", reponse: null, opposee: true, idContact: AUTEUR },
            { env: ENV, depot: reel },
          );
        }
        return r;
      },
    };
    await traiterCommentairesManuels({ env: ENV, maintenantMs: T, depot });
    const carte = (await cartes()).find((x) => x.idEvenement === g.idEvenement);
    expect(piege).toBe(true);
    expect(carte).toMatchObject({ opposee: true, kit: null });
  });
  it("T10 · une notification par doute dans le cas normal ; le rejeu ne produit ni carte ni notification de plus", async () => {
    const x = manuel(p, "stop pls");
    await envoyer(x);
    await lancer();
    expect(await notifications()).toHaveLength(1);
    expect((await notifications())[0]).toMatchObject({ titre: TITRE_NOTIF, message: MSG_DOUTE, lien: "/a-traiter" });
    await envoyer(x);
    await lancer();
    expect(await cartes()).toHaveLength(1);
    expect(await notifications()).toHaveLength(1);
  });
  it("T11 · refus définitif post_invalide : carte doute au repère fixe, carte GUIDE antérieure neutralisée, GUIDE ultérieur clos « doute_opposition »", async () => {
    const c = await guideAvecKit();
    const d = await evt(p, { repere: "repere avec espace" });
    expect(await lancer()).toMatchObject({ traites: 1, reportes: 0 });
    const l = await cartes();
    expect(l).toHaveLength(2);
    expect(l.find((x) => x.idEvenement === d.idEvenement)).toMatchObject({ post: "post_inconnu", mot: null, opposee: true, kit: null });
    expect(l.find((x) => x.idEvenement === c.idEvenement)).toMatchObject({ statut: "a_traiter", opposee: true, kit: null });
    expect(await etatEv(d.idEvenement)).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
    const g = await guide(p, { motSeul: "GUIDE" });
    await lancer();
    expect(await cartes()).toHaveLength(2);
    expect(await etatEv(g.idEvenement)).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
  });
  it("T12 · id_invalide (non réparable) : aucune carte doute, cartes GUIDE neutralisées, une alerte, clos « doute_opposition »", async () => {
    const c = await guideAvecKit();
    await evtIdInvalide();
    expect(await lancer()).toMatchObject({ traites: 1, reportes: 0 });
    const l = await cartes();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ idEvenement: c.idEvenement, opposee: true, kit: null });
    const ns = await notifications();
    expect(ns).toHaveLength(1);
    expect(ns[0].message).toBe(MSG_SANS_CARTE);
    expect(await etatEv("id invalide")).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
  });
  it("T13 · branche doute connu : une carte GUIDE restée non opposée est neutralisée au passage suivant", async () => {
    const c = await guideAvecKit();
    // Le doute est inscrit sans neutralisation (panne simulée de la revérification).
    await enregistrerATraiter(
      { idEvenement: "evt_doute_sans_neutralisation", reseau: p === "tiktok" ? "tiktok" : "linkedin", post: "post_1", lienPost: null, mot: null, motif: "mot_manuel", commentaire: "x", reponse: null, opposee: true, idContact: AUTEUR },
      { env: ENV, depot: creerDepotParametre() },
    );
    expect((await cartes()).find((x) => x.idEvenement === c.idEvenement)!.kit).toBe(TEXTES.reponsePublique);
    const g = await guide(p, { motSeul: "GUIDE" });
    await lancer();
    expect((await cartes()).find((x) => x.idEvenement === c.idEvenement)).toMatchObject({ opposee: true, kit: null });
    expect(await cartes()).toHaveLength(2);
    expect(await etatEv(g.idEvenement)).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
  });
  it("T14 · alerte en échec alors que la carte est écrite : événement reporté, pas clos ; alerte rétablie : clos", async () => {
    const espion = vi.spyOn(depots().notifications, "enregistrer").mockRejectedValue(new Error("panne notification"));
    const d = await evt(p);
    expect(await lancer()).toMatchObject({ traites: 0, reportes: 1 });
    expect(await cartes()).toHaveLength(1);
    expect(await etatEv(d.idEvenement)).toMatchObject({ traite: false, charge: { etat: "a_faire", prochainEssaiLe: T + 5 * 60_000 } });
    espion.mockRestore();
    expect(await traiterCommentairesManuels({ env: ENV, maintenantMs: T + 6 * 60_000, depot: creerDepotParametre() })).toMatchObject({ traites: 1, reportes: 0 });
    expect(await cartes()).toHaveLength(1);
    expect(await notifications()).toHaveLength(1);
    expect(await etatEv(d.idEvenement)).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
  });
  it("T18 · réseau inconnu en doute : cartes de la personne neutralisées (comme le refus définitif), une alerte, clos « doute_opposition »", async () => {
    const c = await guideAvecKit();
    const d = await evt(p, { reseau: "facebook" });
    expect(await lancer()).toMatchObject({ traites: 1, reportes: 0 });
    expect((await cartes()).find((x) => x.idEvenement === c.idEvenement)).toMatchObject({ opposee: true, kit: null, statut: "a_traiter" });
    expect(await cartes()).toHaveLength(1); // aucune carte de doute possible sur ce réseau
    expect((await notifications()).map((n) => n.message)).toEqual([MSG_SANS_CARTE]);
    expect(await etatEv(d.idEvenement)).toMatchObject({ traite: true, charge: { etat: "doute_opposition" } });
  });
  it("T19 · la carte doute passe avant les autres cartes à traiter, même plus anciennes", async () => {
    const autre = await guide(p, { idAuteur: AUTRE });
    await lancer(); // carte GUIDE d'une autre personne, créée en premier
    const d = await evt(p);
    await lancer();
    const vue = await lireVueATraiter({ env: ENV, depot: creerDepotParametre() });
    expect(vue.cartes.map((x) => x.idEvenement)).toEqual([d.idEvenement, autre.idEvenement]);
    expect(vue.cartes[0].opposee).toBe(true);
    expect(vue.cartes[1].opposee).toBeUndefined();
  });
  it("T20 · constat : un stop clair noyé dans un texte de plus de 200 caractères n'est pas perdu : doute, carte opposée et alerte (jamais ignoré)", async () => {
    await envoyer(manuel(p, `stop ${"merci pour tout ".repeat(20)}`));
    await lancer();
    const cs = await cartes();
    expect(cs).toHaveLength(1);
    expect(extraitLisible(cs[0].extrait)).toBe(FIXE);
    expect(cs[0]).toMatchObject({ opposee: true, mot: null });
    expect((await notifications()).map((n) => n.message)).toEqual([MSG_DOUTE]);
    expect(opp.appels).toEqual([]); // le stop n'est pas inscrit tout seul : décision laissée au fondateur
  });
  it.todo("E5 · borne sur le nombre d'alertes pour une même personne en doute (aujourd'hui : une alerte par événement de doute, le rejeu d'un même événement n'en ajoute pas) : choix de conception, ESCALADE");
  it("T16 · une carte GUIDE ordinaire au repère invalide reste close « refuse » (comportement figé)", async () => {
    const g = await guide(p, { repere: "repere avec espace" });
    await lancer();
    expect(await cartes()).toEqual([]);
    expect(await notifications()).toEqual([]);
    expect(await etatEv(g.idEvenement)).toMatchObject({ traite: true, charge: { etat: "refuse" } });
  });
  it("T17 · course : la carte GUIDE existe déjà (deja_present) et un doute est inscrit : la revérification côté GUIDE neutralise aussi", async () => {
    const c = await guideAvecKit();
    await enregistrerATraiter(
      { idEvenement: "evt_doute_sans_neutralisation", reseau: p === "tiktok" ? "tiktok" : "linkedin", post: "post_1", lienPost: null, mot: null, motif: "mot_manuel", commentaire: "x", reponse: null, opposee: true, idContact: AUTEUR },
      { env: ENV, depot: creerDepotParametre() },
    );
    // L'événement GUIDE est rejoué : la première lecture (concurrente) ne voit encore ni sa carte ni le doute ; l'écriture trouve la carte (deja_present).
    const ev = (await evenements()).find((e) => e.idEvenement === c.idEvenement)!;
    await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, etat: "a_faire", prochainEssaiLe: null } });
    const reel = creerDepotParametre();
    let premiere = true;
    const depot = { ecrire: reel.ecrire, lire: async () => (premiere ? ((premiere = false), []) : reel.lire()) };
    await traiterCommentairesManuels({ env: ENV, maintenantMs: T, depot });
    expect(premiere).toBe(false);
    expect((await cartes()).find((x) => x.idEvenement === c.idEvenement)).toMatchObject({ opposee: true, kit: null });
    expect(await cartes()).toHaveLength(2);
  });
});
