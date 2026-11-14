/**
 * GV2-31 · une fiche « à corriger » enregistrée sans toucher au texte dit ne remplace JAMAIS en silence le texte du
 * fondateur par celui que le modèle a changé ; une modification volontaire du texte reste acceptée (le texte d'origine suit).
 * Dépôts en mémoire, double de Claude : aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { repereTexte } from "@/domaine/relecture-tableau";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

/** Le format est actif ; le cas « masqué » est SIMULÉ (`ouvert = false`), sans lire la valeur réelle du statut. */
const aiguillage = vi.hoisted(() => ({ ouvert: true }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: (f: { id: string; statut: string } | null | undefined) => (aiguillage.ouvert ? vrai.ecranTableauVisible(f as never) : false) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { decouperScriptTableau, lireBrouillonTableau, travaillerTachesTableau, corrigerFicheTableau, controlerFicheTableau } = await import("@/services/tableau-creation");


const MDP = "tableau-texte-fondateur";
const fiche = ficheErreurCorrigee;

const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";

/** Réponse de « Claude » : la fiche d'exemple, champs fixes recopiés de la demande (comme le ferait le modèle). */
function reponseDe(entree: EntreeRole, abimer?: (f: FicheTableau) => void): string {
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  // Style des nouvelles fiches (« reference/2 », 14/10) : la fiche rendue avec son gabarit de page clair.
  auStyleDemande(f);
  abimer?.(f);
  return JSON.stringify(f);
}

/** Double de l'appel Claude : compte les appels, rend une fiche (abîmée ou non). */
function doubleClaude(abimer?: (f: FicheTableau, n: number) => void) {
  const appels: EntreeRole[] = [];
  const appeler: OutilsDecoupage["appeler"] = async (_role, entree) => {
    appels.push(entree);
    return { ok: true, simule: false, donnees: reponseDe(entree, abimer ? (f) => abimer(f, appels.length) : undefined) };
  };
  return { appels, appeler };
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  aiguillage.ouvert = true;
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});


const donnees = {
  texte: texteScriptDe(fiche),
  serieCode: "formation",
  structure: fiche.structure,
  douleur: fiche.douleur,
  gesteMinute: fiche.gesteMinute,
  finId: "fin-if-abonnement",
  reseaux: ["verticaux", "linkedin"],
  origine: "will" as const,
};

/** Découpage refusé : le modèle a changé « vagues » en « floues » ; la fiche est gardée « à corriger ». */
async function ficheACorriger() {
  const claude = doubleClaude((f) => (f.scenes[0].texteDit = f.scenes[0].texteDit.replace("vagues", "floues")));
  const relu = repereTexte(donnees.texte);
  const prix = await decouperScriptTableau(donnees, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (prix.statut !== "accord-requis") throw new Error(`prix attendu : ${JSON.stringify(prix)}`);
  const r = await decouperScriptTableau(donnees, { accord: prix.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error(`découpage non enregistré : ${JSON.stringify(r)}`);
  await travaillerTachesTableau({ appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
  const b = lireBrouillonTableau(await depots().videos.obtenir(r.videoId))!;
  expect(b.versions.at(-1)!.origine).toBe("decoupage-a-corriger");
  expect(b.donnees.origine).toBe("will");
  return { videoId: r.videoId, scene: b.versions[0].fiche.scenes[0] };
}
const ouvrir = async (videoId: string) => lireBrouillonTableau(await depots().videos.obtenir(videoId))!;

describe("texte du fondateur gardé", () => {
  it("fiche « à corriger » enregistrée sans y toucher : refus qui nomme le mot, rien n'est enregistré", async () => {
    const { videoId } = await ficheACorriger();
    const c = await corrigerFicheTableau(videoId, [], { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(c.statut).toBe("refusee");
    if (c.statut !== "refusee") return;
    expect(c.code).toBe("TEXTE_FONDATEUR_CHANGE");
    expect(c.phrase).toContain("« floues »");
    expect(c.phrase).toContain("votre texte dit « vagues »");
    const b = await ouvrir(videoId);
    expect(b.versions).toHaveLength(1);
    expect(b.donnees.texte).toBe(donnees.texte);
    // Les contrôles en direct disent la même chose.
    const pastilles = await controlerFicheTableau(videoId, [], { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(pastilles.map((p) => p.texte).join(" ")).toContain("« floues »");
  });

  it("la même fiche après correction du mot : acceptée", async () => {
    const { videoId, scene } = await ficheACorriger();
    const c = await corrigerFicheTableau(videoId, [{ sceneId: scene.id, texteDit: scene.texteDit.replace("floues", "vagues") }], { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(c).toEqual({ statut: "enregistree", version: 2 });
    expect((await ouvrir(videoId)).donnees.texte).toBe(donnees.texte);
  });

  it("modification volontaire du texte par le fondateur : acceptée, le texte d'origine suit", async () => {
    const { videoId, scene } = await ficheACorriger();
    const c = await corrigerFicheTableau(videoId, [{ sceneId: scene.id, texteDit: scene.texteDit.replace("floues", "grosses") }], { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(c).toEqual({ statut: "enregistree", version: 2 });
    const b = await ouvrir(videoId);
    expect(b.donnees.texte).toContain("grosses");
    expect(b.donnees.texte).not.toContain("floues");
    expect(texteScriptDe(b.versions.at(-1)!.fiche)).toBe(b.donnees.texte);
  });
});
