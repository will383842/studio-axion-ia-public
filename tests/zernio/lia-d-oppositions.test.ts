/**
 * LIA-D · transmission des oppositions dans le mode « un envoi par personne ET par mot » (réglage « plusieurs mots » allumé).
 * Preuves : (1) une opposition reçue pour UN mot vaut pour TOUS les mots et TOUS les réseaux de la personne ; (2) elle est transmise
 * au site/CRM par le chemin existant (`transmettreOppositions`, port et site FAUX) UNE seule fois, rejeu idempotent ; (3) rien n'est
 * supprimé (mise à l'écart seulement). Données 100 % fictives (example.test) ; aucun réseau, aucun envoi réel. Aucun src modifié.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { AUTEUR, banc, C, Com, COMPTE, depots, graineConv, MS, nettoyer, passer, pm, preparer, T0, toutesLesConversations } from "./filet-guide/_amorce";
import { ADRESSE_FICTIVE, cleConversation, deposerCommentaire, deposerMessage, ENV, evenement } from "./aides/conversation";
import { CHEMIN_OPP, H, MIN, lectureParMessage, siteDouble } from "./aides/oppositions";

const etat = vi.hoisted(() => ({ catalogue: null as unknown }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/parcours-mots-multiples", async (orig) => ({ ...(await orig<Record<string, unknown>>()), motsMultiplesActifs: async () => true }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => etat.catalogue }));
const Opp = await import("@/services/oppositions-mots");
const OT = await import("@/services/oppositions-transmission");
const { opposerDossier, mettreEnFileDossier, reserverParcours } = await import("@/services/parcours-dossier");

let site: ReturnType<typeof siteDouble>;
const R = () => cleConversation(AUTEUR);
const cles = () => {
  const k = lireClesEmpreinte(ENV);
  if (!k.ok) throw new Error("clés attendues");
  return k;
};
const MSG_ADRESSE = "msg-adr-lia-d";
const MOTS: Array<{ n: string; mot: string; guide: string; reseau: "instagram" | "facebook" }> = [
  { n: "a", mot: "ALPHA", guide: "gde-aaaaaa", reseau: "instagram" },
  { n: "b", mot: "BETA", guide: "gde-bbbbbb", reseau: "facebook" },
  { n: "c", mot: "GUIDE", guide: "guide-ia", reseau: "instagram" },
];
const cleDe = (n: string) => cleParcours(R(), n.padEnd(64, "0"));
/** Dossier de la personne : trois mots, deux réseaux, adresse déjà transmise au site (message `MSG_ADRESSE`). */
async function semerDossier(etatParcours = "attente_email"): Promise<string[]> {
  const conv: Record<string, unknown> = {};
  for (const m of MOTS)
    conv[cleDe(m.n)] = graineConv(etatParcours, {
      reseau: m.reseau, mot: m.mot, guide: m.guide, nature: "premier", groupeM1: "m1-lien", titreCible: `Titre ${m.guide}`,
      cleIdempotenceGuide: m.n.padEnd(64, "0"), idCommentaire: `com-${m.n}`, occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: MSG_ADRESSE,
    });
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, conv);
  await deposerMessage(depots, { idMessage: MSG_ADRESSE, idExpediteur: AUTEUR });
  return MOTS.map((m) => cleDe(m.n));
}
const recevoirStop = () => opposerDossier({ racine: R(), idsBruts: [AUTEUR], cles: cles().courante, env: ENV, maintenantMs: T0 });
const lireAdresse = () => lectureParMessage(banc.port, { [MSG_ADRESSE]: `Mon adresse : ${ADRESSE_FICTIVE}, merci.` });
const transmettre = (ms = T0) => OT.transmettreOppositions({ port: banc.port.port, env: ENV, maintenantMs: ms });
const file = () => Com.lireParametre<Record<string, any>>(OT.PARAM_OPPOSITIONS_FILE, {});
const compter = () => ({ pub: banc.port.pub.length, prive: banc.port.prive.length, envoyes: banc.port.envoyes.length });
const stockage = async (): Promise<string> =>
  JSON.stringify([await depots().parametres.lister(() => true), await depots().evenements.lister(() => true), await depots().evenementsFournisseurs.lister(() => true)]);

beforeEach(async () => {
  await preparer();
  OT.reinitialiserOppositionsTransmission();
  site = siteDouble();
  pm.injecterTransportSite(site.transport);
  etat.catalogue = null;
});
afterEach(nettoyer);

