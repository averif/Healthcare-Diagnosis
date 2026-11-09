import { ArrowDown, ArrowUp } from 'lucide-react'
import { Link } from 'react-router'
import { RiskBadge, StatusBadge } from '@/components/ui/Feedback'
import { Table, Td, Th } from '@/components/ui/Table'
import { DISEASE_LABEL, fmtDate, pct, RISK_COLOR } from '@/lib/utils'
import type { Explanation, Prediction, RiskLevel } from '@/types/api'

/** Semicircular gauge for a probability, coloured by risk band. */
export function RiskGauge({ probability, risk }: { probability: number; risk: RiskLevel }) {
  const radius = 80
  const circumference = Math.PI * radius
  const filled = Math.max(0, Math.min(1, probability)) * circumference
  return (
    <figure className="flex flex-col items-center" aria-label={`Probability ${pct(probability)}`}>
      <svg viewBox="0 0 200 115" className="w-52">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#e4e4e7"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={RISK_COLOR[risk]}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="100" y="88" textAnchor="middle" className="fill-zinc-900 text-[32px] font-bold">
          {pct(probability)}
        </text>
        <text x="100" y="108" textAnchor="middle" className="fill-zinc-500 text-[11px]">
          estimated probability
        </text>
      </svg>
      <figcaption className="mt-1">
        <RiskBadge risk={risk} />
      </figcaption>
    </figure>
  )
}

/**
 * Diverging bars: each factor's effect on the predicted probability.
 * Red bars push towards the predicted condition, green bars push away from it.
 */
export function ExplanationChart({
  explanation,
  limit = 8,
  subject = 'risk',
}: {
  explanation: Explanation
  limit?: number
  subject?: string
}) {
  const reasons = explanation.reasons
    .filter((r) => Math.abs(r.contribution) >= 0.005)
    .slice(0, limit)
  const max = Math.max(0.05, ...reasons.map((r) => Math.abs(r.contribution)))
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Starting from a baseline of {pct(explanation.base_rate)}, each factor raised (red) or
        lowered (green) the estimate. Together they add up exactly to the final{' '}
        {pct(explanation.probability)}.
        {explanation.method && explanation.method !== 'decision path' && ` (${explanation.method})`}
      </p>
      <ul className="space-y-2.5">
        {reasons.map((reason) => {
          const up = reason.contribution > 0
          const width = `${(Math.abs(reason.contribution) / max) * 50}%`
          return (
            <li key={reason.feature}>
              <div className="mb-1 flex items-start justify-between gap-3 text-sm">
                <span className="text-zinc-700">
                  {reason.text}
                  {reason.imputed && (
                    <span className="ml-1 text-xs text-amber-700">(estimated)</span>
                  )}
                </span>
                <span
                  className={`flex shrink-0 items-center gap-0.5 font-medium tabular-nums ${up ? 'text-red-600' : 'text-emerald-600'}`}
                >
                  {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  {(Math.abs(reason.contribution) * 100).toFixed(1)} pts
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-zinc-100" aria-hidden>
                <div className="absolute top-0 left-1/2 h-2 w-px bg-zinc-300" />
                <div
                  className={`absolute top-0 h-2 rounded-full ${up ? 'left-1/2 bg-red-500' : 'right-1/2 bg-emerald-500'}`}
                  style={{ width }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {reasons.length === 0 && (
        <p className="text-sm text-zinc-500">No single factor moved this estimate noticeably.</p>
      )}
      <p className="sr-only">Factors are listed in order of their effect on the {subject}.</p>
    </div>
  )
}

export function PredictionTable({
  predictions,
  showPatient = false,
}: {
  predictions: Prediction[]
  showPatient?: boolean
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          {showPatient && <Th>Patient</Th>}
          <Th>Module</Th>
          <Th>Result</Th>
          <Th>Risk</Th>
          <Th>Status</Th>
          <Th className="text-right">
            <span className="sr-only">Open</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {predictions.map((p) => (
          <tr key={p.id} className="hover:bg-zinc-50">
            <Td className="whitespace-nowrap text-zinc-500">{fmtDate(p.created_at)}</Td>
            {showPatient && <Td className="font-medium text-zinc-800">{p.patient_name}</Td>}
            <Td>{DISEASE_LABEL[p.disease]}</Td>
            <Td>
              <span className="font-medium text-zinc-800">{p.predicted_label}</span>{' '}
              <span className="text-zinc-500">({pct(p.probability)})</span>
            </Td>
            <Td>
              <RiskBadge risk={p.risk_level} />
            </Td>
            <Td>
              <StatusBadge status={p.status} />
            </Td>
            <Td className="text-right">
              <Link
                to={`/predictions/${p.id}`}
                className="font-medium whitespace-nowrap text-brand-700 hover:underline"
              >
                View
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
