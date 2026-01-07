#!/usr/bin/env python3
"""
Sub-agent lifecycle logger for Claude Code.
Logs when sub-agents (Task tool) are launched and when they complete.
"""
import json
import sys
from datetime import datetime

# ANSI colors for terminal output
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"

LOG_FILE = "/tmp/subagent-log.txt"

def log(message, color=RESET):
    """Print timestamped log message to stderr AND file for persistence."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    formatted = f"[{timestamp}] {message}"
    # Print to stderr (may get overwritten by UI)
    print(f"{color}{formatted}{RESET}", file=sys.stderr)
    # Also append to file for reliable logging
    with open(LOG_FILE, "a") as f:
        f.write(formatted.replace(BOLD, "").replace(RESET, "") + "\n")

try:
    input_data = json.load(sys.stdin)
    hook_event = input_data.get("hook_event_name", "Unknown")

    if hook_event == "PreToolUse":
        tool_name = input_data.get("tool_name", "Unknown")
        if tool_name == "Task":
            tool_input = input_data.get("tool_input", {})
            description = tool_input.get("description", "no description")
            subagent_type = tool_input.get("subagent_type", "general-purpose")
            run_in_background = tool_input.get("run_in_background", False)

            bg_indicator = " (background)" if run_in_background else ""
            log(f"{BOLD}SUBAGENT LAUNCH{RESET}{CYAN} [{subagent_type}]{bg_indicator}: {description}", CYAN)

    elif hook_event == "SubagentStop":
        transcript_path = input_data.get("transcript_path", "")
        log(f"{BOLD}SUBAGENT COMPLETE{RESET}{GREEN}: Agent finished execution", GREEN)

except json.JSONDecodeError:
    log("Hook received invalid JSON input", YELLOW)
except Exception as e:
    log(f"Hook error: {str(e)}", YELLOW)

# Always exit 0 to not block Claude's execution
sys.exit(0)
