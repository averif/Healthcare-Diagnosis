import { Database, FlaskConical, Info, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardBody, CardHeader, PageHeader, StatCard } from '@/components/ui/Card'
import { Alert, Badge, FullPageSpinner } from '@/components/ui/Feedback'
import { Tabs } from '@/components/ui/Overlay'
import { Table, Td, Th } from '@/components/ui/Table'
import { errorMessage } from '@/lib/api'
import { useModelCards } from '@/lib/queries'
import { cn, fmtDate, humanizeSymptom, pct, titleCase } from '@/lib/utils'
import type { Disease, ModelCard } from '@/types/api'

const SERIES_COLORS = ['#0d8574', '#2563eb', '#f97316', '#a1a1aa', '#a855f7']

function featureLabel(card: ModelCard, name: string) {
  return card.features?.find((f) => f.name === name)?.label ?? humanizeSymptom(name)
}

function ConfusionMatrix({ card }: { card: ModelCard }) {
  const cm = card.evaluation.test.confusion_matrix
  if (!cm) return null
  const [[tn, fp], [fn, tp]] = cm
  const cells = [
    { label: 'True negative', value: tn, good: true },
    { label: 'False positive', value: fp, good: false },
    { label: 'False negative', value: fn, good: false },
    { label: 'True positive', value: tp, good: true },
  ]
  return (
    <div>
      <div className="mb-1 grid grid-cols-[auto_1fr_1fr] gap-2 text-center text-xs text-zinc-500">
        <span />
        <span>Predicted: {card.class_names[0]}</span>
        <span>Predicted: {card.class_names[1]}</span>
      </div>
      {[0, 1].map((row) => (
        <div key={row} className="mb-2 grid grid-cols-[auto_1fr_1fr] items-center gap-2">
          <span className="w-24 text-right text-xs text-zinc-500">
            Actual: {card.class_names[row]}
          </span>
          {cells.slice(row * 2, row * 2 + 2).map((c) => (
            <div
              key={c.label}
              className={cn(
                'rounded-lg py-4 text-center',
                c.good ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700',
              )}
            >
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs">{c.label}</p>
            </div>
          ))}
        </div>
      ))}
      <p className="mt-2 text-xs text-zinc-500">
        Hold-out test set of {card.dataset.split.test} patients never seen during training or
        tuning.
      </p>
    </div>
  )
}

