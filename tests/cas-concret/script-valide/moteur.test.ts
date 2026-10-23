/**
 * V4-3 · LE MOTEUR PREND LE SCRIPT VALIDÉ DU CAS : celui des outils (réglage gardé par les services), sinon celui du
 * catalogue. Aucun appel d'écriture ; l'estimation ne compte plus d'écriture (≈ 0,15 à 0,25 € de moins par vidéo) et la
 * voix est estimée sur le texte du script.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { texteDuCorps } from "@/moteurs/montage-cas-concret/fiche";
import { scriptValideDuCatalogue } from "@/moteurs/montage-cas-concret/script-valide";
import type { MoteurVideo } from "@/moteurs/types";
import { banc } from "../moteur/doubles";

const T0 = Date.UTC(2026, 9, 14, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;

async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, t: Travail) {
  let resultat;
  for (let n = 0; n < 200 && t.statut !== "termine" && t.statut !== "echec"; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
  }
  return { t, resultat };
}

describe("V4-3 · moteur et script validé", () => {
  it("recrutement : le script du catalogue, aucun appel d'écriture, l'étape « L'écriture » faite sans dépense", async () => {
    const b = banc({ scriptValide: "catalogue" });
    const c = b.commande();
    const { t, resultat } = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-script")));
    expect(t.statut).toBe("termine");
    expect(b.d.appelsEcriture()).toBe(0);
    expect(t.etapes.find((e) => e.cle === "ecriture")?.statut).toBe("terminee");
    const fiche = (resultat!.projetMontage.casConcret as { fiche: { ecrans: { texteDit: string }[] } }).fiche;
    expect(texteDuCorps(fiche as never)).toBe(texteDuCorps({ ecrans: scriptValideDuCatalogue("recrutement-apporteurs")!.ecrans } as never));
  });

  it("le script gardé par les services passe avant le catalogue ; « aucun » : l'écriture reprend", async () => {
    const autre = { ...scriptValideDuCatalogue("recrutement-apporteurs")!, source: "validé depuis le studio" };
    const b = banc({ scriptValide: async (id) => (id === "recrutement-apporteurs" ? autre : null) });
    const c = b.commande();
    const { t } = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-garde")));
    expect(t.statut).toBe("termine");
    expect(b.d.appelsEcriture()).toBe(0);
    const sans = banc();
    const c2 = sans.commande();
    await jusquAuBout(sans.moteur, c2, await sans.moteur.lancer(c2, ctx("t-sans")));
    expect(sans.d.appelsEcriture()).toBe(1);
  });

  it("estimation : aucune écriture pour un cas à script validé ; l'écriture au pire pour un cas sans script", () => {
    const avec = estimerDepuisCas(trouverCas("recrutement-apporteurs")!, [...RESEAUX], true, { voix: { fournisseur: "heygen" } });
    expect(avec.lignes.map((l) => l.etape)).not.toContain("Écriture");
    expect(avec.lignes.find((l) => l.etape === "Voix")!.total.centimes).toBeGreaterThan(0);
    const sans = estimerDepuisCas(trouverCas("rappels-rendez-vous")!, [...RESEAUX], true, { voix: { fournisseur: "heygen" } });
    expect(sans.lignes.find((l) => l.etape === "Écriture")!.total.centimes).toBeGreaterThan(0);
  });
});
