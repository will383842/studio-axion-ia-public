"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState, useTransition } from "react";
import { modifierTexteKitAction, regenererTexteKitAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Champ } from "@/components/ui/Champ";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { champsACollerALaMain } from "@/domaine/classement-generateur";
import { estReseauDeclinaison } from "@/reseaux/codes";
import type { VueKitVariante } from "@/services/vues";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import { obtenirReseau, verifierPourReseau } from "@/reseaux";
import type { VueKitReseau } from "@/services/vues";
import { useVideo } from "./ContexteVideo";
import { SerieEtMarque } from "./SerieEtMarque";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";

/** Formules reconnues comme mention IA ; la première est ajoutée par « Ajouter ». */
const MENTIONS = ["Vidéo générée par IA", "Réalisé avec l'IA"];
const MENTION = MENTIONS[0];

/** Délai avant l'enregistrement automatique du texte d'un réseau (E2E-1 n° 11). */
export const ENREGISTREMENT_AUTO_MS = 1200;

interface Saisie {
  texte: string;
  mots: string[];
  titre: string;
}
const saisieDe = (r: VueKitReseau): Saisie => ({ texte: r.texte, mots: r.motsDiese, titre: r.titre ?? "" });
/** Clé de comparaison d'une saisie (texte, mots-dièse, titre). */
export const cleSaisie = (s: Saisie) => `${s.texte}\u0000${s.mots.join(" ")}\u0000${s.titre}`;

/** Lot R2 : d'où vient le texte, en clair. Rien n'est affiché pour un texte d'origine inconnue (ancienne retouche). */
const ORIGINES: Record<NonNullable<VueKitReseau["origine"]>, { libelle: string; ton: "sauge" | "neutre" | "orange" }> = {
  claude: { libelle: "Écrit par Claude", ton: "sauge" },
  essai: { libelle: "Texte d'essai", ton: "neutre" },
  main: { libelle: "Retouché par vous", ton: "orange" },
  version: { libelle: "Texte de la version", ton: "neutre" },
};

export function OrigineTexte({ origine }: { origine: VueKitReseau["origine"] }) {
  if (!origine) return null;
  const o = ORIGINES[origine];
  return <Pastille ton={o.ton}>{o.libelle}</Pastille>;
}

/** Libellé du bouton « Réécrire » : avec Claude, le prix au pire (reprise comprise) est dit AVANT le geste. */
export function libelleReecrire(r: Pick<VueKitReseau, "prixReecriture">): string {
  return r.prixReecriture ? `Réécrire · jusqu'à environ ${formaterMontant(r.prixReecriture)}` : "Réécrire";
}

/**
 * KIT DE PUBLICATION (B.8 #8, AV2.3-1/11/12) — niveau 1.
 * Raccourcis (Télécharger, Lien privé, Buffer), licences bloquantes, puis texte + mots-dièse
 * par réseau avec compteur et avertissements du registre des réseaux, mention IA, crédits.
 */
