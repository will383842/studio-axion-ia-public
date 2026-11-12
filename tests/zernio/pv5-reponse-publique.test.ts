/** PV-5 : matrice de capacités, graphe sans message privé (LinkedIn page, TikTok), kit LinkedIn profil, file À traiter. Aucun réseau ; mots interdits en JETONS. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const T = await import("@/services/mots-textes");
const G = await import("@/services/mots-graphe");
const Cap = await import("@/services/mots-capacites");
const K = await import("@/services/mots-kit");
const KS = await import("@/services/mots-kit-service");
const S = await import("@/services/mots-service");
const { KitLinkedin } = await import("@/components/mots/KitLinkedin");

const J = (...p: string[]) => p.join("");
const TOKENS = { lieu: J("Gren", "oble"), label: J("Quali", "opi"), participe: J("cert", "ifié"), gain: J("Aucun gain ", "garanti") };
const ALLUME = { MOTS_ENABLED: "1" };
const LIEN = "https://exemple.test/guide";
const saisieDe = (reponsePublique = "Bonjour ! le guide est sur la page indiquée.") => ({ mot: "GUIDE", reponsePublique, messagePrive: "Bonjour ! Quelle adresse pour le guide ?", relance: null, fin: "Bonjour ! Merci, c'est noté." });
const valides = (s = saisieDe()) => T.validerTextes(T.textesDepuisSaisie(s));
const brouillon = () => T.textesDepuisSaisie(saisieDe());

beforeEach(() => reinitialiserDepots());

describe("pv5 · matrice de capacités", () => {
  it("Facebook et Instagram : réponse publique + message privé", () => {
    for (const r of ["facebook", "instagram"] as const) expect(Cap.capaciteDe(r)).toMatchObject({ reponsePublique: "auto", messagePrive: "auto", automatisable: true });
  });
  it("RC-43 · LinkedIn page et TikTok : réponse publique à la main, jamais « auto »", () => {
    for (const r of ["linkedin_page", "tiktok"] as const) {
      expect(Cap.capaciteDe(r).reponsePublique).not.toBe("auto");
      expect(Cap.capaciteDe(r)).toMatchObject({ reponsePublique: "manuel", messagePrive: "non", automatisable: false });
    }
  });
  it("RC-43 · aucun réseau LinkedIn/TikTok ne produit de workflow de réponse publique automatique", () => {
    for (const r of ["linkedin_page", "tiktok"] as const) expect(Cap.construireGrapheReseau(valides(), r)).toMatchObject({ ok: false, code: "manuel_seulement" });
  });
  it("LinkedIn profil : manuel, non automatisable", () => {
    expect(Cap.capaciteDe("linkedin_profil")).toMatchObject({ reponsePublique: "manuel", messagePrive: "non", automatisable: false });
  });
  it("tout est marqué À CONFIRMER chez Zernio et un réseau inconnu est refusé", () => {
    for (const r of Cap.RESEAUX) expect(Cap.CAPACITES[r].confirmeChezZernio).toBe(false);
    expect(Cap.estReseau("youtube")).toBe(false);
    expect(Cap.construireGrapheReseau(valides(), "youtube")).toMatchObject({ ok: false, code: "reseau_inconnu" });
  });
});

describe("pv5 · graphe adapté", () => {
  it("un graphe complet de PV-3 est refusé pour LinkedIn et TikTok (garde finale), accepté pour Facebook", () => {
    const complet = G.construireGrapheMot(valides());
    if (!complet.ok) throw new Error("graphe");
    expect(Cap.grapheConformeAuReseau(complet.workflow, "linkedin_page")).toBe(false);
    expect(Cap.grapheConformeAuReseau(complet.workflow, "tiktok")).toBe(false);
    expect(Cap.grapheConformeAuReseau(complet.workflow, "facebook")).toBe(true);
    expect(Cap.grapheConformeAuReseau(complet.workflow, "linkedin_profil")).toBe(false);
  });
  it("Facebook et Instagram gardent le message privé ; LinkedIn profil est refusé (manuel)", () => {
    const f = Cap.construireGrapheReseau(valides(), "facebook");
    expect(f.ok && f.workflow.etapes.some((e) => e.type === "envoyer_message_prive")).toBe(true);
    expect(f.ok && f.workflow.declencheur).toMatchObject({ reseaux: ["facebook"] });
    expect(Cap.construireGrapheReseau(valides(), "linkedin_profil")).toMatchObject({ ok: false, code: "manuel_seulement" });
  });
  it("textes non validés ou refusés par le contrôle de sortie : refus, quel que soit le réseau", () => {
    expect(Cap.construireGrapheReseau(brouillon(), "instagram")).toMatchObject({ ok: false, code: "textes_non_valides" });
    const modifie = { ...valides(), reponsePublique: "Bonjour ! autre texte." };
    expect(Cap.construireGrapheReseau(modifie, "instagram")).toMatchObject({ ok: false, code: "textes_non_valides" });
    for (const mauvais of [`Bonjour ! ${TOKENS.lieu}`, `Bonjour ! ${TOKENS.gain}`, `Bonjour ! ${TOKENS.label} ${TOKENS.participe}`]) {
      expect(Cap.construireGrapheReseau(valides(saisieDe(mauvais)), "facebook")).toMatchObject({ ok: false, code: "texte_refuse" });
    }
  });
});

describe("pv5 · kit LinkedIn profil", () => {
  it("refusé si le texte n'est pas validé ou a changé", () => {
    expect(K.construireKitLinkedinProfil(brouillon(), LIEN)).toMatchObject({ ok: false, code: "textes_non_valides" });
    expect(K.construireKitLinkedinProfil({ ...valides(), fin: "Autre" }, LIEN)).toMatchObject({ ok: false, code: "textes_non_valides" });
  });
  it("généré depuis des textes validés, avec instructions manuelles", () => {
    const r = K.construireKitLinkedinProfil(valides(), LIEN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.kit.commentaireEpingle).toBe(saisieDe().reponsePublique);
      expect(r.kit.lienGuide).toBe(LIEN);
      expect(r.kit.instructions.length).toBeGreaterThan(0);
    }
  });
  it("mots interdits (jetons), adresse e-mail et lien douteux refusés", () => {
    for (const mauvais of [`Bonjour ! ${TOKENS.lieu}`, `Bonjour ! ${TOKENS.gain}`, `Bonjour ! ${TOKENS.label}`, "Bonjour ! écrivez à nom@exemple.test"]) {
      expect(K.construireKitLinkedinProfil(valides(saisieDe(mauvais)), LIEN)).toMatchObject({ ok: false, code: "texte_refuse" });
    }
    for (const lien of ["http://exemple.test/g", "https://u:p@exemple.test/g", `https://exemple.test/${TOKENS.lieu}`, "https://exemple.test/a@b", "javascript:alert(1)", "pas un lien"]) {
      expect(K.construireKitLinkedinProfil(valides(), lien)).toMatchObject({ ok: false, code: "lien_invalide" });
    }
  });
  it("le rendu échappe le texte", () => {
    const kit = { mot: "GUIDE", commentaireEpingle: "<script>alert(1)</script>", reponseType: "<img src=x onerror=1>", lienGuide: LIEN, instructions: K.INSTRUCTIONS_KIT };
    const html = renderToStaticMarkup(createElement(KitLinkedin, { kit, file: [] }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("pv5 · service inerte et file À traiter", () => {
  it("éteint par défaut : rien généré, rien écrit", async () => {
    await S.validerMot({ saisie: saisieDe(), confirmeParOperateur: true });
    expect(await KS.genererKit({ saisie: saisieDe(), lienGuide: LIEN, env: {} })).toMatchObject({ issue: "simule" });
    expect(await KS.ajouterATraiter({ mot: "GUIDE", repere: "Post du lundi", env: {} })).toMatchObject({ issue: "simule" });
    expect(await KS.lireATraiter()).toEqual([]);
  });
  it("allumé : kit seulement si la validation ENREGISTRÉE correspond", async () => {
    expect(await KS.genererKit({ saisie: saisieDe(), lienGuide: LIEN, env: ALLUME })).toMatchObject({ issue: "refuse", raison: "textes_non_valides" });
    await S.validerMot({ saisie: saisieDe(), confirmeParOperateur: true });
    expect(await KS.genererKit({ saisie: saisieDe(), lienGuide: LIEN, env: ALLUME })).toMatchObject({ issue: "execute" });
    expect(await KS.genererKit({ saisie: saisieDe("Bonjour ! modifié."), lienGuide: LIEN, env: ALLUME })).toMatchObject({ issue: "refuse" });
  });
  it("file : ajout, repère refusé (e-mail, mot interdit), marquage fait", async () => {
    expect(await KS.ajouterATraiter({ mot: "GUIDE", repere: "Post du lundi", env: ALLUME })).toMatchObject({ issue: "execute" });
    expect(await KS.ajouterATraiter({ mot: "GUIDE", repere: "a@b.test", env: ALLUME })).toMatchObject({ issue: "refuse", raison: "repere_invalide" });
    expect(await KS.ajouterATraiter({ mot: "GUIDE", repere: TOKENS.lieu, env: ALLUME })).toMatchObject({ issue: "refuse" });
    const [e] = await KS.lireATraiter();
    expect(e.fait).toBe(false);
    await KS.marquerElementFait({ id: e.id, env: ALLUME });
    expect(await KS.lireATraiter()).toEqual([]);
  });
});
