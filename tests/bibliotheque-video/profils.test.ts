import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listerFormats } from "@/formats";
import { CATALOGUE_CAPACITES, ID, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import type { IdCapacite, ProfilVideo } from "@/briques/bibliotheque-video/types";
import {
  EXTRAITS_PAR_DEFAUT, FORMATS_PROFIL_NEUTRE, PROFILS_DU_CODE, profilDuFormat, profilNeutre,
} from "@/briques/bibliotheque-video/profils";

const TOUS: ProfilVideo[] = [...Object.values(PROFILS_DU_CODE), profilNeutre("podcast")];
const regles = (p: ProfilVideo) => Object.entries(p.capacites) as [IdCapacite, { permis: boolean }][];

describe("profils par format (C1-U3)", () => {
  it("couverture : chaque format est profilé ou listé neutre, jamais les deux (A1-6)", () => {
    const formats = listerFormats({ inclureMasques: true, inclureReservesAWill: true }).map((f) => f.id).sort();
    const profiles = Object.keys(PROFILS_DU_CODE);
    expect(profiles.filter((f) => FORMATS_PROFIL_NEUTRE.includes(f))).toEqual([]);
    expect([...profiles, ...FORMATS_PROFIL_NEUTRE].sort()).toEqual(formats);
    expect(profiles).toHaveLength(8);
  });

  it("rien de neuf permis : permis => prod ; ni coulisse ni absent inscrit (§ 3.4)", () => {
    for (const p of TOUS) for (const [id, r] of regles(p)) {
      const etat = etatCapacite(id);
      // ALLUMER-OBJETS-TABLEAU-v20g : seules les 3 capacités objet du tableau animé sont permises à l'état « prevu » (décision Williams 20/11).
      const objetTableau = p.id === "tableau-anime/1" && ["objet.chiffre", "objet.etape", "objet.marque"].includes(id);
      if (r.permis) expect(etat, `${p.id} ${id}`).toBe(objetTableau ? "prevu" : "prod");
      expect(["coulisse", "absent"], `${p.id} ${id}`).not.toContain(etat);
    }
  });

  it("chaque identifiant inscrit existe au catalogue", () => {
    const ids = new Set<string>(CATALOGUE_CAPACITES.map((l) => l.id));
    for (const p of TOUS) for (const [id] of regles(p)) expect(ids.has(id), `${p.id} ${id}`).toBe(true);
  });

  it("facecam-animee : aucune etalonnage.*, verrou etalonnage, extraits par défaut", () => {
    const p = PROFILS_DU_CODE["facecam-animee"];
    expect(Object.keys(p.capacites).some((k) => k.startsWith("etalonnage."))).toBe(false);
    expect(p.verrous).toContain("etalonnage");
    expect(p.blocs?.extraits).toEqual(EXTRAITS_PAR_DEFAUT);
  });

  it("chaque profil porte le verrou du texte derrière la tête", () => {
    for (const p of TOUS) expect(p.verrous).toContain(ID.calqueTexteDerriereDouble);
  });

  it("texteEcran : tout fermé", () => {
    for (const p of TOUS) {
      const t = p.blocs?.texteEcran;
      if (!t) continue;
      expect([t.pave, t.outils, t.bandeauNom]).toEqual([false, false, false]);
      expect(t.signaturesAEviter).toBe(3);
    }
    expect(Object.keys(PROFILS_DU_CODE).filter((k) => PROFILS_DU_CODE[k].blocs?.texteEcran).sort())
      .toEqual(["avocat", "cas-concret", "facecam", "image-video", "tableau-anime"]);
  });

  it("profilDuFormat ne lève jamais ; neutre sans capacité", () => {
    expect(profilDuFormat("inconnu")).toEqual(profilNeutre("inconnu"));
    expect(profilDuFormat("podcast").capacites).toEqual({});
    expect(profilDuFormat("avocat").id).toBe("avocat/1");
  });

  it("EXTRAITS_PAR_DEFAUT", () => {
    expect(EXTRAITS_PAR_DEFAUT).toEqual({ visageSurInstagram: true, texteIncrusteAccepte: {}, dureeMinSec: 3, uneSourceParVideo: true });
  });

  it("objets figés et appels identiques", () => {
    expect(Object.isFrozen(EXTRAITS_PAR_DEFAUT)).toBe(true);
    for (const p of [...Object.values(PROFILS_DU_CODE), profilNeutre("x")]) {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.capacites)).toBe(true);
      expect(Object.isFrozen(p.verrous)).toBe(true);
    }
    expect(profilDuFormat("avocat")).toEqual(profilDuFormat("avocat"));
  });

  it("garde statique : modules purs", () => {
    const dir = join(process.cwd(), "src/briques/bibliotheque-video/profils");
    const interdit = [/@\/services\//, /@\/formats/, /studio-rendu/, /credits|budget-mensuel|mode-budget|autonomie-usine|couts|cle-depense-usine|depense-claude|generation-claude/, /\bDate\b/, /Math\.random/];
    const fichiers = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(fichiers.length).toBeGreaterThanOrEqual(8);
    for (const f of fichiers) {
      const src = readFileSync(join(dir, f), "utf8");
      const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*from\b/.test(l)).join("\n");
      for (const re of interdit.slice(0, 4)) expect(imports, `${f} ${re}`).not.toMatch(re);
      const code = src.split("\n").filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join("\n");
      for (const re of interdit.slice(4)) expect(code, `${f} ${re}`).not.toMatch(re);
    }
  });
});
