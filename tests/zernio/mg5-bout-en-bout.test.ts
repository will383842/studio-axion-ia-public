/**
 * MG-5 · répétition générale AUTOMATISÉE du mot GUIDE sur Facebook, de bout en bout.
 * Aucun fichier de production touché. Faux port Zernio, faux site et faux catalogue (aides existantes), données 100 % fictives, aucun réseau.
 * Réglages comme en production : tout est ÉTEINT, sauf ce que le scénario exige et que le test allume EXPLICITEMENT (voir `allumer…`).
 * Rien n'est modifié dans le code de production : un vrai défaut serait écrit en `it.fails`, avec un commentaire.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";
import { TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { CHEMIN_OPPOSITIONS_PAR_CONV } from "@/domaine/guide-reseau/oppositions-par-conv-contrat";
import { SECRET_EMPREINTE, cleConversation, deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { CHEMIN_GUIDE } from "./aides/oppositions";
import {
  ADRESSE, AUTEUR, banc, C, Com, COMPTE, crochetCommentaire, depots, ENV, envoisSortants, graineConv, lireTexteDe, MS, nettoyer, Opp, passer, pm,
  preparer, T0, TITRE, toutesLesConversations, Z,
} from "./filet-guide/_amorce";

// Le site réel n'accepte pas encore les formulations avec lien : le FAUX site de ces tests en accepte une liste (même procédé que les tests LIA / Z3a).
const site = vi.hoisted(() => ({
  versions: new Set<string>(["mp-m1-v4-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"]),
  catalogue: null as unknown,
}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
// Faux catalogue du site (aucun réseau). `null` = catalogue indisponible : GUIDE reste servi par `guide-ia`, comme en production.
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => site.catalogue }));

const OT = await import("@/services/oppositions-transmission");
const IMP = await import("@/services/oppositions-import-site");
const { PARAM_MOTS_MULTIPLES } = await import("@/services/parcours-mots-multiples");
const { PARAM_RESEAUX_MANUELS, traiterCommentairesManuels } = await import("@/services/a-traiter-manuel");
const { creerDepotParametre } = await import("@/services/a-traiter-depot");
const { lireStatsMots, reinitialiserCacheStatsMots } = await import("@/services/stats-mots");
const { PLAFOND_MP_PERSONNE_JOUR } = await import("@/services/parcours-dossier");

const H = 3600_000;
const HEURE = Math.floor(T0 / H) * H;
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
/** Réglages de production : parcours allumé (c'est ce qu'on répète) ; TOUT le reste éteint (merci, réduction des identifiants, import des oppositions du site, À traiter). */
const ENV_PROD = { ...ENV };
/** Le lien signé dans le premier message est une option allumée explicitement. */
const ENV_LIEN = { ...ENV_PROD, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
/** Formulations validées sur /mots (une seule par groupe). */
const FORMULATIONS = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"];
const SANS_DEJA_ENVOYE = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-lien-v3-1"];
const COMPTE_TIKTOK = "compte-tiktok-fictif-1";
const COMPTE_LINKEDIN = "compte-linkedin-fictif-1";
const A2 = "auteur-fictif-401";

/** Allume explicitement le réglage « plusieurs mots pour une même personne » (éteint en production tant que l'essai n'est pas validé). */
const allumerMotsMultiples = () => Com.ecrireParametre(PARAM_MOTS_MULTIPLES, true);
const registreMots = async (...mots: Array<[string, string]>) => {
  const reg: Record<string, unknown> = {};
  for (const [mot, compte] of mots) reg[`${mot}|${compte}`] = { mot, compte, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};
const demandesGuide = () => banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE);
const lien = (texte: string) => /https:\/\/axion-ia\.com\/guide-reseau\?j=[A-Za-z0-9_.-]+/.exec(texte)?.[0];
const etatPersonne = async (id: string = AUTEUR) => (await toutesLesConversations())[cleConversation(id)];
const dossierDe = async (id: string) => Object.entries(await toutesLesConversations()).filter(([k]) => k.startsWith(`${cleConversation(id)}|`)).map(([, v]) => v as any);
const instantane = () => ({ pub: banc.port.pub.length, prive: banc.port.prive.length, envoyes: banc.port.envoyes.length, site: demandesGuide().length });
const lignesOpposition = () => Com.lireParametre<any[]>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const cartes = () => creerDepotParametre().lire();
const decrire = async (id: string) => {
  const e = await evenement(depots, id);
  return `${e.charge.etat}/${e.charge.dernierCode ?? "-"}`;
};

// ── file « À traiter » (LinkedIn / TikTok) ──
const SECRET_CROCHET = "secret-fictif-crochet-filet-guide";
let nCom = 0;
async function commentaireManuel(plateforme: "linkedin" | "tiktok", texte: string, idAuteur: string = AUTEUR): Promise<number> {
  const { readFileSync } = await import("node:fs");
  const c = JSON.parse(readFileSync(new URL("./fixtures/comment-received-forme-reelle.json", import.meta.url), "utf8"));
  nCom++;
  c.id = `evt_fictif_mg5_${nCom}`;
  c.account.platform = plateforme;
  c.account.accountId = plateforme === "tiktok" ? COMPTE_TIKTOK : COMPTE_LINKEDIN;
  c.comment.id = `com-fictif-mg5-${nCom}`;
  c.comment.text = texte;
  c.comment.author.id = idAuteur;
  const corps = Buffer.from(JSON.stringify(c));
  const r = await pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET_CROCHET, corps) }, { env: { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET_CROCHET }, maintenantMs: Date.parse("2026-10-18T10:00:10.000Z") });
  return r.statut;
}
/** Allume explicitement le dépôt des commentaires LinkedIn/TikTok (éteint en production) et déclare les deux comptes avec le mot GUIDE actif. */
async function allumerCartes(): Promise<void> {
  await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true);
  await Com.ecrireParametre(Z.PARAM_COMPTES_ZERNIO, { lusLe: "2026-01-01T00:00:00.000Z", comptes: [{ id: COMPTE_TIKTOK, reseau: "tiktok", nom: "Compte TikTok fictif" }, { id: COMPTE_LINKEDIN, reseau: "linkedin", nom: "Compte LinkedIn fictif" }] });
  const reg = await Com.lireParametre<Record<string, unknown>>(MS.PARAM_REGISTRE_MOTS, {});
  for (const compte of [COMPTE_TIKTOK, COMPTE_LINKEDIN]) reg[`GUIDE|${compte}`] = { mot: "GUIDE", compte, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
}
const traiterManuels = (ms: number = T0 + 60_000) => traiterCommentairesManuels({ env: { A_TRAITER_ENABLED: "1" }, maintenantMs: ms, depot: creerDepotParametre() });

