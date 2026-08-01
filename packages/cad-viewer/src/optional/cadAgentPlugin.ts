import { defineComponent, h } from 'vue'

import { store } from '../app/store'

export const AgentChatPanel = defineComponent({
  name: 'CadFluxDisabledAgentChatPanel',
  setup() {
    return () => h('div', { class: 'ml-agent-plugin-disabled' })
  }
})

export function registerOptionalAgentPlugin() {
  store.features.agentPlugin = false
}

