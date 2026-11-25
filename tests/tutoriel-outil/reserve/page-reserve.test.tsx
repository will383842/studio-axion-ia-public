/**
 * RES-5 : page de la réserve (rendu serveur seulement, comme formulaire.test.tsx : jsdom n'est pas installé).
 * Liste (7 démos, états, boutons), aucun « € », attestation décochée, actions refusées formulaire éteint, essai par un double.
 * Aucun appel réel, 0 €.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ ouverte: true }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session.ouverte) throw new Error("session exigée");
    return {};
  }),
}));
const magasin = new Map<string, unknown>();
vi.mock("@/services/_commun", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => (magasin.has(id) ? structuredClone(magasin.get(id)) : defaut),
    ecrireParametre: async (id: string, v: unknown) => void magasin.set(id, structuredClone(v)),
  };
});
// Double de RES-3 (tirerSuivantReserve) : l'action l'importe normalement.
const tirage = vi.hoisted(() => ({ appels: [] as unknown[], issue: { etat: "reserve_vide" } as unknown }));
vi.mock("@/services/tutoriel-reserve-tirage", () => ({
  tirerSuivantReserve: async (d: unknown) => {
    tirage.appels.push(d);
    return tirage.issue;
  },
}));

import type { ElementReserve, EtatElementReserve } from "@/domaine/tutoriel-reserve";
import { MAQUETTES_DEMO } from "@/services/tutoriel-reserve-maquettes";

const { ListeReserve } = await import("@/components/tutoriel-outil/reserve/ListeReserve");
const { AjoutReserve, LIBELLE_ATTESTATION } = await import("@/components/tutoriel-outil/reserve/AjoutReserve");
const actions = await import("@/app/(studio)/tutoriel-outil/reserve/actions");

const LE = "2026-11-21T08:00:00.000Z";
const visible = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const demo = (i: number, etat: EtatElementReserve = "en_reserve", extra: Partial<ElementReserve> = {}): ElementReserve => ({
  id: MAQUETTES_DEMO[i].id,
  titre: MAQUETTES_DEMO[i].titre,
  source: { type: "maquette-demo", dossier: MAQUETTES_DEMO[i].dossier },
  fin: "aucune",
  etat,
  ajouteLe: LE,
  ajoutePar: "amorcage",
  tentatives: 0,
  passages: [],
  version: 1,
  ...extra,
});
const rien = async () => ({ ok: true as const, donnees: {} });
const liste = (elements: ElementReserve[]) =>
  renderToStaticMarkup(createElement(ListeReserve, { elements, retirer: rien, remettre: rien, essayer: async () => ({ ok: true as const, donnees: { phrase: "x", pris: false } }) }));

describe("liste de la réserve", () => {
  it("les 7 démos, dans l'ordre, avec un rang, un type et un état en mots simples", () => {
    const html = liste(MAQUETTES_DEMO.map((_, i) => demo(i)));
    expect(html.match(/<li /g)).toHaveLength(7);
    const t = visible(html);
    let depuis = 0;
    for (const m of MAQUETTES_DEMO) {
      const i = t.indexOf(m.titre, depuis);
      expect(i, m.titre).toBeGreaterThanOrEqual(depuis);
      depuis = i;
    }
    expect(t).toContain("Démo · En réserve");
    expect(t).toContain("Préparer le suivant maintenant");
  });

  it("les boutons dépendent de l'état : Retirer (en réserve, à revoir), Remettre (à revoir, retiré), rien pour pris et fait", () => {
    const attendus: Record<EtatElementReserve, { retirer: boolean; remettre: boolean; libelle: string }> = {
      en_reserve: { retirer: true, remettre: false, libelle: "En réserve" },
      pris: { retirer: false, remettre: false, libelle: "En fabrication" },
      fait: { retirer: false, remettre: false, libelle: "Prêt : à valider" },
      a_revoir: { retirer: true, remettre: true, libelle: "À revoir" },
      retire: { retirer: false, remettre: true, libelle: "Retiré" },
    };
    for (const [etat, a] of Object.entries(attendus) as [EtatElementReserve, (typeof attendus)[EtatElementReserve]][]) {
      const t = visible(liste([demo(0, etat)]));
      expect(t.includes("Retirer"), `retirer ${etat}`).toBe(a.retirer);
      expect(t.includes("Remettre en réserve"), `remettre ${etat}`).toBe(a.remettre);
      expect(t).toContain(a.libelle);
    }
  });

  it("motif et lien vers le suivi quand une vidéo est notée ; réserve vide : une phrase", () => {
    const html = liste([demo(0, "fait", { motif: "Vidéo prête.", prise: { cle: "essai-abcdefgh", declencheur: "essai", le: LE, videoId: "v-42" } })]);
    expect(visible(html)).toContain("Vidéo prête.");
    expect(html).toContain('href="/tutoriel-outil/suivi/v-42"');
    expect(visible(liste([]))).toContain("La réserve est vide");
  });

  it("aucun montant : ni « € », ni « $ », ni « EUR »", () => {
    const tout = liste(MAQUETTES_DEMO.map((_, i) => demo(i, i % 2 ? "a_revoir" : "en_reserve", { motif: "Refusé par la garde." }))) + renderToStaticMarkup(createElement(AjoutReserve, { ajouterDossier: rien as never, ajouterIdee: rien as never }));
    expect(visible(tout)).not.toMatch(/€|\$|\bEUR\b|\beuros?\b/i);
  });
});

describe("ajout à la réserve", () => {
  const html = renderToStaticMarkup(createElement(AjoutReserve, { ajouterDossier: rien as never, ajouterIdee: rien as never }));
  it("la case d'attestation, au mot près, est décochée par défaut", () => {
    expect(LIBELLE_ATTESTATION).toBe("Je confirme qu'aucune donnée personnelle n'est visible sur les images du dossier");
    expect(visible(html)).toContain(LIBELLE_ATTESTATION);
    const bouton = /<button[^>]*role="checkbox"[^>]*>/.exec(html)?.[0] ?? "";
    expect(bouton).toMatch(/aria-checked="false"/);
    expect(bouton).not.toMatch(/data-state="checked"/);
  });
  it("deux onglets, script facultatif, fin, zone de dépôt multiple", () => {
    const t = visible(html);
    for (const x of ["Un dossier (.zip)", "Une idée (une phrase)", "Votre script (facultatif)", "Fin : aucune", "Fin : prendre rendez-vous"]) expect(t).toContain(x);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*multiple/);
  });
});

describe("actions : session, formulaire éteint, essai", () => {
  beforeEach(() => {
    session.ouverte = true;
    magasin.clear();
    tirage.appels.length = 0;
    tirage.issue = { etat: "reserve_vide" };
  });
  const allumer = () => magasin.set("tutoriel.formulaire", true);

  it("formulaire éteint : chaque action refuse et rien n'est écrit ni tiré", async () => {
    const r = [
      await actions.ajouterDossierAction({ fichierId: "f1", attestationImages: true }),
      await actions.ajouterIdeeAction({ phrase: "Une idée assez longue pour passer" }),
      await actions.retirerAction("demo-01-courriels"),
      await actions.remettreAction("demo-01-courriels"),
      await actions.essayerTirageAction(),
    ];
    for (const x of r) expect(x).toMatchObject({ ok: false, code: "TUTORIEL_FERME" });
    expect(tirage.appels).toHaveLength(0);
    expect([...magasin.keys()].filter((k) => k.startsWith("tutoriel.reserve."))).toEqual([]);
  });

  it("sans session : refus (rien n'est tiré)", async () => {
    allumer();
    session.ouverte = false;
    const r = await actions.essayerTirageAction();
    expect(r.ok).toBe(false);
    expect(tirage.appels).toHaveLength(0);
  });

  it("essai : déclencheur « essai », clé neuve à chaque clic, issue en une phrase", async () => {
    allumer();
    const a = await actions.essayerTirageAction();
    expect(a).toEqual({ ok: true, donnees: { phrase: "La réserve est vide : ajoutez un dossier ou une idée.", pris: false } });
    tirage.issue = { etat: "attente", raison: "plafond_mois", phrase: "Le plafond du mois est atteint." };
    const b = await actions.essayerTirageAction();
    expect(b).toEqual({ ok: true, donnees: { phrase: "Le plafond du mois est atteint.", pris: false } });
    tirage.issue = { etat: "pris", deja: false, elementId: "demo-01-courriels", titre: "Courriels", videoId: "v1" };
    const c = await actions.essayerTirageAction();
    expect(c).toMatchObject({ ok: true, donnees: { pris: true } });
    const cles = tirage.appels.map((x) => (x as { cle: string }).cle);
    expect(new Set(cles).size).toBe(3);
    for (const x of tirage.appels) expect(x).toMatchObject({ declencheur: "essai", cle: expect.stringMatching(/^essai-[A-Za-z0-9]{12}$/) });
    expect(JSON.stringify([a, b, c])).not.toMatch(/€|\$/);
  });

  it("plafond_video : raison dite en mots simples, sans montant", async () => {
    allumer();
    tirage.issue = { etat: "attente", raison: "plafond_video", phrase: "x" };
    const r = await actions.essayerTirageAction();
    expect(r).toEqual({ ok: true, donnees: { phrase: "La limite par vidéo est trop basse : voir les réglages.", pris: false } });
  });
});