beforeEach(async () => {
  site.catalogue = null;
  vi.stubEnv("STUDIO_EMPREINTE_SECRET", SECRET_EMPREINTE); // la file « À traiter » lit le secret dans l'environnement du processus : même valeur que celle du parcours
  await preparer(); // base vide, faux port, faux site, GUIDE actif sur COMPTE, textes de GUIDE validés
  reinitialiserCacheStatsMots();
  await validerFormulationsAuParcours(FORMULATIONS);
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// ───────────────────────────── (1) commentaire GUIDE → réponse publique + message privé avec lien signé ─────────────────────────────
describe("1 · commentaire GUIDE → réponse publique + message privé avec lien signé", () => {
  it("par le VRAI crochet : une réponse publique, UN message privé portant le lien signé, état attente_email, aucune demande au site", async () => {
    const r = await crochetCommentaire("GUIDE", { reseau: "facebook" });
    expect(r.statut).toBe(200);
    await passer(T0, { env: ENV_LIEN });
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.pub[0].texte).toBe(rendreTexteMp("mp-pub-igfb-v1", {}));
    expect(banc.port.prive).toHaveLength(1);
    const e = await etatPersonne();
    expect(e).toMatchObject({ etat: "attente_email", reseau: "facebook", versionTexteM1: "mp-m1-v4-1" });
    const l = lien(banc.port.prive[0].texte);
    expect(l).toBeTruthy();
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v4-1", { mot: "GUIDE", titre: TITRE, lien: l! }));
    expect(e.refLienConv).toMatch(/^c1_/);
    expect(demandesGuide()).toHaveLength(0);
  });
  it("le lien ne se retrouve ni dans l'état de la conversation ni dans les événements (jamais stocké)", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    const j = lien(banc.port.prive[0].texte)!.split("j=")[1];
    expect(j.length).toBeGreaterThan(20);
    const tout = JSON.stringify(await toutesLesConversations()) + JSON.stringify(await depots().evenementsFournisseurs.lister(() => true));
    expect(tout).not.toContain(j);
  });
  it("lien éteint (réglage de production) : le même commentaire reçoit le message d'avant, SANS lien", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer(T0, { env: ENV_PROD });
    expect(banc.port.prive).toHaveLength(1);
    expect(lien(banc.port.prive[0].texte)).toBeUndefined();
    expect((await etatPersonne()).versionTexteM1).toBe("mp-m1-v2");
  });
  it("rejouer le même passage ne renvoie rien : 1 réponse publique, 1 message privé", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    await passer(T0 + 1000, { env: ENV_LIEN });
    await passer(T0 + 2000, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
  });
  it("un commentaire qui n'est pas le mot seul ne déclenche rien", async () => {
    const r = await crochetCommentaire("GUIDE svp", { reseau: "facebook" });
    expect(r.deposes).toHaveLength(0);
    await passer(T0, { env: ENV_LIEN });
    expect(envoisSortants()).toBe(0);
  });
});

