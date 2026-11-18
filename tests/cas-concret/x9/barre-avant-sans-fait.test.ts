/**
 * FIX-CC-RESULTAT-SANS-NOMBRE · (essai réel 17/11, vidéo v-fe27e3b8e5ba) la barre « avant » peut être { libelle } seul quand
 * l'autre barre désigne un fait DU CAS sans nombre ; la garde « nombres des faits » reste intacte ; « Écran coupé en deux »
 * sans carte vide. Doubles seulement : aucun appel réel, aucun rendu.
 */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { completerFiche, HAUTEURS_BARRES_SANS_FAIT } from "@/moteurs/montage-cas-concret/champs-du-cas";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import { CONSIGNE_ECRITURE, dureesDesFins, ficheParGabarit, roleEcritureCasConcret } from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { texteDuCorps, validerSchemaFiche } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import { proprietesEcrans, type EcranCale, type ProprietesEcran } from "@/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";
import { exemplesEcrans } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { cadre, debordements } from "../../../studio-rendu/compositions/cas-concret/mises-en-page/geo";

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
const completer = (avant: Barre, maintenant: Barre) => completerFiche(fiche(avant, maintenant), { ...FIXE, cas });
const REFUS_SANS_FAIT = "ne désigne aucun fait : donnez « faitId »";

describe("FIX-CC-RESULTAT-SANS-NOMBRE", () => {
  it("(a) « avant » { libelle } seul + « maintenant » → fait sans nombre : accepté, hauteurs par défaut, note, écran sans chiffre", () => {
    const c = completer({ libelle: "Ressaisie manuelle" }, { libelle: "Fiche déjà créée", faitId: "transmission-rapide" });
    expect(c.refus).toEqual([]);
    const r = resultat(c.brute);
    expect("faitId" in r.avant).toBe(false);
    expect("faitId" in r.maintenant).toBe(false);
    expect(r.avant.valeur).toBe(HAUTEURS_BARRES_SANS_FAIT.avant);
    expect(r.avant.valeur).toBe(100);
    expect(r.maintenant.valeur).toBe(HAUTEURS_BARRES_SANS_FAIT.maintenant);
    expect(r.maintenant.valeur).toBe(20);
    expect(c.notes.some((n) => n.includes("la barre « avant » ne désigne aucun fait") && n.includes("l'autre barre est sans nombre") && n.includes("son libellé seul"))).toBe(true);
    const schema = validerSchemaFiche(c.brute);
    expect(schema.ok).toBe(true);
    if (schema.ok) {
      const v = validerFicheEcrans(c.brute, { cas, texteScript: texteDuCorps(schema.fiche), fins: plan.fins, motsInterdits: [] });
      expect(v.ok).toBe(true);
    }
  });

  it("(a bis) donnée lue par l'écran : « avant » garde son libellé, sans faitId ni nombre (texteBarre vide sans fait)", () => {
    const c = completer({ libelle: "Ressaisie manuelle" }, { libelle: "Fiche déjà créée", faitId: "transmission-rapide" });
    const avant = resultat(c.brute).avant;
    expect(avant.libelle).toBe("Ressaisie manuelle");
    expect("faitId" in avant).toBe(false);
    expect(JSON.stringify(avant)).not.toMatch(/\d{3,}\s*(min|h|%)/i);
  });

  it("(b) barres inversées : « maintenant » { libelle } seul + « avant » → fait sans nombre : accepté de même", () => {
    const c = completer({ libelle: "Ressaisie manuelle", faitId: "transmission-rapide" }, { libelle: "Fiche déjà créée" });
    expect(c.refus).toEqual([]);
    const r = resultat(c.brute);
    expect("faitId" in r.avant).toBe(false);
    expect(r.avant.valeur).toBe(100);
    expect("faitId" in r.maintenant).toBe(false);
    expect(r.maintenant.valeur).toBe(20);
    expect(c.notes.some((n) => n.includes("la barre « maintenant » ne désigne aucun fait"))).toBe(true);
  });

  it("(c) GARDE INTACTE : deux { libelle } seuls, ou { libelle } seul à côté d'une barre CHIFFRÉE, ou « chiffre » sur un fait sans nombre : toujours refusés", () => {
    expect(completer({ libelle: "Avant" }, { libelle: "Maintenant" }).refus.some((m) => m.includes(REFUS_SANS_FAIT))).toBe(true);
    expect(completer({ libelle: "Avant" }, { libelle: "Maintenant", faitId: "balayage-dix-minutes" }).refus.some((m) => m.includes(REFUS_SANS_FAIT))).toBe(true);
    expect(completer({ libelle: "Avant", faitId: "balayage-dix-minutes" }, { libelle: "Maintenant" }).refus.some((m) => m.includes(REFUS_SANS_FAIT))).toBe(true);
    const f = fiche({ libelle: "A", faitId: "balayage-dix-minutes" }, { libelle: "B", faitId: "balayage-dix-minutes" });
    const ch = f.ecrans.find((e) => e.type === "chiffre");
    if (ch) {
      ch.faitId = "transmission-rapide";
      expect(completerFiche(f, { ...FIXE, cas }).refus.some((m) => m.includes("qui ne porte aucun nombre"))).toBe(true);
    }
  });

  it("(d) la consigne dit le sens de « avant » ; le rôle passe en version 5", () => {
    expect(CONSIGNE_ECRITURE).toContain("La barre « avant » dit l'état AVANT l'automatisation");
    expect(roleEcritureCasConcret.version).toBe(5);
  });
});

