import { ShieldCheck } from 'lucide-react'

/** Shown on every page: the system supports, but never replaces, a qualified clinician. */
export function Disclaimer() {
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
      <ShieldCheck className="mt-px size-3.5 shrink-0 text-zinc-400" aria-hidden />
      <p>
        Predictions are preliminary and for decision support only. They are not a medical diagnosis.
        Always consult a qualified healthcare professional.
      </p>
    </div>
  )
}
