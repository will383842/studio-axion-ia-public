/**
 * FIN-2 · mode « Mon script » du dépôt : le script collé tient lieu de phrase et de dossier. Seul le formulaire doit être
 * ouvert ; l'équipe n'est pas nécessaire. Doubles injectés, aucun appel réel, 0 €.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

import { lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";

const d = await import("@/services/tutoriel-depot");

const SCRIPT = "Créez votre premier tableau de bord en une minute.\nOuvrez l'outil et cliquez sur Nouveau tableau.\nTapez le nom de votre projet.";
const SEUL_FORMULAIRE = { formulaire: true, dossier: false, phrase: false };

function banc(options: { interrupteurs?: typeof SEUL_FORMULAIRE; equipe?: boolean; distribution?: unknown[] } = {}) {
  const brouillons: { entrees: Record<string, unknown>; script?: string; titre: string; sujet: string }[] = [];
  const compte = { equipe: 0, fichier: 0, octets: 0, extraire: 0, lancements: 0, abandons: 0 };
  const dep: import("@/services/tutoriel-depot").DependancesDepotTutoriel = {
    interrupteurs: async () => options.interrupteurs ?? SEUL_FORMULAIRE,
    equipe: async () => {
      compte.equipe++;
      return options.equipe ?? false;
    },
    distribution: async () => (options.distribution ?? [{ personnageId: "p1" }]) as never,
    fichier: async (id) => {
      compte.fichier++;
      return { id, nom: "a.zip", taille: 10, cleStockage: "k" };
    },
    octets: async () => {
      compte.octets++;
      return new Uint8Array([1]);
    },
    extraire: async () => {
      compte.extraire++;
      return { ok: true, fichiers: new Map(), rapport: { refus: [], ignores: [], masques: [], imagesEcartees: [] } };
    },
    brouillon: async (e) => {
      brouillons.push({ entrees: e.entrees, script: e.script, titre: e.titre, sujet: e.sujet });
      return { id: "v1" };
    },
    ratios: async () => undefined,
    lancer: async () => {
      compte.lancements++;
      return { statut: "lancee", travailId: "t1" };
    },
    abandonner: async () => {
      compte.abandons++;
    },
  };
  return { brouillons, compte, dep };
}
const demande = (extra: Record<string, unknown> = {}) => ({ mode: "script" as const, script: SCRIPT, ...extra });
const entreeDe = (b: { entrees: Record<string, unknown> }) => b.entrees.tutorielOutil as Record<string, unknown>;

describe("« Mon script » : accepté avec seulement le formulaire ouvert", () => {
  it("phrase et dossier éteints, équipe fermée : le dépôt est lancé, une seule fois, sans dossier ni équipe", async () => {
    const { brouillons, compte, dep } = banc({ equipe: false });
    expect(await d.deposerTutoriel(demande(), dep)).toEqual({ statut: "lancee", videoId: "v1" });
    expect(brouillons).toHaveLength(1);
    expect(compte.lancements).toBe(1);
    expect(compte.abandons).toBe(0);
    // Aucun dossier lu, aucune équipe interrogée : le script suffit.
    expect(compte).toMatchObject({ fichier: 0, octets: 0, extraire: 0 });
  });
  it("le mode « script » n'ouvre rien d'autre : phrase et dossier restent refusés tant que leur entrée est éteinte", async () => {
    const { dep } = banc();
    expect(await d.deposerTutoriel({ mode: "phrase", phrase: "Un tableau de bord pour un atelier", script: SCRIPT }, dep)).toEqual({ statut: "refusee", phrase: d.PHRASE_PHRASE_FERMEE });
    expect((await d.deposerTutoriel({ mode: "dossier", fichierId: "f", attestationImages: true, script: SCRIPT }, dep)).statut).toBe("refusee");
  });
});

describe("« Mon script » : refus lisibles, rien n'est créé", () => {
  it("formulaire éteint : refus, rien n'est créé ni lancé", async () => {
    const { brouillons, compte, dep } = banc({ interrupteurs: { formulaire: false, dossier: true, phrase: true } });
    expect(await d.deposerTutoriel(demande(), dep)).toEqual({ statut: "refusee", phrase: d.PHRASE_TUTORIEL_FERME });
    expect(brouillons).toHaveLength(0);
    expect(compte.lancements).toBe(0);
    // Le réglage lui-même : seul le booléen `true` exact ouvre le formulaire (donc le mode « script »).
    for (const brut of ["true", 1, null, undefined]) expect((await d.lireInterrupteursTutoriel(async () => brut)).formulaire).toBe(false);
    expect((await d.lireInterrupteursTutoriel(async () => true)).formulaire).toBe(true);
  });
  it("script absent, vide, blanc ou trop court (moins de 40 caractères) : « Collez votre script (40 caractères au moins). »", async () => {
    expect(d.PHRASE_SCRIPT_REQUIS).toBe("Collez votre script (40 caractères au moins).");
    expect(d.SCRIPT_COLLE_MIN).toBe(40);
    for (const script of [undefined, null, "", "   \n  ", "Trop court.", "x".repeat(39), `  ${"x".repeat(39)}  `]) {
      const { brouillons, compte, dep } = banc();
      expect(await d.deposerTutoriel({ mode: "script", script }, dep), String(script)).toEqual({ statut: "refusee", phrase: d.PHRASE_SCRIPT_REQUIS });
      expect(brouillons).toHaveLength(0);
      expect(compte.lancements).toBe(0);
    }
  });
  it("exactement 40 caractères (après rognage) : accepté ; 8000 : accepté ; 8001 : refusé", async () => {
    for (const [script, statut] of [["x".repeat(40), "lancee"], [`  ${"x".repeat(40)}  `, "lancee"], ["x".repeat(d.SCRIPT_COLLE_MAX), "lancee"], ["x".repeat(d.SCRIPT_COLLE_MAX + 1), "refusee"]] as const) {
      const { dep } = banc();
      expect((await d.deposerTutoriel({ mode: "script", script }, dep)).statut).toBe(statut);
    }
  });
  it("script qui n'est pas un texte : refus lisible, rien n'est créé", async () => {
    const { brouillons, dep } = banc();
    expect((await d.deposerTutoriel({ mode: "script", script: 42 }, dep)).statut).toBe("refusee");
    expect(brouillons).toHaveLength(0);
  });
  it("personne de disponible : le refus « personne » reste inchangé", async () => {
    const { brouillons, dep } = banc({ distribution: [] });
    expect(await d.deposerTutoriel(demande(), dep)).toEqual({ statut: "refusee", phrase: d.PHRASE_PERSONNE_ABSENTE });
    expect(brouillons).toHaveLength(0);
  });
  it("lancement refusé : brouillon abandonné (comme les autres modes)", async () => {
    const { compte, dep } = banc();
    dep.lancer = async () => ({ statut: "accord-requis", centimes: 5, phrase: "x" });
    expect((await d.deposerTutoriel(demande(), dep)).statut).toBe("refusee");
    expect(compte.abandons).toBe(1);
  });
});

describe("« Mon script » : ce qui est écrit dans le brouillon", () => {
  it("aucun `depot` ; `idee` = le titre, `scriptColle: true`, `fin` ; la chaîne le relit comme un script collé sans dépôt", async () => {
    const { brouillons, dep } = banc();
    await d.deposerTutoriel(demande({ fin: "prendre-rendez-vous", gabarit: "G-Flux" }), dep);
    const entree = entreeDe(brouillons[0]!);
    expect("depot" in entree).toBe(false);
    expect(entree).toEqual({ idee: "Créez votre premier tableau de bord en une minute.", fin: "prendre-rendez-vous", gabarit: "G-Flux", scriptColle: true });
    expect(lireEntreesTutoriel(brouillons[0]!.entrees)).toMatchObject({ idee: "Créez votre premier tableau de bord en une minute.", scriptColle: true, gabarit: "G-Flux", fin: "rendez-vous" });
    expect(lireEntreesTutoriel(brouillons[0]!.entrees).depot).toBeUndefined();
  });
  it("sans fin ni parcours : fin « aucune », pas de clé gabarit ; un parcours inconnu est ignoré", async () => {
    const { brouillons, dep } = banc();
    await d.deposerTutoriel(demande({ gabarit: "G-Inconnu" }), dep);
    const entree = entreeDe(brouillons[0]!);
    expect(entree.fin).toBe("aucune");
    expect("gabarit" in entree).toBe(false);
  });
  it("le brouillon reçoit le script rogné (texte tel quel, avec ses retours à la ligne)", async () => {
    const { brouillons, dep } = banc();
    await d.deposerTutoriel(demande({ script: `  ${SCRIPT}\n\n` }), dep);
    expect(brouillons[0]!.script).toBe(SCRIPT);
  });
  it("le titre (et le sujet) viennent de la première ligne non vide du script", async () => {
    const { brouillons, dep } = banc();
    await d.deposerTutoriel(demande({ script: `\n\n   Mon  titre   de départ\n${"y".repeat(60)}` }), dep);
    expect(brouillons[0]!.titre).toBe("Mon titre de départ");
    expect(brouillons[0]!.sujet).toBe("Mon titre de départ");
    expect(entreeDe(brouillons[0]!).idee).toBe("Mon titre de départ");
  });
  it("première ligne trop longue : coupée à 80 caractères au plus, sur un mot entier, sans « … »", async () => {
    const mots = Array.from({ length: 40 }, (_, i) => `mot${i}`).join(" ");
    const { brouillons, dep } = banc();
    await d.deposerTutoriel(demande({ script: `${mots}\nSuite.` }), dep);
    const titre = brouillons[0]!.titre;
    expect(titre.length).toBeLessThanOrEqual(80);
    expect(titre.length).toBeGreaterThan(60);
    expect(titre).not.toContain("…");
    expect(mots.startsWith(titre)).toBe(true);
    expect(mots[titre.length]).toBe(" ");
  });
  it("titreDuScript : mot entier, ligne exacte de 80, mot unique démesuré, ponctuation finale retirée à la coupe", () => {
    const quatreVingt = `${"a".repeat(39)} ${"b".repeat(40)}`;
    expect(quatreVingt).toHaveLength(80);
    expect(d.titreDuScript(quatreVingt)).toBe(quatreVingt);
    expect(d.titreDuScript(`${quatreVingt} suite`)).toBe(quatreVingt);
    expect(d.titreDuScript(`${"a".repeat(79)} ${"b".repeat(20)}`)).toBe("a".repeat(79));
    expect(d.titreDuScript("z".repeat(200))).toBe("z".repeat(80));
    expect(d.titreDuScript(`${"a".repeat(70)}, ${"b".repeat(20)}`)).toBe("a".repeat(70));
    expect(d.titreDuScript("  \n \n")).toBe("Tutoriel d'outil");
  });
  it("`sansVoix` est transmis : modeVoix « sans-voix » rangé dans l'entrée ; absent ou autre valeur : aucune clé", async () => {
    const a = banc();
    await d.deposerTutoriel(demande({ modeVoix: "sans-voix" }), a.dep);
    expect(entreeDe(a.brouillons[0]!).modeVoix).toBe("sans-voix");
    expect(lireEntreesTutoriel(a.brouillons[0]!.entrees).sansVoix).toBe(true);
    for (const modeVoix of [undefined, "avec-voix", "oui", true]) {
      const b = banc();
      await d.deposerTutoriel(demande({ modeVoix }), b.dep);
      expect("modeVoix" in entreeDe(b.brouillons[0]!)).toBe(false);
    }
  });
  it("les formats : tous par défaut ; 4:5 obligatoire comme pour les autres modes", async () => {
    const ratios: string[][] = [];
    const a = banc();
    a.dep.ratios = async (_id, r) => void ratios.push(r);
    await d.deposerTutoriel(demande(), a.dep);
    await d.deposerTutoriel(demande({ ratios: ["9:16"] }), a.dep);
    expect(ratios).toEqual([["4:5", "9:16", "1:1"]]);
    expect(a.brouillons).toHaveLength(1);
  });
});

describe("« Mon script » : l'équipe n'est pas nécessaire (et jamais interrogée)", () => {
  it("équipe fermée ou ouverte : même résultat ; sans script collé, phrase et dossier restent refusés équipe fermée", async () => {
    for (const equipe of [false, true]) {
      const { brouillons, compte, dep } = banc({ equipe });
      expect((await d.deposerTutoriel(demande(), dep)).statut).toBe("lancee");
      expect(brouillons).toHaveLength(1);
      expect(compte.equipe).toBe(0); // jamais interrogée en mode script
    }
    const f = banc({ interrupteurs: { formulaire: true, dossier: true, phrase: true }, equipe: false });
    expect(await d.deposerTutoriel({ mode: "phrase", phrase: "Un tableau de bord pour un atelier" }, f.dep)).toEqual({ statut: "refusee", phrase: d.PHRASE_EQUIPE_FERMEE });
    expect(f.brouillons).toHaveLength(0);
  });
});
