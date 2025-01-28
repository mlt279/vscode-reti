import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { randomInstruction } from '../util/randomReti';
import { decodeInstruction } from '../reti/disassembler';
import { binToHex, hexToBin } from '../util/retiUtility';

export function showQuizPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'retiQuiz',
        'RETI Quiz',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    let questionsAnswered = 0;
    let numQuestions = 10;
    let startTime: number | undefined;
    let timerInterval: NodeJS.Timeout | undefined;

    const importString = "const randomInstruction = ${randomInstruction};\n" +
    "const decodeInstruction = ${decodeInstruction};\n" +
    "const binToHex = ${binToHex};\n" +
    "const hexToBin = ${hexToBin};\n";

    const htmlFilePath = path.join(context.extensionPath, 'static', 'quizPanel.html');

    let html = '';
    try {
        html = fs.readFileSync(htmlFilePath).toString();
    }
    catch (err) {
        vscode.window.showErrorMessage("Failed to read HTML file.");
    }

    function replaceImports(content: string, newImports: string): string {
        // Regular expression to match content between /*/ -IMPORTS- /*/ and /*/ -END- /*/
        const regex = /(?<=\/\*\/IMPORTS\/\*\/).+?(?=\/\*\/END\/\*\/)/gs;
        
        // Replace the content between the markers with newImports
        return content.replace(regex, `/*/ -IMPORTS- /*/\n${newImports}\n/*/ -END- /*/`);
    }
    
    const modifiedHTML = replaceImports(html, importString);

    const generateQuizHTML = (): string => {
        return modifiedHTML;
        const rows = generateQuizRows(numQuestions);
        return `
    <html>
        <body>
            <h1>RETI Quiz</h1>
            <button onclick="reloadQuiz()">Reload Quiz</button>
            <div id="timer" style="margin-top: 10px;">Time: 00:00</div>
            <table border="1" style="width: 100%; text-align: center; margin-top: 20px;">
                <tr>
                    <th>Code</th>
                    <th>Hexadecimal</th>
                    <th>Input</th>
                    <th>Result</th>
                </tr>
                ${rows}
            </table>
            <div>
                <h3>Explanation:</h3>
                <div id="explanation"></div>
            </div>
            <div id="completionMessage"></div>
            <script>
                let questionsAnswered = 0;
                let correctAnswers = 0;
                let numQuestions = ${numQuestions};
                let startTime = ${startTime ?? 'null'};
                let finished = false;
                let timerInterval;
    
                function reloadQuiz() {
                    const vscode = acquireVsCodeApi();
                    vscode.postMessage({ command: 'reload' });
                }
    
                function updateTimer() {
                    if (!startTime || finished) return;
    
                    const currentTime = Date.now();
                    const elapsedTime = Math.floor((currentTime - startTime) / 1000);
                    const minutes = Math.floor(elapsedTime / 60);
                    const seconds = elapsedTime % 60;
    
                    document.getElementById('timer').innerText = 'Time: ' + 
                        String(minutes).padStart(2, '0') + ':' + 
                        String(seconds).padStart(2, '0');
                }
    
                function checkAnswer(rowIndex, correctValue, explanation) {                                           
                    const input = document.getElementById(\`input-\${rowIndex}\`);
                    const resultCell = document.getElementById(\`result-\${rowIndex}\`);
                    const explanationDiv = document.getElementById('explanation');
                    const checkButton = document.getElementById(\`check-button-\${rowIndex}\`);
                    
                    if (input.value.toLowerCase() === correctValue.toLowerCase()) {
                        resultCell.innerHTML = '<span style="color: green;">✔️</span>';
                        explanationDiv.innerText = 'Correct! ' + explanation;
                                    if (!input.disabled) {correctAnswers++;}
                        
                    } else {
                        resultCell.innerHTML = '<span style="color: red;">❌</span>';
                        explanationDiv.innerText = \`Incorrect. The correct value was: \${correctValue}. \n $\{explanation}\`;                    }
                    if (!input.disabled) 
                    {
                    questionsAnswered++;
                    input.disabled = true;
                    }
    
                    
                    
                    // Check if all answers are completed
                    if (questionsAnswered === numQuestions) {
                        finished = true;
                        const currentTime = Date.now();
                        const elapsedTime = Math.floor((currentTime - startTime) / 1000);
                        const minutes = Math.floor(elapsedTime / 60);
                        const seconds = elapsedTime % 60;
                        document.getElementById('completionMessage').innerText = 
                            \`You have completed the quiz. You got \${correctAnswers}\/\${numQuestions} correct in \${String(minutes).padStart(2, '0')}:\${String(seconds).padStart(2, '0')}\`;
                    }
                }
    
                // Start the timer when the page loads
                window.onload = function() {
                    if (!startTime) {
                        startTime = Date.now();
                        timerInterval = setInterval(updateTimer, 1000);
                    }
                };
            </script>
        </body>
    </html>
    `;
    };
    
    const generateQuizRows = (numOfRows: number): string => {
        let rowsHTML = '';
        for (let i = 0; i < numOfRows; i++) {
            const instruction = randomInstruction();
            const [code, ex] = decodeInstruction(instruction);
            const expl = ex.slice(0, -1).replace(/;/g, ", ") + ".";

            const codehex = binToHex(instruction).toUpperCase();
            // Using this out of lazinesss since it is already correctly formatted this way.
            const binaryString = hexToBin(codehex);
            const formattedBinary = binaryString.replace(/(.{4})/g, '$1_').slice(0, -1);
            const explanation = codehex.replace(/(.{1})/g, '$1_') + " = " + formattedBinary + "\\n" + expl.replace(/'/g, "\\'");
            const missingIndex = Math.floor(Math.random() * codehex.length);
            const hexWithGap = codehex.slice(0, missingIndex) + '_' + codehex.slice(missingIndex + 1);
    
            rowsHTML += `
                <tr>
                    <td>${code}</td>
                    <td>${hexWithGap}</td>
                    <td>
                        <input id="input-${i}" maxlength="1" style="width: 50px;" />
                        <button id="check-button-${i}" onclick="checkAnswer(${i}, '${codehex[missingIndex]}', '${explanation.replace(/'/g, "\\'")}')">Check</button>
                    </td>
                    <td id="result-${i}"></td>
                </tr>
            `;
        }
        return rowsHTML;
    };
    

    panel.webview.html = generateQuizHTML();

    panel.webview.onDidReceiveMessage(
        (message) => {
            if (message.command === 'reload') {
                panel.webview.html = generateQuizHTML();
                startTime = Date.now();
                if (timerInterval) {
                    clearInterval(timerInterval);
                }
                timerInterval = setInterval(() => {
                    panel.webview.postMessage({ command: 'updateTimer' });
                }, 1000);
            }
        },
        undefined,
        context.subscriptions
    );
}