// ───────────────────────────── (2) adresse donnée → e-mail du guide UNE fois ─────────────────────────────
describe("2 · la personne donne une adresse → e-mail du guide UNE fois", () => {
  beforeEach(async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
  });
  it("une demande au site (avec l'adresse), puis un accusé ; état termine", async () => {
    lireTexteDe(`Voici mon adresse : ${ADRESSE}`);
    const id = await deposerMessage(depots, { idMessage: "msg-adresse-1" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(demandesGuide()).toHaveLength(1);
    expect(JSON.parse(demandesGuide()[0].corps).email.toLowerCase()).toBe(ADRESSE);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp("mp-recu-v2", { titre: TITRE }));
    expect((await etatPersonne()).etat).toBe("termine");
    expect(await decrire(id)).toBe("termine/-");
  });
  it("la même adresse renvoyée trois fois, plus des passages répétés : toujours UNE demande et UN accusé", async () => {
    lireTexteDe(ADRESSE);
    for (const [i, m] of ["msg-a", "msg-b", "msg-c"].entries()) {
      await deposerMessage(depots, { idMessage: m, avance: i });
      await passer(T0 + 1000 + i * 1000, { env: ENV_LIEN });
    }
    await passer(T0 + 10_000, { env: ENV_LIEN });
    expect(demandesGuide()).toHaveLength(1);
    expect(banc.port.envoyes).toHaveLength(1);
  });
  it("message sans adresse (premier message AVEC lien) : silence, aucune demande au site, aucun envoi", async () => {
    const avant = instantane();
    lireTexteDe("bonjour, je veux le guide");
    const id = await deposerMessage(depots, { idMessage: "msg-sans-adresse-1" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(instantane()).toEqual(avant);
    expect(await decrire(id)).toBe("silence/silence");
  });
  it("adresse refusée par le site (422) : un seul message d'excuse validé, puis plus rien", async () => {
    banc.site.reponses = () => ({ statut: 422, corps: {} });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-refus-1" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    await deposerMessage(depots, { idMessage: "msg-refus-2" });
    await passer(T0 + 2000, { env: ENV_LIEN });
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(TEXTES_MP["mp-adresse-refusee-v3-1"].texte);
    expect((await etatPersonne()).etat).toBe("site_refuse");
    expect(demandesGuide()).toHaveLength(1);
  });
});

describe("2 bis · sans lien (réglage de production) : adresse absente → UN seul message qui la redemande, jamais de demande au site", () => {
  it("M2 envoyé une fois, même si la personne écrit encore sans adresse", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer(T0, { env: ENV_PROD });
    lireTexteDe("bonjour, je veux le guide");
    await deposerMessage(depots, { idMessage: "msg-m2-1" });
    await passer(T0 + 1000, { env: ENV_PROD });
    await deposerMessage(depots, { idMessage: "msg-m2-2" });
    await passer(T0 + 2000, { env: ENV_PROD });
    expect(demandesGuide()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp("mp-m2-v1", {}));
  });
});

// ───────────────────────────── (3) même mot retapé → « déjà envoyé » seulement si validé ─────────────────────────────
describe("3 · même mot retapé : message court « déjà envoyé » seulement si la formulation est validée", () => {
  beforeEach(allumerMotsMultiples);
  const jusquaLaLivraison = async () => {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-3-1", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-3-adresse" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    const conv = await toutesLesConversations();
    expect(Object.values(conv).map((x: any) => x.etat)).toEqual(["termine"]);
    expect(instantane()).toMatchObject({ pub: 1, prive: 1, envoyes: 1, site: 1 });
  };
  const retaper = async (id: string, apresMs: number, env: Record<string, string | undefined> = ENV_LIEN) => {
    const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: id, motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 - apresMs });
    await passer(T0 + apresMs, { env });
    return evt;
  };

  it("livré il y a moins de 24 h : réponse publique seule, aucun message privé, aucune nouvelle demande", async () => {
    await jusquaLaLivraison();
    const evt = await retaper("com-3-2", 23 * H);
    expect(instantane()).toMatchObject({ pub: 2, prive: 1, envoyes: 1, site: 1 });
    expect(await decrire(evt)).toBe("public_seul/deja_envoye");
  });
  it("livré il y a plus de 24 h, formulation VALIDÉE : réponse publique + message court « déjà envoyé » avec un lien neuf", async () => {
    await jusquaLaLivraison();
    const premier = lien(banc.port.prive[0].texte);
    await retaper("com-3-3", 25 * H);
    expect(instantane()).toMatchObject({ pub: 2, prive: 2, site: 1 });
    const court = banc.port.prive[1].texte;
    expect(court).toBe(rendreTexteMp("mp-deja-envoye-v1-1", { mot: "GUIDE", titre: TITRE, lien: lien(court)! }));
    expect(court).toMatch(/déjà envoyé/);
    expect(lien(court)).toBeTruthy();
    expect(lien(court)).not.toBe(premier);
    expect(Object.values(await toutesLesConversations()).find((x: any) => x.nature === "renvoi")).toMatchObject({ groupeM1: "deja-envoye", etat: "attente_email" });
  });
  it("livré il y a plus de 24 h, formulation NON validée : AUCUN message privé (jamais le texte qui redemande l'adresse), aucune demande au site", async () => {
    await validerFormulationsAuParcours(SANS_DEJA_ENVOYE);
    await jusquaLaLivraison();
    const evt = await retaper("com-3-4", 25 * H);
    expect(instantane()).toMatchObject({ prive: 1, envoyes: 1, site: 1 });
    expect(banc.port.prive).toHaveLength(1);
    expect(await decrire(evt)).toBe("m1_refuse/renvoi_impossible");
  });
  it("livré il y a plus de 24 h, lien éteint : AUCUN message privé de renvoi (le lien est obligatoire)", async () => {
    await jusquaLaLivraison();
    await retaper("com-3-5", 25 * H, ENV_PROD);
    expect(banc.port.prive).toHaveLength(1);
  });
  it("un « stop » entre-temps : le mot retapé 25 h plus tard ne produit ni réponse publique ni message court", async () => {
    await jusquaLaLivraison();
    lireTexteDe("stop");
    await deposerMessage(depots, { idMessage: "msg-3-stop", avance: 5000 });
    await passer(T0 + 2000, { env: ENV_LIEN });
    const avant = instantane();
    await retaper("com-3-6", 25 * H);
    expect(instantane()).toEqual(avant);
  });
});

