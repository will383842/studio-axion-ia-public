/**
 * AUD-2 · le dépôt range « sans voix » et le script collé ; refuse phrase/dossier quand l'équipe est éteinte ; le formulaire
 * propose les deux options. Doubles injectés, aucun appel réel, 0 €.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
// Réglages de la lecture par défaut de l'équipe : `null` = les vrais réglages (éteints en test) ; sinon la table donnée.
const reglages = vi.hoisted(() => ({ table: null as Record<string, unknown> | null }));
vi.mock("@/services/_commun", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/_commun")>();
  return { ...reel, lireParametre: async (id: string, defaut: unknown) => (reglages.table ? (id in reglages.table ? reglages.table[id] : defaut) : reel.lireParametre(id, defaut)) };
});

import { estSansVoix, lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";

const d = await import("@/services/tutoriel-depot");
const { FormulaireTutorielOutil } = await import("@/components/formats/vitrines/FormulaireTutorielOutil");

const PERSONNE = [{ personnageId: "p1" }] as never;
function banc(options: { equipe?: boolean; distribution?: unknown[] } = {}) {
  const brouillons: { entrees: Record<string, unknown>; script?: string; distribution: unknown[] }[] = [];
  const compte = { lancements: 0 };
  const dep: import("@/services/tutoriel-depot").DependancesDepotTutoriel = {
    interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: true }),
    equipe: async () => options.equipe ?? true,
    distribution: async () => (options.distribution ?? PERSONNE) as never,
    fichier: async (id) => ({ id, nom: "a.zip", taille: 10, cleStockage: "k" }),
    octets: async () => new Uint8Array([1]),
    extraire: async () => ({ ok: true, fichiers: new Map(), rapport: { refus: [], ignores: [], masques: [], imagesEcartees: [] } }),
    brouillon: async (e) => {
      brouillons.push({ entrees: e.entrees, script: e.script, distribution: e.distribution });
      return { id: "v1" };
    },
    ratios: async () => undefined,
    lancer: async () => {
      compte.lancements++;
      return { statut: "lancee", travailId: "t1" };
    },
    abandonner: async () => undefined,
  };
  return { brouillons, compte, dep };
}
const phrase = { mode: "phrase" as const, phrase: "Un tableau de bord pour un atelier" };
const entreeDe = (b: { entrees: Record<string, unknown> }) => b.entrees.tutorielOutil as Record<string, unknown>;

describe("sans voix : rangé par entreeModeVoix", () => {
  it("modeVoix « sans-voix » : l'entrée porte modeVoix et la chaîne le lit comme sans voix", async () => {
    const { brouillons, dep } = banc();
    expect(await d.deposerTutoriel({ ...phrase, modeVoix: "sans-voix" }, dep)).toEqual({ statut: "lancee", videoId: "v1" });
    expect(entreeDe(brouillons[0]!).modeVoix).toBe("sans-voix");
    expect(estSansVoix(brouillons[0]!.entrees)).toBe(true);
  });
  it("absent, « avec-voix » ou autre valeur : aucune clé modeVoix (le défaut ne change pas)", async () => {
    for (const modeVoix of [undefined, "avec-voix", "oui", true]) {
      const { brouillons, dep } = banc();
      await d.deposerTutoriel({ ...phrase, modeVoix }, dep);
      expect("modeVoix" in entreeDe(brouillons[0]!)).toBe(false);
    }
  });
  it("sans voix, personne de disponible : accepté sans aucun double (distribution vide, la distribution par défaut n'est même pas appelée) ; avec voix : refus lisible, aucun brouillon", async () => {
    for (const distribution of [[], [{}], PERSONNE]) {
      const a = banc({ distribution });
      const appel = vi.fn(a.dep.distribution!);
      expect(await d.deposerTutoriel({ ...phrase, modeVoix: "sans-voix" }, { ...a.dep, distribution: appel })).toEqual({ statut: "lancee", videoId: "v1" });
      expect(appel).not.toHaveBeenCalled();
      expect(a.brouillons).toHaveLength(1);
      expect(a.brouillons[0]!.distribution).toEqual([]);
      expect(a.compte.lancements).toBe(1);
    }
    for (const distribution of [[], [{}]]) {
      const c = banc({ distribution });
      expect(await d.deposerTutoriel(phrase, c.dep)).toEqual({ statut: "refusee", phrase: d.PHRASE_PERSONNE_ABSENTE });
      expect(c.brouillons).toHaveLength(0);
      expect(c.compte.lancements).toBe(0);
    }
  });
});

describe("script collé : rempli dans le brouillon", () => {
  it("script → brouillon avec le texte (rogné) et scriptColle: true ; la chaîne le lit", async () => {
    const { brouillons, dep } = banc();
    await d.deposerTutoriel({ ...phrase, script: "  Bonjour. Voici comment faire.  " }, dep);
    expect(brouillons[0]!.script).toBe("Bonjour. Voici comment faire.");
    expect(entreeDe(brouillons[0]!).scriptColle).toBe(true);
    expect(lireEntreesTutoriel(brouillons[0]!.entrees).scriptColle).toBe(true);
  });
  it("pas de script (vide ou espaces) : pas de scriptColle ; script trop long ou pas un texte : refus", async () => {
    const { brouillons, dep } = banc();
    await d.deposerTutoriel({ ...phrase, script: "   " }, dep);
    expect("scriptColle" in entreeDe(brouillons[0]!)).toBe(false);
    expect(brouillons[0]!.script).toBeUndefined();
    const b = banc();
    expect((await d.deposerTutoriel({ ...phrase, script: "x".repeat(d.SCRIPT_COLLE_MAX + 1) }, b.dep)).statut).toBe("refusee");
    expect((await d.deposerTutoriel({ ...phrase, script: 42 }, b.dep)).statut).toBe("refusee");
    expect(b.brouillons).toHaveLength(0);
  });
});

describe("équipe éteinte : refus lisible, rien n'est créé", () => {
  it("phrase sans script : refusée avec la phrase dédiée, ni brouillon ni lancement", async () => {
    const { brouillons, compte, dep } = banc({ equipe: false });
    expect(await d.deposerTutoriel(phrase, dep)).toEqual({ statut: "refusee", phrase: d.PHRASE_EQUIPE_FERMEE });
    expect(brouillons).toHaveLength(0);
    expect(compte.lancements).toBe(0);
  });
  it("dossier sans script : refusé de même", async () => {
    const { brouillons, dep } = banc({ equipe: false });
    expect(await d.deposerTutoriel({ mode: "dossier", fichierId: "f", attestationImages: true }, dep)).toEqual({ statut: "refusee", phrase: d.PHRASE_EQUIPE_FERMEE });
    expect(brouillons).toHaveLength(0);
  });
  it("avec un script collé, l'équipe n'est pas nécessaire : dépôt accepté", async () => {
    const { brouillons, dep } = banc({ equipe: false });
    expect((await d.deposerTutoriel({ ...phrase, script: "Mon script." }, dep)).statut).toBe("lancee");
    expect(brouillons).toHaveLength(1);
  });
  it("lecture par défaut : tutoriel.equipe vrai mais tutoriel.claude faux (ou lecture en échec) : refusé", async () => {
    const sansEquipe = { ...banc().dep, equipe: undefined };
    try {
      for (const table of [{ "tutoriel.equipe": true, "tutoriel.claude": false }, { "tutoriel.equipe": true }, { "tutoriel.equipe": true, "tutoriel.claude": "true" }]) {
        reglages.table = table;
        const brouillon = vi.fn(async () => ({ id: "v1" }));
        expect(await d.deposerTutoriel(phrase, { ...sansEquipe, brouillon })).toEqual({ statut: "refusee", phrase: d.PHRASE_EQUIPE_FERMEE });
        expect(brouillon).not.toHaveBeenCalled();
      }
      reglages.table = { "tutoriel.equipe": true, "tutoriel.claude": true };
      expect((await d.deposerTutoriel(phrase, { ...sansEquipe, brouillon: async () => ({ id: "v1" }) })).statut).toBe("lancee");
    } finally {
      reglages.table = null;
    }
  });
  it("lecture par défaut : seul `true` exact du réglage tutoriel.equipe ouvre ; jamais d'écriture", async () => {
    const sansEquipe = { ...banc().dep, equipe: undefined };
    const brouillon = vi.fn(async () => ({ id: "v1" }));
    // Réglages réels absents (dépôts en mémoire de test) : éteint, donc refus.
    const r = await d.deposerTutoriel(phrase, { ...sansEquipe, brouillon });
    expect(r).toEqual({ statut: "refusee", phrase: d.PHRASE_EQUIPE_FERMEE });
    expect(brouillon).not.toHaveBeenCalled();
  });
});

describe("formulaire : sans voix et script collé", () => {
  const deposer = vi.fn(async () => ({ ok: true as const, donnees: { statut: "lancee" as const, videoId: "v1" } }));
  const html = renderToStaticMarkup(createElement(FormulaireTutorielOutil, { interrupteurs: { formulaire: true, dossier: true, phrase: true }, deposer } as never));
  const texte = html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
  it("propose le choix « Sans voix » en pastilles (« Avec voix » par défaut) et la zone « script »", () => {
    expect(texte).toContain("Sans voix (sous-titres)");
    expect(texte).toContain("Script à utiliser tel quel (facultatif)");
    const pastilles = [...html.split("bloc-son").slice(1).join(" ").matchAll(/<button[^>]*role="radio"[^>]*aria-checked="(true|false)"/g)].map((m) => m[1]);
    expect(pastilles).toEqual(["true", "false"]);
    expect(deposer).not.toHaveBeenCalled();
  });
});
