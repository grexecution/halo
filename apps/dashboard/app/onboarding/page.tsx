'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'assistant' | 'user'
  content: string
  timestamp: Date
}

interface OnboardingStep {
  key: string
  question: string
  placeholder: string
  optional?: boolean
  type?: 'text' | 'password' | 'multiline'
}

const STEPS: OnboardingStep[] = [
  {
    key: 'name',
    question: `Hey. I'm Halo — your self-hosted AI agent.\n\nI'm running entirely on your hardware. No data leaves your server.\n\nLet's get set up. What should I call you?`,
    placeholder: 'Your name',
  },
  {
    key: 'occupation',
    question: `Good to meet you. What kind of work do you do? This helps me calibrate how I communicate and what tools to prioritise.`,
    placeholder: 'e.g. developer, founder, researcher...',
  },
  {
    key: 'timezone',
    question: `What timezone are you in? I'll use this for scheduling goals and cron tasks.\n\n(e.g. Europe/Vienna, America/New_York, Asia/Tokyo)`,
    placeholder: 'e.g. Europe/Vienna',
  },
  {
    key: 'anthropicKey',
    question: `Now let's connect your tools.\n\nAnthropic API key — this powers the main chat and reasoning. If you already set one during install, just hit Enter to skip.`,
    placeholder: 'sk-ant-... (or press Enter to skip)',
    optional: true,
    type: 'password',
  },
  {
    key: 'telegramToken',
    question: `Telegram bot token — lets you message me from your phone. Create a bot at @BotFather and paste the token here. Skip if you don't need it.`,
    placeholder: 'Paste token (or press Enter to skip)',
    optional: true,
    type: 'password',
  },
  {
    key: 'githubToken',
    question: `GitHub personal access token — lets me read repos, open PRs, check CI. Skip if not needed.`,
    placeholder: 'ghp_... (or press Enter to skip)',
    optional: true,
    type: 'password',
  },
  {
    key: 'customNotes',
    question: `Last one. Anything else I should know about you or how you work? Tools you use, preferences, things that annoy you — all fair game. Or just skip it.`,
    placeholder: 'e.g. I prefer short answers, I use Vim, always check with me before deleting files...',
    optional: true,
    type: 'multiline',
  },
]

const FINISH_MESSAGE = (name: string) =>
  `You're all set${name ? `, ${name}` : ''}.\n\nI've saved your profile. You can update any of this later in Settings.\n\nLet's go.`

export default function OnboardingPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [input, setInput] = useState('')
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check if already onboarded
  useEffect(() => {
    fetch('/api/onboarding-proxy')
      .then((r) => r.json())
      .then((d: { complete: boolean }) => {
        if (d.complete) router.replace('/chat')
      })
      .catch(() => {})
  }, [router])

  // Show first question
  useEffect(() => {
    if (messages.length === 0 && STEPS[0]) {
      setTimeout(() => {
        addAssistantMessage(STEPS[0]!.question)
      }, 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!done) inputRef.current?.focus()
  }, [stepIndex, done])

  const addAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: 'assistant', content, timestamp: new Date() }])
  }, [])

  const saveStep = useCallback(
    async (key: string, value: string, isLast: boolean) => {
      const update: Record<string, string | boolean> = {}
      if (value) update[key] = value
      if (isLast) update['complete'] = true

      try {
        await fetch('/api/onboarding-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        })
      } catch {
        // non-fatal — local state is still updated
      }
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    const step = STEPS[stepIndex]
    if (!step || loading) return

    const value = input.trim()

    // Require non-empty for non-optional steps
    if (!value && !step.optional) return

    setLoading(true)

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: value || '(skipped)', timestamp: new Date() },
    ])
    setInput('')

    // Update profile
    const newProfile = { ...profile }
    if (value) newProfile[step.key] = value
    setProfile(newProfile)

    const nextIndex = stepIndex + 1
    const isLast = nextIndex >= STEPS.length

    // Save to backend
    await saveStep(step.key, value, isLast)

    if (isLast) {
      // Show finish message then redirect
      setTimeout(() => {
        addAssistantMessage(FINISH_MESSAGE(newProfile['name'] ?? ''))
        setDone(true)
        setTimeout(() => router.push('/chat'), 2500)
      }, 400)
    } else {
      setStepIndex(nextIndex)
      const nextStep = STEPS[nextIndex]!
      setTimeout(() => {
        addAssistantMessage(nextStep.question)
        setLoading(false)
      }, 400)
      return
    }

    setLoading(false)
  }, [stepIndex, input, profile, loading, saveStep, addAssistantMessage, router])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = STEPS[stepIndex]
      if (e.key === 'Enter' && !e.shiftKey && step?.type !== 'multiline') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [stepIndex, handleSubmit],
  )

  const currentStep = STEPS[stepIndex]

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary text-sm font-bold">H</span>
        </div>
        <div>
          <div className="font-semibold text-sm">Halo</div>
          <div className="text-xs text-muted-foreground">Setting up your agent</div>
        </div>
        {/* Progress dots */}
        <div className="ml-auto flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i < stepIndex
                  ? 'bg-primary'
                  : i === stepIndex
                    ? 'bg-primary/60'
                    : 'bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-2 mt-1 shrink-0">
                <span className="text-primary text-xs font-bold">H</span>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-muted text-foreground rounded-tl-sm'
                  : 'bg-primary text-primary-foreground rounded-tr-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && !done && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-2 mt-1 shrink-0">
              <span className="text-primary text-xs font-bold">H</span>
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!done && currentStep && (
        <div className="border-t px-4 py-4 max-w-2xl mx-auto w-full">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentStep.placeholder}
              rows={currentStep.type === 'multiline' ? 3 : 1}
              className={`flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${
                currentStep.type === 'password' ? 'tracking-widest placeholder:tracking-normal' : ''
              }`}
            />
            <button
              onClick={handleSubmit}
              disabled={loading || (!input.trim() && !currentStep.optional)}
              className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {currentStep.optional && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter or send empty to skip
            </p>
          )}
          {currentStep.type === 'multiline' && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Shift+Enter for new line · Enter to send
            </p>
          )}
        </div>
      )}
    </div>
  )
}
