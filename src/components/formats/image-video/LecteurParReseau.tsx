"use client";

/**
 * IMAGE → VIDÉO · « Vos vidéos » (lot I, décision de Williams du 08/11) : UN seul grand lecteur, dessous une puce par
 * réseau (et « Facebook · fil » s'il y a un fil) qui change la vidéo montrée, puis les actions du réseau choisi :
 * Valider, Télécharger, Copier le texte. Téléchargement par la route du studio (jamais un envoi programmé sur ces lignes :
 * le fichier enregistré est le 9:16 commun).
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { BoutonValider } from "@/components/videos/BoutonValider";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { LecteurVideo } from "@/components/ui/LecteurVideo";
import { LogoReseau } from "@/components/ui/LogoReseau";
import type { EtapeEditoriale } from "@/domaine/types";
import { cn } from "@/lib/cn";
import type { CarteReseauIV } from "./vue";

export type VideoAffichee = CarteReseauIV & { url?: string | null; urlFil?: string | null };

const POINT = { vert: "bg-sauge", orange: "bg-ambre", rouge: "bg-brique" } as const;

interface Puce {
  cle: string;
  v: VideoAffichee;
  fil: boolean;
  nom: string;
  duree?: string;
  url: string | null | undefined;
}

/** Les puces : une par réseau, plus « Facebook · fil » juste après Facebook quand il a un fil. PUR. */
export function pucesDe(videos: readonly VideoAffichee[]): Puce[] {
  const puces: Puce[] = [];
  for (const v of videos) {
    puces.push({ cle: v.reseau, v, fil: false, nom: v.nom, duree: v.duree, url: v.url });
    if (v.fil) puces.push({ cle: `${v.reseau}:fil`, v, fil: true, nom: `${v.nom} · fil`, duree: v.fil.duree, url: v.urlFil });
  }
  return puces;
}

/** Adresse de téléchargement par la route du studio (le fil Facebook porte `&fil=1`). PUR. */
export function adresseTelechargement(videoId: string, reseau: string, fil: boolean): string {
  return `/api/telechargements/video?video=${encodeURIComponent(videoId)}&reseau=${encodeURIComponent(reseau)}${fil ? "&fil=1" : ""}`;
}

/**
 * La route lit la livraison de la version ; une vidéo fabriquée par le lanceur n'en a pas (404). Dans ce cas, on prend
 * l'adresse directe de la vidéo montrée. Une route qui répond autrement (redirection) ou une erreur réseau : la route.
 */
export async function telechargerAvecSecours(
  adresse: string,
  secours: string | null | undefined,
  o: { sonder: (adresse: string) => Promise<number>; aller: (adresse: string) => void },
): Promise<void> {
  let statut = 0;
  try {
    statut = await o.sonder(adresse);
  } catch {
    statut = 0;
  }
  o.aller(statut === 404 && secours ? secours : adresse);
}

export function LecteurParReseau({ videoId, videos, prete, etape }: { videoId: string; videos: readonly VideoAffichee[]; prete: boolean; etape?: EtapeEditoriale }) {
  const puces = pucesDe(videos);
  const [choisie, setChoisie] = useState(puces[0]?.cle);
  const rangee = useRef<HTMLDivElement>(null);
  const id = useId();
  const courante = puces.find((p) => p.cle === choisie) ?? puces[0];
  if (!courante) return null;
  const { v, fil } = courante;
  const texte = fil ? v.fil?.texte : v.texte;
  const consigneLien = fil ? v.fil?.consigneLien : v.consigneLien;
  const adresse = adresseTelechargement(videoId, v.reseau, fil);
  const titre = !fil ? v.titre : undefined;

  function touche(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const pas = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!pas) return;
    e.preventDefault();
    const suivante = puces[(i + pas + puces.length) % puces.length]!;
    setChoisie(suivante.cle);
    rangee.current?.querySelector<HTMLButtonElement>(`[data-cle="${suivante.cle}"]`)?.focus();
  }

  return (
    <div className="space-y-4">
      {courante.url ? (
        <LecteurVideo key={courante.cle} src={courante.url} ratio={fil ? "4:5" : (v.format ?? "9:16")} titre={courante.nom} />
      ) : (
        <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-[15px] text-texte-doux">{v.phrase}</p>
      )}
      <div ref={rangee} role="tablist" aria-label="Choisir le réseau" className="flex flex-wrap gap-2">
        {puces.map((p, i) => {
          const active = p.cle === courante.cle;
          return (
            <button
              key={p.cle}
              type="button"
              role="tab"
              id={`${id}-${p.cle}`}
              data-cle={p.cle}
              aria-selected={active}
              aria-controls={`${id}-panneau`}
              tabIndex={active ? 0 : -1}
              onClick={() => setChoisie(p.cle)}
              onKeyDown={(e) => touche(e, i)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors",
                active ? "border-accent bg-accent-doux text-texte" : "border-trait bg-surface-1 text-texte-doux hover:text-texte",
              )}
            >
              <LogoReseau reseau={p.v.reseau} taille="sm" />
              <span>{p.nom}</span>
              {p.duree && <span className="font-normal text-texte-doux">{p.duree}</span>}
              <span aria-hidden className={cn("size-2 rounded-full", POINT[p.v.ton])} />
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panneau`} aria-labelledby={`${id}-${courante.cle}`} className="space-y-3">
        {titre && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-texte">{titre}</p>
            <BoutonCopier texte={titre} libelle="Copier le titre" />
          </div>
        )}
        {v.ton !== "vert" && <p className={cn("text-sm", v.ton === "rouge" ? "text-brique" : "text-texte-doux")}>{v.phrase}</p>}
        <div className="flex flex-wrap gap-2">
          <BoutonValider videoId={videoId} prete={prete} etape={etape} />
          {courante.url && (
            <Bouton asChild variante="secondaire" icone="telecharger">
              <a
                href={adresse}
                onClick={(e) => {
                  e.preventDefault();
                  void telechargerAvecSecours(adresse, courante.url, {
                    sonder: async (a) => (await fetch(a, { redirect: "manual", credentials: "same-origin" })).status,
                    aller: (a) => window.location.assign(a),
                  });
                }}
              >{fil ? "Télécharger le fil" : "Télécharger"}</a>
            </Bouton>
          )}
          {texte && <BoutonCopier texte={texte} libelle="Copier le texte" />}
          {!fil && v.premierCommentaire && <BoutonCopier texte={v.premierCommentaire} libelle="Copier le commentaire" />}
          {!fil && v.lien && <BoutonCopier texte={v.lien} libelle="Copier le lien" />}
        </div>
        {consigneLien && <p className="text-sm text-texte-doux">Le lien : {consigneLien}</p>}
        {texte && (
          <details className="rounded-2xl border border-trait bg-surface-1 px-4 py-3">
            <summary className="cursor-pointer text-[15px] font-semibold text-texte">Texte à publier</summary>
            <p className="mt-2 whitespace-pre-line text-sm text-texte-doux">{texte}</p>
          </details>
        )}
      </div>
    </div>
  );
}
