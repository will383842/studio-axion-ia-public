"use client";

/**
 * ÉCRAN 1 · DÉPOSER PLUSIEURS IMAGES (lot d'images, plan § e.1). Une vignette par image avec son état d'envoi ou son
 * refus en une phrase, les réseaux et l'offre communs à tout le lot, puis UN bouton au prix total « au plus » : rien ne
 * part sans ce prix confirmé. Présentation seulement : l'état (envois, retraits) vit dans `Depot`.
 */
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { BoutonFabriquer } from "@/components/formats/commun/BoutonFabriquer";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import type { Offre } from "@/formats/cas-concret/cas";
import { libelleBoutonLot, messageDuLot, OFFRES_IV, PHRASE_LOT_TROP_GRAND, RESEAUX_ECRAN_IV } from "./vue";

export interface ItemLotIV {
  cle: string;
  url: string;
  nom: string;
  largeur: number;
  hauteur: number;
  /** Posé quand l'image est arrivée au studio. */
  fichierId?: string;
  /** Avancement de l'envoi (0 à 100). */
  envoi?: number;
  /** Refus en une phrase : l'image n'est pas envoyée. */
  refus?: string;
}

/** Le lot peut-il partir ? Au moins 2 images, toutes prêtes, aucun refus. PUR. */
export const lotPret = (items: readonly ItemLotIV[]): boolean => items.length >= 2 && items.every((i) => !!i.fichierId && !i.refus);

export function DepotLot({
  items,
  montantParVideoCentimes,
  reseaux,
  offre,
  onReseaux,
  onOffre,
  onRetirer,
  onFabriquer,
  avantPrix,
  blocage,
  depasse,
}: {
  items: readonly ItemLotIV[];
  /** Prix « au plus » d'UNE vidéo pour les réseaux cochés (centimes d'euro). */
  montantParVideoCentimes: number;
  reseaux: ReseauIV[];
  offre: Offre | "image";
  onReseaux: (r: ReseauIV[]) => void;
  onOffre: (o: Offre | "image") => void;
  onRetirer: (cle: string) => void;
  /** Envoie l'accord TOTAL (montant confirmé). Rend `{ centimes }` si le serveur demande un autre montant. */
  onFabriquer: (accordTotalCentimes: number) => Promise<{ centimes: number } | void>;
  /** Contrôle des images déjà traitées AVANT la fenêtre de prix (voir `BoutonFabriquer`). */
  avantPrix?: () => Promise<boolean | { centimes: number }>;
  blocage?: string;
  /** Des images au-delà du maximum ont été écartées. */
  depasse?: boolean;
}) {
  const n = items.length;
  const pret = lotPret(items) && !blocage && reseaux.length > 0;
  return (
    <section aria-label="Déposer plusieurs images" className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((i) => (
          <li key={i.cle}>
            <Carte sansMarge className="overflow-hidden">
              {/* Aperçu local : l'image n'est jamais redimensionnée ici. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt={i.nom} className="aspect-square w-full bg-surface-2 object-cover" />
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-semibold text-texte">{i.nom}</p>
                {i.refus ? (
                  <p role="alert" className="text-sm font-semibold text-brique">
                    {i.refus}
                  </p>
                ) : (
                  <p className="text-sm text-texte-doux">{i.envoi !== undefined ? `envoi ${i.envoi} %` : i.fichierId ? "prête" : "…"}</p>
                )}
                <Bouton variante="fantome" taille="md" onClick={() => onRetirer(i.cle)}>
                  Retirer
                </Bouton>
              </div>
            </Carte>
          </li>
        ))}
      </ul>
      {depasse && <p className="text-[15px] font-semibold text-ambre">{PHRASE_LOT_TROP_GRAND}</p>}
      <SelecteurPastilles multiple minimum={1} libelle="Les réseaux" options={RESEAUX_ECRAN_IV.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))} valeur={reseaux} onChange={onReseaux} />
      <SelecteurPastilles libelle="L'offre" options={[{ valeur: "image" as const, libelle: "Selon l'image" }, ...OFFRES_IV]} valeur={offre} onChange={onOffre} />
      {blocage && <p className="text-[15px] text-texte-doux">{blocage}</p>}
      <p className="text-sm text-texte-doux">{messageDuLot(n)}</p>
      <BarreActionCollee>
        <BoutonFabriquer montantCentimes={n * montantParVideoCentimes} desactive={!pret} onFabriquer={onFabriquer} avantPrix={avantPrix} message={messageDuLot(n)} libelle={libelleBoutonLot(n, montantParVideoCentimes)} />
      </BarreActionCollee>
    </section>
  );
}
