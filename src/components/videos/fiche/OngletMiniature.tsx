"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { choisirMiniatureAction, fixerCouvertureVignetteAction, refaireMiniaturesAction, refaireToutesLesVignettesAction, refaireVignettesAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { titreCommenceParCodeInterne } from "@/domaine/miniatures";
import { cn } from "@/lib/cn";

export interface MiniatureVue {
  id: string;
  url: string;
  titre: string;
  choisie: boolean;
  /** Lot R4 : le titre est écrit sur l'image (l'aperçu ne le repose pas ; le changer refait l'image). */
  incrustee?: boolean;
}

type Apercu = "instagram" | "youtube";

/** Miniature (niveau 3) : 3 propositions, titre de couverture, aperçu Instagram (4:5) et YouTube (16:9). */
export function OngletMiniature({ videoId, miniatures, dureeLibelle, couverture }: { videoId: string; miniatures: MiniatureVue[]; dureeLibelle: string; couverture?: { texte: string; motCle: string; fixee: boolean } }) {
  const router = useRouter();
  const initiale = miniatures.find((m) => m.choisie) ?? miniatures[0];
  const [choisie, setChoisie] = useState(initiale?.id);
  const [apercu, setApercu] = useState<Apercu>("instagram");
  const [titreVignette, setTitreVignette] = useState(couverture?.texte ?? "");
  const [motCle, setMotCle] = useState(couverture?.motCle ?? "");
  const [enCours, demarrer] = useTransition();

  if (!miniatures.length) return <EtatVide compact icone="image" titre="Pas encore de miniature" />;
  const courante = miniatures.find((m) => m.id === choisie) ?? miniatures[0];
  const modifie = courante.id !== initiale?.id;
  const ecrit = !!courante.incrustee;
  const aCode = miniatures.some((m) => titreCommenceParCodeInterne(m.titre));
  const mots = titreVignette.trim().split(/\s+/).filter(Boolean).length;
  const couvertureModifiee = titreVignette.trim() !== (couverture?.texte ?? "") || motCle.trim() !== (couverture?.motCle ?? "");
  // Titre facultatif : vide = l'image de la vidéo telle quelle.
  const motsValides = mots === 0 || (mots >= 3 && mots <= 5);

  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-3 gap-2">
        {miniatures.slice(0, 3).map((m, i) => {
          const actif = m.id === courante.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={actif}
                aria-label={`Proposition ${i + 1}`}
                onClick={() => {
                  setChoisie(m.id);
                }}
                className={cn("relative block aspect-[9/16] w-full overflow-hidden rounded-xl border-2 transition-[border-color,transform] duration-200", actif ? "scale-[1.02] border-orange shadow-orange" : "border-trait hover:border-trait-fort")}
              >
                <Image src={m.url} alt="" fill sizes="(max-width: 640px) 33vw, 160px" className="object-cover" />
                {actif && (
                  <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-orange text-sur-orange">
                    <Icone nom="coche" size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3">
        <Champ
          libelle="Titre de la vignette"
          value={titreVignette}
          onChange={(e) => setTitreVignette(e.target.value)}
          maxLength={60}
          aide={mots === 0 ? "Facultatif : sans titre, l'image de la vidéo reste telle quelle." : mots > 5 ? "5 mots au plus." : mots < 3 ? "3 à 5 mots." : couverture && !couverture.fixee ? "Proposé par le studio : changez-le si vous le souhaitez." : "L'image est refaite à chaque changement."}
        />
        <Champ libelle="Mot à mettre en valeur" value={motCle} onChange={(e) => setMotCle(e.target.value)} maxLength={30} aide="Un mot du titre, facultatif." />
        {couvertureModifiee && (
          <Bouton
            icone="coche"
            chargement={enCours}
            disabled={!motsValides}
            onClick={() =>
              demarrer(async () => {
                const r = await fixerCouvertureVignetteAction(videoId, titreVignette.trim(), motCle.trim());
                if (!r.ok) {
                  notifier.erreur(r.message);
                  return;
                }
                notifier.succes("Vignette refaite avec votre titre");
                router.refresh();
              })
            }
          >
            {mots === 0 ? "Retirer le titre et refaire l’image" : "Enregistrer et refaire l’image"}
          </Bouton>
        )}
      </div>

      {modifie && (
        <Bouton
          icone="coche"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await choisirMiniatureAction(videoId, courante.id);
              if (!r.ok) {
                notifier.erreur(r.message);
                return;
              }
              notifier.succes("Miniature choisie");
              router.refresh();
            })
          }
        >
          Garder cette miniature
        </Bouton>
      )}

      <div className="flex flex-wrap gap-2">
        <Bouton
          variante="secondaire"
          icone="image"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await refaireVignettesAction(videoId);
              if (!r.ok) {
                notifier.erreur(r.message);
                return;
              }
              notifier.succes("Vignettes refaites, les anciennes sont gardées");
              router.refresh();
            })
          }
        >
          Refaire les vignettes
        </Bouton>
        <Bouton
          variante="secondaire"
          icone="image"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await refaireToutesLesVignettesAction();
              if (!r.ok) {
                notifier.erreur(r.message);
                return;
              }
              const { videos, erreurs, restantes } = r.donnees;
              notifier.succes(`${videos} vidéo${videos > 1 ? "s" : ""} refaite${videos > 1 ? "s" : ""}${erreurs ? `, ${erreurs} en échec` : ""}${restantes ? ` · il en reste ${restantes} : relancez` : ""}`);
              router.refresh();
            })
          }
        >
          Refaire toutes les vignettes
        </Bouton>
      </div>

      {aCode && (
        <Bouton
          variante="secondaire"
          icone="image"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await refaireMiniaturesAction(videoId);
              if (!r.ok) {
                notifier.erreur(r.message);
                return;
              }
              notifier.succes("Miniatures refaites sans le code");
              router.refresh();
            })
          }
        >
          Refaire les miniatures
        </Bouton>
      )}

      <div>
        <div role="tablist" aria-label="Aperçu" className="mb-3 inline-flex rounded-full border border-trait bg-surface-1 p-1">
          {(["instagram", "youtube"] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={apercu === a}
              onClick={() => setApercu(a)}
              className={cn("min-h-11 rounded-full px-4 text-sm font-semibold transition-colors", apercu === a ? "bg-texte text-fond" : "text-texte-doux hover:text-texte")}
            >
              {a === "instagram" ? "Instagram" : "YouTube"}
            </button>
          ))}
        </div>

        {apercu === "instagram" ? (
          <div className="grid max-w-sm grid-cols-3 gap-0.5 overflow-hidden rounded-xl border border-trait">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={cn("relative aspect-[4/5]", i === 0 ? "" : "bg-surface-2")}>
                {i === 0 ? (
                  <>
                    <Image src={courante.url} alt="" fill sizes="130px" className="object-cover" />
                    {!ecrit && <span className="absolute inset-x-1.5 bottom-1.5 line-clamp-3 font-titre text-[11px] uppercase leading-tight text-texte">{titreVignette}</span>}
                  </>
                ) : (
                  <span aria-hidden className="absolute inset-0 lueur opacity-40" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-sm">
            <div className="relative aspect-video overflow-hidden rounded-xl border border-trait">
              <Image src={courante.url} alt="" fill sizes="384px" className="object-cover" />
              {!ecrit && <span className="absolute inset-y-0 left-4 flex max-w-[60%] items-center font-titre text-lg uppercase leading-tight text-texte">{titreVignette}</span>}
              <span className="absolute bottom-2 right-2 rounded bg-fond/80 px-1.5 text-[11px] font-bold tabular-nums text-texte">{dureeLibelle}</span>
            </div>
            <div className="mt-2 flex gap-2.5">
              <span className="size-9 shrink-0 rounded-full bg-orange" aria-hidden />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-texte">{titreVignette || "Sans titre"}</p>
                <p className="text-xs text-texte-faible">Axion-IA</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
