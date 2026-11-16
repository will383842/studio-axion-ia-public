/**
 * G1-03 : le gabarit de moteur (`src/moteurs/gabarit`), éprouvé par son exemple « bonjour » (jamais inscrit).
 * Doubles seulement : aucun fournisseur, aucun appel à Claude, aucune dépense. L'exemple passe `testerGenerateur`
 * (G1-02) SANS aucune exception datée.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 120_000 });

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { testerGenerateur } = await import("@/moteurs/conformite");
const { creerMoteurGabaritExemple, ID_MOTEUR_GABARIT_EXEMPLE } = await import("@/moteurs/gabarit/exemple");
const { IDS_MOTEURS } = await import("@/moteurs/ids");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DependancesBonjour } from "@/moteurs/gabarit/exemple";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs/types";

const MDP = "essai-g1-03-gabarit";
const T0 = Date.UTC(2026, 10, 16, 9, 0, 0);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

async function commande(): Promise<CommandeFabrication> {
  const c = await construireCommande("v-03");
  return { ...c, formatId: "demo-facecam", moteurId: ID_MOTEUR_GABARIT_EXEMPLE, ratios: ["4:5", "9:16", "1:1", "16:9"] };
}

function doubles() {
  const appels = { texte: 0, rendu: 0 };
  const deps: DependancesBonjour = {
    ecrireTexte: async (prenom) => ((appels.texte += 1), `Bonjour ${prenom}`),
    rendre: async (ratio) => ((appels.rendu += 1), { fichierCle: `essai/gabarit/bonjour-${ratio.replace(":", "x")}.mp4` }),
  };
  return { appels, deps };
}

async function mener(moteur: MoteurVideo, c: CommandeFabrication, travail: Travail, depuis = T0): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let t = travail;
  let resultat: ResultatFabrication | undefined;
  for (let ms = depuis; ms < depuis + 60_000; ms += 500) {
    const r = await moteur.avancer(t, c, ms);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") break;
  }
  return { travail: t, resultat };
}

// Conformité complète (contrat commun, pause, retouche, ratios, origine, sortie) : aucune exception.
const principal = doubles();
testerGenerateur(creerMoteurGabaritExemple(() => principal.deps), commande, {
  sansPrix: true,
  exceptions: [],
  moteurSansFournisseur: () => creerMoteurGabaritExemple(() => null),
});

describe("gabarit — exemple « bonjour »", () => {
  it("n'est pas inscrit : son id n'est pas dans IDS_MOTEURS", () => {
    expect((IDS_MOTEURS as readonly string[]).includes(ID_MOTEUR_GABARIT_EXEMPLE)).toBe(false);
  });

  it("sans dépendances : pause claire (en file, aucun échec, coût nul, aucun résultat)", async () => {
    const moteur = creerMoteurGabaritExemple(() => null);
    const c = await commande();
    const t = await moteur.lancer(c, { travailId: "t-p", versionId: "v-p", titre: "Pause", maintenant: T0 });
    expect(t.statut).toBe("en_file");
    expect((t.parametres as { pause?: { message: string } }).pause?.message).toMatch(/gardée, rien n'a échoué/);
    expect(t.etapes.some((e) => e.statut === "echec")).toBe(false);
    const apres = await moteur.avancer(t, c, T0 + 60_000);
    expect(apres.travail.statut).toBe("en_file");
    expect(apres.resultat).toBeUndefined();
    expect((await moteur.estimer(c)).total.centimes).toBe(0);
    // Une retouche sans dépendances se met en pause aussi, jamais en échec.
    const r = await moteur.retoucher({ commande: c, contexte: { travailId: "t-pr", versionId: "v-pr", titre: "R", maintenant: T0 }, planIds: [], consigne: "x", operations: [{ type: "modifierTitre", texte: "Salut" }] });
    expect(r.statut).toBe("en_file");
    expect(r.type).toBe("retouche");
  });

  it("reprise après redémarrage : l'état vit dans le travail, rien n'est refait", async () => {
    const a = doubles();
    const c = await commande();
    const avant = creerMoteurGabaritExemple(() => a.deps);
    let t = await avant.lancer(c, { travailId: "t-rep", versionId: "v-rep", titre: "Reprise", maintenant: T0 });
    for (let i = 0; i < 2; i++) t = (await avant.avancer(t, c, T0 + i * 500)).travail; // reception, texte
    expect(a.appels.texte).toBe(1);
    // Redémarrage : travail relu en JSON, nouveau moteur, nouvelles dépendances.
    const b = doubles();
    const apres = creerMoteurGabaritExemple(() => b.deps);
    const relu = JSON.parse(JSON.stringify(t)) as Travail;
    const fin = await mener(apres, c, relu, T0 + 2_000);
    expect(fin.travail.statut).toBe("termine");
    expect(b.appels.texte).toBe(0);
    expect(b.appels.rendu).toBe(c.ratios.length);
    expect(fin.resultat!.sorties.map((s) => s.ratio).sort()).toEqual([...c.ratios].sort());
  });

  it("retouche partielle : opérations appliquées, texte déjà fait non réécrit, résultat exploitable", async () => {
    const a = doubles();
    const moteur = creerMoteurGabaritExemple(() => a.deps);
    const c = { ...(await commande()), origine: "usine" as const };
    const premiere = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-1", versionId: "v-1", titre: "Fab", maintenant: T0 }));
    expect(premiere.travail.statut).toBe("termine");
    const pm = premiere.resultat!.projetMontage;
    expect(pm.origine).toBe("usine");
    expect((pm.proprietesRendu as { planScenes?: unknown }).planScenes).toBeDefined();
    const textes = a.appels.texte;

    const retouche = await moteur.retoucher({
      commande: c,
      contexte: { travailId: "t-2", versionId: "v-2", titre: "Retouche", maintenant: T0 },
      planIds: ["s1"],
      consigne: "Titre",
      operations: [{ type: "modifierTitre", texte: "Salut tout le monde" }],
      parent: { versionId: "v-1", projetMontage: pm, pistes: [] },
    });
    expect(retouche.type).toBe("retouche");
    expect(retouche.etapes.map((e) => e.cle)).toEqual(["plan", "montage", "controle"]);
    const fin = await mener(moteur, c, retouche);
    expect(fin.travail.statut).toBe("termine");
    expect(a.appels.texte).toBe(textes);
    expect(fin.resultat!.sorties).toHaveLength(c.ratios.length);
    expect((fin.resultat!.projetMontage.reprise as { texte: string }).texte).toBe("Salut tout le monde");
    expect(fin.resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("origine « usine » propagée au travail et au résultat", async () => {
    const a = doubles();
    const moteur = creerMoteurGabaritExemple(() => a.deps);
    const c = { ...(await commande()), origine: "usine" as const };
    const fin = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-o", versionId: "v-o", titre: "O", maintenant: T0 }));
    expect((fin.travail.parametres as { origine?: string }).origine).toBe("usine");
    expect(fin.resultat!.projetMontage.origine).toBe("usine");
  });
});
