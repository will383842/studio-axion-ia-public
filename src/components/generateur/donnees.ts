/**
 * Données des écrans du générateur (lot G1b) : formes SÉRIALISABLES passées du serveur aux composants client.
 * PUR : aucune lecture de dépôt ici, les pages appellent les services puis ces conversions.
 */
import type { LigneGrille } from "@/domaine/derivations-generateur";
import type { SujetClassable, FormatClassable } from "@/domaine/classement-generateur";
import { libelleLigneGrille, nomFormatGenerateur } from "@/domaine/libelles";
import type { ScriptMaitre } from "@/domaine/types";
import { formatGenerateur, listerFormats, trouverFormat } from "@/formats";
import { codeDuFormat } from "@/formats/registre-codes";

export interface LigneGrilleAffichee extends Pick<LigneGrille, "formatId" | "mode" | "adresse" | "cases"> {
  libelle: string;
}

export interface SujetListe extends SujetClassable {
  id: string;
  version: number;
  titre: string;
  quand: string;
  grille: LigneGrilleAffichee[];
}

export function nomFormat(formatId: string): string {
  const f = trouverFormat(formatId);
  return f ? nomFormatGenerateur(f.nomCourt) : formatId;
}

export function lignesAffichees(grille: LigneGrille[]): LigneGrilleAffichee[] {
  return grille.map((l) => ({ formatId: l.formatId, mode: l.mode, adresse: l.adresse, cases: l.cases, libelle: libelleLigneGrille(nomFormat(l.formatId), l.mode, l.adresse) }));
}

export function versSujetListe(v: { maitre: ScriptMaitre; etat: string; grille: LigneGrille[] }): SujetListe {
  const m = v.maitre;
  return {
    id: m.id,
    version: m.version,
    titre: m.angle?.titre ?? m.brief.idee,
    quand: m.modifieLe,
    etat: v.etat,
    maitre: {
      numero: m.numero,
      brief: { idee: m.brief.idee, pilier: m.brief.pilier, serieId: m.brief.serieId },
      angle: m.angle ? { titre: m.angle.titre } : undefined,
      manque: m.manque ? { type: m.manque.type } : undefined,
    },
    grille: lignesAffichees(v.grille),
  };
}

/** Formats proposés dans Écrire : la liste publique + le format actif réservé à Will (Face caméra animée), écrit ici seulement. */
function formatsDEcriture() {
  return [...listerFormats(), ...listerFormats({ inclureMasques: true }).filter((f) => f.reserveAWill && f.statut === "actif")];
}

/** Formats qui ont un code de classement (bouton Format, écran Sujet), avec leur type de vidéo. */
export function formatsClassables(): (FormatClassable & { statut: string; icone: string })[] {
  return formatsDEcriture()
    .map((f) => ({ id: f.id, nom: nomFormatGenerateur(f.nomCourt), code: f.codeClassement ?? codeDuFormat(f.id) ?? "", famille: f.famille, statut: f.statut, icone: f.icone as string }))
    .filter((f) => !!f.code);
}

/** Codes de classement par format (recherche « SAR »). */
export function codesParFormat(): Record<string, string> {
  return Object.fromEntries(formatsClassables().map((f) => [f.id, f.code]));
}

/** Formats que le générateur sait écrire (code de classement et recette résolue) ; « bientôt » = moteur à venir. */
export function formatsEcrivables(): { id: string; nom: string; icone: import("@/components/ui/Icone").NomIcone; statut: string; modes: import("@/domaine/types").ModeDiction[]; modeParDefaut: import("@/domaine/types").ModeDiction }[] {
  const sortie = [];
  for (const f of formatsDEcriture()) {
    try {
      const g = formatGenerateur(f.id);
      sortie.push({ id: f.id, nom: nomFormatGenerateur(f.nomCourt), icone: f.icone, statut: f.statut, modes: g.recette.modesDiction, modeParDefaut: g.recette.modeParDefaut });
    } catch {
      // Sans code de classement : pas encore écrivable par le générateur.
    }
  }
  return sortie.sort((a, b) => Number(b.statut === "actif") - Number(a.statut === "actif"));
}
