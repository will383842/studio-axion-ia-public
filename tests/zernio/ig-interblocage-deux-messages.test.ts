/**
 * Instagram, cible d'ESSAI : deux messages rapprochés de la même personne ne doivent plus se reporter l'un l'autre à l'infini (stop_anterieur_non_lu).
 * Le garde-fou reste entier : un message non traité et non marqué bloque TOUJOURS ; seul un message marqué « candidat OK » ET postérieur ne bloque pas.
 * Même préparation que ig-adresse-sans-ok.test.ts ; données 100 % fictives ; aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limitePersonneIg } from "@/domaine/guide-reseau/suivi-instagram";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { CHEMIN_GUIDE } from "./aides/oppositions";
import { ADRESSE_FICTIVE, deposerCommentaire as deposerCommentaireAide, deposerMessage as deposerMessageAide, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, lireTexteDe, MS, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";

const site = vi.hoisted(() => ({ versions: new Set<string>(["mp-m1-v4-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", "mp-m1-v6-1"]), catalogue: null as unknown, panneEssai: false, pannes: 0, lieux: [] as string[], lectures: 0, course: false }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => {
    // Panne de lecture limitée à l'appel de la fonction qui décide « cible d'essai du jour » (les autres lectures réussissent).
    // `pannes` / `lieux` prouvent que la panne s'est déclenchée DANS la fonction visée (pas seulement qu'une regex a trouvé un mot dans la pile).
    const lieu = /at (?:async )?(statutEssaiCatalogue|cibleEstEssaiAujourdhui)\b/.exec(new Error().stack ?? "");
    // Course : la lecture faite DANS `repondreOkInstagram` (filtre) échoue une fois, puis le catalogue redevient lisible avec « non » (cible plus d'essai).
    if (site.course && /at (?:async )?repondreOkInstagram\b/.test(new Error().stack ?? "")) { site.course = false; site.catalogue = catalogue(false); site.pannes++; throw new Error("catalogue en panne (fictif, course)"); }
    if (site.panneEssai && lieu) { site.pannes++; site.lieux.push(lieu[1]); throw new Error("catalogue en panne (fictif)"); }
    site.lectures++;
    return site.catalogue;
  } }));
vi.mock("@/services/notifications", async (orig) => ({ ...(await orig<Record<string, unknown>>()), creerNotification: vi.fn(async () => undefined) }));

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");
const V = await import("@/services/mots-validation-par-mot");

const MOT = "ESSAICONV";
const CODE = "gde-essai05";
const TITRE_ESSAI = "Guide d'essai conversation";
const NOUVELLE = "mp-m1-v6-1";
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const ENV_X = {
  ...ENV, PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE, PARCOURS_LIEN_GUIDE: "true", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale`,
  PARCOURS_ESSAI_COMPTES: COMPTE, PARCOURS_ESSAI_AUTEURS: AUTEUR,
};
const FORM = ["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", NOUVELLE, "mp-adresse-refusee-v3-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", "mp-m2-v2-1"];

const catalogue = (test = true) => ({
  catalogue: [
    { code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false },
    { code: CODE, type: "guide" as const, titre: TITRE_ESSAI, actif: true, test },
  ],
  liaisons: [
    { mot: "GUIDE", reseau: "tous" as const, codeCible: "guide-ia", actif: true },
    { mot: MOT, reseau: "tous" as const, codeCible: CODE, actif: true },
  ],
  luLe: T0, ignores: 0, depuisCopie: false,
});
// Le réglage public d'Instagram reste TEL QUEL (absent) : seuls les auteurs listés sont servis.
const deposerCommentaire = (d: () => any, o: Parameters<typeof deposerCommentaireAide>[1] = {}) => deposerCommentaireAide(d, { ...o, reglageInstagram: "intact" });
const deposerMessage = (d: () => any, o: Parameters<typeof deposerMessageAide>[1] = {}) => deposerMessageAide(d, { ...o, reglageInstagram: "intact" });
const com = (mot: string) => deposerCommentaire(depots, { motSeul: mot, reseau: "instagram" });
const msg = (id: string, avance = 5000) => deposerMessage(depots, { idMessage: id, avance });
const pass = (ms: number, env: Record<string, string | undefined> = ENV_X) => passer(ms, { env });
const demandes = () => banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE);
const conv = async () => (Object.values(await toutesLesConversations()) as any[])[0];
const suivi = { appels: 0 };
const T1 = T0 + 10_000;

const registreMots = async () => {
  const reg: Record<string, unknown> = {};
  for (const mot of ["GUIDE", MOT]) reg[`${mot}|${COMPTE}`] = { mot, compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};
const validerEssaiIg = async () => {
  const a = (await V.apercuTextesMot({ mot: MOT, env: ENV_X, maintenantMs: T0 })).find((x) => x.reseau === "instagram")!;
  if (!a.ok) throw new Error(`aperçu refusé : ${a.raison}`);
  const r = await V.validerTextesMot({ mot: MOT, reseau: "instagram", empreinteVue: a.empreinte, confirmeParOperateur: true, env: ENV_X, maintenantMs: T0 });
  if (!r.ok) throw new Error(r.raison);
};
const ADR = `Mon adresse : ${ADRESSE_FICTIVE}`;
const ADRESSE_CORRIGEE = "adresse-corrigee-fictive@example.test";
const ADR2 = `Plutôt celle-ci : ${ADRESSE_CORRIGEE}`;
const PC = await import("@/services/parcours-conversation");
const CODE_BLOCAGE = "stop_anterieur_non_lu";
const nbBloques = async () => (await depots().evenementsFournisseurs.lister((e: any) => e.charge?.dernierCode === CODE_BLOCAGE)).length;
/** Textes par idMessage ; un idMessage listé dans `illisibles` fait échouer la lecture (panne), donc le message reste non traité. */
const illisibles = new Set<string>();
const lectures = (t: Record<string, string>) => {
  (banc.port.port as any).lireMessage = async (p: any) => {
    if (illisibles.has(p.idMessage)) throw new Error("lecture en panne (fictive)");
    return (banc.port.lire++, { texte: t[p.idMessage] ?? null, postback: null });
  };
};
const apresIgSuivre = async () => {
  await com(MOT);
  await pass(T0);
  expect(banc.port.prive).toHaveLength(1);
};

