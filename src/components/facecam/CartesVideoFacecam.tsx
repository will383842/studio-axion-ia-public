"use client";

/**
 * FEUILLE « CARTES ET EFFETS » (fiche vidéo face caméra, 10/10) : TOUTES les cartes de la vidéo — automatiques
 * (posées d'après ce qui est dit) et celles du monteur — avec leur modèle, leur texte et leur moment (temps de la vidéo
 * montée). Pour chacune : Retirer (Remettre pour une carte automatique retirée), Modifier (« Déplacer à 0:32 »,
 * « Changer le texte »). Chaque geste donne une nouvelle version où seule la piste habillée est refaite ; une carte
 * automatique retirée ne revient pas aux retouches suivantes.
 */
import { useState } from "react";
import { changerTexteCarteAction, deplacerCarteAction, remettreCarteAutoAction, retirerCarteAutoAction, retirerPassageAction } from "@/app/(studio)/videos/actions-facecam";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Dialogue } from "@/components/ui/Dialogue";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { cn } from "@/lib/cn";
import { horloge } from "@/moteurs/montage-facecam/monteur/temps";
import type { VueCarteVideo } from "@/services/monteur-facecam";

type Geste = (action: () => Promise<{ ok: true } | { ok: false; message: string }>, succes: string, apres?: () => void) => void;

const NOMS_PASSAGE: Record<string, { nom: string; icone: NomIcone }> = {
  carte: { nom: "Carte animée", icone: "etincelles" },
  "ecran-partage": { nom: "Écran partagé", icone: "ecran-partage" },
  zoom: { nom: "Zoom", icone: "loupe" },
  titre: { nom: "Titre", icone: "texte" },
  generique: { nom: "Générique", icone: "film" },
  broll: { nom: "Illustration", icone: "image" },
  autre: { nom: "Effet", icone: "baguette" },
};

/** Noms des 13 modèles de cartes (mêmes noms que la bibliothèque motion). */
const NOMS_MODELE: Record<string, string> = {
  liste: "Liste",
  chiffre: "Chiffre qui compte",
  "avant-apres": "Avant / après",
  "ligne-de-temps": "Ligne de temps",
  "deux-colonnes": "Comparaison",
  titre: "Titre",
  graphique: "Graphique",
  "icone-mot": "Icône + mot",
  "probleme-solution": "Problème → solution",
  "check-list": "Check-list",
  "capture-annotee": "Capture annotée",
  "titre-plein-ecran": "Titre plein écran",
  documentaire: "Documentaire",
};

function nomDe(c: VueCarteVideo): string {
  const base = NOMS_PASSAGE[c.type] ?? NOMS_PASSAGE.autre;
  const modele = c.modele ? NOMS_MODELE[c.modele] : undefined;
  return modele ? `${base.nom} · ${modele}` : base.nom;
}

