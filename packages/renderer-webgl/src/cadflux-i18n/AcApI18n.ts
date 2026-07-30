// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export type AcApLocale = 'en' | 'zh' | 'tr' | 'cs'

export interface AcApLocaleMessage {
  [key: string]: string | AcApLocaleMessage
}

export type AcApLocaleMessages = Record<AcApLocale, AcApLocaleMessage>

export interface AcApTranslateOptions {
  fallback?: string
}

export interface AcApLocaleChangedEventArgs {
  old: AcApLocale
  new: AcApLocale
}

class SimpleEvent<T> {
  private readonly listeners = new Set<(args: T) => void>()

  addEventListener(listener: (args: T) => void) {
    this.listeners.add(listener)
  }

  removeEventListener(listener: (args: T) => void) {
    this.listeners.delete(listener)
  }

  dispatch(args: T) {
    for (const listener of this.listeners) {
      listener(args)
    }
  }
}

export class AcApI18n {
  private static _messages: AcApLocaleMessages = {
    en: {},
    zh: {},
    tr: {},
    cs: {}
  }

  private static _currentLocale: AcApLocale = 'en'

  public static get messages(): Readonly<AcApLocaleMessages> {
    return this._messages
  }

  public static readonly events = {
    localeChanged: new SimpleEvent<AcApLocaleChangedEventArgs>()
  }

  public static getLocaleMessage(
    locale: AcApLocale
  ): Readonly<AcApLocaleMessage> {
    return this._messages[locale]
  }

  public static mergeLocaleMessage(
    locale: AcApLocale,
    messages: AcApLocaleMessage
  ): void {
    deepMerge(this._messages[locale], messages)
  }

  public static registerMessage(
    locale: AcApLocale,
    messages: AcApLocaleMessage
  ): void {
    this.mergeLocaleMessage(locale, messages)
  }

  public static setCurrentLocale(locale: AcApLocale): void {
    const old = this._currentLocale
    this._currentLocale = locale === 'en' ? 'en' : 'en'
    this.events.localeChanged.dispatch({ old, new: this._currentLocale })
  }

  public static get currentLocale(): AcApLocale {
    return this._currentLocale
  }

  public static t(key: string, options?: AcApTranslateOptions): string {
    const parts = key.split('.')
    let cur: string | AcApLocaleMessage | undefined = this._messages.en

    for (const part of parts) {
      if (!cur || typeof cur !== 'object') {
        return options?.fallback ?? key
      }
      cur = cur[part]
    }

    return typeof cur === 'string' ? cur : (options?.fallback ?? key)
  }

  public static cmdKey(groupName: string, cmdName: string, key: string): string {
    return `command.${groupName}.${cmdName.toLowerCase()}.${key}`
  }

  public static cmd(groupName: string, cmdName: string, key: string): string {
    return this.t(this.cmdKey(groupName, cmdName, key))
  }

  public static cmdDescription(groupName: string, cmdName: string) {
    return this.cmd(groupName, cmdName, 'description')
  }

  public static cmdPrompt(groupName: string, cmdName: string) {
    return this.cmd(groupName, cmdName, 'prompt')
  }

  public static sysCmd(cmdName: string, key: string): string {
    return this.cmd('ACAD', cmdName, key)
  }

  public static sysCmdKey(cmdName: string, key: string): string {
    return this.cmdKey('ACAD', cmdName, key)
  }

  public static userCmd(cmdName: string, key: string): string {
    return this.cmd('USER', cmdName, key)
  }

  public static userCmdKey(cmdName: string, key: string): string {
    return this.cmdKey('USER', cmdName, key)
  }

  public static sysCmdDescription(name: string) {
    return this.cmdDescription('ACAD', name)
  }

  public static userCmdDescription(name: string) {
    return this.cmdDescription('USER', name)
  }

  public static sysCmdPrompt(name: string) {
    return this.cmdPrompt('ACAD', name)
  }

  public static userCmdPrompt(name: string) {
    return this.cmdPrompt('USER', name)
  }
}

function deepMerge(target: AcApLocaleMessage, source: AcApLocaleMessage) {
  for (const key of Object.keys(source)) {
    const src = source[key]
    const tgt = target[key]

    if (isObject(tgt) && isObject(src)) {
      deepMerge(tgt, src)
    } else {
      target[key] = src
    }
  }
}

function isObject(value: unknown): value is AcApLocaleMessage {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