beforeEach(async () => {
  await preparer();
  site.versions = new Set(["mp-m1-v4-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", NOUVELLE]);
  site.catalogue = catalogue();
  site.panneEssai = false;
  site.pannes = 0;
  site.lieux = [];
  site.lectures = 0;
  site.course = false;
  suivi.appels = 0;
  illisibles.clear();
  (banc.port.port as any).lireSuiviInstagram = async () => (suivi.appels++, { statut: "suit" });
  lireTexteDe("OK");
  await validerFormulationsAuParcours(FORM);
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
  await registreMots();
  await validerEssaiIg();
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
});

const M = 60_000;
const V61 = () => rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI });
const envoyesV61 = () => banc.port.envoyes.filter((e: any) => e.texte === V61());
/** Passages espacés de plus d'une minute (le report dure 60 s) jusqu'à T1 + 2 min. */
const passagesJusqua2Min = async () => { for (const d of [T1, T1 + 61_000, T1 + 122_000]) await pass(d); };

describe("Interblocage de deux messages rapprochés : au plus 2 reports, plus de boucle, le garde-fou du STOP non lu reste entier", () => {
  it("C15a · adresse puis OK à 1 s : UNE seule v6-1 (idMessageOk = l'adresse), aucune demande de guide pour l'adresse avant la mention ; rien ne reste bloqué à T1 + 2 min", async () => {
    await apresIgSuivre();
    lectures({ "msg-adr": ADR, "msg-ok": "OK" });
    await msg("msg-adr", 5000);
    await msg("msg-ok", 6000);
    await passagesJusqua2Min();
    expect(envoyesV61()).toHaveLength(1);
    expect(await conv()).toMatchObject({ idMessageOk: "msg-adr" });
    expect(demandes()).toHaveLength(0);
    expect(await nbBloques()).toBe(0);
  });

  it("C15b · OK puis adresse : une v6-1 (idMessageOk = le OK) puis la demande de guide avec cette adresse", async () => {
    await apresIgSuivre();
    lectures({ "msg-ok": "OK", "msg-adr": ADR });
    await msg("msg-ok", 5000);
    await msg("msg-adr", 6000);
    await passagesJusqua2Min();
    expect(envoyesV61()).toHaveLength(1);
    expect(await conv()).toMatchObject({ idMessageOk: "msg-ok" });
    expect(demandes()).toHaveLength(1);
    expect(demandes()[0].corps).toContain(ADRESSE_FICTIVE);
    expect(await nbBloques()).toBe(0);
  });

  it("C15c · adresse deux fois : une v6-1 puis la demande de guide avec l'adresse corrigée", async () => {
    await apresIgSuivre();
    lectures({ "msg-adr": ADR, "msg-adr-2": ADR2 });
    await msg("msg-adr", 5000);
    await msg("msg-adr-2", 6000);
    await passagesJusqua2Min();
    expect(envoyesV61()).toHaveLength(1);
    expect(demandes()).toHaveLength(1);
    expect(demandes()[0].corps).toContain(ADRESSE_CORRIGEE);
    expect(demandes()[0].corps).not.toContain(ADRESSE_FICTIVE);
    expect(await nbBloques()).toBe(0);
  });

  it("C15d · deux messages de même recuLe : départés par ev.id, un seul v6-1 (le second OK reçoit l'accusé ; idMessageOk = le message de plus petit ev.id)", async () => {
    await apresIgSuivre();
    lectures({ "msg-ok-a": "OK", "msg-ok-b": "OK" });
    const ea = await msg("msg-ok-a", 5000);
    const eb = await msg("msg-ok-b", 5000);
    const [ida, idb] = [(await evenement(depots, ea)).id as string, (await evenement(depots, eb)).id as string];
    expect((await evenement(depots, ea)).recuLe).toBe((await evenement(depots, eb)).recuLe);
    await passagesJusqua2Min();
    expect(envoyesV61()).toHaveLength(1);
    expect(await conv()).toMatchObject({ idMessageOk: ida < idb ? "msg-ok-a" : "msg-ok-b" });
    expect(await nbBloques()).toBe(0);
  });

  it("C15e · STOP antérieur illisible puis OK : rien ne part tant que le stop n'est pas lisible ; une fois lu : opposition enregistrée, 0 envoi au OK", async () => {
    await apresIgSuivre();
    lectures({ "msg-stop": "STOP", "msg-ok": "OK" });
    illisibles.add("msg-stop");
    await msg("msg-stop", 5000);
    await msg("msg-ok", 6000);
    for (const d of [T1, T1 + 61_000, T1 + 122_000, T1 + 183_000]) await pass(d);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    illisibles.clear();
    for (const d of [T1 + 10 * M, T1 + 20 * M, T1 + 40 * M, T1 + 80 * M, T1 + 160 * M]) await pass(d);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await conv()).toMatchObject({ etat: "oppose" });
  });

  it("C15f · OK puis STOP postérieur illisible : le OK attend, le STOP gagne ensuite (0 envoi)", async () => {
    await apresIgSuivre();
    lectures({ "msg-ok": "OK", "msg-stop": "STOP" });
    illisibles.add("msg-stop");
    await msg("msg-ok", 5000);
    await msg("msg-stop", 6000);
    for (const d of [T1, T1 + 61_000, T1 + 122_000, T1 + 183_000]) await pass(d);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    illisibles.clear();
    for (const d of [T1 + 10 * M, T1 + 20 * M, T1 + 40 * M, T1 + 80 * M, T1 + 160 * M]) await pass(d);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await conv()).toMatchObject({ etat: "oppose" });
  });

  it("C15g · un second OK (reçu plus tôt) arrive pendant la lecture du suivi : le report du second site pose aussi la marque ; un seul v6-1 dès le passage suivant", async () => {
    await apresIgSuivre();
    lectures({ "msg-ok": "OK", "msg-ok-tot": "OK" });
    await msg("msg-ok", 6000);
    let injecte = false;
    (banc.port.port as any).lireSuiviInstagram = async () => {
      suivi.appels++;
      if (!injecte) { injecte = true; await msg("msg-ok-tot", 5000); }
      return { statut: "suit" };
    };
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await nbBloques()).toBe(1);
    await pass(T1 + 61_000);
    expect(envoyesV61()).toHaveLength(1);
    await pass(T1 + 122_000);
    expect(envoyesV61()).toHaveLength(1);
    expect(await conv()).toMatchObject({ idMessageOk: "msg-ok-tot" });
    expect(await nbBloques()).toBe(0);
  });
});

