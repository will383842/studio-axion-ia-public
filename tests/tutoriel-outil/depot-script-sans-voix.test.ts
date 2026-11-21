/**
 * UI-1 · dépôt du tutoriel en mode « Mon script » et choix « Sans voix ». Dépôts en mémoire, la vraie garde de fabrication
 * (`construireCommande`), aucun appel réel, 0 €. Seul `"sans-voix"` exact écrit `modeVoix` ; le défaut reste avec voix.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { depots } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const d = await import("@/services/tutoriel-depot");

const MDP = "essai-depot-script-sans-voix-ui-1";
const SCRIPT = "Ouvrez Calendly. Cliquez sur Nouvel événement. Tapez le titre. Enregistrez, puis copiez le lien.";
const script = { mode: "script" as const, script: SCRIPT };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

function banc(sw = { formulaire: true, dossier: true, phrase: true }) {
  const compte = { gardes: 0, abandons: [] as string[] };
  const dep: import("@/services/tutoriel-depot").DependancesDepotTutoriel = {
    interrupteurs: async () => sw,
    lancer: async (id) => {
      compte.gardes++;
      await construireCommande(id);
      return { statut: "lancee", travailId: "t-simule" };
    },
    abandonner: async (id) => void compte.abandons.push(id),
  };
  return { compte, dep };
}

async function entreeDe(videoId: string) {
  const v = await depots().videos.obtenir(videoId);
  return (v?.entrees as Record<string, Record<string, unknown>> | undefined)?.tutorielOutil;
}

describe("mode script + sans voix", () => {
  it("brouillon avec le script, modeVoix « sans-voix », scriptColle, et la garde de fabrication passe", async () => {
    const { compte, dep } = banc();
    const r = await d.deposerTutoriel({ ...script, modeVoix: "sans-voix" }, dep);
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    expect(compte.gardes).toBe(1);
    const e = await entreeDe(r.videoId);
    expect(e?.modeVoix).toBe("sans-voix");
    expect(e?.scriptColle).toBe(true);
    expect(e?.depot).toBeUndefined();
    const commande = await construireCommande(r.videoId);
    expect(commande.script.texteComplet).toContain(SCRIPT);
    expect((commande.entrees as Record<string, Record<string, unknown>>).tutorielOutil.modeVoix).toBe("sans-voix");
    const v = await depots().videos.obtenir(r.videoId);
    expect(v?.titre).toBe(SCRIPT.slice(0, 80));
  });

  it("le script est rangé tel quel (espaces de bord retirés seulement)", async () => {
    const { dep } = banc();
    const r = await d.deposerTutoriel({ mode: "script", script: `  ${SCRIPT}  ` }, dep);
    if (r.statut !== "lancee") throw new Error("refusé");
    expect((await construireCommande(r.videoId)).script.texteComplet).toBe(SCRIPT);
  });

  it("mode script ouvert même sans entrée dossier ni phrase, tant que le formulaire est allumé", async () => {
    const { dep } = banc({ formulaire: true, dossier: false, phrase: false });
    expect((await d.deposerTutoriel(script, dep)).statut).toBe("lancee");
  });

  it("formulaire éteint : refus, rien n'est créé", async () => {
    const { dep } = banc({ formulaire: false, dossier: true, phrase: true });
    const avant = (await depots().videos.lister()).length;
    expect(await d.deposerTutoriel(script, dep)).toEqual({ statut: "refusee", phrase: d.PHRASE_TUTORIEL_FERME });
    expect((await depots().videos.lister()).length).toBe(avant);
  });
});

describe("le défaut reste avec voix", () => {
  it.each([[undefined], ["sans voix"], ["Sans-voix"], ["avec-voix"], [true], [1], [null], [""]])("modeVoix %j : aucune clé modeVoix", async (valeur) => {
    const { dep } = banc();
    const r = await d.deposerTutoriel({ ...script, ...(valeur === undefined ? {} : { modeVoix: valeur }) }, dep);
    if (r.statut !== "lancee") throw new Error("refusé");
    const e = await entreeDe(r.videoId);
    expect(e).toBeDefined();
    expect("modeVoix" in (e ?? {})).toBe(false);
  });
});

describe("bornes du script", () => {
  it.each([["trop court", "court"], ["vide", ""], ["que des espaces", "            "], ["trop long", "a".repeat(d.SCRIPT_DEPOT_MAX + 1)], ["pas un texte", 42]])("%s : refus, rien de créé", async (_n, texte) => {
    const { compte, dep } = banc();
    const avant = (await depots().videos.lister()).length;
    const r = await d.deposerTutoriel({ mode: "script", script: texte as string, modeVoix: "sans-voix" }, dep);
    expect(r.statut).toBe("refusee");
    expect(compte.gardes).toBe(0);
    expect((await depots().videos.lister()).length).toBe(avant);
  });
  it("les bornes exactes passent", async () => {
    expect(d.SCRIPT_DEPOT_MIN).toBe(10);
    expect(d.SCRIPT_DEPOT_MAX).toBe(5000);
    for (const t of ["a".repeat(10), "a".repeat(5000)]) {
      const { dep } = banc();
      expect((await d.deposerTutoriel({ mode: "script", script: t }, dep)).statut).toBe("lancee");
    }
  });
});

describe("phrase et dossier : sans voix possible, sans régression", () => {
  const phrase = { mode: "phrase" as const, phrase: "Un tableau de bord pour un atelier" };
  it("phrase : entrée { depot, fin } sans modeVoix par défaut ; « sans-voix » choisi l'écrit", async () => {
    const { dep } = banc();
    const a = await d.deposerTutoriel(phrase, dep);
    if (a.statut !== "lancee") throw new Error("refusé");
    const ea = await entreeDe(a.videoId);
    expect(ea?.depot).toEqual({ mode: "phrase", phrase: phrase.phrase });
    expect(ea?.scriptColle).toBeUndefined();
    expect("modeVoix" in (ea ?? {})).toBe(false);
    const b = await d.deposerTutoriel({ ...phrase, modeVoix: "sans-voix" }, dep);
    if (b.statut !== "lancee") throw new Error("refusé");
    const eb = await entreeDe(b.videoId);
    expect(eb?.modeVoix).toBe("sans-voix");
    expect(eb?.depot).toEqual({ mode: "phrase", phrase: phrase.phrase });
    const v = await depots().videos.obtenir(b.videoId);
    expect(v?.scriptId).toBeTruthy();
  });
  it("dossier : « sans-voix » choisi s'écrit, le défaut non", async () => {
    const { dep } = banc();
    const complet = {
      ...dep,
      fichier: async (id: string) => ({ id, nom: "mon-tuto.zip", taille: 10, cleStockage: "k" }),
      octets: async () => new Uint8Array(1),
      extraire: async () => ({ ok: true }) as never,
    };
    const a = await d.deposerTutoriel({ mode: "dossier", fichierId: "f1", attestationImages: true }, complet);
    const b = await d.deposerTutoriel({ mode: "dossier", fichierId: "f1", attestationImages: true, modeVoix: "sans-voix" }, complet);
    if (a.statut !== "lancee" || b.statut !== "lancee") throw new Error("refusé");
    expect("modeVoix" in ((await entreeDe(a.videoId)) ?? {})).toBe(false);
    const eb = await entreeDe(b.videoId);
    expect(eb?.modeVoix).toBe("sans-voix");
    expect((eb?.depot as { mode: string }).mode).toBe("dossier");
  });
  it("un mode inconnu est refusé", async () => {
    const { dep } = banc();
    expect((await d.deposerTutoriel({ mode: "autre" } as never, dep)).statut).toBe("refusee");
  });
});
