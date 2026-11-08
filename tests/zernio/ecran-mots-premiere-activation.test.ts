/** Première activation du mot GUIDE depuis /mots : validation côté serveur, bouton par compte, aucun texte côté client, aucun réseau. Valeurs fictives. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot } from "@/services/mots-service";

let session = true;
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session) throw new Error("NON_CONNECTE");
    return {};
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const reseau = vi.fn(async () => new Response("{}"));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const { lireParametre } = await import("@/services/_commun");
const S = await import("@/services/mots-service");
const Ges = await import("@/services/mots-gestes");
const actions = await import("@/app/(studio)/mots/actions");
const { default: PageMots } = await import("@/app/(studio)/mots/page");
const { EcranMots } = await import("@/components/mots/EcranMots");
const { phraseRefus } = await import("@/components/mots/etat-mots");

const COMPTE = "compte_fictif_1";
const ligne = async () => (await lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {}))[`GUIDE|${COMPTE}`];
const ENV = { MOTS_ENABLED: "1", PARCOURS_CONVERSATION_TITRE_GUIDE: "Guide fictif" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", reseau);
  reinitialiserDepots();
  S.injecterExecuteurMots(async () => {
    throw new Error("appel réseau interdit");
  });
  session = true;
  vi.stubEnv("MOTS_ENABLED", "1");
  vi.stubEnv("PARCOURS_CONVERSATION_TITRE_GUIDE", "Guide fictif");
  vi.stubEnv("PARCOURS_CONVERSATION_COMPTES", `${COMPTE}, compte_fictif_2`);
});

describe("service : source officielle et validation serveur", () => {
  it("sans validation : l'activation est refusée avec mot_non_valide, aucune ligne", async () => {
    const r = await actions.activerMotLocalAction(COMPTE);
    expect(r).toMatchObject({ issue: "refuse", raison: "mot_non_valide" });
    expect(await ligne()).toBeUndefined();
    expect(phraseRefus("mot_non_valide")).toBe("Les textes de ce mot ne sont pas validés.");
  });

  it("validation puis activation : ligne GUIDE|compte actif, idWorkflow null, raison local, sans réseau", async () => {
    expect((await S.lireVueMots(ENV)).guideValide).toBe(false);
    const v = await actions.validerMotGuideAction();
    expect(v).toEqual({ ok: true, raison: "valide" });
    expect((await S.lireVueMots(ENV)).guideValide).toBe(true);
    const r = await actions.activerMotLocalAction(COMPTE);
    expect(r.issue).toBe("execute");
    expect(await ligne()).toMatchObject({ mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: "local" });
    expect(reseau).not.toHaveBeenCalled();
  });

  it("la vue n'expose aucun texte, seulement un booléen", async () => {
    await actions.validerMotGuideAction();
    const vue = await S.lireVueMots(ENV);
    expect(JSON.stringify(vue)).not.toMatch(/Message automatique/);
    expect(typeof vue.guideValide).toBe("boolean");
  });
});

describe("session exigée", () => {
  it("sans session : page et actions refusent, rien n'est écrit", async () => {
    session = false;
    await expect(PageMots()).rejects.toThrow("NON_CONNECTE");
    await expect(actions.validerMotGuideAction()).rejects.toThrow("NON_CONNECTE");
    await expect(Ges.gesteComptesGuide()).rejects.toThrow("NON_CONNECTE");
    session = true;
    expect((await S.lireVueMots(ENV)).guideValide).toBe(false);
  });
  it("la page transmet les comptes (identifiants seulement)", async () => {
    const el = (await PageMots()) as { props: { comptes: string[] } };
    expect(el.props.comptes).toEqual([COMPTE, "compte_fictif_2"]);
  });
});

const vueVide = { guidePerime: false, interrupteurAllume: false, toutArrete: false, disjoncteur: { ouvert: false, raison: null, ouvertLe: null }, plafonds: { heureCompte: 600, jourMot: 100 }, lignes: [] as LigneMot[], oppositions: 0, guideValide: false };
const services = () => ({
  mettreEnPause: vi.fn(),
  reactiver: vi.fn(),
  activerLocal: vi.fn(),
  mettreEnPauseLocal: vi.fn(),
  refermerDisjoncteur: vi.fn(),
  reglerPlafonds: vi.fn(),
  validerGuide: vi.fn(),
});

describe("écran", () => {
  it("bloc Mot GUIDE toujours visible, avec bouton de validation et un bouton Activer par compte sans ligne", () => {
    const html = renderToStaticMarkup(createElement(EcranMots, { vue: vueVide, services: services() as never, comptes: [COMPTE, "compte_fictif_2"] }));
    expect(html).toContain("Mot GUIDE");
    expect(html).toContain("Valider les textes du mot GUIDE");
    expect(html.match(/Activer le mot GUIDE/g)).toHaveLength(2);
    expect(html).toContain(COMPTE);
    expect(html).toContain("Aucun mot posé");
  });
  it("un compte qui a déjà une ligne GUIDE n'a plus le bouton d'activation du bloc", () => {
    const l: LigneMot = { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: "local", modifieLe: "" };
    const html = renderToStaticMarkup(createElement(EcranMots, { vue: { ...vueVide, lignes: [l] }, services: services() as never, comptes: [COMPTE, "compte_fictif_2"] }));
    expect(html.match(/Activer le mot GUIDE/g)).toHaveLength(1);
    expect(html).toContain("Mettre en pause");
  });
  it("le composant client ne contient aucun texte du mot ni du dictionnaire", () => {
    for (const f of ["src/components/mots/EcranMots.tsx", "src/components/mots/EcranMotsConnecte.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/Message automatique|reponsePublique|messagePrive/);
    }
    // l'action de validation ne prend aucun argument : le client ne peut rien transmettre
    expect(actions.validerMotGuideAction.length).toBe(0);
  });
  it("dictionnaire inchangé", () => {
    const h = createHash("sha256").update(readFileSync("contrats/dictionnaire-textes-mp.v2.json")).digest("hex");
    expect(h).toBe("2acad2a6ed24250b65df4e6693c6e0614bafe4921140e119aa53b21d9ee4671e");
  });
});


/* ------------------------------------------------------------------ */
/* Corrections de l'audit : B1 (empreinte liée aux textes envoyés) et B2 (compte hors liste)  */
/* ------------------------------------------------------------------ */
const { TEXTES_MP, rendreTexteMp } = await import("@/domaine/guide-reseau/textes-mp");
const { empreinteGuideParcours, textesGuideEnvoyes, comptesParcours } = await import("@/domaine/guide-reseau/empreinte-guide");
const { ecrireParametre } = await import("@/services/_commun");
const { depots } = await import("@/donnees/memoire");

