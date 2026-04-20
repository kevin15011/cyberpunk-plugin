# Proposal: cyberpunk-tui

## Intent

Reemplazar el instalador fijo `install.sh` y el comportamiento automático del plugin de OpenCode por un CLI/TUI interactivo llamado `cyberpunk` que permite al usuario elegir qué componentes instalar, configurar y actualizar, sin obligar nada al cargar OpenCode.

## Scope

### In Scope
- Binario CLI `cyberpunk` con TUI interactiva
- Menú visual para instalar/desinstalar cada componente
- Flags `--install`, `--uninstall`, `--status`, `--upgrade` para uso no-interactivo
- Instalación via `curl | bash` para bootstrap inicial
- Configuración persistente en `~/.config/cyberpunk/config.json`
- El plugin de OpenCode sigue existiendo pero deja de forzar instalaciones al cargar

### Out of Scope
- Refactor del plugin `cyberpunk.ts` existente (se mantiene como está)
- Tests automatizados (no hay infraestructura de tests hoy)
- Paquetes brew/apt

## Capabilities

### New Capabilities
- `cyberpunk-tui`: CLI con TUI visual para gestionar componentes
- `cyberpunk-install`: Instalación interactiva y no-interactiva de componentes individuales
- `cyberpunk-upgrade`: Verifica y aplica actualizaciones del plugin desde el repo
- `cyberpunk-config`: Lectura/escritura de configuración persistente

## Approach

- CLI en TypeScript compilado a binario standalone (similar a Gentle AI)
- TUI usando `prompts` o `@clack/prompts` (mismo ecosistema que el plugin actual)
- Cada "componente" es un módulo separado con `install()` y `uninstall()`
- Componentes: `plugin`, `theme`, `sounds`, `context-mode`
- Config en `~/.config/cyberpunk/config.json` con schema de componentes instalados
- El CLI no necesita OpenCode corriendo; funciona en terminal sola

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `install.sh` | Replaced | Se reemplaza por el CLI `cyberpunk` |
| `src/tui.ts` | New | TUI principal con menú de componentes |
| `src/commands/install.ts` | New | Lógica de instalación de componentes |
| `src/commands/upgrade.ts` | New | Upgrade desde repo remoto |
| `src/commands/config.ts` | New | Gestión de config persistente |
| `src/components/*.ts` | New | Módulos instalables: plugin, theme, sounds, context-mode |
| `~/.config/cyberpunk/config.json` | New | Estado de componentes instalados |
| `~/.config/opencode/plugins/cyberpunk.ts` | Modified | Ya no fuerza instalaciones al cargar |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Compilar TS a binario standalone es complejo | Medium | Usar `pkg` o `bun build --target=binary` |
| El plugin actual sigue cargando y duplica comportamiento | Medium | Modificar plugin para que solo maneje eventos de sonido/tema |
| El CLI sobrescribe archivos ya personalizados | Low | Verificar y hacer backup antes de sobrescribir |

## Rollback Plan

1. Eliminar `cyberpunk` del PATH
2. Restaurar `install.sh` original desde git
3. El plugin `cyberpunk.ts` original sigue funcionando para quien no use el CLI

## Dependencies

- Node.js/Bun runtime en la máquina destino
- Git repo accesible para `upgrade`

## Success Criteria

- [ ] `cyberpunk` abre TUI interactiva y muestra los 4 componentes
- [ ] `cyberpunk --status` muestra qué está instalado
- [ ] `cyberpunk --install --plugin` instala solo el plugin sin tocar tema ni sonidos
- [ ] `cyberpunk --install --all` instala todo
- [ ] `cyberpunk --upgrade`Descarga e instala la última versión del repo
- [ ] El tema cyberpunk queda disponible pero NO se activa obligatoriamente
- [ ] `curl https://.../install.sh | bash` instala el CLI y nada más
