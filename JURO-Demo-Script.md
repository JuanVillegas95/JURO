# JURO — Demo Script & Video Outline

**Target length:** 8–12 minutes  
**Format:** Screen recording with voiceover, or live demo  
**Audience:** Technical team / engineers

---

## Before You Start

Make sure the following are ready:

- JURO is running (`npm run dev` from the repository root)
- Claude is connected through the local MCP server
- A few problems already exist in the SQLite-backed problem catalog
- VS Code is installed with the `code` command on PATH
- Java 17+ is installed

---

## Part 1 — Introduction (≈1 min)

**[Screen: JURO main window — Problem Bank view]**

> "This is JURO — a local desktop app for deliberate Java coding practice. 
> The idea is simple: instead of grinding LeetCode in a browser editor you'll never use at work, 
> JURO lets you practice in your real editor — VS Code, Neovim, whatever you use — 
> while it handles the study system, test running, and AI-graded knowledge checks."

> "JURO grades two things separately: whether your code actually passes the tests, 
> and whether you can explain what you did. Today I'll walk through the full loop."

---

## Part 2 — Settings: Connecting Claude (≈1 min)

**[Action: Click Settings icon → MCP configuration panel]**

> "First, let's look at the MCP configuration."

> "JURO shows a local MCP configuration. I copy it into Claude's MCP settings. JURO does not store provider URLs or API keys."

**[Action: Copy the MCP configuration and show Claude connected]**

---

## Part 3 — Managing Problems with MCP (≈2 min)

**[Action: Show the local MCP client configuration or terminal]**

> "Problem administration is intentionally separate from the learner application. A local MCP server exposes validated tools for the SQLite-backed catalog."

> "The MCP server can list, inspect, create, update, and delete problems, but it does not expose arbitrary SQL or application credentials."

**[Action: Invoke list_problems and get_problem through the MCP client]**

> "The tool schema requires a complete Java problem, examples, runnable test cases, starter code, a reference solution, and a knowledge rubric."

**[Action: Show or narrate a validated create_problem or update_problem MCP call]**

> "The MCP server commits the complete change transactionally in SQLite, and JURO immediately reads the updated catalog."

**[Result: The updated problem appears in the Problem Bank list]**

---

## Part 4 — Solving a Problem (≈3 min)

**[Action: Click on a problem in the Problem Bank — e.g., "Two Sum" or "Reverse Linked List"]**

> "Let me pick a problem. I can see the description, constraints, examples, and test cases."

**[Action: Click "Open in Editor" or "Generate Scaffold"]**

> "When I click Open, JURO generates a Java scaffold — a Maven project with a `Solution.java` 
> stub and all the test cases already wired up — and opens it in VS Code."

**[Screen switches to VS Code — show Solution.java with the empty stub]**

> "Here's my workspace. There's the method signature, the test file, and nothing else. 
> I write my solution here, in my editor, with my keyboard shortcuts and my config."

**[Action: Type a solution — keep it simple for demo, e.g., a HashMap lookup for Two Sum]**

```java
public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> map = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int complement = target - nums[i];
        if (map.containsKey(complement)) {
            return new int[]{map.get(complement), i};
        }
        map.put(nums[i], i);
    }
    return new int[]{};
}
```

**[Action: Switch back to JURO — click "Run Tests"]**

> "Back in JURO, I hit Run Tests. JURO compiles the project and runs the JUnit suite 
> against my solution — all locally, no internet required."

**[Result: Test results appear — all green]**

> "All tests pass. JURO records the coding result. Now for the second half."

---

## Part 5 — Knowledge Check: AI-Graded Explanation (≈2 min)

**[Action: Click "Explain"]**

> "This is where JURO is different from everything else. 
> Now I have to explain my solution — like I would in a real interview."

> "JURO opens Claude and starts a guided knowledge check. Claude will ask me to explain the problem and then rate my understanding."

**[Action: Start Claude's voice conversation and answer — something like:]**

> *(Spoken for demo, JURO transcribes)*  
> "I used a hash map to store each number and its index as I iterate through the array. 
> For each number, I calculate the complement — target minus current — 
> and check if it's already in the map. If yes, I return both indices. 
> Time complexity is O(n), space complexity is O(n) for the hash map."

**[Action: Claude calls the JURO MCP knowledge-check tools]**

> "Claude reads the problem and rubric through MCP, asks follow-up questions, and submits a structured assessment."

**[Result: Feedback appears — scores or notes on what was covered / missed]**

> "The LLM returns structured feedback. In this case it confirms I covered the key points: 
> hash map lookup, the complement calculation, and the time-space tradeoff. 
> I mark the explanation as passed."

---

## Part 6 — Review Scheduling (≈1 min)

**[Action: Click "Mark as Passed" for both coding and explanation → see next review date]**

> "JURO now records both reviews and schedules the next session using spaced repetition — 
> the SM-2 algorithm. This problem will surface again when I'm most likely to have 
> forgotten it just enough that reviewing it strengthens the memory."

> "Coding review and explanation review are tracked separately. 
> I might nail the code but bomb the explanation — or the opposite. 
> Both get their own schedule."

**[Show the problem card with upcoming review dates for both tracks]**

---

## Part 7 — Wrap Up (≈30 sec)

**[Screen: Problem Bank showing multiple problems with review states]**

> "That's the full JURO loop: the LLM builds your problem bank, 
> you solve in your real editor, JURO runs the tests, grades your explanation, 
> and schedules the next review. Everything is local — no cloud, no browser IDE, 
> no dependency on any platform staying online."

> "The codebase is TypeScript throughout the application layer: Fastify on the server, React and Tailwind on the frontend, with SQLite for local persistence. Java remains the local exercise toolchain. Happy to go deeper on any part."

---

## Optional Demo Extras (if time allows)

| Topic | What to show |
|---|---|
| Problem MCP administration | List or inspect a problem through the local MCP server |
| Knowledge coaching | Use Claude's text or voice interface through MCP |
| Viewing a reference solution | Show the `referenceSolution` field on a problem |
| Test failure state | Submit a wrong solution and show the JUnit output |

---

## Recording Tips

- Keep VS Code and JURO side by side if your screen is wide enough
- Pause briefly after each major result appears (test pass, AI feedback) — let it land
- Don't rush the explanation recording step — it's the most novel part
- If demoing live, have a fallback: a pre-recorded GIF or screenshot of AI feedback in case the LLM is slow
