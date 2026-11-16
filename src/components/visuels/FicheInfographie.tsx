"use client";

/**
 * Écrans de l'infographie (INF-01) : formulaire de création avec aperçu en direct, liste, fiche de validation.
 * Présentation seule : aucun rendu, aucun envoi, aucun montant. Tant que « Valider » n'est pas cliqué, l'infographie reste un brouillon.
 */
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";

export type StyleInfographie = "liste" | "avant" | "chiffre";
export type ReseauInfographie = "linkedin" | "instagram" | "facebook";
export type StatutInfographie = "brouillon" | "valide";

/** Infographie gardée par le Studio. Le brouillon n'a ni date de validation, ni créneau, ni envoi. */
export interface FicheInfographieStockee {
  id: string;
  titre: string;
  points: string[];
  style: StyleInfographie;
  reseaux: ReseauInfographie[];
  statut: StatutInfographie;
  creeLe: string;
  modifieLe: string;
  valideLe?: string;
}

export interface EtatInfographie {
  erreur?: string;
}

export const LIBELLES_STYLE: Record<StyleInfographie, string> = { liste: "Liste numérotée", avant: "Avant et après", chiffre: "Un chiffre clé" };
export const LIBELLES_RESEAU: Record<ReseauInfographie, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook" };
const LIBELLES_STATUT: Record<StatutInfographie, string> = { brouillon: "Brouillon", valide: "Validée" };

/** Affiché quand le générateur d'infographies est éteint : on le dit en vouvoyant, rien n'est rendu. */
export function BandeauInfographieEteint() {
  return (
    <div id="bandeau-generateur-eteint" role="status" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-carte border border-ambre/30 bg-ambre-doux px-4 py-3 text-sm text-ambre">
      <Icone nom="attention" size={18} className="shrink-0" />
      <p className="min-w-0 flex-1 font-semibold">Le générateur d&apos;infographies est éteint : vous pouvez écrire votre brouillon, mais aucune image ne sera composée pour l&apos;instant.</p>
      <Link href="/reglages/carrousels" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        Ouvrir les réglages
      </Link>
    </div>
  );
}