describe("LIA-D · une opposition vaut pour TOUS les mots et TOUS les réseaux", () => {
  it("« stop » reçu : chaque parcours du dossier (trois mots, deux réseaux) passe à `oppose`, prochain essai effacé, mot et cible gardés", async () => {
    const cl = await semerDossier();
    await recevoirStop();
    const conv = await toutesLesConversations();
    expect(Object.keys(conv).sort()).toEqual([...cl].sort());
    for (const [i, c] of cl.entries()) {
      expect(conv[c]).toMatchObject({ etat: "oppose", prochainEssaiLe: null, mot: MOTS[i].mot, guide: MOTS[i].guide, reseau: MOTS[i].reseau });
    }
  });

  it("le registre porte la personne : « opposée partout » même sans lire l'état", async () => {
    await semerDossier();
    await recevoirStop();
    const lignes = await Com.lireParametre<any[]>(Opp.PARAM_OPPOSITIONS_MOTS, []);
    expect(lignes.length).toBeGreaterThanOrEqual(1);
    expect(lignes.some((l) => l.id === R())).toBe(true);
    expect(await Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).toMatchObject({ opposee: true });
  });

  it("un mot que la personne n'a JAMAIS utilisé, sur chaque cible, est refusé : aucune réservation n'aboutit à un envoi", async () => {
    await semerDossier();
    await recevoirStop();
    const avant = JSON.stringify(await toutesLesConversations());
    for (const code of ["guide-ia", "gde-aaaaaa", "gde-bbbbbb", "gde-jamais-vu"]) {
      const r = await reserverParcours({
        cles: cles(), idAuteur: AUTEUR, idCommentaire: `com-neuf-${code}`, ageMs: 1000, maintenantMs: T0 + MIN, code,
        creer: () => { throw new Error("aucun enregistrement ne doit être créé"); },
      });
      expect(r.decision).toEqual({ action: "silence", raison: "oppose" });
    }
    expect(JSON.stringify(await toutesLesConversations())).toBe(avant);
  });

  it("par le service : après « STOP », un commentaire GUIDE sur chaque réseau ne produit aucun envoi", async () => {
    await semerDossier();
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" }, [`STOP|${COMPTE}`]: { mot: "STOP", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-stop", motSeul: "STOP", ageMs: 500, reseau: "facebook" });
    await passer(T0);
    const conv = await toutesLesConversations();
    expect(Object.values(conv).every((c: any) => c.etat === "oppose")).toBe(true);
    const avant = compter();
    for (const [i, reseau] of (["instagram", "facebook"] as const).entries()) {
      const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: `com-apres-${i}`, motSeul: "GUIDE", ageMs: 500, reseau });
      await passer(T0 + (i + 1) * MIN);
      expect(String((await evenement(depots, evt)).charge.etat)).toBe("silence");
    }
    expect(compter()).toEqual(avant);
  });

  it("opposition déjà au registre SEUL (aucun état) : tous les parcours du dossier sont écartés au prochain passage de rattrapage", async () => {
    const cl = await semerDossier();
    await Opp.enregistrerOpposition(AUTEUR, "zernio-conversation", { env: ENV });
    lireAdresse();
    await transmettre(T0);
    expect(Object.keys(await file()).sort()).toEqual([...cl].sort());
  });
});

