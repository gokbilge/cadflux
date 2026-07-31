// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

declare module 'better-sqlite3' {
  interface RunResult {
    changes: number
  }

  interface Statement<Result = unknown> {
    run(...parameters: unknown[]): RunResult
    get(...parameters: unknown[]): Result
    all(...parameters: unknown[]): Result[]
  }

  interface Transaction {
    (): void
  }

  interface DatabaseInstance {
    pragma(command: string): unknown
    prepare<Result = unknown>(sql: string): Statement<Result>
    exec(sql: string): void
    transaction(callback: () => void): Transaction
    close(): void
  }

  interface DatabaseConstructor {
    new (filename: string): DatabaseInstance
  }

  const Database: DatabaseConstructor
  namespace Database {
    export type Database = DatabaseInstance
  }

  export default Database
}
