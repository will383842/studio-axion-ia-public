"use client";

import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Pastille } from "@/components/ui/Pastille";
import { RemarquesFiche } from "@/components/formats/vitrines/RemarquesFiche";
import { verifierChapitres } from "@/briques/geo";
import type { ChapitreWeb } from "@/domaine/site-videos/types";

/** Mots par seconde de la voix : celui de la recette du format (2,6), pour que l'écran et la fabrication comptent pareil. */
export const MOTS_PAR_SECONDE = 2.6;
/** Zone conseillée (secondes) : au-delà, une remarque, jamais un refus. */
export const ZONE_CONSEILLEE_SEC: readonly [number, number] = [240, 720];

/** Un chapitre du plan. Tout ce qui s'affiche vient du script de l'utilisateur ou de ce qu'il a tapé. */
export interface ChapitrePlan {
  id: string;
  titre: string;
  /** « Ce que ce chapitre explique » : écrit par l'utilisateur, vide au départ. */
  explique: string;
  /** Texte du chapitre tel que collé par l'utilisateur. */
  texte: string;
}

export const compterMots = (texte: string): number => texte.split(/\s+/).filter(Boolean).length;
export const dureeSecDuTexte = (texte: string): number => compterMots(texte) / MOTS_PAR_SECONDE;

