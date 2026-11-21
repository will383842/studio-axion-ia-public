"use client";

/**
 * Écran « déposer la capture, puis relire les chiffres » du tableau de bord (G4-08-b2-v20j).
 * Monté nulle part : aucune page ne l'importe. Aucune action importée : `ouvrir` et `valider` arrivent en propriétés.
 * Un seul envoi par dépôt (pas de double lecture payée) : tout est désactivé pendant l'envoi.
 * Aucun montant n'est affiché ici ; la police est celle de la page (héritée).
 */
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { RelectureChiffres } from "./RelectureChiffres";

/** Types locaux (structurels) : le dossier des données vidéo reste réservé au Studio. */
export type ImageDeposee = { base64: string; type: "image/png" | "image/jpeg"; largeur: number; hauteur: number };
export type ChiffreAffiche = { cle: string; libelle: string; valeur: number; unite: string };
export type DecisionLue = { type: "valide" } | { type: "corrige"; valeur: number } | { type: "refuse" };
export type OuvertureEcran = { etape: "relecture"; brouillon: unknown; aRelire: ChiffreAffiche[] } | { etape: "saisie-manuelle"; raison: string };
export type ValidationEcran = { ok: true } | { ok: false; raisons: string[] };

/** Côté le plus long accepté par la lecture. */
export const COTE_MAX_IMAGE = 1568;
/** Lien d'aide du repli « saisie à la main » (la saisie elle-même n'est pas ici). */
export const LIEN_AIDE_SAISIE = "/aide-chat";

export type EtatEcran = {
  image: ImageDeposee | null;
  envoi: boolean;
  ouverture: OuvertureEcran | null;
  decisions: Record<string, DecisionLue>;
  erreurs: string[];
  valide: boolean;
};

export const ETAT_VIDE: EtatEcran = { image: null, envoi: false, ouverture: null, decisions: {}, erreurs: [], valide: false };

/** Réduit une image png ou jpeg à `COTE_MAX_IMAGE` au plus (canvas du navigateur) ; null si illisible ou d'un autre type. */
export async function reduireImage(fichier: File): Promise<ImageDeposee | null> {
  const type = fichier.type === "image/png" ? "image/png" : fichier.type === "image/jpeg" ? "image/jpeg" : null;
  if (!type) return null;
  try {
    const bitmap = await createImageBitmap(fichier);
    const echelle = Math.min(1, COTE_MAX_IMAGE / Math.max(bitmap.width, bitmap.height));
    const largeur = Math.max(1, Math.round(bitmap.width * echelle));
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle));
    const toile = document.createElement("canvas");
    toile.width = largeur;
    toile.height = hauteur;
    toile.getContext("2d")?.drawImage(bitmap, 0, 0, largeur, hauteur);
    const url = toile.toDataURL(type, 0.9);
    return { base64: url.slice(url.indexOf(",") + 1), type, largeur, hauteur };
  } catch {
    return null;
  }
}

/** Vue pure de l'écran (testable sans navigateur) : tout vient des propriétés. */
export function VueRelectureTableau({
  etat,
  onChoisir,
  onEnvoyer,
  onDecider,
  onValider,
}: {
  etat: EtatEcran;
  onChoisir: (fichier: File | null) => void;
  onEnvoyer: () => void;
  onDecider: (cle: string, decision: DecisionLue) => void;
  onValider: () => void;
}) {
  const { image, envoi, ouverture, decisions, erreurs, valide } = etat;
  const aRelire = ouverture?.etape === "relecture" ? ouverture.aRelire : null;
  const toutRelu = aRelire !== null && aRelire.length > 0 && aRelire.every((c) => decisions[c.cle]);
  return (
    <section className="space-y-4 font-texte">
      {!ouverture && (
        <div className="space-y-3">
          <label htmlFor="capture-tableau" className="block text-sm font-semibold text-texte">
            Dépose la capture de ton tableau de bord (png ou jpeg)
          </label>
          <input id="capture-tableau" type="file" accept="image/png,image/jpeg" disabled={envoi} onChange={(e) => onChoisir(e.target.files?.[0] ?? null)} className="block min-h-11 text-sm text-texte" />
          <Bouton variante="principal" disabled={!image || envoi} onClick={onEnvoyer}>
            Lire la capture
          </Bouton>
        </div>
      )}
      {ouverture?.etape === "saisie-manuelle" && (
        <div className="space-y-2 rounded-champ border border-trait bg-surface-1 px-4 py-3">
          <p className="text-sm text-texte">{ouverture.raison}</p>
          <a href={LIEN_AIDE_SAISIE} className="text-sm font-semibold text-accent underline">
            Comment saisir les chiffres à la main
          </a>
        </div>
      )}
      {aRelire && (
        <div className="space-y-3">
          <RelectureChiffres chiffres={aRelire} decisions={decisions} onDecider={onDecider} desactive={envoi || valide} />
          <Bouton variante="principal" disabled={!toutRelu || envoi || valide} onClick={onValider}>
            Valider les chiffres
          </Bouton>
        </div>
      )}
      {erreurs.length > 0 && (
        <ul className="space-y-1 text-sm text-brique" role="alert">
          {erreurs.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {valide && <p className="text-sm font-semibold text-accent">Chiffres validés.</p>}
    </section>
  );
}

export function EcranRelectureTableau({
  ouvrir,
  valider,
}: {
  ouvrir: (image: ImageDeposee) => Promise<OuvertureEcran>;
  valider: (brouillon: unknown, decisions: Record<string, DecisionLue>) => Promise<ValidationEcran>;
}) {
  const [etat, setEtat] = useState<EtatEcran>(ETAT_VIDE);
  const enCours = useRef(false);
  const maj = (p: Partial<EtatEcran>) => setEtat((e) => ({ ...e, ...p }));

  async function choisir(fichier: File | null) {
    if (!fichier) return maj({ image: null, erreurs: [] });
    const image = await reduireImage(fichier);
    maj(image ? { image, erreurs: [] } : { image: null, erreurs: ["Cette image n'a pas pu être lue : choisis un fichier png ou jpeg."] });
  }

  async function envoyer() {
    if (enCours.current || !etat.image) return;
    enCours.current = true;
    maj({ envoi: true, erreurs: [] });
    try {
      maj({ ouverture: await ouvrir(etat.image), envoi: false });
    } catch {
      enCours.current = false;
      maj({ envoi: false, erreurs: ["La lecture n'a pas abouti. Réessaie dans un instant."] });
    }
  }

  async function validerChiffres() {
    if (enCours.current || etat.ouverture?.etape !== "relecture") return;
    enCours.current = true;
    maj({ envoi: true, erreurs: [] });
    try {
      const r = await valider(etat.ouverture.brouillon, etat.decisions);
      enCours.current = false;
      maj(r.ok ? { envoi: false, valide: true } : { envoi: false, erreurs: r.raisons });
    } catch {
      enCours.current = false;
      maj({ envoi: false, erreurs: ["La validation n'a pas abouti. Réessaie dans un instant."] });
    }
  }

  return <VueRelectureTableau etat={etat} onChoisir={choisir} onEnvoyer={envoyer} onDecider={(cle, d) => maj({ decisions: { ...etat.decisions, [cle]: d } })} onValider={validerChiffres} />;
}
