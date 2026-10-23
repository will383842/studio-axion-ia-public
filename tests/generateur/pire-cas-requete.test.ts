/**
 * PIRE CAS EXACT (règle B.3.4 : jamais sous-estimé). Depuis #254 les rôles envoient leur schéma JSON dans la consigne
 * (<schema_sortie>) et le socle de Will est mis en cache 1 h (écriture = 2 × l'entrée). `pireCasRequete` compte la
 * requête RÉELLEMENT envoyée ; aucune estimation ne doit passer sous lui.
 */
import { describe, expect, it } from "vitest";
import { jetonsEstimes, tarifDe } from "@/fournisseurs/claude/tarifs";
import { ROLES_CHAINE_COURTE } from "@/generateur/chaine-courte";
import { ROLES_ECRITURE } from "@/generateur/roles";
import { construireRequete, pireCasRequete, pireCasRole, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { coutEstimeUsd as coutImageVideo, roleEcritureImageVideo } from "@/moteurs/montage-image-video/ecriture";
import { roleDecoupageTableau } from "@/moteurs/montage-tableau/decoupage";
import { roleEcritureCasConcret } from "@/moteurs/montage-cas-concret/ecriture";

const ENTREE: EntreeRole = {
  contexte: {
    contexteAxion: "Charte de la marque. ".repeat(200),
    styleWill: "Style de Will. ".repeat(120),
    preuves: "Preuve chiffrée numéro un. ".repeat(80),
    gagnants: "Modèle de ton gagnant. ".repeat(60),
    recette: "Recette du format. ".repeat(90),
  },
  variable: "Brief du sujet et ancrage. ".repeat(100),
};

/** Coût maximal RÉEL de la requête construite : socle (jusqu'au point 1 h) à 2 × l'entrée, le reste à 1,25 ×, sortie = max_tokens. */
function coutMaximalReel(role: DefinitionRole, entree: EntreeRole): number {
  const r = construireRequete(role, entree);
  const t = tarifDe(role.modele);
  const fin = r.systeme.findIndex((b) => b.cache === "1h");
  const socle = fin >= 0 ? jetonsEstimes(r.systeme.slice(0, fin + 1).map((b) => b.texte).join("\n")) : 0;
  const total = jetonsEstimes([...r.systeme.map((b) => b.texte), ...r.messages.map((m) => m.contenu)].join("\n"));
  const reste = Math.max(0, total - socle);
  return (socle * t.cacheEcrit1h + reste * Math.max(t.entree, t.cacheEcrit) + r.maxTokens * t.sortie) / 1_000_000;
}

const ROLES: DefinitionRole[] = [
  ...Object.values(ROLES_ECRITURE),
  ...Object.values(ROLES_CHAINE_COURTE),
  roleDecoupageTableau,
  roleEcritureCasConcret,
  roleEcritureImageVideo,
] as DefinitionRole[];

describe("pireCasRequete : la requête réellement envoyée", () => {
  it("le schéma de sortie et le socle 1 h sont bien dans la requête", () => {
    const r = construireRequete(ROLES_CHAINE_COURTE.script as DefinitionRole, ENTREE);
    expect(r.systeme.some((b) => b.cache === "1h")).toBe(true);
    expect(r.systeme.some((b) => b.texte.includes("<schema_sortie>"))).toBe(true);
  });

  for (const role of ROLES) {
    it(`${role.id} : pireCasRequete ≥ coût maximal réel`, () => {
      expect(pireCasRequete(role, ENTREE)).toBeGreaterThanOrEqual(coutMaximalReel(role, ENTREE) - 1e-12);
      expect(pireCasRole(role, ENTREE)).toBe(pireCasRequete(role, ENTREE));
    });
  }

  it("image→vidéo : l'estimation de réservation n'est jamais sous le pire cas de la requête", () => {
    const role = roleEcritureImageVideo as DefinitionRole;
    expect(coutImageVideo(role, ENTREE)).toBeGreaterThanOrEqual(pireCasRequete(role, ENTREE) - 1e-12);
  });
});
