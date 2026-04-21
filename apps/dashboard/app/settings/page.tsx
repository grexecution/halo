'use client'
import { useState } from 'react'

interface PermissionSettings {
  sudoEnabled: boolean
  urlWhitelistMode: boolean
  telemetryEnabled: boolean
  otelEndpoint: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PermissionSettings>({
    sudoEnabled: false,
    urlWhitelistMode: false,
    telemetryEnabled: true,
    otelEndpoint: '',
  })
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <section className="border rounded p-4 mb-4 space-y-3">
        <h2 className="font-semibold">Global Permissions</h2>
        <label className="flex items-center gap-2">
          <input
            data-testid="sudo-toggle"
            type="checkbox"
            checked={settings.sudoEnabled}
            onChange={(e) => setSettings((prev) => ({ ...prev, sudoEnabled: e.target.checked }))}
          />
          <span>Enable sudo for shell commands</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            data-testid="url-whitelist-toggle"
            type="checkbox"
            checked={settings.urlWhitelistMode}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, urlWhitelistMode: e.target.checked }))
            }
          />
          <span>URL whitelist mode (restrict outbound requests)</span>
        </label>
      </section>

      <section className="border rounded p-4 mb-4 space-y-3">
        <h2 className="font-semibold">Telemetry</h2>
        <label className="flex items-center gap-2">
          <input
            data-testid="telemetry-toggle"
            type="checkbox"
            checked={settings.telemetryEnabled}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, telemetryEnabled: e.target.checked }))
            }
          />
          <span>Enable OpenTelemetry</span>
        </label>
        <input
          data-testid="otel-endpoint"
          className="w-full border rounded px-2 py-1"
          placeholder="OTel endpoint URL (optional)"
          value={settings.otelEndpoint}
          onChange={(e) => setSettings((prev) => ({ ...prev, otelEndpoint: e.target.value }))}
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          data-testid="save-settings-button"
          onClick={handleSave}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Save Settings
        </button>
        {saved && (
          <span data-testid="save-confirmation" className="text-green-600">
            Saved!
          </span>
        )}
      </div>
    </main>
  )
}
