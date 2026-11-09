import { ShieldAlert } from 'lucide-react'

/** Shown on every page: the system supports, but never replaces, a qualified clinician. */
export function Disclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        Predictions are preliminary and for decision support only. They are not a medical diagnosis.
        Always consult a qualified healthcare professional.
      </p>
    </div>
  )
}
