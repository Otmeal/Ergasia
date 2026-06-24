import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  checkHealth,
  getDefaultSyncBaseUrl,
  getSyncBaseUrl,
  resetSyncBaseUrl,
  setSyncBaseUrl,
} from '../../api'
import { getErrorMessage } from '../../utils/presentation'

type SettingsPageProps = {
  isSaving: boolean
  onRunSync: () => Promise<void>
}

type TestState = { kind: 'idle' | 'testing' | 'ok' | 'fail'; message: string }

export function SettingsPage({ isSaving, onRunSync }: SettingsPageProps) {
  const [baseUrl, setBaseUrl] = useState(getSyncBaseUrl())
  const [test, setTest] = useState<TestState>({ kind: 'idle', message: '' })
  const defaultBaseUrl = getDefaultSyncBaseUrl()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const normalized = setSyncBaseUrl(baseUrl)
      setBaseUrl(normalized)
      setTest({ kind: 'idle', message: '已儲存，正在同步。' })
      await onRunSync()
    } catch (error: unknown) {
      setTest({ kind: 'fail', message: getErrorMessage(error) })
    }
  }

  async function handleTest() {
    setTest({ kind: 'testing', message: '測試連線中。' })

    try {
      setSyncBaseUrl(baseUrl)
      const health = await checkHealth()
      setTest({ kind: 'ok', message: `連線成功：${health.status}` })
    } catch (error: unknown) {
      setTest({ kind: 'fail', message: getErrorMessage(error) })
    }
  }

  function handleReset() {
    const value = resetSyncBaseUrl()
    setBaseUrl(value)
    setTest({ kind: 'idle', message: '已還原為預設網址。' })
  }

  return (
    <section className="workspace single">
      <div className="surface main-surface">
        <div className="surface-header">
          <div>
            <h2>設定</h2>
            <p>同步伺服器網址</p>
          </div>
        </div>

        <form className="editor-form" onSubmit={handleSubmit}>
          <label>
            <span>同步網址</span>
            <input
              required
              type="url"
              inputMode="url"
              placeholder={defaultBaseUrl}
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </label>
          <p className="field-hint">預設：{defaultBaseUrl}</p>

          {test.message ? (
            <p className={`field-hint ${test.kind === 'fail' ? 'is-error' : ''}`}>{test.message}</p>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="primary-action" disabled={isSaving}>
              儲存並同步
            </button>
            <button
              type="button"
              className="ghost-action"
              disabled={test.kind === 'testing'}
              onClick={() => void handleTest()}
            >
              測試連線
            </button>
            <button type="button" className="ghost-action" onClick={handleReset}>
              還原預設
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
