/**
 * TO-SV (P4) · un tutoriel d'outil SANS VOIX n'exige plus de « double » ni son accord : le dépôt ne pose aucune distribution, la
 * garde de fabrication accepte une distribution vide pour ce seul cas (`modeVoix === "sans-voix"` exact, format `tutoriel-outil`).
 * Tout le reste garde sa règle : avec voix, valeurs voisines, autres formats, accord d'un double réel. Mémoire simulée, fournisseurs
 * de voix piégés (0 appel HeyGen / ElevenLabs), 0 €.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { Journal } from "./doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const pieges = vi.hoisted(() => {
  const appels: string[] = [];
  const moduleEspion = (nom: string) => async (importOriginal: () => Promise<Record<string, unknown>>) => {
    const vrai = await importOriginal();
    return Object.fromEntries(
      Object.entries(vrai).map(([cle, v]) => [
        cle,
        typeof v === "function" && /^[a-z]/.test(cle)
          ? () => {
              appels.push(`${nom}.${cle}`);
              throw new Error(`${nom}.${cle} ne doit pas être appelé sans voix`);
            }
          : v,
      ]),
    );
  };
  return { appels, moduleEspion };
});

vi.mock("@/fournisseurs/heygen/voix", (o) => pieges.moduleEspion("heygen/voix")(o as never));
vi.mock("@/fournisseurs/heygen/client", (o) => pieges.moduleEspion("heygen/client")(o as never));
vi.mock("@/fournisseurs/heygen/rendus", (o) => pieges.moduleEspion("heygen/rendus")(o as never));
vi.mock("@/fournisseurs/credits/heygen", (o) => pieges.moduleEspion("credits/heygen")(o as never));
vi.mock("@/fournisseurs/credits/elevenlabs", (o) => pieges.moduleEspion("credits/elevenlabs")(o as never));

const banc = vi.hoisted(() => ({ journal: null as unknown as Journal, outils: null as unknown as import("../../src/moteurs/montage-tutoriel-outil").OutilsTutoriel | null }));
const branchementsReels = vi.hoisted(() => vi.fn(async () => {
  throw new Error("branchementsReels (avec voix) ne doit pas être appelé sans voix");
}));
vi.mock("@/services/tableau-outils", async () => {
  const { outilsDoubles } = await import("./doubles");
  return {
    TARIF_VOIX_CENTIMES_PAR_CARACTERE: 0,
    branchementsReels,
    branchementsReelsSansVoix: async () => {
      const o = (banc.outils ??= outilsDoubles(banc.journal));
      return { env: "dev", montage: { rendu: o.rendu!.service, signer: async (lectures: Record<string, string>, depots: { cle: string }[]) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://stockage.test/${c}`])), depots: Object.fromEntries(depots.map((x) => [x.cle, `https://depot.test/${x.cle}`])) }) } };
    },
  };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, depots } = await import("@/services/_commun");
const { construireCommande } = await import("@/services/fabrication");
const { creerBrouillonFormatSansSession } = await import("@/services/creation-format");
const { enregistrerScriptDuBrouillon } = await import("@/services/videos");
const personnages = await import("@/services/personnages");
const d = await import("@/services/tutoriel-depot");
await import("@/services/tutoriel-branchements");
const { moteurMontageTutorielOutil } = await import("@/moteurs/montage-tutoriel-outil");
const { MODE_SANS_VOIX, entreeModeVoix } = await import("@/formats/tutoriel-outil/mode-sans-voix");
const { ENTREE_TUTORIEL } = await import("@/moteurs/montage-tutoriel-outil/entrees");
const { ID_FORMAT_TUTORIEL_OUTIL } = await import("@/formats/tutoriel-outil");

const T0 = Date.UTC(2026, 10, 25, 9);
const MDP = "essai-sans-voix-sans-double-to-sv";
const SCRIPT = "Créez votre premier tableau de bord en une minute. Ouvrez l'outil et cliquez sur Nouveau tableau. Tapez le nom de votre projet. Ajoutez la carte des ventes du mois. Le graphique se remplit tout seul.";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  pieges.appels.length = 0;
  branchementsReels.mockClear();
  banc.outils = null;
  banc.journal = { voix: [], claude: [], rendus: [] };
  await auth.seConnecter(MDP, false);
  // Aucun personnage « moi » en mémoire : l'exemple de démonstration est masqué et rien n'est créé.
  await ecrireParametre("afficherExemples", false);
});

const refusDe = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code ?? "autre");

/** Brouillon construit comme le dépôt (même fonction commune), pour un format et des entrées au choix. */
async function brouillon(formatId: string, distribution: Parameters<typeof creerBrouillonFormatSansSession>[0]["distribution"], entrees: Record<string, unknown>) {
  const v = await creerBrouillonFormatSansSession({ formatId, titre: "Tuto", sujet: "Tuto", distribution, entrees });
  await enregistrerScriptDuBrouillon(v.id, [{ id: `${v.id}-b1`, blocRecette: "corps", segments: [{ id: `${v.id}-s1`, texte: SCRIPT }] }]);
  return v.id;
}
const entreesTuto = (extra: Record<string, unknown>) => ({ [ENTREE_TUTORIEL]: { idee: "Tuto", ...extra } });

