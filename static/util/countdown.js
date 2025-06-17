import * as vscode from 'vscode';
// Give message and duration of countdown in seconds..
// Counts down and prints following format each second: ${message} in ${i} seconds.
export async function countdown(message, duration) {
    if (duration < 0) {
        return;
    }
    ;
    for (let i = duration; i >= 0; i--) {
        vscode.window.showInformationMessage(`${message} in ${i} seconds.`);
        await waitForMS(1000);
    }
}
// Holds the program for the given number of miliseconds.
export function waitForMS(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=countdown.js.map