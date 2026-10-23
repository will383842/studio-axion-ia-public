/**
 * RACCORDS FINAUX DU TABLEAU ANIMÉ : la fiche sur « Votre vidéo » (`vueTableau`), les boutons qui agissent
 * (`retoucherTableauAction`), la fin tirée de `fiche.appelId` (jamais une fin non validée), et le cas masqué.
 * Dépôts en mémoire, doubles de la chaîne (`tests/tableau/moteur/doubles.ts`) : aucun appel réseau.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import type { FinTable } from "../../../src/briques/fins";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { contexteExemple, copie, ficheDemonstration, AUJOURDHUI_EXEMPLES } from "../regles/exemples";
import { banc, versOutils } from "../moteur/doubles";
import { doubles } from "../fabriquer/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

/** Le format est actif ; le cas « masqué » est SIMULÉ (`ouvert = false`), sans lire la valeur réelle du statut. */
const aiguillage = vi.hoisted(() => ({ ouvert: false }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: (f: { id: string; statut: string } | null | undefined) => (aiguillage.ouvert ? vrai.ecranTableauVisible(f as never) : false) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const boucle = await import("@/services/boucle");
const { vueTableau, construireVueTableau } = await import("@/services/tableau-vue");
const { retoucherTableauAction } = await import("@/app/(studio)/videos/actions-tableau");
const { finDuTableau, AUCUNE_FIN_VALIDEE } = await import("@/services/tableau-fin");
const { TARIF_VOIX_CENTIMES_PAR_CARACTERE } = await import("@/services/tableau-outils");
const { brancherServicesTableau, CATALOGUE_RETOUCHES } = await import("@/moteurs/montage-tableau");
const { estimerFabrication, fabriquerTableau, FIN_SANS_APPEL_LIENS, ID_SCENE_FIN } = await import("@/moteurs/montage-tableau/fabriquer");
const { formatTableauAnime } = await import("@/formats/tableau-anime");

const MDP = "tableau-raccords";
const VIDEO = "v-03";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  aiguillage.ouvert = true;
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(ficheDemonstration);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});

/** v-03 devient une vraie vidéo du tableau animé ; `fiche` rangée dans le projet de montage (retouchée) ou nulle part. */
async function videoTableau(fiche: unknown | null, options: { stockage?: boolean } = {}) {
  const b = banc(ficheDemonstration);
  const c = { ...b.commande(ficheDemonstration), videoId: VIDEO };
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  const commande = fiche === null ? { ...c, entrees: {} } : c;
  await depots().videos.modifier(VIDEO, { formatId: "tableau-anime", estDemo: false });
  await depots().versions.modifier(ver.id, { commande, estDemo: false, projetMontage: fiche !== null && !options.stockage ? { moteur: "montage-tableau", tableau: { journal: { version: "fabrication-tableau/1", etapes: {} }, fiche, retouchee: true } } : {} });
  // La chaîne de la retouche reçoit les doubles (aucun fournisseur réel).
  brancherServicesTableau({ outils: async () => versOutils(b.d, b.fiches) });
  return { b, versionId: ver.id, cle: (c.entrees as { tableau: { ficheScenesCle: string } }).tableau.ficheScenesCle };
}

const dependances = (lire?: (cle: string) => Promise<unknown>) => ({ aujourdhui: AUJOURDHUI_EXEMPLES, ...(lire ? { lireStockage: lire } : {}) });
const nbVersions = () => depots().versions.compter((x) => x.videoId === VIDEO);

