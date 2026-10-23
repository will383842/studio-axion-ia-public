/**
 * SOCLE COMMUN DU TABLEAU ANIMÉ : chaque passe reçoit la charte de Will (`<contexte_axion>`), son style
 * (`<style_will>`) et ses preuves (`<preuves>`) TELS QUELS (le préfixe mis en cache, partagé avec le générateur), puis
 * les modèles de ton (`<gagnants>`) et la recette du tableau (`<recette_format>` : priorité, règles, script modèle),
 * dans l'ordre figé. Socle indisponible : le tableau écrit comme avant (rien ne bloque).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EntreeRole } from "@/generateur/roles/types";
import { construireRequete } from "@/generateur/roles/types";

const executes: EntreeRole[] = [];
vi.mock("@/services/depense-claude-video", () => ({
  plafondScriptTableau: (usd: number) => ({ parametre: "tableau.plafondScriptUsd", defautUsd: usd }),
  executerRolePourVideo: async (_v: string, _r: unknown, entree: EntreeRole) => {
    executes.push(entree);
    return { ok: true, simule: false, donnees: { rien: true }, modele: "claude-opus-5-5", stopReason: "end_turn", coutUsd: 0 };
  },
}));

const { requeteAngle, requeteEcriture, REGLES_TABLEAU, SCRIPT_TEMOIN } = await import("@/services/tableau-scripts/consignes");
const { roleDeRequete, clientScriptsStudio, socleSansEchec } = await import("@/services/tableau-scripts/client-studio");
const { DEMANDE_MODELE } = await import("./modele-valide");

const SOCLE = { contexteAxion: "CHARTE DE WILL : interdit « booster ».", styleWill: "STYLE DE WILL : phrases courtes.", preuves: '<preuve id="p1">Une preuve.</preuve>', gagnants: '<modele code="W01">On recrute…</modele>' };
const ANGLE = {
  angle: "",
  douleur: "",
  accroches: (["situation-vecue", "idee-recue-contredite", "chiffre-vrai", "erreur-frequente", "promesse-precise"] as const).map((type) => ({ type, dit: "", ecran: "", pourquoi: "" })),
  retenue: 0,
  raison: "",
};

afterEach(() => {
  executes.length = 0;
});

describe("le tableau reçoit le socle de Will", () => {
  it("écriture : charte, style et preuves de Will tels quels, gagnants, puis priorité, règles et script modèle — dans l'ordre figé", () => {
    const { entree } = roleDeRequete(requeteEcriture(DEMANDE_MODELE, ANGLE), "ecriture", SOCLE);
    const c = entree.contexte;
    expect(c.contexteAxion).toBe(SOCLE.contexteAxion);
    expect(c.styleWill).toBe(SOCLE.styleWill);
    expect(c.preuves).toBe(SOCLE.preuves);
    expect(c.gagnants).toBe(SOCLE.gagnants);
    // Will, 14/10 : pour ce format, les règles du tableau passent avant la charte générale quand elles diffèrent.
    const priorite = c.recette!.indexOf("Pour ce format, les règles du tableau ci-dessous passent avant la charte générale quand elles diffèrent.");
    expect(priorite).toBe(0);
    expect(c.recette).toContain(REGLES_TABLEAU);
    expect(c.recette!.indexOf("<regles>")).toBeLessThan(c.recette!.indexOf("<script_temoin>"));
    expect(c.recette).toContain(SCRIPT_TEMOIN);
    // Ordre figé de la requête : contexte_axion, style_will, preuves (le socle), gagnants, recette, puis la consigne.
    const { role } = roleDeRequete(requeteEcriture(DEMANDE_MODELE, ANGLE), "ecriture", SOCLE);
    const blocs = construireRequete(role, entree).systeme.map((b) => b.texte);
    const pos = ["<contexte_axion>", "<style_will>", "<preuves>", "<gagnants>", "<recette_format>"].map((t) => blocs.findIndex((b) => b.startsWith(t)));
    expect(pos).toEqual([0, 1, 2, 3, 4]);
  });

  it("angle (sans script modèle) : le même style de Will que les autres passes, les règles dans la recette", () => {
    const { entree } = roleDeRequete(requeteAngle(DEMANDE_MODELE, "complete"), "angle", SOCLE);
    expect(entree.contexte.styleWill).toBe(SOCLE.styleWill);
    expect(entree.contexte.contexteAxion).toBe(SOCLE.contexteAxion);
    expect(entree.contexte.recette).toContain(REGLES_TABLEAU);
    expect(entree.contexte.recette).not.toContain(SCRIPT_TEMOIN);
  });

  it("un cadre du format venu du socle (recette) n'est jamais perdu : il passe en tête de la recette", () => {
    const { entree } = roleDeRequete(requeteAngle(DEMANDE_MODELE), "angle", { ...SOCLE, recette: "CADRE DU FORMAT" });
    expect(entree.contexte.recette!.startsWith("CADRE DU FORMAT")).toBe(true);
    expect(entree.contexte.recette).toContain(REGLES_TABLEAU);
  });

  it("sans socle : les seuls blocs du tableau (règles, script modèle), sans phrase de priorité", () => {
    const { entree } = roleDeRequete(requeteEcriture(DEMANDE_MODELE, ANGLE), "ecriture");
    expect(Object.keys(entree.contexte)).toEqual(["recette"]);
    expect(entree.contexte.recette!.startsWith("<regles>")).toBe(true);
    expect(entree.contexte.recette).toContain("<script_temoin>");
  });

  it("le client du studio charge le socle UNE fois et le donne à chaque passe", async () => {
    let chargements = 0;
    const client = clientScriptsStudio("v-1", 1, undefined, async () => (chargements++, SOCLE));
    await client.appeler(requeteAngle(DEMANDE_MODELE), "angle");
    await client.appeler(requeteEcriture(DEMANDE_MODELE, ANGLE), "ecriture");
    expect(chargements).toBe(1);
    expect(executes.map((e) => e.contexte.preuves)).toEqual([SOCLE.preuves, SOCLE.preuves]);
    expect(executes[1].contexte.contexteAxion).toBe(SOCLE.contexteAxion);
  });

  it("socle indisponible : journalisé, le tableau écrit comme avant", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const charger = socleSansEchec(async () => {
      throw new Error("base indisponible");
    });
    expect(await charger()).toBeUndefined();
    expect(erreur).toHaveBeenCalledWith(expect.stringContaining("socle de Will"));
    const client = clientScriptsStudio("v-1", 1, undefined, charger);
    const r = await client.appeler(requeteEcriture(DEMANDE_MODELE, ANGLE), "ecriture");
    expect(r.texte).toBe(JSON.stringify({ rien: true }));
    expect(executes[0].contexte).toEqual(roleDeRequete(requeteEcriture(DEMANDE_MODELE, ANGLE), "ecriture").entree.contexte);
    erreur.mockRestore();
  });
});
