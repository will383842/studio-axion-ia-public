/**
 * STU-STOP · opposition en phrases (« Stop, merci », « Arrête », « stop svp »…) et doute. Données 100 % fictives (example.test) ; port et site FAUX.
 * Règle : classerOpposition(texte) → 'opposition' | 'doute' | 'non'. Un doute n'envoie jamais rien, met la conversation en pause et alerte (cloche seulement).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classerOpposition, estMotOpposition, formeCanonique, MOTS_OPPOSITION } from "@/domaine/guide-reseau/opposition";
import { lireEvenementRun, motSeulDe } from "@/domaine/guide-reseau/crochet-zernio";
import { normaliserMot } from "@/domaine/guide-reseau/mot-normalise";
import { cleConversation, deposerCommentaire, deposerMessage, evenement } from "./aides/conversation";
import { ADRESSE, AUTEUR, banc, C, COMPTE, crochetCommentaire, depots, ENV, envoisSortants, graineConv, lireTexteDe, nettoyer, Opp, Com, passer, preparer, T0, toutesLesConversations } from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

beforeEach(preparer);
afterEach(nettoyer);

const MESSAGE_DOUTE = "Un message privé contient peut-être une demande d'arrêt. Rien n'a été envoyé ; la conversation est en pause. À vérifier dans l'Inbox Zernio.";
const OPPOSITIONS = ["Stop, merci", "Arrête", "stop svp", "stop stop", "STOP 🙏", "Arrêtez s'il vous plaît", "arrêtez tout svp", "stop ça", "Non merci, stop", "Ok stop", "stop les messages", "Je veux arrêter", "Ne m'écrivez plus", "Bonjour, stop merci beaucoup", "Stoppez !"];
const NON = ["GUIDE", "a@example.test", "Merci beaucoup !", "Oui", "Top", "Bonjour, je veux bien le guide", "Votre vidéo est top"];
const DOUTES = ["Je voudrais le guide, ne vous arrêtez pas", "ne pas arrêter", "GUIDE stop", "stop guide", "je ne vais pas stop tout de suite", "stop a@example.test", "Je suis à l'arrêt maladie, voici a@example.test", "Stopper la machine, c'est ce que je veux apprendre"];
const lignes = () => Com.lireParametre<Array<{ id: string }>>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const cloche = () => depots().notifications.lister((n: any) => n.titre === "Parcours des messages privés");
const cle = () => cleConversation(AUTEUR);
const etatConv = async () => (await toutesLesConversations())[cle()];

describe("1 · classerOpposition (tableau)", () => {
  it.each(OPPOSITIONS)("« %s » → opposition", (t) => expect(classerOpposition(t)).toBe("opposition"));
  it.each(NON)("« %s » → non", (t) => expect(classerOpposition(t)).toBe("non"));
  it.each(DOUTES)("« %s » → doute", (t) => expect(classerOpposition(t)).toBe("doute"));
  it("limites : plus de 8 mots ou plus de 80 caractères → doute", () => {
    expect(classerOpposition("stop merci merci merci merci merci merci merci")).toBe("opposition"); // 8 mots
    expect(classerOpposition("stop merci merci merci merci merci merci merci merci")).toBe("doute"); // 9 mots
    expect(classerOpposition(`stop ${"merci ".repeat(20)}`)).toBe("doute");
  });
  it("non-texte → non", () => {
    expect(classerOpposition(null)).toBe("non");
    expect(classerOpposition(undefined)).toBe("non");
    expect(classerOpposition("")).toBe("non");
  });
  it("formeCanonique : premier mot d'opposition", () => {
    expect(formeCanonique("Non merci, stop")).toBe("STOP");
    expect(formeCanonique("arrêtez tout svp")).toBe("ARRETEZ");
    expect(formeCanonique("Oui")).toBeNull();
  });
});

describe("2 · la nouvelle règle englobe l'ancienne", () => {
  it("toute variante de l'ancienne règle reste une opposition", () => {
    const anciens = ["STOP", "ARRET", "ARRETEZ"];
    const decos: Array<(m: string) => string> = [(m) => m, (m) => m.toLowerCase(), (m) => `${m} !`, (m) => `${m} ?`, (m) => `« ${m} »`, (m) => `"${m}"`, (m) => `#${m}`, (m) => `${m} 👍`, (m) => `${m}.`, (m) => `  ${m}  `, (m) => m.replace(/./, (c) => c.toUpperCase()), (m) => m.normalize("NFKC").replace(/[A-Za-z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))];
    for (const m of anciens) for (const d of decos) expect(classerOpposition(d(m)), d(m)).toBe("opposition");
    for (const t of ["ARRÊT", "arrêt", "Arrêtez !", "arrêtez.", "Arrêtez 🙏🙏"]) expect(classerOpposition(t), t).toBe("opposition");
  });
});

describe("3 · estMotOpposition cohérent", () => {
  it.each([...OPPOSITIONS, ...NON, ...DOUTES])("« %s »", (t) => expect(estMotOpposition(t)).toBe(classerOpposition(t) === "opposition"));
  it("« stopper » n'est pas une opposition", () => expect(estMotOpposition("stopper")).toBe(false));
  it("liste exacte des mots d'opposition", () => {
    expect([...MOTS_OPPOSITION]).toEqual(["STOP", "STOPPEZ", "ARRET", "ARRETE", "ARRETEZ", "ARRETER", "DESINSCRIRE", "DESINSCRIPTION", "DESINSCRIVEZ", "DESABONNER", "DESABONNEZ", "DESABONNEMENT"]);
  });
});

describe("4 · attente_email + « Stop, merci »", () => {
  it("état oppose, registre opposé, aucun envoi", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("attente_email") });
    lireTexteDe("Stop, merci");
    const id = await deposerMessage(depots, {});
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(banc.site.vus).toHaveLength(0);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect((await etatConv()).etat).toBe("oppose");
    expect(await lignes()).toHaveLength(2);
  });
});

describe("5 · attente_email + doute", () => {
  it("aucun envoi, état inchangé, douteOpposition vrai, UNE alerte cloche fixe avec lien /mots", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("attente_email") });
    lireTexteDe("Je voudrais le guide, ne vous arrêtez pas");
    const id = await deposerMessage(depots, { idMessage: "msg-fictif-doute" });
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(banc.site.vus).toHaveLength(0);
    const e = await etatConv();
    expect(e.etat).toBe("attente_email");
    expect(e.m2Envoye).toBe(false);
    expect(e.douteOpposition).toBe(true);
    expect((await evenement(depots, id)).traite).toBe(true);
    expect((await evenement(depots, id)).charge.dernierCode).toBe("doute_opposition");
    const a = await cloche();
    expect(a).toHaveLength(1);
    expect(a[0].message).toBe(MESSAGE_DOUTE);
    expect(a[0].lien).toBe("/mots");
    expect(JSON.stringify(a[0])).not.toMatch(/voudrais|msg-fictif-doute|auteur-fictif/);
    expect(await lignes()).toHaveLength(0);
  });
});

describe("6 · après un doute", () => {
  beforeEach(async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("attente_email", { douteOpposition: true }) });
  });
  it("« bonjour » ne déclenche aucun M2", async () => {
    lireTexteDe("bonjour");
    const id = await deposerMessage(depots, {});
    await passer();
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, id)).traite).toBe(true);
    expect((await etatConv()).m2Envoye).toBe(false);
  });
  it("une adresse seule déclenche quand même la demande de guide", async () => {
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, {});
    await passer();
    expect(banc.site.vus).toHaveLength(1);
  });
});

describe("7 · doute en état terminé", () => {
  it("silence + alerte, état inchangé", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("termine") });
    lireTexteDe("ne pas arrêter");
    const id = await deposerMessage(depots, {});
    await passer();
    expect((await evenement(depots, id)).charge.etat).toBe("silence");
    expect((await etatConv()).etat).toBe("termine");
    expect(await cloche()).toHaveLength(1);
    expect(envoisSortants()).toBe(0);
  });
});

describe("8 · orphelin en doute", () => {
  it("clos « ignore » (doute_opposition) + alerte", async () => {
    lireTexteDe("GUIDE stop");
    const id = await deposerMessage(depots, {});
    let t = T0;
    for (let i = 0; i < 5; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      if (ev.traite) break;
      t = Number(ev.charge.prochainEssaiLe ?? t + 60_000);
    }
    const ev = await evenement(depots, id);
    expect(ev.charge.etat).toBe("ignore");
    expect(ev.charge.dernierCode).toBe("doute_opposition");
    expect(await cloche()).toHaveLength(1);
    expect(envoisSortants()).toBe(0);
  });
});

describe("9-10 · garde active, veille", () => {
  beforeEach(async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("attente_email") });
  });
  it("garde active + « stop merci » : opposition enregistrée, aucun envoi", async () => {
    lireTexteDe("stop merci");
    const id = await deposerMessage(depots, {});
    await passer(T0, { comptesPermis: ["autre-compte-fictif"], comptesLecture: [COMPTE] });
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect(await lignes()).toHaveLength(2);
    expect(envoisSortants()).toBe(0);
  });
  it("veille + « stop svp » : opposition", async () => {
    banc.port.reponses.lecture = () => ({ texte: "stop svp", postback: null, veille: true });
    const id = await deposerMessage(depots, {});
    await passer();
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect((await etatConv()).etat).toBe("oppose");
    expect(envoisSortants()).toBe(0);
  });
});

describe("11 · commentaires", () => {
  it("« Stop, merci » : déposé avec motSeul « STOP » et opposé", async () => {
    const r = await crochetCommentaire("Stop, merci");
    expect(r.deposes).toHaveLength(1);
    expect(r.deposes[0].motSeul).toBe("STOP");
    const id = (await depots().evenementsFournisseurs.lister(() => true))[0].idEvenement;
    await passer();
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect(envoisSortants()).toBe(0);
  });
  it("« GUIDE stop » : non déposé", async () => {
    const r = await crochetCommentaire("GUIDE stop");
    expect(r.deposes).toHaveLength(0);
  });
});

describe("12 · automatisation Zernio", () => {
  it("trigger.text « stop svp » → motDeclencheur « STOP »", () => {
    const evt = lireEvenementRun({ event: "workflow.run.completed", racine: { execution: { id: "run_fictif_phrases_0001", status: "completed" }, contact: { id: "ct_fictif_1" }, trigger: { text: "stop svp" } } } as any);
    expect(evt?.motDeclencheur).toBe("STOP");
  });
  it("motSeulDe renvoie la forme canonique, jamais le texte brut", () => {
    expect(motSeulDe("Non merci, stop")).toBe("STOP");
    expect(motSeulDe("GUIDE stop")).toBeNull();
  });
});

describe("13 · rejeu du même événement", () => {
  it("un seul effet, une seule alerte", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("attente_email") });
    lireTexteDe("ne pas arrêter");
    await deposerMessage(depots, { idMessage: "msg-rejeu" });
    await passer();
    await passer(T0 + 1000);
    await passer(T0 + 2000);
    expect(await cloche()).toHaveLength(1);
    expect(envoisSortants()).toBe(0);
  });
});

describe("14 · doute posé entre la lecture et l'envoi de M2", () => {
  it("empêche M2", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("attente_email") });
    lireTexteDe("bonjour");
    const lire = banc.port.port.lireMessage;
    banc.port.port.lireMessage = async (p) => {
      const r = await lire(p);
      const conv = await toutesLesConversations();
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...conv, [cle()]: { ...conv[cle()], douteOpposition: true } });
      return r;
    };
    const id = await deposerMessage(depots, {});
    await passer();
    expect(banc.port.envoyes).toHaveLength(0);
    expect((await evenement(depots, id)).traite).toBe(true);
  });
});

describe("15 · ancienne conversation", () => {
  it("sans douteOpposition : lue sans erreur, M2 part pour « bonjour »", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("attente_email") });
    lireTexteDe("bonjour");
    await deposerMessage(depots, {});
    await passer();
    expect(banc.port.envoyes).toHaveLength(1);
    expect((await etatConv()).douteOpposition).toBeUndefined();
  });
});

describe("16 · normaliserMot", () => {
  it.each(["STOP", "stoppez", "arrête", "désinscrire", "DESINSCRIPTION", "désabonnez", "desabonnement", "arreter"])("refuse « %s » comme déclencheur", (m) => expect(normaliserMot(m)).toBeNull());
  it("accepte un mot ordinaire", () => expect(normaliserMot("guide")).toBe("GUIDE"));
});