describe("raccord 1 · vueTableau", () => {
  it("fiche valide (lue dans le stockage) : aucun refus, coût de la voix au tarif existant, boutons du catalogue", async () => {
    const { cle } = await videoTableau(ficheDemonstration, { stockage: true });
    const lues: string[] = [];
    const vue = await vueTableau(VIDEO, dependances(async (k) => (lues.push(k), structuredClone(ficheDemonstration))));
    expect(lues).toEqual([cle]);
    expect(vue?.erreur).toBeNull();
    expect(vue?.problemes).toEqual([]);
    expect(vue?.fiche?.scenes).toHaveLength(ficheDemonstration.scenes.length);
    // 14/10 : contrôle de ressemblance de la voix actif par défaut : le prix montré couvre 2 lectures au plus par défaut (1 relance).
    expect(vue?.coutCentimes).toBe(estimerFabrication(ficheDemonstration, TARIF_VOIX_CENTIMES_PAR_CARACTERE, [], { lecturesVoixMax: 2 }).centimes);
    expect(vue?.coutCentimes).toBeGreaterThan(0);
    expect(vue?.retouches).toHaveLength(Object.keys(CATALOGUE_RETOUCHES).length);
    expect(vue?.retouches.find((r) => r.cle === "modifierTexteDit")).toEqual({ cle: "modifierTexteDit", libelle: CATALOGUE_RETOUCHES.modifierTexteDit.libelle, payant: true });
    expect(vue?.retouches.find((r) => r.cle === "remplacerDessin")?.payant).toBe(false);
    // Listes fermées tirées de la fiche : aucune coordonnée.
    expect(vue?.choix?.scenes.map((s) => s.libelle)).toEqual(ficheDemonstration.scenes.map((_, i) => `Scène ${i + 1}`));
    expect(JSON.stringify(vue?.choix)).not.toMatch(/"x"|"y"|coordonn/);
  });

  it("fiche retouchée : celle du projet de montage, sans lire le stockage", async () => {
    const f = copie(ficheDemonstration);
    f.scenes[2].elements = f.scenes[2].elements.map((e) => (e.type === "dessin" ? { ...e, dessinId: "loupe" } : e));
    await videoTableau(f);
    const vue = await vueTableau(VIDEO, dependances(async () => {
      throw new Error("ne doit pas lire le stockage");
    }));
    expect(vue?.erreur).toBeNull();
    expect(JSON.stringify(vue?.fiche)).toContain('"dessinId":"loupe"');
  });

  it("fiche refusée par les règles : les refus en phrases, aucun bouton de retouche, aucune exception", async () => {
    const f = copie(ficheDemonstration);
    f.scenes[2].elements = f.scenes[2].elements.map((e) => (e.type === "dessin" ? { ...e, dessinId: "dessin-inconnu" } : e));
    await videoTableau(f);
    const vue = await vueTableau(VIDEO, dependances());
    expect(vue?.problemes.length).toBeGreaterThan(0);
    expect(vue?.fiche).not.toBeNull();
    expect(vue?.retouches).toEqual([]);
  });

  it("fiche absente ou illisible : une phrase simple, jamais d'exception", async () => {
    await videoTableau(null);
    expect(await vueTableau(VIDEO, dependances())).toMatchObject({ fiche: null, erreur: "La fiche de scènes de cette vidéo est introuvable." });
    await videoTableau(ficheDemonstration, { stockage: true });
    const panne = await vueTableau(VIDEO, dependances(async () => {
      throw new Error("réseau coupé");
    }));
    expect(panne).toMatchObject({ fiche: null });
    expect(panne?.erreur).toMatch(/n'a pas pu être lue/);
    expect(construireVueTableau({ pas: "une fiche" }, { aujourdhui: AUJOURDHUI_EXEMPLES, sourcesChiffres: [], preuves: [], matieres: [] }, 1)).toMatchObject({ fiche: null, retouches: [] });
  });
});

describe("raccord 2 · les boutons agissent", () => {
  it("retouche gratuite : lancée par le chemin de retouche du studio, opération transmise au moteur", async () => {
    await videoTableau(ficheDemonstration);
    const avant = await nbVersions();
    const r = await retoucherTableauAction(VIDEO, { type: "remplacerDessin", sceneId: "s03", elementId: "e06", dessinId: "loupe" });
    expect(r).toMatchObject({ ok: true, donnees: { statut: "lancee" } });
    const travailId = r.ok && r.donnees.statut === "lancee" ? r.donnees.travailId : "";
    const travail = await depots().travaux.obtenir(travailId);
    expect(travail).toMatchObject({ type: "retouche", statut: "en_file" });
    expect((travail?.parametres as { tableau: { fiche: FicheTableau; retouchee: boolean } }).tableau).toMatchObject({ retouchee: true });
    expect(JSON.stringify((travail?.parametres as { tableau: { fiche: unknown } }).tableau.fiche)).toContain('"dessinId":"loupe"');
    expect(await nbVersions()).toBe(avant + 1);
  });

  it("retouche payante (voix refaite) : refusée sans accord sur le montant annoncé, rien n'est lancé", async () => {
    await videoTableau(ficheDemonstration);
    const avant = await nbVersions();
    const op = { type: "modifierTexteDit", sceneId: "s03", texte: "Geste deux : demandez trois idées de publication à partir de la question." };
    for (const accord of [undefined, true, 0]) {
      const r = await retoucherTableauAction(VIDEO, op, accord);
      expect(r).toMatchObject({ ok: true, donnees: { statut: "accord-requis" } });
      if (r.ok && r.donnees.statut === "accord-requis") {
        expect(r.donnees.centimes).toBeGreaterThan(0);
        expect(r.donnees.phrase).toMatch(/refait la voix/);
      }
    }
    expect(await nbVersions()).toBe(avant);
    expect(await depots().reservations.compter((x) => x.videoId === VIDEO && x.statut === "active")).toBe(0);
    // Avec le montant annoncé : lancée.
    const annonce = await retoucherTableauAction(VIDEO, op);
    const montant = annonce.ok && annonce.donnees.statut === "accord-requis" ? annonce.donnees.centimes : -1;
    expect(await retoucherTableauAction(VIDEO, op, montant - 1)).toMatchObject({ ok: true, donnees: { statut: "accord-requis" } });
    expect(await retoucherTableauAction(VIDEO, op, montant)).toMatchObject({ ok: true, donnees: { statut: "lancee" } });
    expect(await nbVersions()).toBe(avant + 1);
  });

  it("refus des règles ou bouton inconnu : la phrase, rien n'est lancé", async () => {
    await videoTableau(ficheDemonstration);
    const avant = await nbVersions();
    const inconnu = await retoucherTableauAction(VIDEO, { type: "remplacerDessin", sceneId: "s03", elementId: "e06", dessinId: "dessin-inconnu" });
    expect(inconnu).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
    const horsCatalogue = await retoucherTableauAction(VIDEO, { type: "agrandir", sceneId: "s03" });
    expect(horsCatalogue).toMatchObject({ ok: true, donnees: { statut: "refusee", phrase: "Cette retouche ne fait pas partie des boutons proposés." } });
    const fin = await retoucherTableauAction(VIDEO, { type: "changerFin", appelId: "fin-if-abonnement" });
    expect(fin).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
    expect(await nbVersions()).toBe(avant);
  });
});

describe("raccord 3 · la fin vient de fiche.appelId", () => {
  const VALIDEE: FinTable = { id: "fin-essai-validee", groupe: "instagram-facebook", type: "abonnement", dit: "Abonnez-vous pour la suite.", ecran: "Abonnez-vous pour la suite", validee: true };

  it("une fin validée est utilisée ; une fin non validée est écartée, avec la phrase claire", () => {
    expect(finDuTableau("instagram", "fin-essai-validee", [VALIDEE])).toEqual({ id: "fin-essai-validee", ecran: "Abonnez-vous pour la suite" });
    expect(finDuTableau("instagram", "fin-essai-validee", [{ ...VALIDEE, validee: false }])).toEqual({ absente: AUCUNE_FIN_VALIDEE });
    // Table réelle : seule la fin « Écrivez {MOT} en commentaire » est validée (11/10), et ce fichier n'en valide aucune.
    expect(finDuTableau("instagram", "fin-if-abonnement")).toEqual({ absente: AUCUNE_FIN_VALIDEE });
    // TikTok et Shorts (12/10) : aucune fin validée sans promesse d'envoi, la vidéo se termine sans appel (alerte).
    expect(finDuTableau("tiktok", "fin-ty-diagnostic")).toEqual({ absente: FIN_SANS_APPEL_LIENS });
    // Sans mot à commenter : pas de fin, et la raison est dite.
    expect(finDuTableau("instagram", null)).toMatchObject({ absente: expect.stringMatching(/mot à commenter/) });
    expect(AUCUNE_FIN_VALIDEE).toMatch(/^Aucune fin validée pour ce réseau/);
  });

  it("la chaîne rend la fin validée tirée de l'appel de la fiche", async () => {
    const f = { ...copie(ficheDemonstration), appelId: VALIDEE.id };
    const d = doubles(f);
    const r = await fabriquerTableau({ ...d.outils, lireFiche: async () => structuredClone(f), choisirFin: (id) => finDuTableau("instagram", id, [VALIDEE]) });
    expect(r.fin).toEqual({ id: VALIDEE.id, ecran: VALIDEE.ecran });
    const scene = d.scenesSoumises().find((s) => JSON.stringify(s.parametres).includes(`"id":"${ID_SCENE_FIN}"`));
    const proprietes = (scene?.parametres as { proprietes: { page: { elements: { lignes: { texte: string }[] }[] } } }).proprietes;
    expect(proprietes.page.elements.flatMap((e) => e.lignes.map((l) => l.texte)).join(" ")).toBe(VALIDEE.ecran);
  });

  it("fin non validée : la vidéo se fabrique sans écran de fin, sans échec, et le rapport le dit", async () => {
    const b = banc(ficheDemonstration, { choisirFin: (id) => finDuTableau("instagram", id) });
    const c = b.commande({ ...copie(ficheDemonstration), appelId: "fin-if-abonnement" });
    let t = await b.moteur.lancer(c, { travailId: "t-fin", versionId: "ver-fin", titre: "Essai" });
    let resultat;
    for (let n = 0; n < 200 && t.statut !== "termine" && t.statut !== "echec"; n++) {
      const r = await b.moteur.avancer(JSON.parse(JSON.stringify(t)), c, Date.UTC(2026, 9, 11) + n * 1000);
      t = r.travail;
      resultat = r.resultat ?? resultat;
    }
    expect(t.statut).toBe("termine");
    expect(b.d.scenesSoumises().some((s) => JSON.stringify(s.parametres).includes(`"id":"${ID_SCENE_FIN}"`))).toBe(false);
    expect(resultat?.noteQualite.alertes).toContainEqual({ code: "fin", gravite: "info", message: AUCUNE_FIN_VALIDEE });
    expect((resultat?.projetMontage.tableau as { fin?: unknown }).fin).toEqual({ absente: AUCUNE_FIN_VALIDEE });
  });
});

describe("cas masqué", () => {
  it("format masqué (simulé) : ni fiche, ni bouton, ni retouche", async () => {
    await videoTableau(ficheDemonstration);
    aiguillage.ouvert = false;
    expect(await vueTableau(VIDEO, dependances())).toBeNull();
    const avant = await nbVersions();
    const r = await retoucherTableauAction(VIDEO, { type: "remplacerDessin", sceneId: "s03", elementId: "e06", dessinId: "loupe" });
    expect(r).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
    expect(await nbVersions()).toBe(avant);
  });

  it("la fiche vidéo ne lit et ne montre la fiche du tableau que derrière l'aiguillage", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(studio)/videos/[id]/page.tsx"), "utf8");
    expect(page).toContain("const vueTab = tableau ? await vueTableau(v.id) : null;");
    expect(page.split("<VotreFicheTableau").length - 1).toBe(1);
    expect(page).toContain("{tableau && vueTab && <VotreFicheTableau ");
  });
});
