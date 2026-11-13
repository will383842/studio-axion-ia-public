/**
 * ATR-C : boutons « Copier » de la carte « À traiter ». Sans DOM (crochets factices) : on lit l'arbre rendu et on appelle les gestes.
 * Valeurs fictives ; aucun appel réseau ; jamais de nom de personne.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const contexte = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
  useContext: () => contexte.services,
}));

const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");
const { CarteATraiter } = await import("@/components/a-traiter/CarteATraiter");
type Donnees = import("@/services/a-traiter-types").CarteATraiter;

const carte = (sur: Partial<Donnees> = {}): Donnees => ({
  idEvenement: "evt-fictif-001",
  reseau: "linkedin",
  post: "post_fictif_001",
  lienPost: null,
  mot: "GUIDE",
  motif: "mot_manuel",
  extrait: "Je veux le guide",
  creeLe: "2026-11-12T10:00:00.000Z",
  statut: "a_traiter",
  kit: "Merci pour votre intérêt !",
  message: "a_fabriquer",
  ...sur,
});
const boutons = (arbre: unknown) => trouver(arbre as never, (e) => typeof e.props.onClick === "function");
const par = (arbre: unknown, libelle: string) => boutons(arbre).find((b) => texteDe(b as never).includes(libelle));
const faux = (message = { ok: true as boolean, texte: "TEXTE COPIÉ", phrase: "Refus fictif." }) => ({
  reponse: vi.fn(async () => ({ ok: true as const, texte: "REPONSE" })),
  message: vi.fn(async () => (message.ok ? { ok: true as const, texte: message.texte } : { ok: false as const, phrase: message.phrase })),
});
const ecrire = vi.fn(async () => undefined);
vi.stubGlobal("navigator", { clipboard: { writeText: ecrire } });
afterEach(() => {
  contexte.services = null;
  ecrire.mockClear();
});

describe("CarteATraiter · copie", () => {
  it("carte LinkedIn : les deux boutons, la mention « à la main », le texte copié par le presse-papiers", async () => {
    const s = faux();
    contexte.services = s;
    const m = monter(CarteATraiter, { carte: carte() });
    const arbre = m.rendre();
    expect(par(arbre, "Copier la réponse")).toBeTruthy();
    expect(texteDe(arbre as never)).toContain("À la main : aucun envoi automatique sur LinkedIn ni TikTok");
    await (par(arbre, "Copier le message")!.props.onClick as () => Promise<void>)();
    expect(s.message).toHaveBeenCalledWith("evt-fictif-001");
    expect(ecrire).toHaveBeenCalledWith("TEXTE COPIÉ");
    expect(texteDe(m.rendre() as never)).toContain("Texte copié");
  });

  it("refus : la phrase est affichée, rien n'est copié", async () => {
    contexte.services = faux({ ok: false, texte: "", phrase: "Vérification impossible, rien n’est proposé." });
    const m = monter(CarteATraiter, { carte: carte() });
    await (par(m.rendre(), "Copier le message")!.props.onClick as () => Promise<void>)();
    await attendre();
    expect(ecrire).not.toHaveBeenCalled();
    expect(texteDe(m.rendre() as never)).toContain("Vérification impossible, rien n’est proposé.");
  });

  it("copier la réponse passe par le geste de réponse", async () => {
    const s = faux();
    contexte.services = s;
    const m = monter(CarteATraiter, { carte: carte() });
    await (par(m.rendre(), "Copier la réponse")!.props.onClick as () => Promise<void>)();
    expect(s.reponse).toHaveBeenCalledWith("evt-fictif-001");
    expect(ecrire).toHaveBeenCalledWith("REPONSE");
  });

  it("carte TikTok, message indisponible ou personne opposée : pas de bouton « Copier le message »", () => {
    contexte.services = faux();
    for (const sur of [{ reseau: "tiktok" as const }, { message: "indisponible" as const }, { opposee: true }]) {
      const arbre = monter(CarteATraiter, { carte: carte(sur) }).rendre();
      expect(par(arbre, "Copier le message")).toBeUndefined();
    }
  });

  it("la mention « à la main » reste affichée sans gestes de copie ; aucun nom de personne ni module serveur", () => {
    contexte.services = null;
    expect(texteDe(monter(CarteATraiter, { carte: carte() }).rendre() as never)).toContain("aucun envoi automatique");
    const source = readFileSync("src/components/a-traiter/CarteATraiter.tsx", "utf8");
    expect(source).not.toMatch(/from "@\/services\/(?!a-traiter-types)|server-only|useId|useRouter|useActionState/);
  });
});