// ───────────────────────────── (4) « stop » à n'importe quelle étape ─────────────────────────────
describe("4 · « stop » à n'importe quelle étape : plus rien ne part (réponse publique, privé, e-mail, carte À traiter)", () => {
  const ETAPES: Array<[string, () => Promise<void>]> = [
    ["avant tout (stop en commentaire)", async () => undefined],
    ["après réponse publique + message privé", async () => {
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
    }],
    ["après le message qui redemande l'adresse (M2)", async () => {
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      lireTexteDe("bonjour");
      await deposerMessage(depots, { idMessage: "msg-4-m2" });
      await passer(T0 + 1000, { env: ENV_LIEN });
    }],
    ["après la demande du guide et l'accusé", async () => {
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      lireTexteDe(ADRESSE);
      await deposerMessage(depots, { idMessage: "msg-4-adresse" });
      await passer(T0 + 1000, { env: ENV_LIEN });
    }],
  ];
  /** Tout ce qui pourrait encore partir pour la personne : adresse, GUIDE retapé (deux fois), commentaire TikTok (carte À traiter). */
  async function toutEssayer(): Promise<void> {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-4-apres", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 - 2 * H });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-4-apres-1", avance: 10_000 });
    await passer(T0 + 2 * H, { env: ENV_LIEN });
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-4-apres-2", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 - 30 * H });
    await passer(T0 + 30 * H, { env: ENV_LIEN });
    await commentaireManuel("tiktok", "GUIDE", AUTEUR);
    await traiterManuels(T0 + 31 * H);
  }
  describe.each(ETAPES)("%s", (nom, amener) => {
    beforeEach(async () => {
      await allumerCartes();
      await amener();
    });
    it("le « stop » coupe tout : aucun envoi, aucune demande au site, aucune carte, opposition enregistrée", async () => {
      if (nom.startsWith("avant tout")) {
        await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-4-stop", motSeul: "STOP", reseau: "facebook" });
      } else {
        lireTexteDe("stop");
        await deposerMessage(depots, { idMessage: "msg-4-stop", avance: 4000 });
      }
      await passer(T0 + 5000, { env: ENV_LIEN });
      expect((await lignesOpposition()).length).toBeGreaterThan(0);
      const fige = instantane();
      await toutEssayer();
      expect(instantane()).toEqual(fige);
      expect(await cartes()).toEqual([]);
    });
    it("(témoin) sans « stop », la même suite fait bien quelque chose : le test est sensible", async () => {
      const fige = instantane();
      await toutEssayer();
      const apres = instantane();
      const aBouge = apres.pub !== fige.pub || apres.prive !== fige.prive || apres.envoyes !== fige.envoyes || apres.site !== fige.site;
      // Déjà livré (dernière étape) : en mode d'aujourd'hui le mot retapé ne renvoie rien ; seule la carte À traiter prouve alors la sensibilité.
      if (!nom.startsWith("après la demande")) expect(aBouge).toBe(true);
      expect(await cartes()).toHaveLength(1); // la carte « À traiter » du commentaire TikTok existe bien sans « stop »
    });
  });
  describe("après la demande du guide et l'accusé, réglage « plusieurs mots » allumé : le GUIDE retapé à plus de 24 h ferait partir un renvoi, sauf après « stop »", () => {
    beforeEach(async () => {
      await allumerMotsMultiples();
      await registreMots(["GUIDE", COMPTE]);
      await allumerCartes();
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      lireTexteDe(ADRESSE);
      await deposerMessage(depots, { idMessage: "msg-4-multi-adresse" });
      await passer(T0 + 1000, { env: ENV_LIEN });
    });
    it("le « stop » coupe tout : le renvoi à 30 h ne part pas", async () => {
      lireTexteDe("stop");
      await deposerMessage(depots, { idMessage: "msg-4-multi-stop", avance: 4000 });
      await passer(T0 + 5000, { env: ENV_LIEN });
      expect((await lignesOpposition()).length).toBeGreaterThan(0);
      const fige = instantane();
      await toutEssayer();
      expect(instantane()).toEqual(fige);
      expect(await cartes()).toEqual([]);
    });
    it("(témoin) sans « stop », la même suite fait partir un renvoi à 30 h : le test est sensible", async () => {
      const fige = instantane();
      await toutEssayer();
      const apres = instantane();
      expect(apres.prive).toBeGreaterThan(fige.prive);
      expect(apres.pub).toBeGreaterThan(fige.pub);
      expect((await dossierDe(AUTEUR)).length).toBeGreaterThan(1);
    });
  });
  describe("carte À traiter : un commentaire TikTok déjà déposé AVANT le « stop » n'aboutit à aucune carte", () => {
    const sceneAvantStop = async () => {
      await allumerCartes();
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      expect(await commentaireManuel("tiktok", "GUIDE", AUTEUR)).toBe(200); // déposé, pas encore traité
    };
    it("« stop » en message privé entre le dépôt et le traitement : aucune carte, aucun envoi", async () => {
      await sceneAvantStop();
      lireTexteDe("stop");
      await deposerMessage(depots, { idMessage: "msg-4-stop-carte", avance: 4000 });
      await passer(T0 + 5000, { env: ENV_LIEN });
      await traiterManuels(T0 + 60_000);
      expect(await cartes()).toEqual([]);
      expect(instantane()).toMatchObject({ pub: 1, prive: 1, envoyes: 0, site: 0 });
    });
    it("(témoin) sans « stop », le même commentaire déposé devient bien une carte", async () => {
      await sceneAvantStop();
      await traiterManuels(T0 + 60_000);
      expect(await cartes()).toHaveLength(1);
    });
  });
  it("un « stop » arrivé PENDANT l'appel au site : l'accusé ne part pas", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    const initial = banc.site.transport;
    pm.injecterTransportSite(async (r) => {
      const res = await initial(r);
      await Opp.enregistrerOppositionParEmpreinte(cleConversation(AUTEUR), { env: ENV_LIEN });
      return res;
    });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-4-pendant" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(banc.port.envoyes).toHaveLength(0);
  });
});

