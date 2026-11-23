#!/usr/bin/env bash
# Pasang hook commit-msg yang membuang atribusi AI dari pesan commit.
# Jalankan sekali per clone: bash scripts/install-git-hooks.sh
set -eu

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$repo_root" ] || exit 0
hook="$repo_root/.git/hooks/commit-msg"

cat > "$hook" <<'HOOK'
#!/usr/bin/env bash
# Bersihkan atribusi AI dari pesan commit.
#
# Alasan: GitHub menghitung "Co-authored-by:" sebagai contributor. Jadi kalau
# sebuah tool menambahkan dirinya di situ, dia ikut muncul di daftar contributor.
# Hook ini hanya membuang trailer yang menyebut nama tool AI; co-author manusia
# tetap dipertahankan.

set -eu
msg_file="$1"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

awk '
  function is_ai(s) {
    return s ~ /(claude|chatgpt|openai|gpt|copilot|gemini|codex|cursor|opencode|antigravity|devin|aider|tabnine|continue\.dev|windsurf)/
  }
  {
    low = tolower($0)
    # trailer atribusi yang menyebut tool AI
    if (low ~ /^[[:space:]]*(co-authored-by|co-developed-by|assisted-by|generated-by|signed-off-by):/ && is_ai(low)) next
    # kalimat "Generated with ..." / "Made with ..." khas tool AI
    if (low ~ /(generated with|made with|created with)/ && is_ai(low)) next
    print
  }
' "$msg_file" > "$tmp"

# Rapikan baris kosong berlebih di akhir.
awk 'BEGIN{blank=0} /^[[:space:]]*$/{blank++; next} {while (blank>0) {print ""; blank--} print} END{print ""}' "$tmp" > "$msg_file"
HOOK

chmod +x "$hook"
echo "Hook dipasang: $hook"
