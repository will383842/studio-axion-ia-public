/**
 * L4-13 · Écran de relecture du texte d'un visuel (D4-20). Aucun appel réel : dépôt, journal et session sont des doublures.
 * Trop long = erreur sans enregistrement ; « Réécrire » en simulation, journalisé ; aucun libellé interdit.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenirReseau } from "@/reseaux";
import { interditsPost } from "@/domaine/qualite-script/regles/interdits";

const params = new Map<string, unknown>();
const journal: { type: string; message: string; entite?: { type: string; id: string } }[] = [];
let visuel: Record<string, unknown> | undefined;

class Redirection extends Error {
  constructor(public readonly adresse: string) {
    super("redirect");
  }
}

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (a: string) => { throw new Redirection(a); } }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/services/_commun", () => ({
  journaliser: vi.fn(async (type: string, message: string, entite?: { type: string; id: string }) => { journal.push({ type, message, entite }); }),
}));
vi.mock("@/visuels/services/production", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/visuels/services/production")>();
  return {
    ...reel,
    dependancesCarrousels: () => ({
      depot: { obtenir: async (id: string) => (visuel && visuel.id === id ? visuel : undefined) },
      verrou: async <T,>(f: () => Promise<T>) => f(),
      maintenant: () => "2026-12-10T10:00:00.000Z",
      lireParametre: async <T,>(id: string, defaut: T) => (params.has(id) ? (params.get(id) as T) : defaut),
      ecrireParametre: async (id: string, v: unknown) => { params.set(id, v); },
    }),
  };
});

const ID = "vis_abc123";
const formulaire = (champs: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
};
async function adresseDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirection) return e.adresse;
    throw e;
  }
  throw new Error("aucune redirection");
}

beforeEach(() => {
  params.clear();
  journal.length = 0;
  visuel = {
    id: ID,
    titre: "Trois gestes pour mieux ranger ses factures",
    statut: "valide",
    spec: { pages: [{ type: "couverture", titre: "Trois gestes pour mieux ranger ses factures", sousTitre: "Un classement simple" }] },
  };
});

describe("compteur", () => {
  it("compte les caractères et signale le dépassement du réseau", async () => {
    const { compterLegende, verifierLegende } = await import("@/components/visuels-texte/compteur");
    const max = obtenirReseau("instagram").legende.longueurMax;
    expect(compterLegende("Bonjour", "instagram")).toMatchObject({ caracteres: 7, max, restant: max - 7, depasse: false });
    expect(compterLegende("x".repeat(max + 1), "instagram")).toMatchObject({ depasse: true, restant: -1 });
    expect(verifierLegende("x".repeat(max + 1), "instagram")).toMatchObject({ ok: false, code: "TROP_LONG" });
    expect(verifierLegende("   ", "instagram")).toMatchObject({ ok: false, code: "VIDE" });
    expect(verifierLegende("Un texte correct", "instagram")).toEqual({ ok: true });
  });

  it("la phrase du compteur ne contient aucun montant", async () => {
    const { compterLegende, phraseCompteur } = await import("@/components/visuels-texte/compteur");
    expect(phraseCompteur(compterLegende("Bonjour", "linkedin"))).toMatch(/7 sur 3[\s  ]?000 caractères/);
  });
});

describe("FicheLegende", () => {
  it("affiche le texte, le compteur et les deux boutons", async () => {
    const { FicheLegende } = await import("@/components/visuels-texte/FicheLegende");
    const html = renderToStaticMarkup(<FicheLegende id={ID} reseau="linkedin" texte="Mon texte" enregistrer={async () => {}} reecrire={async () => {}} />);
    expect(html).toContain("Mon texte");
    expect(html).toContain("Enregistrer le texte");
    expect(html).toContain("Réécrire");
    expect(html).toMatch(/9 sur 3[\s  ]?000 caractères/);
    expect(html).not.toContain("role=\"alert\"");
  });

  it("texte trop long : message d'erreur visible", async () => {
    const { FicheLegende } = await import("@/components/visuels-texte/FicheLegende");
    const max = obtenirReseau("linkedin").legende.longueurMax;
    const html = renderToStaticMarkup(<FicheLegende id={ID} reseau="linkedin" texte={"x".repeat(max + 5)} enregistrer={async () => {}} reecrire={async () => {}} />);
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("trop long");
  });

  it("aucun libellé interdit, aucun prix, aucun jargon", async () => {
    const { FicheLegende } = await import("@/components/visuels-texte/FicheLegende");
    const html = renderToStaticMarkup(<FicheLegende id={ID} reseau="instagram" texte="" erreur="TROP_LONG" enregistrer={async () => {}} reecrire={async () => {}} />);
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
    expect(interditsPost(visible)).toEqual([]);
    expect(visible).not.toMatch(/€|\$|prix|tarif|\bIA\b|prompt/i);
  });
});

describe("actions de la fiche", () => {
  it("texte trop long : erreur et RIEN n'est enregistré", async () => {
    const a = await import("@/app/(studio)/carrousels/[id]/actions");
    const max = obtenirReseau("linkedin").legende.longueurMax;
    const adresse = await adresseDe(a.enregistrerLegendeAction(formulaire({ id: ID, reseau: "linkedin", texte: "x".repeat(max + 1) })));
    expect(adresse).toContain(`/carrousels/${ID}`);
    expect(adresse).toContain("legende=TROP_LONG");
    expect(params.size).toBe(0);
    expect(journal).toHaveLength(0);
  });

  it("texte correct : enregistré sous la clé du visuel et du réseau", async () => {
    const a = await import("@/app/(studio)/carrousels/[id]/actions");
    const adresse = await adresseDe(a.enregistrerLegendeAction(formulaire({ id: ID, reseau: "facebook", texte: "  Mon texte relu  " })));
    expect(adresse).not.toContain("legende=");
    expect(params.get(`visuels.legende.${ID}.facebook`)).toMatchObject({ texte: "Mon texte relu" });
  });

  it("réseau inconnu ou identifiant mal formé : rien n'est enregistré", async () => {
    const a = await import("@/app/(studio)/carrousels/[id]/actions");
    await adresseDe(a.enregistrerLegendeAction(formulaire({ id: ID, reseau: "tiktok", texte: "Bonjour" })));
    await adresseDe(a.enregistrerLegendeAction(formulaire({ id: "../x", reseau: "linkedin", texte: "Bonjour" })));
    expect(params.size).toBe(0);
  });

  it("Réécrire en simulation : texte automatique gardé, ancien texte archivé, ligne de journal sans montant", async () => {
    const a = await import("@/app/(studio)/carrousels/[id]/actions");
    params.set(`visuels.legende.${ID}.linkedin`, { texte: "Ancien texte", le: "2026-12-01T00:00:00.000Z" });
    const adresse = await adresseDe(a.reecrireLegendeAction(formulaire({ id: ID, reseau: "linkedin" })));
    expect(adresse).not.toContain("erreur=");
    const nouveau = params.get(`visuels.legende.${ID}.linkedin`) as { texte: string };
    expect(nouveau.texte).toContain("Trois gestes pour mieux ranger ses factures");
    expect(nouveau.texte.length).toBeLessThanOrEqual(obtenirReseau("linkedin").legende.longueurMax);
    expect(params.get(`visuels.legende-precedente.${ID}.linkedin`)).toMatchObject({ texte: "Ancien texte" });
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ entite: { type: "visuel", id: ID } });
    expect(journal[0].message).toMatch(/simulation/i);
    expect(journal[0].message).not.toMatch(/\d\s?(€|\$)/);
  });

  it("Réécrire sans texte de pages : refus, rien n'est écrit", async () => {
    const a = await import("@/app/(studio)/carrousels/[id]/actions");
    visuel = { id: ID, titre: "Sans texte", statut: "brouillon" };
    const adresse = await adresseDe(a.reecrireLegendeAction(formulaire({ id: ID, reseau: "linkedin" })));
    expect(adresse).toContain("erreur=TRANSITION_REFUSEE");
    expect(params.size).toBe(0);
    expect(journal).toHaveLength(0);
  });
});