// ───────────────────────────── (5) opposition venue du site ─────────────────────────────
describe("5 · opposition venue du site (vérification par personne) : rien ne part", () => {
  const ENV_SITE = { ...ENV_LIEN, OPPOSITIONS_SITE_IMPORT_ENABLED: "1", OPPOSITIONS_PAR_REF_ENABLED: "1" };
  const opposees = new Set<string>();
  let appelsOpp: string[][] = [];
  const horloge = (ms: number) => vi.setSystemTime(ms);
  const passerSite = (ms: number, env: Record<string, string | undefined> = ENV_SITE) => (horloge(ms), passer(ms, { env }));
  const verifierSite = (ms: number) => (horloge(ms), IMP.verifierOppositionsSite({ env: ENV_SITE, maintenantMs: ms }));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    opposees.clear();
    appelsOpp = [];
    OT.reinitialiserOppositionsTransmission();
    IMP.reinitialiserImportOppositionsSite();
    delete (globalThis as any).__studioOppositionsSite;
    const initial = banc.site.transport;
    pm.injecterTransportSite(async (r) => {
      if (r.chemin !== CHEMIN_OPPOSITIONS_PAR_CONV) return initial(r);
      const convs = (JSON.parse(r.corps) as { convs: string[] }).convs;
      appelsOpp.push(convs);
      return { statut: 200, corps: { ok: true, schemaVersion: 1, resultats: convs.map((c) => ({ conv: c, opposee: opposees.has(c) })) } };
    });
  });
  afterEach(() => {
    delete (globalThis as any).__studioOppositionsSite;
    IMP.reinitialiserImportOppositionsSite();
  });

  async function ouvrir(auteur: string, idCommentaire: string): Promise<string> {
    await deposerCommentaire(depots, { idAuteur: auteur, idCommentaire, motSeul: "GUIDE", reseau: "facebook" });
    await passerSite(T0);
    const e = await etatPersonne(auteur);
    expect(e?.refLienConv).toMatch(/^c1_/);
    return e.refLienConv as string;
  }

  it("la personne s'oppose sur le site : son adresse envoyée ensuite ne produit ni demande au site ni accusé", async () => {
    const ref = await ouvrir(AUTEUR, "com-5-1");
    opposees.add(ref);
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-5-adresse", avance: 3000 });
    await passerSite(T0 + 60_000); // preuve absente : l'événement attend et demande la vérification
    await verifierSite(T0 + 61_000);
    await passerSite(T0 + 120_000);
    await passerSite(T0 + 20 * 60_000);
    expect(appelsOpp.flat()).toContain(ref);
    expect(demandesGuide()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    expect((await lignesOpposition()).length).toBeGreaterThan(0);
  });
  it("après l'opposition du site, un GUIDE retapé par la même personne ne produit rien (ni public, ni privé)", async () => {
    const ref = await ouvrir(AUTEUR, "com-5-2");
    opposees.add(ref);
    await verifierSite(T0 + 61_000);
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-5-2b", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 - 2 * H });
    await passerSite(T0 + 2 * H);
    expect(instantane()).toMatchObject({ pub: 1, prive: 1, envoyes: 0, site: 0 });
  });
  it("« plusieurs mots » allumé, guide livré, puis opposition du site : un GUIDE retapé à plus de 24 h ne renvoie rien ; le témoin sans opposition reçoit bien son renvoi", async () => {
    await allumerMotsMultiples();
    await registreMots(["GUIDE", COMPTE]); // ce mode lit le registre des mots
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-5-5", motSeul: "GUIDE", reseau: "facebook", ageMs: 2000 });
    await deposerCommentaire(depots, { idAuteur: A2, idCommentaire: "com-5-5b", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 });
    await passerSite(T0);
    const ref = (await dossierDe(AUTEUR))[0]?.refLienConv as string; // en mode « plusieurs mots » l'état est rangé sous `racine|…`
    expect(ref).toMatch(/^c1_/);
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-5-liv-1", avance: 3000 });
    await deposerMessage(depots, { idMessage: "msg-5-liv-2", idExpediteur: A2, idConversation: "conv-fictive-702", avance: 3000 });
    await passerSite(T0 + 60_000);
    await verifierSite(T0 + 61_000);
    await passerSite(T0 + 120_000);
    expect(banc.port.envoyes).toHaveLength(2); // livraison faite pour les deux personnes
    opposees.add(ref); // la première personne s'oppose APRÈS la livraison
    await verifierSite(T0 + 2 * H);
    const avant = instantane();
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-5-5c", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 - 25 * H });
    await deposerCommentaire(depots, { idAuteur: A2, idCommentaire: "com-5-5d", motSeul: "GUIDE", reseau: "facebook", ageMs: 500 - 25 * H });
    await passerSite(T0 + 25 * H); // preuve absente : les événements attendent la vérification par personne
    await verifierSite(T0 + 25 * H + 1000);
    await passerSite(T0 + 25 * H + 120_000);
    await passerSite(T0 + 25 * H + 240_000);
    // témoin : la personne sans opposition reçoit bien son renvoi (le test est sensible) ; la personne opposée ne reçoit rien
    expect(instantane()).toEqual({ ...avant, pub: avant.pub + 1, prive: avant.prive + 1 });
    expect(await dossierDe(A2)).toHaveLength(2);
    expect(await dossierDe(AUTEUR)).toHaveLength(1);
  });
  it("(témoin) une autre personne, non opposée, est bien servie dans la même scène : le test est sensible", async () => {
    const ref = await ouvrir(AUTEUR, "com-5-3");
    const ref2 = await ouvrir(A2, "com-5-3b");
    opposees.add(ref);
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-5-t1", idExpediteur: A2, idConversation: "conv-fictive-702", avance: 3000 });
    await passerSite(T0 + 60_000);
    await verifierSite(T0 + 61_000);
    await passerSite(T0 + 120_000);
    expect(appelsOpp.flat()).toContain(ref2);
    expect(demandesGuide()).toHaveLength(1);
    expect(banc.port.envoyes).toHaveLength(1);
  });
  it("site injoignable : rien ne part par prudence (ni demande ni accusé), jamais « non opposée » par défaut", async () => {
    await ouvrir(AUTEUR, "com-5-4");
    const initial = banc.site.transport;
    pm.injecterTransportSite(async (r) => {
      if (r.chemin === CHEMIN_OPPOSITIONS_PAR_CONV) throw new Error("injoignable");
      return initial(r);
    });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-5-panne", avance: 3000 });
    await passerSite(T0 + 60_000);
    await verifierSite(T0 + 61_000);
    await passerSite(T0 + 120_000);
    expect(demandesGuide()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
  });
});

