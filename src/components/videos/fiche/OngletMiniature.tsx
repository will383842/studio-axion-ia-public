"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { choisirMiniatureAction, refaireMiniaturesAction } from "@/app/(studio)/videos/actions";
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
export function OngletMiniature({ videoId, miniatures, dureeLibelle }: { videoId: string; miniatures: MiniatureVue[]; dureeLibelle: string }) {
  const router = useRouter();
  const initiale = miniatures.find((m) => m.choisie) ?? miniatures[0];
  const [choisie, setChoisie] = useState(initiale?.id);
  const [titre, setTitre] = useState(initiale?.titre ?? "");
  const [apercu, setApercu] = useState<Apercu>("instagram");
  const [enCours, demarrer] = useTransition();

  if (!miniatures.length) return <EtatVide compact icone="image" titre="Pas encore de miniature" />;
  const courante = miniatures.find((m) => m.id === choisie) ?? miniatures[0];
  const modifie = courante.id !== initiale?.id || titre !== (initiale?.titre ?? "");
  const ecrit = !!courante.incrustee;
  const refaire = ecrit && titre.trim() !== courante.titre.trim();
  const aCode = miniatures.some((m) => titreCommenceParCodeInterne(m.titre));
  const mots = titre.trim().split(/\s+/).filter(Boolean).length;

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
                  setTitre(m.titre);
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

      <Champ
        libelle="Titre de couverture"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        maxLength={60}
        aide={ecrit ? (mots > 5 ? "5 mots au plus sont écrits sur l'image : le titre sera raccourci." : "Le titre est écrit sur l'image : si vous le changez, l'image est refaite.") : undefined}
      />

      {modifie && (
        <Bouton
          icone="coche"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await choisirMiniatureAction(videoId, courante.id, titre.trim() || undefined);
              if (!r.ok) {
                notifier.erreur(r.message);
                return;
              }
              notifier.succes(refaire ? "Miniature refaite avec votre titre" : "Miniature choisie");
              router.refresh();
            })
          }
        >
          {refaire ? "Refaire l'image avec ce titre" : "Garder cette miniature"}
        </Bouton>
      )}

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
                    {!ecrit && <span className="absolute inset-x-1.5 bottom-1.5 line-clamp-3 font-titre text-[11px] uppercase leading-tight text-texte">{titre}</span>}
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
              {!ecrit && <span className="absolute inset-y-0 left-4 flex max-w-[60%] items-center font-titre text-lg uppercase leading-tight text-texte">{titre}</span>}
              <span className="absolute bottom-2 right-2 rounded bg-fond/80 px-1.5 text-[11px] font-bold tabular-nums text-texte">{dureeLibelle}</span>
            </div>
            <div className="mt-2 flex gap-2.5">
              <span className="size-9 shrink-0 rounded-full bg-orange" aria-hidden />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-texte">{titre || "Sans titre"}</p>
                <p className="text-xs text-texte-faible">Axion-IA</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
