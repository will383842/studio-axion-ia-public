"use client";

/**
 * BIBLIOTHÈQUE D'ÉTAPES (PLAN B.6.2) : clé → composant + règles.
 * Un futur format qui demande une étape nouvelle l'ajoute ICI (et dans meta.ts), sans toucher aux autres.
 */
import { dureeDepuisScript, libelleDuree, obtenirFormat, reglagesParDefaut } from "@/formats";
import { EtapeApercu } from "./Apercu";
import { EtapeDistribution } from "./Distribution";
import { EtapeExpress } from "./Express";
import { EtapeFabrication } from "./Fabrication";
import { EtapeMedias } from "./Medias";
import type { CleEtape } from "./meta";
import { EtapeReglages } from "./Reglages";
import { EtapeScript } from "./Script";
import { EtapeSujet } from "./Sujet";
import type { BrouillonAssistant, DefinitionEtape, DonneesAssistant } from "./types";

function distributionComplete(b: BrouillonAssistant): boolean {
  const f = obtenirFormat(b.formatId);
  const remplis = b.distribution.filter((d) => !!d.personnageId && (d.source === "rush" ? !!d.rushIds?.length : !!d.visageId));
  return remplis.length >= f.personnages.min && remplis.length === b.distribution.length;
}

function nomElement(d: DonneesAssistant, id?: string): string | undefined {
  return id ? d.elements.find((e) => e.id === id)?.nom : undefined;
}

export const ETAPES: Record<CleEtape, DefinitionEtape> = {
  sujet: {
    cle: "sujet",
    Composant: EtapeSujet,
    estValide: (b) => b.sujet.trim().length >= 3 && b.ratios.length > 0,
    manque: () => "Indiquez le sujet",
    // Format « depuis-script » : pas de durée choisie, c'est le texte qui la fixe (B.0 §18).
    resume: (b) => (dureeDepuisScript(obtenirFormat(b.formatId)) ? `${b.sujet} · ${b.ratios.join(" ")}` : `${b.sujet} · ${libelleDuree(b.dureeCibleSec)} · ${b.ratios.join(" ")}`),
  },
  script: {
    cle: "script",
    Composant: EtapeScript,
    estValide: (b) => b.blocs.some((x) => x.segments.some((s) => s.texte.trim())),
    manque: () => "Il manque le texte",
  },
  distribution: {
    cle: "distribution",
    Composant: EtapeDistribution,
    estValide: distributionComplete,
    aDesValeursParDefaut: distributionComplete,
    manque: () => "Choisissez qui parle",
    resume: (b, d) =>
      b.distribution
        .map((x) => {
          const p = d.personnages.find((q) => q.personnage.id === x.personnageId);
          if (!p) return x.role;
          if (x.source === "rush") return `${p.personnage.nom} · images filmées`;
          const v = p.visages.find((y) => y.id === x.visageId);
          return v ? `${p.personnage.nom} · ${v.nom}` : p.personnage.nom;
        })
        .join(" — ") || "Personne",
  },
  medias: {
    cle: "medias",
    Composant: EtapeMedias,
    estValide: (b) => obtenirFormat(b.formatId).entrees.every((e) => !e.obligatoire || (Array.isArray(b.entrees[e.cle]) && (b.entrees[e.cle] as unknown[]).length > 0)),
    aDesValeursParDefaut: (b) => obtenirFormat(b.formatId).entrees.every((e) => !e.obligatoire),
    manque: () => "Ajoutez les images demandées",
    resume: (b) => {
      const n = Object.values(b.entrees).reduce<number>((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
      return n ? `${n} fichier${n > 1 ? "s" : ""}` : "Rien d'obligatoire";
    },
  },
  reglages: {
    cle: "reglages",
    Composant: EtapeReglages,
    estValide: (b) => obtenirFormat(b.formatId).reglages.schema.safeParse(b.reglages).success,
    aDesValeursParDefaut: (b) =>
      JSON.stringify(b.reglages) === JSON.stringify(reglagesParDefaut(obtenirFormat(b.formatId))) && Object.keys(b.styles).length === 0 && b.briquesCoupees.length === 0,
    manque: () => "Un réglage n'est pas valable",
    resume: (b, d) => {
      const f = obtenirFormat(b.formatId);
      const parties = [nomElement(d, b.styles.lutId ?? f.stylesParDefaut.lut), nomElement(d, b.styles.sousTitresId ?? f.stylesParDefaut.sousTitres), nomElement(d, b.styles.styleMontageId ?? f.stylesParDefaut.styleMontage)];
      return parties.filter(Boolean).join(" · ") || "Réglages habituels";
    },
  },
  apercu: {
    cle: "apercu",
    Composant: EtapeApercu,
    estValide: () => true,
  },
  // Écran « Votre vidéo » (lot M3) : le texte suffit ; le sujet est facultatif (le titre vient de l'accroche).
  express: {
    cle: "express",
    Composant: EtapeExpress,
    estValide: (b) => b.blocs.some((x) => x.segments.some((s) => s.texte.trim())) && b.ratios.length > 0,
    manque: () => "Il manque le texte",
  },
  fabrication: {
    cle: "fabrication",
    Composant: EtapeFabrication,
    estValide: () => true,
  },
};

export function etapesDuFormat(formatId: string): DefinitionEtape[] {
  return obtenirFormat(formatId).etapes.map((c) => ETAPES[c]);
}
