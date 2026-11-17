/**
 * RELECTURE DES CHIFFRES d'un tableau de bord (G4-08a) — règle pure : chaque chiffre est validé, corrigé ou refusé.
 * Vaut pour tout `tableau-de-bord.v1`. Aucun appel, aucun fournisseur, aucun Claude : rien ne l'allume.
 * Dossier réservé au Studio : seul `RelectureChiffres.tsx` l'importe.
 */
import { lireTableauDeBord, type TableauDeBord } from "./types";

export type ChiffreARelire = { cle: string; libelle: string; valeur: number; unite: string };
export type DecisionChiffre = { type: "valide" } | { type: "corrige"; valeur: number } | { type: "refuse" };
export type ResultatRelecture = { ok: true; donnee: TableauDeBord } | { ok: false; raisons: string[] };

/** Tous les nombres montrables, dans l'ordre du tableau : indicateurs, points des séries, calculs. */
export function chiffresARelire(d: TableauDeBord): ChiffreARelire[] {
  const liste: ChiffreARelire[] = [];
  for (const i of d.indicateurs) liste.push({ cle: `indicateur:${i.id}`, libelle: i.libelle, valeur: i.valeur, unite: i.unite });
  for (const s of d.series) {
    s.points.forEach((p, n) => liste.push({ cle: `point:${s.id}:${n}`, libelle: `${s.libelle} · ${p.x}`, valeur: p.valeur, unite: s.unite }));
  }
  for (const c of d.calculs) liste.push({ cle: `calcul:${c.id}`, libelle: c.formule, valeur: c.resultat, unite: "" });
  return liste;
}

/** Applique les décisions sur une copie. Ne lève jamais ; l'entrée n'est jamais modifiée. */
export function appliquerRelecture(d: TableauDeBord, decisions: Record<string, DecisionChiffre>): ResultatRelecture {
  try {
    const copie = structuredClone(d);
    const chiffres = chiffresARelire(copie);
    const manquants = chiffres.filter((c) => !decisions?.[c.cle]).length;
    if (manquants > 0) {
      return { ok: false, raisons: [manquants === 1 ? "1 chiffre n'est pas encore relu." : `${manquants} chiffres ne sont pas encore relus.`] };
    }
    const raisons: string[] = [];
    for (const c of chiffres) {
      const dec = decisions[c.cle];
      if (dec.type === "corrige" && !(typeof dec.valeur === "number" && Number.isFinite(dec.valeur))) raisons.push(`La correction de « ${c.libelle} » n'est pas un nombre.`);
      else if (dec.type !== "valide" && dec.type !== "corrige" && dec.type !== "refuse") raisons.push(`La décision pour « ${c.libelle} » est inconnue.`);
    }
    if (raisons.length) return { ok: false, raisons };

    const refus = (cle: string) => decisions[cle].type === "refuse";
    const valeurApres = (cle: string, valeur: number) => {
      const dec = decisions[cle];
      return dec.type === "corrige" ? dec.valeur : valeur;
    };

    const retires = new Set<string>();
    const indicateurs = [];
    for (const i of copie.indicateurs) {
      if (refus(`indicateur:${i.id}`)) retires.add(i.id);
      else indicateurs.push({ ...i, valeur: valeurApres(`indicateur:${i.id}`, i.valeur) });
    }
    const series = [];
    for (const s of copie.series) {
      const points = s.points.flatMap((p, n) => (refus(`point:${s.id}:${n}`) ? [] : [{ ...p, valeur: valeurApres(`point:${s.id}:${n}`, p.valeur) }]));
      if (points.length >= 2) series.push({ ...s, points });
    }
    const cite = (formule: string) => formule.split(/\s+/).some((mot) => retires.has(mot));
    const calculs = copie.calculs.filter((c) => !refus(`calcul:${c.id}`) && !cite(c.formule)).map((c) => ({ ...c, resultat: valeurApres(`calcul:${c.id}`, c.resultat) }));
    const suite = {
      ...copie,
      indicateurs,
      series,
      comparaisons: copie.comparaisons.filter((c) => !retires.has(c.avant) && !retires.has(c.apres)),
      alertes: copie.alertes.filter((a) => !retires.has(a.indicateurId)),
      calculs,
    };
    if (suite.indicateurs.length === 0 && suite.series.length === 0) return { ok: false, raisons: ["Plus aucun chiffre à montrer."] };
    const lu = lireTableauDeBord(suite);
    return lu.ok ? { ok: true, donnee: lu.donnee } : { ok: false, raisons: lu.erreurs };
  } catch {
    return { ok: false, raisons: ["Relecture impossible."] };
  }
}
