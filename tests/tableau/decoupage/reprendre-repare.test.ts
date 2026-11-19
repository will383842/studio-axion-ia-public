/**
 * FIX-DECOUPAGE-REPRENDRE-d (19/11/2026) : « Reprendre » un découpage refusé repart de la fiche gardée RÉPARÉE et de ses refus
 * restants ; une fiche « à corriger » enregistrée à la main sans changement reçoit les mêmes réparations, sans IA.
 * Chemin réel : vrais `decouperScriptTableau`, `travaillerTachesTableau`, `reprendreTacheTableau`, `corrigerFicheTableau`, vraie
 * validation et vraie mise en page, dépôts en mémoire, double de Claude qui compte les appels. Rien de payé.
 *
 * Fiche gardée « à réparer » (a, c) : état laissé par un découpage d'AVANT les réparations (la fiche est gardée avec la seule
 * remise en forme). Défaut choisi : une LISTE sur la page « douleur » (bloc « liste » : règle « bloc hors partie »), que la
 * réparation de forme sait ranger en « detail » sans changer un mot. Il est posé à la main dans la version gardée.
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

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { decouperScriptTableau, lireBrouillonTableau, travaillerTachesTableau, reprendreTacheTableau, corrigerFicheTableau } = await import("@/services/tableau-creation");

const MDP = "tableau-reprendre-d";
const fiche = ficheErreurCorrigee;
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";
const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux", "linkedin"] };

function reponseDe(entree: EntreeRole, abimer?: (f: FicheTableau) => void): string {
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  auStyleDemande(f);
  abimer?.(f);
  return JSON.stringify(f);
}
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
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});

const MOT_CHANGE = " Neuf dirigeants sur dix que je rencontre en sont là.";
const ouvrir = async (videoId: string) => lireBrouillonTableau(await depots().videos.obtenir(videoId))!;

/** Découpage lancé (prix accordé) puis passage de la boucle : la tâche finit « refusee », la fiche est gardée « à corriger ». */
async function decoupageRefuse(abimer: (f: FicheTableau) => void) {
  const claude = doubleClaude(abimer);
  const relu = repereTexte(donnees.texte);
  const prix = await decouperScriptTableau(donnees, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (prix.statut !== "accord-requis") throw new Error("prix attendu");
  const r = await decouperScriptTableau(donnees, { accord: prix.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error("découpage non enregistré");
  await travaillerTachesTableau({ appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
  const b = await ouvrir(r.videoId);
  expect(b.tache!.statut).toBe("refusee");
  expect(b.versions.at(-1)!.origine).toBe("decoupage-a-corriger");
  return { videoId: r.videoId, accord: prix.centimes, appelsAvant: claude.appels.length };
}

/** Pose un défaut de FORME réparable (liste sur une page « douleur ») dans la fiche gardée : état d'avant les réparations. */
async function poserDefautDeForme(videoId: string) {
  const video = (await depots().videos.obtenir(videoId))!;
  const cle = Object.keys(video.entrees as object).find((k) => lireBrouillonTableau({ entrees: { [k]: (video.entrees as Record<string, unknown>)[k] } } as never))!;
  const b = lireBrouillonTableau(video)!;
  const gardee = copie(b.versions.at(-1)!.fiche) as FicheTableau;
  gardee.scenes[0].texteDit = gardee.scenes[0].texteDit.replace(MOT_CHANGE, ""); // le défaut de ce cas est de FORME : le texte est celui du script
  const douleur = gardee.scenes.filter((s) => (s.gabarit as { role?: string } | undefined)?.role === "douleur");
  for (const l of douleur.slice(1).flatMap((s) => s.elements.filter((e) => e.type === "ligne"))) (l as { bloc?: string }).bloc = "liste";
  b.versions[b.versions.length - 1] = { ...b.versions.at(-1)!, fiche: gardee };
  await depots().videos.modifier(videoId, { entrees: { ...(video.entrees as object), [cle]: b } } as never);
  return gardee;
}

describe("FIX-DECOUPAGE-REPRENDRE-d", () => {
  it("a) fiche gardée réparable : « Reprendre » l'accepte tout de suite, sans prix ni appel, textes intacts", async () => {
    const { videoId } = await decoupageRefuse((f) => (f.scenes[0].texteDit += MOT_CHANGE));
    const gardee = await poserDefautDeForme(videoId);
    // le texte dit gardé redevient celui du script (le défaut de ce cas est de FORME seulement)
    const claude = doubleClaude();
    const r = await reprendreTacheTableau(videoId);
    expect(r).toMatchObject({ statut: "en-cours" });
    await travaillerTachesTableau({ appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(claude.appels).toHaveLength(0);
    const b = await ouvrir(videoId);
    expect(b.tache!.statut).toBe("terminee");
    expect(b.tache!.message).toBe("Scènes prêtes (réparées sans IA).");
    expect(b.versions.at(-1)!.origine).toBe("decoupage");
    expect(b.versions.at(-1)!.fiche.scenes.map((s) => s.texteDit)).toEqual(gardee.scenes.map((s) => s.texteDit));
    // d) les textes des lignes après ⊆ avant : aucun mot ajouté ni changé
    const avant = new Set(gardee.scenes.flatMap((s) => s.elements.filter((e) => e.type === "ligne").map((e) => (e as { texte: string }).texte)));
    for (const s of b.versions.at(-1)!.fiche.scenes) for (const e of s.elements) if (e.type === "ligne") expect(avant.has((e as { texte: string }).texte)).toBe(true);
  });

  it("b) refus non réparable : le prix est demandé, le 1er appel reçoit la fiche d'avant et la phrase de chaque refus restant", async () => {
    const { videoId, accord, appelsAvant } = await decoupageRefuse((f) => (f.scenes[0].texteDit += MOT_CHANGE));
    expect(await reprendreTacheTableau(videoId)).toMatchObject({ statut: "accord-requis" });
    expect(await reprendreTacheTableau(videoId, accord)).toMatchObject({ statut: "en-cours" });
    const claude = doubleClaude();
    await travaillerTachesTableau({ appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(appelsAvant).toBeGreaterThan(0);
    expect(claude.appels.length).toBeGreaterThan(0);
    const premier = claude.appels[0].variable;
    expect(premier).toContain("<reponse_precedente>");
    expect(premier).toContain("Neuf dirigeants sur dix");
    expect(premier).toContain("<refus_fiche_precedente>\n- ");
  });

  it("c) fiche « à corriger » enregistrée à la main SANS changement : acceptée, mêmes textes", async () => {
    const { videoId } = await decoupageRefuse((f) => (f.scenes[0].texteDit += MOT_CHANGE));
    const gardee = await poserDefautDeForme(videoId);
    const texteGardee = gardee.scenes.map((s) => s.texteDit);
    // le texte dit gardé est celui du script : l'enregistrement sans changement ne touche pas au texte
    const c = await corrigerFicheTableau(videoId, [], { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(c.statut).toBe("enregistree");
    const b = await ouvrir(videoId);
    expect(b.versions.at(-1)!.fiche.scenes.map((s) => s.texteDit)).toEqual(texteGardee);
  });

  it("e) contre-épreuve : un mot du texte changé n'est JAMAIS « réparé » : « Reprendre » demande le prix", async () => {
    const { videoId } = await decoupageRefuse((f) => (f.scenes[0].texteDit += MOT_CHANGE));
    expect(await reprendreTacheTableau(videoId)).toMatchObject({ statut: "accord-requis" });
    expect((await ouvrir(videoId)).tache!.statut).toBe("refusee");
  });

  it("f) une écriture en erreur : « Reprendre » inchangé (même tâche, prix demandé)", async () => {
    const { videoId } = await decoupageRefuse((f) => (f.scenes[0].texteDit += MOT_CHANGE));
    const avant = (await ouvrir(videoId)).tache;
    expect(await reprendreTacheTableau(videoId)).toMatchObject({ statut: "accord-requis" });
    expect((await ouvrir(videoId)).tache).toEqual(avant);
  });
});
