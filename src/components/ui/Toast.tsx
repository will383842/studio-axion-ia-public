"use client";

import { toast, Toaster } from "sonner";

/** À placer une fois (layout racine). */
export function Toasts() {
  return (
    <Toaster
      position="top-center"
      offset={16}
      mobileOffset={{ top: 12, left: 16, right: 16 }}
      toastOptions={{
        classNames: {
          toast: "!rounded-carte !border !border-toast !bg-toast !text-toast-texte !shadow-carte !font-texte",
          description: "!text-toast-texte/80",
          actionButton: "!bg-orange !text-sur-orange !rounded-champ !font-semibold",
          success: "[&_[data-icon]]:!text-toast-accent",
          error: "[&_[data-icon]]:!text-toast-accent",
          warning: "[&_[data-icon]]:!text-toast-accent",
        },
      }}
    />
  );
}

/** Messages courts, vouvoiement. `essai` : action d'un fournisseur simulé (AV2.4-4). */
export const notifier = {
  succes: (message: string, description?: string) => toast.success(message, { description }),
  erreur: (message: string, description?: string) => toast.error(message, { description }),
  info: (message: string, description?: string) => toast(message, { description }),
  /** Ex. notifier.essai("rien n'a été envoyé à Buffer") → « Essai : rien n'a été envoyé à Buffer ». */
  essai: (message: string) => toast.warning(`Essai : ${message}`),
};
