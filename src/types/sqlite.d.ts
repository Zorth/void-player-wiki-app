declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
      get(...params: any[]): any;
      all(...params: any[]): any[];
    };
    close(): void;
  }
}
