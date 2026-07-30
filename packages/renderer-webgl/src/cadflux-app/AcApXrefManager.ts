// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export class AcApXrefManager {
  private static _instance?: AcApXrefManager

  static get instance() {
    if (!this._instance) {
      this._instance = new AcApXrefManager()
    }
    return this._instance
  }

  clearAll(): void {}

  async load(): Promise<undefined> {
    return undefined
  }

  setVisible(): boolean {
    return false
  }

  unload(): boolean {
    return false
  }
}
