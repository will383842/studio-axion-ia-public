/**
 * FIX-ISOLATION-PLAN : les valeurs déplacées vers des modules neutres (hors src/fournisseurs) sont strictement
 * identiques par l'ancien et le nouveau chemin d'import, et il n'y a qu'une seule source.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODELE_JUGE as juge_neutre } from "@/domaine/modeles-texte";
import { MODELE_JUGE as juge_ancien, MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { motsInterditsEnvoi as envoi_neutre, motsInterditsEnvoiZernio as zernio_neutre } from "@/domaine/mots-interdits-envoi";
import { motsInterditsEnvoi as envoi_ancien, motsInterditsEnvoiZernio as zernio_ancien } from "@/fournisseurs/publication/mots-interdits-envoi";

const J = (...p: string[]) => p.join("");

describe("valeurs identiques par l'ancien et le nouveau chemin", () => {
  it("MODELE_JUGE : même nom de modèle, valeur d'origine", () => {
    expect(juge_ancien).toBe(juge_neutre);
    expect(juge_neutre).toBe("claude-sonnet-5-5");
    expect(MODELE_ECRITURE).toBe("claude-opus-5-5");
  });
  it("mots interdits à l'envoi : mêmes fonctions (références identiques), mêmes résultats et même ordre", () => {
    expect(envoi_ancien).toBe(envoi_neutre);
    expect(zernio_ancien).toBe(zernio_neutre);
    const texte = `${J("Cert", "ifié")} ${J("quali", "opi")} ${J("Gre", "noble")} ${J("aucun gain ", "garanti")}`;
    expect(envoi_ancien(texte)).toEqual([J("cert", "ifié"), J("Quali", "opi")]);
    expect(zernio_ancien(texte)).toEqual([J("cert", "ifié"), J("Quali", "opi"), J("Gre", "noble"), J("Aucun gain ", "garanti")]);
    expect(zernio_ancien(J("cert", "ificat"))).toEqual([]);
  });
  it("une seule source : les anciens fichiers ne font que réexporter", () => {
    const tarifs = readFileSync("src/fournisseurs/claude/tarifs.ts", "utf8");
    expect(tarifs).not.toMatch(/MODELE_JUGE\s*=/);
    const envoi = readFileSync("src/fournisseurs/publication/mots-interdits-envoi.ts", "utf8");
    expect(envoi).not.toMatch(/RACINES|function /);
  });
});
