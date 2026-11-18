/**
 * RC-16 : jours proposés pour relancer un contenu. Interrupteur éteint par défaut ; calcul à l'ouverture, aucune écriture.
 * Aucun appel réel : réglage, dépôts et publications sont des doublures. Données inventées.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import type { Publication } from "@/domaine/types";
import type { LigneARelancer } from "@/services/contenus-a-relancer";

const etat = vi.hoisted(() => ({ reglage: undefined as unknown, leve: false, lectures: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/_commun", () => ({
  lireParametre: async (_id: string, defaut: unknown) => {
    etat.lectures++;
    if (etat.leve) throw new Error("lecture en panne");
    return etat.reglage ?? defaut;
  },
  depots: () => {
    throw new Error("dépôts réels interdits");
  },
}));

import { JoursProposes } from "@/components/calendrier/JoursProposes";
import {
  HEURE_PAR_DEFAUT,
  HORIZON_JOURS,
  PARAM_PROPOSITION_AUTO,
  PROPOSITIONS_AUTO_MAX,
  RESEAUX_EXCLUS,
  propositionAutoAllumee,
  suggererJours,
  type DepsAuto,
} from "@/services/republication-auto";

const lire = (f: string) => readFileSync(f, "utf8");
const MAINTENANT = new Date("2026-12-01T10:00:00.000Z"); // mardi
const ORIGINE = "2026-08-01T08:00:00.000Z";

const ligne = (id: string, extra: Partial<LigneARelancer> = {}): LigneARelancer => ({
  publicationId: id,
  reseau: "instagram",
  date: ORIGINE,
  debutTexte: `Ancien texte inventé ${id}`,
  raison: "Parmi les mieux classés de vos publications Instagram : 1er sur 6.",
  rangDejaAtteint: 0,
  media: "video",
  ...extra,
});
const pub = (id: string, reseau = "instagram"): Publication =>
  ({ id, reseau, statut: "publiee", via: "manuel", date: ORIGINE, texte: `Texte d'origine inventé ${id}`, videoId: `video-${id}`, creeLe: ORIGINE, modifieLe: ORIGINE }) as Publication;

function doublure(lignes: LigneARelancer[], opts: { creneaux?: { id: string; statut: string; heuresParReseau: Record<string, string> }[]; publications?: Publication[] } = {}) {
  const lectures: string[] = [];
  const publications = opts.publications ?? lignes.map((l) => pub(l.publicationId, l.reseau));
  const deps: DepsAuto = {
    candidats: async () => { lectures.push("candidats"); return lignes; },
    creneaux: async () => { lectures.push("creneaux"); return (opts.creneaux ?? []) as never; },
    publications: {
      obtenir: async (id) => { lectures.push(`pub:${id}`); return publications.find((p) => p.id === id) ?? null; },
      lister: async () => { lectures.push("pubs"); return publications; },
    },
  };
  return { deps, lectures };
}

beforeEach(() => {
  etat.reglage = undefined;
  etat.leve = false;
  etat.lectures = 0;
});

describe("RC-16 : interrupteur", () => {
  it("clé exacte, constantes proposées", () => {
    expect(PARAM_PROPOSITION_AUTO).toBe("republication.proposition_auto");
    expect(PROPOSITIONS_AUTO_MAX).toMatchObject({ statut: "hypothese", valeur: 3 });
    expect(HORIZON_JOURS).toMatchObject({ statut: "hypothese", valeur: 14 });
    expect(HEURE_PAR_DEFAUT).toMatchObject({ statut: "hypothese", valeur: "09:00" });
    expect([...RESEAUX_EXCLUS]).toEqual(["linkedin", "tiktok"]);
  });
  it.each([
    ["absent", undefined],
    ["false", false],
    ["texte « true »", "true"],
    ["1", 1],
    ["objet", { actif: true }],
    ["null", null],
  ])("éteint quand le réglage vaut : %s", async (_n, valeur) => {
    etat.reglage = valeur;
    expect(await propositionAutoAllumee()).toBe(false);
  });
  it("éteint quand la lecture lève", async () => {
    etat.leve = true;
    expect(await propositionAutoAllumee()).toBe(false);
  });
  it("seul true allume", async () => {
    etat.reglage = true;
    expect(await propositionAutoAllumee()).toBe(true);
  });
  it("éteint : la page ne calcule rien (doublure jamais lue)", async () => {
    const { deps, lectures } = doublure([ligne("a")]);
    const { proposerSiAllume } = await import("@/services/republication-auto");
    expect(await proposerSiAllume(deps, MAINTENANT)).toEqual([]);
    expect(lectures).toEqual([]);
  });
  it("allumé : la page obtient des suggestions", async () => {
    etat.reglage = true;
    const { deps } = doublure([ligne("a")]);
    const { proposerSiAllume } = await import("@/services/republication-auto");
    expect(await proposerSiAllume(deps, MAINTENANT)).toHaveLength(1);
  });
});

describe("RC-16 : suggestions", () => {
  it("au plus 3, un jour à venir, à 09:00, sans jour partagé sur un même réseau", async () => {
    const { deps } = doublure(["a", "b", "c", "d", "e"].map((i) => ligne(i)));
    const r = await suggererJours(deps, MAINTENANT);
    expect(r).toHaveLength(3);
    expect(r.map((s) => s.publicationId)).toEqual(["a", "b", "c"]);
    for (const s of r) {
      expect(s.heure).toBe("09:00");
      expect(s.jour > "2026-12-01").toBe(true);
      expect(s.jour <= "2026-12-15").toBe(true);
    }
    expect(new Set(r.map((s) => s.jour)).size).toBe(3);
  });
  it("jamais LinkedIn ni TikTok", async () => {
    const lignes = [ligne("l", { reseau: "linkedin" }), ligne("t", { reseau: "tiktok" }), ligne("i")];
    const { deps } = doublure(lignes);
    const r = await suggererJours(deps, MAINTENANT);
    expect(r.map((s) => s.publicationId)).toEqual(["i"]);
  });
  it("saute le week-end et le jour occupé", async () => {
    // Demain mercredi 2 est occupé ; jeudi 3 libre. Un autre test couvre le week-end ci-dessous.
    const occupe = [{ id: "autre", statut: "valide", heuresParReseau: { instagram: "2026-12-02T09:00:00.000Z" } }];
    const { deps } = doublure([ligne("a")], { creneaux: occupe });
    const [s] = await suggererJours(deps, MAINTENANT);
    expect(s.jour).toBe("2026-12-04");
    expect(["2026-12-02", "2026-12-03"]).not.toContain(s.jour);
  });
  it("ne propose jamais un samedi ni un dimanche", async () => {
    const vendredi = new Date("2026-12-04T10:00:00.000Z");
    const { deps } = doublure([ligne("a")]);
    const [s] = await suggererJours(deps, vendredi);
    expect(s.jour).toBe("2026-12-07"); // lundi
  });
  it("aucun jour libre dans l'horizon : pas de ligne pour ce candidat", async () => {
    const jours = Array.from({ length: 16 }, (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}T09:00:00.000Z`);
    const creneaux = jours.map((j, i) => ({ id: `x${i}`, statut: "valide", heuresParReseau: { instagram: j } }));
    const { deps } = doublure([ligne("a")], { creneaux });
    expect(await suggererJours(deps, MAINTENANT)).toEqual([]);
  });
  it("un contenu déjà relancé deux fois n'est pas proposé", async () => {
    const creneaux = [1, 2].map((n) => ({ id: `republication-a-${n}`, statut: "archive", heuresParReseau: {} }));
    const { deps } = doublure([ligne("a", { rangDejaAtteint: 2 })], { creneaux });
    expect(await suggererJours(deps, MAINTENANT)).toEqual([]);
  });
  it("publication d'origine introuvable ou non publiée : ignorée", async () => {
    const { deps } = doublure([ligne("a"), ligne("b")], { publications: [{ ...pub("b"), statut: "brouillon" } as Publication] });
    expect(await suggererJours(deps, MAINTENANT)).toEqual([]);
  });
  it("doublure dont toute écriture lève : aucune écriture tentée", async () => {
    const piege = new Proxy({}, { get: () => () => { throw new Error("ÉCRITURE INTERDITE"); } });
    const { deps } = doublure([ligne("a")]);
    const r = await suggererJours({ ...deps, ecriture: piege } as DepsAuto, MAINTENANT);
    expect(r).toHaveLength(1);
  });
  it("instant illisible : aucune suggestion", async () => {
    const { deps } = doublure([ligne("a")]);
    expect(await suggererJours(deps, new Date("n'importe quoi"))).toEqual([]);
  });
});

describe("RC-16 : bloc affiché", () => {
  const sug = [{ publicationId: "a", reseau: "instagram" as const, debutTexte: "Ancien texte inventé a", raison: "Parmi les mieux classés.", jour: "2026-12-03", heure: "09:00" }];
  const rendre = (comptes: Record<string, string | undefined> = { instagram: "compte-a" }) => renderToStaticMarkup(createElement(JoursProposes, { suggestions: sug, comptes } as never));

  it("texte du bloc au vouvoiement, jour pré-rempli, texte vide, rien d'envoyé", () => {
    const h = rendre();
    expect(h).toContain("Jours proposés par le Studio. Rien n&#x27;est ajouté tant que vous n&#x27;avez pas écrit et enregistré la nouvelle version.");
    expect(h).toContain("Préparer cette nouvelle version");
    expect(h).toMatch(/name="jour"[^>]*value="2026-12-03"|value="2026-12-03"[^>]*name="jour"/);
    expect(h).toMatch(/<textarea[^>]*><\/textarea>/);
    expect(h).toContain('name="compteCible"');
    expect(h).not.toMatch(/Valider|Envoyer|Publier/);
  });
  it("sans compte pour le réseau : pas de formulaire", () => {
    const h = rendre({});
    expect(h).not.toContain("<form");
  });
  it("aucun prix, aucun terme interdit, aucun bouton orange, lisible à 375 px", () => {
    const h = rendre();
    expect(h).not.toMatch(/€|\$|\bEUR\b|\bUSD\b/);
    expect(interditsTousEcrivains(h.replace(/<[^>]+>/g, " "))).toEqual([]);
    expect(h).not.toMatch(/orange/);
    expect(h).toContain("flex-wrap");
    expect(h).not.toMatch(/dark:|bg-black|bg-slate-9/);
  });
});

describe("RC-16 : statique", () => {
  const SERVICE = lire("src/services/republication-auto.ts");
  const BLOC = lire("src/components/calendrier/JoursProposes.tsx");
  const PAGE = lire("src/app/(studio)/calendrier/a-relancer/page.tsx");
  const imports = (s: string) => (s.match(/^\s*(?:import|export)[^;]*?from\s+["'][^"']+["']/gm) ?? []).join("\n");

  it("aucun import d'envoi, de fournisseur, de validation, de création de créneau ni de changement de statut", () => {
    for (const s of [SERVICE, BLOC]) {
      expect(imports(s)).not.toMatch(/zernio|fournisseurs|valider-entree|envoi|branchement|reprise-envois|claude/i);
      expect(s).not.toMatch(/creerCreneau|changerStatut|ecrireParametre|\.enregistrer\(|\.modifier\(/);
    }
  });
  it("aucun « .requete », aucune tâche de fond", () => {
    for (const s of [SERVICE, BLOC]) {
      expect(s).not.toContain(".requete");
      expect(s).not.toMatch(/setInterval|setTimeout|cron|queueMicrotask/i);
    }
  });
  it("un seul moteur : le service réutilise le contrôle de placement et le rang", () => {
    expect(SERVICE).toMatch(/verifierPlacement/);
    expect(SERVICE).toMatch(/rangSuivant/);
    expect(SERVICE).toContain("(await lireParametre<boolean>(PARAM_PROPOSITION_AUTO, false)) === true");
  });
  it("la page n'affiche le bloc que par le garde du service", () => {
    expect(PAGE).toMatch(/JoursProposes/);
    expect(PAGE).toMatch(/proposerSiAllume|propositionAutoAllumee/);
  });
  it("aucune ligne ajoutée dans la boucle", () => {
    expect(lire("src/services/boucle.ts")).not.toMatch(/republication-auto|proposition_auto/);
  });
});
