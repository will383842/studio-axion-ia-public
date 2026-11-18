/** L8-12b : écran « Contenus à relancer ». Aucun appel réel : le service, la session et la navigation sont des doublures. */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";

const etat = vi.hoisted(() => ({ session: true, appels: [] as unknown[], reponse: { ok: true, deja: false } as { ok: boolean; deja?: boolean; motifs?: string[] }, ordre: [] as string[] }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => etat.ordre.push(`revalider:${p}`) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECTION ${url}`);
  },
}));
vi.mock("@/services/auth", () => ({
  exigerSession: async () => {
    etat.ordre.push("session");
    if (!etat.session) throw new Error("SANS SESSION");
    return {};
  },
}));
vi.mock("@/services/republication", () => ({
  depsParDefaut: () => ({ doublure: true }),
  creerNouvelleVersion: async (_deps: unknown, demande: unknown) => {
    etat.ordre.push("creer");
    etat.appels.push(demande);
    return etat.reponse;
  },
}));

import { creerNouvelleVersionAction } from "@/app/(studio)/calendrier/a-relancer/actions";
import { ContenusARelancer, LIBELLES_A_RELANCER } from "@/components/calendrier/ContenusARelancer";

const lire = (f: string) => readFileSync(f, "utf8");
const FICHIERS_NEUFS = ["src/app/(studio)/calendrier/a-relancer/page.tsx", "src/app/(studio)/calendrier/a-relancer/actions.ts", "src/components/calendrier/ContenusARelancer.tsx"];

const ligne = (id: string, extra: Record<string, unknown> = {}) => ({
  publicationId: id,
  reseau: "instagram" as const,
  date: "2026-09-10T08:00:00.000Z",
  debutTexte: `Ancien texte inventé ${id}`,
  raison: "Parmi les mieux classés de vos publications Instagram : 1er sur 6.",
  rangDejaAtteint: 0,
  media: "video" as const,
  ...extra,
});
const rendre = (lignes: ReturnType<typeof ligne>[], comptes: Record<string, string | undefined> = { instagram: "compte-a" }) =>
  renderToStaticMarkup(createElement(ContenusARelancer, { lignes, comptes } as never));

function formulaire(champs: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}
const CHAMPS = { publicationId: "p1", jour: "2026-12-10", heure: "09:00", texte: "Nouveau texte inventé", compteCible: "compte-a" };
const lancer = async (champs = CHAMPS) => {
  try {
    await creerNouvelleVersionAction(formulaire(champs));
  } catch (e) {
    return (e as Error).message;
  }
  return "";
};

beforeEach(() => {
  etat.session = true;
  etat.appels = [];
  etat.ordre = [];
  etat.reponse = { ok: true, deja: false };
});

describe("rendu du composant", () => {
  it("une ligne par candidat, raison visible, bouton, zone de texte vide, heure 09:00", () => {
    const html = rendre([ligne("a"), ligne("b", { reseau: "tiktok" })], { instagram: "compte-a", tiktok: "compte-b" });
    expect(html.match(/<li\b/g)).toHaveLength(2);
    expect(html).toContain("Parmi les mieux classés de vos publications Instagram : 1er sur 6.");
    expect(html).toContain("Nouvelle version");
    expect(html).toContain("Ancien texte inventé a");
    expect(html).toMatch(/<textarea[^>]*><\/textarea>/);
    expect(html).toContain('value="09:00"');
    expect(html).toContain('type="date"');
    expect(html).toContain('name="compteCible" value="compte-a"');
    expect(html).toContain('name="publicationId" value="a"');
  });
  it("aucun mot de validation, de programmation, d'envoi, de prix ni de score", () => {
    const html = rendre([ligne("a", { rangDejaAtteint: 2 })]);
    for (const mot of [/valider/i, /programm/i, /envoy/i, /€/, /score/i, /\$/]) expect(html).not.toMatch(mot);
    expect(html).not.toMatch(/\d\s?(eur|euros)\b/i);
  });
  it("« déjà relancé N fois » seulement si N > 0", () => {
    expect(rendre([ligne("a")])).not.toMatch(/déjà relancé/);
    expect(rendre([ligne("a", { rangDejaAtteint: 1 })])).toContain("Déjà relancé 1 fois");
    expect(rendre([ligne("a", { rangDejaAtteint: 2 })])).toContain("Déjà relancé 2 fois");
  });
  it("réseau sans compte : le bouton est remplacé par un message", () => {
    const html = rendre([ligne("a")], {});
    expect(html).toContain("Aucun compte de publication pour ce réseau");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<textarea");
  });
  it("heure de Paris pour la date", () => {
    expect(rendre([ligne("a")])).toContain("10 septembre 2026 à 10:00");
  });
});

describe("action", () => {
  it("sans session : refus, rien n'est créé", async () => {
    etat.session = false;
    expect(await lancer()).toBe("SANS SESSION");
    expect(etat.appels).toHaveLength(0);
    expect(etat.ordre[0]).toBe("session");
  });
  it("succès : un seul appel, session d'abord, message « à valider », deux pages rafraîchies", async () => {
    const sortie = await lancer();
    expect(etat.appels).toEqual([{ publicationId: "p1", jour: "2026-12-10", heure: "09:00", texte: "Nouveau texte inventé", compteCible: "compte-a" }]);
    expect(etat.ordre).toEqual(["session", "creer", "revalider:/calendrier", "revalider:/calendrier/a-relancer"]);
    expect(decodeURIComponent(sortie)).toBe("REDIRECTION /calendrier/a-relancer?message=Nouvelle version ajoutée au calendrier, à valider. Rien n'est envoyé.");
  });
  it("refus : les motifs en clair, 300 signes au plus", async () => {
    etat.reponse = { ok: false, motifs: ["Ce jour est déjà pris.", "Le texte est trop proche de l'ancien."] };
    const sortie = decodeURIComponent(await lancer());
    expect(sortie).toContain("Ce jour est déjà pris.");
    expect(sortie).toContain("Le texte est trop proche de l'ancien.");
    expect(sortie).not.toContain("Nouvelle version ajoutée");
    etat.reponse = { ok: false, motifs: ["x".repeat(900)] };
    const long = decodeURIComponent(await lancer());
    expect(long.slice(long.indexOf("message=") + 8).length).toBeLessThanOrEqual(300);
  });
  it("champs absents ou illisibles : refus clair, aucun appel au service", async () => {
    const sortie = decodeURIComponent(await lancer({ publicationId: "p1" } as never));
    expect(sortie).toContain("message=");
    expect(etat.appels).toHaveLength(0);
  });
});

describe("garde statique", () => {
  it.each(FICHIERS_NEUFS)("%s : aucun envoi, aucun fournisseur, aucun réglage", (f) => {
    const src = lire(f);
    for (const interdit of ["@/services/zernio", "@/fournisseurs", "valider-entree", "reprise-envois", "envoi-depuis-creneau", "branchement-envoi-calendrier", ".requete", "lireParametre", "fournisseurParId"]) {
      expect(src, `${f} contient ${interdit}`).not.toContain(interdit);
    }
  });
  it("l'action commence par exigerSession et n'a aucun bouton de validation", () => {
    const src = lire(FICHIERS_NEUFS[1]);
    expect(src.startsWith('"use server"')).toBe(true);
    expect(src.indexOf("exigerSession()")).toBeGreaterThan(0);
    expect(src.indexOf("exigerSession()")).toBeLessThan(src.indexOf("creerNouvelleVersion("));
  });
  it("la page : session, force-dynamic, titre, comptesCibles", () => {
    const src = lire(FICHIERS_NEUFS[0]);
    expect(src).toContain('dynamic = "force-dynamic"');
    expect(src).toContain("exigerSession()");
    expect(src).toContain("Contenus à relancer");
    expect(src).toContain("comptesCibles(");
    expect(src).toContain("Rien à relancer pour l'instant");
  });
});

describe("libellés", () => {
  it("interditsTousEcrivains vide sur chaque libellé fixe", () => {
    for (const [nom, texte] of Object.entries(LIBELLES_A_RELANCER)) expect(interditsTousEcrivains(texte), nom).toEqual([]);
  });
  it("vouvoiement : aucun « tu », « ton », « tes »", () => {
    for (const texte of Object.values(LIBELLES_A_RELANCER)) expect(texte).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
  });
});

describe("EnTeteCalendrier", () => {
  it("porte le lien vers l'écran", () => {
    const src = lire("src/components/calendrier/EnTeteCalendrier.tsx");
    expect(src).toContain('href="/calendrier/a-relancer"');
    expect(src).toContain("Contenus à relancer");
  });
});
