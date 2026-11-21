/**
 * UI-1 · TEST OBLIGATOIRE « 0 HeyGen / 0 ElevenLabs » du tutoriel d'outil. Dépôt (mode « Mon script » + « Sans voix »)
 * → vraie commande de fabrication → moteur avancé pas à pas avec les outils RÉELS du Studio (`brancherServicesTutoriel`),
 * dont seul le rendu est un double. Les modules HeyGen et ElevenLabs sont des pièges qui LÈVENT s'ils sont appelés ;
 * `branchementsReels` (le chemin avec voix) lève aussi : seul `branchementsReelsSansVoix` peut servir. 0 €, aucun appel réel.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { Journal } from "./doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const pieges = vi.hoisted(() => {
  const appels: string[] = [];
  /** Le vrai module, sauf que chaque FONCTION (nom en minuscule) lève et note l'appel ; classes et constantes restent. */
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

vi.mock("@/fournisseurs/heygen/voix", (importOriginal) => pieges.moduleEspion("heygen/voix")(importOriginal as never));
vi.mock("@/fournisseurs/heygen/client", (importOriginal) => pieges.moduleEspion("heygen/client")(importOriginal as never));
vi.mock("@/fournisseurs/heygen/rendus", (importOriginal) => pieges.moduleEspion("heygen/rendus")(importOriginal as never));
vi.mock("@/fournisseurs/credits/heygen", (importOriginal) => pieges.moduleEspion("credits/heygen")(importOriginal as never));
vi.mock("@/fournisseurs/credits/elevenlabs", (importOriginal) => pieges.moduleEspion("credits/elevenlabs")(importOriginal as never));

const sansVoixReel = vi.hoisted(() => ({ appels: 0, journal: null as unknown as Journal, outils: null as unknown as import("../../src/moteurs/montage-tutoriel-outil").OutilsTutoriel | null }));
const branchementsReels = vi.hoisted(() => vi.fn(async () => {
  throw new Error("branchementsReels (avec voix) ne doit pas être appelé sans voix");
}));

vi.mock("@/services/tableau-outils", async () => {
  const { outilsDoubles } = await import("./doubles");
  return {
    TARIF_VOIX_CENTIMES_PAR_CARACTERE: 0,
    branchementsReels,
    branchementsReelsSansVoix: async () => {
      sansVoixReel.appels++;
      // Le même double de rendu à chaque tour (il garde ses demandes, comme le vrai service).
      const o = (sansVoixReel.outils ??= outilsDoubles(sansVoixReel.journal));
      return { env: "dev", montage: { rendu: o.rendu!.service, signer: async (lectures: Record<string, string>, depots: { cle: string }[]) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://stockage.test/${c}`])), depots: Object.fromEntries(depots.map((x) => [x.cle, `https://depot.test/${x.cle}`])) }) } };
    },
  };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const d = await import("@/services/tutoriel-depot");
await import("@/services/tutoriel-branchements");
const { moteurMontageTutorielOutil } = await import("@/moteurs/montage-tutoriel-outil");

const MDP = "essai-sans-voix-bout-en-bout-ui-1";
const SCRIPT = "Créez votre premier tableau de bord en une minute. Ouvrez l'outil et cliquez sur Nouveau tableau. Tapez le nom de votre projet. Ajoutez la carte des ventes du mois. Le graphique se remplit tout seul. Votre tableau de bord est prêt.";
const T0 = Date.UTC(2026, 10, 21, 9);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  pieges.appels.length = 0;
  branchementsReels.mockClear();
  sansVoixReel.appels = 0;
  sansVoixReel.outils = null;
  sansVoixReel.journal = { voix: [], claude: [], rendus: [] };
  await auth.seConnecter(MDP, false);
});

async function deposer(modeVoix?: "sans-voix") {
  const commandes: Awaited<ReturnType<typeof construireCommande>>[] = [];
  const r = await d.deposerTutoriel({ mode: "script", script: SCRIPT, ...(modeVoix ? { modeVoix } : {}) }, {
    interrupteurs: async () => ({ formulaire: true, dossier: false, phrase: false }),
    lancer: async (id) => {
      commandes.push(await construireCommande(id));
      return { statut: "lancee", travailId: "t-simule" };
    },
  });
  if (r.statut !== "lancee") throw new Error(`dépôt refusé : ${JSON.stringify(r)}`);
  return commandes[0];
}

describe("tutoriel sans voix : 0 appel HeyGen, 0 appel ElevenLabs", () => {
  it("dépôt « Mon script » + « Sans voix » → vidéo rendue 4:5, 9:16 et 1:1, sans étape ni coût de voix", async () => {
    const commande = await deposer("sans-voix");
    expect(commande.entrees.tutorielOutil).toMatchObject({ scriptColle: true, modeVoix: "sans-voix" });

    const t0 = await moteurMontageTutorielOutil.lancer(commande, { travailId: "t-sv", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    expect(t0.etapes.map((e) => e.cle)).toEqual(["script", "calage", "plan", "montage", "exports"]);
    expect(t0.etapes.map((e) => e.cle)).not.toContain("voix");

    let t = t0;
    let resultat;
    for (let i = 0; i < 400; i++) {
      const r = await moteurMontageTutorielOutil.avancer(t, commande, T0 + i * 1000);
      t = r.travail;
      resultat = r.resultat ?? resultat;
      if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
    }
    expect(t.erreur).toBeUndefined();
    expect(t.parametres?.pause).toBeUndefined();
    expect(t.statut).toBe("termine");
    expect(resultat?.sorties.map((s) => s.ratio)).toEqual(["4:5", "9:16", "1:1"]);
    expect(resultat?.sousTitres?.length).toBeGreaterThan(0);
    expect(resultat?.lignesReelles.some((l) => /voix/i.test(l.etape))).toBe(false);
    expect(t.etapes.some((e) => e.cle === "voix")).toBe(false);

    // Le piège : rien de la voix n'a été touché.
    expect(sansVoixReel.journal.voix).toEqual([]);
    expect(pieges.appels).toEqual([]);
    expect(branchementsReels).toHaveBeenCalledTimes(0);
    expect(sansVoixReel.appels).toBeGreaterThan(0);
    expect(sansVoixReel.journal.rendus.some((r) => r.operation === "composition")).toBe(true);
  });

  it("le défaut (sans choix) reste AVEC voix : l'étape « voix » existe, aucune clé modeVoix", async () => {
    const commande = await deposer();
    expect("modeVoix" in (commande.entrees.tutorielOutil as Record<string, unknown>)).toBe(false);
    const t0 = await moteurMontageTutorielOutil.lancer(commande, { travailId: "t-av", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    expect(t0.etapes.map((e) => e.cle)).toEqual(["script", "voix", "calage", "plan", "montage", "exports"]);
    // Non exécuté jusqu'au bout : rien n'est appelé non plus à la préparation.
    expect(pieges.appels).toEqual([]);
  });
});
