"use client";

/**
 * RELIER UN LOOK HEYGEN (correcteur réel 2, 04/10). Will crée son avatar DANS un décor dans l'application HeyGen ; ici,
 * il relie ce look à un décor réaliste de la Bibliothèque. Lecture gratuite de son compte, rien n'est créé ni payé.
 * Quand ce décor est choisi, son avatar parle sur ce look, avec son fond (même prix à la seconde). Le décor repasse
 * « à vérifier » : il sert après la validation de Will sur la vignette.
 */
import { useState, useTransition } from "react";
import { Bouton, EtatVide, Icone, notifier, Pastille, SelecteurPastilles } from "@/components/ui";
import type { AngleVisage } from "@/domaine/types";
import type { LookExistant } from "@/fournisseurs/types";
import { looksHeygenAction, relierLookAction } from "./actions";

const ANGLES: { valeur: AngleVisage; libelle: string }[] = [
  { valeur: "trois-quarts", libelle: "Trois quarts (principal)" },
  { valeur: "face", libelle: "Presque de face" },
];

export function RelierLookHeygen({ decorId, looksRelies, onRelie }: { decorId: string; looksRelies: { angle: AngleVisage; idExterne: string }[]; onRelie: () => void }) {
  const [liste, setListe] = useState<{ branche: boolean; looks: LookExistant[] } | null>(null);
  const [angle, setAngle] = useState<AngleVisage>("trois-quarts");
  const [enCours, demarrer] = useTransition();
  const relie = (id: string) => looksRelies.some((l) => l.idExterne === id && l.angle === angle);

  function ouvrir() {
    demarrer(async () => {
      const r = await looksHeygenAction();
      if (!r.ok) return void notifier.erreur(r.message);
      setListe(r.donnees);
    });
  }

  function relier(l: LookExistant) {
    demarrer(async () => {
      const r = await relierLookAction(decorId, l.idExterne, angle);
      if (!r.ok) return void notifier.erreur(r.message ?? "Échec.");
      notifier.succes("Look relié : validez le décor sur sa vignette");
      onRelie();
    });
  }

  return (
    <section aria-label="Look HeyGen" className="grid gap-3 rounded-xl bg-surface-2 px-3 py-3">
      <p className="text-sm text-texte-doux">
        {looksRelies.length ? "Votre avatar parle sur le look relié, avec son décor. Même prix à la seconde." : "Faites ce décor dans l'application HeyGen avec votre avatar, puis reliez-le ici. Rien n'est payé."}
      </p>
      {!liste ? (
        <Bouton pleineLargeur variante="secondaire" icone="visage" chargement={enCours} onClick={ouvrir}>
          {looksRelies.length ? "Changer de look HeyGen" : "Relier un look HeyGen"}
        </Bouton>
      ) : !liste.branche ? (
        <EtatVide compact icone="visage" titre="HeyGen n'est pas encore relié" phrase="Votre compte HeyGen n'est pas encore branché sur le serveur." />
      ) : !liste.looks.length ? (
        <EtatVide compact icone="visage" titre="Aucun look dans votre compte" phrase="Créez le look dans l'application HeyGen, puis revenez ici." />
      ) : (
        <>
          <SelecteurPastilles libelle="Angle" options={ANGLES} valeur={angle} onChange={setAngle} />
          <ul className="grid gap-2">
            {liste.looks.map((l) => (
              <li key={l.idExterne} className="flex flex-wrap items-center gap-3 rounded-carte border border-trait bg-surface-1 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-texte-doux">
                  <Icone nom="image" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-texte">{l.nom}</span>
                  {l.raison && <span className="block text-sm text-texte-faible">{l.raison}</span>}
                </span>
                {relie(l.idExterne) ? (
                  <Pastille ton="sauge" icone="coche">
                    Relié
                  </Pastille>
                ) : l.utilisable ? (
                  <Bouton chargement={enCours} onClick={() => relier(l)}>
                    Relier ce look
                  </Bouton>
                ) : (
                  <Pastille ton="ambre">Pas encore prêt</Pastille>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
