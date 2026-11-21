/**
 * T-EXT-36 · Panneau du tutoriel dans la console. Dépôt mémoire, aucun appel réel, 0 €. Tout éteint par défaut.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DepenseEnregistree, Video } from "@/domaine/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/cout-video", () => ({ coutsDeLaVideo: vi.fn(async () => ({ nbDepenses: 1 })) }));
vi.mock("@/donnees/memoire", () => ({
  depots: () => ({
    parametres: { obtenir: async () => undefined },
    videos: { obtenir: async (id: string) => (id === "v1" ? { id: "v1", titre: "Titre v1", formatId: "tutoriel-outil", statut: "en_fabrication" } : undefined), lister: async () => [{ id: "v1", titre: "Titre v1", formatId: "tutoriel-outil", statut: "en_fabrication", modifieLe: new Date().toISOString(), creeLe: new Date().toISOString() }] },
    travaux: { lister: async () => [] },
    depenses: { lister: async () => [{ id: "d1", videoId: "v1", date: new Date().toISOString(), lignes: [{ unite: "appel", quantite: 2, fournisseur: "anthropic" }] }] },
  }),
}));

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

describe("clés partagées avec les modules créateurs", () => {
  it("la console utilise exactement les clés de tutoriel-depot et zip-tutoriel", async () => {
    const { PARAM_FORMULAIRE } = await import("@/services/tutoriel-depot");
    const { PARAM_ENTREE_ZIP } = await import("@/services/zip-tutoriel");
    expect(c.CLE_FORMULAIRE).toBe(PARAM_FORMULAIRE);
    expect(c.CLE_ENTREE_ZIP).toBe(PARAM_ENTREE_ZIP);
    expect(c.CLE_FORMULAIRE).toBe("tutoriel.formulaire");
    expect(c.CLE_ENTREE_ZIP).toBe("tutoriel.entreeZip");
  });
});

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

  it("la clé des scènes gardées et le lien de suivi viennent de leurs fichiers (imports, pas de recopie)", async () => {
    const { PARAM_SCENES_TUTORIEL } = await import("@/services/scenes-tutoriel");
    const { lienSuivi } = await import("@/services/tutoriel-suivi");
    expect(c.CLE_SCENES_GARDEES).toBe(PARAM_SCENES_TUTORIEL);
    const src = lire("src/services/tutoriel-console.ts");
    expect(src).not.toContain(`"tutoriel.scenesGardees"`);
    expect(src).not.toContain("/tutoriel-outil/suivi/");
    const v = await c.videosEnCours({ videos: async () => [video("a", "tutoriel-outil", "en_fabrication", 0)], maintenantMs: T0 });
    expect(v[0]?.suivi).toBe(lienSuivi("a"));
  });

  it("la clé de l'entrée par une phrase vient de la maquette (import, pas de recopie)", async () => {
    const { PARAM_ENTREE_PHRASE } = await import("@/moteurs/montage-tutoriel-outil/maquette-creee");
    expect(c.CLE_ENTREE_PHRASE).toBe(PARAM_ENTREE_PHRASE);
    expect(PARAM_ENTREE_PHRASE).toBe("tutoriel.entreePhrase");
    expect(lire("src/services/tutoriel-console.ts")).not.toContain(`"tutoriel.entreePhrase"`);
  });

  it("phrase d'état tirée du statut du travail (port etat de T-EXT-34)", async () => {
    expect(c.phraseDuTravail("en_cours")).toBe("En cours de fabrication.");
    expect(c.phraseDuTravail("termine")).toBe("Prête.");
    expect(c.phraseDuTravail("echec")).toBe("Bloquée : regardez la cloche.");
    const v = await c.videosEnCours({ videos: async () => [video("a", "tutoriel-outil", "en_fabrication", 0)], etat: async () => c.phraseDuTravail("en_file"), maintenantMs: T0 });
    expect(v[0]?.etat).toBe("En attente de fabrication.");
  });

  it("les clés sont égales aux constantes de leurs fichiers sources", () => {
    const claude = lire("src/services/tutoriel-claude.ts");
    expect(claude).toContain(`PARAM_CLAUDE_TUTORIEL = "tutoriel.claude"`);
    expect(claude).toContain(`PARAM_PLAFOND_TUTORIEL = "tutoriel.plafondClaudeUsd"`);
    expect(lire("src/services/tutoriel-branchements.ts")).toContain(`"${c.CLE_FINITIONS}"`);
    expect(lire("src/formats/tutoriel-outil/index.ts")).toContain(`ID_FORMAT_TUTORIEL_OUTIL = "${c.FORMAT_TUTORIEL}"`);
    expect(c.CLE_MENTION_TUTORIEL).toBe("mentionIA.tutoriel-outil.actif");
    expect(c.CLE_TEXTE_MENTION_TUTORIEL).toBe("mentionIA.tutoriel-outil.texte");
    expect(c.REGLAGES_TUTORIEL.map((r) => r.cle)).toEqual(["tutoriel.formulaire", "tutoriel.entreeZip", "tutoriel.entreePhrase", "tutoriel.claude", "tutoriel.devisAvantDepense", "tutoriel.finitions", "tutoriel.finCommune", "tutoriel.scenesGardees", "tutoriel.equipe", "tutoriel.regardeur", "tutoriel.pieceCreeeClaude", "tutoriel.retouchePartielle", "tutoriel.performance", "tutoriel.suiviCloche", "retoucheChat.tutorielOutil", "mentionIA.tutoriel-outil.actif"]);
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
    // Contournements : accent décomposé, caractère invisible, forme de compatibilité.
    for (const t of ["Voix inte\u0301grateur", "Voix garan\u200Bti", "Voix garan\u00ADti", "Voix ｇａｒａｎｔｉ", "Voix certifie\u0301"]) {
      expect((await c.enregistrerTexteMention(t, m.ports)).ok, t).toBe(false);
    }
    expect((await c.enregistrerTexteMention("Voix cre\u0301ée\u200B par IA", m.ports)).ok).toBe(true);
    expect(m.valeurs.get(c.CLE_TEXTE_MENTION_TUTORIEL)).toBe("Voix créée par IA");
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

describe("devis avant dépense (T-EXT-42)", () => {
  it("CLE_DEVIS_AVANT_DEPENSE est la clé écrite en toutes lettres dans le branchement du moteur", () => {
    expect(lire("src/services/tutoriel-branchements.ts")).toContain(`lireParametre<boolean>("${c.CLE_DEVIS_AVANT_DEPENSE}", false)`);
  });
  it("la phrase affichée vient de texteDevis : des quantités, aucun mot de prix ; sans devis, rien", async () => {
    const { etablirDevis, texteDevis } = await import("@/moteurs/montage-tutoriel-outil/devis-tutoriel");
    const d = etablirDevis({ roles: [{ id: "plan", essaisMax: 2 }], caracteresScript: 900, motsScript: 150, voixDejaPayee: false, ratios: ["4:5", "9:16"], essai: false });
    const phrase = c.phraseDevis(d);
    expect(phrase).toBe(texteDevis(d).join(" · "));
    expect(phrase).toContain("Claude : 2 appels au plus");
    expect(phrase).not.toMatch(INTERDIT);
    expect(c.phraseDevis(null)).toBeNull();
    expect(c.phraseDevis(undefined)).toBeNull();
  });
  it("la sous-page branche le port devis sur phraseDevis (null tant que le devis n'est pas stocké)", () => {
    const src = lire("src/app/(studio)/reglages/tutoriel-outil/page.tsx");
    expect(src).toMatch(/devis:\s*async \(\) => phraseDevis\(null\)/);
  });
});

const depense = (videoId: string, date: string, lignes: { unite: string; quantite: number; fournisseur: string }[]) => ({ id: `d-${videoId}-${date}`, videoId, date, lignes }) as unknown as DepenseEnregistree;

describe("consommation en quantités", () => {
  it("somme du mois en cours seulement, plafond sans montant, aucun mot de prix à l'écran", async () => {
    const mois = (d: string) => d.slice(0, 7);
    const deps: Record<string, DepenseEnregistree[]> = {
      a: [
        depense("a", "2026-11-03T10:00:00Z", [{ unite: "appel", quantite: 2, fournisseur: "anthropic" }, { unite: "caractere", quantite: 900, fournisseur: "heygen" }]),
        depense("a", "2026-10-30T10:00:00Z", [{ unite: "appel", quantite: 5, fournisseur: "anthropic" }]),
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

  it("une dépense sans lignes est payée (comme montantPaye), pas « essai »", () => {
    const q = c.quantitesDesDepenses([{ id: "x", videoId: "a", date: "2026-11-03T10:00:00Z" } as unknown as DepenseEnregistree], () => false);
    expect(q.essai).toBe(false);
    expect(c.quantitesDesDepenses([depense("a", "2026-11-03T10:00:00Z", [{ unite: "seconde", quantite: 5, fournisseur: "simulation" }])], (l) => l.fournisseur !== "simulation").essai).toBe(true);
  });

  it("plafond réglé à 0 : « réglé » ; valeur absente, négative ou non finie : « par défaut »", async () => {
    const vide = { depensesDe: async () => [], nbDepenses: async () => 0, payee: () => true, moisDe: (d: string) => d.slice(0, 7), moisCourant: "2026-11" };
    for (const [v, attendu] of [[0, "réglé"], [0.4, "réglé"], [-1, "par défaut"], [Number.NaN, "par défaut"], ["0", "par défaut"]] as const) {
      const m = memoire({ "tutoriel.plafondClaudeUsd": v });
      expect((await c.lireConsommation([], { ...vide, lire: m.ports.lire })).plafond, String(v)).toBe(attendu);
    }
  });

  it("les lignes « claude » comptent comme « anthropic » (même règle que idFournisseur)", () => {
    const q = c.quantitesDesDepenses([depense("a", "2026-11-03T10:00:00Z", [{ unite: "appel", quantite: 3, fournisseur: "claude" }, { unite: "appel", quantite: 1, fournisseur: " Claude " }, { unite: "appel", quantite: 2, fournisseur: "anthropic" }])], () => true);
    expect(q.appelsClaude).toBe(6);
  });
  it("les lignes HeyGen ne comptent ni comme appels Claude ni comme rendus", () => {
    const q = c.quantitesDesDepenses(
      [depense("a", "2026-11-03T10:00:00Z", [{ unite: "appel", quantite: 4, fournisseur: "heygen" }, { unite: "seconde", quantite: 30, fournisseur: "heygen" }, { unite: "appel", quantite: 1, fournisseur: "anthropic" }, { unite: "minute", quantite: 1, fournisseur: "remotion-lambda" }])],
      () => true,
    );
    expect(q).toMatchObject({ appelsClaude: 1, rendus: 1 });
  });

  it("le rendu serveur de la sous-page ne contient aucun mot de prix", async () => {
    const { default: Page } = await import("@/app/(studio)/reglages/tutoriel-outil/page");
    const { exigerSession } = await import("@/services/auth");
    const html = renderToStaticMarkup(await Page());
    expect(exigerSession).toHaveBeenCalled();
    const visible = html.replace(/<script>[\s\S]*?<\/script>/g, "").replace(/\sclass="[^"]*"/g, "");
    expect(visible).toContain("Titre v1");
    expect(visible).toContain("Consommation");
    expect(visible).not.toMatch(INTERDIT);
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

/** Vrai si la clé en clair apparaît entre l'un des trois délimiteurs : guillemet double, guillemet simple ou accent grave. */
function citeCle(src: string, cle: string): boolean {
  return ['"', "'", "`"].some((q) => src.includes(q + cle + q));
}