/** « 6 min 40 », « 45 s ». */
export function formaterDuree(sec: number): string {
  const s = Math.round(sec);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`;
}

/** Découpe une phrase par phrase (le texte reste celui de l'utilisateur, aucun mot ajouté ni changé). */
export function decouperEnPhrases(texte: string): string[] {
  return texte
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean);
}

/**
 * Chapitres tirés du script collé : un titre « # … » ouvre un chapitre ; sans titre, un bloc séparé par une ligne vide
 * est un chapitre sans titre (l'utilisateur le nomme lui-même). Script vide : aucun chapitre, rien n'est inventé.
 */
export function chapitresDuScript(script: string): ChapitrePlan[] {
  const brut = script.replace(/\r\n/g, "\n").trim();
  if (!brut) return [];
  const lignes = brut.split("\n");
  const avecTitres = lignes.some((l) => /^#+\s*\S/.test(l));
  const blocs: { titre: string; texte: string[] }[] = [];
  if (avecTitres) {
    for (const l of lignes) {
      const m = /^#+\s*(.+)$/.exec(l.trim());
      if (m) blocs.push({ titre: m[1].trim(), texte: [] });
      else if (l.trim()) {
        if (blocs.length === 0) blocs.push({ titre: "", texte: [] });
        blocs[blocs.length - 1].texte.push(l.trim());
      }
    }
  } else {
    for (const b of brut.split(/\n\s*\n/)) blocs.push({ titre: "", texte: [b.replace(/\s*\n\s*/g, " ").trim()] });
  }
  return blocs
    .map((b) => ({ titre: b.titre, texte: b.texte.join(" ") }))
    .filter((b) => b.texte !== "" || b.titre !== "")
    .map((b, i) => ({ id: `chapitre-${i + 1}`, titre: b.titre, explique: "", texte: b.texte }));
}

/** Chapitres minutés (début, fin) sur la durée du texte de chacun, au format attendu par YouTube. */
export function chapitresMinutes(chapitres: readonly ChapitrePlan[]): ChapitreWeb[] {
  let debut = 0;
  return chapitres.map((c, i) => {
    const fin = debut + dureeSecDuTexte(c.texte);
    const web: ChapitreWeb = { debutSec: Math.round(debut * 10) / 10, finSec: Math.round(fin * 10) / 10, libelle: c.titre.trim() || `Chapitre ${i + 1}`, blocRecette: "chapitres" };
    debut = fin;
    return web;
  });
}

/**
 * Le plan tel que l'utilisateur l'a VALIDÉ à l'écran 3 : titre et phrases gardées, un chapitre sans phrase n'existe plus.
 * Durée, minutages et titres des courts se calculent sur ce plan, jamais sur le plan proposé.
 */
export function planDepuisValide(valide: readonly { id: string; titre: string; explique?: string; phrases: readonly string[] }[], plan: readonly ChapitrePlan[] = []): ChapitrePlan[] {
  return valide
    .filter((c) => c.phrases.some((p) => p.trim() !== ""))
    .map((c) => ({ id: c.id, titre: c.titre, explique: c.explique ?? plan.find((p) => p.id === c.id)?.explique ?? "", texte: c.phrases.join(" ") }));
}

export const dureeTotaleSec = (chapitres: readonly ChapitrePlan[]): number => chapitres.reduce((t, c) => t + dureeSecDuTexte(c.texte), 0);

/** Remarques de l'écran 2 : durée hors zone et règles YouTube. Toujours des conseils, jamais un refus. */
export function remarquesDuPlan(chapitres: readonly ChapitrePlan[]): string[] {
  if (chapitres.length === 0) return [];
  const total = dureeTotaleSec(chapitres);
  const r: string[] = [];
  if (total < ZONE_CONSEILLEE_SEC[0] || total > ZONE_CONSEILLEE_SEC[1]) {
    r.push(`Votre vidéo dure environ ${formaterDuree(total)} : la zone conseillée va de 4 à 12 minutes. Ce n'est qu'un conseil.`);
  }
  return [...r, ...verifierChapitres(chapitresMinutes(chapitres)).map((x) => x.message)];
}

export function PlanChapitres({
  chapitres,
  onChange,
  onSuivant,
  onRetour,
}: {
  chapitres: ChapitrePlan[];
  onChange: (suite: ChapitrePlan[]) => void;
  onSuivant: () => void;
  onRetour?: () => void;
}) {
  const total = dureeTotaleSec(chapitres);
  const minutes = chapitresMinutes(chapitres);
  const remplacer = (i: number, patch: Partial<ChapitrePlan>) => onChange(chapitres.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const deplacer = (i: number, sens: -1 | 1) => {
    const j = i + sens;
    if (j < 0 || j >= chapitres.length) return;
    const copie = [...chapitres];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    onChange(copie);
  };
  return (
    <section className="space-y-5" aria-label="Les chapitres">
      <p className="text-base font-semibold text-texte">Voici le plan proposé. Rien n&apos;est payé à cette étape.</p>
      <Pastille ton="neutre" icone="video">
        ≈ {formaterDuree(total)} · {chapitres.length} chapitre{chapitres.length > 1 ? "s" : ""}
      </Pastille>
      {chapitres.length > 0 && (
        // Aperçu 16:9 du plan : environ deux tiers de la largeur (la planche VL-00 les montrait à un tiers : trop petit).
        <div data-apercu-plan="16:9" className="aspect-video w-full overflow-hidden rounded-carte border border-trait bg-surface-2 md:w-2/3">
          <ol className="flex h-full w-full" aria-label="Aperçu du plan">
            {chapitres.map((c, i) => (
              <li
                key={c.id}
                style={{ flexGrow: Math.max(dureeSecDuTexte(c.texte), 1) }}
                className="flex min-w-0 basis-0 flex-col justify-end border-r border-trait p-2 text-xs text-texte last:border-r-0"
              >
                <span className="font-semibold text-accent">{i + 1}</span>
                <span className="truncate">{c.titre.trim() || `Chapitre ${i + 1}`}</span>
                <span className="text-texte-doux">{formaterDuree(dureeSecDuTexte(c.texte))}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <RemarquesFiche remarques={remarquesDuPlan(chapitres)} />
      <ol className="space-y-3">
        {chapitres.map((c, i) => (
          <li key={c.id}>
            <Carte className="space-y-3">
              {i === 0 && <Pastille ton="sauge">Réponse courte : la réponse en deux phrases, tout au début</Pastille>}
              <Champ id={`titre-${c.id}`} libelle={`Titre du chapitre ${i + 1}`} aide="Il deviendra le chapitre YouTube." value={c.titre} onChange={(e) => remplacer(i, { titre: e.target.value })} />
              <Champ libelle={`Ce que ce chapitre explique (chapitre ${i + 1})`} value={c.explique} onChange={(e) => remplacer(i, { explique: e.target.value })} />
              <p className="text-sm text-texte-doux">
                Durée estimée : {formaterDuree(dureeSecDuTexte(c.texte))}
                {minutes[i] ? ` · commence à ${formaterDuree(minutes[i].debutSec)}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Bouton type="button" variante="secondaire" disabled={i === 0} onClick={() => deplacer(i, -1)}>
                  Monter
                </Bouton>
                <Bouton type="button" variante="secondaire" disabled={i === chapitres.length - 1} onClick={() => deplacer(i, 1)}>
                  Descendre
                </Bouton>
                <Bouton type="button" variante="secondaire" onClick={() => document.getElementById(`titre-${c.id}`)?.focus()}>
                  Renommer
                </Bouton>
                <Bouton type="button" variante="danger" onClick={() => onChange(chapitres.filter((_, k) => k !== i))}>
                  Retirer
                </Bouton>
              </div>
            </Carte>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        {onRetour && (
          <Bouton type="button" variante="secondaire" onClick={onRetour}>
            Revenir au sujet
          </Bouton>
        )}
        <Bouton type="button" icone="baguette" disabled={chapitres.length === 0} onClick={onSuivant}>
          Écrire le texte des chapitres
        </Bouton>
      </div>
    </section>
  );
}