describe("autreMessageBloque (fonction pure)", () => {
  const ev = (id: string, recuLe: string, marque?: boolean) => ({ id, recuLe, charge: marque === undefined ? {} : { candidatOk: marque } }) as any;
  const A = ev("evf-1", "2026-01-01T10:00:00.000Z");
  it("non marqué : bloque dans tous les cas (antérieur, postérieur, même date, illisible)", () => {
    const courant = ev("evf-5", "2026-01-01T10:00:00.000Z");
    for (const r of ["2025-12-31T10:00:00.000Z", "2026-01-02T10:00:00.000Z", "2026-01-01T10:00:00.000Z", "illisible"]) {
      for (const id of ["evf-1", "evf-9"]) {
        expect(PC.autreMessageBloque(courant, ev(id, r))).toBe(true);
        expect(PC.autreMessageBloque(courant, ev(id, r, false))).toBe(true);
      }
    }
  });
  it("marqué + postérieur : ne bloque pas", () => {
    expect(PC.autreMessageBloque(A, ev("evf-0", "2026-01-01T10:00:01.000Z", true))).toBe(false);
  });
  it("marqué + antérieur : bloque", () => {
    expect(PC.autreMessageBloque(A, ev("evf-9", "2026-01-01T09:59:59.000Z", true))).toBe(true);
  });
  it("même date : départé par id dans les deux sens", () => {
    const m = "2026-01-01T10:00:00.000Z";
    expect(PC.autreMessageBloque(ev("evf-1", m), ev("evf-2", m, true))).toBe(false);
    expect(PC.autreMessageBloque(ev("evf-2", m), ev("evf-1", m, true))).toBe(true);
  });
  it("recuLe illisible rangé en dernier : l'autre illisible est postérieur, le courant illisible est postérieur à tout autre lisible", () => {
    expect(PC.autreMessageBloque(A, ev("evf-0", "illisible", true))).toBe(false);
    expect(PC.autreMessageBloque(ev("evf-1", "illisible"), ev("evf-0", "2026-01-01T10:00:00.000Z", true))).toBe(true);
    expect(PC.autreMessageBloque(ev("evf-1", "illisible"), ev("evf-2", "illisible", true))).toBe(false);
    expect(PC.autreMessageBloque(ev("evf-2", "illisible"), ev("evf-1", "illisible", true))).toBe(true);
  });
});