describe("clé de la fin commune (26a)", () => {
  it("toute lecture de « tutoriel.finCommune » dans src (hors console) utilise exactement CLE_FIN_COMMUNE", () => {
    const lecteurs = fichiers(join(process.cwd(), "src")).filter((f) => !f.endsWith("tutoriel-console.ts") && /lireParametre\s*(?:<[^>]*>)?\s*\(\s*["'`]tutoriel\.finCommun/.test(readFileSync(f, "utf8")));
    expect(lecteurs.some((f) => f.endsWith("tutoriel-branchements.ts"))).toBe(true);
    const src = lire("src/services/tutoriel-branchements.ts");
    const cles = [...src.matchAll(/lireParametre\s*(?:<[^>]*>)?\s*\(\s*["'`](tutoriel\.finCommun[^"'`]*)["'`]/g)].map((m) => m[1]);
    expect(cles).toEqual([c.CLE_FIN_COMMUNE]);
    for (const f of lecteurs) {
      const lues = [...readFileSync(f, "utf8").matchAll(/lireParametre\s*(?:<[^>]*>)?\s*\(\s*["'`](tutoriel\.finCommun[^"'`]*)["'`]/g)].map((m) => m[1]);
      expect(lues.every((k) => k === c.CLE_FIN_COMMUNE)).toBe(true);
    }
  });
});

describe("clés ajoutées par AUD-3", () => {
  const payants = ["tutoriel.equipe", "tutoriel.regardeur", "tutoriel.pieceCreeeClaude"];
  const nouvelles = [...payants, "tutoriel.retouchePartielle", "tutoriel.performance", "tutoriel.suiviCloche", "retoucheChat.tutorielOutil"];
  it("les sept clés sont dans la console, éteintes par défaut", async () => {
    const m = memoire();
    const lignes = await c.lireReglagesTutoriel(m.ports);
    for (const k of nouvelles) expect(lignes.find((l) => l.cle === k)?.allume).toBe(false);
    expect(lignes.some((l) => l.allume)).toBe(false);
  });
  it("les réglages payants annoncent la dépense, pas les autres", () => {
    for (const r of c.REGLAGES_TUTORIEL.filter((x) => nouvelles.includes(x.cle))) {
      expect(/appels Claude payants, sous le plafond par vidéo/.test(r.phraseEteint)).toBe(payants.includes(r.cle));
    }
  });
  it("le libellé périmé « (plus tard) » a disparu", () => {
    for (const r of c.REGLAGES_TUTORIEL) expect(r.libelle).not.toMatch(/plus tard/i);
  });
  it("chaque clé de la console est lue quelque part dans src/ (hors console)", () => {
    const sources = fichiers(join(process.cwd(), "src")).filter((f) => !f.endsWith("tutoriel-console.ts")).map((f) => readFileSync(f, "utf8"));
    const sansLecteur = c.REGLAGES_TUTORIEL.map((r) => r.cle).filter((k) => !sources.some((s) => citeCle(s, k)));
    // Les clés de mention IA sont construites par cleInterrupteurMentionIA (pas écrites en clair) : lues par mentionIAAAfficher.
    expect(sansLecteur.filter((k) => !k.startsWith("mentionIA."))).toEqual([]);
  });
  it("les clés de la console ont exactement l'orthographe du code qui les lit", () => {
    expect(lire("src/services/tutoriel-equipe.ts")).toContain(`PARAM_EQUIPE_TUTORIEL = "${c.CLE_EQUIPE}"`);
    expect(lire("src/services/tutoriel-claude.ts")).toContain(`PARAM_REGARD_TUTORIEL = "${c.CLE_REGARDEUR}"`);
    expect(lire("src/moteurs/montage-tutoriel-outil/maquette-creee.ts")).toContain(`PARAM_PIECE_CLAUDE = "${c.CLE_PIECE_CREEE_CLAUDE}"`);
    const br = lire("src/services/tutoriel-branchements.ts");
    expect(br).toContain(`PARAM_RETOUCHE_PARTIELLE_TUTORIEL = "${c.CLE_RETOUCHE_PARTIELLE}"`);
    expect(br).toContain(`PARAM_PERFORMANCE_TUTORIEL = "${c.CLE_PERFORMANCE}"`);
    expect(lire("src/services/tutoriel-suivi.ts")).toContain(`REGLAGE_SUIVI_CLOCHE = "${c.CLE_SUIVI_CLOCHE}"`);
    expect(lire("src/services/retouche-chat/generateurs.ts")).toContain(`"tutoriel-outil": "${c.CLE_RETOUCHE_CHAT_TUTORIEL}"`);
  });
});

describe("aucun allumage par le code", () => {
  const cles = c.REGLAGES_TUTORIEL.map((r) => r.cle);
  // Noms des constantes qui portent ces clés (CLE_*, PARAM_*), détectés dans les exports du service et de tutoriel-claude.
  const constantes = Object.entries(c).filter(([, v]) => typeof v === "string" && cles.includes(v)).map(([n]) => n);
  const noms = [...new Set([...constantes, "PARAM_CLAUDE_TUTORIEL", "PARAM_FORMULAIRE", "PARAM_ENTREE_ZIP", "PARAM_ENTREE_PHRASE", "PARAM_SCENES_TUTORIEL", "cleInterrupteurMentionIA", "cleTexteMentionIA", "CLE_FIN_COMMUNE", "REGLAGES_TUTORIEL"])];
  // Un nom compte seulement s'il vient d'ailleurs : une constante locale homonyme (ex. un `CLE_FORMULAIRE` d'une autre action) n'est pas la clé.
  const nomsConstantes = {
    test: (src: string) => noms.some((n) => new RegExp(`\\b${n}\\b`).test(src) && !new RegExp(`\\b(?:const|let|var|function)\\s+${n}\\b`).test(src)),
  };
  const PREFIXE_CONSTRUIT = /["'`](?:tutoriel|mentionIA)\.(?:["'`]\s*\+|\$\{)|["'`]tutoriel\.?["'`]\s*\+/;
  const ECRITURE = /\becrireParametre\b|parametres\s*\.\s*enregistrer\s*\(|\benregistrerParametre\s*\(/;
  it("la détection voit les constantes CLE_* / PARAM_* et parametres.enregistrer", () => {
    expect(constantes).toEqual(expect.arrayContaining(["CLE_FORMULAIRE", "CLE_FINITIONS", "CLE_MENTION_TUTORIEL"]));
    expect(ECRITURE.test(`await d.parametres.enregistrer({ id: CLE_FINITIONS })`)).toBe(true);
    expect(nomsConstantes.test(`ecrireParametre(PARAM_CLAUDE_TUTORIEL, true)`)).toBe(true);
    expect(nomsConstantes.test(`ecrireParametre(CLE_FORMULAIRE, true)`)).toBe(true);
    expect(nomsConstantes.test(`ecrireParametre(PARAM_ENTREE_ZIP, true)`)).toBe(true);
    // Import aliasé, clé en guillemets simples ou en gabarit : vus aussi.
    expect(ECRITURE.test(`import { ecrireParametre as ecrire } from "@/services/_commun"; ecrire(PARAM_ENTREE_ZIP, true)`)).toBe(true);
    expect(cles.some((k) => citeCle(`ecrireParametre('tutoriel.claude', true)`, k))).toBe(true);
    expect(cles.some((k) => citeCle("ecrireParametre(`tutoriel.claude`, true)", k))).toBe(true);
    expect(cles.some((k) => citeCle(`ecrireParametre("tutoriel.claude", true)`, k))).toBe(true);
    expect(cles.some((k) => citeCle(`ecrireParametre("tutoriel.claudeX", true)`, k))).toBe(false);
    expect(nomsConstantes.test(`ecrireParametre(r.cle, true); REGLAGES_TUTORIEL.map((r) => ecrireParametre(r.cle, true))`)).toBe(true);
    expect(PREFIXE_CONSTRUIT.test(`ecrireParametre("tutoriel." + "claude", true)`)).toBe(true);
    expect(PREFIXE_CONSTRUIT.test("const n = 1; ecrireParametre(`tutoriel.${n}`, true)")).toBe(true);
    expect(PREFIXE_CONSTRUIT.test(`ecrireParametre("tutoriel.claude", true)`)).toBe(false);
    // Homonyme local (autre sens) : pas une écriture de la clé du tutoriel.
    expect(nomsConstantes.test(`const CLE_FORMULAIRE = /^[a-z]+$/; ecrireParametre(x, true)`)).toBe(false);
  });
  it("aucun fichier de src n'écrit ces clés, sauf le service de la console", () => {
    const coupables = fichiers(join(process.cwd(), "src"))
      .filter((f) => !f.endsWith("tutoriel-console.ts") && !f.endsWith("scenes-tutoriel.ts"))
      .filter((f) => {
        const s = readFileSync(f, "utf8");
        return ECRITURE.test(s) && (cles.some((k) => citeCle(s, k)) || nomsConstantes.test(s) || PREFIXE_CONSTRUIT.test(s));
      });
    expect(coupables).toEqual([]);
  });
  it("les valeurs de départ (dépôt mémoire, migrations, tout src/donnees) ne contiennent aucune clé du panneau, sous aucune forme de guillemets", () => {
    const racine = join(process.cwd(), "src");
    const departs = [
      ...fichiers(join(racine, "donnees")),
      join(racine, "services", "migrations.ts"),
      ...fichiers(join(racine, "services", "migrations")),
    ];
    expect(departs.some((f) => f.endsWith(join("memoire", "demo.ts")))).toBe(true);
    const coupables = departs.filter((f) => {
      const s = readFileSync(f, "utf8");
      return cles.some((k) => citeCle(s, k)) || nomsConstantes.test(s);
    });
    expect(coupables).toEqual([]);
    // La détection voit les trois formes de guillemets dans un amorçage `p(...)`.
    for (const q of ['"', "'", "`"]) expect(cles.some((k) => citeCle(`p(${q}tutoriel.claude${q}, true)`, k))).toBe(true);
  });
  it("basculerReglage et les actions ne sont appelés que depuis le chemin d'un clic (actions.ts puis page.tsx)", () => {
    const racine = join(process.cwd(), "src");
    const ACTIONS = join("reglages", "tutoriel-outil", "actions.ts");
    const PAGE = join("reglages", "tutoriel-outil", "page.tsx");
    const tous = fichiers(racine).filter((f) => !f.endsWith("tutoriel-console.ts"));
    const citent = (noms: string[]) => tous.filter((f) => { const s = readFileSync(f, "utf8"); return noms.some((n) => new RegExp(`\\b${n}\\b`).test(s)); });
    expect(citent(["basculerReglage", "enregistrerTexteMention"]).every((f) => f.endsWith(ACTIONS))).toBe(true);
    expect(citent(["basculerReglageTutoriel", "basculerReglageFormulaire", "enregistrerTexteMentionTutoriel", "enregistrerTexteFormulaire"]).every((f) => f.endsWith(ACTIONS) || f.endsWith(PAGE))).toBe(true);
  });
  it("scenes-tutoriel.ts (qui déclare la clé des scènes gardées) n'écrit que son index, jamais l'interrupteur", () => {
    const src = lire("src/services/scenes-tutoriel.ts");
    const ecritures = [...src.matchAll(/ecrireParametre\s*\(\s*([^,)]+)/g)].map((m) => m[1]!.trim());
    expect(ecritures.length).toBeGreaterThan(0);
    expect(ecritures.every((x) => x === "PARAM_INDEX_SCENES")).toBe(true);
    expect(/parametres\s*\.\s*enregistrer\s*\(|\benregistrerParametre\s*\(/.test(src)).toBe(false);
  });
  it("le service n'écrit jamais `true` en dur ; l'action ne fait que relayer la valeur reçue", () => {
    expect(lire("src/services/tutoriel-console.ts")).not.toMatch(/ecrire\w*\([^)]*\btrue\b/);
    const actions = lire("src/app/(studio)/reglages/tutoriel-outil/actions.ts");
    expect(actions).not.toMatch(/basculerReglage\([^)]*\btrue\b/);
    expect(actions).toContain("exigerSession");
  });
});

describe("T-EXT-36 · liens du panneau vers des pages qui existent", () => {
  it("« Scènes gardées » mène à la route de T-EXT-35 (page présente), et la page de suivi existe aussi", () => {
    const panneau = lire("src/components/tutoriel-outil/PanneauConsole.tsx");
    expect(panneau).toContain('href="/tutoriel-outil/scenes"');
    expect(statSync(join(process.cwd(), "src/app/(studio)/tutoriel-outil/scenes/page.tsx")).isFile()).toBe(true);
    expect(statSync(join(process.cwd(), "src/app/(studio)/tutoriel-outil/suivi/[videoId]/page.tsx")).isFile()).toBe(true);
  });
});
