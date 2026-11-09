import { describe, expect, it } from "vitest";
import { schemaDemandeScript } from "@/domaine/scripts-tableau";
import { demandeEnTexte, consigneCibleAccroche } from "@/services/tableau-scripts/consignes";
import { remarquesCiblage } from "@/moteurs/montage-tableau/controles-sortie";

const base = { serie: "", sujet: "Relancer les impayés", public: "Plombiers", reseau: "", fin: { type: "diagnostic" }, envoi: "Une fiche" };
async function demandeValide(extra: object = {}) {
  const { SERIES_TABLEAU, RESEAUX_SCRIPT } = await import("@/domaine/scripts-tableau");
  return { ...base, serie: SERIES_TABLEAU[0], reseau: RESEAUX_SCRIPT[0], ...extra };
}

describe("tableau animé : ciblage facultatif dans la demande", () => {
  it("accepte une demande sans ciblage ni type", async () => {
    expect(schemaDemandeScript.safeParse(await demandeValide()).success).toBe(true);
  });
  it("accepte ciblage et type d'automatisation", async () => {
    const r = schemaDemandeScript.safeParse(await demandeValide({ ciblage: { niveau: "metier", libelle: "Plombiers", origine: "saisie" }, typeAutomatisation: "relances-impayes" }));
    expect(r.success).toBe(true);
  });
  it("refuse un libellé de plus de 80 caractères ou un type inconnu", async () => {
    expect(schemaDemandeScript.safeParse(await demandeValide({ ciblage: { niveau: "metier", libelle: "x".repeat(81), origine: "saisie" } })).success).toBe(false);
    expect(schemaDemandeScript.safeParse(await demandeValide({ typeAutomatisation: "inconnu" })).success).toBe(false);
  });
});

describe("tableau animé : la consigne demande de nommer la cible", () => {
  it("la demande écrit la cible et le type, et la consigne exige la cible dans l'accroche", async () => {
    const d = schemaDemandeScript.parse(await demandeValide({ ciblage: { niveau: "metier", libelle: "Plombiers", origine: "saisie" }, typeAutomatisation: "relances-impayes" }));
    const t = demandeEnTexte(d);
    expect(t).toContain("Cible : Plombiers (metier)");
    expect(t).toContain("5 premières secondes");
    expect(t).toContain("Relances clients et impayés");
    expect(consigneCibleAccroche()).toMatch(/accroche/);
  });
  it("sans cible, aucune ligne de cible", async () => {
    expect(demandeEnTexte(schemaDemandeScript.parse(await demandeValide()))).not.toContain("Cible :");
  });
});

describe("tableau animé : remarques C100 / C101 non bloquantes", () => {
  const cible = { niveau: "metier" as const, libelle: "Plombiers", origine: "saisie" as const };
  it("C100 si la cible manque dans l'accroche", () => {
    const r = remarquesCiblage(cible, "Vos factures dorment dans un tiroir. Cela vous fait perdre 3 heures par semaine.");
    expect(r.map((x) => x.code)).toContain("C100");
    expect(r.every((x) => x.bloquant === false)).toBe(true);
  });
  it("aucune alerte si la cible est nommée et le bénéfice clair", () => {
    expect(remarquesCiblage(cible, "Plombier, vous perdez 3 heures par semaine sur vos devis.")).toEqual([]);
  });
  it("C101 si aucun bénéfice clair", () => {
    expect(remarquesCiblage(cible, "Plombiers, voici une idée.").map((x) => x.code)).toContain("C101");
  });
  it("sans cible : aucune remarque ici (jamais un blocage)", () => {
    expect(remarquesCiblage(undefined, "Bonjour.")).toEqual([]);
  });
});
