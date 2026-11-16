/**
 * REF-RETIRER-CALENDRIER : bouton « Retirer du calendrier » du panneau d'aperçu. Sans DOM (crochets factices).
 */
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
const retirerDuCalendrier = vi.fn(async (_cle: string, _confirmation: string) => ({ ok: true as const, donnees: { creneauId: "cre_vis_1" } }));
vi.mock("@/app/(studio)/calendrier/actions/retirer", () => ({ retirerDuCalendrier: (c: string, k: string) => retirerDuCalendrier(c, k) }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");
const { RetirerDuCalendrier } = await import("@/components/calendrier/RetirerDuCalendrier");
const { ApercuPublication } = await import("@/components/calendrier/ApercuPublication");
type Entree = import("@/components/calendrier/apercu-reseau").EntreeApercu;

const AUJOURDHUI = "2026-11-14";
const rendre = (el: ReactElement) => renderToStaticMarkup(el);
const lisible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const INTERDITS = [
  /\b(propose|a_valider|a_corriger|valide|programmee|publiee|echec|archive|idee)\b/,
  /[ÉE]chec|Erreur|erreur/,
  /Buffer|diffuseur/i,
  /€|\beuros?\b|\bprix\b|\btarif/i,
  /Supprimer|supprim/i,
  /\bUTC\b|GMT/,
  /\b(tu|ton|tes|toi)\b/i,
];
const entree = (sur: Partial<Entree> = {}): Entree => ({
  cle: "publication:pub_envoi:vis_1:linkedin:v1|linkedin", jour: "2026-11-16", reseau: "linkedin", type: "carrousel", etat: "programme", heure: "08:30",
  titre: "Carrousel", texte: "Un texte.", premierCommentaire: "Une question ?", media: { genre: "image", url: "https://exemple.fr/a.png" }, ...sur,
});
const panneau = (e: Entree) => rendre(<ApercuPublication entree={e} aujourdhui={AUJOURDHUI} onPrecedente={() => {}} onSuivante={() => {}} onFermer={() => {}} onChangerDate={() => {}} />);

describe("RetirerDuCalendrier", () => {
  it("premier rendu : seulement « Retirer du calendrier » ; clic : la phrase, « Oui… » et « Annuler »", async () => {
    const m = monter(RetirerDuCalendrier, { cle: "publication:pub_x|linkedin" });
    const repos = lisible(rendre(m.rendre() as ReactElement));
    expect(repos).toContain("Retirer du calendrier");
    expect(repos).not.toContain("Oui, retirer");
    const bouton = trouver(m.rendre(), (x) => x.type === "button")[0];
    (bouton.props.onClick as () => void)();
    const html = lisible(rendre(m.rendre() as ReactElement));
    expect(html).toContain("Ses publications prévues sur tous les réseaux seront retirées. Rien n'est encore parti.");
    expect(html).toContain("Oui, retirer du calendrier");
    expect(html).toContain("Annuler");
    for (const motif of INTERDITS) expect(html, String(motif)).not.toMatch(motif);
    for (const motif of INTERDITS) expect(repos, String(motif)).not.toMatch(motif);
  });

  it("« Oui » appelle l'action avec (cle, « retirer »)", async () => {
    const m = monter(RetirerDuCalendrier, { cle: "publication:pub_x|linkedin" });
    (trouver(m.rendre(), (x) => x.type === "button")[0].props.onClick as () => void)();
    const oui = trouver(m.rendre(), (x) => x.type === "button" && texteDe(x).includes("Oui"))[0];
    await (oui.props.onClick as () => Promise<void>)();
    await attendre();
    expect(retirerDuCalendrier).toHaveBeenCalledWith("publication:pub_x|linkedin", "retirer");
  });
});

describe("ApercuPublication : quand le bouton paraît", () => {
  it("pour une publication programmée de carrousel à venir", () => {
    expect(lisible(panneau(entree()))).toContain("Retirer du calendrier");
  });
  it.each([
    ["publiée", entree({ etat: "publie" })],
    ["jour passé", entree({ jour: "2026-11-10" })],
    ["vidéo", entree({ type: "video" })],
    ["clé de créneau", entree({ cle: "creneau:c1|linkedin" })],
  ])("pas pour : %s", (_n, e) => {
    expect(lisible(panneau(e))).not.toContain("Retirer du calendrier");
  });
});

describe("action serveur : lecture du source", () => {
  const src = readFileSync("src/app/(studio)/calendrier/actions/retirer.ts", "utf8");
  it("commence par use server, exige la session en tête, exige la confirmation", () => {
    expect(src.startsWith('"use server"')).toBe(true);
    expect(src).toMatch(/Promise<Resultat<\{ creneauId: string \}>> \{\s*await exigerSession\(/);
    expect(src).toContain('confirmation !== "retirer"');
    expect(src).not.toMatch(/fournisseur|zernio|buffer|fetch\(/i);
  });
});
