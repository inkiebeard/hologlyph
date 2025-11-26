# AI Agent Configuration

This project uses `agents.md` as the single source of truth for AI coding assistant guidelines. Multiple symlinks point to this file to support different AI platforms.

## Symlinked Files

All of the following files are symbolic links to `agents.md`:

### AI Coding Assistants
- **`.cursorrules`** → Cursor AI
- **`.clinerules`** → Cline
- **`.windsurfrules`** → Windsurf  
- **`.continuerules`** → Continue
- **`.tabninerules`** → Tabnine
- **`.aiconfig`** → Generic AI config

### Platform-Specific
- **`aider.md`** → Aider AI
- **`claude.md`** → Claude/Anthropic projects
- **`gpt.md`** → GPT/OpenAI projects
- **`copilot-instructions.md`** → GitHub Copilot

### Additional Files
- **`.aiderignore`** → Aider (also points to agents.md as instructions)

## Why Symlinks?

Different AI coding assistants look for different configuration filenames. By using symlinks:

1. **Single Source of Truth** - Edit `agents.md` and all AI assistants see the changes
2. **No Duplication** - Avoid maintaining multiple copies of the same guidelines
3. **Universal Compatibility** - Works with any AI tool that supports markdown instructions
4. **Easy Maintenance** - Update once, applies everywhere

## Editing Guidelines

**⚠️ Important:** Always edit `agents.md` directly, not the symlinked files.

```bash
# ✅ CORRECT - Edit the source file
code agents.md

# ❌ WRONG - Don't edit symlinks (changes will go to agents.md anyway)
code .cursorrules
```

## Verifying Symlinks

On Windows, check symlinks with:
```powershell
Get-Item .cursorrules | Select-Object Mode, Target
```

On Unix/Mac, check symlinks with:
```bash
ls -la | grep agents.md
```

## Creating New Symlinks

If a new AI assistant needs a specific filename:

### Windows (requires admin or Developer Mode)
```cmd
mklink new-ai-file.md agents.md
```

### Unix/Mac
```bash
ln -s agents.md new-ai-file.md
```

## Git Handling

All symlinks are tracked in git. When you clone the repository:
- **Windows:** Requires symlink support (Windows 10+ with Developer Mode or admin)
- **Unix/Mac:** Works automatically

If symlinks don't work, copy `agents.md` to the required filename as a fallback.

## Supported AI Platforms

| Platform | Filename | Status |
|----------|----------|--------|
| Cursor | `.cursorrules` | ✅ Active |
| Cline | `.clinerules` | ✅ Active |
| Windsurf | `.windsurfrules` | ✅ Active |
| Continue | `.continuerules` | ✅ Active |
| Tabnine | `.tabninerules` | ✅ Active |
| Aider | `aider.md` | ✅ Active |
| Claude | `claude.md` | ✅ Active |
| GPT | `gpt.md` | ✅ Active |
| Copilot | `copilot-instructions.md` | ✅ Active |
| Generic | `.aiconfig` | ✅ Active |

## Troubleshooting

### Symlinks Not Working?
- **Windows:** Enable Developer Mode in Settings → Update & Security → For Developers
- **Or:** Run terminal as Administrator
- **Or:** Copy `agents.md` to the required filename

### Symlinks Not in Git?
```bash
git config core.symlinks true
```

### Can't Edit Symlink?
You're actually editing `agents.md` (which is correct). The symlink just redirects to the source file.

---

**Summary:** One file (`agents.md`), many names, universal AI compatibility. 🤖✨