describe("Pannes et trois messages : le garde-fou du STOP non lu et la panne du catalogue (B3, B4)", () => {
  it("B3 · panne du catalogue, deux messages (adresse reportée catalogue_illisible, puis OK) : rien ne part pendant la panne, pas d'interblocage ; au retour du catalogue tout repart (un seul v6-1)", async () => {
    await apresIgSuivre();
    // Drapeau figé retiré : l'essai n'est plus « prouvé » que par la lecture du catalogue (le statut devient « supposé » en panne).
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, Object.fromEntries(Object.entries(await toutesLesConversations()).map(([k, v]: [string, any]) => [k, { ...v, cibleEssai: undefined }])));
    lectures({ "msg-adr": ADR, "msg-ok": "OK" });
    site.panneEssai = true;
    const ea = await msg("msg-adr", 5000);
    await msg("msg-ok", 6000);
    for (const d of [T1, T1 + 61_000, T1 + 122_000]) await pass(d);
    expect(site.pannes).toBeGreaterThan(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect((await evenement(depots, ea)).charge).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    site.panneEssai = false;
    for (const d of [T1 + 10 * M, T1 + 11 * M, T1 + 12 * M, T1 + 13 * M]) await pass(d);
    expect(envoyesV61()).toHaveLength(1);
    expect(await conv()).toMatchObject({ idMessageOk: "msg-adr" });
    expect(await nbBloques()).toBe(0);
    const restants = await depots().evenementsFournisseurs.lister((x: any) => x.traite === false);
    expect(restants).toHaveLength(0);
  });

  it("B4 · trois messages : OK courant + OK marqué postérieur + STOP illisible non marqué : 0 envoi tant que le STOP n'est pas lisible ; une fois lu, opposition et toujours 0 envoi", async () => {
    await apresIgSuivre();
    lectures({ "msg-ok-1": "OK", "msg-ok-2": "OK", "msg-stop": "STOP" });
    illisibles.add("msg-stop");
    await msg("msg-stop", 4000);
    await msg("msg-ok-1", 5000);
    await msg("msg-ok-2", 6000);
    for (const d of [T1, T1 + 61_000, T1 + 122_000, T1 + 183_000, T1 + 244_000]) await pass(d);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    illisibles.clear();
    for (const d of [T1 + 10 * M, T1 + 20 * M, T1 + 40 * M, T1 + 80 * M, T1 + 160 * M]) await pass(d);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await conv()).toMatchObject({ etat: "oppose" });
  });
});

