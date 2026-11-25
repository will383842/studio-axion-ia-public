/**
 * S-13-f-v21o : l'option « prête, avec remarques » (`preteAvecRemarques: true`) branchée dans la fabrication de l'image
 * vers vidéo. Option absente, ou tout autre valeur que `true` exact : refus `IV_CONTROLES` identique à master. `true` :
 * un refus dont tous les blocages sont reclassables livre la vidéo, avec une alerte « bloquant » préfixée que la carte
 * Qualité lit comme une remarque. La porte (écoutes, relectures) est payée AVANT le reclassement : mêmes réservations.
 * Outils simulés (doubles), aucun appel réel, aucun fournisseur.
 */
import { describe, expect, it, vi } from "vitest";
import { estPreteAvecRemarques, PREFIXE_REMARQUE_LIVRAISON } from "@/domaine/livraison-avec-remarques";
import { avancerJusquAArretIV, attendWillIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { resultatDe, travailVitrineIV } from "@/moteurs/montage-image-video/index";
import type { RelectureFinale } from "@/moteurs/montage-image-video/relecture-finale";
import { carteFixe, demandeEssai, monde, outilsSimules, type Monde } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 180_000 });

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") {
      const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
    } else break;
  }
  return e;
}

type Faute = "illisible" | "chiffre-faux" | "volume";
/**
 * Faute posée sur TOUTES les versions. `illisible` et `chiffre-faux` sont vues par la relecture des images finales (Q26),
 * donc APRÈS l'écoute et la relecture payées : refus tardif `IV_CONTROLES`. `illisible` (« rien n'est lisible » sur chaque
 * image) n'est pas dans la liste fermée : reclassable. `chiffre-faux` reste bloquant. `volume` (Q24 au-delà du plancher)
 * refuse AVANT l'écoute : les contrôles d'écoute sortent « non-fait », jamais reclassés (piège de fond de la fiche).
 */
function avecFaute(o: OutilsFabricationIV, faute: Faute): OutilsFabricationIV {
  if (faute === "volume") return { ...o, rendre: async (d) => { const r = await o.rendre(d); return { ...r, mesures: { ...r.mesures!, lufs: -30 } }; } };
  const appeler: OutilsFabricationIV["controles"]["appeler"] = async (role, entree) => {
    const r = await o.controles.appeler(role, entree);
    if (role.id !== "relecture-finale-iv" || !r.ok) return r;
    const d = r.donnees as RelectureFinale;
    const images = d.images.map((x) => (faute === "illisible" ? { ...x, illisible: "rien n'est lisible" } : { ...x, faux: "45 % au lieu de 54 %" }));
    return { ...r, donnees: { ...d, images } } as typeof r;
  };
  return { ...o, controles: { ...o.controles, appeler } };
}

async function fabriquer(faute: Faute, option?: unknown): Promise<{ e: EtatFabricationIV; m: Monde }> {
  const carte = carteFixe("C");
  const m = monde();
  const base = avecFaute(outilsSimules(carte, m), faute);
  const o = (option === undefined ? base : { ...base, preteAvecRemarques: option }) as OutilsFabricationIV;
  return { e: await jusquAuBout(etatInitialIV(demandeEssai(carte)), o), m };
}

/** Ce qui doit être identique à master (l'option absente) : état final hors horloge, refus, réservations, dépenses soumises. */
const empreinte = ({ e, m }: { e: EtatFabricationIV; m: Monde }) => ({ etape: e.etape, refus: e.refus, livraison: e.livraison, controles: e.controles, reservations: e.caisse.reservations, journal: e.journal, depenses: m.depenses, ordre: m.ordre });