/** Aperçu de la composition : titre, points numérotés, chiffre clé. Texte seul, rien n'est rendu côté serveur. */
export function ApercuInfographie({ titre, points, style }: { titre: string; points: string[]; style: StyleInfographie }) {
  return (
    <div aria-live="polite" className="min-h-40 rounded-carte border border-trait bg-surface-1 p-4">
      <p className="text-lg font-bold text-accent">{titre.trim() || "(titre à écrire)"}</p>
      {style === "chiffre" && <p className="my-3 text-5xl font-extrabold text-texte">{points.length > 0 ? points.length : "…"}</p>}
      <ol className="mt-2 list-decimal pl-5 text-sm text-texte">
        {points.map((p, i) => (
          <li key={i} className="my-1.5">
            {p}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-texte-doux">Style : {LIBELLES_STYLE[style].toLowerCase()}</p>
    </div>
  );
}

const decouper = (texte: string): string[] => texte.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5);

/** Écran 1 : création. L'aperçu se met à jour pendant la frappe ; « Créer » garde un brouillon. */
export function FormulaireInfographie({ creer, allume }: { creer: (etat: EtatInfographie, donnees: FormData) => Promise<EtatInfographie>; allume: boolean }) {
  const [etat, action] = useActionState(creer, {} as EtatInfographie);
  const [titre, setTitre] = useState("");
  const [points, setPoints] = useState("");
  const [style, setStyle] = useState<StyleInfographie>("liste");
  const lignes = decouper(points);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        {!allume && <p className="sr-only">Générateur éteint</p>}
        <label className="flex flex-col gap-1 text-sm font-semibold text-texte">
          Titre
          <input name="titre" type="text" required maxLength={80} value={titre} onChange={(e) => setTitre(e.target.value)} className="min-h-11 rounded-champ border border-trait-fort bg-surface-1 px-3 font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-texte">
          Points clés (un par ligne, de trois à cinq)
          <textarea name="points" required rows={6} value={points} onChange={(e) => setPoints(e.target.value)} className="rounded-champ border border-trait-fort bg-surface-1 px-3 py-2 font-normal" />
        </label>
        <p className="text-xs text-texte-doux">{lignes.length < 3 ? `Encore ${3 - lignes.length} point(s) à écrire (trois au moins).` : `${lignes.length} points sur 5 au plus`}</p>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 text-sm font-semibold text-texte">Style</legend>
          {(Object.keys(LIBELLES_STYLE) as StyleInfographie[]).map((s) => (
            <label key={s} className="flex min-h-11 items-center gap-2 rounded-champ border border-trait-fort bg-surface-1 px-3 text-sm">
              <input type="radio" name="style" value={s} checked={style === s} onChange={() => setStyle(s)} className="accent-accent" />
              {LIBELLES_STYLE[s]}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 text-sm font-semibold text-texte">Réseaux visés</legend>
          {(Object.keys(LIBELLES_RESEAU) as ReseauInfographie[]).map((r) => (
            <label key={r} className="flex min-h-11 items-center gap-2 rounded-champ border border-trait-fort bg-surface-1 px-3 text-sm">
              <input type="checkbox" name="reseau" value={r} defaultChecked={r !== "facebook"} className="accent-accent" />
              {LIBELLES_RESEAU[r]}
            </label>
          ))}
        </fieldset>
        {etat.erreur && (
          <p role="alert" className="text-sm text-brique">
            {etat.erreur}
          </p>
        )}
        <Bouton type="submit" icone="plus" className="self-start">
          Créer l&apos;infographie
        </Bouton>
        <p className="text-xs text-texte-doux">Vous gardez la main : l&apos;infographie reste un brouillon tant que vous ne l&apos;avez pas validée.</p>
      </div>
      <section aria-label="Aperçu">
        <h2 className="mb-2 text-sm font-semibold text-texte-doux">Aperçu</h2>
        <ApercuInfographie titre={titre} points={lignes} style={style} />
      </section>
    </form>
  );
}

/** Écran 0 : la liste des infographies, brouillons et validées. */
export function ListeInfographies({ fiches }: { fiches: FicheInfographieStockee[] }): ReactNode {
  if (fiches.length === 0) return <p className="rounded-carte border border-dashed border-trait-fort p-5 text-center text-sm text-texte-doux">Aucune infographie pour l&apos;instant. Créez la première.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {fiches.map((f) => (
        <li key={f.id}>
          <Link href={`/infographies/${encodeURIComponent(f.id)}`} className="flex min-h-11 flex-wrap items-center gap-2 rounded-carte border border-trait bg-surface-1 px-4 py-3 hover:bg-surface-2">
            <span className="min-w-0 flex-1 font-semibold text-texte">{f.titre}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-texte-doux">{LIBELLES_STATUT[f.statut]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Écran 3 : l'aperçu et la validation. Le seul bouton est « Valider » ; il ne programme ni n'envoie rien. */
export function FicheInfographieValidation({ fiche, valider }: { fiche: FicheInfographieStockee; valider: (donnees: FormData) => Promise<void> }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texte-doux">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-texte">{LIBELLES_STATUT[fiche.statut]}</span>
        <span className="ml-2">Réseaux : {fiche.reseaux.map((r) => LIBELLES_RESEAU[r]).join(", ") || "aucun"}</span>
      </p>
      <ApercuInfographie titre={fiche.titre} points={fiche.points} style={fiche.style} />
      {fiche.statut === "brouillon" ? (
        <form action={valider} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={fiche.id} />
          <p className="text-sm text-texte-doux">Relisez, puis validez. Tant que vous n&apos;avez pas cliqué, l&apos;infographie reste un brouillon : elle n&apos;est ni programmée ni envoyée.</p>
          <Bouton type="submit" icone="valide" className="self-start">
            Valider
          </Bouton>
        </form>
      ) : (
        <p role="status" className="text-sm font-semibold text-sauge">
          Validée. Rien n&apos;est programmé ni envoyé : vous choisirez la suite vous-même.
        </p>
      )}
    </div>
  );
}
