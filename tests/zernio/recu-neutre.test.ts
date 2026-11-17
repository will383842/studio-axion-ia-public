/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * C5 · reçu neutre quand l'e-mail du guide n'est pas parti (le site répond toujours 200 ; le champ `guide` dit si l'e-mail part).
 * RÈGLE DE CONFIDENTIALITÉ : un seul comportement pour toute issue autre que « parti » ; le texte et le journal ne dépendent JAMAIS de la valeur
 * renvoyée par le site. Données fictives ; port et site FAUX.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueGuideDepuisCorps } from "@/domaine/guide-reseau/crochet-zernio";
import { GROUPES_PAR_RESEAU } from "@/domaine/guide-reseau/empreinte-mot";
import { GROUPES_MP, TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const N1 = "mp-recu-neutre-v1-1";
const N2 = "mp-recu-neutre-v1-2";
const TEXTE_N1 = "Merci, c'est noté. Si le guide n'arrive pas dans votre boîte mail, regardez aussi dans vos courriers indésirables.";
const TEXTE_N2 = "Bien reçu, merci. Si vous ne voyez pas le guide dans votre boîte mail, pensez à vérifier vos courriers indésirables.";
const RECU = "mp-recu-v3-1";
const A = "auteur-fictif-400";
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];
const corpsGuide = (guide: unknown) => ({ ok: true, demandeId: "dem-fictive-1", nouvelle: true, ...(guide === undefined ? {} : { guide }) });
const messagesJournal = async () => (await depots().evenements.lister(() => true)).map((e: any) => String(e.message));

