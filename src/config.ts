import * as vscode from 'vscode';

export class ReTIConfig {
  static get version(): string {
    return vscode.workspace
      .getConfiguration('reti')
      .get<string>('version', 'Basic ReTI (TI)');
  }

  static get isOS(): boolean {
    return this.version.includes('Extended');
  }

  static get isTI(): boolean {
    return this.version.includes('Basic');
  }

  static get radix(): number {
    const format = vscode.workspace
      .getConfiguration('reti')
      .get<string>('number_style', 'Decimal');
    switch (format) {
      case 'Binary': return 2;
      case 'Hexadecimal': return 16;
      default: return 10;
    }
  }

  static onDidChange(callback: () => void) {
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration('reti.version') ||
        event.affectsConfiguration('reti.number_style')
      ) {
        callback();
      }
    });
  }
}
