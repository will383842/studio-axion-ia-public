/**
 * Écriture d'un cas du stock SANS fait chiffré (24/10/2026) : le 1er essai réel d'un cas du stock a échoué parce que la
 * consigne exigeait des barres désignant un fait, alors que les 96 cas du stock n'en ont aucun. Désormais, un cas sans
 * fait chiffré rend un « resultat » en mots : barres { "libelle" } seules, dessinées sans nombre par le studio.
 * Doubles seulement : aucun appel réel, aucune dépense.
 */
import { describe, expect, it } from "vitest";
import { controlerProprietes, proprietesEcrans, textesEcran } from "@/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_CAS_CONCRET } from "@/formats/cas-concret";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { CAS_STOCK } from "@/formats/cas-concret/stock-metiers";
import { CONSIGNE_ECRITURE, CONSIGNE_REFORMULATION, ecrireFiche, ficheParGabarit, jugerFiche, type EntreeEcriture } from "@/moteurs/montage-cas-concret/ecriture";
import { HAUTEURS_BARRES_SANS_FAIT, casSansFaitChiffre, completerFiche } from "@/moteurs/montage-cas-concret/champs-du-cas";
import { contenuEcran, ecransCales } from "@/moteurs/montage-cas-concret/etapes";
import { texteDuCorps, type EcranCorps } from "@/moteurs/montage-cas-concret/fiche";
import { regleOrdre, validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { OutilsEcriture } from "@/moteurs/montage-cas-concret/outils";
import type { CasConcret } from "@/formats/cas-concret/cas";

const FIXE = { videoId: "video-sf", versionId: "version-sf", habillage: "charte-duo/1", origine: "porte-a" } as const;
const ZONE = { haut: 14, droite: 18, bas: 30, gauche: 6 };
const lt02 = trouverCas("transporteur-demandes-de-cotation")!;
const recrutement = trouverCas("recrutement-apporteurs")!;

interface Double extends OutilsEcriture {
  appels: EntreeRole[];
}
function double(reponses: (object | string)[]): Double {
  const d: Double = {
    appels: [],
    async appeler(_role: DefinitionRole, e: EntreeRole) {
      d.appels.push(e);
      const r = reponses[d.appels.length - 1];
      if (r === undefined) throw new Error("appel de trop");
      return { ok: true, simule: false, texte: typeof r === "string" ? r : JSON.stringify(r), stopReason: "end_turn" };
    },
    budget: { async reserver() { return { ok: true }; } },
  };
  return d;
}

/** Réponse type de Claude pour un cas sans fait chiffré : le gabarit, réduit à { ecrans }, barres du résultat en { libelle } seul. */
function reponseType(c: CasConcret): { ecrans: Record<string, unknown>[] } {
  const f = structuredClone(ficheParGabarit(c, FIXE)) as unknown as { ecrans: Record<string, any>[] };
  return {
    ecrans: f.ecrans.map((e) => {
      const { id: _id, marque: _marque, avanceMs: _avance, ...reste } = e;
      if (reste.type === "resultat") {
        reste.avant = { libelle: reste.avant.libelle };
        reste.maintenant = { libelle: reste.maintenant.libelle };
      }
      return reste;
    }),
  };
}

describe("cas du stock sans fait chiffré : écriture de la fiche", () => {
  it("les consignes disent ce qu'il faut faire sans fait chiffré", () => {
    expect(CONSIGNE_ECRITURE).toContain("SANS FAIT CHIFFRÉ");
    expect(CONSIGNE_ECRITURE).toContain("jamais PREUVE_MANQUANTE pour cette raison");
    expect(CONSIGNE_REFORMULATION).toContain("<faits> vaut « (aucun) » : la phrase n'a aucun nombre et n'en reçoit aucun ; ce n'est pas une preuve manquante.");
  });

  it("(0) LT-02 n'a aucun fait chiffré, recrutement-apporteurs en a", () => {
    expect(casSansFaitChiffre(lt02)).toBe(true);
    expect(casSansFaitChiffre(recrutement)).toBe(false);
  });

  it("(1) completerFiche : barres sans fait posées à 100 et 20, sans faitId, notées, aucun refus", () => {
    const c = completerFiche(reponseType(lt02), { ...FIXE, cas: lt02 });
    expect(c.refus).toEqual([]);
    const r = (c.brute as { ecrans: any[] }).ecrans.find((e) => e.type === "resultat");
    expect(r.avant.valeur).toBe(HAUTEURS_BARRES_SANS_FAIT.avant);
    expect(r.maintenant.valeur).toBe(HAUTEURS_BARRES_SANS_FAIT.maintenant);
    expect([r.avant.valeur, r.maintenant.valeur]).toEqual([100, 20]);
    expect("faitId" in r.avant).toBe(false);
    expect("faitId" in r.maintenant).toBe(false);
    expect(c.notes.some((n) => n.includes("dessinée sans nombre"))).toBe(true);
  });

  it("(2) un cas qui a des faits chiffrés : la barre sans faitId ni valeur reste refusée", () => {
    const f = structuredClone(ficheParGabarit(recrutement, FIXE)) as any;
    for (const e of f.ecrans) if (e.type === "resultat") { e.avant = { libelle: "Avant" }; e.maintenant = { libelle: "Maintenant" }; }
    const c = completerFiche(f, { ...FIXE, cas: recrutement });
    expect(c.refus.some((m) => m.includes("ne désigne aucun fait : donnez « faitId »"))).toBe(true);
  });

  it("(3) sans fait chiffré, une barre qui désigne un fait est refusée avec une explication claire", () => {
    const rep = reponseType(lt02) as any;
    for (const e of rep.ecrans) if (e.type === "resultat") e.avant = { libelle: "Avant", faitId: "poids-manquant" };
    const c = completerFiche(rep, { ...FIXE, cas: lt02 });
    expect(c.refus.some((m) => m.includes("le cas n'a aucun fait chiffré"))).toBe(true);
  });

  it("(4) bout en bout : une réponse en un seul appel, R04 respectée, aucun nombre à l'écran", async () => {
    const entree: EntreeEcriture = { ...FIXE, cas: lt02 };
    const d = double([reponseType(lt02)]);
    const r = await ecrireFiche(entree, d);
    if (!r.ok) throw new Error(`refus : ${JSON.stringify(r.refus)} ${r.message}`);
    expect(r.appels).toBe(1);
    expect(regleOrdre(r.fiche, { cas: lt02, texteScript: texteDuCorps(r.fiche) })).toEqual([]);
    expect(validerFicheEcrans(r.fiche, { cas: lt02, texteScript: texteDuCorps(r.fiche) }).ok).toBe(true);
    const res = r.fiche.ecrans.find((e) => e.type === "resultat") as Extract<EcranCorps, { type: "resultat" }>;
    const c = contenuEcran(res, null, {}, lt02.faits);
    expect(c).toMatchObject({ type: "resultat", avant: res.avant.libelle, maintenant: res.maintenant.libelle });
    const p = proprietesEcrans({ ecrans: ecransCales([{ ...res, debutMs: 0, finMs: 3000 } as EcranCorps], [], null, {}, lt02.faits), captures: {}, zoneProtegee: ZONE, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET })[0];
    expect(controlerProprietes(p)).toEqual([]);
    expect(Object.values(textesEcran(p)).join(" "), JSON.stringify(textesEcran(p))).not.toMatch(/\d/);
  });

  it("(5) relance : une première réponse PREUVE_MANQUANTE est refusée, la seconde aboutit en 2 appels", async () => {
    const d = double(["PREUVE_MANQUANTE : la fiche ne peut pas être corrigée car <faits> est vide.", reponseType(lt02)]);
    const r = await ecrireFiche({ ...FIXE, cas: lt02 }, d);
    if (!r.ok) throw new Error(`refus : ${JSON.stringify(r.refus)} ${r.message}`);
    expect(r.appels).toBe(2);
    expect(d.appels[1].variable).toContain("n'est pas un JSON lisible");
  });

  it("(6) chacun des cas du stock : la réponse type passe le jugement de la fiche", () => {
    expect(CAS_STOCK.length).toBeGreaterThan(0);
    const refuses: string[] = [];
    for (const c of CAS_STOCK) {
      const j = jugerFiche(reponseType(c), { ...FIXE, cas: c });
      if (!j.ok) refuses.push(`${c.id} : ${j.refus.join(" | ").slice(0, 300)}`);
    }
    expect(refuses, refuses.join("\n")).toEqual([]);
  });

  it("(7) la variable du premier appel ne demande pas « le fait chiffré principal du cas en tête »", async () => {
    const d = double([reponseType(lt02)]);
    await ecrireFiche({ ...FIXE, cas: lt02 }, d);
    expect(d.appels[0].variable).not.toContain("le fait chiffré principal du cas en tête");
  });
});