describe("FIX-CC-RESULTAT-SANS-NOMBRE · res-coupe-deux sans carte vide", () => {
  // Chemin CALCULÉ : le tsc racine ne doit pas suivre un fichier de studio-rendu (PIEGE-REMOTION-TSC.md).
  const chemin = ["..", "..", "..", "studio-rendu", "compositions", "cas-concret", "mises-en-page", "dispositions"].join("/");
  type Dispo = { textes: Array<{ nom: string; boite: { x: number; largeur: number } }>; formes: Array<{ nom: string }>; coupe: number };
  type Module = { disposition: (code: string, p: ProprietesEcran) => Dispo };
  const formats = [{ nom: "9:16", largeur: 1080, hauteur: 1920 }, { nom: "16:9", largeur: 1920, hauteur: 1080 }, { nom: "1:1", largeur: 1080, hauteur: 1080 }];
  for (const f of formats) {
    it(`${f.nom} : aucune forme « carte-avant », « avant » commence à c.x, aucun débordement (libellés de 3 mots)`, async () => {
      const { disposition } = (await import(/* @vite-ignore */ chemin)) as Module;
      const ecrans = exemplesEcrans().map((p) => {
        const { zone: _z, dessin: _d, largeur: _l, hauteur: _h, fps: _f, marque: _m, ...reste } = p;
        void [_z, _d, _l, _h, _f, _m];
        return (p.type === "resultat" ? { ...reste, avant: "Ressaisie manuelle", maintenant: "Fiche déjà créée" } : reste) as unknown as EcranCale;
      });
      const p = proprietesEcrans({ ecrans, captures: {}, zoneProtegee: { ...ZONE_PLEINE_IMAGE_CAS_CONCRET }, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET, largeur: f.largeur, hauteur: f.hauteur }).find((x) => x.type === "resultat")!;
      const d = disposition("res-coupe-deux", p);
      const c = cadre(p);
      expect(d.formes.some((x) => x.nom === "carte-avant")).toBe(false);
      expect(d.formes).toEqual([]);
      expect(d.textes.find((t) => t.nom === "avant")!.boite.x).toBe(c.x);
      expect(debordements(d as never, c)).toEqual([]);
    });
  }
});
