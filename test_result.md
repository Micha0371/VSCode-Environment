#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.1"
##   test_sequence: 0
##   run_ui: true
##
## test_plan:
##   current_focus:
    - "Completed: 32 local checks, TypeScript, SDK compatibility, 13 hosted groups and 22 Android groups"
    - "Commit and push validated baseline"
    - "Upgrade legacy Expo SDK tooling before production release"
  test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "Fix adversarial review findings and implement Slice 1.1 strict duplicate prevention."
backend:
  - task: "Database hardening and strict household-scoped item-name uniqueness"
    implemented: true
    working: true
    file: "pantry-flow/supabase/migrations/00002_review_hardening.sql; pantry-flow/supabase/migrations/00003_strict_duplicate_prevention.sql"
    needs_retesting: false
    status_history:
      - agent: "main"
        comment: "2026-11-08: PostgreSQL/PGlite tests pass for grants, RLS, input validation, attribution, account deletion, duplicate creates/renames, overlapping calls and legacy-conflict rollback. Hosted migrations have NOT been applied."
frontend:
  - task: "Shared pantry state, auth recovery, mutation lifecycle and translated duplicate errors"
    implemented: true
    working: true
    needs_retesting: false
    status_history:
      - agent: "main"
        comment: "2026-11-08: 26 regression checks pass with real React hooks/context and mocked native/network boundaries; TypeScript passes; Android export succeeds. Device and hosted-project checks remain pending."
metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false
test_plan:
  current_focus:
    - "Verify hosted migrations 00002 and 00003, reported applied by the user on 2026-11-08"
    - "Run device and hosted-database smoke tests"
    - "Upgrade legacy Expo SDK tooling before release"
  test_all: false

agent_communication:
  - agent: "user"
    message: "2026-11-08: Confirms database migrations 00002 and 00003 are applied. Hosted authorization and Android verification are still pending; prior unapplied-migration notes are historical."

  - agent: "main"
    message: "2026-11-08 final: Earlier pending notes are superseded. Deployed authorization/duplicates: 13 groups pass, zero cleanup failures. Local regressions: 32 pass; TypeScript and SDK compatibility pass. Android: 22 groups pass, including two device-discovered fixes. Temporary mocks cleared, phone signed out, test inventory removed. Three disposable accounts remain. Confirmation-required UI was simulated; real email delivery untested. See docs/H_Slice_1_1_Verification.md."
