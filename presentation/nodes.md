# Motivation:
ReTI language commonly used in Lehrbetrieb
## Emulator:
When learning a language trying something out can be very important so to learn reti writing programms in assembly can help improve the understanding of low level languages
## Debugger:
When writing a program sometimes things don't work out as planned and it can be helpful to retrace steps or to play around and confirm or disprove hypthosis on how the language works
## Quiz:
Doing the work of a machine is a good way to learn how it is working. This type of understanding can be important when working with it and to grasp what actually goes on under the hood. The quiz is a playful way to demonstrate the process of translating assembly into machine code
Language Server:
Quality of Life, better focus, easier to program with it: See Paper: The impact of syntax colouring on program comprehension

All of those are already provided by Armin Biere at [insert Github Link] except the Debugger. However to improve accesibility and likeliness of students to use the tools an implementation into VSCode was chosen.
## Why vscode?: VS Code is by far most used IDE: https://survey.stackoverflow.co/2024/technology#most-popular-technologies-new-collab-tools

# Introduction
## ReTI Architecture
## ReTI Language
## VS Code Extension development process

# Results:
## Quiz:
## Language Server:
## Assembler:
## Disassembler:
## Emulator:
## Debugger:

# Implementation
## Tools used:
Javascript/Typescript Node.JS
HTML, CSS for website
## QUIZ:
Written as a website, loaded in as a string where imports are replaced by the needed functions into a webview
## Language Server:
Just a bunch of RegEx actually
## Emulator
### ReTI
## Debugger:
Create Factory
<-- Sends Events, Responses
--> Receives Requests
DebugAdapter
<-- Sends Events
--> Relays Commands to RunTime
Create RunTime as a wrapper for the emulator with extra Debug features that would not be part of the normal ReTI, ie Breakpoints or callstacks
--> Executes steps on Emulator
<-- Returns Data

# Future Work:
- Add Datapaths to Emulator
- Improve/Add Memoryview and Editing (since there is no built in memory view in vscode)
- Timetravel Debugging