export function CartesVideoFacecam({ videoId, cartes, possible, envoi, geste }: { videoId: string; cartes: VueCarteVideo[]; possible: boolean; envoi: boolean; geste: Geste }) {
  const [modifiee, setModifiee] = useState<VueCarteVideo | null>(null);
  const [instant, setInstant] = useState("");
  const [textes, setTextes] = useState("");

  function ouvrir(c: VueCarteVideo) {
    setModifiee(c);
    setInstant(horloge(c.debutSec));
    setTextes(c.textes.join("\n"));
  }

  if (cartes.length === 0) {
    return <p className="py-6 text-center text-[15px] text-texte-doux">Aucune carte dans cette vidéo. Demandez-en une au monteur : « à 0:32, montre les 3 étapes ».</p>;
  }

  const lignes = textes.split("\n").map((t) => t.trim());
  const texteChange = !!modifiee && lignes.filter(Boolean).join("\n") !== modifiee.textes.join("\n");

  return (
    <>
      <ul className="divide-y divide-trait">
        {cartes.map((c) => {
          const n = NOMS_PASSAGE[c.type] ?? NOMS_PASSAGE.autre;
          const retiree = c.etat === "retiree";
          return (
            <li key={`${c.origine}-${c.id}`} className="flex items-center gap-3 py-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-texte-doux", retiree && "opacity-50")}>
                <Icone nom={n.icone} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[15px] text-texte", retiree && "text-texte-doux line-through decoration-texte-faible/60")}>
                  {nomDe(c)}
                  {c.origine === "auto" && (
                    <Pastille ton="neutre" className="ml-2">
                      Automatique
                    </Pastille>
                  )}
                  {c.effetRate && (
                    <Pastille ton="ambre" className="ml-2">
                      Non réussi
                    </Pastille>
                  )}
                </span>
                <span className="block truncate text-sm tabular-nums text-texte-faible">
                  {horloge(c.debutSec)}
                  {c.textes.length ? ` · ${c.textes.filter(Boolean).join(" · ")}` : ""}
                </span>
                {c.etat === "masquee" && <span className="block text-sm text-texte-faible">Cachée : une carte du monteur passe au même moment.</span>}
                {retiree && <span className="block text-sm text-texte-faible">Retirée : elle ne reviendra pas.</span>}
              </span>
              {possible &&
                (retiree ? (
                  <Bouton variante="contour" disabled={envoi} onClick={() => geste(() => remettreCarteAutoAction(videoId, c.id), "Carte remise")} className="shrink-0">
                    Remettre
                  </Bouton>
                ) : (
                  <span className="flex shrink-0 gap-1">
                    {(c.deplacable || c.texteModifiable) && (
                      <Bouton variante="fantome" disabled={envoi} onClick={() => ouvrir(c)}>
                        Modifier
                      </Bouton>
                    )}
                    <Bouton
                      variante="fantome"
                      disabled={envoi}
                      onClick={() => geste(() => (c.origine === "auto" ? retirerCarteAutoAction(videoId, c.id) : retirerPassageAction(videoId, c.id)), c.origine === "auto" ? "Carte retirée" : "Élément retiré")}
                    >
                      Retirer
                    </Bouton>
                  </span>
                ))}
            </li>
          );
        })}
      </ul>

      <Dialogue ouvert={!!modifiee} onOuvertChange={(v) => !v && setModifiee(null)} titre={modifiee ? nomDe(modifiee) : "Carte"} description="Un geste à la fois : la nouvelle version arrive, l'actuelle reste visible en attendant.">
        {modifiee && (
          <div className="space-y-5">
            {modifiee.deplacable && (
              <div className="flex items-end gap-2">
                <Champ libelle="Moment dans la vidéo" aide="Par exemple 0:32. Même durée, seule la piste habillée est refaite." value={instant} onChange={(e) => setInstant(e.target.value)} inputMode="decimal" className="flex-1" />
                <Bouton
                  variante="contour"
                  icone="coche"
                  disabled={envoi || !instant.trim() || instant.trim() === horloge(modifiee.debutSec)}
                  onClick={() => geste(() => deplacerCarteAction(videoId, modifiee.origine, modifiee.id, instant), `Carte déplacée à ${instant.trim()}`, () => setModifiee(null))}
                  className="mb-[22px] shrink-0"
                >
                  Déplacer
                </Bouton>
              </div>
            )}
            {modifiee.texteModifiable && (
              <div>
                <ZoneTexte libelle="Texte de la carte" aide="Une ligne par texte (titre, puis chaque point)." value={textes} onChange={(e) => setTextes(e.target.value)} rows={4} />
                <Bouton
                  variante="contour"
                  icone="ecrire"
                  pleineLargeur
                  disabled={envoi || !texteChange || !lignes.some(Boolean)}
                  onClick={() => geste(() => changerTexteCarteAction(videoId, modifiee.origine, modifiee.id, lignes), "Texte de la carte changé", () => setModifiee(null))}
                  className="mt-2"
                >
                  Changer le texte
                </Bouton>
              </div>
            )}
          </div>
        )}
      </Dialogue>
    </>
  );
}
