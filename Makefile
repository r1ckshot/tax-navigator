.PHONY: help verify verify-syntax verify-devcontainer verify-whitelist verify-sandbox verify-firewall test build rebuild clean clean-artifacts

STARTER_NAME := tax-navigator
TEST_CMD := npm test
CLEAN_PATHS := node_modules dist .next

help:
	@echo "Targets:"
	@echo "  verify              Запустити всі security перевірки"
	@echo "  verify-syntax       JSON валідність + deny/sandbox мінімум + консистентність доменів (Node, без python3)"
	@echo "  verify-devcontainer Перевірити devcontainer.json runArgs і postStartCommand (з'явиться на Кроці 6)"
	@echo "  verify-whitelist    Перевірити консистентність sandbox і init-firewall whitelists (з'явиться на Кроці 6)"
	@echo "  verify-sandbox      Перевірити що sandbox блокує cat .env (потребує Docker)"
	@echo "  verify-firewall     Перевірити firewall у devcontainer (тільки всередині контейнера)"
	@echo "  test                Запустити unit тести"
	@echo "  build               Зібрати Docker image"
	@echo "  rebuild             Перезібрати без cache"
	@echo "  clean               Прибрати containers і volumes (build artifacts: 'make clean-artifacts')"
	@echo "  clean-artifacts     Видалити локальні build/dependency артефакти ($(CLEAN_PATHS))"

verify: verify-syntax
	@echo ""
	@echo "=== Verify $(STARTER_NAME) ==="
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		$(MAKE) --no-print-directory verify-sandbox; \
	else \
		if [ "$${CI:-}" = "true" ]; then \
			echo "FAIL: Docker не запущений, у CI це fatal."; \
			exit 1; \
		else \
			echo "SKIP: Docker не запущений. Тільки syntax checks виконані."; \
		fi; \
	fi
	@echo ""
	@echo "=== Verify завершено ==="

verify-syntax:
	@node scripts/verify.mjs

verify-devcontainer:
	@bash tests/validate-devcontainer.sh

verify-whitelist:
	@bash tests/validate-whitelist.sh

verify-sandbox:
	@echo ""
	@echo "=== Sandbox leak test ==="
	@bash tests/sandbox-leak.test.sh

verify-firewall:
	@echo ""
	@echo "=== Firewall test ==="
	@bash tests/firewall.test.sh

test:
	@$(TEST_CMD)

build:
	@docker compose build

rebuild:
	@docker compose build --no-cache

clean:
	@docker compose down -v 2>/dev/null || true

clean-artifacts:
	@for path in $(CLEAN_PATHS); do \
		if [ -e "$$path" ]; then \
			echo "Видаляю $$path"; \
			rm -r -- "$$path"; \
		fi; \
	done
