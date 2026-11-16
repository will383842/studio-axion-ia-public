/**
 * MANIFESTE DES LOGOS D'OUTILS (C8-L01) — côté Studio seulement. Vide : rien n'est allumé.
 * Logos CLIENTS : hors chantier (nature « outil » seule acceptée).
 */
import type { StatutLogo } from "./types";

export interface EntreeLogoOutil {
  id: string;
  nature: "outil";
  outil: string;
  source: string;
  adresse: string;
  adresseCharte: string;
  dateRecuperation: string;
  versionSource: string;
  licenceFichier: string;
  reglesCharte: string;
  charte: Record<string, unknown>;
  preuve: string;
  empreinteSha256: string;
  risque: string;
  statut: StatutLogo;
  validePar?: string;
  dateValidation?: string;
  droitId?: string;
}

export const MANIFESTE_LOGOS: readonly EntreeLogoOutil[] = [];

export const MENTION_MARQUES =
  "Les marques citées appartiennent à leurs propriétaires. Axion IA n'est ni affiliée ni soutenue par elles.";

const STATUTS: readonly string[] = ["a-valider", "valide", "texte-seul", "interdit"];
const vide = (v: unknown) => typeof v !== "string" || v.trim() === "";

/** Rend la liste des fautes (vide = conforme). Ne lève jamais. */
export function controlerEntreeLogo(e: EntreeLogoOutil): string[] {
  const f: string[] = [];
  if (e === null || typeof e !== "object") return ["entrée absente"];
  if (typeof e.id !== "string" || !/^[a-z0-9-]+$/.test(e.id)) f.push("id hors ^[a-z0-9-]+$");
  if ((e.nature as string) !== "outil") f.push("nature autre que « outil » (aucun id client)");
  for (const c of ["outil", "source", "adresse", "adresseCharte", "dateRecuperation", "versionSource", "licenceFichier", "reglesCharte", "preuve", "risque"] as const) {
    if (vide(e[c])) f.push(`champ « ${c} » vide`);
  }
  if (typeof e.charte !== "object" || e.charte === null) f.push("champ « charte » absent");
  if (typeof e.empreinteSha256 !== "string" || !/^[0-9a-f]{64}$/.test(e.empreinteSha256)) f.push("empreinteSha256 invalide");
  if (!STATUTS.includes(e.statut)) f.push("statut inconnu");
  if (e.statut === "valide") {
    if (vide(e.validePar)) f.push("statut valide sans validePar");
    if (vide(e.dateValidation)) f.push("statut valide sans dateValidation");
  }
  return f;
}