describe("option absente ou autre que `true` : refus identique à master", () => {
  let reference: ReturnType<typeof empreinte>;
  it("option absente : refus IV_CONTROLES tardif, définitif, sans livraison", async () => {
    const r = await fabriquer("illisible");
    expect(r.e.etape).toBe("refusee");
    expect(r.e.refus).toMatchObject({ etape: "controles", code: "IV_CONTROLES", reessayable: false });
    expect(r.e.livraison).toBeUndefined();
    // Le refus vient bien APRÈS la porte payée (écoutes et relecture faites).
    expect(Object.keys(r.e.controles?.transcriptions ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(r.e.controles?.relectures ?? {}).length).toBeGreaterThan(0);
    expect(r.m.appelsClaude.some((x) => x.role === "relecture-finale-iv")).toBe(true);
    expect(r.e.controles!.verdict!.mentions.some((x) => x.startsWith(PREFIXE_REMARQUE_LIVRAISON))).toBe(false);
    reference = empreinte(r);
  });
  it.each([["la chaîne \"true\"", "true"], ["1", 1], ["{}", {}], ["false", false]])("option = %s : état toEqual option absente", async (_nom, valeur) => {
    const r = await fabriquer("illisible", valeur);
    expect(empreinte(r)).toEqual(reference);
  });
  it("vitrine : travail en échec (le service libère la réservation, chemin d'avant)", async () => {
    const { e } = await fabriquer("illisible");
    const t = travailVitrineIV({ travailId: "t-1", versionId: "v-1", titre: "essai", maintenant: Date.parse("2026-10-15T08:00:00.000Z") }, { formatId: "image-video" } as never, e);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe("IV_CONTROLES");
  });
});

describe("`true` exact : prête, avec remarques", () => {
  it("refus reclassable : vidéo prête, livrée, alerte « bloquant » préfixée lue par estPreteAvecRemarques", async () => {
    const r = await fabriquer("illisible", true);
    expect(r.e.etape).toBe("prete");
    expect(r.e.refus).toBeUndefined();
    expect((r.e.livraison ?? []).filter((l) => l.fichierCle).length).toBeGreaterThan(0);
    const remarques = r.e.controles!.verdict!.mentions.filter((x) => x.startsWith(PREFIXE_REMARQUE_LIVRAISON));
    expect(remarques.length).toBeGreaterThan(0);
    for (const x of remarques) expect(x).toMatch(/illisible/);
    const res = resultatDe(r.e, Date.parse("2026-10-15T08:00:00.000Z"));
    const note = res.sorties[0]!.rapportQualite;
    const bloquants = note.alertes.filter((a) => a.gravite === "bloquant");
    expect(bloquants.map((a) => a.message)).toEqual(remarques);
    expect(estPreteAvecRemarques({ statut: "prete", noteQualite: note } as never)).toBe(true);
    const t = travailVitrineIV({ travailId: "t-1", versionId: "v-1", titre: "essai", maintenant: Date.parse("2026-10-15T08:00:00.000Z") }, { formatId: "image-video" } as never, r.e);
    expect(t.statut).toBe("termine");
  });
  it("même dépense que le refus : réservations et appels identiques, chacun UNE fois (porte payée avant le reclassement)", async () => {
    const sans = await fabriquer("illisible");
    const avec = await fabriquer("illisible", true);
    expect(avec.e.caisse.reservations).toEqual(sans.e.caisse.reservations);
    expect(avec.m.depenses).toEqual(sans.m.depenses);
    expect(avec.m.ordre).toEqual(sans.m.ordre);
    const cles = avec.e.caisse.reservations.map((x) => x.cle);
    expect(new Set(cles).size).toBe(cles.length);
    expect(avec.e.caisse.reservations.length).toBeGreaterThan(0);
  });
  it("une faute tardive qui reste bloquante (chiffre faux vu à l'image) : refus identique à l'option absente", async () => {
    const sans = await fabriquer("chiffre-faux");
    const avec = await fabriquer("chiffre-faux", true);
    expect(sans.e.refus).toMatchObject({ code: "IV_CONTROLES" });
    expect(empreinte(avec)).toEqual(empreinte(sans));
  });
  it("une faute vue AVANT l'écoute (écoute « non-fait ») : refus identique à l'option absente", async () => {
    const sans = await fabriquer("volume");
    const avec = await fabriquer("volume", true);
    expect(sans.e.refus).toMatchObject({ code: "IV_CONTROLES" });
    expect(sans.e.refus!.phrases!.some((x) => /non vérifié/.test(x))).toBe(true);
    expect(empreinte(avec)).toEqual(empreinte(sans));
  });
});

describe("option absente : aucune alerte « bloquant » dans le résultat (moteur.test.ts fige les gravités)", () => {
  it("une vidéo prête sans option ne porte aucune alerte bloquante", async () => {
    const carte = carteFixe("C");
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), outilsSimules(carte, monde()));
    expect(e.etape).toBe("prete");
    const res = resultatDe(e, Date.parse("2026-10-15T08:00:00.000Z"));
    expect(res.sorties[0]!.rapportQualite.alertes.some((a) => a.gravite === "bloquant")).toBe(false);
  });
});
