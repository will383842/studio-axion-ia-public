/** Lot E · remarques de ciblage du contrôle final du cas concret : jamais bloquantes. */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import { controlerCiblageCasConcret } from "@/moteurs/montage-cas-concret/controles";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { ficheVideo1 } from "../cas-concret/regles/outils";

void TABLE_FINS_DIAGNOSTIC;
void recrutementApporteurs;

function ficheDit(...phrases: string[]): FicheEcrans {
  const f = ficheVideo1();
  return { ...f, ecrans: f.ecrans.map((e, i) => ({ ...e, texteDit: phrases[i] ?? e.texteDit })) as FicheEcrans["ecrans"] };
}
const metier = (libelle: string) => ({ niveau: "metier" as const, libelle, origine: "saisie" as const });

describe("cas concret · ciblage", () => {
  it("entrée sans ciblage (appel existant) : aucune ligne", () => {
    expect(controlerCiblageCasConcret(ficheDit("Bonjour."), undefined)).toEqual([]);
  });
  it("cible nommée dans les 5 premières secondes et bénéfice clair : aucune remarque", () => {
    const l = controlerCiblageCasConcret(ficheDit("Recruteur, gagnez 3 heures par semaine sur les candidatures."), metier("recruteur"));
    expect(l).toEqual([]);
  });
  it("cible absente du début : remarque non bloquante, en français, sans code", () => {
    const l = controlerCiblageCasConcret(ficheDit("Voici comment gagner 3 heures par semaine sur vos dossiers."), metier("recruteur"));
    expect(l).toHaveLength(1);
    expect(l[0].bloquant).toBe(false);
    expect(l[0].etat).toBe("echoue");
    expect(l[0].raison).toContain("recruteur");
    expect(l[0].raison + l[0].libelle).not.toMatch(/C1\d\d|undefined|null/);
  });
  it("aucun bénéfice clair : remarque non bloquante", () => {
    const l = controlerCiblageCasConcret(ficheDit("Recruteur, voici une histoire."), metier("recruteur"));
    expect(l.some((x) => /bénéfice/i.test(x.libelle) && !x.bloquant)).toBe(true);
  });
  it("aucune cible déclarée (null) : une remarque, jamais un blocage", () => {
    const l = controlerCiblageCasConcret(ficheDit("Gagnez 3 heures par semaine."), null);
    expect(l).toHaveLength(1);
    expect(l[0].bloquant).toBe(false);
  });
  it("pluriel et élision ne font pas de fausse alerte", () => {
    expect(controlerCiblageCasConcret(ficheDit("Recruteurs, gagnez 3 heures par semaine."), metier("recruteur"))).toEqual([]);
  });
});
