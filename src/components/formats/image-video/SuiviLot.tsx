"use client";

/**
 * PAGE DU LOT D'IMAGES (plan § e.2). Les vidéos mises de côté d'abord (« À relire »), puis tout le lot par rang avec
 * l'état de chacune. Une seule action par état : « Arrêter le lot », « Reprendre le lot » ou « Relire la première mise de
 * côté ». La page se relit seule tant que le lot avance (même mécanisme que l'écran « Fabrication » d'une vidéo).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { arreterLotImageVideoAction, refaireVideoDuLotAction, reprendreLotImageVideoAction } from "@/app/(studio)/image-video/actions";
import { SuiviFabrication } from "@/components/creation/SuiviFabrication";
import { ActionsSuivi } from "@/components/fabrication/ActionsSuivi";
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { PrevenirTelephone } from "@/components/fabrication/PrevenirTelephone";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import type { CarteVideoLotIV, VueLotIV } from "@/services/image-video-lot";
import { euros } from "./vue";
import { enteteSuiviLot, versSuiviLot } from "./vues-gabarit";

/** Relecture de l'avancement (ms). */
const RELECTURE_LOT_MS = 4000;

export const PHRASE_ARRET_LOT = "Les vidéos pas encore commencées ne seront pas fabriquées. Rien de déjà payé n'est perdu.";

function Vignette({ c }: { c: CarteVideoLotIV }) {
  /* eslint-disable-next-line @next/next/no-img-element */
  return c.imageUrl ? <img src={c.imageUrl} alt={c.nom} className="size-16 shrink-0 rounded-xl bg-surface-2 object-cover" /> : <span aria-hidden className="size-16 shrink-0 rounded-xl bg-surface-2" />;
}

