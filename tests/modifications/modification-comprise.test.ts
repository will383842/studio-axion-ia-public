/**
 * « DEMANDER UNE MODIFICATION » COMPRISE, FORMAT PAR FORMAT (défaut trouvé par Will le 17/10 sur la vidéo tableau animé
 * v-667edcd8e3a8 : « Faire apparaître le chiffre plus tôt », « Enlever le plan 2 », proposés par le studio lui-même,
 * répondaient « Je n'ai pas compris quoi changer… », sans proposition ni prix).
 *
 * Contrat : les exemples affichés dépendent du format et de la vidéo, chacun est compris (proposition : ce qui change,
 * écrans ou plans touchés, prix) ; une demande que le format ne sait pas retoucher reçoit une réponse claire avec le
 * prix pour refaire la vidéo ; jamais « je n'ai pas compris » sur un exemple proposé ; RIEN ne part sans « Confirmer ».
 * Aucun appel payant : le moteur du tableau reçoit les doubles, l'interprète est la simulation.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { contexteExemple, ficheDemonstration } from "../tableau/regles/exemples";
import { banc, versOutils } from "../tableau/moteur/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Le format tableau animé est traité comme actif (son statut réel n'est pas lu ici).
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: (f: { id: string } | null | undefined) => f?.id === "tableau-anime" };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const boucle = await import("@/services/boucle");
const modifications = await import("@/services/modifications");
const { brancherServicesTableau } = await import("@/moteurs/montage-tableau");

const MDP = "modification-comprise";
const VIDEO = "v-03";
const PAS_COMPRIS = /pas compris/i;

beforeAll(async () => {
  process.env.SESSION_SECRET = "m".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(ficheDemonstration);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});

/** v-03 devient une VRAIE vidéo du tableau animé (comme v-667edcd8e3a8) : aucun plan enregistré, la fiche de scènes. */
async function videoTableau() {
  const b = banc(ficheDemonstration);
  const commande = { ...b.commande(ficheDemonstration), videoId: VIDEO };
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { formatId: "tableau-anime", estDemo: false });
  await depots().versions.modifier(ver.id, { commande, estDemo: false, projetMontage: { moteur: "montage-tableau", tableau: { journal: { version: "fabrication-tableau/1", etapes: {} }, fiche: ficheDemonstration, retouchee: true } } });
  for (const p of await depots().plans.lister((x) => x.versionId === ver.id)) await depots().plans.modifier(p.id, { versionId: "ver-ailleurs" });
  brancherServicesTableau({ outils: async () => versOutils(b.d, b.fiches) });
}

/** v-03 devient une vraie vidéo d'un format dont le moteur ne sait pas retoucher un passage. */
async function videoSansRetouche(formatId: string, moteurId: string) {
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { formatId, estDemo: false });
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, formatId, moteurId }, estDemo: false });
}

const nbTravaux = async () => (await depots().travaux.lister()).length;