describe("LIA-D · transmission au site/CRM par le chemin existant : une seule fois, rejeu idempotent", () => {
  it("une entrée de file par parcours ; chaque entrée est envoyée UNE fois, avec sa propre clé d'idempotence, corps strict signé", async () => {
    const cl = await semerDossier();
    await recevoirStop();
    expect(Object.keys(await file()).sort()).toEqual([...cl].sort());
    lireAdresse();
    const r = await transmettre();
    expect(r.transmises).toBe(3);
    const corps = site.opp().map((x) => JSON.parse(x.corps));
    expect(corps).toHaveLength(3);
    expect(new Set(corps.map((c) => c.cleIdempotence)).size).toBe(3);
    expect(corps.map((c) => c.reseau).sort()).toEqual(["facebook", "instagram", "instagram"]);
    for (const c of corps) expect(c).toMatchObject({ email: ADRESSE_FICTIVE, motif: "stop", schemaVersion: 1 });
    expect(site.opp().every((x) => x.chemin === CHEMIN_OPP)).toBe(true);
    expect(site.invalides).toEqual([]);
    expect(Object.values(await file()).every((e) => e.etat === "transmise")).toBe(true);
  });

  it("rejeu : passages répétés, redémarrage du processus, nouvelle mise en file, rattrapage : toujours trois envois en tout", async () => {
    await semerDossier();
    await recevoirStop();
    lireAdresse();
    await transmettre(T0);
    const cleFile = (await file());
    const avant = JSON.stringify(cleFile);
    await transmettre(T0 + 5 * MIN);
    OT.reinitialiserOppositionsTransmission(); // le processus redémarre
    await transmettre(T0 + 2 * H);
    const conv = await toutesLesConversations();
    await mettreEnFileDossier(Object.entries(conv).map(([cle, e]) => ({ cle, etat: e })), cles().courante, T0 + 3 * H);
    await recevoirStop(); // le même « stop » arrive une seconde fois
    await transmettre(T0 + 4 * H);
    expect(site.opp()).toHaveLength(3);
    expect(JSON.stringify(await file())).toBe(avant);
  });

  it("panne puis reprise : la même clé et les MÊMES octets sont rejoués, puis une seule réussite par parcours", async () => {
    await semerDossier();
    await recevoirStop();
    lireAdresse();
    site.reponseOpp = () => 500;
    await transmettre(T0);
    expect(site.opp()).toHaveLength(3);
    site.reponseOpp = () => 200;
    await transmettre(T0 + MIN + 1000);
    expect(site.opp()).toHaveLength(6);
    const premiers = site.opp().slice(0, 3).map((x) => x.corps).sort();
    const seconds = site.opp().slice(3).map((x) => x.corps).sort();
    expect(seconds).toEqual(premiers);
    await transmettre(T0 + 3 * H);
    expect(site.opp()).toHaveLength(6);
    expect(Object.values(await file()).every((e) => e.etat === "transmise")).toBe(true);
  });

  it("deux passages simultanés : trois envois, pas six", async () => {
    await semerDossier();
    await recevoirStop();
    lireAdresse();
    await Promise.all([transmettre(T0), transmettre(T0)]);
    expect(site.opp()).toHaveLength(3);
  });

  it("l'adresse n'est jamais stockée : ni dans la file, ni dans la base, ni dans le journal", async () => {
    await semerDossier();
    await recevoirStop();
    lireAdresse();
    await transmettre();
    expect(await stockage()).not.toContain("example.test");
  });
});

describe("LIA-D · rien n'est supprimé : mise à l'écart seulement", () => {
  it("après « stop » et transmission : mêmes clés de parcours, aucun champ perdu, dates gardées ; le registre et la file ne perdent aucune ligne", async () => {
    const cl = await semerDossier();
    const avant = await toutesLesConversations();
    const evenementsAvant = (await depots().evenementsFournisseurs.lister(() => true)).map((e: any) => e.id).sort();
    await recevoirStop();
    lireAdresse();
    await transmettre();
    await transmettre(T0 + H);
    const apres = await toutesLesConversations();
    expect(Object.keys(apres).sort()).toEqual([...cl].sort());
    for (const c of cl) {
      for (const champ of Object.keys(avant[c])) expect(Object.prototype.hasOwnProperty.call(apres[c], champ), `${champ} doit rester`).toBe(true);
      for (const champ of ["creeLe", "m1Le", "occurredAt", "cleIdempotenceGuide", "idCommentaire", "mot", "guide", "titreCible", "alias"]) expect(apres[c][champ]).toEqual(avant[c][champ]);
      expect(apres[c].etat).toBe("oppose");
    }
    const evenementsApres = (await depots().evenementsFournisseurs.lister(() => true)).map((e: any) => e.id).sort();
    expect(evenementsApres).toEqual(evenementsAvant);
    expect(Object.keys(await file())).toHaveLength(3);
    expect((await Com.lireParametre<any[]>(Opp.PARAM_OPPOSITIONS_MOTS, [])).length).toBeGreaterThanOrEqual(1);
  });

  it("« stop » rejeté par le site (422) : l'entrée est GARDÉE (`refusee`), la personne reste écartée", async () => {
    const cl = await semerDossier();
    await recevoirStop();
    lireAdresse();
    site.reponseOpp = () => 422;
    await transmettre();
    await transmettre(T0 + 7 * H);
    expect(Object.keys(await file()).sort()).toEqual([...cl].sort());
    expect(Object.values(await file()).every((e) => e.etat === "refusee")).toBe(true);
    expect(site.opp()).toHaveLength(3);
    expect(Object.values(await toutesLesConversations()).every((c: any) => c.etat === "oppose")).toBe(true);
  });

  it("un état `oppose` n'est jamais rétrogradé par un second « stop »", async () => {
    const cl = await semerDossier("oppose");
    await recevoirStop();
    const conv = await toutesLesConversations();
    for (const c of cl) expect(conv[c].etat).toBe("oppose");
  });
});
