import { Bot, Send, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, Spinner } from '@/components/ui/Feedback'
import { errorMessage } from '@/lib/api'
import { useAssistantStatus, useChatHistory, useSendChat } from '@/lib/queries'
import { cn } from '@/lib/utils'

const PROVIDER_LABEL: Record<string, string> = {
  nvidia: 'NVIDIA AI',
  claude: 'Claude AI',
  rules: 'Offline mode',
}

const SUGGESTIONS = [
  'Why is my risk this level?',
  'What should I do next?',
  'How reliable is this result?',
]

export function AssistantChat({ predictionId }: { predictionId: number }) {
  const history = useChatHistory(predictionId)
  const status = useAssistantStatus()
  const send = useSendChat(predictionId)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const messages = history.data ?? []
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, pending])

  const ask = (text: string) => {
    const message = text.trim()
    if (!message || send.isPending) return
    setDraft('')
    setPending(message)
    send.mutate(message, { onSettled: () => setPending(null) })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Bot className="size-5 text-brand-600" aria-hidden /> Ask the assistant
          </span>
        }
        description="Questions about this result, answered in plain language."
        action={
          status.data && (
            <Badge className="bg-zinc-100 text-zinc-600">
              {PROVIDER_LABEL[status.data.provider] ?? 'Offline mode'}
            </Badge>
          )
        }
      />
      <div
        ref={scroller}
        className="mx-5 mt-4 h-80 space-y-3 overflow-y-auto rounded-lg bg-zinc-50 p-3"
        aria-live="polite"
      >
        {history.isPending && <Spinner />}
        {messages.length === 0 && !pending && !history.isPending && (
          <p className="p-2 text-sm text-zinc-500">
            Hi! I can explain what this result means, why the model reached it and what general next
            steps are. I can't diagnose or advise on medicines.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line',
                m.role === 'user'
                  ? 'rounded-br-sm bg-brand-600 text-white'
                  : 'rounded-bl-sm border border-zinc-200 bg-white text-zinc-800',
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3.5 py-2 text-sm text-white">
                {pending}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Spinner className="size-4" /> Thinking…
            </div>
          </>
        )}
        {send.data?.emergency && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">
            <TriangleAlert className="size-4" /> If this is an emergency, call 112 now.
          </div>
        )}
      </div>
      {send.error && <p className="mx-5 mt-2 text-sm text-red-600">{errorMessage(send.error)}</p>}
      <div className="flex flex-wrap gap-2 px-5 pt-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:border-brand-500 hover:text-brand-700"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          ask(draft)
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder="Type your question…"
          aria-label="Your question"
          className="h-10 flex-1 rounded-lg border border-zinc-300 px-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10"
          loading={send.isPending}
          aria-label="Send"
        >
          {!send.isPending && <Send className="size-4" />}
        </Button>
      </form>
    </Card>
  )
}
