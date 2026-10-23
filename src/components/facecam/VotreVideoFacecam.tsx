"use client";

/**
 * « VOTRE VIDÉO » FACE CAMÉRA (plan facecam v4, § C.5, B.12, B.25 et B.26 ; lot D), sous le lecteur.
 * - « 3 passages retirés · 2:11 → 1:34 » (touchable : feuille Coupes).
 * - « J'ai compris N consignes », chacune avec « Annuler ».
 * - Feuilles FACULTATIVES, rien n'oblige à y toucher : Coupes (Rétablir), Retoucher l'image (3 crans + « Garder pour
 *   les prochaines vidéos »), Cartes (toutes, automatiques comprises : retirer, déplacer, changer le texte),
 *   Sous-titres, Revenir à la version d'avant.
 * - Le fil « Discuter avec mon monteur ».
 * Aucun prix. Chaque geste crée une nouvelle version ; l'ancienne reste visible pendant le recalcul.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { annulerConsigneAction, basculerCoupeAction, reessayerEffetAction, retoucherImageAction, revenirVersionAvantAction, validerMonLookAction } from "@/app/(studio)/videos/actions-facecam";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Dialogue } from "@/components/ui/Dialogue";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { CranImage, ImageFacecam } from "@/domaine/facecam";
import { phraseConsignes } from "@/domaine/facecam-parcours";
import { cn } from "@/lib/cn";
import { horloge } from "@/moteurs/montage-facecam/monteur/temps";
import type { VueVotreVideo } from "@/services/monteur-facecam";
import { CartesVideoFacecam } from "./CartesVideoFacecam";
import { FilMonteur } from "./FilMonteur";
import { FormatsFacecam } from "./FormatsFacecam";

type Feuille = "coupes" | "image" | "cartes" | null;

const REGLAGES_IMAGE: { cle: keyof ImageFacecam; libelle: string; detail: string }[] = [
  { cle: "lumiere", libelle: "Lumière", detail: "Votre visage plus ou moins éclairé" },
  { cle: "couleurs", libelle: "Couleurs", detail: "Plus vives ou plus douces" },
  { cle: "mine", libelle: "Bonne mine", detail: "Teint, cernes" },
  { cle: "dents", libelle: "Dents", detail: "Blancheur, seulement bouche ouverte" },
];
const CRANS: { valeur: CranImage; libelle: string }[] = [
  { valeur: "moins", libelle: "Moins" },
  { valeur: "juste", libelle: "Juste" },
  { valeur: "plus", libelle: "Plus" },
];
/** Ouvre l'onglet Sous-titres de la fiche (Radix l'active au focus) et y descend. */
function allerAuxSousTitres() {
  const onglet = document.querySelector<HTMLElement>('[role="tab"][id$="-trigger-sous-titres"]');
  onglet?.focus();
  window.setTimeout(() => onglet?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
}

/** `avecOngletSousTitres` : la fiche porte l'onglet Sous-titres ; sinon la puce « Sous-titres » n'est pas montrée. */
export function VotreVideoFacecam({ videoId, vue, possible, avecOngletSousTitres = true }: { videoId: string; vue: VueVotreVideo; possible: boolean; avecOngletSousTitres?: boolean }) {
  const router = useRouter();
  const [feuille, setFeuille] = useState<Feuille>(null);
  const [confirmerRetour, setConfirmerRetour] = useState(false);
  const [envoi, demarrer] = useTransition();
  const [image, setImage] = useState<ImageFacecam>(vue.image);
  const [garderLook, setGarderLook] = useState(false);

  const consignes = vue.consignes.filter((c) => c.etat === "appliquee" || c.etat === "comprise");
  const nonComprises = vue.consignes.filter((c) => c.etat === "non-comprise");
  const effetsRates = vue.passages.filter((p) => p.effetRate);
  // 10/10 : toutes les cartes et tous les effets visibles dans la vidéo (cartes automatiques comprises).
  const nbCartes = vue.cartes.filter((c) => c.etat === "posee").length;
  const phrase = phraseConsignes(consignes.length);

  function geste(action: () => Promise<{ ok: true } | { ok: false; message: string }>, succes: string, apres?: () => void, detail = "La nouvelle version arrive ; l'ancienne reste visible en attendant.") {
    demarrer(async () => {
      const r = await action();
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(succes, detail);
      apres?.();
      router.refresh();
    });
  }

  const imageChangee = REGLAGES_IMAGE.some((r) => image[r.cle] !== vue.image[r.cle]);

  return (
    <div className="mt-4 space-y-4">
      {/* V6 P0 n° 5 : premier usage — Will valide son look une fois ; il suit ensuite toutes ses vidéos. */}
      {vue.lookAValider && possible && (
        <section aria-label="Votre look" className="rounded-carte border border-orange-vif/40 bg-orange-doux p-4">
          <h3 className="flex items-center gap-2 font-semibold text-texte">
            <Icone nom="contraste" size={18} className="text-orange-vif" />
            Votre look
          </h3>
          <p className="mt-1 text-[15px] text-texte-doux">Première vidéo : regardez la lumière, les couleurs, la bonne mine et les dents. Si elles vous plaisent, validez-les une fois : toutes vos prochaines vidéos les reprendront.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Bouton icone="coche" chargement={envoi} onClick={() => geste(() => validerMonLookAction(videoId), "Look validé", undefined, "Vos prochaines vidéos le reprendront.")}>
              C&apos;est mon look
            </Bouton>
            <Bouton
              variante="contour"
              disabled={envoi}
              onClick={() => {
                setGarderLook(true);
                setFeuille("image");
              }}
            >
              Le régler d&apos;abord
            </Bouton>
          </div>
        </section>
      )}

      {/* Résumé des coupes */}
      <button
        type="button"
        onClick={() => setFeuille("coupes")}
        className="flex min-h-14 w-full items-center gap-3 rounded-carte border border-trait bg-surface-1 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif">
          <Icone nom="ciseaux" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold tabular-nums text-texte">{vue.resumeCoupes.phrase}</span>
          {vue.resumeCoupes.details.length > 0 && <span className="block truncate text-sm text-texte-faible">{vue.resumeCoupes.details.join(" · ")}</span>}
        </span>
        <Icone nom="chevron-droite" size={18} className="shrink-0 text-texte-faible" />
      </button>

      {/* Consignes comprises */}
      {(phrase || nonComprises.length > 0) && (
        <section aria-label="Vos consignes" className="rounded-carte border border-trait bg-surface-1 p-4">
          {phrase && (
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-texte">
              <Icone nom="coche" size={18} className="text-sauge" />
              {phrase}
            </h3>
          )}
          <ul className="divide-y divide-trait">
            {consignes.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <Icone nom={c.origine === "voix" ? "micro" : "ecrire"} size={15} className="shrink-0 text-texte-faible" aria-label={c.origine === "voix" ? "Dite pendant le tournage" : "Écrite"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-texte">{c.resume ?? c.texte}</span>
                  {c.resume && <span className="block truncate text-sm text-texte-faible">« {c.texte} »</span>}
                </span>
                {possible && (
                  <Bouton variante="fantome" disabled={envoi} onClick={() => geste(() => annulerConsigneAction(videoId, c.id), "Consigne annulée")} className="shrink-0">
                    Annuler
                  </Bouton>
                )}
              </li>
            ))}
            {nonComprises.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <Icone nom="info" size={15} className="shrink-0 text-ambre" />
                <span className="min-w-0 flex-1 text-[15px] text-texte-doux">
                  Pas comprise : « {c.texte} »
                </span>
              </li>
            ))}
          </ul>
          {nonComprises.length > 0 && <p className="mt-2 text-sm text-texte-faible">Reformulez-la au monteur, juste en dessous.</p>}
        </section>
      )}

      {/* Effets ratés */}
      {effetsRates.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-carte border border-ambre/40 bg-ambre-doux px-4 py-3">
          <Icone nom="attention" size={18} className="shrink-0 text-ambre" />
          <p className="min-w-0 flex-1 text-[15px] text-texte">{p.effetRealiste ? "Effet non réussi : la version gratuite est livrée." : "Effet non réussi : la vidéo est livrée sans lui."}</p>
          {possible && (
            <Bouton
              variante="contour"
              icone="reessayer"
              disabled={envoi}
              onClick={() => geste(() => reessayerEffetAction(videoId, p.id), p.effetRealiste ? "Confirmez dans le fil" : "Effet relancé", undefined, p.effetRealiste ? "Option payante : rien ne repart sans votre accord." : undefined)}
              className="shrink-0"
            >
              {"Refaire l'effet"}
            </Bouton>
          )}
        </div>
      ))}

      {/* Feuilles facultatives */}
      <nav aria-label="Retoucher si besoin" className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Puce icone="ciseaux" onClick={() => setFeuille("coupes")}>
          Coupes
        </Puce>
        <Puce icone="contraste" onClick={() => setFeuille("image")}>
          Retoucher l&apos;image
        </Puce>
        <Puce icone="etincelles" onClick={() => setFeuille("cartes")}>
          Cartes{nbCartes ? ` · ${nbCartes}` : ""}
        </Puce>
        {avecOngletSousTitres && (
          <Puce icone="sous-titres" onClick={allerAuxSousTitres}>
            Sous-titres
          </Puce>
        )}
        {vue.avecVersionAvant && (
          <Puce icone="repeter" onClick={() => setConfirmerRetour(true)}>
            Version d&apos;avant
          </Puce>
        )}
      </nav>

      {/* Lot F1 : formats de la vidéo, une seule ligne de pastilles (9:16 toujours fait). */}
      {vue.formats && <FormatsFacecam videoId={videoId} vue={vue.formats} possible={possible} />}

      <FilMonteur videoId={videoId} fil={vue.fil} exemples={vue.exemples} exemplesEffets={vue.exemplesEffets} possible={possible} />

      {/* Coupes */}
      <FeuilleBas ouverte={feuille === "coupes"} onOuverteChange={(v) => setFeuille(v ? "coupes" : null)} titre="Coupes" description="Rien n'est effacé : touchez « Rétablir » pour remettre un passage.">
        {vue.coupes.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-texte-doux">Rien n&apos;a été coupé dans cette vidéo.</p>
        ) : (
          <ul className="divide-y divide-trait">
            {vue.coupes.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px]", c.retablie ? "text-texte" : "text-texte-doux line-through decoration-texte-faible/60")}>{c.libelle}</span>
                  <span className="block text-sm tabular-nums text-texte-faible">
                    {horloge(c.debutSec)} – {horloge(c.finSec)} · {Math.max(0.1, c.finSec - c.debutSec).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s
                  </span>
                </span>
                {possible && (
                  <Bouton variante={c.retablie ? "fantome" : "contour"} disabled={envoi} onClick={() => geste(() => basculerCoupeAction(videoId, c.id, !c.retablie), c.retablie ? "Passage retiré" : "Passage rétabli")} className="shrink-0">
                    {c.retablie ? "Retirer" : "Rétablir"}
                  </Bouton>
                )}
              </li>
            ))}
          </ul>
        )}
      </FeuilleBas>

      {/* Image */}
      <FeuilleBas
        ouverte={feuille === "image"}
        onOuverteChange={(v) => setFeuille(v ? "image" : null)}
        titre="Retoucher l'image"
        description="Réglé une fois, votre look suit toutes vos vidéos."
        pied={
          possible ? (
            <Bouton
              pleineLargeur
              icone="coche"
              chargement={envoi}
              disabled={!imageChangee && !garderLook}
              onClick={() => geste(() => retoucherImageAction(videoId, image, garderLook), garderLook ? "Look gardé pour les prochaines vidéos" : "Image retouchée", () => setFeuille(null))}
            >
              Appliquer
            </Bouton>
          ) : undefined
        }
      >
        <div className="space-y-5 pb-2">
          {REGLAGES_IMAGE.map((r) => (
            <div key={r.cle}>
              <SelecteurPastilles libelle={r.libelle} valeur={image[r.cle]} onChange={(v) => setImage((x) => ({ ...x, [r.cle]: v }))} options={CRANS} />
              <p className="mt-1 text-sm text-texte-faible">{r.detail}</p>
            </div>
          ))}
          <CaseACocher coche={garderLook} onChange={setGarderLook} libelle="Garder pour les prochaines vidéos" detail={vue.look ? "Remplace le look gardé jusqu'ici." : undefined} />
        </div>
      </FeuilleBas>

      {/* Cartes et éléments */}
      <FeuilleBas ouverte={feuille === "cartes"} onOuverteChange={(v) => setFeuille(v ? "cartes" : null)} titre="Cartes et effets" description="Toutes les cartes de la vidéo, automatiques comprises. Pour en ajouter, demandez-le au monteur.">
        <CartesVideoFacecam videoId={videoId} cartes={vue.cartes} possible={possible} envoi={envoi} geste={geste} />
      </FeuilleBas>

      <Dialogue
        ouvert={confirmerRetour}
        onOuvertChange={setConfirmerRetour}
        titre="Revenir à la version d'avant ?"
        description="La version actuelle reste dans l'historique : vous pourrez y revenir."
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setConfirmerRetour(false)}>
              Rester ici
            </Bouton>
            <Bouton icone="repeter" chargement={envoi} onClick={() => geste(() => revenirVersionAvantAction(videoId), "Version d'avant remise", () => setConfirmerRetour(false))}>
              Revenir
            </Bouton>
          </>
        }
      />
    </div>
  );
}

function Puce({ icone, onClick, children }: { icone: NomIcone; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-trait bg-surface-1 px-4 text-sm font-semibold text-texte-doux transition-colors hover:bg-surface-2 hover:text-texte">
      <Icone nom={icone} size={16} />
      {children}
    </button>
  );
}
