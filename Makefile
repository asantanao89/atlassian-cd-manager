SHELL := /bin/bash
.PHONY: help dev pi pi-install pi-uninstall pi-start pi-stop pi-status pi-health pi-logs

NVM_DIR ?= $(HOME)/.nvm
REPO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
WORKER_DIR := $(REPO_ROOT)/tools/codex-worker
RUN_WORKER := $(WORKER_DIR)/scripts/run-worker.sh
PLIST_LABEL := com.atlassian-cd-manager.codex-worker
PLIST_TEMPLATE := $(WORKER_DIR)/launchd/$(PLIST_LABEL).plist.template
PLIST_DEST := $(HOME)/Library/LaunchAgents/$(PLIST_LABEL).plist
LOG_DIR := $(HOME)/Library/Logs/atlassian-cd-manager
WORKER_HEALTH_URL ?= http://127.0.0.1:9876/health

help:
	@echo "Targets:"
	@echo "  make dev           - Start client + server in development"
	@echo "  make pi            - Start Codex worker in foreground"
	@echo "  make pi-install    - Install macOS LaunchAgent (start at login)"
	@echo "  make pi-uninstall  - Remove LaunchAgent"
	@echo "  make pi-start      - Load / start LaunchAgent"
	@echo "  make pi-stop       - Unload / stop LaunchAgent"
	@echo "  make pi-status     - Show LaunchAgent + local health"
	@echo "  make pi-health     - Curl worker/tunnel health (localhost:9876)"
	@echo "  make pi-logs       - Tail LaunchAgent logs"

# Loads nvm, selects the Node version from .nvmrc, then runs the given command.
define with-nvm
	. "$(NVM_DIR)/nvm.sh" && nvm use && $(1)
endef

dev:
	$(call with-nvm,npm run dev)

# Starts the laptop Codex worker used via the Raspberry Pi SSH bridge.
pi:
	@chmod +x "$(RUN_WORKER)"
	@"$(RUN_WORKER)"

pi-install:
	@test -f "$(PLIST_TEMPLATE)" || { echo "Missing template: $(PLIST_TEMPLATE)"; exit 1; }
	@test -f "$(REPO_ROOT)/server/.env" || { echo "Missing server/.env (needed for CODEX_WORKER_TOKEN)"; exit 1; }
	@chmod +x "$(RUN_WORKER)"
	@mkdir -p "$(HOME)/Library/LaunchAgents" "$(LOG_DIR)"
	@sed \
		-e 's|__RUN_WORKER_SH__|$(RUN_WORKER)|g' \
		-e 's|__REPO_ROOT__|$(REPO_ROOT)|g' \
		-e 's|__HOME__|$(HOME)|g' \
		-e 's|__NVM_DIR__|$(NVM_DIR)|g' \
		-e 's|__LOG_DIR__|$(LOG_DIR)|g' \
		"$(PLIST_TEMPLATE)" > "$(PLIST_DEST)"
	@launchctl bootout "gui/$$(id -u)/$(PLIST_LABEL)" 2>/dev/null || true
	@launchctl bootstrap "gui/$$(id -u)" "$(PLIST_DEST)"
	@launchctl enable "gui/$$(id -u)/$(PLIST_LABEL)" 2>/dev/null || true
	@launchctl kickstart -k "gui/$$(id -u)/$(PLIST_LABEL)"
	@echo "✅ Installed and started LaunchAgent: $(PLIST_DEST)"
	@echo "   Logs: $(LOG_DIR)/codex-worker.{out,err}.log"

pi-uninstall:
	@launchctl bootout "gui/$$(id -u)/$(PLIST_LABEL)" 2>/dev/null || true
	@rm -f "$(PLIST_DEST)"
	@echo "✅ Removed LaunchAgent $(PLIST_LABEL)"

pi-start:
	@test -f "$(PLIST_DEST)" || { echo "Not installed. Run: make pi-install"; exit 1; }
	@launchctl bootstrap "gui/$$(id -u)" "$(PLIST_DEST)" 2>/dev/null || true
	@launchctl kickstart -k "gui/$$(id -u)/$(PLIST_LABEL)"
	@echo "✅ Started $(PLIST_LABEL)"

pi-stop:
	@launchctl bootout "gui/$$(id -u)/$(PLIST_LABEL)" 2>/dev/null || true
	@echo "✅ Stopped $(PLIST_LABEL)"

pi-status:
	@echo "LaunchAgent plist: $(PLIST_DEST)"
	@if [[ -f "$(PLIST_DEST)" ]]; then echo "  installed: yes"; else echo "  installed: no"; fi
	@launchctl print "gui/$$(id -u)/$(PLIST_LABEL)" 2>/dev/null | sed -n '1,20p' || echo "  launchctl: not loaded"
	@echo "Health:"
	@$(MAKE) --no-print-directory pi-health

pi-health:
	@curl -sf --max-time 2 "$(WORKER_HEALTH_URL)" && echo || { echo "unreachable ($(WORKER_HEALTH_URL)) — worker or tunnel down?"; exit 1; }

pi-logs:
	@mkdir -p "$(LOG_DIR)"
	@touch "$(LOG_DIR)/codex-worker.out.log" "$(LOG_DIR)/codex-worker.err.log"
	@tail -n 80 -F "$(LOG_DIR)/codex-worker.out.log" "$(LOG_DIR)/codex-worker.err.log"
