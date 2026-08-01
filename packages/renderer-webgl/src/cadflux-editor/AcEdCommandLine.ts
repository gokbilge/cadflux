// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import {
  type AcEdPromptKeywordOptionsSingle as AcEdPromptKeywordOptions,
  AcEdKeywordSession,
  type AcEdCommandLineSessionControl,
  type AcEdPromptInputMode,
  type AcEdPromptInputResult,
  AcEdPromptInputSession
  ,
  type AcEdMessageType
} from '../mlightcad-bridge/editor'

export class AcEdCommandLine {
  private readonly container: HTMLElement
  private readonly root: HTMLDivElement
  private readonly promptEl: HTMLDivElement
  private readonly messagesEl: HTMLDivElement
  private readonly inputEl: HTMLInputElement
  private activeSession?: AcEdCommandLineSessionControl
  private isPromptActive = false

  constructor(container: HTMLElement = document.body) {
    this.container = container
    this.root = document.createElement('div')
    this.promptEl = document.createElement('div')
    this.messagesEl = document.createElement('div')
    this.inputEl = document.createElement('input')

    this.injectCss()
    this.root.className = 'cadflux-cli'
    this.promptEl.className = 'cadflux-cli__prompt'
    this.messagesEl.className = 'cadflux-cli__messages'
    this.inputEl.className = 'cadflux-cli__input ml-cli-text'
    this.inputEl.type = 'text'
    this.inputEl.placeholder = 'Type a value'

    this.root.append(this.messagesEl, this.promptEl, this.inputEl)
    this.container.appendChild(this.root)
    this.bindEvents()
  }

  get visible(): boolean {
    return this.root.style.display !== 'none'
  }

  set visible(value: boolean) {
    this.root.style.display = value ? 'flex' : 'none'
  }

  setPrompt(message?: string) {
    this.isPromptActive = true
    const promptCore = message?.trim().replace(/[：:]\s*$/, '') ?? ''
    this.promptEl.textContent = promptCore ? `${promptCore}: ` : ''
    this.inputEl.placeholder = ''
  }

  clear() {
    this.clearPrompt()
    this.clearInput()
  }

  clearPrompt() {
    this.promptEl.replaceChildren()
    this.isPromptActive = false
  }

  clearInput() {
    this.inputEl.value = ''
    this.inputEl.placeholder = this.isPromptActive ? '' : 'Type a value'
  }

  focusInput() {
    this.inputEl.focus()
  }

  setInputReadOnly(readOnly: boolean) {
    this.inputEl.readOnly = readOnly
  }

  showMessage(message: string, type: AcEdMessageType = 'info') {
    if (!message) return
    const line = document.createElement('div')
    line.className = `cadflux-cli__message cadflux-cli__message--${type}`
    line.textContent = message
    this.messagesEl.appendChild(line)
    while (this.messagesEl.childElementCount > 8) {
      this.messagesEl.firstElementChild?.remove()
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  cancelActiveSession() {
    if (!this.activeSession) return
    this.activeSession.handleEscape()
    this.activeSession = undefined
  }

  async getKeywords(
    options: AcEdPromptKeywordOptions,
    allowTyping: boolean = true
  ): Promise<string> {
    const session = new AcEdKeywordSession(this as never, options, allowTyping)
    this.activeSession = session
    try {
      return await session.start()
    } finally {
      this.activeSession = undefined
    }
  }

  async getPromptInput<T>(
    options: AcEdPromptKeywordOptions,
    parseValue: (text: string) => T | null,
    config: {
      mode: AcEdPromptInputMode
      allowNone: boolean
      allowTyping?: boolean
    }
  ): Promise<AcEdPromptInputResult<T>> {
    const session = new AcEdPromptInputSession(
      this as never,
      options,
      parseValue,
      config.mode,
      config.allowNone,
      config.allowTyping ?? true
    )
    this.activeSession = session
    try {
      return await session.start()
    } finally {
      this.activeSession = undefined
    }
  }

  renderKeywordPrompt(
    options: AcEdPromptKeywordOptions,
    onClick: (kw: string) => void
  ) {
    this.promptEl.replaceChildren()
    this.isPromptActive = true
    this.inputEl.placeholder = ''

    const promptCore = options.message?.trim().replace(/[：:]\s*$/, '') ?? ''
    if (promptCore) {
      this.promptEl.append(`${promptCore} `)
    }

    const keywords = options.keywords?.toArray().filter(k => k.visible) ?? []
    if (keywords.length) {
      this.promptEl.append('[')
      keywords.forEach((kw, index) => {
        if (index > 0) this.promptEl.append('/')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'cadflux-cli__keyword'
        button.textContent = kw.displayName
        button.disabled = !kw.enabled
        button.addEventListener('click', () => onClick(kw.globalName))
        this.promptEl.appendChild(button)
      })
      this.promptEl.append(']')
    }

    const defaultText =
      options.getKeywordPromptFormat().defaultKeyword ??
      options.valueDefaultDisplayText
    if (defaultText) {
      this.promptEl.append(` <${defaultText}>`)
    }

    this.promptEl.append(': ')
  }

  private bindEvents() {
    this.inputEl.addEventListener('keydown', event => {
      if (!this.activeSession) return

      if (event.key === 'Escape') {
        event.preventDefault()
        this.cancelActiveSession()
        return
      }

      if (event.key !== 'Enter') return

      event.preventDefault()
      const accepted = this.activeSession.handleEnter(this.inputEl.value)
      if (!accepted) {
        this.showMessage('Invalid input.', 'warning')
        return
      }
      this.inputEl.value = ''
    })
  }

  private injectCss() {
    if (document.getElementById('cadflux-cli-style')) return

    const style = document.createElement('style')
    style.id = 'cadflux-cli-style'
    style.textContent = `
      .cadflux-cli {
        position: absolute;
        left: 16px;
        right: 16px;
        bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 30;
        pointer-events: none;
      }
      .cadflux-cli__messages,
      .cadflux-cli__prompt,
      .cadflux-cli__input {
        pointer-events: auto;
      }
      .cadflux-cli__messages,
      .cadflux-cli__prompt {
        max-width: min(960px, 100%);
        padding: 8px 12px;
        border-radius: 8px;
        background: rgba(13, 17, 23, 0.9);
        color: #f5f7fa;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      }
      .cadflux-cli__messages {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 160px;
        overflow: auto;
      }
      .cadflux-cli__message--warning {
        color: #ffcc66;
      }
      .cadflux-cli__message--error {
        color: #ff7b72;
      }
      .cadflux-cli__input {
        max-width: min(720px, 100%);
        border: 1px solid rgba(240, 246, 252, 0.2);
        border-radius: 8px;
        padding: 10px 12px;
        background: rgba(13, 17, 23, 0.94);
        color: #f5f7fa;
        font: 13px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
        outline: none;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      }
      .cadflux-cli__input::placeholder {
        color: rgba(245, 247, 250, 0.55);
      }
      .cadflux-cli__keyword {
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: #79c0ff;
        cursor: pointer;
        font: inherit;
      }
      .cadflux-cli__keyword:disabled {
        color: rgba(245, 247, 250, 0.45);
        cursor: default;
      }
    `
    document.head.appendChild(style)
  }
}
