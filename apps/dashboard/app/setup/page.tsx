'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2, Eye, EyeOff, Bot, Send } from 'lucide-react'
import { Button, Input, Label, Select, cn } from '../components/ui/index'

const CONTROL_PLANE = '' // use relative URLs — proxied server-side via /api/setup

type Provider = 'anthropic' | 'openai' | 'ollama'
type Step = 'llm' | 'telegram' | 'done'

export default function SetupPage() {
  const router = useRouter()

  // Step state
  const [step, setStep] = useState<Step>('llm')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // LLM fields
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [showKey, setShowKey] = useState(false)

  // Telegram fields
  const [telegramToken, setTelegramToken] = useState('')
  const [skipTelegram, setSkipTelegram] = useState(false)

  async function saveSetup() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${CONTROL_PLANE}/api/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llmProvider: provider,
          anthropicKey: provider === 'anthropic' ? anthropicKey : undefined,
          openaiKey: provider === 'openai' ? openaiKey : undefined,
          ollamaModel: provider === 'ollama' ? ollamaModel : undefined,
          telegramBotToken: skipTelegram ? undefined : telegramToken || undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Server error ${res.status}`)
        return
      }
      setStep('done')
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  function handleLLMNext(e: React.FormEvent) {
    e.preventDefault()
    if (provider === 'anthropic' && !anthropicKey.trim()) {
      setError('Anthropic API key is required.')
      return
    }
    if (provider === 'openai' && !openaiKey.trim()) {
      setError('OpenAI API key is required.')
      return
    }
    setError(null)
    setStep('telegram')
  }

  function handleTelegramNext(e: React.FormEvent) {
    e.preventDefault()
    saveSetup()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / title */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Bot size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to open-greg</h1>
          <p className="text-sm text-gray-400 text-center">
            Let&apos;s get your agent configured. This takes about 2 minutes.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['llm', 'telegram', 'done'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                'h-2 rounded-full transition-all',
                step === s ? 'w-6 bg-indigo-500' : 'w-2',
                (['llm', 'telegram', 'done'] as Step[]).indexOf(step) > i
                  ? 'bg-indigo-400'
                  : step !== s
                    ? 'bg-gray-700'
                    : '',
              )}
            />
          ))}
        </div>

        {/* ── Step 1: LLM ── */}
        {step === 'llm' && (
          <form onSubmit={handleLLMNext} className="bg-gray-900 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Choose your AI model</h2>
              <p className="text-xs text-gray-400">
                This is the model your agent will use by default.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-gray-300">Provider</Label>
              <Select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as Provider)
                  setError(null)
                }}
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="ollama">Ollama (local)</option>
              </Select>
            </div>

            {provider === 'anthropic' && (
              <div className="space-y-1">
                <Label className="text-gray-300">Anthropic API key</Label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-ant-..."
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    className="pr-10 font-mono text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Get yours at{' '}
                  <a
                    href="https://console.anthropic.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>
            )}

            {provider === 'openai' && (
              <div className="space-y-1">
                <Label className="text-gray-300">OpenAI API key</Label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="pr-10 font-mono text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {provider === 'ollama' && (
              <div className="space-y-1">
                <Label className="text-gray-300">Model name</Label>
                <Input
                  type="text"
                  placeholder="llama3.2"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Ollama must be running locally. Run{' '}
                  <code className="bg-gray-800 px-1 rounded text-gray-300">
                    ollama pull {ollamaModel || 'llama3.2'}
                  </code>{' '}
                  first.
                </p>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 rounded px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
              Continue →
            </Button>
          </form>
        )}

        {/* ── Step 2: Telegram ── */}
        {step === 'telegram' && (
          <form onSubmit={handleTelegramNext} className="bg-gray-900 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Connect Telegram (optional)</h2>
              <p className="text-xs text-gray-400">
                Chat with your agent via Telegram. You can set this up later in Settings.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-gray-300">Bot token</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="123456:ABC-DEF..."
                  value={telegramToken}
                  onChange={(e) => {
                    setTelegramToken(e.target.value)
                    setSkipTelegram(false)
                  }}
                  disabled={skipTelegram}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Create a bot with{' '}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  @BotFather
                </a>{' '}
                and paste the token here.
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipTelegram}
                onChange={(e) => setSkipTelegram(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-indigo-500"
              />
              <span className="text-sm text-gray-400">Skip for now</span>
            </label>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 rounded px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-gray-400"
                onClick={() => setStep('llm')}
                disabled={saving}
              >
                ← Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                disabled={saving || (!skipTelegram && !telegramToken.trim())}
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Send size={14} className="mr-2" />
                    Finish setup
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="bg-gray-900 rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
            <CheckCircle size={48} className="text-green-400" />
            <div>
              <h2 className="text-xl font-bold text-white mb-1">You&apos;re all set!</h2>
              <p className="text-sm text-gray-400">
                Your agent is ready. Head to the chat to start working.
              </p>
            </div>
            <Button
              onClick={() => router.push('/chat')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8"
            >
              Open chat →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