export function SuiviLot({ vue }: { vue: VueLotIV }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const signature = JSON.stringify(vue);

  useEffect(() => {
    if (!vue.enCours) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/image-video-lot/${encodeURIComponent(vue.id)}`, { cache: "no-store" });
        const v = (await r.json().catch(() => null)) as { vue?: unknown } | null;
        if (v?.vue && JSON.stringify(v.vue) !== signature) router.refresh();
      } catch {
        // Connexion coupée : nouvel essai au prochain tour.
      }
    }, RELECTURE_LOT_MS);
    return () => clearInterval(t);
  }, [vue.enCours, vue.id, signature, router]);

  async function agir(f: () => Promise<{ ok: boolean; message?: string; donnees?: unknown }>) {
    if (occupe) return;
    setOccupe(true);
    try {
      const r = await f();
      if (!r.ok) notifier.erreur(r.message ?? "Le studio ne répond pas. Réessayez.");
      else if (r.donnees && typeof r.donnees === "object" && "phrase" in r.donnees) notifier.info(String((r.donnees as { phrase: unknown }).phrase));
      router.refresh();
    } finally {
      setOccupe(false);
    }
  }

  async function arreter() {
    const ok = await confirmerPrix({ message: PHRASE_ARRET_LOT });
    if (ok) await agir(() => arreterLotImageVideoAction(vue.id));
  }

  async function refaire(c: CarteVideoLotIV) {
    const accord = await confirmerPrix({ message: "Une nouvelle vidéo de la même image, comme pour une image seule. Seule la lecture de l'image part maintenant.", montant: vue.prixParVideoCentimes });
    if (typeof accord !== "number") return;
    if (occupe) return;
    setOccupe(true);
    try {
      const r = await refaireVideoDuLotAction(vue.id, c.rang, accord);
      if (!r.ok) return void notifier.erreur(r.message);
      if (r.donnees.statut === "lancee") return void router.push(`/image-video/${r.donnees.videoId}`);
      notifier.erreur(r.donnees.statut === "refusee" ? r.donnees.phrase : "Le prix a changé : recommencez.");
    } finally {
      setOccupe(false);
    }
  }

  // Les boutons gardent leur pleine largeur sur mobile (barre collée) et leur taille sur ordinateur.
  const pleine = "w-full lg:w-auto";
  const entete = enteteSuiviLot(vue);
  const arreter_ =
    vue.action === "arreter" ? (
      <Bouton variante="secondaire" taille="lg" className={pleine} disabled={occupe} onClick={() => void arreter()}>
        Arrêter le lot
      </Bouton>
    ) : undefined;
  const reprendre =
    vue.action === "reprendre" ? (
      <Bouton taille="lg" className={pleine} disabled={occupe} onClick={() => void agir(() => reprendreLotImageVideoAction(vue.id))}>
        Reprendre le lot
      </Bouton>
    ) : undefined;
  const relire =
    vue.action === "relire" && vue.premiereARelire ? (
      <Link href={vue.premiereARelire} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange px-5 text-[15px] font-semibold text-sur-orange lg:w-auto">
        Relire la première mise de côté
      </Link>
    ) : undefined;
  const barre = arreter_ ?? reprendre ?? relire;

  return (
    <div className="space-y-6">
      {entete.etat && <EnTeteSuivi etat={entete.etat} message={entete.message} sansTemps />}
      {vue.enCours && <PrevenirTelephone />}

      {/* Le message d'arrêt est dit une fois, dans le titre. */}
      <SuiviFabrication vue={{ ...versSuiviLot(vue), message: undefined }} compacte />

      {vue.aRelire.length > 0 && (
        <section aria-label="À relire" className="space-y-3">
          <h2 className="text-lg font-semibold text-texte">À relire</h2>
          <ul className="space-y-2">
            {vue.aRelire.map((c) => (
              <li key={c.videoId}>
                <Carte className="flex flex-wrap items-center gap-3">
                  <Vignette c={c} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-[15px] font-semibold text-texte">{c.nom}</p>
                    <Pastille ton={c.pastille.ton}>{c.pastille.libelle}</Pastille>
                    {c.motif && <p className="text-sm text-texte-doux">{c.motif}</p>}
                  </div>
                  <div className="flex gap-2">
                    {c.voir && (
                      <Link href={c.voir} className="inline-flex min-h-11 items-center rounded-full border border-trait bg-surface-2 px-4 text-sm font-semibold text-texte">
                        Voir
                      </Link>
                    )}
                    <Bouton variante="secondaire" disabled={occupe} onClick={() => void refaire(c)}>
                      Refaire
                    </Bouton>
                  </div>
                </Carte>
              </li>
            ))}
          </ul>
          <p className="text-sm text-texte-faible">Refaire : une nouvelle vidéo de la même image, à partir de {euros(vue.prixParVideoCentimes)} au plus.</p>
        </section>
      )}

      <section aria-label="Le lot" className="space-y-3">
        <h2 className="text-lg font-semibold text-texte">Le lot</h2>
        <ul className="space-y-2">
          {vue.videos.map((c) => (
            <li key={c.videoId}>
              <Carte className="flex items-center gap-3">
                <Vignette c={c} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-[15px] font-semibold text-texte">{c.nom}</p>
                  <Pastille ton={c.pastille.ton} point={c.statut === "en-fabrication"}>
                    {c.pastille.libelle}
                  </Pastille>
                </div>
                {c.voir && c.statut === "faite" && (
                  <Link href={c.voir} className="text-sm font-semibold text-orange-vif">
                    Voir
                  </Link>
                )}
                {c.nouvelle && (
                  <Link href={c.nouvelle} className="text-sm font-semibold text-orange-vif">
                    Voir la nouvelle
                  </Link>
                )}
              </Carte>
            </li>
          ))}
        </ul>
      </section>

      {barre && (
        <BarreActionCollee>
          <ActionsSuivi etat={versSuiviLot(vue).etat ?? "a-relire"} arreter={arreter_} reprendre={reprendre} propres={relire} />
        </BarreActionCollee>
      )}
    </div>
  );
}