async function deposer(modeVoix?: "sans-voix") {
  const commandes: Awaited<ReturnType<typeof construireCommande>>[] = [];
  const brouillons: { distribution: unknown[] }[] = [];
  const r = await d.deposerTutoriel({ mode: "script", script: SCRIPT, ...(modeVoix ? { modeVoix } : {}) }, {
    interrupteurs: async () => ({ formulaire: true, dossier: false, phrase: false }),
    equipe: async () => false,
    lancer: async (id) => {
      const v = await depots().videos.obtenir(id);
      brouillons.push({ distribution: v!.distribution });
      commandes.push(await construireCommande(id));
      return { statut: "lancee", travailId: "t-simule" };
    },
  });
  return { r, commandes, brouillons };
}

describe("1 · sans voix, aucun double : dépôt, lancement, 0 voix", () => {
  it("le dépôt réel réussit ; le brouillon n'a aucune distribution (pas de re-remplissage) ; la vraie commande se construit", async () => {
    expect(await personnages.listerPersonnages()).toEqual([]);
    const { r, commandes, brouillons } = await deposer("sans-voix");
    expect(r.statut).toBe("lancee");
    expect(brouillons[0]!.distribution).toEqual([]);
    expect(commandes[0]!.distribution).toEqual([]);
    expect(commandes[0]!.formatId).toBe("tutoriel-outil");
  });

  it("même avec un « moi » disponible, sans voix : aucun double n'est posé (jamais le visage ni la voix de quelqu'un)", async () => {
    await personnages.creerPersonnage({ nom: "Williams", nature: "moi" });
    const { r, brouillons } = await deposer("sans-voix");
    expect(r.statut).toBe("lancee");
    expect(brouillons[0]!.distribution).toEqual([]);
  });

  it("le moteur va au bout sans toucher HeyGen ni ElevenLabs (0 appel)", async () => {
    const { commandes } = await deposer("sans-voix");
    const commande = commandes[0]!;
    let t = await moteurMontageTutorielOutil.lancer(commande, { travailId: "t-sv", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    expect(t.etapes.map((e) => e.cle)).not.toContain("voix");
    for (let i = 0; i < 400; i++) {
      const r = await moteurMontageTutorielOutil.avancer(t, commande, T0 + i * 1000);
      t = r.travail;
      if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
    }
    expect(t.erreur).toBeUndefined();
    expect(t.statut).toBe("termine");
    expect(banc.journal.voix).toEqual([]);
    expect(pieges.appels.filter((a) => /heygen|elevenlabs/.test(a))).toEqual([]);
    expect(branchementsReels).toHaveBeenCalledTimes(0);
  });
});

describe("2 · avec voix : règle inchangée", () => {
  it("aucun double : le dépôt refuse PHRASE_PERSONNE_ABSENTE, aucun brouillon", async () => {
    const brouillon = vi.fn(async () => ({ id: "v1" }));
    const r = await d.deposerTutoriel({ mode: "script", script: SCRIPT }, { interrupteurs: async () => ({ formulaire: true, dossier: false, phrase: false }), brouillon });
    expect(r).toEqual({ statut: "refusee", phrase: d.PHRASE_PERSONNE_ABSENTE });
    expect(brouillon).not.toHaveBeenCalled();
  });
  it("avec voix explicite (« avec-voix ») : même refus", async () => {
    const r = await d.deposerTutoriel({ mode: "script", script: SCRIPT, modeVoix: "avec-voix" } as never, { interrupteurs: async () => ({ formulaire: true, dossier: false, phrase: false }) });
    expect(r).toEqual({ statut: "refusee", phrase: d.PHRASE_PERSONNE_ABSENTE });
  });
  it("fabrication : distribution vide en avec voix → DISTRIBUTION_INCOMPLETE", async () => {
    const id = await brouillon(ID_FORMAT_TUTORIEL_OUTIL, [], entreesTuto({}));
    expect(await refusDe(construireCommande(id))).toBe("DISTRIBUTION_INCOMPLETE");
  });
  it("avec voix + double posé par le dépôt : le dépôt pose bien le double par défaut (inchangé)", async () => {
    const moi = await personnages.creerPersonnage({ nom: "Williams", nature: "moi" });
    const { r, brouillons } = await deposer();
    expect(r.statut).toBe("lancee");
    expect(brouillons[0]!.distribution).toHaveLength(1);
    expect(brouillons[0]!.distribution[0]).toMatchObject({ personnageId: moi });
  });
});

describe("3 · l'accord d'un double réel n'est jamais contourné", () => {
  const reelSansAccord = async () => {
    const pid = await personnages.creerPersonnage({ nom: "Invité", nature: "reel" });
    return [{ role: "voix", personnageId: pid, source: "double" as const }];
  };
  it("avec voix + double réel sans accord → ACCORD_MANQUANT", async () => {
    const id = await brouillon(ID_FORMAT_TUTORIEL_OUTIL, await reelSansAccord(), entreesTuto({}));
    expect(await refusDe(construireCommande(id))).toBe("ACCORD_MANQUANT");
  });
  it("sans voix + distribution contenant quand même un double réel sans accord → ACCORD_MANQUANT toujours", async () => {
    const id = await brouillon(ID_FORMAT_TUTORIEL_OUTIL, await reelSansAccord(), entreesTuto(entreeModeVoix(MODE_SANS_VOIX)));
    expect(await refusDe(construireCommande(id))).toBe("ACCORD_MANQUANT");
  });
});

describe("4 · valeurs voisines : l'exception reste fermée", () => {
  it("le littéral est lié à la constante, et entreeModeVoix(MODE_SANS_VOIX) ouvre l'exception", async () => {
    expect(MODE_SANS_VOIX).toBe("sans-voix");
    expect(ENTREE_TUTORIEL).toBe("tutorielOutil");
    expect(ID_FORMAT_TUTORIEL_OUTIL).toBe("tutoriel-outil");
    const id = await brouillon(ID_FORMAT_TUTORIEL_OUTIL, [], entreesTuto(entreeModeVoix(MODE_SANS_VOIX)));
    expect(await refusDe(construireCommande(id))).toBeNull();
  });
  it.each([
    ["« Sans-Voix »", { modeVoix: "Sans-Voix" }],
    ["« sans voix »", { modeVoix: "sans voix" }],
    ["true", { modeVoix: true }],
    ["« avec-voix »", { modeVoix: "avec-voix" }],
    ["absent", {}],
  ])("modeVoix %s, distribution vide → DISTRIBUTION_INCOMPLETE", async (_n, extra) => {
    const id = await brouillon(ID_FORMAT_TUTORIEL_OUTIL, [], entreesTuto(extra));
    expect(await refusDe(construireCommande(id))).toBe("DISTRIBUTION_INCOMPLETE");
  });
});

describe("5 · autres formats inchangés", () => {
  it("un autre format (min ≥ 1) avec modeVoix « sans-voix » dans entrees.tutorielOutil → DISTRIBUTION_INCOMPLETE", async () => {
    for (const formatId of ["facecam-animee", "cas-concret", "tableau-anime"]) {
      const id = await brouillon(formatId, [], entreesTuto(entreeModeVoix(MODE_SANS_VOIX)));
      expect(await refusDe(construireCommande(id)), formatId).toBe("DISTRIBUTION_INCOMPLETE");
    }
  });
  it("image-video : sansVoix true garde son exception ; sans elle, DISTRIBUTION_INCOMPLETE", async () => {
    const avec = await brouillon("image-video", [], { imageVideo: { sansVoix: true } });
    expect(await refusDe(construireCommande(avec))).not.toBe("DISTRIBUTION_INCOMPLETE");
    const sans = await brouillon("image-video", [], { imageVideo: {} });
    expect(await refusDe(construireCommande(sans))).toBe("DISTRIBUTION_INCOMPLETE");
  });
});
