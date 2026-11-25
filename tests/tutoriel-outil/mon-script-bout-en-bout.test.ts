/**
 * FIN-2 · « Mon script » de bout en bout, SANS VOIX. Dépôt en mode « script » (ni phrase, ni dossier, équipe fermée, `tutoriel.claude`
 * éteint) → vraie commande de fabrication → moteur avancé pas à pas jusqu'au rendu simulé. TEST « 0 appel HeyGen / ElevenLabs » :
 * les modules HeyGen et ElevenLabs sont des pièges qui LÈVENT s'ils sont appelés, `branchementsReels` (avec voix) aussi.
 * TEST « 0 appel Claude » : le client Claude ET `depense-claude-video` (le chemin gardé que prend le vrai appeleur du tutoriel) sont
 * des pièges qui notent l'appel ; éteint (`tutoriel.claude`), rien n'est noté ; allumé (contrôle positif), le piège note l'appel.
 * 0 €, aucun appel réel : les pièges remplacent les modules.
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
// Claude : le client réseau ET le chemin gardé de l'argent (`executerRolePourVideo`, pris par le vrai appeleur du tutoriel) sont piégés.
vi.mock("@/fournisseurs/claude/client", (importOriginal) => pieges.moduleEspion("claude/client")(importOriginal as never));
vi.mock("@/services/depense-claude-video", (importOriginal) => pieges.moduleEspion("depense")(importOriginal as never));

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
const { ecrireParametre } = await import("@/services/_commun");
const { construireCommande } = await import("@/services/fabrication");
const d = await import("@/services/tutoriel-depot");
await import("@/services/tutoriel-branchements");
const { moteurMontageTutorielOutil } = await import("@/moteurs/montage-tutoriel-outil");

const T0 = Date.UTC(2026, 10, 25, 9);
const MDP = "essai-mon-script-bout-en-bout-fin-2";
const SCRIPT = "Créez votre premier tableau de bord en une minute. Ouvrez l'outil et cliquez sur Nouveau tableau. Tapez le nom de votre projet. Ajoutez la carte des ventes du mois. Le graphique se remplit tout seul. Votre tableau de bord est prêt.";


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


async function deposer(modeVoix?: "sans-voix", extra: Record<string, unknown> = {}) {
  const commandes: Awaited<ReturnType<typeof construireCommande>>[] = [];
  const r = await d.deposerTutoriel({ mode: "script", script: SCRIPT, ...(modeVoix ? { modeVoix } : {}), ...extra }, {
    // Seul le formulaire est ouvert : ni phrase, ni dossier, et l'équipe est fermée.
    interrupteurs: async () => ({ formulaire: true, dossier: false, phrase: false }),
    equipe: async () => false,
    lancer: async (id) => {
      commandes.push(await construireCommande(id));
      return { statut: "lancee", travailId: "t-simule" };
    },
  });
  if (r.statut !== "lancee") throw new Error(`dépôt refusé : ${JSON.stringify(r)}`);
  return commandes[0]!;
}

async function aller(commande: Awaited<ReturnType<typeof deposer>>, travailId: string) {
  const t0 = await moteurMontageTutorielOutil.lancer(commande, { travailId, versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  let t = t0;
  let resultat;
  for (let i = 0; i < 400; i++) {
    const r = await moteurMontageTutorielOutil.avancer(t, commande, T0 + i * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return { t0, t, resultat };
}

describe("« Mon script » sans voix : dépôt → lancement → rendu simulé, 0 HeyGen, 0 ElevenLabs, 0 Claude", () => {
  it("la commande porte le script collé, sans dépôt, sans voix ; la vidéo est rendue en 4:5, 9:16 et 1:1", async () => {
    const commande = await deposer("sans-voix");
    const entree = commande.entrees.tutorielOutil as Record<string, unknown>;
    expect(entree).toMatchObject({ scriptColle: true, modeVoix: "sans-voix", idee: "Créez votre premier tableau de bord en une minute. Ouvrez l'outil et cliquez sur" });
    expect((entree.idee as string).length).toBeLessThanOrEqual(80);
    expect("depot" in entree).toBe(false);
    expect(commande.script.texteComplet).toContain("Ajoutez la carte des ventes du mois.");

    const { t0, t, resultat } = await aller(commande, "t-ms");
    expect(t0.etapes.map((e) => e.cle)).toEqual(["script", "calage", "plan", "montage", "exports"]);
    expect(t0.etapes.map((e) => e.cle)).not.toContain("voix");
    expect(t.erreur).toBeUndefined();
    expect(t.parametres?.pause).toBeUndefined();
    expect(t.statut).toBe("termine");
    expect(resultat?.sorties.map((s) => s.ratio)).toEqual(["4:5", "9:16", "1:1"]);
    expect(resultat?.sousTitres?.length).toBeGreaterThan(0);
    expect(resultat?.lignesReelles.some((l) => /voix/i.test(l.etape))).toBe(false);
    expect(sansVoixReel.journal.rendus.some((r) => r.operation === "composition")).toBe(true);
  });

  it("0 appel HeyGen, 0 appel ElevenLabs : aucune voix, aucun module de voix ni de crédit touché, le chemin avec voix n'est pas pris", async () => {
    const commande = await deposer("sans-voix");
    await aller(commande, "t-ms-voix");
    expect(sansVoixReel.journal.voix).toEqual([]);
    expect(pieges.appels.filter((a) => /heygen|elevenlabs/.test(a))).toEqual([]);
    expect(branchementsReels).toHaveBeenCalledTimes(0);
    expect(sansVoixReel.appels).toBeGreaterThan(0);
  });

  it("0 appel Claude quand `tutoriel.claude` est éteint : ni le client ni `depense-claude-video` ne sont touchés, la vidéo est rendue", async () => {
    const commande = await deposer("sans-voix");
    const { t } = await aller(commande, "t-ms-claude");
    expect(t.statut).toBe("termine");
    expect(pieges.appels.filter((a) => /depense|claude/.test(a))).toEqual([]);
    expect(sansVoixReel.journal.claude).toEqual([]);
  });

  it("contrôle positif : avec `tutoriel.claude` allumé, le même piège note l'appel (il détecte donc bien un appel Claude)", async () => {
    await ecrireParametre("tutoriel.claude", true);
    try {
      const commande = await deposer("sans-voix");
      await aller(commande, "t-ms-claude-allume");
      expect(pieges.appels.filter((a) => /depense|claude/.test(a))).toContain("depense.executerRolePourVideo");
    } finally {
      await ecrireParametre("tutoriel.claude", false); // remis éteint (la mémoire est aussi remise à zéro par `reinitialiserDepots`)
    }
  });

  it("un script collé « Mon script » ne met pas la vidéo en pause pour une relecture : elle va au rendu sans l'équipe", async () => {
    const commande = await deposer("sans-voix", { fin: "prendre-rendez-vous" });
    const { t } = await aller(commande, "t-ms-fin");
    expect(t.parametres?.pause).toBeUndefined();
    expect(t.statut).toBe("termine");
  });
});
