/**
 * SUJET DÉJÀ TRAITÉ · « J'AI DÉJÀ MON TEXTE » (tableau animé). Ce chemin n'a pas d'écriture : le contrôle joue dans
 * `decouperScriptTableau`, SEULEMENT pour une nouvelle vidéo (sans `videoId`), AVANT le prix, le brouillon et toute dépense.
 * Dépôts en mémoire, aucun appel à Claude.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { repereTexte } from "@/domaine/relecture-tableau";
import type { Video } from "@/domaine/types";
import { AUJOURDHUI_EXEMPLES, contexteExemple, ficheErreurCorrigee } from "../regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

// Petite banque de l'Usine : jamais d'import à froid du gros fichier dans ces tests.
vi.mock("@/donnees/bases-usine", () => ({ metiers: () => [{ code: "m1" }], casUsage: () => [] }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
const taches = await import("@/services/tableau-taches");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "tableau-texte-sujets-traites";
const fiche = ficheErreurCorrigee;
const TITRE = "Combien de temps perdez-vous sur chaque devis ?";
const TEXTE = `${TITRE} Vous perdez une heure chaque jour, et vous ne le voyez même pas. Voici un réflexe simple pour la rattraper dès ce soir.`;
const TEXTE_SANS_RAPPORT = "Vous perdez une heure chaque semaine sur votre planning de formation. Un tableau partagé évite les oublis. Voici comment le monter en dix minutes.";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  taches.tachesEnCours().clear();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});

function video(id: string, extra: Partial<Video> = {}): Video {
  const maintenant = new Date().toISOString();
  return { id, titre: TITRE, sujet: "Rédiger un devis à partir d'un modèle", formatId: "tableau-anime", statut: "prete", entrees: {}, creeLe: maintenant, modifieLe: maintenant, ...extra } as unknown as Video;
}
const donnees = (texte: string) => ({ texte, serieCode: "formation", structure: fiche.structure, douleur: "Vous perdez une heure", gesteMinute: texte.startsWith(TITRE) ? "Mesurer le temps d'un devis" : "Monter un tableau partagé", finId: "fin-if-abonnement", reseaux: ["fil-instagram-facebook"], motsDouleur: ["perdez une heure"], origine: "will" as const });
const decouper = (texte: string, options: Parameters<typeof creation.decouperScriptTableau>[1] = {}) =>
  creation.decouperScriptTableau(donnees(texte), { relu: repereTexte(texte), ...options }, { aujourdhui: AUJOURDHUI_EXEMPLES });
const nombre = (c: "videos" | "depenses") => depots()[c].compter();

describe("« J'ai déjà mon texte » : un texte dont le titre est déjà traité est refusé avant le prix", () => {
  it("même première phrase qu'une vidéo prête : refus, ni brouillon, ni dépense, ni tâche", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const avant = { videos: await nombre("videos"), depenses: await nombre("depenses") };
    const r = await decouper(TEXTE);
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut !== "sujet-deja-traite") return;
    expect(r.precedents.map((p) => p.videoId)).toEqual(["v-prete"]);
    expect(r.jeton).toMatch(/^[0-9a-f]{16}$/);
    expect({ videos: await nombre("videos"), depenses: await nombre("depenses") }).toEqual(avant);
    expect(taches.tachesEnCours().size).toBe(0);
  });

  it("le refus passe AVANT « accord requis » : sans accord, c'est déjà un refus de sujet", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    expect((await decouper(TEXTE)).statut).toBe("sujet-deja-traite");
    expect((await decouper(TEXTE_SANS_RAPPORT)).statut).toBe("accord-requis");
  });

  it("« Refaire quand même » avec le bon jeton : le prix est demandé, puis le découpage part, avec la trace au journal", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const base = await nombre("videos");
    const refus = await decouper(TEXTE);
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const sujet = { choix: "refaire" as const, jeton: refus.jeton };
    const prix = await decouper(TEXTE, { sujet });
    if (prix.statut !== "accord-requis") throw new Error(JSON.stringify(prix));
    const r = await decouper(TEXTE, { sujet, accord: prix.centimes });
    expect(r.statut).toBe("en-cours");
    expect(await nombre("videos")).toBe(base + 1);
    if (r.statut === "en-cours") {
      const journal = await depots().evenements.lister((e) => e.entiteId === r.videoId);
      expect(journal.some((e) => /sujet déjà traité.*choix « refaire »/.test(e.message))).toBe(true);
    }
  });

  it("jeton périmé (une autre vidéo est apparue) : refus de nouveau, rien d'enregistré", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await decouper(TEXTE);
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    await depots().videos.enregistrer(video("v-autre"));
    const base = await nombre("videos");
    const r = await decouper(TEXTE, { sujet: { choix: "refaire", jeton: refus.jeton }, accord: 100000 });
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut === "sujet-deja-traite") expect(r.jetonPerime).toBe(true);
    expect(await nombre("videos")).toBe(base);
  });
});

describe("deux lectures (titre ET geste) trouvent un précédent : UN refus, une confirmation qui passe", () => {
  it("refus, puis « Refaire quand même » avec le jeton reçu : prix demandé, puis départ (pas de boucle)", async () => {
    await depots().videos.enregistrer(video("v-prete", { sujet: "Mesurer le temps d'un devis" }));
    const refus = await decouper(TEXTE);
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    expect(refus.precedents.map((p) => p.videoId)).toEqual(["v-prete"]);
    expect(refus.jetonPerime).toBeUndefined();
    const sujet = { choix: "refaire" as const, jeton: refus.jeton };
    const prix = await decouper(TEXTE, { sujet });
    if (prix.statut !== "accord-requis") throw new Error(JSON.stringify(prix));
    expect((await decouper(TEXTE, { sujet, accord: prix.centimes })).statut).toBe("en-cours");
  });

  it("une confirmation mal formée n'est pas prise pour un jeton périmé", async () => {
    await depots().videos.enregistrer(video("v-prete", { sujet: "Mesurer le temps d'un devis" }));
    const r = await decouper(TEXTE, { sujet: {} as never });
    if (r.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(r));
    expect(r.jetonPerime).toBeUndefined();
  });
});

describe("pas de faux refus", () => {
  it("un texte sans rapport avec les vidéos faites passe jusqu'au prix", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    expect((await decouper(TEXTE_SANS_RAPPORT)).statut).toBe("accord-requis");
  });

  it("une vidéo en échec ne compte pas : le même texte passe", async () => {
    await depots().videos.enregistrer(video("v-echec", { statut: "echec" }));
    expect((await decouper(TEXTE)).statut).toBe("accord-requis");
  });

  it("une première phrase d'un seul mot générique ne bloque rien", async () => {
    await depots().videos.enregistrer(video("v-prete", { titre: "Bonjour" }));
    const court = "Bonjour. Vous perdez une heure chaque semaine sur votre planning de formation. Un tableau partagé évite les oublis. Voici comment le monter.";
    expect((await decouper(court)).statut).toBe("accord-requis");
  });

  it("garde éteinte : le texte déjà traité passe", async () => {
    await ecrireParametre("sujets.garde", "eteint");
    await depots().videos.enregistrer(video("v-prete"));
    expect((await decouper(TEXTE)).statut).toBe("accord-requis");
  });
});

describe("brouillon existant : aucun contrôle", () => {
  it("avec un videoId (redécoupage), le sujet n'est pas recontrôlé", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await decouper(TEXTE);
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const prix = await decouper(TEXTE, { sujet: { choix: "refaire", jeton: refus.jeton } });
    if (prix.statut !== "accord-requis") throw new Error(JSON.stringify(prix));
    const premier = await decouper(TEXTE, { sujet: { choix: "refaire", jeton: refus.jeton }, accord: prix.centimes });
    if (premier.statut !== "en-cours") throw new Error(JSON.stringify(premier));
    // Le brouillon (même titre) existe maintenant : un second découpage sur LUI ne se bloque pas lui-même.
    const r = await decouper(TEXTE, { videoId: premier.videoId, accord: prix.centimes });
    expect(r.statut).not.toBe("sujet-deja-traite");
  });
});
