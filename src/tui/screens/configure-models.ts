// src/tui/screens/configure-models.ts — Configure OpenCode model assignments

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import { bold, cyan, gray, green, red, yellow } from "../theme"

export const configureModelsScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const modelConfig = state.modelConfig
    const lines: string[] = []
    lines.push(bold(cyan("Configure models")))
    lines.push(gray("Seleccioná el provider y modelo para agent.sdd-review.model"))
    lines.push("")

    if (!modelConfig || modelConfig.loading) {
      lines.push(yellow("  Cargando modelos disponibles en OpenCode..."))
      return lines
    }

    if (state.message) {
      lines.push(yellow(`  ${state.message}`))
      lines.push("")
    }

    if (modelConfig.currentModel) {
      lines.push(gray(`  Modelo actual: ${modelConfig.currentModel}`))
      lines.push("")
    }

    if (modelConfig.providers.length === 0) {
      lines.push(red("  No se encontraron modelos disponibles en OpenCode."))
      lines.push(gray("  Ejecutá `opencode models` para verificar providers/modelos disponibles."))
      lines.push("")
      lines.push(gray("  Esc volver · h home"))
      return lines
    }

    const selectedProvider = modelConfig.providers.find(provider => provider.providerId === modelConfig.selectedProviderId)
    if (!selectedProvider) {
      lines.push(gray("  Providers:"))
      for (let i = 0; i < modelConfig.providers.length; i++) {
        const provider = modelConfig.providers[i]
        const cursor = state.cursor === i ? cyan(">") : " "
        const label = state.cursor === i ? bold(provider.providerName) : provider.providerName
        lines.push(`  ${cursor} ${label}${gray(`  ${provider.models.length} modelo${provider.models.length === 1 ? "" : "s"}`)}`)
      }
    } else {
      lines.push(gray(`  ${selectedProvider.providerName} models:`))
      if (selectedProvider.models.length === 0) {
        lines.push(yellow("  Este provider no declara modelos en opencode.json."))
      }
      for (let i = 0; i < selectedProvider.models.length; i++) {
        const model = selectedProvider.models[i]
        const cursor = state.cursor === i ? cyan(">") : " "
        const selected = model.modelRef === modelConfig.currentModel ? ` ${green("[selected]")}` : ""
        const label = state.cursor === i ? bold(model.modelName) : model.modelName
        lines.push(`  ${cursor} ${label}${selected}${gray(`  ${model.modelRef}`)}`)
      }
    }

    lines.push("")
    lines.push(gray("  ↑/↓ navegar · Enter seleccionar · Esc volver · h home"))
    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const modelConfig = state.modelConfig
    if (!modelConfig || modelConfig.loading) return { state, intent: { type: "none" } }

    const selectedProvider = modelConfig.providers.find(provider => provider.providerId === modelConfig.selectedProviderId)
    const itemCount = selectedProvider ? selectedProvider.models.length : modelConfig.providers.length

    switch (key.type) {
      case "up":
        return { state: { ...state, cursor: Math.max(0, state.cursor - 1) }, intent: { type: "none" } }
      case "down":
        return { state: { ...state, cursor: Math.min(Math.max(0, itemCount - 1), state.cursor + 1) }, intent: { type: "none" } }
      case "back":
        if (selectedProvider) {
          return { state: { ...state, cursor: 0, modelConfig: { ...modelConfig, selectedProviderId: undefined } }, intent: { type: "none" } }
        }
        return { state, intent: { type: "back" } }
      case "enter":
        if (!selectedProvider) {
          const provider = modelConfig.providers[state.cursor]
          if (!provider) return { state, intent: { type: "none" } }
          return { state: { ...state, cursor: 0, modelConfig: { ...modelConfig, selectedProviderId: provider.providerId } }, intent: { type: "none" } }
        }
        {
          const model = selectedProvider.models[state.cursor]
          if (!model) return { state, intent: { type: "none" } }
          return { state, intent: { type: "configure-sdd-review-model", modelRef: model.modelRef } }
        }
      default:
        return { state, intent: { type: "none" } }
    }
  },
}
