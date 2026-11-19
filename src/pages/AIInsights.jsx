import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Info,
  Loader2,
  MessageSquare,
  PackagePlus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Target,
  UserRound,
} from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { DemoBanner, EmptyState, ErrorState } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { AXIS_PROPS, GRID_PROPS, SERIES_COLORS, compactCurrency, tooltipStyle } from '../components/charts/chartTheme'
import { useAsync } from '../hooks/useAsync'
import { getAIInsights } from '../services/analyticsService'
import {
  AI_CHAT_AVAILABLE,
  getAIStatus,
  sendAIMessage,
  sendAIMessageStream,
} from '../services/aiService'
import { useAuth } from '../context/AuthContext'
import { USE_MOCK_API } from '../services/api'
import { cn, formatCurrency, formatDate, formatNumber, formatPercent } from '../utils/format'

const URGENCY_TONES = {
  critical: 'bg-red-50 text-red-700 ring-red-200/70',
  high: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  medium: 'bg-brand-50 text-brand-700 ring-brand-200/70',
}

const HORIZONS = [
  { days: 7, label: 'Next 7 days' },
  { days: 30, label: 'Next 30 days' },
]

const RecommendationCard = ({ rec, onReorder }) => (
  <li className="neu-soft rounded-[1.25rem] border border-white/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{rec.title}</p>
        <p className="mt-1 text-xs text-app-muted">
          Stock {formatNumber(rec.currentStock)} units &middot; reorder level {formatNumber(rec.reorderLevel)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={rec.urgency === 'critical' ? 'danger' : rec.urgency === 'high' ? 'warning' : 'brand'}>
          {rec.urgency} priority
        </Badge>
      </div>
    </div>

    <p className="neu-inset-sm mt-3 rounded-xl border border-white/40 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
      {rec.reason}
    </p>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.1em] text-app-muted uppercase">Suggested order</p>
          <p className="text-lg font-extrabold tracking-tight text-slate-900">+{formatNumber(rec.suggestedQuantity)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-[0.1em] text-app-muted uppercase">Confidence</p>
          <p className="text-sm font-bold text-slate-700">{formatPercent(rec.confidence)}</p>
        </div>
      </div>
      <Button size="sm" variant="secondary" icon={PackagePlus} onClick={() => onReorder(rec)}>
        Create purchase requisition
      </Button>
    </div>
  </li>
)

const STARTER_PROMPTS = [
  'Analyze my inventory and identify the biggest risks.',
  'Which medicines are expiring within 30 days?',
  'Summarize the pending orders.',
]

const ASSISTANT_STATUS_TONES = {
  ready: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  idle: 'bg-slate-100 text-slate-600 ring-slate-200/70',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  error: 'bg-red-50 text-red-700 ring-red-200/70',
}

const AssistantMessage = ({ message, isLast, sending, onFollowUp }) => {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex items-start gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl shadow-soft',
          isUser ? 'bg-brand-600 text-white' : 'bg-app-surface text-brand-700',
        )}
      >
        {isUser ? (
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </span>
      <div className={cn('flex min-w-0 max-w-[88%] flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-soft',
            isUser
              ? 'bg-brand-600 text-white'
              : message.error
                ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/70'
                : 'bg-white/70 text-slate-700 ring-1 ring-inset ring-white/60',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {message.limited ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200/70">
            <ShieldAlert className="h-3 w-3" aria-hidden="true" />
            Business data only — no medical advice
          </span>
        ) : null}
        {message.sources?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((source) => {
              const detail = [
                source.detail,
                source.asOf ? `As of ${source.asOf}` : null,
              ]
                .filter(Boolean)
                .join('\n')
              return (
                <span key={source.tool} title={detail || undefined}>
                  <Badge tone="brand" size="sm">
                    {source.label}
                  </Badge>
                </span>
              )
            })}
          </div>
        ) : null}
        {isLast && !sending && message.followUps?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {message.followUps.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onFollowUp(prompt)}
                className="rounded-full bg-brand-50 px-3 py-1 text-left text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200/60 transition-colors hover:bg-brand-100"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

const AssistantPanel = () => {
  const { toast } = useToast()
  const [status, setStatus] = useState({ loading: AI_CHAT_AVAILABLE, data: null, error: null })
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const [stage, setStage] = useState(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (!AI_CHAT_AVAILABLE) return undefined
    let active = true
    getAIStatus()
      .then((data) => {
        if (active) setStatus({ loading: false, data, error: null })
      })
      .catch((err) => {
        if (active) setStatus({ loading: false, data: null, error: err.message })
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, sending])

  const ready = AI_CHAT_AVAILABLE && status.data?.enabled !== false

  const send = async (text) => {
    const value = (text ?? input).trim()
    if (!value || sending) return

    if (!AI_CHAT_AVAILABLE) {
      toast(
        'The live assistant needs the Flask API. Start the backend and turn off demo mode to ask questions.',
        { type: 'info', title: 'Assistant unavailable in demo mode' },
      )
      return
    }

    if (status.data && status.data.enabled === false) {
      toast(
        'The assistant is not configured. Ask an administrator to set the LLM provider, model and API key.',
        { type: 'warning', title: 'Assistant not configured' },
      )
      return
    }

    if (value.length > 2000) {
      toast('Keep the question to 2000 characters or fewer.', { type: 'warning' })
      return
    }

    const useStream = Boolean(status.data?.streaming)

    setInput('')
    setError(null)
    setDraft('')
    setStage(null)
    stoppedRef.current = false
    setMessages((prev) => [...prev, { role: 'user', content: value }])
    setSending(true)

    try {
      let data
      if (useStream) {
        const controller = new AbortController()
        abortRef.current = controller
        setStage('Thinking…')
        data = await sendAIMessageStream({
          message: value,
          conversationId,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'status') {
              setDraft('')
              setStage(
                event.stage === 'reading'
                  ? 'Reading your data…'
                  : event.stage === 'writing'
                    ? 'Writing the answer…'
                    : 'Thinking…',
              )
            } else if (event.type === 'delta') {
              setDraft((prev) => prev + event.text)
            }
          },
        })
      } else {
        data = await sendAIMessage({ message: value, conversationId })
      }
      if (data.conversation_id) setConversationId(data.conversation_id)
      setDraft('')
      setStage(null)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources ?? [],
          followUps: data.follow_ups ?? [],
          limited: Boolean(data.limited),
        },
      ])
    } catch (err) {
      if (stoppedRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Answer stopped. The partial response was saved to this conversation.',
          },
        ])
      } else {
        const message = err?.message || 'The assistant could not answer. Please try again.'
        setError(message)
        setMessages((prev) => [...prev, { role: 'assistant', content: message, error: true }])
        toast(message, { type: 'error', title: 'Assistant error' })
      }
    } finally {
      abortRef.current = null
      setDraft('')
      setStage(null)
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const stop = () => {
    if (!sending || !abortRef.current) return
    stoppedRef.current = true
    abortRef.current.abort()
  }

  const reset = () => {
    if (abortRef.current) {
      stoppedRef.current = true
      abortRef.current.abort()
      abortRef.current = null
    }
    setMessages([])
    setConversationId(null)
    setError(null)
    setInput('')
    setDraft('')
    setStage(null)
    inputRef.current?.focus()
  }

  let chip = { label: 'Checking provider', tone: 'idle' }
  if (!AI_CHAT_AVAILABLE) {
    chip = { label: 'Demo mode', tone: 'idle' }
  } else if (status.error) {
    chip = { label: 'Status unavailable', tone: 'warning' }
  } else if (status.data?.enabled) {
    chip = {
      label: `${status.data.provider} · ${status.data.model}`,
      tone: 'ready',
    }
  } else if (status.data) {
    chip = { label: 'Not configured', tone: 'warning' }
  }

  return (
    <Card>
      <CardHeader
        title="Ask MediFlow AI"
        description="Ask about inventory, orders, sales or expiry. Answers use live read-only database tools."
        icon={MessageSquare}
        action={
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex max-w-[14rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
                ASSISTANT_STATUS_TONES[chip.tone],
              )}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
              <span className="truncate">{chip.label}</span>
            </span>
            {messages.length ? (
              <Button size="sm" variant="ghost" icon={RefreshCw} onClick={reset}>
                New
              </Button>
            ) : null}
          </div>
        }
      />
      <CardBody className="space-y-3">
        {!AI_CHAT_AVAILABLE ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/70">
            This build runs in demo mode, so the live assistant is disabled. Start the Flask API
            and set <code className="font-mono">VITE_USE_MOCK_API=false</code> to ask questions
            about real data. No answers are fabricated here.
          </p>
        ) : null}
        {AI_CHAT_AVAILABLE && status.data && status.data.enabled === false ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/70">
            The assistant is not configured on the server. An administrator must set{' '}
            <code className="font-mono">LLM_PROVIDER</code>, <code className="font-mono">LLM_MODEL</code>{' '}
            and an API key (or Ollama base URL).
          </p>
        ) : null}

        <div
          ref={listRef}
          aria-live="polite"
          className="scroll-thin max-h-[26rem] min-h-[7rem] space-y-3 overflow-y-auto pr-1"
        >
          {messages.length === 0 && !sending ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-white/60">
                <p className="flex items-center gap-2 font-semibold text-slate-800">
                  <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  Start with a question about your operations.
                </p>
                <p className="mt-1 text-xs text-app-muted">
                  The assistant only reads data your role is allowed to see. It cannot place
                  orders, change stock or give medical advice.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    disabled={!ready}
                    className="rounded-full bg-brand-50 px-3 py-1.5 text-left text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200/60 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <AssistantMessage
              key={`${message.role}-${index}`}
              message={message}
              isLast={index === messages.length - 1}
              sending={sending}
              onFollowUp={send}
            />
          ))}

          {sending ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-xs text-app-muted">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-app-surface text-brand-700 shadow-soft">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                </span>
                {stage || 'Checking your data…'}
              </div>
              {draft ? (
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-app-surface text-brand-700 shadow-soft">
                    <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="max-w-[88%] rounded-2xl bg-white/70 px-3.5 py-2.5 text-sm leading-relaxed text-slate-600 ring-1 ring-inset ring-white/60">
                    <p className="whitespace-pre-wrap break-words">
                      {draft}
                      <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-brand-500 align-middle" aria-hidden="true" />
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200/70">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
          className="space-y-2"
        >
          <label htmlFor="ai-assistant-input" className="sr-only">
            Ask the MediFlow assistant
          </label>
          <textarea
            id="ai-assistant-input"
            ref={inputRef}
            rows={2}
            value={input}
            maxLength={2000}
            disabled={!ready || sending}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            placeholder={
              ready
                ? 'e.g. Which medicines should I reorder first?'
                : 'The assistant is unavailable until the backend is connected.'
            }
            className="neu-inset-sm w-full resize-none rounded-xl border border-white/40 px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/60 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-app-muted">
              Enter to send · Shift + Enter for a new line · No medical advice
            </p>
            {sending && status.data?.streaming ? (
              <Button type="button" size="sm" variant="ghost" icon={Square} onClick={stop}>
                Stop
              </Button>
            ) : null}
            <Button
              type="submit"
              size="sm"
              icon={Send}
              loading={sending}
              disabled={!ready || !input.trim() || sending}
            >
              Ask assistant
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

export const AIInsights = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [horizon, setHorizon] = useState(7)
  const { data, loading, error, reload } = useAsync(() => getAIInsights(horizon), [horizon])

  const demandChart = useMemo(
    () =>
      (data?.demandForecast ?? []).map((row) => ({
        label: row.label.replace(/\s+\d+\s*(mg|mcg|IU).*$/i, ''),
        predicted: row.predicted,
        actual: row.actual,
      })),
    [data],
  )

  const forecastChart = (data?.monthlyForecast ?? []).map((row) => ({
    period: row.period,
    actual: row.actual,
    predicted: row.predicted,
  }))

  const handleReorder = (rec) => {
    toast(
      USE_MOCK_API
        ? `Requisition draft created for ${rec.suggestedQuantity} units of ${rec.title}. Purchase orders require the Flask backend.`
        : `Suggested order: ${rec.suggestedQuantity} units of ${rec.title}. Purchase orders are not part of this release.`,
      { type: 'info', title: USE_MOCK_API ? 'Demo action' : 'Reorder suggestion' },
    )
  }

  return (
    <div className="space-y-4">
      <Helmet title="AI Insights" description="Demand forecasts, replenishment recommendations and an optional read-only operations assistant." />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
            Intelligence
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            AI demand insights
          </h2>
          <p className="mt-0.5 text-sm text-app-muted">
            Forecasts, replenishment suggestions and stockout exposure for the next {horizon} days.
          </p>
        </div>
        <div
          className="neu-segmented flex rounded-xl p-1"
          role="group"
          aria-label="Select forecast horizon"
        >
          {HORIZONS.map((h) => (
            <button
              key={h.days}
              type="button"
              onClick={() => setHorizon(h.days)}
              aria-pressed={horizon === h.days}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500"
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <DemoBanner icon={Info}>
        <strong className="font-semibold">Demo predictions.</strong>{' '}
        {data?.disclaimer ?? 'These values are illustrative sample outputs, not generated by a trained forecasting model.'}
      </DemoBanner>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      <AssistantPanel />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Forecast model', value: data?.model?.name ?? '-', icon: Sparkles, tone: 'text-brand-700' },
          { label: 'Model accuracy', value: data ? formatPercent(data.model.accuracy) : '-', icon: Target, tone: 'text-accent-700' },
          { label: 'Recommendations', value: data?.recommendations?.length ?? 0, icon: PackagePlus, tone: 'text-amber-700' },
          { label: 'Stockout warnings', value: data?.stockoutRisk?.length ?? 0, icon: ShieldAlert, tone: 'text-red-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop">
            <div className="flex items-center gap-2.5 text-app-muted">
              <span className="rounded-xl bg-app-surface p-1.5 text-slate-500 shadow-soft">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase">{label}</p>
            </div>
            {loading ? (
              <Skeleton className="mt-2.5 h-7 w-28" />
            ) : (
              <p className={`mt-1.5 truncate text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Predicted demand vs actual"
            description={`Units for the next ${horizon} days`}
            icon={Target}
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={demandChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="label" {...AXIS_PROPS} interval={0} angle={-20} textAnchor="end" height={52} />
                    <YAxis {...AXIS_PROPS} width={46} tickFormatter={compactCurrency} />
                    <Tooltip
                      {...tooltipStyle}
                      cursor={{ fill: 'rgba(108,99,255,0.06)' }}
                      formatter={(value, name) => [
                        `${formatNumber(value)} units`,
                        name === 'predicted' ? 'Predicted demand' : 'Actual issued',
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: 12, fontWeight: 600, color: '#718096' }}
                    />
                    <Bar dataKey="predicted" name="predicted" fill={SERIES_COLORS.brand} radius={[3, 3, 0, 0]} barSize={12} />
                    <Bar dataKey="actual" name="actual" fill={SERIES_COLORS.accent} radius={[3, 3, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Weekly demand outlook"
            description="Actual issues compared with predicted demand"
            icon={Sparkles}
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={forecastChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="period" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} width={46} tickFormatter={compactCurrency} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value, name) => [
                        value === null || value === undefined ? 'Not yet observed' : `${formatNumber(value)} units`,
                        name === 'actual' ? 'Actual issued' : 'Predicted demand',
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: 12, fontWeight: 600, color: '#718096' }}
                    />
                    <Line type="monotone" dataKey="actual" name="actual" stroke={SERIES_COLORS.accent} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    <Line type="monotone" dataKey="predicted" name="predicted" stroke={SERIES_COLORS.brand} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Smart replenishment recommendations"
          description="Each suggestion explains the signal that produced it"
          icon={PackagePlus}
        />
        <CardBody>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : (data?.recommendations ?? []).length === 0 ? (
            <EmptyState
              title="No replenishment needed"
              description="Forecast demand is fully covered by current usable stock."
            />
          ) : (
            <ul className="space-y-3">
              {data.recommendations.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} onReorder={handleReorder} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Stockout risk" description="Estimated days of cover remaining" icon={ShieldAlert} />
          <div className="divide-y divide-app-border/50">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (data?.stockoutRisk ?? []).length === 0 ? (
              <EmptyState compact title="No stockout risk detected" description="All tracked SKUs have adequate cover." />
            ) : (
              (data?.stockoutRisk ?? []).map((risk) => (
                <div
                  key={risk.medicineId}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{risk.name}</p>
                    <span
                      className={cn(
                        'mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                        URGENCY_TONES[risk.risk] ?? URGENCY_TONES.medium,
                      )}
                    >
                      {risk.risk} risk
                    </span>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold text-slate-800">
                    {risk.daysToStockout} days
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Near-expiry inventory warnings"
            description="Batches expiring within 90 days"
            icon={CalendarClock}
          />
          <div className="scroll-thin max-h-96 divide-y divide-app-border/50 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (data?.expiryRisk ?? []).length === 0 ? (
              <EmptyState compact title="No near-expiry batches" description="No batch expires within the next 90 days." />
            ) : (
              (data?.expiryRisk ?? []).map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                    <p className="font-mono text-xs text-app-muted">
                      {row.batchNumber} &middot; {formatNumber(row.quantity)} units &middot;{' '}
                      {formatDate(row.expiryDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-soft',
                        row.daysLeft <= 30 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800',
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {row.daysLeft}d
                    </span>
                    <p className="mt-1 text-[11px] text-app-muted">{formatCurrency(row.valueAtRisk, { compact: true })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Model metadata</p>
            <p className="mt-0.5 text-xs text-app-muted">
              Reported for transparency only. Values describe the heuristic, not a production model.
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
            {[
              ['Model', data?.model?.name ?? '-'],
              ['Horizon', data ? `${data.model.horizonDays} days` : '-'],
              ['Sample size', data ? formatNumber(data.model.sampleSize) : '-'],
              ['Refreshed', data ? formatDate(data.model.trainedOn) : '-'],
            ].map(([label, value]) => (
              <div key={label} className="neu-inset-sm rounded-xl px-3 py-1.5">
                <dt className="text-[10px] font-bold tracking-[0.08em] text-app-muted uppercase">{label}</dt>
                <dd className="font-bold text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
        <p className="px-4 pb-4 text-[11px] text-slate-400 sm:px-5">
          Signed in as {user?.name} ({user?.role}). Forecast visibility does not grant data access -
          the API must enforce permissions.
        </p>
      </Card>
    </div>
  )
}

export default AIInsights