const IDS = ["mp-pub-igfb-v1", "mp-m1-v2", "mp-m2-v1", "mp-recu-v2"] as const;
const rendusParcours = (titre: string) => [rendreTexteMp("mp-pub-igfb-v1", {}), rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre }), rendreTexteMp("mp-m2-v1", {}), rendreTexteMp("mp-recu-v2", { titre })];
const attendue = (titre: string) => createHash("sha256").update(JSON.stringify(["guide-parcours-v1", IDS.map((id, n) => [id, TEXTES_MP[id].version, rendusParcours(titre)[n]])])).digest("hex");
const validation = () => S.lireValidationGuideParcours();
const refus = (r: { issue: string; raison?: string }) => ({ issue: r.issue, raison: r.raison });

describe("B1 · empreinte liée aux 4 textes réellement envoyés", () => {
  it("l'empreinte validée = celle recalculée des 4 rendus du parcours ; changer M2 seul la change", async () => {
    expect(await actions.validerMotGuideAction()).toEqual({ ok: true, raison: "valide" });
    const v = await validation();
    expect(v?.empreinte).toBe(attendue("Guide fictif"));
    const e = empreinteGuideParcours("Guide fictif");
    expect(e).toEqual({ ok: true, empreinte: attendue("Guide fictif") });
    const t = textesGuideEnvoyes("Guide fictif");
    expect(t.ok && t.textes.m2).toBe(rendreTexteMp("mp-m2-v1", {}));
    const origine = TEXTES_MP["mp-m2-v1"];
    try {
      (TEXTES_MP as Record<string, unknown>)["mp-m2-v1"] = { ...origine, texte: `${origine.texte} (modifié)` };
      const e2 = empreinteGuideParcours("Guide fictif");
      expect(e2.ok && e2.empreinte).not.toBe(attendue("Guide fictif"));
    } finally {
      (TEXTES_MP as Record<string, unknown>)["mp-m2-v1"] = origine;
    }
  });
  it("titre absent / vide : raison titre_guide_absent ; titre avec espaces : même empreinte côté validation et parcours", async () => {
    expect(textesGuideEnvoyes("   ")).toEqual({ ok: false, raison: "titre_guide_absent" });
    expect(empreinteGuideParcours("")).toEqual({ ok: false, raison: "titre_guide_absent" });
    vi.stubEnv("PARCOURS_CONVERSATION_TITRE_GUIDE", "  Guide fictif  ");
    expect(await actions.validerMotGuideAction()).toEqual({ ok: true, raison: "valide" });
    expect((await validation())?.empreinte).toBe(attendue("Guide fictif"));
    expect(refus(await actions.activerMotLocalAction(COMPTE)).issue).toBe("execute");
  });
  it("titre changé après validation : activation refusée validation_perimee, vue « à revalider »", async () => {
    await actions.validerMotGuideAction();
    vi.stubEnv("PARCOURS_CONVERSATION_TITRE_GUIDE", "Autre guide fictif");
    expect(refus(await actions.activerMotLocalAction(COMPTE))).toEqual({ issue: "refuse", raison: "validation_perimee" });
    expect(await ligne()).toBeUndefined();
    const vue = await S.lireVueMots({ ...ENV, PARCOURS_CONVERSATION_TITRE_GUIDE: "Autre guide fictif" });
    expect(vue.guideValide).toBe(false);
    expect(vue.guidePerime).toBe(true);
    expect(JSON.stringify(vue)).not.toMatch(/Message automatique/);
    await actions.validerMotGuideAction();
    expect(refus(await actions.activerMotLocalAction(COMPTE)).issue).toBe("execute");
  });
  it("sans titre côté serveur : la validation et l'activation rendent titre_guide_absent", async () => {
    vi.stubEnv("PARCOURS_CONVERSATION_TITRE_GUIDE", "");
    expect(await actions.validerMotGuideAction()).toEqual({ ok: false, raison: "titre_guide_absent" });
    expect(await validation()).toBeNull();
  });
  it("mots/GUIDE.md présent : validation refusée guide_fichier_present, rien écrit", async () => {
    const avant = existsSync("mots");
    mkdirSync("mots", { recursive: true });
    writeFileSync("mots/GUIDE.md", "fichier d'essai");
    try {
      expect(await actions.validerMotGuideAction()).toEqual({ ok: false, raison: "guide_fichier_present" });
      expect(await validation()).toBeNull();
      expect(await lireParametre(S.PARAM_VALIDATIONS_MOTS, {})).toEqual({});
    } finally {
      rmSync("mots/GUIDE.md", { force: true });
      if (!avant) rmSync("mots", { recursive: true, force: true });
    }
  });
  it("mots.validations inchangé par la validation du GUIDE ; validerMot + poserMot d'un autre mot comme avant", async () => {
    await actions.validerMotGuideAction();
    expect(await lireParametre(S.PARAM_VALIDATIONS_MOTS, {})).toEqual({});
    const saisie = { mot: "AUTRE", reponsePublique: "Réponse fictive {lien}", messagePrive: "Message fictif {lien}", fin: "Fin fictive" };
    const v = await S.validerMot({ saisie, confirmeParOperateur: true });
    expect(v.ok).toBe(true);
    expect(await lireParametre(S.PARAM_VALIDATIONS_MOTS, {})).toEqual({ AUTRE: v.empreinte });
    const r = await S.poserMot({ compte: COMPTE, saisie, confirmeParOperateur: true, env: { MOTS_ENABLED: "0" } });
    expect(r.issue).toBe("simule");
  });
  it("une validation écrite avec une fausse empreinte bloque l'activation (validation_perimee)", async () => {
    await ecrireParametre(S.PARAM_VALIDATION_GUIDE_PARCOURS, { empreinte: "0".repeat(64), valideLe: "x" });
    expect(refus(await actions.activerMotLocalAction(COMPTE))).toEqual({ issue: "refuse", raison: "validation_perimee" });
  });
});

