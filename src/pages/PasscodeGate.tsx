import { useState } from 'react'
import { PageHeader, SectionCard } from '../components/Layout'
import { Chip } from '../components/StatusChip'

export function PasscodeGate() {
  const [passcode, setPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (passcode !== confirmPasscode) {
      alert('Passcodes do not match')
      return
    }
    if (passcode.length < 4) {
      alert('Passcode must be at least 4 characters')
      return
    }
    setEnabled(true)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const handleDisable = () => {
    setEnabled(false)
    setPasscode('')
    setConfirmPasscode('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  return (
    <>
      <PageHeader
        title="Passcode Gate"
        subtitle="Owner-only access — passcode protects the entire app (doc 18, 23)"
        action={
          <button onClick={handleSave} className="rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800">
            {saved ? '✓ Saved' : 'Save'}
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Passcode settings">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-gray-900">Passcode enabled</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  When enabled, the entire app requires a passcode to access.
                </div>
              </div>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`shrink-0 rounded-full w-12 h-6 transition relative ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                aria-pressed={enabled}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-6.5' : 'left-0.5'}`} />
              </button>
            </div>

            {enabled && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600">New passcode</label>
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500"
                    placeholder="Enter passcode (min 4 chars)"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Confirm passcode</label>
                  <input
                    type="password"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500"
                    placeholder="Confirm passcode"
                  />
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={handleDisable}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Disable passcode
                  </button>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Session settings">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-gray-900">Session timeout</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Minutes of inactivity before requiring passcode again.
                </div>
              </div>
              <input
                type="number"
                min={5}
                max={120}
                value={30}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-right tabular-nums focus:border-blue-500"
              />
            </div>
            <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
              <Chip tone="gray">passcode gate</Chip>
              <Chip tone="gray">session timeout</Chip>
              <Chip tone="gray">auto-lock</Chip>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  )
}