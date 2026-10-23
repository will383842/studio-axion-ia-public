/**
 * SCRIPT PERSO, 7e tour (décision de Will du 18/10) : un texte de Will qui parle de « commentaire » en cours de vidéo est
 * refusé GRATUITEMENT, avant le prix, quand un réseau visé produit une sortie sans appel au mot (TikTok/Shorts, LinkedIn) :
 * sinon le découpage serait payé puis la sortie refusée (`controlerSortieRelue`). Dépôts en mémoire, aucun appel.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { lignesDeLaFiche, repereTexte } from "@/domaine/relecture-tableau";
import { scriptReluDe } from "@/domaine/relecture-script";
import { sortiesDesReseaux } from "../src/moteurs/montage-tableau/formats-sortie";
import { relireFicheTableau } from "../src/moteurs/montage-tableau/relecture";
import { defautCommentaireEnCoursDeVideo } from "../src/moteurs/montage-tableau/variantes-fin";
import { AUJOURDHUI_EXEMPLES, auStyleDemande, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "./tableau/regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { decouperScriptTableau, travaillerTachesTableau, cocherDejaVuTableau, lireBrouillonTableau, controlerFicheTableau } = await import("@/services/tableau-creation");

const MDP = "script-perso-7e";
const fiche = ficheErreurCorrigee;

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

const TEXTE = "Vous perdez une heure chaque jour sur vos devis. Laissez un commentaire si vous voulez en discuter. Voici un réflexe simple pour la rattraper dès ce soir.";

describe("défaut « commentaire en cours de vidéo » (fonction pure)", () => {
  const tiktok = sortiesDesReseaux(["verticaux"]);
  const instagram = sortiesDesReseaux(["fil-instagram-facebook"]);
  it("TikTok/Shorts ou LinkedIn : une phrase du milieu qui parle de commentaire est signalée, message clair", () => {
    const m = defautCommentaireEnCoursDeVideo(TEXTE, tiktok);
    expect(m).toContain("commentaire");
    expect(m).toContain("Rien n'a été payé");
    expect(defautCommentaireEnCoursDeVideo(TEXTE, sortiesDesReseaux(["linkedin"]))).toContain("commentaire");
  });
  it("l'appel de fin en deux phrases (« Écrivez DEVIS en commentaire. Je vous l'envoie. ») n'est pas visé : c'est ce que la fiche retire", () => {
    expect(defautCommentaireEnCoursDeVideo("Un réflexe simple pour vos devis. Écrivez DEVIS en commentaire. Je vous l'envoie.", tiktok)).toBeNull();
    expect(defautCommentaireEnCoursDeVideo("Un réflexe simple pour vos devis. Écrivez DEVIS en commentaire. Je vous l'envoie.", sortiesDesReseaux(["linkedin"]))).toBeNull();
  });
  it("une phrase sans rapport entre les deux phrases d'appel : le commentaire du milieu reste signalé", () => {
    expect(defautCommentaireEnCoursDeVideo("Un réflexe simple pour vos devis. Écrivez DEVIS en commentaire. Voici une phrase sans rapport avec l'appel. Je vous l'envoie.", tiktok)).toContain("commentaire");
  });
  it("« Laissez un commentaire. » en dernière phrase n'est pas un appel que la fiche retire : signalé", () => {
    expect(defautCommentaireEnCoursDeVideo("Un réflexe simple pour vos devis. Laissez un commentaire.", tiktok)).toContain("commentaire");
  });
  it("sans commentaire : rien ; Instagram seul : rien", () => {
    expect(defautCommentaireEnCoursDeVideo("Un réflexe simple. Voici la suite de la vidéo.", tiktok)).toBeNull();
    expect(defautCommentaireEnCoursDeVideo(TEXTE, instagram)).toBeNull();
  });
});

describe("découpage payant : refus gratuit avant le prix (origine will)", () => {
  const donnees = (reseaux: string[], origine?: "will") => ({
    texte: TEXTE, serieCode: "formation", structure: fiche.structure, douleur: "Vous perdez une heure", gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux,
    motsDouleur: ["perdez une heure"], ...(origine ? { origine } : {}),
  });
  it("origine will + TikTok : le texte de Will est pris à l'identique, jamais refusé (le prix est demandé)", async () => {
    const r = await decouperScriptTableau(donnees(["verticaux"], "will"), { relu: repereTexte(TEXTE) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("accord-requis");
  });
  it("origine will + Instagram seul : le prix est demandé (accord-requis)", async () => {
    const r = await decouperScriptTableau(donnees(["fil-instagram-facebook"], "will"), { relu: repereTexte(TEXTE) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("accord-requis");
  });
});

describe("texte de Will qui parle de commentaire en cours de vidéo : pris à l'identique par le découpage ET la relecture (TikTok)", () => {
  const fv = copie(fiche);
  fv.scenes[1].texteDit = `${fv.scenes[1].texteDit} Laissez un commentaire si vous voulez en discuter.`;
  const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";
  const appeler = async (_role: unknown, entree: { variable: string }) => {
    const f = copie(fiche);
    Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
    auStyleDemande(f);
    f.scenes[1].texteDit = fv.scenes[1].texteDit;
    return { ok: true as const, simule: false, donnees: JSON.stringify(f) };
  };
  it("le découpage garde la phrase dite, la relecture des sorties TikTok/Shorts ne bloque rien", async () => {
    const d = { texte: texteScriptDe(fv), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux"], origine: "will" as const };
    const prix = await decouperScriptTableau(d, { relu: repereTexte(d.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (prix.statut !== "accord-requis") throw new Error("prix attendu");
    const r = await decouperScriptTableau(d, { accord: prix.centimes, relu: repereTexte(d.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (r.statut !== "en-cours") throw new Error("découpage attendu");
    await travaillerTachesTableau({ appeler: appeler as never, aujourdhui: AUJOURDHUI_EXEMPLES });
    await cocherDejaVuTableau(r.videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const f = lireBrouillonTableau((await depots().videos.obtenir(r.videoId))!)!.versions.at(-1)!.fiche;
    expect(f.scenes[1].texteDit).toBe(fv.scenes[1].texteDit);
    const lignes = lignesDeLaFiche(f);
    expect(await controlerFicheTableau(r.videoId, scriptReluDe(lignes, lignes), { aujourdhui: AUJOURDHUI_EXEMPLES })).toEqual([]);
    // La relecture des sorties TikTok/Shorts (fin sans commentaire) : bloque sans l'origine « will », laisse passer avec.
    const relire = (texteDeWill?: boolean) => relireFicheTableau({ fiche: f, contexte: contexteExemple(f, texteDeWill ? { texteDeWill } : {}), sorties: sortiesDesReseaux(["verticaux"]), dejaVu: { coche: true, le: AUJOURDHUI_EXEMPLES } });
    expect((await relire()).points.map((p) => p.message).join(" ")).toContain("fin sans commentaire");
    expect((await relire(true)).points.map((p) => p.message).join(" ")).not.toContain("fin sans commentaire");
  });
});