function RocChart({ card }: { card: ModelCard }) {
  const series = Object.entries(card.comparison)
    .filter(([key, c]) => c.test.roc_curve && key !== 'majority_baseline') // the dashed chance line covers it
    .map(([key, c]) => ({
      key,
      label: `${c.label} (AUC ${c.test.roc_auc?.toFixed(2)})`,
      data: c.test.roc_curve!.fpr.map((fpr, i) => ({ fpr, tpr: c.test.roc_curve!.tpr[i] })),
    }))
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart margin={{ left: -10, right: 10, top: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis
          type="number"
          dataKey="fpr"
          domain={[0, 1]}
          tick={{ fontSize: 11 }}
          label={{
            value: 'False positive rate',
            position: 'insideBottom',
            offset: -2,
            fontSize: 11,
          }}
        />
        <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v) => Number(v).toFixed(2)}
          labelFormatter={(v) => `FPR ${Number(v).toFixed(2)}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          data={[
            { fpr: 0, tpr: 0 },
            { fpr: 1, tpr: 1 },
          ]}
          dataKey="tpr"
          stroke="#d4d4d8"
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
          name="Chance"
          legendType="none"
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            data={s.data}
            dataKey="tpr"
            name={s.label}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={s.key === 'decision_tree' ? 2.5 : 1.5}
            dot={false}
            isAnimationActive={false}
            type="stepAfter"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ImportanceChart({ card }: { card: ModelCard }) {
  const data = card.feature_importance
    .filter((f) => f.importance > 0)
    .slice(0, 10)
    .map((f) => ({ name: featureLabel(card, f.feature), importance: f.importance }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => pct(v)} />
        <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [pct(Number(v), 1), 'Importance']} />
        <Bar dataKey="importance" fill="#14a38b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ComparisonTable({ card }: { card: ModelCard }) {
  const multiclass = card.disease === 'symptom'
  const metrics = multiclass
    ? ['accuracy', 'f1_macro']
    : ['accuracy', 'balanced_accuracy', 'recall', 'f1', 'roc_auc']
  const deployedKey =
    card.algorithm === 'RandomForestClassifier' ? 'random_forest' : 'decision_tree'
  return (
    <Table>
      <thead>
        <tr>
          <Th>Algorithm</Th>
          {metrics.map((m) => (
            <Th key={m}>{titleCase(m).replace('Roc Auc', 'ROC AUC').replace('F1', 'F1')}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Object.entries(card.comparison).map(([key, c]) => (
          <tr key={key} className={key === deployedKey ? 'bg-brand-50/60' : ''}>
            <Td className="font-medium">
              {c.label}
              {key === deployedKey && (
                <Badge className="ml-2 bg-brand-600 text-white">Deployed</Badge>
              )}
            </Td>
            {metrics.map((m) => (
              <Td key={m} className="whitespace-nowrap tabular-nums">
                {c.cv?.[m] ? (
                  <>
                    {c.cv[m].mean.toFixed(3)}
                    <span className="text-xs text-zinc-400"> ± {c.cv[m].std.toFixed(3)}</span>
                  </>
                ) : (
                  '—'
                )}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function RobustnessChart({ card }: { card: ModelCard }) {
  if (!card.robustness) return null
  const entries = Object.entries(card.robustness)
  const data = entries[0][1].hidden_symptoms.map((hidden, i) => ({
    hidden: `${hidden} hidden`,
    ...Object.fromEntries(entries.map(([, r]) => [r.label, r.top1[i]])),
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -10, right: 10, top: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis dataKey="hidden" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tickFormatter={(v: number) => pct(v)} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => pct(Number(v), 1)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {entries.map(([key, r], i) => (
          <Line
            key={key}
            dataKey={r.label}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={key === 'random_forest' ? 2.5 : 1.5}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ModelDetail({ card }: { card: ModelCard }) {
  const t = card.evaluation.test
  const multiclass = card.disease === 'symptom'
  const stats: [string, number | undefined][] = multiclass
    ? [
        ['Accuracy', t.accuracy],
        ['Top-3 accuracy', t.top3_accuracy],
        ['Macro F1', t.f1_macro],
      ]
    : [
        ['Accuracy', t.accuracy],
        ['Balanced accuracy', t.balanced_accuracy],
        ['Sensitivity (recall)', t.recall],
        ['Specificity', t.specificity],
        ['F1 score', t.f1],
        ['ROC AUC', t.roc_auc],
      ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
        <Badge className="bg-brand-50 text-brand-700">{card.algorithm}</Badge>
        <Badge className="bg-zinc-100 text-zinc-600">v{card.version}</Badge>
        <span>
          Trained {fmtDate(card.trained_at)} ·{' '}
          {card.tree.n_trees > 1 ? `${card.tree.n_trees} trees, ` : ''}
          depth {card.tree.depth}, {card.tree.leaves} leaves
          {card.tree.n_trees > 1 && ' (mean)'} · {card.predictions_served} predictions served
        </span>
      </div>
      {card.deployment_rationale && (
        <Alert tone="info" title="Why this module uses a Random Forest">
          {card.deployment_rationale}
        </Alert>
      )}

      <div
        className={cn(
          'grid gap-4',
          multiclass ? 'sm:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-6',
        )}
      >
        {stats.map(([label, value]) => (
          <StatCard key={label} label={label} value={pct(value, 1)} />
        ))}
      </div>

      {!multiclass && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Confusion matrix"
              description="Deployed model on the hold-out test set."
            />
            <CardBody>
              <ConfusionMatrix card={card} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="ROC curves"
              description="All candidate algorithms on the same test set."
            />
            <CardBody>
              <RocChart card={card} />
            </CardBody>
          </Card>
        </div>
      )}

      {multiclass && (
        <Card>
          <CardHeader
            title="Robustness: top-1 accuracy as symptoms are hidden"
            description="Simulates patients who report only some of their symptoms (unseen rows, 5-fold CV)."
          />
          <CardBody>
            <RobustnessChart card={card} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Algorithm comparison"
          description="Nested cross-validation (tuning repeated inside every outer fold), mean ± sd. The deployed model is highlighted."
        />
        <div className="mt-3">
          <ComparisonTable card={card} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Feature importance"
          description="Share of the model's decisions driven by each input."
        />
        <CardBody>
          <ImportanceChart card={card} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Database className="size-4" /> Dataset
              </span>
            }
          />
          <CardBody className="space-y-3 text-sm">
            <p className="text-zinc-700">{card.dataset.source}</p>
            <p className="text-zinc-500">
              {card.dataset.raw_rows.toLocaleString()} raw rows →{' '}
              {card.dataset.rows.toLocaleString()} after cleaning · {card.dataset.split.train}/
              {card.dataset.split.test} stratified split
            </p>
            {!multiclass && (
              <ul className="space-y-1">
                {Object.entries(card.dataset.class_balance).map(([label, n]) => (
                  <li key={label} className="flex justify-between">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-medium">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <FlaskConical className="size-4" /> Data cleaning &amp; selection
              </span>
            }
          />
          <CardBody className="space-y-3 text-sm">
            <ul className="list-disc space-y-1 pl-4 text-zinc-600">
              {card.dataset.cleaning.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <p className="text-zinc-500">
              {card.model_selection.candidates_evaluated} configurations searched (
              {card.model_selection.search}, scoring:{' '}
              {card.model_selection.scoring.replace('_', ' ')}). Selection rule:{' '}
              {card.model_selection.refit_rule}.
            </p>
            <p className="font-mono text-xs break-words text-zinc-500">
              {Object.entries(card.hyperparameters)
                .map(([k, v]) => `${k}=${v === null ? 'None' : String(v)}`)
                .join(', ')}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldAlert className="size-4" /> Limitations &amp; intended use
              </span>
            }
          />
          <CardBody className="space-y-3 text-sm">
            <ul className="list-disc space-y-1 pl-4 text-zinc-600">
              {card.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="flex gap-2 text-zinc-500">
              <Info className="mt-0.5 size-4 shrink-0" /> {card.intended_use}
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export function ModelsPage() {
  const { data, isPending, error } = useModelCards()
  const [active, setActive] = useState<Disease>('diabetes')
  if (isPending) return <FullPageSpinner />
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>
  const card = data.find((c) => c.disease === active) ?? data[0]

  return (
    <>
      <PageHeader
        title="Model performance"
        description="How each model was built and how well it performs, from its model card."
      />
      <Tabs
        tabs={data.map((c) => ({ value: c.disease, label: c.title }))}
        value={active}
        onChange={setActive}
      />
      <div className="mt-6">
        <ModelDetail card={card} />
      </div>
    </>
  )
}