// ───────────────────────────── (6) mot créé sur /mots sans textes validés ─────────────────────────────
describe("6 · mot créé sur /mots sans textes validés : rien ne part", () => {
  const catalogue = () => ({
    catalogue: [{ code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false }],
    liaisons: [{ mot: "ALPHA", reseau: "tous" as const, codeCible: "guide-ia", actif: true }],
    luLe: T0, ignores: 0, depuisCopie: false,
  });
  beforeEach(async () => {
    await allumerMotsMultiples();
    site.catalogue = catalogue();
    await registreMots(["GUIDE", COMPTE], ["ALPHA", COMPTE]); // ALPHA est créé, actif et lié à une cible… mais sans textes validés
  });
  it("le commentaire ALPHA est clos « validation_absente » : ni réponse publique, ni privé, ni état, ni site ; une alerte", async () => {
    const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-6-1", motSeul: "ALPHA", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    expect(envoisSortants()).toBe(0);
    expect(demandesGuide()).toHaveLength(0);
    expect(await decrire(evt)).toBe("ecarte/validation_absente");
    expect(await toutesLesConversations()).toEqual({});
    expect((await depots().evenements.lister((e: any) => /ALPHA/.test(e.message))).length).toBeGreaterThan(0);
  });
  it("un mot sans textes validés ne bloque pas GUIDE dans le même passage", async () => {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-6-2", motSeul: "ALPHA", reseau: "facebook", ageMs: 3000 });
    await deposerCommentaire(depots, { idAuteur: A2, idCommentaire: "com-6-3", motSeul: "GUIDE", reseau: "facebook", ageMs: 2000 });
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    expect(Object.keys(await toutesLesConversations())).toHaveLength(1);
  });
  it("même avec le lien et toutes les formulations validées, le mot reste muet ; retapé 50 h plus tard : toujours rien", async () => {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-6-4", motSeul: "ALPHA", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-6-5", motSeul: "ALPHA", reseau: "facebook", ageMs: 1000 - 50 * H });
    await passer(T0 + 50 * H, { env: ENV_LIEN });
    expect(envoisSortants()).toBe(0);
    expect(await toutesLesConversations()).toEqual({});
  });
  it("(témoin) GUIDE, dont les textes sont validés, part bien dans la même configuration", async () => {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-6-6", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
  });
  it("GUIDE dont la validation est périmée : plus rien non plus", async () => {
    await Com.ecrireParametre(MS.PARAM_VALIDATION_GUIDE_PARCOURS, { empreinte: "0".repeat(64), valideLe: "2026-01-01T00:00:00.000Z" });
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-6-7", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    expect(envoisSortants()).toBe(0);
  });
});

// ───────────────────────────── (7) disjoncteur / tout arrêter ─────────────────────────────
describe("7 · disjoncteur ouvert / « Tout arrêter » : rien ne part", () => {
  const cas: Array<[string, () => Promise<void>, () => Promise<void>, string]> = [
    ["« Tout arrêter »", () => Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, false), () => Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, true), "garde_tout_arrete"],
    ["disjoncteur ouvert", () => Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } }), () => Com.ecrireParametre(MS.PARAM_GARDES_MOTS, {}), "garde_disjoncteur_ferme"],
  ];
  describe.each(cas)("%s", (_nom, couper, remettre, code) => {
    it("avant tout parcours : le commentaire GUIDE n'envoie rien (ni public, ni privé), l'événement attend avec le code de la garde", async () => {
      await couper();
      const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-7-1", motSeul: "GUIDE", reseau: "facebook" });
      const rap = await passer(T0, { env: ENV_LIEN });
      expect(envoisSortants()).toBe(0);
      expect(rap.enAttente).toBe(1);
      expect(await decrire(evt)).toBe(`a_reessayer/${code}`);
      expect(await toutesLesConversations()).toEqual({});
    });
    it("en cours de parcours : l'adresse envoyée ne produit ni demande au site ni accusé", async () => {
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      const fige = instantane();
      await couper();
      lireTexteDe(ADRESSE);
      await deposerMessage(depots, { idMessage: "msg-7-adresse" });
      await passer(T0 + 1000, { env: ENV_LIEN });
      expect(instantane()).toEqual(fige);
    });
    it("remis en route : ce qui attendait part, une seule fois (rien n'est perdu, rien n'est doublé)", async () => {
      await couper();
      await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-7-3", motSeul: "GUIDE", reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      await remettre();
      await passer(T0 + 2 * 60_000, { env: ENV_LIEN });
      await passer(T0 + 3 * 60_000, { env: ENV_LIEN });
      expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    });
    it("un « stop » est tout de même pris en compte pendant la coupure (l'opposition l'emporte)", async () => {
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      await couper();
      lireTexteDe("stop");
      await deposerMessage(depots, { idMessage: "msg-7-stop" });
      await passer(T0 + 1000, { env: ENV_LIEN });
      expect((await etatPersonne()).etat).toBe("oppose");
      expect(banc.port.envoyes).toHaveLength(0);
    });
  });
});

