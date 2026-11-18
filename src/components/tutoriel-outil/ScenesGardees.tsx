"use client";

import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { EtatVide } from "@/components/ui/EtatVide";
import { Pastille } from "@/components/ui/Pastille";
import type { Tonalite } from "@/domaine/libelles";
import type { VueScene } from "@/services/scenes-gardees";

/** T-EXT-35 : la grille des scènes gardées. Présentation et gestes seulement ; aucun appel payant, aucun rendu. */

export type FiltreScenes = "toutes" | "validees" | "retirees";
export type ResultatGeste = { ok: true } | { ok: false; message: string };

export const PHRASE_FERMEE = "La bibliothèque de scènes n'est pas ouverte pour le moment.";
export const PHRASE_CONFIRMATION = "Cette scène ne sera plus proposée aux autres vidéos. Elle reste visible ici.";
export const PHRASE_DROITS = "Plus utilisable : droits à vérifier";

const FILTRES: { id: FiltreScenes; libelle: string }[] = [
  { id: "toutes", libelle: "Toutes" },
  { id: "validees", libelle: "Validées" },
  { id: "retirees", libelle: "Retirées" },
];

const ROLES: Record<string, string> = {
  accroche: "Début",
  probleme: "Mise en situation",
  parcours: "Pas à pas",
  "bonne-pratique": "Conseil",
  "mise-en-garde": "Point d'attention",
  appel: "Fin",
  "sans-role": "Passage",
};
export const libelleRole = (role: string): string => ROLES[role] ?? "Passage";

const ETATS: Record<VueScene["etat"], { mot: string; ton: Tonalite }> = {
  brouillon: { mot: "En attente de votre choix", ton: "ambre" },
  validee: { mot: "Gardée", ton: "sauge" },
  retiree: { mot: "Retirée", ton: "contour" },
};
export const libelleEtat = (etat: VueScene["etat"]): string => ETATS[etat].mot;

/** Les scènes à montrer selon le filtre (« Toutes » les montre toutes, retirées comprises : rien n'est effacé). */
export function filtrerScenes(scenes: readonly VueScene[], filtre: FiltreScenes): VueScene[] {
  if (filtre === "validees") return scenes.filter((s) => s.etat === "validee");
  if (filtre === "retirees") return scenes.filter((s) => s.etat === "retiree");
  return [...scenes];
}

const duree = (sec: number): string => `${String(Math.round(sec * 10) / 10).replace(".", ",")} s`;
const fragment = (a: number, b: number): string => `#t=${Number(a.toFixed(3))},${Number(b.toFixed(3))}`;

export function CarteScene({
  scene,
  enCours,
  confirmation,
  message,
  onDemanderRetrait,
  onAnnuler,
  onRetirer,
  onGarder,
}: {
  scene: VueScene;
  enCours?: boolean;
  confirmation?: boolean;
  message?: string;
  onDemanderRetrait?: () => void;
  onAnnuler?: () => void;
  onRetirer?: () => void;
  onGarder?: () => void;
}) {
  const e = ETATS[scene.etat];
  return (
    <Carte as="li" className="space-y-3">
      {scene.apercu ? (
        <video
          className="aspect-[4/5] w-full rounded-xl bg-surface-2 object-contain"
          src={`${scene.apercu.url}${fragment(scene.apercu.debutSec, scene.apercu.finSec)}`}
          controls
          muted
          playsInline
          preload="metadata"
          aria-label={`Passage de « ${scene.titreVideo} »`}
        />
      ) : (
        <div className="grid aspect-[4/5] w-full place-items-center rounded-xl bg-surface-2 p-4 text-center text-sm text-texte-doux">{scene.motifApercu ?? "Aperçu indisponible"}</div>
      )}
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-texte">{scene.titreVideo}</p>
        <p className="text-sm text-texte-doux">
          {libelleRole(scene.role)} · {duree(scene.dureeSec)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Pastille ton={e.ton}>{e.mot}</Pastille>
          {!scene.licence.utilisable && <Pastille ton="brique">{PHRASE_DROITS}</Pastille>}
        </div>
      </div>
      {message && (
        <p role="alert" className="text-sm text-brique">
          {message}
        </p>
      )}
      {confirmation ? (
        <div className="space-y-2">
          <p className="text-sm text-texte">{PHRASE_CONFIRMATION}</p>
          <div className="flex flex-wrap gap-2">
            <Bouton variante="danger" onClick={onRetirer} disabled={enCours}>
              Oui, retirer
            </Bouton>
            <Bouton variante="secondaire" onClick={onAnnuler} disabled={enCours}>
              Annuler
            </Bouton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {scene.etat === "brouillon" && (
            <Bouton variante="principal" onClick={onGarder} disabled={enCours}>
              Garder pour d&apos;autres vidéos
            </Bouton>
          )}
          {scene.etat !== "retiree" && (
            <Bouton variante="secondaire" onClick={onDemanderRetrait} disabled={enCours}>
              Retirer
            </Bouton>
          )}
        </div>
      )}
    </Carte>
  );
}

export function ScenesGardees({
  scenes,
  ouverte,
  onRetirer,
  onGarder,
}: {
  scenes: VueScene[];
  ouverte: boolean;
  onRetirer: (cle: string) => Promise<ResultatGeste>;
  onGarder: (cle: string) => Promise<ResultatGeste>;
}) {
  const [filtre, setFiltre] = useState<FiltreScenes>("toutes");
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [enCours, demarrer] = useTransition();

  if (!ouverte) return <EtatVide titre="Scènes gardées" phrase={PHRASE_FERMEE} />;

  const faire = (cle: string, geste: (c: string) => Promise<ResultatGeste>) =>
    demarrer(async () => {
      const r = await geste(cle);
      setMessages((m) => ({ ...m, [cle]: r.ok ? "" : r.message }));
      if (r.ok) setAConfirmer(null);
    });

  const visibles = filtrerScenes(scenes, filtre);
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filtrer les scènes" className="flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Bouton key={f.id} variante={filtre === f.id ? "principal" : "secondaire"} aria-pressed={filtre === f.id} onClick={() => setFiltre(f.id)}>
            {f.libelle}
          </Bouton>
        ))}
      </div>
      {visibles.length === 0 ? (
        <EtatVide titre="Aucune scène ici" phrase="Les passages de vos vidéos terminées apparaîtront ici." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((s) => (
            <CarteScene
              key={s.cle}
              scene={s}
              enCours={enCours}
              confirmation={aConfirmer === s.cle}
              message={messages[s.cle]}
              onDemanderRetrait={() => setAConfirmer(s.cle)}
              onAnnuler={() => setAConfirmer(null)}
              onRetirer={() => faire(s.cle, onRetirer)}
              onGarder={() => faire(s.cle, onGarder)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
