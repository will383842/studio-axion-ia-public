/**
 * FIX-BARRE-SANS-NOMBRE · une barre « avant / maintenant » qui désigne un fait du cas SANS nombre est dessinée sans
 * nombre (libellé seul). La garde « nombres des faits » n'est pas affaiblie. Doubles seulement : aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { completerFiche, HAUTEURS_BARRES_SANS_FAIT } from "@/moteurs/montage-cas-concret/champs-du-cas";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import { CONSIGNE_ECRITURE, dureesDesFins, ecrireFiche, ficheParGabarit, roleEcritureCasConcret, type EntreeEcriture } from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { texteDuCorps, validerSchemaFiche } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import type { OutilsEcriture } from "@/moteurs/montage-cas-concret/outils";

const cas = trouverCas("contact-vers-crm")!;
const FIXE = { videoId: "v-fe27e3b8e5ba", versionId: "ver-fix", habillage: "charte-duo/1", origine: "porte-a" } as const;
const plan = regrouperFins(planDesFins({ reseaux: ["facebook", "instagram", "tiktok", "linkedin"], offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: false, motSur: [], table: TABLE_FINS_DIAGNOSTIC }));
type Barre = { libelle?: string; faitId?: string; valeur?: number };
type Ecran = { type: string; faitId?: string; avant?: Barre; maintenant?: Barre };
type Brut = { ecrans: Ecran[] };
const fiche = (avant: Barre, maintenant: Barre): Brut => {
  const f = structuredClone(ficheParGabarit(cas, FIXE, dureesDesFins(plan.fins))) as unknown as Brut;
  for (const e of f.ecrans) if (e.type === "resultat") { e.avant = avant; e.maintenant = maintenant; }
  return f;
};
const resultat = (b: unknown) => (b as Brut).ecrans.find((e) => e.type === "resultat") as Required<Ecran>;

describe("FIX-BARRE-SANS-NOMBRE", () => {
  it("(a) barre « maintenant » → fait sans nombre : aucun refus, note, faitId retiré, hauteur 20", () => {
    const c = completerFiche(fiche({ libelle: "Balayage lent", faitId: "balayage-dix-minutes" }, { libelle: "En quelques secondes", faitId: "transmission-rapide" }), { ...FIXE, cas });
    expect(c.refus).toEqual([]);
    const r = resultat(c.brute);
    expect("faitId" in r.maintenant).toBe(false);
    expect(r.maintenant.valeur).toBe(HAUTEURS_BARRES_SANS_FAIT.maintenant);
    expect(r.maintenant.valeur).toBe(20);
    expect(c.notes.some((n) => n.includes("transmission-rapide") && n.includes("sans nombre"))).toBe(true);
    // cohérence visuelle : l'autre barre est aussi sans nombre, à sa hauteur par défaut
    expect("faitId" in r.avant).toBe(false);
    expect(r.avant.valeur).toBe(HAUTEURS_BARRES_SANS_FAIT.avant);
    const schema = validerSchemaFiche(c.brute);
    expect(schema.ok).toBe(true);
    if (schema.ok) {
      const v = validerFicheEcrans(c.brute, { cas, texteScript: texteDuCorps(schema.fiche), fins: plan.fins, motsInterdits: [] });
      expect(v.ok).toBe(true);
    }
  });

  it("(a bis) un fait inconnu à côté reste refusé", () => {
    const c = completerFiche(fiche({ libelle: "X", faitId: "invente" }, { libelle: "Y", faitId: "transmission-rapide" }), { ...FIXE, cas });
    expect(c.refus.some((m) => m.includes("absent du cas"))).toBe(true);
  });

  it("(b) un écran « chiffre » sur un fait sans nombre reste REFUSÉ", () => {
    const f = fiche({ libelle: "A", faitId: "balayage-dix-minutes" }, { libelle: "B", faitId: "balayage-dix-minutes" });
    const ch = f.ecrans.find((e) => e.type === "chiffre");
    if (ch) ch.faitId = "transmission-rapide";
    const c = completerFiche(f, { ...FIXE, cas });
    if (ch) expect(c.refus.some((m) => m.includes("qui ne porte aucun nombre"))).toBe(true);
  });

  it("(c) barre { libelle } seul dans un cas chiffré : toujours REFUSÉE", () => {
    const c = completerFiche(fiche({ libelle: "Avant" }, { libelle: "Maintenant" }), { ...FIXE, cas });
    expect(c.refus.some((m) => m.includes("ne désigne aucun fait : donnez « faitId »"))).toBe(true);
  });

  it("(d) la consigne porte la phrase neuve et le rôle passe en version 5", () => {
    expect(CONSIGNE_ECRITURE).toContain("désigne le fait SANS NOMBRE qui le décrit");
    expect(CONSIGNE_ECRITURE).toContain("jamais un fait chiffré qui ne mesure pas cet état");
    // 17/11/2026 : modification voulue (FIX-CC-RESULTAT-SANS-NOMBRE) : la version du rôle passe de 4 à 5 (consigne complétée sur le sens de « avant »). Seul ce numéro change ; les phrases vérifiées ci-dessus et toute la garde sont intactes.
    expect(roleEcritureCasConcret.version).toBe(5);
  });

  it("(e) bout en bout : un seul appel, la fiche passe", async () => {
    const appels: unknown[] = [];
    const brute = fiche({ libelle: "Balayage lent", faitId: "balayage-dix-minutes" }, { libelle: "En quelques secondes", faitId: "transmission-rapide" });
    const outils = { appeler: async (_r: unknown, e: unknown) => { appels.push(e); return { ok: true, simule: false, texte: JSON.stringify(brute), stopReason: "end_turn", coutUsd: 0 }; }, budget: { reserver: async () => ({ ok: true }) } } as unknown as OutilsEcriture;
    const entree: EntreeEcriture = { ...FIXE, cas, controle: { motsInterdits: [], fins: plan.fins } };
    const r = await ecrireFiche(entree, outils);
    expect(appels).toHaveLength(1);
    expect(r.ok).toBe(true);
  });
});
