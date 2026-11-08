"use client";

/**
 * ÉCRAN 1 · MODE TEXTE (R6b) · « Ou décrivez-la avec vos mots ». Will tape l'automatisation voulue comme dans un chat ;
 * l'IA conçoit le workflow (la cible est déduite du texte), puis la vidéo se fabrique comme avec une image. Même prix
 * « au plus » que pour l'image (bouton commun, rien ne part sans ce prix confirmé). Un refus (texte trop court, trop
 * long, ou schéma impossible) s'affiche en phrase simple et le texte reste là pour être reformulé.
 */
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { deposerTexteImageVideoAction } from "@/app/(studio)/image-video/actions";
import { BoutonFabriquer } from "@/components/formats/commun/BoutonFabriquer";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { ReseauIV } from "@/domaine/image-video/plafonds";

/** Longueur maximale du texte (même borne que le serveur, `CARACTERES_MAX` du moteur du mode texte). */
export const CARACTERES_MAX_TEXTE_IV = 4000;

export function DepotTexte({ texte, onTexte, reseaux, montant, blocage, onRefus, children }: { texte: string; onTexte: (t: string) => void; reseaux: ReseauIV[]; montant: number; blocage?: string; onRefus: (phrase: string | null) => void; /** Sélecteur de réseaux, placé entre le texte et la barre du prix. */ children?: ReactNode }) {
  const router = useRouter();
  const pret = texte.trim().length > 0 && texte.length <= CARACTERES_MAX_TEXTE_IV && reseaux.length > 0 && !blocage;

  async function fabriquer(accord: number): Promise<{ centimes: number } | void> {
    onRefus(null);
    const r = await deposerTexteImageVideoAction({ texte, reseaux, accordCentimes: accord });
    if (!r.ok) return void onRefus(r.message);
    if (r.donnees.statut === "accord-requis") return { centimes: r.donnees.centimes };
    if (r.donnees.statut === "refusee") return void onRefus(r.donnees.phrase);
    router.push(`/image-video/${r.donnees.videoId}`);
  }

  return (
    <>
      <ZoneTexte
        libelle="Votre titre ou votre idée"
        aide="Le studio écrit le script. Vous le relisez et le modifiez avant la fabrication."
        placeholder="Par exemple : relancer une facture impayée sans y penser."
        value={texte}
        longueurMax={CARACTERES_MAX_TEXTE_IV}
        rows={4}
        onChange={(e) => {
          onTexte(e.target.value);
          onRefus(null);
        }}
      />
      {children}
      {blocage && <p className="text-[15px] text-texte-doux">{blocage}</p>}
      <BarreActionCollee>
        <BoutonFabriquer montantCentimes={montant} libelle="Écrire le script" desactive={!pret} onFabriquer={fabriquer} />
      </BarreActionCollee>
    </>
  );
}
