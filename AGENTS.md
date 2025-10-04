# Agent Instructions for Improving the Gemini Activity Processor

---
## **CRITICAL WARNING: ENVIRONMENT INSTABILITY**

**Do not use `npm`, `npx`, `vite`, or any other Node.js-based build tools in this repository.**

The execution environment has a persistent and severe instability that causes any `npm` command to fail with a `uv_cwd` error. All attempts to set up a standard React/Vite project have failed.

**The ONLY reliable method for development in this repository is the dependency-free, single-file approach.**

All application code, styles, and HTML must be contained within a single `index.html` file. This is the required strategy to ensure a functional outcome. Do not deviate from this unless the underlying environment issues are confirmed to be resolved.
---

## 1. Mission Objective

Your primary objective is to transform this repository from a collection of raw code files into a feature-complete, well-polished, and thoroughly tested prototype of a Gemini Activity Analysis Tool.

The current state is a set of `.txt` files containing different versions of a React component. The end state should be a structured, maintainable, and robust web application.

## 2. Core Mandate: Deliberative Planning

To ensure the highest quality outcome, you **must** follow a deliberative process before beginning implementation. Do not start coding immediately.

1.  **Analyze and Understand:** Carefully read all the `.txt` files in the repository. Understand the features, differences, and evolution across the files (`MyActivityAnalysisTool.txt`, `MyActivityReductionTool.txt`, `MyActivityReductionTool1.txt`).

2.  **Deliberate in Chat:** Before settling on a single path forward, you must engage in a public deliberation in the chat for the user to see. You will articulate the perspective of a primary agent proposing a solution and a "critic" who challenges it. This deliberation must explore the trade-offs of at least two distinct approaches for improving the codebase (e.g., speed of delivery vs. code quality, technical debt, feature completeness). The user cannot see your internal thoughts, so this deliberation must happen in the chat.

3.  **Propose Two Plans to the User:** Based on your public deliberation, you must formulate and present at least two concrete, actionable plans to the user. These plans should be detailed enough for the user to make an informed decision.

## 3. Guiding Principles for Plan Creation

Your proposed plans must address the following key areas of improvement:

*   **Project Initialization:** The repository needs a proper project structure. This includes setting up a build tool (like Vite or Create React App), creating a `package.json` file with necessary dependencies (React, etc.), and organizing code into a `src` directory.
*   **Feature Unification & Refactoring:** The code in the `.txt` files should be unified into a single, cohesive application. The current monolithic component structure must be refactored into smaller, manageable, and reusable components. State management should be centralized and cleaned up.
*   **Robust Testing:** Each plan must include a comprehensive testing strategy. This is not optional. You are expected to write unit tests for components and logic (using Jest, Vitest, and React Testing Library) and consider setting up end-to-end tests (using Playwright or Cypress).
*   **Prototype-Driven Development:** The goal of executing a plan is to produce a **finished prototype**. This means at the completion of the work, the application must be fully functional, polished, and tested according to the plan's specification. Do not leave the project in a broken, incomplete, or untested state.

## 4. Example Plans

To guide your thinking, here are two examples of the kind of plans you might propose to the user.

---

### **Plan A: The Incremental Refactor & Polish**

This plan prioritizes speed and delivering a functional, structured prototype quickly by building upon the most advanced existing version.

1.  **Project Setup:** Initialize a new React project using Vite. Create a `package.json` and install dependencies.
2.  **Initial Integration:** Move the code from `MyActivityReductionTool1.txt` into a main `App.jsx` component within the new `src` directory.
3.  **Componentization:** Break down the main `App.jsx` into at least 3-4 key child components (e.g., `FileUpload`, `InteractionList`, `InteractionDetail`, `FilterControls`).
4.  **Core Testing:** Write unit tests for the critical helper functions (`parseGeminiActivityHTML`, `detectStructures`) and one major component (`InteractionList`) to establish a testing foundation.
5.  **Build & Verify:** Ensure the application builds and runs correctly.

**Outcome:** A working, organized application with a solid foundation and initial test coverage, achieved relatively quickly.

---

### **Plan B: The Ground-Up Re-architecture**

This plan prioritizes long-term maintainability, code quality, and testability through a more fundamental refactor.

1.  **Project Setup:** Initialize a new React project using Vite and configure it for TypeScript for improved type safety.
2.  **Architectural Design:** Design a new component hierarchy from scratch, identifying all UI elements and state management needs. Utilize React Context or a state management library (like Zustand) for handling application state instead of prop-drilling.
3.  **Feature-Driven Implementation:** Re-implement features from all three `.txt` files one by one, writing them in TypeScript and creating clean, single-responsibility components.
4.  **Test-Driven Development (TDD):** For each major feature (e.g., parsing, filtering, semantic encoding), write unit tests *before* implementation to ensure correctness from the start. Aim for high test coverage (>80%) on all new logic.
5.  **End-to-End Verification:** Write a simple end-to-end test that simulates a user uploading a file and seeing the results, verifying the full workflow.

**Outcome:** A highly robust, maintainable, and well-tested application with a modern architecture, at the cost of more upfront development time.

---