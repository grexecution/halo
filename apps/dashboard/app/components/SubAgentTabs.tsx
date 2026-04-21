'use client'

interface AgentTab {
  id: string
  handle: string
  name: string
}

interface SubAgentTabsProps {
  agents: AgentTab[]
  activeTab: string
  onTabChange: (id: string) => void
}

export default function SubAgentTabs({ agents, activeTab, onTabChange }: SubAgentTabsProps) {
  return (
    <div className="flex border-b gap-1" data-testid="subagent-tabs">
      {agents.map((agent) => (
        <button
          key={agent.id}
          data-testid={`tab-${agent.id}`}
          onClick={() => onTabChange(agent.id)}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === agent.id
              ? 'border-blue-500 text-blue-600 active'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          @{agent.handle}
        </button>
      ))}
    </div>
  )
}