async function ecrireAdresse(idMessage: string, ms = T0 + 1000): Promise<void> {
  port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
  await deposerMessage(depots, { idMessage });
  await passer(ms);
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
  await deposerCommentaire(depots, {});
  await passer();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("C5 · issueGuideDepuisCorps (fonction pure)", () => {
  it("en-file et en-validation : parti", () => {
    expect(issueGuideDepuisCorps({ ok: true, guide: "en-file" })).toBe("parti");
    expect(issueGuideDepuisCorps({ ok: true, guide: "en-validation" })).toBe("parti");
  });
  it("les cinq autres valeurs du site : incertain", () => {
    for (const v of ["limite-destinataire", "plafond", "suspendu", "non-parti", "opposee"]) expect(issueGuideDepuisCorps({ ok: true, guide: v }), v).toBe("incertain");
  });
  it("champ absent, valeur inconnue ou d'un autre type, corps nul ou non-objet : incertain (choix fermé)", () => {
    for (const c of [{ ok: true }, { guide: "autre" }, { guide: 1 }, { guide: null }, { guide: ["en-file"] }, null, undefined, "en-file", 42, ["en-file"]]) expect(issueGuideDepuisCorps(c), JSON.stringify(c)).toBe("incertain");
  });
});

describe("C5 · dictionnaire et écran /mots", () => {
  it("deux formulations actives, mot pour mot, dans le groupe recu-neutre", () => {
    expect(GROUPES_MP["recu-neutre"]).toEqual([N1, N2]);
    expect(TEXTES_MP[N1].texte).toBe(TEXTE_N1);
    expect(TEXTES_MP[N2].texte).toBe(TEXTE_N2);
    for (const v of [N1, N2]) expect((TEXTES_MP as Record<string, { statut?: string }>)[v].statut, v).toBe("actif");
  });
  it("le groupe est rendu sur /mots pour Facebook et Instagram", () => {
    expect(GROUPES_PAR_RESEAU.facebook).toContain("recu-neutre");
    expect(GROUPES_PAR_RESEAU.instagram).toContain("recu-neutre");
  });
});

describe("C5 · parcours : reçu neutre", () => {
  it("limite-destinataire, recu-neutre validé : le message est exactement la formulation neutre, jamais `recu`", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU, N1]);
    site.reponses = () => ({ statut: 200, corps: corpsGuide("limite-destinataire") });
    await ecrireAdresse("msg-cas-a");
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(TEXTE_N1);
    expect(port.envoyes[0].texte).not.toBe(rendreTexteMp(RECU, { titre: TITRE }));
    expect(await etatDe()).toMatchObject({ etat: "termine", dernierCode: null, formulations: { "recu-neutre": N1 } });
  });

  it("opposee : exactement le même texte que limite-destinataire, et le journal ne contient ni la valeur ni l'adresse", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU, N1]);
    site.reponses = () => ({ statut: 200, corps: corpsGuide("opposee") });
    await ecrireAdresse("msg-cas-b");
    expect(port.envoyes[0].texte).toBe(TEXTE_N1);
    const tout = [...(await messagesJournal()), JSON.stringify(await etatDe())].join("\n");
    for (const v of ["opposee", "limite-destinataire", "plafond", "suspendu", "non-parti"]) expect(tout, v).not.toContain(v);
    expect(tout).not.toContain(ADRESSE_FICTIVE);
  });

  it("toutes les issues autres que « parti » donnent le même message et le même état final (aucune dépendance à la valeur)", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU, N1]);
    const vus: string[] = [];
    for (const v of ["limite-destinataire", "plafond", "suspendu", "non-parti", "opposee", undefined, "inconnue"]) {
      reinitialiserDepots();
      C.reinitialiserParcoursConversation();
      pm.reinitialiserGardesParcours();
      port = fauxPort();
      site = fauxSite();
      pm.injecterTransportSite(site.transport);
      await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
      await validerGuideAuParcours();
      await validerFormulationsAuParcours(["mp-m1-v4-1", RECU, N1]);
      await deposerCommentaire(depots, {});
      await passer();
      site.reponses = () => ({ statut: 200, corps: corpsGuide(v) });
      await ecrireAdresse(`msg-${String(v)}`);
      vus.push(`${port.envoyes.length}|${port.envoyes[0]?.texte}|${(await etatDe()).etat}|${(await etatDe()).dernierCode}`);
    }
    expect(new Set(vus).size).toBe(1);
    expect(vus[0]).toBe(`1|${TEXTE_N1}|termine|null`);
  });

  it("témoin en-file : le reçu habituel (`recu`), jamais le neutre", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU, N1]);
    site.reponses = () => ({ statut: 200, corps: corpsGuide("en-file") });
    await ecrireAdresse("msg-en-file");
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(rendreTexteMp(RECU, { titre: TITRE }));
    expect((await etatDe()).formulations?.["recu-neutre"]).toBeUndefined();
  });

  it("témoin en-validation : le reçu habituel", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU, N1]);
    site.reponses = () => ({ statut: 200, corps: corpsGuide("en-validation") });
    await ecrireAdresse("msg-en-validation");
    expect(port.envoyes[0].texte).toBe(rendreTexteMp(RECU, { titre: TITRE }));
  });

  it("recu-neutre NON validé : repli sur le reçu d'aujourd'hui + événement `recu_neutre_non_valide`, sans adresse ni valeur du site", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU]);
    site.reponses = () => ({ statut: 200, corps: corpsGuide("opposee") });
    await ecrireAdresse("msg-cas-c");
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(rendreTexteMp(RECU, { titre: TITRE }));
    const journal = await messagesJournal();
    expect(journal.filter((m) => m.includes("recu_neutre_non_valide"))).toHaveLength(1);
    const tout = [...journal, JSON.stringify(await etatDe())].join("\n");
    expect(tout).not.toContain(ADRESSE_FICTIVE);
    expect(tout).not.toContain("opposee");
  });

  it("issue parti : aucun événement `recu_neutre_non_valide`", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU]);
    site.reponses = () => ({ statut: 200, corps: corpsGuide("en-file") });
    await ecrireAdresse("msg-parti");
    expect((await messagesJournal()).some((m) => m.includes("recu_neutre_non_valide"))).toBe(false);
  });
});

describe("C5 · écran /mots : groupes recu-neutre et pub-instagram", () => {
  it("les deux groupes s'affichent avec leur titre, leurs formulations et un bouton de validation chacune ; la note Instagram est sous le second", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { EcranMots } = await import("@/components/mots/EcranMots");
    const vue = await MS.lireVueMots();
    const html = renderToStaticMarkup(createElement(EcranMots, { vue, services: { validerFormulation: async () => ({ ok: true, raison: "valide" }) } as never, comptes: [] }));
    const bloc = (g: string) => html.split(`data-groupe="${g}"`)[1].split("data-groupe=")[0];
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    expect(bloc("recu-neutre")).toContain(esc("Accusé de réception neutre (quand l'e-mail n'a pas pu partir)"));
    expect(bloc("pub-instagram")).toContain("Réponse publique au commentaire, Instagram");
    expect(bloc("pub-instagram")).toContain("La validation ne vaut que pour Instagram.");
    expect(bloc("recu-neutre")).not.toContain("ne vaut que pour");
    for (const g of ["recu-neutre", "pub-instagram"] as const) {
      expect(bloc(g).match(/data-formulation=/g), g).toHaveLength(2);
      expect(bloc(g).match(/Valider cette formulation/g), g).toHaveLength(2);
      for (const v of GROUPES_MP[g]) expect(bloc(g), v).toContain(esc(TEXTES_MP[v].texte));
    }
  });
});
