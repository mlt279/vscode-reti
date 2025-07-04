# Language Server
This extension incorporates a language server that provides several functionalities for the reti language.
## Syntax Highlighting
The extension provides syntax highlighting differentiating colors for instructions, registers, numbers and comments depending on the chosen color theme.

![Example for syntax highlighting](img/language_server/syntax_highlighting_example.png)

## Errors and warnings
When editing a reti file the extension provides diagnostics in form or errors and warnings.
Warnings are shown in yellow...
![Warnings](https://github.com/user-attachments/assets/e257cdfe-65f6-49e3-a161-bd1b43b79552)

... and errors in red.
![grafik](https://github.com/user-attachments/assets/382247cf-e285-472b-a474-41fb6dcc5b5e)

Errors highlight mistakes that will cause the code to be unable to compile and warnings highlight code that might lead to unexpected behaviours.
## Tooltips
When hovering over valid instructions or registers the language server provides tooltips that can be shown by the IDE. 
![grafik](https://github.com/user-attachments/assets/99053396-9415-41ab-8dce-9e699c8a817c)

These tooltips will explain the instruction and it's effect and also give usage advice.
# Emulator
When a valid .reti or .retias file is open the emulator can be called by either pressing the key combination **ctrl+alt+e** or by clicking the arrow besides the debug symbol in the editors menu bar and selecting "Emulate".

![grafik](https://github.com/user-attachments/assets/7a76d443-2151-4a75-8797-644b5879250d)


When the emulation is running it can be stopped by clicking the according button in the editor menu bar.

![grafik](https://github.com/user-attachments/assets/2d125a98-8530-49df-bd86-8d69e3a8ee42)

# Disassembler
When a .reti file is opened the disassembler can be called by its keybinding **ctrl+alt+a** or by clicking the related symbol in the editor menu bar.
The keybinding for assembler and disassembler is the same and the difference depends on the opened file type.

![grafik](https://github.com/user-attachments/assets/421d4058-6e89-4250-95dc-3c220fe132e4)

The output of the disassembler is a formatted temporary file with the hexadecimal values relating to the instructions. The original instruction is written as a comment besides the hexvalue.

![grafik](https://github.com/user-attachments/assets/3f841ad0-99bd-4568-8b4c-6425071d3940)

# Assembler
When a .retias file is opened the assembler can be called by its keybinding **ctrl+alt+a** or by clicking the related symbol in the editor menu bar.
The keybinding for assembler and disassembler is the same and the difference depends on the opened file type.

![grafik](https://github.com/user-attachments/assets/2b31d184-25e4-469b-8051-bf7da65d1178)

The assembler will output the reti code in a formatted temporary file. For each line the original hex value is written as a comment at the end of the line.

![grafik](https://github.com/user-attachments/assets/43d812dd-22e8-4043-8048-11bd9dc63407)

# ReTI-Quiz
The quiz can be called by pressing **ctrl+shift+p** and entering the command "Start ReTI Quiz" or by searching for the command and selecting it.

![grafik](https://github.com/user-attachments/assets/93d9b7e0-b981-4be3-86b8-354e31da0747)

![grafik](https://github.com/user-attachments/assets/31454653-2c3b-4e30-8fdb-fbf4ea18b5f8)

The quiz provides a reload button to restart the quiz and to dropdown menus to determine the number of questions in the quiz as well as the size of the immediate value that will be generated for the random instructions. [1]

The quiz is structured as a "fill in the gap" quiz. To answer click on the missing part of the hexadecimal number and fill in the right character. [2] After filling in press the check button to evaluate the answer. The result will be shown in the column to the right of the gapped hex number. [3]
Clicking the check button also reveals the correct answer in form of a second table appearing below the first [4] that contains an explanation for each bit and corresponding hex character.

# Debugger
![grafik](https://github.com/user-attachments/assets/3404b087-05e2-44d4-9721-f1b5165f29d3)

The debugger can be called by pressing on the arrow besides the emulate button. By default the debugger will always pause before executing the first line.

## Breakpoints  
![grafik](https://github.com/user-attachments/assets/a7374e77-f02d-4206-8869-116efe6f942c)
The extension allows setting breakpoints, functioning like those in most standard debuggers. Execution will continue until a breakpoint is hit, at which point it will pause on that line. All execution controls, including *Continue*, *Step Out*, and *Step Over*, will stop at breakpoints.

![grafik](https://github.com/user-attachments/assets/ccda0533-21f7-40e2-97d0-a7bd939ea068)

## Continue  
Execution can be resumed by clicking the *Continue* button, as shown in the image. The program will then run until either the end or the next breakpoint is reached.

![grafik](https://github.com/user-attachments/assets/fea83aa2-0d6b-431f-9273-30197b415d03)

While running, the set of control buttons changes to include a *Pause* button, which can be used to halt execution at any time.

![grafik](https://github.com/user-attachments/assets/6e16185e-fa21-4ac0-93e6-a6b5e6b49c7e)

## Step Over  
If the program counter (PC) is at a jump instruction, *Step Over* will continue execution until the instruction at PC + 1 (the instruction immediately following the jump) is reached. Note that this behavior may vary depending on the program—execution may continue until the end if the target instruction is not reached.

![grafik](https://github.com/user-attachments/assets/cb6679b2-ed8e-4c85-bba2-2467ca5e69e4)


## Step In  
*Step In* executes the next instruction unconditionally. It acts as a simple single-step operation.

![grafik](https://github.com/user-attachments/assets/de3927f7-dcb5-413f-b3a1-b2acc6f4146e)

## Step Out  
When a jump is encountered at a given PC, a "callback" (i.e., the instruction at PC + 1) is saved. *Step Out* will then execute until this callback is reached. If no jump has occurred previously (and thus no callback is saved), *Step Out* will behave like *Continue*, running until the end of the program.

![grafik](https://github.com/user-attachments/assets/1d99811f-7651-448d-871f-c8781d03ef62)

## Read and Set Registers  
Registers are displayed like variables and can be edited directly in the same interface. Simply modify the value of any register as needed.

![grafik](https://github.com/user-attachments/assets/6f61905e-5494-485a-8009-508996fb403e)

![grafik](https://github.com/user-attachments/assets/e0c33b80-6cdf-43b3-b2ad-6e5ec4485f4b)

By pressing on the register you can edit the value stored in it to any decimal number.

## Watch Memory  
Memory can be monitored by adding the desired memory address to the watch list, similar to adding a variable. This allows you to track changes to specific memory cells during execution.

![grafik](https://github.com/user-attachments/assets/410ed760-44f3-43d1-a52e-609457d4e137)

Press add expression in the variables tab.

![grafik](https://github.com/user-attachments/assets/31d80416-0a92-4847-ab47-86f4a85ace8f)

On the left is the address as a decimal number and on the right the value stored in it.