export function KitPublication() {
  const { kit, ouvrir, sorties, partages } = useVideo();
  // Générateur (G1b) : le réseau de la version s'ouvre en premier ; les autres sont grisés, confirmés d'un toucher.
  const [reseau, setReseau] = useState<IdReseau | undefined>(kit?.variante?.reseau ?? kit?.reseaux[0]?.reseau);
  const [ailleursConfirme, setAilleursConfirme] = useState<IdReseau[]>([]);
  if (!kit) return null;
  const courant = kit.reseaux.find((r) => r.reseau === reseau) ?? kit.reseaux[0];
  const reseauVersion = kit.variante?.reseau;
  const nomVersion = kit.reseaux.find((x) => x.reseau === reseauVersion)?.nom;
  const autreReseau = !!reseauVersion && courant.reseau !== reseauVersion;
  const actifs = partages.filter((p) => p.actif).length;

  const raccourcis: { cle: "telecharger" | "partager" | "buffer"; icone: NomIcone; libelle: string; detail: string; essai?: boolean }[] = [
    { cle: "telecharger", icone: "telecharger", libelle: "Télécharger", detail: `${sorties.length} format${sorties.length > 1 ? "s" : ""}` },
    { cle: "partager", icone: "lien", libelle: "Lien privé", detail: actifs ? `${actifs} actif${actifs > 1 ? "s" : ""}` : "Aucun" },
    // TEST-UI-REEL U8 : une vidéo d'essai ne part pas : le raccourci le dit avant même d'ouvrir la feuille.
    { cle: "buffer", icone: "envoyer", libelle: "Buffer", detail: kit.videoEssai ? "Vidéo d'essai" : "Programmer", essai: kit.envoiSimule || kit.videoEssai },
  ];

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-3 gap-2">
        {raccourcis.map((r) => (
          <li key={r.cle}>
            <button
              type="button"
              onClick={() => ouvrir(r.cle)}
              className="group relative flex min-h-24 w-full flex-col justify-between gap-2 rounded-carte border border-trait bg-surface-1 p-3 text-left transition-[border-color,background-color,transform] duration-200 ease-studio hover:-translate-y-0.5 hover:border-trait-fort hover:bg-surface-2"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-orange-doux text-orange-vif transition-transform group-hover:scale-105">
                <Icone nom={r.icone} size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold leading-tight text-texte">{r.libelle}</span>
                <span className="text-xs text-texte-faible">{r.detail}</span>
              </span>
              {r.essai && <PastilleEssai className="absolute right-2 top-2" />}
            </button>
          </li>
        ))}
      </ul>

      {/* Équipe 7 : série (même titre à l'écran et en tête de description) et « Votre marque ». */}
      <SerieEtMarque />

      {kit.licencesABloquer.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-carte border border-ambre/40 bg-ambre-doux p-4">
          <Icone nom="attention" size={20} className="mt-0.5 shrink-0 text-ambre" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-texte">Droits à vérifier</p>
            <ul className="mt-1 space-y-0.5 text-sm text-texte-doux">
              {kit.licencesABloquer.map((l) => (
                <li key={l.id}>
                  {l.nom} · <span className="font-semibold text-ambre">{l.etat === "expiree" ? "licence expirée" : "à vérifier"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Choix du réseau */}
      <div role="tablist" aria-label="Réseau" className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible">
        {kit.reseaux.map((r) => {
          const actif = r.reseau === courant.reseau;
          const alerte = r.avertissements.length > 0;
          const grise = !!reseauVersion && r.reseau !== reseauVersion && !actif;
          return (
            <button
              key={r.reseau}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setReseau(r.reseau)}
              className={cn(
                "relative flex min-h-12 shrink-0 items-center gap-2 rounded-full border py-1 pl-1.5 pr-4 text-sm font-semibold transition-colors",
                actif ? "border-orange bg-orange-doux text-texte" : "border-trait bg-surface-1 text-texte-doux hover:border-trait-fort hover:text-texte",
                grise && "opacity-45",
              )}
            >
              <LogoReseau reseau={r.reseau} taille="md" className={cn(actif && "border-orange")} />
              {r.nom}
              {alerte && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ambre">
                  <span className="sr-only">Avertissement</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={courant.reseau} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {/* La clé inclut le texte : une réécriture côté serveur remonte l'éditeur avec le nouveau texte. */}
          {autreReseau && !ailleursConfirme.includes(courant.reseau) ? (
            <div className="rounded-carte border border-ambre/40 bg-ambre-doux p-4">
              <p className="flex items-center gap-2 font-semibold text-texte">
                <Icone nom="attention" size={18} className="shrink-0 text-ambre" />
                Réseau différent
              </p>
              <p className="mt-1 text-sm text-texte-doux">
                Cette vidéo a été écrite pour {nomVersion}. Sa version {courant.nom} a son propre texte.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Bouton variante="secondaire" onClick={() => setReseau(reseauVersion)}>
                  Revenir à {nomVersion}
                </Bouton>
                <Bouton variante="fantome" onClick={() => setAilleursConfirme((x) => [...x, courant.reseau])}>
                  Publier ici quand même
                </Bouton>
              </div>
            </div>
          ) : (
            <EditeurReseau key={courant.reseau} r={courant} credits={kit.credits} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EditeurReseau({ r, credits }: { r: VueKitReseau; credits: string[] }) {
  const router = useRouter();
  const { videoId, dureeSec, ratios, textesSimules, kit } = useVideo();
  // Mention coupée (décision de Will) : une simple information, plus d'alerte ambre.
  const mentionActive = kit?.mentionIAActive ?? true;
  const versionIci = kit?.variante && kit.variante.reseau === r.reseau ? kit.variante : undefined;
  // Étiquette IA de la plateforme : réglage FACULTATIF, coupé par défaut ; la ligne d'aide n'apparaît que s'il est allumé.
  const [etiquetteIA, setEtiquetteIA] = useState(versionIci?.champs.etiquetteIAPlateforme ?? false);
  const [texte, setTexte] = useState(r.texte);
  const [mots, setMots] = useState<string[]>(r.motsDiese);
  const [titre, setTitre] = useState(r.titre ?? "");
  const [nouveau, setNouveau] = useState("");
  const [enregistrement, demarrerEnregistrement] = useTransition();
  const [reecriture, demarrerReecriture] = useTransition();
  // Enregistrement AUTOMATIQUE (E2E-1 n° 11) : `base` est la dernière version enregistrée ; une saisie qui en diffère
  // part toute seule après un court délai, ou au départ de l'éditeur. Rien n'est perdu sans prévenir.
  const [base, setBase] = useState<Saisie>(() => saisieDe(r));
  const [etat, setEtat] = useState<"" | "enregistre" | "erreur">("");
  const [adopter, setAdopter] = useState(false);
  const courante: Saisie = { texte, mots, titre };
  const cleCourante = cleSaisie(courante);
  const modifie = cleCourante !== cleSaisie(base);
  const serveur = cleSaisie(saisieDe(r));
  const [vu, setVu] = useState(serveur);
  if (vu !== serveur) {
    // Nouvelle version côté serveur (notre enregistrement, une réécriture) : prise telle quelle si rien n'attend.
    setVu(serveur);
    setBase(saisieDe(r));
    if (!modifie || adopter) {
      setTexte(r.texte);
      setMots(r.motsDiese);
      setTitre(r.titre ?? "");
      setAdopter(false);
    }
  }

  function enregistrer(s: Saisie) {
    demarrerEnregistrement(async () => {
      const res = await modifierTexteKitAction(videoId, r.reseau, s.texte, s.mots, s.titre || undefined);
      if (!res.ok) {
        setEtat("erreur");
        notifier.erreur(res.message);
        return;
      }
      setBase(s);
      setEtat("enregistre");
    });
  }
  const enregistrerMaintenant = useEffectEvent(() => enregistrer(courante));
  const auDepart = useEffectEvent(() => {
    if (modifie) void modifierTexteKitAction(videoId, r.reseau, texte, mots, titre || undefined);
  });
  useEffect(() => {
    if (!modifie || reecriture || etat === "erreur") return;
    const t = setTimeout(() => enregistrerMaintenant(), ENREGISTREMENT_AUTO_MS);
    return () => clearTimeout(t);
  }, [cleCourante, modifie, reecriture, etat]);
  // Changer de réseau démonte l'éditeur : ce qui n'est pas encore parti est enregistré à ce moment-là.
  useEffect(() => () => auDepart(), []);
  // Fermer l'onglet ou recharger pendant une saisie non enregistrée : le navigateur demande confirmation.
  useEffect(() => {
    if (!modifie) return;
    const retenir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", retenir);
    return () => window.removeEventListener("beforeunload", retenir);
  }, [modifie]);

  const def = obtenirReseau(r.reseau);
  // Formats par réseau T4 : les avertissements du serveur lisent le fichier envoyé ; ici, le même (absent : aucun fichier).
  const sortieEnvoyee = r.sortieConseillee ?? null;
  const avertissements = useMemo(() => verifierPourReseau(def, { dureeSec, ratios, texte, motsDiese: mots, sortieEnvoyee }), [def, dureeSec, ratios, texte, mots, sortieEnvoyee]);
  const avecMention = MENTIONS.some((m) => texte.toLowerCase().includes(m.toLowerCase()));
  const creditsManquants = credits.filter((c) => !texte.includes(c));
  // Équipe 7 : l'en-tête de série ouvre le texte (comme à l'envoi vers Buffer).
  const entete = kit?.serie?.entete;
  const aCopier = [titre && r.reseau.startsWith("youtube") ? titre : "", entete ? `${entete}\n${texte}` : texte, mots.join(" ")].filter(Boolean).join("\n\n");

  function ajouterMot() {
    const m = nouveau.trim().replace(/^#*/, "").replace(/\s+/g, "");
    if (!m) return;
    const tag = `#${m}`;
    if (!mots.some((x) => x.toLowerCase() === tag.toLowerCase())) setMots((l) => [...l, tag]);
    setNouveau("");
  }

  return (
    <div className="rounded-carte border border-trait bg-surface-1 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <LogoReseau reseau={r.reseau} taille="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-texte">
            {r.nom}
            <OrigineTexte origine={r.origine} />
          </p>
          <p className="text-xs tabular-nums text-texte-faible">
            {def.legende.longueurVisible} car. visibles · {def.legende.motsDieseConseilles} mots-dièse conseillés
          </p>
        </div>
        <BoutonCopier texte={aCopier} libelle="Copier" />
      </div>

      {avertissements.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {avertissements.map((a) => (
            // Message parfois long : il passe à la ligne au lieu de déborder sur téléphone.
            <Pastille key={a.code} ton="ambre" icone="attention" taille="md" className="min-w-0 max-w-full shrink whitespace-normal text-left [&>svg]:shrink-0">
              {a.message}
            </Pastille>
          ))}
        </div>
      )}

      {r.reseau.startsWith("youtube") && <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={100} className="mb-3" />}

      {entete && (
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-texte">
          <Icone nom="calques" size={15} className="shrink-0 text-orange-vif" />
          <span className="truncate">{entete}</span>
          <span className="ml-auto shrink-0 text-xs font-medium text-texte-faible">en tête</span>
        </p>
      )}
      <ZoneTexte libelle="Texte de publication" value={texte} onChange={(e) => setTexte(e.target.value)} longueurMax={r.longueurMax} />

      {/* Mots-dièse */}
      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-semibold text-texte-doux">Mots-dièse</p>
          <span className={cn("text-xs tabular-nums", mots.length > def.legende.motsDieseMax ? "font-bold text-ambre" : "text-texte-faible")}>
            {mots.length} / {def.legende.motsDieseMax}
          </span>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {mots.map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={() => setMots((l) => l.filter((x) => x !== m))}
                aria-label={`Retirer ${m}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-orange/30 bg-orange-doux pl-3 pr-2 text-sm font-semibold text-orange-vif transition-colors hover:border-brique/40 hover:bg-brique-doux hover:text-brique"
              >
                {m}
                <Icone nom="fermer" size={13} />
              </button>
            </li>
          ))}
          <li>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ajouterMot();
              }}
              className="flex min-h-11 items-center rounded-full border border-dashed border-trait-fort pl-3 pr-1 focus-within:border-orange"
            >
              <span className="text-sm text-texte-faible">#</span>
              <label className="sr-only" htmlFor={`mot-${r.reseau}`}>
                Ajouter un mot-dièse
              </label>
              <input
                id={`mot-${r.reseau}`}
                value={nouveau}
                onChange={(e) => setNouveau(e.target.value)}
                placeholder="ajouter"
                className="min-h-11 w-20 bg-transparent text-sm text-texte outline-none placeholder:text-texte-faible"
              />
              <button type="submit" aria-label="Ajouter" className="grid size-11 place-items-center rounded-full text-texte-doux hover:text-orange-vif">
                <Icone nom="plus" size={15} />
              </button>
            </form>
          </li>
        </ul>
      </div>

      {/* Mention IA, étiquette du réseau, crédits */}
      <ul className="mt-4 space-y-2 border-t border-trait pt-4">
        <li className="flex min-h-11 items-center gap-3">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", avecMention ? "bg-sauge-doux text-sauge" : mentionActive ? "bg-ambre-doux text-ambre" : "bg-surface-2 text-texte-doux")}>
            <Icone nom={avecMention ? "coche" : "etincelles"} size={15} />
          </span>
          <span className="flex-1 text-sm text-texte">{avecMention ? "Mention IA ajoutée" : mentionActive ? "Mention IA absente" : "Mention IA coupée"}</span>
          {!avecMention && (
            <Bouton variante="contour" onClick={() => setTexte((t) => `${t.trimEnd()}\n\n${MENTION}.`)}>
              Ajouter
            </Bouton>
          )}
        </li>
        <li>
          <Interrupteur libelle="Étiquette IA (facultative)" coche={etiquetteIA} onChange={setEtiquetteIA} detail={etiquetteIA ? r.etiquetteIA : undefined} />
        </li>
        {r.sortieConseillee && (
          <li className="flex min-h-11 items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sauge-doux text-sauge">
              <Icone nom="coche" size={15} />
            </span>
            <span className="flex-1 text-sm text-texte">
              Fichier du studio, sans filigrane d&apos;une autre plateforme
              {r.fichierEnvoye && <span className="block text-texte-doux">{r.fichierEnvoye}</span>}
            </span>
          </li>
        )}
        {credits.length > 0 && (
          <li className="flex min-h-11 items-center gap-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", creditsManquants.length ? "bg-ambre-doux text-ambre" : "bg-sauge-doux text-sauge")}>
              <Icone nom="certifie" size={15} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-texte">Crédits : {credits.join(", ")}</span>
            {creditsManquants.length > 0 && (
              <Bouton variante="contour" onClick={() => setTexte((t) => `${t.trimEnd()}\n\nCrédits : ${creditsManquants.join(", ")}`)}>
                Ajouter
              </Bouton>
            )}
          </li>
        )}
      </ul>

      {versionIci && <ChampsVersion v={versionIci} />}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {!versionIci && (
        <Bouton
          variante="fantome"
          icone="baguette"
          essai={textesSimules}
          chargement={reecriture}
          onClick={() =>
            demarrerReecriture(async () => {
              setAdopter(true);
              let res = await regenererTexteKitAction(videoId, r.reseau);
              // Un texte retouché à la main n'est remplacé qu'avec l'accord de Will.
              res = await avecConfirmationPrix(res, () => regenererTexteKitAction(videoId, r.reseau, true));
              if (!res.ok) {
                if (res.code !== "CONFIRMATION_REQUISE") notifier.erreur(res.message);
                setAdopter(false);
                return;
              }
              if (textesSimules) notifier.essai("texte réécrit par le rédacteur de démonstration");
              else notifier.succes(r.prixReecriture ? "Texte réécrit par Claude" : "Texte réécrit");
              router.refresh();
            })
          }
        >
          {libelleReecrire(r)}
        </Bouton>
        )}
        <p aria-live="polite" className="mr-auto flex min-h-11 items-center gap-1.5 text-xs text-texte-faible">
          {etat === "erreur" && modifie ? (
            <>
              <Icone nom="attention" size={13} className="text-ambre" />
              Pas encore enregistré
            </>
          ) : modifie || enregistrement ? (
            "Enregistrement…"
          ) : etat === "enregistre" ? (
            <>
              <Icone nom="coche" size={13} className="text-sauge" />
              Enregistré
            </>
          ) : null}
        </p>
        {etat === "erreur" && modifie && (
          <Bouton variante="secondaire" icone="coche" chargement={enregistrement} onClick={() => enregistrer(courante)}>
            Réessayer
          </Bouton>
        )}
      </div>
    </div>
  );
}

/**
 * Champs de la version (générateur, B.5.3, B.6.11) : titres Shorts, mots-clés TikTok à copier, premier commentaire,
 * commentaire épinglé, post LinkedIn, lien suivi, cases de rappel YouTube. Ce que Buffer ne transmet pas est marqué
 * « à coller » (vérifié le 02/10/2026, `CHAMPS_BUFFER`).
 */
function ChampsVersion({ v }: { v: VueKitVariante }) {
  const c = v.champs;
  const aColler = estReseauDeclinaison(v.reseau) ? champsACollerALaMain(v.reseau, c) : [];
  const [rappels, setRappels] = useState({ remix: !!c.rappels.remixDesactive, ressemblance: !!c.rappels.detectionRessemblance });
  const lignes: { cle: string; libelle: string; texte: string; coller?: boolean }[] = [];
  c.titres?.forEach((t, i) => lignes.push({ cle: `titre-${i}`, libelle: i === 0 ? "Titre (publié)" : "Titre de rechange", texte: t, coller: aColler.includes("titre") }));
  if (c.motsClesDeclares?.length) lignes.push({ cle: "mots-cles", libelle: "Mots-clés à déclarer, dans l'application", texte: c.motsClesDeclares.join(", "), coller: true });
  if (c.motsClesBloques?.length) lignes.push({ cle: "mots-bloques", libelle: "Mots-clés à bloquer, dans l'application", texte: c.motsClesBloques.join(", "), coller: true });
  const premier = [...c.sources, c.lienSuivi].filter(Boolean).join("\n");
  if (premier) lignes.push({ cle: "premier", libelle: "Premier commentaire", texte: premier, coller: aColler.includes("premierCommentaire") });
  if (c.commentaireEpingle) lignes.push({ cle: "epingle", libelle: "Commentaire épinglé", texte: c.commentaireEpingle, coller: true });
  if (c.post) lignes.push({ cle: "post", libelle: "Post LinkedIn", texte: c.post.texte });
  if (c.lienSuivi) lignes.push({ cle: "lien", libelle: "Lien suivi", texte: c.lienSuivi });
  return (
    <div className="mt-4 space-y-3 border-t border-trait pt-4">
      <p className="flex items-center gap-2 text-xs font-bold text-texte-faible">
        <span className="font-mono">{v.code}</span>
        {v.version > 1 && <span>· version {v.version}</span>}
      </p>
      {lignes.map((l) => (
        <div key={l.cle} className="rounded-champ border border-trait bg-surface-2 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-texte-doux">
              {l.libelle}
              {l.coller && <span className="ml-1.5 rounded-full bg-ambre-doux px-1.5 py-0.5 text-[10px] font-bold text-ambre">à coller</span>}
            </span>
            <BoutonCopier texte={l.texte} compact />
          </div>
          <p className="whitespace-pre-line break-words text-sm text-texte">{l.texte}</p>
        </div>
      ))}
      {v.reseau === "youtube-shorts" && (
        <div className="space-y-1">
          <CaseACocher libelle="Remix désactivé" detail="Dans YouTube Studio, avant de publier" coche={rappels.remix} onChange={(x) => setRappels((r) => ({ ...r, remix: x }))} />
          <CaseACocher libelle="Détection de ressemblance activée" detail="Une information, jamais bloquant" coche={rappels.ressemblance} onChange={(x) => setRappels((r) => ({ ...r, ressemblance: x }))} />
        </div>
      )}
    </div>
  );
}
