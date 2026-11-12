"use client";

/**
 * ÉCRAN 1 · MODE TEXTE (R6b) · « Ou décrivez-la avec vos mots ». Will tape l'automatisation voulue comme dans un chat ;
 * l'IA conçoit le workflow (la cible est déduite du texte), puis la vidéo se fabrique comme avec une image. Même prix
 * « au plus » que pour l'image (bouton commun, rien ne part sans ce prix confirmé). Un refus (texte trop court, trop
 * long, ou schéma impossible) s'affiche en phrase simple et le texte reste là pour être reformulé.
 */
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChoixCible } from "@/components/ciblage/ChoixCible";
import { ChoixTypeAutomatisation } from "@/components/ciblage/ChoixTypeAutomatisation";
import { libelleCibleValide } from "@/domaine/ciblage/controles";
import type { Ciblage, NiveauCible, TypeAutomatisation } from "@/domaine/ciblage/types";
import { deposerTexteImageVideoAction } from "@/app/(studio)/image-video/actions";
import { BoutonFabriquer } from "@/components/formats/commun/BoutonFabriquer";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { ReseauIV } from "@/domaine/image-video/plafonds";

/** Longueur maximale du texte (même borne que le serveur, `CARACTERES_MAX` du moteur du mode texte). */
export const CARACTERES_MAX_TEXTE_IV = 4000;

/** Ciblage saisi à l'écran ; rien tant que la valeur est vide ou invalide (la cible reste facultative ici). */
export function ciblageDepose(niveau: NiveauCible | undefined, valeur: string): Ciblage | undefined {
  const libelle = valeur.trim();
  return niveau && libelleCibleValide(libelle) ? { niveau, libelle, origine: "saisie" } : undefined;
}

export function DepotTexte({ texte, onTexte, reseaux, montant, blocage, onRefus, onCiblage, children }: { texte: string; onTexte: (t: string) => void; reseaux: ReseauIV[]; montant: number; blocage?: string; onRefus: (phrase: string | null) => void; /** Cible et type choisis (facultatifs) ; non branchés au serveur par ce composant. */ onCiblage?: (c: { ciblage?: Ciblage; typeAutomatisation?: TypeAutomatisation }) => void; /** Sélecteur de réseaux, placé entre le texte et la barre du prix. */ children?: ReactNode }) {
  const router = useRouter();
  const [ciblage, setCiblage] = useState<Ciblage | undefined>();
  const [type, setType] = useState<TypeAutomatisation | undefined>();
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
      <ChoixCible
        nom="cible-iv"
        onChange={(niveau, valeur) => {
          const c = ciblageDepose(niveau, valeur);
          setCiblage(c);
          onCiblage?.({ ciblage: c, typeAutomatisation: type });
        }}
      />
      <div
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value as TypeAutomatisation | "";
          setType(v || undefined);
          onCiblage?.({ ciblage, typeAutomatisation: v || undefined });
        }}
      >
        <ChoixTypeAutomatisation nom="type-iv" valeur={type} />
      </div>
      {children}
      {blocage && <p className="text-[15px] text-texte-doux">{blocage}</p>}
      <BarreActionCollee>
        <BoutonFabriquer montantCentimes={montant} libelle="Écrire le script" desactive={!pret} onFabriquer={fabriquer} />
      </BarreActionCollee>
    </>
  );
}