describe("tableau animé (vraie vidéo, sans plan enregistré) : la conversation comprend", () => {
  it("les exemples exacts de Will ne répondent plus « je n'ai pas compris » : réponse claire et prix pour refaire", async () => {
    await videoTableau();
    for (const texte of ["Faire apparaître le chiffre plus tôt", "Enlever le plan 2"]) {
      const p = await modifications.proposerModification(VIDEO, texte);
      expect(p.resume, texte).not.toMatch(PAS_COMPRIS);
      expect(p.statut, texte).toBe("hors-capacite");
      expect(p.horsCapacite!.prixVideo.centimes, texte).toBeGreaterThan(0);
    }
  });

  it("chaque exemple affiché est compris : ce qui change, les écrans touchés et le prix ; rien ne part avant « Confirmer »", async () => {
    await videoTableau();
    const { exemples } = await modifications.exemplesModification(VIDEO);
    expect(exemples.length).toBeGreaterThanOrEqual(2);
    // Aucun exemple que ce format ne sait pas faire (la fiche n'a pas de chiffre, une scène ne se retire pas).
    expect(exemples.join(" | ")).not.toMatch(/chiffre|plans serrés|image du plan|Enlever le plan/);
    const avant = await nbTravaux();
    for (const texte of exemples) {
      const p = await modifications.proposerModification(VIDEO, texte);
      expect(p.resume, texte).not.toMatch(PAS_COMPRIS);
      expect(p.statut, texte).toBe("proposee");
      expect(p.unite, texte).toBe("ecran");
      expect(p.plansTouches.length, texte).toBeGreaterThan(0);
      expect(p.cout.centimes, texte).toBeGreaterThanOrEqual(0);
    }
    expect(await nbTravaux()).toBe(avant);
  });

  it("une demande en mots simples devient la bonne retouche, lancée seulement à la confirmation", async () => {
    await videoTableau();
    const p = await modifications.proposerModification(VIDEO, "Retirer le dessin de l'écran 2");
    expect(p.statut, p.resume).toBe("proposee");
    expect(p.resume).toMatch(/écran 2/i);
    expect(p.plansTouches).toContain(2);
    expect(p.operationsTableau).toEqual([{ type: "supprimerElement", sceneId: "s02", elementId: "e04" }]);
    const avant = await nbTravaux();
    const r = await modifications.confirmerModification(VIDEO, p.id);
    expect(r.travailId).toBeTruthy();
    expect(await nbTravaux()).toBe(avant + 1);
    const t = await depots().travaux.obtenir(r.travailId);
    expect(t?.type).toBe("retouche");
    expect(JSON.stringify((t?.parametres as { tableau: { fiche: unknown } }).tableau.fiche)).not.toContain('"e04"');
    expect((await modifications.historiqueModifications(VIDEO)).find((x) => x.id === p.id)?.statut).toBe("confirmee");
    await expect(modifications.confirmerModification(VIDEO, p.id)).rejects.toThrow(/déjà été traitée/);
  });

  it("une retouche que les règles du tableau refusent le dit en clair, avec le prix pour refaire", async () => {
    await videoTableau();
    const p = await modifications.proposerModification(VIDEO, "Retirer le dessin de l'écran 3");
    expect(p.statut).toBe("hors-capacite");
    expect(p.resume).toMatch(/n'est pas possible/);
    expect(p.horsCapacite!.prixVideo.centimes).toBeGreaterThan(0);
  });

  it("mettre un mot en valeur, souligner, remplacer un mot écrit : compris", async () => {
    await videoTableau();
    for (const texte of ["Mettre « idées » en valeur à l'écran 3", "Entourer la ligne de l'écran 2", "Écrire « Gardez la plus utile » au lieu de « Gardez la meilleure »"]) {
      const p = await modifications.proposerModification(VIDEO, texte);
      expect(p.statut, `${texte} → ${p.resume}`).toBe("proposee");
    }
  });
});

describe("formats qui ne savent pas encore retoucher : réponse claire, prix pour refaire, aucun exemple trompeur", () => {
  for (const [formatId, moteurId] of [
    ["cas-concret", "montage-cas-concret"],
    ["image-video", "montage-image-video"],
    ["avocat", "montage-avocat"],
  ] as const) {
    it(`${formatId} : les demandes du cas concret (mise en page, chiffre plus tôt, mot à l'écran) sont dites impossibles, avec le prix`, async () => {
      await videoSansRetouche(formatId, moteurId);
      const { exemples, note } = await modifications.exemplesModification(VIDEO);
      expect(exemples).toEqual([]);
      expect(note).toMatch(/refaire la vidéo/);
      for (const texte of ["Changer la mise en page de l'écran 2", "Faire apparaître le chiffre plus tôt", "Changer un mot à l'écran", "Enlever le plan 2"]) {
        const p = await modifications.proposerModification(VIDEO, texte);
        expect(p.statut, texte).toBe("hors-capacite");
        expect(p.resume, texte).not.toMatch(PAS_COMPRIS);
        expect(p.resume, texte).toMatch(/refaire la vidéo/);
        // Prix de l'estimateur du moteur (la commande d'essai du cas concret n'a pas de cas : il peut y valoir 0).
        expect(p.horsCapacite!.prixVideo.centimes, texte).toBeGreaterThan(formatId === "cas-concret" ? -1 : 0);
        expect(p.cout.centimes).toBe(0);
      }
    });
  }
});

describe("avocat (vidéo d'essai, plans par plans) : ses exemples sont compris", () => {
  it("chaque exemple affiché propose plans et prix ; « chiffre plus tôt » et « enlever le plan 2 » ne disent jamais « pas compris »", async () => {
    const { exemples } = await modifications.exemplesModification(VIDEO);
    expect(exemples.length).toBeGreaterThanOrEqual(2);
    for (const texte of exemples) {
      const p = await modifications.proposerModification(VIDEO, texte);
      expect(p.statut, `${texte} → ${p.resume}`).toBe("proposee");
      expect(p.plansTouches.length, texte).toBeGreaterThan(0);
      expect(p.unite ?? "plan").toBe("plan");
    }
    for (const texte of ["Faire apparaître le chiffre plus tôt", "Enlever le plan 2"]) {
      const p = await modifications.proposerModification(VIDEO, texte);
      expect(p.resume, texte).not.toMatch(PAS_COMPRIS);
      expect(["proposee", "hors-capacite"]).toContain(p.statut);
    }
  });

  it("« Changer l'image du plan 3 » touche le plan affiché 3 (numérotation de l'écran) ; le plan 2, sans image, le dit", async () => {
    const p = await modifications.proposerModification(VIDEO, "Changer l'image du plan 3");
    expect(p.plansTouches).toEqual([3]);
    const deux = await modifications.proposerModification(VIDEO, "Changer l'image du plan 2");
    expect(deux.resume).toMatch(/plan 2 n'a pas d'image : je change celle du plan 3/);
    expect(deux.plansTouches).toEqual([3]);
  });
});

describe("écran : exemples du format, jamais une liste figée", () => {
  it("DemanderModification reçoit ses exemples (plus de liste écrite en dur) ; la fiche vidéo les fournit", () => {
    const composant = readFileSync(join(process.cwd(), "src/components/videos/fiche/DemanderModification.tsx"), "utf8");
    expect(composant).not.toMatch(/const EXEMPLES = \[/);
    expect(composant).toMatch(/exemples/);
    const page = readFileSync(join(process.cwd(), "src/app/(studio)/videos/[id]/page.tsx"), "utf8");
    expect(page).toMatch(/exemplesModification\(/);
  });
});
