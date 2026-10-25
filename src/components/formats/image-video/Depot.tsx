"use client";

/**
 * ÉCRAN 1 · DÉPOSER L'IMAGE (lot L16, plan § 8). Glisser-déposer ou choisir l'image, aperçu tout de suite, refus clair
 * avant tout envoi si elle fait moins de 800 px de côté. Réseaux (les quatre par défaut) et offre (selon l'image, ou
 * corrigée) en pastilles, puis le bouton commun « Fabriquer la vidéo » avec son prix : rien ne part sans ce prix confirmé.
 */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deposerImageVideoAction, deposerLotImageVideoAction } from "@/app/(studio)/image-video/actions";
import { BoutonFabriquer } from "@/components/formats/commun/BoutonFabriquer";
import { Bouton } from "@/components/ui/Bouton";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Carte } from "@/components/ui/Carte";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { notifier } from "@/components/ui/Toast";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { ZoneDepot } from "@/components/ui/ZoneDepot";
import type { Offre } from "@/formats/cas-concret/cas";
import { envoyerFichier, MESSAGE_ENVOI_RATE } from "@/lib/envoi-multipart";
import { ErreurLisible } from "@/lib/erreur-lisible";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { Precedent } from "@/domaine/sujets-traites";
import type { RefusSujetImageVideo } from "@/services/image-video-ecran";
import { DepotLot, type ItemLotIV } from "./DepotLot";
import { DepotTexte } from "./DepotTexte";
import { clicIgnore, controleServeurAvantPrix, PHRASE_PRIX_CHANGE, prixRedemandable } from "./sujet-deja-traite";
import { euros, garderLeLot, OFFRES_IV, refusDimensions, refusFichier, RESEAUX_ECRAN_IV, TYPES_IMAGE_ACCEPTES } from "./vue";

/** Destination du dépôt (dossier des entrées du studio). */
const CIBLE_DEPOT = { typeEntite: "entree", entiteId: "image-video" };

type Choisie = { url: string; nom: string; largeur: number; hauteur: number; fichierId?: string; envoi?: number };

/** Dimensions réelles de l'image, lues par le navigateur (0 × 0 si elle ne s'ouvre pas). */
function dimensions(url: string): Promise<{ largeur: number; hauteur: number }> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok({ largeur: img.naturalWidth, hauteur: img.naturalHeight });
    img.onerror = () => ok({ largeur: 0, hauteur: 0 });
    img.src = url;
  });
}

/** D1 : la même image existe dans un AUTRE type de vidéo ; l'avertissement ne bloque rien. */
function direAvertissement(av?: { precedents: Precedent[] }) {
  if (!av) return;
  const titres = av.precedents.slice(0, 3).map((p) => p.titre).join(" · ");
  notifier.info("Cette image existe déjà ailleurs", `Déjà faite dans un autre type de vidéo : ${titres}. Le dépôt continue.`);
}

