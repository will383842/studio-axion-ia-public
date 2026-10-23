/**
 * P6 · « DEMANDER UNE MODIFICATION » d'une vidéo « Cas concret MD » (#350 + retouche par discussion du portage phase 2).
 * Réglage `casConcret.retouches` ÉTEINT (défaut) : la réponse commune de #350 (« pour ce changement, il faut refaire la
 * vidéo », avec le prix), aucun appel Claude. ALLUMÉ (dans le double seulement) : la demande est lue par un appel détaché,
 * montrée avec ce qui change, ce qui est refait et le prix ; rien ne part sans « Confirmer ». Aucun appel réel.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const modifications = await import("@/services/modifications");
const retouches = await import("@/services/cas-concret-retouches");
const discussion = await import("@/moteurs/montage-cas-concret/discussion");
const { banc } = await import("../cas-concret/moteur/doubles");

const MDP = "modification-cas-concret";
const VIDEO = "v-03";
const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);

beforeAll(async () => {
  process.env.SESSION_SECRET = "p".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await videoDuFormat();
});
afterEach(() => vi.restoreAllMocks());

async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

/** v-03 devient une vraie vidéo du format, fabriquée en simulation (mot branché sur Facebook et Instagram). */
async function videoDuFormat() {
  const b = banc({ motSur: ["facebook", "instagram"] });
  const commande = b.commande();
  const fin = await avancerJusqua(b.moteur, commande, await b.moteur.lancer(commande, { travailId: "t-1", versionId: "ver-t-1", titre: "Essai", maintenant: T0 }));
  expect(fin.travail.statut).toBe("termine");
  const projetMontage = JSON.parse(JSON.stringify(fin.resultat!.projetMontage)) as Record<string, unknown>;
  const d = depots();
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
  await d.versions.modifier(video.versionChoisieId!, { estDemo: false, commande: { ...commande, videoId: VIDEO }, projetMontage });
}

/** Doubles : l'appel détaché ne répond qu'à `repondre()` ; rien n'est lancé pour de vrai. */
function doubles() {
  const enAttente = new Map<string, () => Promise<ReponseAppelEcriture>>();
  const reponses = new Map<string, ReponseAppelEcriture>();
  const executer = vi.fn(async (_v: string, role: DefinitionRole, entree: EntreeRole) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) }));
  const lancerRetouche = vi.fn(async () => ({ travailId: "t-retouche" }));
  return {
    executer,
    lancerRetouche,
    enAttente,
    repondre: async () => {
      for (const [cle, appel] of enAttente) reponses.set(cle, await appel());
      enAttente.clear();
    },
    dep: { appels: { lancer: (cle: string, appel: () => Promise<ReponseAppelEcriture>) => void enAttente.set(cle, appel), lire: async (cle: string) => reponses.get(cle) ?? null }, executer, claudeActif: async () => false, lancerRetouche },
  };
}

describe("réglage `casConcret.retouches` éteint (défaut) : la réponse de #350 ne change pas", () => {
  it("aucun exemple, la note du format ; la demande reçoit « refaire la vidéo » avec son prix ; aucun appel", async () => {
    const x = doubles();
    expect(await modifications.exemplesModification(VIDEO)).toEqual({ exemples: [], note: modifications.NOTE_SANS_RETOUCHE });
    const p = await modifications.proposerModification(VIDEO, "Faites-la sans le mot.", x.dep);
    expect(p.statut).toBe("hors-capacite");
    expect(p.resume).toContain("il faut refaire la vidéo");
    expect(p.horsCapacite!.prixVideo.centimes).toBeGreaterThan(0);
    expect(x.executer).not.toHaveBeenCalled();
    expect(x.enAttente.size).toBe(0);
  });
});

