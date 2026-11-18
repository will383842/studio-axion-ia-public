/**
 * T-EXT-36 · Panneau du tutoriel dans la console. Dépôt mémoire, aucun appel réel, 0 €. Tout éteint par défaut.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DepenseEnregistree, Video } from "@/domaine/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const c = await import("@/services/tutoriel-console");
const { PanneauConsole } = await import("@/components/tutoriel-outil/PanneauConsole");
const { mentionIAAAfficher, TEXTE_MENTION_IA_PAR_DEFAUT } = await import("@/briques/mentions-legales/etiquetage-ia");

const INTERDIT = /€|\$|\bEUR\b|\bUSD\b|euros?\b|dollars?\b|\bco[ûu]ts?\b|\bprix\b/i;

function memoire(initial: Record<string, unknown> = {}) {
  const valeurs = new Map<string, unknown>(Object.entries(initial));
  const ecritures: [string, unknown][] = [];
  const journal: string[] = [];
  return {
    valeurs,
    ecritures,
    journal,
    ports: {
      lire: async <T,>(id: string, defaut: T) => (valeurs.has(id) ? (valeurs.get(id) as T) : defaut),
      ecrire: async (id: string, v: unknown) => {
        ecritures.push([id, v]);
        valeurs.set(id, v);
      },
      journaliser: async (_t: string, m: string) => {
        journal.push(m);
      },
    },
  };
}

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("interrupteurs", () => {
  it("clés absentes : tout éteint ; la chaîne \"true\" : éteint", async () => {
    const m = memoire();
    expect((await c.lireReglagesTutoriel(m.ports)).every((r) => !r.allume)).toBe(true);
    const faux = memoire(Object.fromEntries(c.REGLAGES_TUTORIEL.map((r) => [r.cle, "true"])));
    expect((await c.lireReglagesTutoriel(faux.ports)).every((r) => !r.allume)).toBe(true);
    const vrai = memoire({ [c.CLE_FORMULAIRE]: true });
    expect((await c.lireReglagesTutoriel(vrai.ports)).filter((r) => r.allume).map((r) => r.cle)).toEqual([c.CLE_FORMULAIRE]);
  });

  it("refuse une clé hors liste, le plafond, un non-booléen : rien n'est écrit", async () => {
    const m = memoire();
    for (const cle of ["autre.cle", "tutoriel.plafondClaudeUsd", 3, undefined]) expect((await c.basculerReglage(cle, true, m.ports)).ok).toBe(false);
    for (const v of ["true", 1, null, "oui"]) expect((await c.basculerReglage(c.CLE_FORMULAIRE, v, m.ports)).ok).toBe(false);
    expect(m.ecritures).toEqual([]);
    expect(m.journal).toEqual([]);
  });

  it("chaque bascule écrit la valeur reçue et une ligne de journal", async () => {
    const m = memoire();
    expect((await c.basculerReglage(c.CLE_FINITIONS, true, m.ports)).ok).toBe(true);
    expect((await c.basculerReglage(c.CLE_FINITIONS, false, m.ports)).ok).toBe(true);
    expect(m.ecritures).toEqual([
      [c.CLE_FINITIONS, true],
      [c.CLE_FINITIONS, false],
    ]);
    expect(m.journal).toEqual(["Tutoriel d'outil : Son et vignette finis allumé", "Tutoriel d'outil : Son et vignette finis éteint"]);
  });

  it("les clés sont égales aux constantes de leurs fichiers sources", () => {
    const claude = lire("src/services/tutoriel-claude.ts");
    expect(claude).toContain(`PARAM_CLAUDE_TUTORIEL = "tutoriel.claude"`);
    expect(claude).toContain(`PARAM_PLAFOND_TUTORIEL = "tutoriel.plafondClaudeUsd"`);
    expect(lire("src/services/tutoriel-branchements.ts")).toContain(`"${c.CLE_FINITIONS}"`);
    expect(lire("src/formats/tutoriel-outil/index.ts")).toContain(`ID_FORMAT_TUTORIEL_OUTIL = "${c.FORMAT_TUTORIEL}"`);
    expect(c.CLE_MENTION_TUTORIEL).toBe("mentionIA.tutoriel-outil.actif");
    expect(c.CLE_TEXTE_MENTION_TUTORIEL).toBe("mentionIA.tutoriel-outil.texte");
    expect(c.REGLAGES_TUTORIEL.map((r) => r.cle)).toEqual(["tutoriel.formulaire", "tutoriel.entreeZip", "tutoriel.entreePhrase", "tutoriel.claude", "tutoriel.devisAvantDepense", "tutoriel.finitions", "tutoriel.finCommune", "tutoriel.scenesGardees", "mentionIA.tutoriel-outil.actif"]);
  });
});

describe("mention IA du tutoriel", () => {
  it("allumée : rend le texte ; éteinte : null", async () => {
    const m = memoire();
    expect(await c.mentionAffichee(m.ports)).toBeNull();
    await c.basculerReglage(c.CLE_MENTION_TUTORIEL, true, m.ports);
    expect(await mentionIAAAfficher("tutoriel-outil", m.ports.lire)).toBe(TEXTE_MENTION_IA_PAR_DEFAUT);
    await c.enregistrerTexteMention("  Voix générée par IA ", m.ports);
    expect(await c.mentionAffichee(m.ports)).toBe("Voix générée par IA");
    await c.basculerReglage(c.CLE_MENTION_TUTORIEL, false, m.ports);
    expect(await c.mentionAffichee(m.ports)).toBeNull();
  });

  it("texte de 121 caractères et mots interdits : refus ; vide : texte par défaut", async () => {
    const m = memoire();
    expect((await c.enregistrerTexteMention("a".repeat(121), m.ports)).ok).toBe(false);
    expect((await c.enregistrerTexteMention("a".repeat(120), m.ports)).ok).toBe(true);
    for (const mot of ["garanti", "Certifié", "QUALIOPI", "intégrateur"]) expect((await c.enregistrerTexteMention(`Voix ${mot}`, m.ports)).ok).toBe(false);
    expect((await c.enregistrerTexteMention(42, m.ports)).ok).toBe(false);
    expect((await c.enregistrerTexteMention("   ", m.ports)).ok).toBe(true);
    expect(m.valeurs.get(c.CLE_TEXTE_MENTION_TUTORIEL)).toBe(TEXTE_MENTION_IA_PAR_DEFAUT);
    expect(await c.lireTexteMention(m.ports)).toBe(TEXTE_MENTION_IA_PAR_DEFAUT);
  });
});

const T0 = Date.UTC(2026, 10, 18, 9);
const jour = (n: number) => new Date(T0 - n * 24 * 3600 * 1000).toISOString();
const video = (id: string, formatId: string, statut: Video["statut"], age: number) => ({ id, titre: `Titre ${id}`, formatId, statut, modifieLe: jour(age), creeLe: jour(age) }) as unknown as Video;

describe("vidéos en cours", () => {
  it("seulement le format du tutoriel ; finies depuis plus de 7 jours et rangées absentes", async () => {
    const liste = [
      video("a", "tutoriel-outil", "en_fabrication", 30),
      video("b", "tutoriel-outil", "prete", 2),
      video("c", "tutoriel-outil", "prete", 9),
      video("d", "avocat", "en_fabrication", 0),
      video("e", "tutoriel-outil", "archivee", 0),
    ];
    const v = await c.videosEnCours({ videos: async () => liste, maintenantMs: T0 });
    expect(v.map((x) => x.id).sort()).toEqual(["a", "b"]);
    expect(v.find((x) => x.id === "a")?.suivi).toBe("/tutoriel-outil/suivi/a");
    expect(v.find((x) => x.id === "a")?.etat).toBe("En cours de fabrication.");
  });
});

const depense = (videoId: string, date: string, lignes: { unite: string; quantite: number; fournisseur: string }[]) => ({ id: `d-${videoId}-${date}`, videoId, date, lignes }) as unknown as DepenseEnregistree;

describe("consommation en quantités", () => {
  it("somme du mois en cours seulement, plafond sans montant, aucun mot de prix à l'écran", async () => {
    const mois = (d: string) => d.slice(0, 7);
    const deps: Record<string, DepenseEnregistree[]> = {
      a: [
        depense("a", "2026-11-03T10:00:00Z", [{ unite: "appel", quantite: 2, fournisseur: "claude" }, { unite: "caractere", quantite: 900, fournisseur: "heygen" }]),
        depense("a", "2026-10-30T10:00:00Z", [{ unite: "appel", quantite: 5, fournisseur: "claude" }]),
      ],
      b: [depense("b", "2026-11-10T10:00:00Z", [{ unite: "seconde", quantite: 50, fournisseur: "simulation" }])],
    };
    const videos = [
      { id: "a", titre: "Titre a", etat: "En cours de fabrication.", suivi: "/tutoriel-outil/suivi/a" },
      { id: "b", titre: "Titre b", etat: "Prête.", suivi: "/tutoriel-outil/suivi/b" },
    ];
    const m = memoire({ [c.CLE_FORMULAIRE]: true, "tutoriel.plafondClaudeUsd": 0.4 });
    const conso = await c.lireConsommation(videos, {
      depensesDe: async (id) => deps[id],
      nbDepenses: async (id) => deps[id].length,
      payee: (l) => l.fournisseur !== "simulation",
      moisDe: mois,
      moisCourant: "2026-11",
      devis: async (id) => (id === "a" ? "Claude : 9 appels au plus" : null),
      lire: m.ports.lire,
    });
    expect(conso.parVideo.map((p) => p.nbDepenses)).toEqual([2, 1]);
    expect(conso.parVideo[0]).toMatchObject({ appelsClaude: 7, caracteresVoix: 900, essai: false, devis: "Claude : 9 appels au plus" });
    expect(conso.parVideo[1]).toMatchObject({ rendus: 1, essai: true });
    expect(conso.moisEnCours).toMatchObject({ nbDepenses: 2, appelsClaude: 2, caracteresVoix: 900, rendus: 1 });
    expect(conso.plafond).toBe("réglé");
    const html = renderToStaticMarkup(PanneauConsole({ vue: { reglages: await c.lireReglagesTutoriel(m.ports), texteMention: TEXTE_MENTION_IA_PAR_DEFAUT, videos, consommation: conso }, basculer: () => {}, enregistrerTexte: () => {} }));
    const visible = html.replace(/<script>[\s\S]*?<\/script>/g, "").replace(/\sclass="[^"]*"/g, "");
    expect(visible).not.toMatch(INTERDIT);
    expect(visible).toContain("Consommation");
    expect(visible).toContain("Plafond par vidéo : réglé");
    expect(visible).toContain("Enregistrer le texte");
    expect(visible).toContain("/tutoriel-outil/scenes");
    const sans = await c.lireConsommation([], { depensesDe: async () => [], nbDepenses: async () => 0, payee: () => true, moisDe: mois, moisCourant: "2026-11", lire: memoire().ports.lire });
    expect(sans.plafond).toBe("par défaut");
  });

  it("le texte de la page et des actions ne contient aucun mot de prix", () => {
    const page = lire("src/app/(studio)/reglages/tutoriel-outil/page.tsx").replace(/^import .*$/gm, "");
    expect(page.match(/>[^<{]*</g)?.join(" ") ?? "").not.toMatch(INTERDIT);
    expect(page.match(/titre="[^"]*"|sousTitre="[^"]*"/g)?.join(" ") ?? "").not.toMatch(INTERDIT);
    for (const r of c.REGLAGES_TUTORIEL) expect(`${r.libelle} ${r.phraseEteint}`).not.toMatch(INTERDIT);
  });
});

describe("page Réglages", () => {
  it("contient exactement un lien vers /reglages/tutoriel-outil, dans une carte « tutoriel-outil »", () => {
    const page = lire("src/app/(studio)/reglages/page.tsx");
    expect(page.match(/href="\/reglages\/tutoriel-outil"/g)).toHaveLength(1);
    expect(page).toContain(`<CartePliante id="tutoriel-outil" icone="baguette" titre="Tutoriel d'outil" resume="Un interrupteur par réglage, tous éteints par défaut.">`);
    expect(page.indexOf(`id="carrousels"`)).toBeLessThan(page.indexOf(`id="tutoriel-outil"`));
  });
});

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("aucun allumage par le code", () => {
  const cles = c.REGLAGES_TUTORIEL.map((r) => r.cle);
  beforeEach(() => {});
  it("aucun fichier de src n'écrit ces clés, sauf le service de la console", () => {
    const coupables = fichiers(join(process.cwd(), "src"))
      .filter((f) => !f.endsWith("tutoriel-console.ts"))
      .filter((f) => {
        const s = readFileSync(f, "utf8");
        return /ecrireParametre\s*\(/.test(s) && (cles.some((k) => s.includes(`"${k}"`)) || /\bPARAM_CLAUDE_TUTORIEL\b|\bcleInterrupteurMentionIA\b/.test(s));
      });
    expect(coupables).toEqual([]);
  });
  it("le service n'écrit jamais `true` en dur ; l'action ne fait que relayer la valeur reçue", () => {
    expect(lire("src/services/tutoriel-console.ts")).not.toMatch(/ecrire\w*\([^)]*\btrue\b/);
    const actions = lire("src/app/(studio)/reglages/tutoriel-outil/actions.ts");
    expect(actions).not.toMatch(/basculerReglage\([^)]*\btrue\b/);
    expect(actions).toContain("exigerSession");
  });
});