describe("B1 · accusé « adresse non reconnue » au OK qui suit une adresse : place dans le plafond de 3 par personne (constat de la PR #923, N1)", () => {
  it("B1 · adresse, OK (accusé), adresse renvoyée : l'accusé « non reconnue » (m2Le) occupe la 3e place du plafond de 3 (m1Le, adresseIgLe, m2Le), mais l'accusé de réception part (sa borne est à part) et la demande part au site", async () => {
    await apresIgSuivre();
    lectures({ "msg-adr": ADR, "msg-ok": "OK", "msg-adr-2": ADR2 });
    await msg("msg-adr", 5000);
    await msg("msg-ok", 6000);
    await passagesJusqua2Min();
    expect(banc.port.envoyes).toHaveLength(2); // v6-1 puis accusé « adresse non reconnue »
    const apresOk = await conv();
    expect(typeof apresOk.m1Le).toBe("string");
    expect(typeof apresOk.adresseIgLe).toBe("string");
    expect(typeof apresOk.m2Le).toBe("string");
    expect(limitePersonneIg([apresOk], T1 + 2 * M)).toMatchObject({ nombre: 3, atteint: true });
    await msg("msg-adr-2", 7000);
    for (const d of [T1 + 10 * M, T1 + 11 * M, T1 + 12 * M]) await pass(d);
    expect(demandes()).toHaveLength(1);
    expect(demandes()[0].corps).toContain(ADRESSE_CORRIGEE);
    const e = banc.port.envoyes as Array<{ texte: string }>;
    expect(e).toHaveLength(3); // + l'accusé de réception : le plafond de 3 ne le retient pas
    expect(e[2].texte).toMatch(/Message automatique envoyé par Axion IA/);
    expect((await conv()).etat).toBe("termine");
  });
  // Constat : le merci (étape « g bis », plafondIg) serait retenu dans ce même dossier, puisque le plafond de 3 est atteint (m1Le + adresseIgLe + m2Le). Décision de comportement
  // (l'accusé « non reconnue » devrait-il compter dans le plafond de 3 ?) : à prendre par le fondateur, rien n'est changé ici.
  it.todo("B1 · merci après adresse + OK (m1Le, adresseIgLe, m2Le = 3 messages) : retenu par le plafond de 3 (plafond_personne) ; à trancher : l'accusé « non reconnue » doit-il compter ?");
});