// ───────────────────────────── (8) plafonds ─────────────────────────────
describe("8 · plafonds : 3 messages privés par personne et par 24 h, 30 écritures par heure et par compte", () => {
  const cleG = (n: string) => n.padEnd(64, "0");
  /** Un message privé déjà parti pour la personne, sous une clé de dossier `racine|n`. */
  async function semer(n: string, cible: string, ilYaMs: number, id: string = AUTEUR): Promise<void> {
    const cle = cleParcours(cleConversation(id), cleG(n));
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      ...(await toutesLesConversations()),
      [cle]: { ...graineConv("attente_email", { cleIdempotenceGuide: cleG(n), idCommentaire: `com-graine-${n}`, mot: n.toUpperCase(), nature: "premier", groupeM1: "m1-lien", guide: cible, m1Le: new Date(T0 - ilYaMs).toISOString() }) },
    });
  }
  describe("par personne (réglage « plusieurs mots » allumé)", () => {
    beforeEach(allumerMotsMultiples);
    it("la valeur du plafond est 3", () => expect(PLAFOND_MP_PERSONNE_JOUR).toBe(3));
    it("trois messages privés dans les dernières 24 h : le 4e GUIDE reste une réponse publique seule", async () => {
      await semer("a", "gde-aaaaaa", 23 * H);
      await semer("b", "gde-bbbbbb", 10 * H);
      await semer("c", "gde-cccccc", 1 * H);
      const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-8-1", motSeul: "GUIDE", reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      expect(instantane()).toMatchObject({ pub: 1, prive: 0 });
      expect(await decrire(evt)).toBe("public_seul/plafond_personne");
    });
    it("deux messages seulement dans les 24 h (le 3e a plus de 24 h) : le GUIDE passe, un message privé part", async () => {
      await semer("a", "gde-aaaaaa", 25 * H);
      await semer("b", "gde-bbbbbb", 10 * H);
      await semer("c", "gde-cccccc", 1 * H);
      await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-8-2", motSeul: "GUIDE", reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    });
    it("le plafond est PAR PERSONNE : une autre personne n'est pas bloquée", async () => {
      await semer("a", "gde-aaaaaa", 3 * H);
      await semer("b", "gde-bbbbbb", 2 * H);
      await semer("c", "gde-cccccc", 1 * H);
      await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-8-3", motSeul: "GUIDE", reseau: "facebook", ageMs: 2000 });
      await deposerCommentaire(depots, { idAuteur: A2, idCommentaire: "com-8-4", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 });
      await passer(T0, { env: ENV_LIEN });
      expect(instantane()).toMatchObject({ pub: 2, prive: 1 });
      expect(await dossierDe(A2)).toMatchObject([{ etat: "attente_email" }]);
    });
  });
  describe("par compte, par heure", () => {
    it("15 personnes = 30 écritures ; la 16e ne reçoit rien et attend l'heure suivante ; à l'heure suivante elle est servie", async () => {
      for (let i = 0; i < 16; i++) await deposerCommentaire(depots, { idAuteur: `auteur-fictif-pl-${i}`, idCommentaire: `com-8-pl-${i}`, motSeul: "GUIDE", reseau: "facebook", ageMs: 5000 - i });
      const rap = await passer(T0, { env: ENV_LIEN });
      expect(instantane()).toMatchObject({ pub: 15, prive: 15 });
      expect(rap.enAttente).toBe(1);
      expect((await Com.lireParametre<Record<string, any>>(C.PARAM_COMPTEURS_CONVERSATION, {}))[COMPTE]).toEqual({ heure: HEURE, envois: 30 });
      const evt = (await depots().evenementsFournisseurs.lister((e: any) => e.charge.idCommentaire === "com-8-pl-15"))[0];
      expect(evt.charge).toMatchObject({ etat: "a_reessayer", dernierCode: "plafond_heure", prochainEssaiLe: HEURE + H });
      await passer(T0 + 30 * 60_000, { env: ENV_LIEN });
      expect(instantane()).toMatchObject({ pub: 15, prive: 15 });
      await passer(HEURE + H + 1000, { env: ENV_LIEN });
      expect(instantane()).toMatchObject({ pub: 16, prive: 16 });
      expect((await Com.lireParametre<Record<string, any>>(C.PARAM_COMPTEURS_CONVERSATION, {}))[COMPTE]).toEqual({ heure: HEURE + H, envois: 2 });
    });
    it("l'accusé est aussi une écriture comptée : réponse publique + message privé + accusé = 3", async () => {
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      lireTexteDe(ADRESSE);
      await deposerMessage(depots, { idMessage: "msg-8-adr" });
      await passer(T0 + 1000, { env: ENV_LIEN });
      expect((await Com.lireParametre<Record<string, any>>(C.PARAM_COMPTEURS_CONVERSATION, {}))[COMPTE]).toEqual({ heure: HEURE, envois: 3 });
    });
    it("compteur à 30 : l'accusé d'une adresse valide attend lui aussi (rien ne part, rien n'est perdu), puis part à l'heure suivante", async () => {
      await crochetCommentaire("GUIDE", { reseau: "facebook" });
      await passer(T0, { env: ENV_LIEN });
      await Com.ecrireParametre(C.PARAM_COMPTEURS_CONVERSATION, { [COMPTE]: { heure: HEURE, envois: 30 } });
      lireTexteDe(ADRESSE);
      const id = await deposerMessage(depots, { idMessage: "msg-8-plein" });
      await passer(T0 + 1000, { env: ENV_LIEN });
      expect(banc.port.envoyes).toHaveLength(0);
      expect((await evenement(depots, id)).traite).toBe(false);
      await passer(HEURE + H + 1000, { env: ENV_LIEN });
      expect(banc.port.envoyes).toHaveLength(1);
    });
  });
});