describe("B2 · un compte hors PARCOURS_CONVERSATION_COMPTES ne peut pas être activé", () => {
  it("action et service direct : refusé compte_hors_liste, aucune ligne créée", async () => {
    await actions.validerMotGuideAction();
    expect(refus(await actions.activerMotLocalAction("compte_inconnu"))).toEqual({ issue: "refuse", raison: "compte_hors_liste" });
    expect(refus(await S.activerMotLocal({ mot: "GUIDE", compte: "compte_inconnu", confirmeParOperateur: true }))).toEqual({ issue: "refuse", raison: "compte_hors_liste" });
    expect(Object.keys(await lireParametre(S.PARAM_REGISTRE_MOTS, {}))).toHaveLength(0);
  });
  it("le refus du geste précède tout appel (même sans validation)", async () => {
    expect(refus(await Ges.gesteActiverMotLocal("compte_inconnu"))).toEqual({ issue: "refuse", raison: "compte_hors_liste" });
  });
  it("ligne locale en pause + compte retiré + Réactiver : refusé", async () => {
    await actions.validerMotGuideAction();
    await actions.activerMotLocalAction(COMPTE);
    await actions.mettreEnPauseLocalAction("GUIDE", COMPTE);
    vi.stubEnv("PARCOURS_CONVERSATION_COMPTES", "compte_fictif_2");
    expect(refus(await actions.reactiverAction("GUIDE", COMPTE))).toEqual({ issue: "refuse", raison: "compte_hors_liste" });
    expect((await ligne())?.etat).toBe("pause");
  });
  it("comptesParcours : liste nettoyée", () => {
    expect(comptesParcours({ PARCOURS_CONVERSATION_COMPTES: " a, b ,,c" })).toEqual(["a", "b", "c"]);
  });
  it("ligne active + compte retiré : pauserGuidesHorsListe la met en pause_auto, une alerte ; ligne Zernio intacte", async () => {
    await actions.validerMotGuideAction();
    await actions.activerMotLocalAction(COMPTE);
    await actions.activerMotLocalAction("compte_fictif_2");
    const env = { ...ENV, PARCOURS_CONVERSATION_COMPTES: "compte_fictif_2" };
    await S.pauserGuidesHorsListe(env);
    expect((await ligne())?.etat).toBe("pause_auto");
    expect((await lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {}))["GUIDE|compte_fictif_2"].etat).toBe("actif");
    const alertes = await depots().evenements.lister((e: { message: string }) => /ALERTE|retiré/.test(e.message));
    expect(alertes.length).toBeGreaterThanOrEqual(1);
  });
  it("pauserGuidesHorsListe n'est jamais appelée depuis une section sous verrou (sousVerrou non réentrant)", () => {
    const src = readFileSync("src/services/mots-service.ts", "utf8");
    const corps = src.slice(src.indexOf("export async function pauserGuidesHorsListe"));
    expect(corps.slice(0, corps.indexOf("\n}\n"))).not.toMatch(/await (activerMotLocal|changerEtat|mettreEnPause|reactiverMot)\(/);
    expect(src.match(/sousVerrou\([^\n]*pauserGuidesHorsListe/g) ?? []).toHaveLength(0);
  });
});

describe("phrases et écran", () => {
  it("chaque raison a sa phrase propre (jamais « Demande refusée »)", () => {
    const raisons = ["validation_perimee", "compte_hors_liste", "guide_fichier_present", "texte_dictionnaire_incomplet", "titre_guide_absent", "mot_non_pris_en_charge"];
    const phrases = raisons.map((r) => phraseRefus(r));
    expect(new Set(phrases).size).toBe(raisons.length);
    for (const p of phrases) expect(p).not.toBe("Demande refusée.");
    expect(phraseRefus("n_importe_quoi")).toBe("Demande refusée.");
  });
  it("pastille « à revalider » si la validation est périmée, « Textes validés » si valide, « non validés » sinon", () => {
    const rendu = (v: object) => renderToStaticMarkup(createElement(EcranMots, { vue: { ...vueVide, ...v }, services: services() as never, comptes: [COMPTE] }));
    expect(rendu({ guidePerime: true })).toContain("à revalider");
    expect(rendu({ guideValide: true })).toContain("Textes validés");
    expect(rendu({})).toContain("Textes non validés");
  });
  it("le compte est visible sur chaque carte de ligne (data-compte)", () => {
    const l: LigneMot[] = [
      { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: "local", modifieLe: "" },
      { mot: "GUIDE", compte: "compte_fictif_2", etat: "pause", idWorkflow: null, raison: "local", modifieLe: "" },
    ];
    const html = renderToStaticMarkup(createElement(EcranMots, { vue: { ...vueVide, lignes: l }, services: services() as never, comptes: [] }));
    expect(html).toMatch(new RegExp(`data-mot="GUIDE"[^>]*data-compte="${COMPTE}"|data-compte="${COMPTE}"[^>]*data-mot="GUIDE"`));
    expect(html).toMatch(/data-compte="compte_fictif_2"/);
    expect(html).toContain(`>${COMPTE}<`);
  });
});