export function Depot({ montants, blocage }: { /** Prix par nombre de réseaux cochés (centimes d'euro). */ montants: Record<number, number>; blocage?: string }) {
  const router = useRouter();
  const [image, setImage] = useState<Choisie | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [reseaux, setReseaux] = useState<ReseauIV[]>(RESEAUX_ECRAN_IV.map((r) => r.valeur));
  const [offre, setOffre] = useState<Offre | "image">("image");
  const [lot, setLot] = useState<ItemLotIV[]>([]);
  const [depasse, setDepasse] = useState(false);
  /** Mode texte (R6b) : décrire l'automatisation avec ses mots au lieu de déposer une image. */
  const [mode, setMode] = useState<"image" | "texte">("image");
  /** Le texte tapé reste gardé quand on change de mode. */
  const [texteLibre, setTexteLibre] = useState("");
  /** Image déjà traitée : le refus du serveur, avec ses précédents et son jeton. */
  const [refusImage, setRefusImage] = useState<RefusSujetImageVideo | null>(null);
  const [refaitEnCours, setRefaitEnCours] = useState(false);
  const verrouRefaire = useRef(false);
  const urlApercu = image?.url;
  useEffect(() => () => void (urlApercu && URL.revokeObjectURL(urlApercu)), [urlApercu]);

  /** Plusieurs images : une vignette chacune, vérifiée puis envoyée l'une après l'autre. */
  async function recevoirLot(fichiers: File[]) {
    const { gardes, phrase } = garderLeLot(fichiers);
    setDepasse(!!phrase);
    setRefus(null);
    const items: ItemLotIV[] = gardes.map((f, k) => ({ cle: `${Date.now()}-${k}`, url: URL.createObjectURL(f), nom: f.name, largeur: 0, hauteur: 0 }));
    setLot(items);
    const maj = (cle: string, plus: Partial<ItemLotIV>) => setLot((l) => l.map((x) => (x.cle === cle ? { ...x, ...plus } : x)));
    for (const [k, f] of gardes.entries()) {
      const it = items[k];
      const mauvais = refusFichier(f);
      if (mauvais) {
        maj(it.cle, { refus: mauvais });
        continue;
      }
      const d = await dimensions(it.url);
      const tropPetite = refusDimensions(d.largeur, d.hauteur);
      if (tropPetite) {
        maj(it.cle, { ...d, refus: tropPetite });
        continue;
      }
      maj(it.cle, { ...d, envoi: 0 });
      try {
        const r = await envoyerFichier(f, CIBLE_DEPOT, { onProgression: (p) => maj(it.cle, { envoi: p }) });
        maj(it.cle, { fichierId: r.fichierId, envoi: undefined });
      } catch (e) {
        maj(it.cle, { envoi: undefined, refus: e instanceof ErreurLisible && e.message ? e.message : MESSAGE_ENVOI_RATE });
      }
    }
  }

  function retirerDuLot(cle: string) {
    const reste = lot.filter((x) => x.cle !== cle);
    const retire = lot.find((x) => x.cle === cle);
    if (retire) URL.revokeObjectURL(retire.url);
    setDepasse(false);
    // Une seule image restante, prête : retour au parcours d'une image seule.
    if (reste.length === 1 && reste[0].fichierId) {
      setImage({ url: reste[0].url, nom: reste[0].nom, largeur: reste[0].largeur, hauteur: reste[0].hauteur, fichierId: reste[0].fichierId });
      return setLot([]);
    }
    setLot(reste);
  }

  async function fabriquerLot(accord: number): Promise<{ centimes: number } | void> {
    const images = lot.filter((x) => x.fichierId).map((x) => ({ fichierId: x.fichierId!, largeur: x.largeur, hauteur: x.hauteur }));
    const r = await deposerLotImageVideoAction({ images, reseaux, ...(offre !== "image" ? { offre } : {}), accordCentimes: accord });
    if (!r.ok) return void setRefus(r.message);
    if (r.donnees.statut === "accord-requis") return { centimes: r.donnees.centimes };
    if (r.donnees.statut === "refusee") return void setRefus(r.donnees.phrase);
    if (r.donnees.statut === "lancee" && r.donnees.phraseSautees) notifier.info("Images déjà traitées", r.donnees.phraseSautees);
    router.push(`/image-video/lot/${r.donnees.lotId}`);
  }

  async function recevoir(fichiers: File[]) {
    if (fichiers.length > 1) return recevoirLot(fichiers);
    const f = fichiers[0];
    if (!f) return;
    setRefus(null);
    const mauvais = refusFichier(f);
    if (mauvais) return setRefus(mauvais);
    const url = URL.createObjectURL(f);
    const { largeur, hauteur } = await dimensions(url);
    const tropPetite = refusDimensions(largeur, hauteur);
    if (tropPetite) {
      URL.revokeObjectURL(url);
      setImage(null);
      return setRefus(tropPetite);
    }
    setImage({ url, nom: f.name, largeur, hauteur, envoi: 0 });
    try {
      const r = await envoyerFichier(f, CIBLE_DEPOT, { onProgression: (p) => setImage((x) => (x && x.url === url ? { ...x, envoi: p } : x)) });
      setImage((x) => (x && x.url === url ? { ...x, fichierId: r.fichierId, envoi: undefined } : x));
    } catch (e) {
      setImage((x) => (x && x.url === url ? { ...x, envoi: undefined } : x));
      setRefus(e instanceof ErreurLisible && e.message ? e.message : MESSAGE_ENVOI_RATE);
    }
  }

  /** Lot : le serveur dit AVANT le prix quelles images sont déjà traitées (sautées) et le prix des autres. */
  async function controlerLotAvantPrix(): Promise<boolean | { centimes: number }> {
    const images = lot.filter((x) => x.fichierId).map((x) => ({ fichierId: x.fichierId!, largeur: x.largeur, hauteur: x.hauteur }));
    const r = await deposerLotImageVideoAction({ images, reseaux, ...(offre !== "image" ? { offre } : {}) }).catch(() => null);
    // Le contrôle n'a pas pu se faire (réseau) : le serveur le refera au vrai dépôt.
    if (!r) return true;
    if (!r.ok) return void setRefus(r.message), false;
    if (r.donnees.statut === "refusee") return void setRefus(r.donnees.phrase), false;
    if (r.donnees.statut === "accord-requis") {
      setRefus(null);
      if (r.donnees.sautees?.length) notifier.info("Images déjà traitées", r.donnees.phrase);
      return { centimes: r.donnees.centimes };
    }
    return true;
  }

  /** Image seule : le serveur contrôle l'image AVANT la fenêtre de prix ; une image déjà traitée n'ouvre jamais le prix. */
  async function controlerAvantPrix(): Promise<boolean> {
    if (!controleServeurAvantPrix() || !image?.fichierId) return true;
    const r = await deposerImageVideoAction({ fichierId: image.fichierId, reseaux, ...(offre !== "image" ? { offre } : {}), largeur: image.largeur, hauteur: image.hauteur }).catch(() => null);
    // Le contrôle n'a pas pu se faire (réseau) : le serveur le refera au vrai dépôt, rien n'est perdu.
    if (!r) return true;
    if (!r.ok) return void setRefus(r.message), false;
    if (r.donnees.statut === "sujet-deja-traite") return void setRefusImage(r.donnees), false;
    if (r.donnees.statut === "refusee") return void setRefus(r.donnees.phrase), false;
    setRefusImage(null);
    return true;
  }

  async function fabriquer(accord: number): Promise<{ centimes: number } | void> {
    if (!image?.fichierId) return;
    const r = await deposerImageVideoAction({ fichierId: image.fichierId, reseaux, ...(offre !== "image" ? { offre } : {}), largeur: image.largeur, hauteur: image.hauteur, accordCentimes: accord });
    if (!r.ok) return void setRefus(r.message);
    if (r.donnees.statut === "accord-requis") return { centimes: r.donnees.centimes };
    if (r.donnees.statut === "refusee") return void setRefus(r.donnees.phrase);
    // Une image devenue « déjà traitée » entre le contrôle et le dépôt : le panneau, jamais le dépôt.
    if (r.donnees.statut === "sujet-deja-traite") return void setRefusImage(r.donnees);
    direAvertissement(r.donnees.avertissement);
    router.push(`/image-video/${r.donnees.videoId}`);
  }

  /**
   * « Refaire quand même » : même image, même jeton. Le prix est demandé ICI (jamais gardé d'un refus à jeton périmé), redemandé
   * si le serveur le change (deux relances au plus), un seul envoi à la fois.
   */
  async function refaireQuandMeme(refus: RefusSujetImageVideo) {
    if (!image?.fichierId || clicIgnore(verrouRefaire.current)) return;
    verrouRefaire.current = true;
    setRefaitEnCours(true);
    try {
      let montantAffiche = montant;
      for (let essai = 0; ; essai++) {
        const accord = await confirmerPrix({ message: "Cette image a déjà une vidéo : vous en voulez une autre.", montant: montantAffiche });
        if (typeof accord !== "number") return;
        const r = await deposerImageVideoAction({ fichierId: image.fichierId, reseaux, ...(offre !== "image" ? { offre } : {}), largeur: image.largeur, hauteur: image.hauteur, accordCentimes: accord, sujet: { choix: "refaire", jeton: refus.jeton } });
        if (!r.ok) return void setRefus(r.message);
        const d = r.donnees;
        if (d.statut === "refusee") return void setRefus(d.phrase);
        // Les vidéos ont changé : nouveau refus, nouveau jeton, nouveau choix (le prix sera redemandé).
        if (d.statut === "sujet-deja-traite") return void setRefusImage(d);
        if (d.statut === "accord-requis") {
          if (!prixRedemandable(essai)) return void setRefus(PHRASE_PRIX_CHANGE);
          montantAffiche = d.centimes;
          continue;
        }
        direAvertissement(d.avertissement);
        return router.push(`/image-video/${d.videoId}`);
      }
    } finally {
      verrouRefaire.current = false;
      setRefaitEnCours(false);
    }
  }

  const montant = montants[reseaux.length] ?? montants[RESEAUX_IV.length] ?? 0;
  const pret = !!image?.fichierId && !blocage && reseaux.length > 0;

  if (lot.length > 1) {
    return (
      <div className="space-y-6">
        <DepotLot items={lot} montantParVideoCentimes={montant} reseaux={reseaux} offre={offre} onReseaux={setReseaux} onOffre={setOffre} onRetirer={retirerDuLot} onFabriquer={fabriquerLot} avantPrix={controlerLotAvantPrix} blocage={blocage} depasse={depasse} />
        {refus && (
          <p role="alert" className="rounded-2xl bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique">
            {refus}
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-label={mode === "texte" && !image ? "Décrire l'automatisation" : "Déposer l'image"} className="space-y-6">
      {!image && (
        <SelecteurPastilles
          libelle="Point de départ"
          libelleMasque
          options={[
            { valeur: "image" as const, libelle: "Déposer une image", icone: "image" },
            { valeur: "texte" as const, libelle: "Décrire avec mes mots" },
          ]}
          valeur={mode}
          onChange={(m) => (setRefus(null), setMode(m))}
        />
      )}
      {!image && mode === "texte" ? (
        <DepotTexte texte={texteLibre} onTexte={setTexteLibre} reseaux={reseaux} montant={montant} blocage={blocage} onRefus={setRefus}>
          {refus && (
            <p role="alert" className="rounded-2xl bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique">
              {refus}
            </p>
          )}
          <SelecteurPastilles multiple minimum={1} libelle="Les réseaux" options={RESEAUX_ECRAN_IV.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))} valeur={reseaux} onChange={setReseaux} />
        </DepotTexte>
      ) : !image ? (
        <ZoneDepot libelle="Déposez une ou plusieurs images" detail="PNG, JPEG ou WebP · 800 px de côté au moins" accepte={TYPES_IMAGE_ACCEPTES} multiple icone="image" essai={false} onFichiers={(f) => void recevoir(f)} />
      ) : (
        <Carte sansMarge className="overflow-hidden">
          {/* Aperçu local : l'image n'est jamais redimensionnée ici. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="Votre image" className="max-h-[60vh] w-full bg-surface-2 object-contain" />
          <div className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-texte-doux">
              {image.largeur} × {image.hauteur} px{image.envoi !== undefined ? ` · envoi ${image.envoi} %` : image.fichierId ? " · prête" : ""}
            </p>
            <Bouton variante="secondaire" icone="actualiser" onClick={() => (setRefusImage(null), setImage(null))}>
              Changer
            </Bouton>
          </div>
        </Carte>
      )}
      {refus && !(mode === "texte") && (
        <p role="alert" className="rounded-2xl bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique">
          {refus}
        </p>
      )}
      {refusImage && (
        <section aria-label="Image déjà traitée" role="alert" className="space-y-3 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
          <p className="font-semibold">{refusImage.jetonPerime ? "Les vidéos ont changé. Choisissez de nouveau." : refusImage.phrase}</p>
          <ul className="space-y-1 text-sm">
            {refusImage.precedents.slice(0, 5).map((p) => (
              <li key={p.videoId ?? p.sujetId ?? p.lien}>
                <Link href={p.lien} className="underline">
                  {p.titre}
                </Link>{" "}
                <span className="text-texte-doux">le {new Date(p.le).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Bouton variante="secondaire" onClick={() => (setRefusImage(null), setImage(null))}>
              Choisir une autre image
            </Bouton>
            <Bouton variante="secondaire" chargement={refaitEnCours} disabled={refaitEnCours || !!blocage} onClick={() => void refaireQuandMeme(refusImage)}>
              Refaire quand même
            </Bouton>
          </div>
        </section>
      )}
      {mode !== "texte" && <SelecteurPastilles multiple minimum={1} libelle="Les réseaux" options={RESEAUX_ECRAN_IV.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))} valeur={reseaux} onChange={setReseaux} />}
      {mode === "texte" && !image ? null : <SelecteurPastilles libelle="L'offre" options={[{ valeur: "image" as const, libelle: "Selon l'image" }, ...OFFRES_IV]} valeur={offre} onChange={setOffre} />}
      {blocage && mode !== "texte" && <p className="text-[15px] text-texte-doux">{blocage}</p>}
      {!(mode === "texte" && !image) && (
      <BarreActionCollee>
        <BoutonFabriquer montantCentimes={montant} libelle={`Fabriquer la vidéo (au plus ${euros(montant)})`} desactive={!pret} onFabriquer={fabriquer} avantPrix={controlerAvantPrix} message="Au plus ce prix. Seule la lecture de l'image part maintenant : la voix attend votre accord sur le script." />
      </BarreActionCollee>
      )}
    </section>
  );
}