describe("réglage allumé (dans le double seulement) : la discussion passe par « Demander une modification »", () => {
  beforeEach(async () => {
    await ecrireParametre("casConcret.retouches", true);
  });

  it("les exemples affichés sont ceux du cas concret ; chacun est compris (une proposition, jamais « refusée »)", async () => {
    const { exemples, note } = await modifications.exemplesModification(VIDEO);
    expect(note).toBeUndefined();
    expect(exemples.length).toBeGreaterThanOrEqual(2);
    for (const texte of exemples) {
      const x = doubles();
      await modifications.proposerModification(VIDEO, texte, x.dep);
      await x.repondre();
      const liste = await modifications.historiqueModifications(VIDEO);
      const dernier = liste[liste.length - 1];
      const p = await modifications.suivreModification(VIDEO, dernier.id, x.dep);
      expect(p.statut, `${texte} → ${p.resume}`).toBe("proposee");
      await modifications.abandonnerModification(VIDEO, p.id);
    }
  });

  it("la demande est lue sans être attendue, puis montrée avec le prix ; rien ne part avant « Confirmer »", async () => {
    const x = doubles();
    const premiere = await modifications.proposerModification(VIDEO, "Changez le mot à commenter : RDV", x.dep);
    expect(premiere.statut).toBe("en-cours");
    expect(premiere.cout.centimes).toBe(0);
    expect(x.executer).not.toHaveBeenCalled();
    // Relue avant la réponse : toujours en cours, jamais un second appel.
    expect((await modifications.suivreModification(VIDEO, premiere.id, x.dep)).statut).toBe("en-cours");
    expect(x.enAttente.size).toBe(1);
    await x.repondre();
    const p = await modifications.suivreModification(VIDEO, premiere.id, x.dep);
    expect(p.statut).toBe("proposee");
    expect(p.resume).toContain("Je fais dire le mot RDV");
    expect(p.resume).toMatch(/Je refais la voix des? fins?/);
    expect(p.cout.centimes).toBeGreaterThan(0);
    expect(x.lancerRetouche).not.toHaveBeenCalled();
    // L'historique garde la proposition mise à jour (même identifiant).
    expect((await modifications.historiqueModifications(VIDEO)).filter((h) => h.id === premiere.id)).toHaveLength(1);

    const r = await modifications.confirmerModification(VIDEO, p.id, { confirme: false }, x.dep);
    expect(r).toEqual({ travailId: "t-retouche" });
    expect(x.lancerRetouche).toHaveBeenCalledWith(VIDEO, [], "Changez le mot à commenter : RDV", { confirme: false, operations: [{ type: "changer-mot", mot: "RDV" }] });
    expect((await modifications.historiqueModifications(VIDEO)).find((h) => h.id === p.id)?.statut).toBe("confirmee");
    await expect(modifications.confirmerModification(VIDEO, p.id, {}, x.dep)).rejects.toThrow(/déjà été traitée/);
  });

  it("une proposition en cours ne peut pas être confirmée", async () => {
    const x = doubles();
    const p = await modifications.proposerModification(VIDEO, "Sans le mot.", x.dep);
    await expect(modifications.confirmerModification(VIDEO, p.id, {}, x.dep)).rejects.toThrow(/pas encore prête|déjà été traitée/);
    expect(x.lancerRetouche).not.toHaveBeenCalled();
  });

  it("une demande hors liste : réponse claire avec le prix pour refaire la vidéo", async () => {
    const x = doubles();
    const p0 = await modifications.proposerModification(VIDEO, "Mettez une musique plus gaie.", x.dep);
    await x.repondre();
    const p = await modifications.suivreModification(VIDEO, p0.id, x.dep);
    expect(p.statut).toBe("hors-capacite");
    expect(p.resume).toBe(discussion.PHRASE_HORS_LISTE);
    expect(p.horsCapacite!.prixVideo.centimes).toBeGreaterThan(0);
    expect(x.lancerRetouche).not.toHaveBeenCalled();
  });

  it("« déplacer une étape » : comprise puis refusée par la règle d'ordre, phrase claire, aucune confirmation possible", async () => {
    const x = doubles();
    const p0 = await modifications.proposerModification(VIDEO, "Remontez la troisième étape.", x.dep);
    await x.repondre();
    const p = await modifications.suivreModification(VIDEO, p0.id, x.dep);
    expect(p.statut).toBe("hors-capacite");
    expect(p.resume).toBe(retouches.PHRASE_DEPLACER_REFUSE);
    await expect(modifications.confirmerModification(VIDEO, p.id, {}, x.dep)).rejects.toThrow(/déjà été traitée/);
    expect(x.lancerRetouche).not.toHaveBeenCalled();
  });

  it("le réglage éteint entre deux : plus rien ne part, même pour une proposition faite avant", async () => {
    const x = doubles();
    const p0 = await modifications.proposerModification(VIDEO, "Sans le mot.", x.dep);
    await x.repondre();
    const p = await modifications.suivreModification(VIDEO, p0.id, x.dep);
    expect(p.statut).toBe("proposee");
    await ecrireParametre("casConcret.retouches", false);
    await expect(modifications.confirmerModification(VIDEO, p.id, {}, x.dep)).rejects.toThrow();
    expect(x.lancerRetouche).not.toHaveBeenCalled();
  });
});

describe("recalque des sous-titres : le cas concret ne le fait jamais, réglage allumé ou non", () => {
  it("refus clair même quand les retouches sont allumées", async () => {
    await ecrireParametre("casConcret.retouches", true);
    const { appliquerSousTitres } = await import("@/services/recalque");
    await expect(appliquerSousTitres(VIDEO)).rejects.toMatchObject({ code: "RECALQUE_IMPOSSIBLE" });
  });
});