// ───────────────────────────── (9) suivi chiffré par mot ─────────────────────────────
describe("9 · suivi chiffré par mot : chaque étape incrémente le bon compteur", () => {
  beforeEach(async () => {
    await allumerMotsMultiples();
    site.catalogue = {
      catalogue: [{ code: "guide-ia", type: "guide", titre: "Titre guide-ia", actif: true, test: false }],
      liaisons: [{ mot: "ALPHA", reseau: "tous", codeCible: "guide-ia", actif: true }],
      luLe: T0, ignores: 0, depuisCopie: false,
    };
    await registreMots(["GUIDE", COMPTE], ["ALPHA", COMPTE]);
  });
  const stats = async (ms: number = T0 + 5 * 60_000) => {
    reinitialiserCacheStatsMots();
    const l = await lireStatsMots({ maintenantMs: ms });
    const t = (x: any, k: string) => x?.[k]?.total ?? 0;
    const res = (x: any) => ({ commentaires: t(x, "commentaires"), reponsesPubliques: t(x, "reponsesPubliques"), premiersMessages: t(x, "premiersMessages"), personnes: t(x, "personnes"), erreurs: t(x, "erreurs") });
    return { GUIDE: res(l.find((s) => s.mot === "GUIDE")), ALPHA: res(l.find((s) => s.mot === "ALPHA")) };
  };
  const ZERO = { commentaires: 0, reponsesPubliques: 0, premiersMessages: 0, personnes: 0, erreurs: 0 };
  it("rien ne bouge avant tout événement", async () => {
    expect(await stats()).toEqual({ GUIDE: ZERO, ALPHA: ZERO });
  });
  it("commentaire reçu → commentaires ; passage → réponse publique, premier message et personne ; l'autre mot reste à zéro", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    expect((await stats()).GUIDE).toMatchObject({ commentaires: 1, premiersMessages: 0, personnes: 0 });
    await passer(T0, { env: ENV_LIEN });
    expect(await stats()).toEqual({ GUIDE: { commentaires: 1, reponsesPubliques: 1, premiersMessages: 1, personnes: 1, erreurs: 0 }, ALPHA: ZERO });
  });
  it("adresse donnée, accusé, rejeu du passage : plus aucun compteur ne bouge", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    const apresM1 = await stats();
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-9-adresse" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    await passer(T0 + 2000, { env: ENV_LIEN });
    expect(await stats()).toEqual(apresM1);
  });
  it("un mot sans textes validés : son compteur de commentaires monte, jamais ses messages ni ses personnes ; GUIDE n'est pas touché", async () => {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-9-alpha", motSeul: "ALPHA", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    expect(await stats()).toEqual({ GUIDE: ZERO, ALPHA: { ...ZERO, commentaires: 1 } });
  });
  const apresRenvoi = async () => {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-9-1", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-9-1" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-9-2", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 - 25 * H });
    await passer(T0 + 25 * H, { env: ENV_LIEN });
    expect(banc.port.prive).toHaveLength(2);
    return stats(T0 + 26 * H);
  };
  it("un renvoi (« déjà envoyé » 25 h plus tard) : 2 commentaires, mais UN seul premier message et UNE réponse publique (comptée par personne)", async () => {
    expect((await apresRenvoi()).GUIDE).toMatchObject({ commentaires: 2, reponsesPubliques: 1, premiersMessages: 1 });
  });
  it("un renvoi ne compte PAS comme une nouvelle personne : personnes = 1 (racine de clé commune, mode « plusieurs mots »)", async () => {
    expect((await apresRenvoi()).GUIDE.personnes).toBe(1);
  });
  it("deux personnes = deux personnes et deux premiers messages", async () => {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-9-p1", motSeul: "GUIDE", reseau: "facebook", ageMs: 2000 });
    await deposerCommentaire(depots, { idAuteur: A2, idCommentaire: "com-9-p2", motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 });
    await passer(T0, { env: ENV_LIEN });
    expect((await stats()).GUIDE).toMatchObject({ commentaires: 2, reponsesPubliques: 2, premiersMessages: 2, personnes: 2 });
  });
  it("une garde qui bloque (Tout arrêter) : le commentaire est compté, aucun message ni personne ne l'est", async () => {
    await Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, false);
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-9-b", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    expect((await stats()).GUIDE).toEqual({ commentaires: 1, reponsesPubliques: 0, premiersMessages: 0, personnes: 0, erreurs: 0 });
  });
});

// ───────────────────────────── (10) LinkedIn / TikTok : carte À traiter, AUCUN envoi automatique ─────────────────────────────
describe("10 · LinkedIn / TikTok : une carte « À traiter » est créée, AUCUN envoi automatique", () => {
  for (const plateforme of ["tiktok", "linkedin"] as const) {
    describe(plateforme, () => {
      beforeEach(allumerCartes);
      it("le mot GUIDE crée UNE carte (mot, réseau) ; ni réponse publique, ni privé, ni demande au site, même après plusieurs passages", async () => {
        expect(await commentaireManuel(plateforme, "GUIDE")).toBe(200);
        expect(await traiterManuels()).toMatchObject({ actif: true, traites: 1 });
        const l = await cartes();
        expect(l).toHaveLength(1);
        expect(l[0]).toMatchObject({ mot: "GUIDE", reseau: plateforme });
        await traiterManuels(T0 + 120_000);
        await passer(T0 + 3 * 60_000, { env: ENV_LIEN });
        expect(envoisSortants()).toBe(0);
        expect(banc.port.lire).toBe(0);
        expect(banc.site.vus).toHaveLength(0);
        expect(await cartes()).toHaveLength(1);
      });
      it("un « stop » : aucune carte, une opposition enregistrée, aucun envoi", async () => {
        await commentaireManuel(plateforme, "STOP");
        await traiterManuels();
        expect(await cartes()).toEqual([]);
        expect((await lignesOpposition()).length).toBeGreaterThan(0);
        expect(envoisSortants()).toBe(0);
      });
      it("réglage « réseaux manuels » éteint (production) : rien n'est même déposé, aucune carte", async () => {
        await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, false);
        await commentaireManuel(plateforme, "GUIDE");
        await traiterManuels();
        expect(await cartes()).toEqual([]);
        expect(await depots().evenementsFournisseurs.lister(() => true)).toEqual([]);
      });
    });
  }
  it("le parcours automatique n'envoie rien non plus pour ces réseaux, même si un commentaire y arrivait (garde réseau)", async () => {
    const e1 = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-10-li", motSeul: "GUIDE", reseau: "linkedin" });
    await passer(T0, { env: ENV_LIEN });
    const e2 = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-10-tt", motSeul: "GUIDE", reseau: "tiktok" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, e1)).charge.dernierCode).toBe("garde_reseau");
    expect((await evenement(depots, e2)).charge.dernierCode).toBe("garde_reseau");
  });
});
