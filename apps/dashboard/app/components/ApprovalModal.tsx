'use client'

interface ApprovalModalProps {
  action: string
  onAllow: () => void
  onDeny: () => void
  timeoutSeconds?: number
}

export function ApprovalModal({
  action,
  onAllow,
  onDeny,
  timeoutSeconds = 300,
}: ApprovalModalProps) {
  return (
    <div role="dialog" aria-modal="true" data-testid="approval-modal">
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
          <h2 className="text-lg font-bold mb-2">Action Requires Approval</h2>
          <p className="text-gray-700 mb-4" data-testid="approval-action">
            {action}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Auto-deny in {timeoutSeconds}s if no response.
          </p>
          <div className="flex gap-3">
            <button
              data-testid="approval-allow"
              onClick={onAllow}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold"
            >
              Allow
            </button>
            <button
              data-testid="approval-deny"
              onClick={onDeny}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold"
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
