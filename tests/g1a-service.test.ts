/**
 * G1a : SERVICE DU GÉNÉRATEUR, en simulation (aucune clé, aucun appel, aucune dépense).
 * Critères de fin (plan v5 B.10, ligne G1a) : N versions codées (5 puis 2 réseaux) ; 100 attributions concurrentes sans
 * doublon ; brouillon sans numéro tant qu'aucun appel payant ; retoucher TikTok ne change pas LinkedIn ; retoucher le
 * corps passe les N en « à revoir » ; archivage en cascade, réservations libérées ; grille 2 formats + 1 « je lis » ;
 * `enregistrerScriptDuBrouillon` qui répartit ; migration idempotente.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { matiere, preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const scripts = await import("@/services/scripts");
const videos = await import("@/services/videos");
const { migrerDonnees } = await import("@/services/migrations");
const { etape19Generateur } = await import("@/services/migrations/etape-19-generateur");
import { assemblerBlocs, texteDesBlocs, versionsCourantes } from "@/domaine/derivations-generateur";
import { historiqueSerie } from "@/domaine/variete";
import type { BlocScript, Video } from "@/domaine/types";

const MDP = "essai-g1a-service";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const CINQ = ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"] as const;

async function sujetAvecMatiere(reseaux: readonly (typeof CINQ)[number][] = CINQ, idee = "ChatGPT peut-il lire vos factures ?") {
  const m = matiere("La première fois que j'ai vu ses tableaux, j'ai compté 47 onglets.");
  await depots().matieres.enregistrer(m);
  const s = await gen.creerSujet({ idee, reseaux: [...reseaux], formatId: "avocat", motCle: "factures ChatGPT" });
  return { s, m };
}

describe("brouillon sans numéro, puis numéro au premier appel payant", () => {
  it("un sujet naît brouillon ; sans matière : arrêt gratuit ANCRAGE_MANQUANT, toujours sans numéro, aucune génération", async () => {
    const s = await gen.creerSujet({ idee: "Une idée sans matière", reseaux: ["tiktok"], formatId: "avocat" });
    expect(s.numero).toBeUndefined();
    expect(s.etat).toBe("brouillon");
    const r = await gen.ecrireSujetSimule(s.id);
    expect(r).toEqual({ ok: false, manque: "ANCRAGE_MANQUANT", message: "Il manque une matière." });
    const apres = await depots().scriptsMaitres.obtenir(s.id);
    expect(apres?.numero).toBeUndefined();
    expect(apres?.etat).toBe("brouillon");
    expect(apres?.manque?.type).toBe("ANCRAGE_MANQUANT");
    expect(await depots().generations.compter()).toBe(0);
    expect(await depots().variantes.compter()).toBe(0);
    const [vue] = await gen.listerSujets();
    expect(vue.etat).toBe("brouillon");
  });

  it("une phrase de Will devient une matière (validée, verbatim) et suffit à écrire", async () => {
    const s = await gen.creerSujet({ idee: "Le PV", phraseWill: "J'ai reçu un PV la semaine dernière, j'ai attendu.", reseaux: ["tiktok"], formatId: "avocat" });
    const [mid] = s.brief.matiereIdsImposees!;
    const mat = await depots().matieres.obtenir(mid);
    expect(mat).toMatchObject({ texte: "J'ai reçu un PV la semaine dernière, j'ai attendu.", statut: "validee", saisiePar: "will", type: "anecdote-will" });
    const r = await gen.ecrireSujetSimule(s.id);
    expect(r.ok).toBe(true);
    const script = (await depots().scripts.lister((x) => x.scriptMaitreId === s.id))[0];
    expect(script.blocs[0].segments[0]).toMatchObject({ texte: mat!.texte, sourceTexte: { matiereId: mid } });
  });

  it("100 attributions CONCURRENTES dans le même processus : aucun doublon, 1 à 100", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      const id = `suj-conc-${i}`;
      await depots().scriptsMaitres.enregistrer({ id, version: 1, brief: {} as never, ancrages: [], marqueId: "marque-axion", contexteAxionVersion: 0, creeLe: "2026-10-02T00:00:00Z", modifieLe: "2026-10-02T00:00:00Z" });
      ids.push(id);
    }
    const numeros = await Promise.all(ids.map((id) => gen.attribuerNumero(id)));
    expect(new Set(numeros).size).toBe(100);
    expect([...numeros].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    // Idempotent : un sujet numéroté garde son numéro ; une démonstration part de 9000, à part.
    expect(await gen.attribuerNumero(ids[0])).toBe(numeros[0]);
    await depots().scriptsMaitres.enregistrer({ id: "suj-demo", version: 1, brief: {} as never, ancrages: [], marqueId: "marque-axion", contexteAxionVersion: 0, estDemo: true, creeLe: "2026-10-02T00:00:00Z", modifieLe: "2026-10-02T00:00:00Z" });
    expect(await gen.attribuerNumero("suj-demo")).toBe(9000);
    await depots().scriptsMaitres.enregistrer({ id: "suj-101", version: 1, brief: {} as never, ancrages: [], marqueId: "marque-axion", contexteAxionVersion: 0, archiveLe: "2026-10-02T00:00:00Z", creeLe: "2026-10-02T00:00:00Z", modifieLe: "2026-10-02T00:00:00Z" });
    expect(await gen.attribuerNumero("suj-101")).toBe(101);
    // Une version d'un sujet hérite de son numéro (unicité sur (numero, version)).
    await depots().scriptsMaitres.enregistrer({ id: "suj-101-v2", version: 2, parentId: "suj-101", brief: {} as never, ancrages: [], marqueId: "marque-axion", contexteAxionVersion: 0, creeLe: "2026-10-02T00:00:00Z", modifieLe: "2026-10-02T00:00:00Z" });
    expect(await gen.attribuerNumero("suj-101-v2")).toBe(101);
    await expect(gen.attribuerNumero("suj-inexistant")).rejects.toMatchObject({ code: "INTROUVABLE" });
  });
});

describe("un sujet simulé donne N versions codées", () => {
  it("5 réseaux : 1 texte commun, 5 versions « à relire », codes 0001-AV-xx, génération simulée terminée", async () => {
    const { s } = await sujetAvecMatiere();
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    expect(r.numero).toBe(1);
    expect(r.scriptIds).toHaveLength(1);
    const vs = await depots().variantes.lister((v) => v.scriptMaitreId === s.id);
    expect(vs.map((v) => v.code).sort()).toEqual(["0001-AV-FB", "0001-AV-IG", "0001-AV-LI", "0001-AV-TT", "0001-AV-YS"]);
    for (const v of vs) {
      expect(v).toMatchObject({ version: 1, etat: "a-relire", scriptId: r.scriptIds[0], formatId: "avocat" });
      expect(v.ratios[0]).toBe("9:16");
      expect(v.publication.etiquetteIAPlateforme).toBe(false);
      expect(v.dureeEstimeeSec).toBeGreaterThan(0);
    }
    // Accroches dites et premières lignes toutes différentes (C14).
    expect(new Set(vs.map((v) => v.ouverture[0].segments[0].texte)).size).toBe(5);
    expect(new Set(vs.map((v) => v.publication.premiereLigne)).size).toBe(5);
    const gen1 = await depots().generations.obtenir(r.generationId);
    expect(gen1).toMatchObject({ statut: "terminee", simulee: true, plafondUsd: 1.5, portee: "sujet" });
    const maitre = await depots().scriptsMaitres.obtenir(s.id);
    expect(maitre).toMatchObject({ numero: 1, etat: undefined });
    expect(maitre?.ancrages).toHaveLength(1);
    const script = await depots().scripts.obtenir(r.scriptIds[0]);
    expect(script).toMatchObject({ scriptMaitreId: s.id, mode: "avatar", statutEditorial: "brouillon" });
    // Aucune dépense enregistrée.
    expect(await depots().depenses.compter((x) => !!x.scriptMaitreId)).toBe(0);
  });

  it("puis 2 réseaux : 2 versions, numéro suivant", async () => {
    await gen.ecrireSujetSimule((await sujetAvecMatiere()).s.id);
    const { s } = await sujetAvecMatiere(["tiktok", "linkedin"], "Un deuxième sujet");
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    expect(r.numero).toBe(2);
    expect((await depots().variantes.lister((v) => v.scriptMaitreId === s.id)).map((v) => v.code).sort()).toEqual(["0002-AV-LI", "0002-AV-TT"]);
  });

  it("relancer la même combinaison est refusé (la version existe : on la retouche)", async () => {
    const { s } = await sujetAvecMatiere(["tiktok"]);
    await gen.ecrireSujetSimule(s.id);
    await expect(gen.ecrireSujetSimule(s.id)).rejects.toMatchObject({ code: "DEJA_ECRIT" });
  });
});

describe("retouches isolées et corps commun (B.2.6)", () => {
  it("retoucher TikTok ne change pas LinkedIn ; nouvelle version, même code, l'ancienne gardée", async () => {
    const { s } = await sujetAvecMatiere(["tiktok", "linkedin"]);
    await gen.ecrireSujetSimule(s.id);
    const avant = await depots().variantes.lister((v) => v.scriptMaitreId === s.id);
    const tt = avant.find((v) => v.reseau === "tiktok")!;
    const li = avant.find((v) => v.reseau === "linkedin")!;
    await gen.validerVariante(li.id);
    const ouverture: BlocScript[] = [{ ...tt.ouverture[0], segments: [{ id: "x", texte: "Une accroche retouchée par Will." }] }];
    const suite = await gen.retoucherVariante(tt.id, { ouverture });
    expect(suite).toMatchObject({ code: tt.code, version: 2, parentId: tt.id, etat: "a-relire" });
    expect(await depots().variantes.obtenir(tt.id)).toMatchObject({ version: 1, ouverture: tt.ouverture });
    const liApres = await depots().variantes.obtenir(li.id);
    expect(liApres).toMatchObject({ version: 1, etat: "validee", ouverture: li.ouverture, fin: li.fin, publication: li.publication });
    expect((await depots().variantes.lister((v) => v.code === li.code)).length).toBe(1);
  });

  it("retoucher le corps : nouveau texte, les N versions passent « milieu modifié, à revoir », puis « Revalider les N »", async () => {
    const { s } = await sujetAvecMatiere(["tiktok", "instagram", "linkedin"]);
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    for (const v of await depots().variantes.lister((x) => x.scriptMaitreId === s.id)) await gen.validerVariante(v.id);
    expect((await depots().scripts.obtenir(r.scriptIds[0]))?.statutEditorial).toBe("valide");
    const ancien = (await depots().scripts.obtenir(r.scriptIds[0]))!;
    const blocs = structuredClone(ancien.blocs);
    blocs[0].segments[1].texte = "Un milieu réécrit par Will.";
    const { scriptId, reportees } = await gen.retoucherCorps(ancien.id, blocs);
    expect(reportees).toHaveLength(3);
    const courantes = versionsCourantes(await depots().variantes.lister((v) => v.scriptMaitreId === s.id));
    for (const v of courantes) expect(v).toMatchObject({ scriptId, etat: "a-reverifier", version: 2 });
    expect(texteDesBlocs(assemblerBlocs((await depots().scripts.obtenir(scriptId))!, courantes[0]))).toContain("Un milieu réécrit par Will.");
    expect((await depots().scripts.obtenir(scriptId))?.statutEditorial).toBe("brouillon");
    expect(await depots().scripts.obtenir(ancien.id)).toMatchObject({ blocs: ancien.blocs }); // rien n'est effacé
    expect(await gen.revaliderVariantes(courantes.map((v) => v.id))).toBe(3);
    expect((await depots().scripts.obtenir(scriptId))?.statutEditorial).toBe("valide");
  });

  it("enregistrerScript avec un parent rattaché : la nouvelle version reste rattachée et reporte le corps", async () => {
    const { s } = await sujetAvecMatiere(["tiktok", "facebook"]);
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    const ancien = (await depots().scripts.obtenir(r.scriptIds[0]))!;
    const id = await scripts.enregistrerScript({ formatId: "avocat", sujet: ancien.sujet, blocs: [{ ...ancien.blocs[0], segments: [{ id: "n", texte: "Autre milieu." }] }], parentId: ancien.id });
    expect(await depots().scripts.obtenir(id)).toMatchObject({ scriptMaitreId: s.id, mode: "avatar", version: 2 });
    const courantes = versionsCourantes(await depots().variantes.lister((v) => v.scriptMaitreId === s.id));
    expect(courantes.every((v) => v.scriptId === id && v.etat === "a-reverifier")).toBe(true);
    await expect(scripts.validerScript(id)).rejects.toMatchObject({ code: "RATTACHE" });
  });

  it("« Revenir à la version d'avant » crée une nouvelle version identique à la précédente", async () => {
    const { s } = await sujetAvecMatiere(["tiktok"]);
    await gen.ecrireSujetSimule(s.id);
    const [v1] = await depots().variantes.lister((v) => v.scriptMaitreId === s.id);
    const v2 = await gen.retoucherVariante(v1.id, { encadre: { texte: "Autre encadré" } });
    const v3 = await gen.revenirVersionPrecedente(v2.id);
    expect(v3).toMatchObject({ version: 3, parentId: v2.id, encadre: v1.encadre, code: v1.code });
    expect(await depots().variantes.compter((v) => v.code === v1.code)).toBe(3);
  });

  it("enregistrerScriptDuBrouillon (vidéo d'une version) : ouverture et fin dans la version, corps dans le texte commun", async () => {
    const { s } = await sujetAvecMatiere(["tiktok", "linkedin"]);
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    const vs = await depots().variantes.lister((v) => v.scriptMaitreId === s.id);
    const tt = vs.find((v) => v.reseau === "tiktok")!;
    const li = vs.find((v) => v.reseau === "linkedin")!;
    const script = (await depots().scripts.obtenir(tt.scriptId))!;
    const video: Video = { ...(await depots().videos.lister())[0], id: "vid-g1a", scriptId: script.id, formatId: "avocat", statut: "brouillon", etapeEditoriale: undefined };
    await depots().videos.enregistrer(video);
    await gen.rattacherVideoAVariante(video.id, tt.id);
    expect(await depots().videos.obtenir(video.id)).toMatchObject({ reseau: "tiktok", varianteId: tt.id });

    // 1) Seule l'accroche change : nouvelle version TikTok, corps et LinkedIn intacts.
    const blocs = structuredClone(assemblerBlocs(script, tt));
    blocs[0].segments[0].texte = "Accroche écrite dans l'assistant.";
    const s1 = await videos.enregistrerScriptDuBrouillon(video.id, blocs);
    expect(s1.id).toBe(script.id);
    const tt2 = versionsCourantes(await depots().variantes.lister((v) => v.code === tt.code))[0];
    expect(tt2).toMatchObject({ version: 2, etat: "a-relire" });
    expect(tt2.ouverture[0].segments[0].texte).toBe("Accroche écrite dans l'assistant.");
    expect((await depots().variantes.obtenir(li.id))?.version).toBe(1);
    expect(await depots().videos.obtenir(video.id)).toMatchObject({ varianteId: tt2.id, scriptId: script.id });

    // 2) Le corps change : nouveau texte commun, LinkedIn « à revoir » et son segment facultatif GARDÉ.
    const blocs2 = structuredClone(assemblerBlocs(script, tt2));
    const iCorps = blocs2.findIndex((b) => b.blocRecette === script.blocs[0].blocRecette);
    blocs2[iCorps].segments[1].texte = "Un milieu changé dans l'assistant.";
    const s2 = await videos.enregistrerScriptDuBrouillon(video.id, blocs2);
    expect(s2.id).not.toBe(script.id);
    expect(texteDesBlocs(s2.blocs)).toContain("Un milieu changé dans l'assistant.");
    const liCourante = versionsCourantes(await depots().variantes.lister((v) => v.code === li.code))[0];
    expect(liCourante).toMatchObject({ scriptId: s2.id, etat: "a-reverifier" });
    const facultatifsAvant = script.blocs.flatMap((b) => b.segments).filter((x) => x.facultatif === "linkedin").map((x) => x.texte);
    expect(s2.blocs.flatMap((b) => b.segments).filter((x) => x.facultatif === "linkedin").map((x) => x.texte)).toEqual(facultatifsAvant);
    expect(facultatifsAvant.length).toBe(1); // branche prepare-moteur : l'avocat retient un segment facultatif sur LinkedIn
  });
});

describe("archivage en cascade (B.2.7)", () => {
  it("archiver un sujet archive ses versions ; restaurer ne défait que ce mouvement ; la réservation de série est libérée", async () => {
    const { s } = await sujetAvecMatiere(["tiktok", "linkedin"]);
    await gen.ecrireSujetSimule(s.id);
    const vs = await depots().variantes.lister((v) => v.scriptMaitreId === s.id);
    const li = vs.find((v) => v.reseau === "linkedin")!;
    await depots().variantes.modifier(li.id, { archiveLe: "2026-10-01T00:00:00Z" }); // rangée à part, avant
    await gen.validerVariante(vs.find((v) => v.reseau === "tiktok")!.id);
    const entrees = async () => ({ maitres: await depots().scriptsMaitres.lister(), variantes: await depots().variantes.lister() });
    expect(historiqueSerie(await entrees(), "tiktok", 10).map((e) => e.scriptMaitreId)).toEqual([s.id]);

    expect(await gen.archiverSujet(s.id)).toBe(1);
    const apres = await depots().variantes.lister((v) => v.scriptMaitreId === s.id);
    expect(apres.every((v) => !!v.archiveLe)).toBe(true);
    expect(apres.find((v) => v.reseau === "tiktok")?.archiveParCascade).toBe(s.id);
    expect(historiqueSerie(await entrees(), "tiktok", 10)).toEqual([]);
    expect(await gen.listerSujets()).toHaveLength(0);
    expect(await gen.listerSujets({ inclureArchives: true })).toHaveLength(1);

    expect(await gen.restaurerSujet(s.id)).toBe(1);
    const restaure = await depots().variantes.lister((v) => v.scriptMaitreId === s.id);
    expect(restaure.find((v) => v.reseau === "tiktok")).toMatchObject({ archiveLe: undefined, archiveParCascade: undefined });
    expect(restaure.find((v) => v.reseau === "linkedin")?.archiveLe).toBe("2026-10-01T00:00:00Z");
    expect(await depots().scriptsMaitres.compter()).toBe(1); // rien d'effacé
  });

  it("une réservation (sujet en écriture) compte dans la série, et se libère à l'archivage", async () => {
    const { s, m } = await sujetAvecMatiere(["tiktok"]);
    await depots().scriptsMaitres.modifier(s.id, { etat: "en-ecriture", choix: { structure: "AV.S1", ancrages: [{ matiereId: m.id, type: m.type, role: "principal", faible: false }], pointDeVue: "vous", emotion: "surprise", poidsFamilles: {}, relachements: [], modeRotation: "demarrage" } });
    const entrees = async () => ({ maitres: await depots().scriptsMaitres.lister(), variantes: await depots().variantes.lister() });
    expect(historiqueSerie(await entrees(), "tiktok", 10)[0]).toMatchObject({ scriptMaitreId: s.id, reserve: true });
    await gen.archiverSujet(s.id);
    expect(historiqueSerie(await entrees(), "tiktok", 10)).toEqual([]);
  });
});

describe("grille d'un sujet à 2 formats + 1 « je lis »", () => {
  it("avocat (5 réseaux) + « je lis » (TikTok) + podcast (2 réseaux) : 3 lignes, cases justes, codes -L", async () => {
    const { s } = await sujetAvecMatiere();
    await gen.ecrireSujetSimule(s.id);
    const jeLis = await gen.ecrireSujetSimule(s.id, { mode: "teleprompteur", reseaux: ["tiktok"] });
    const podcast = await gen.ecrireSujetSimule(s.id, { formatId: "podcast", reseaux: ["linkedin", "instagram"] });
    if (!jeLis.ok || !podcast.ok) throw new Error("écriture refusée");
    expect(jeLis.numero).toBe(1);
    expect((await depots().generations.obtenir(jeLis.generationId))?.portee).toBe("corps-supplementaire");
    expect((await depots().generations.obtenir(podcast.generationId))).toMatchObject({ portee: "format-supplementaire", plafondUsd: 0.7 });
    const [vue] = await gen.listerSujets();
    expect(vue.grille.map((l) => `${l.formatId}/${l.mode}/${l.adresse}`)).toEqual(["avocat/avatar/vous", "avocat/teleprompteur/vous", "podcast/teleprompteur/vous"]);
    expect(Object.values(vue.grille[0].cases).every((c) => c.etat === "a-relire")).toBe(true);
    expect(vue.grille[1].cases.tiktok.code).toBe("0001-AV-TT-L");
    expect(vue.grille[1].cases.linkedin.etat).toBe("absent");
    expect(vue.grille[2].cases.linkedin.code).toBe("0001-PO-LI-L");
    expect(vue.grille[2].cases.instagram.code).toBe("0001-PO-IG-L");
    expect(vue.grille[2].cases.tiktok.etat).toBe("absent");
    expect(vue.etat).toBe("a-relire");
    // Le « je lis » d'un format qui ne le propose pas est refusé (le registre décide, pas le générateur).
    await expect(gen.ecrireSujetSimule(s.id, { formatId: "podcast", mode: "avatar", reseaux: ["tiktok"] })).rejects.toMatchObject({ code: "QUI_PARLE" });
  });
});

describe("migration étape 19 (B.2.8)", () => {
  it("idempotente : semis complet au premier passage, rien au second ; rien n'est recréé ni effacé", async () => {
    const d = depots();
    const r1 = await etape19Generateur(d, "2026-10-02T12:00:00.000Z");
    expect(r1).toMatchObject({ ficheStyle: "vide", contexteAxion: "contexte-axion-v0" });
    expect(await d.tournesInterdites.compter((t) => t.niveau === "bloquant")).toBeGreaterThanOrEqual(68);
    expect(await d.tournesInterdites.compter((t) => t.niveau === "grappe")).toBeGreaterThanOrEqual(19);
    expect(await d.reglesDatees.compter()).toBeGreaterThanOrEqual(31);
    expect(await d.elements.obtenir("incrustation-appel-telephone")).toBeTruthy();
    const ctx = await d.contexteAxion.obtenir("contexte-axion-v0");
    expect(ctx).toMatchObject({ positionIds: [], piliers: [] });
    expect(ctx?.phraseMarque).toBeUndefined();
    expect(ctx?.valideeParWillLe).toBeUndefined();
    expect(ctx?.piliersProposes?.length).toBeGreaterThanOrEqual(5);
    expect(ctx?.interdits.every((i) => !i.confirmeLe && /Ordre de Will/.test(i.origine))).toBe(true);
    expect(await d.matieres.compter()).toBe(0);
    expect(await d.scriptsMaitres.compter()).toBe(0);
    // Une tournure archivée par Will n'est jamais recréée ; un second passage ne change rien.
    const une = (await d.tournesInterdites.lister())[0];
    await d.tournesInterdites.modifier(une.id, { archiveLe: "2026-10-02T13:00:00.000Z" });
    expect(await etape19Generateur(d, "2026-10-03T12:00:00.000Z")).toBeNull();
    expect((await d.tournesInterdites.obtenir(une.id))?.archiveLe).toBe("2026-10-02T13:00:00.000Z");
  });

  it("« Ma façon de parler » enregistrée par Will : fiche v1 tirée de ses réglages, ses mots interdits deviennent des tournures", async () => {
    const d = depots();
    await d.parametres.enregistrer({ id: "style.faconDeParler", valeur: { expressions: ["Concrètement"], motsInterdits: ["disruptif"], tutoiement: false, notes: "n" }, creeLe: "x", modifieLe: "x" });
    const r = await etape19Generateur(d, "2026-10-02T12:00:00.000Z");
    expect(r?.ficheStyle).toBe("tiree-de-ma-facon-de-parler");
    const fiche = await d.fichesStyle.obtenir("fiche-style-v1");
    expect(fiche).toMatchObject({ expressions: ["Concrètement"], motsBannis: ["disruptif"] });
    expect(fiche?.valideeParWillLe).toBeUndefined();
    const t = await d.tournesInterdites.obtenir("tournure-will-disruptif");
    expect(t).toMatchObject({ source: "will", niveau: "bloquant" });
    expect(new RegExp(t!.regex, "imu").test("Une offre disruptive")).toBe(false);
    expect(new RegExp(t!.regex, "imu").test("C'est disruptif.")).toBe(true);
  });

  it("branchée dans migrerDonnees : rapport « generateur », puis plus rien", async () => {
    const r1 = await migrerDonnees(depots(), "2026-10-02T12:00:00.000Z");
    expect(r1.lots?.generateur).toBeTruthy();
    const r2 = await migrerDonnees(depots(), "2026-10-02T13:00:00.000Z");
    expect(r2.lots?.generateur).toBeUndefined();
  });
});
