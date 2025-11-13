Monitor and display current context window usage for the Firefly project. This command provides real-time context awareness to help with Context Continuity Protocol timing.

**CONTEXT MONITORING CAPABILITIES:**

## 1. **Manual Context Check**
Use this command anytime during development to:
- Check current context usage percentage
- Estimate remaining context capacity
- Plan when to execute context-end documentation
- Monitor approaching context boundaries

## 2. **Pre-Compaction Warning**
When context usage approaches critical levels:
- Display visual warnings about impending compaction
- Remind about Context End Protocol requirements
- Suggest immediate execution of /context-end-update
- Provide guidance on documentation priorities

## 3. **Session Progress Tracking**
Track development progress within current context window:
- List major accomplishments in current session
- Identify undocumented changes requiring attention
- Highlight new features or fixes since session start
- Monitor TODO items completed vs. added

## 4. **Documentation Readiness Assessment**
Evaluate readiness for context end protocol:
- Check if significant changes need documentation
- Verify recent work is captured in notes
- Assess completeness of current session summary
- Recommend documentation priority order

## 5. **Integration with Status Line**
Provides data for status line context monitoring:
- Current context usage percentage
- Estimated tokens remaining
- Session duration and productivity metrics
- Alert indicators for documentation needs

**USAGE EXAMPLES:**
- `/context-monitor` - Quick context usage check
- Use when planning large code changes
- Execute before major refactoring sessions
- Monitor during extended development sessions

**AUTOMATION NOTE:** This command can be called automatically via hooks or integrated into status line for continuous monitoring. Combine with PreCompact and SessionEnd hooks for complete context management automation.