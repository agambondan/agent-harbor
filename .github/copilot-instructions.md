<!-- BEGIN Chronicle Copilot Instructions -->
# Chronicle Copilot Instructions
Rules Profile: enhanced

Gunakan Chronicle sebagai layer retrieval dan memory default untuk repo ini.

## Chronicle-First Protocol

- pada prompt non-trivial, mulai dengan `chronicle.init` atau `chronicle.session_init` bila session belum aktif
- panggil `chronicle.context` atau `chronicle.context_build` sebelum membaca banyak file, planning lebar, atau implementasi lintas file
- gunakan `chronicle.search` sebelum `grep`, `glob`, `view`, `task`, atau discovery manual yang lebar
- bila hasil retrieval kosong atau stale, jalankan `chronicle.sync` lalu ulangi retrieval sebelum fallback manual
- gunakan `chronicle.remember` dan `chronicle.recall` untuk preference, keputusan, lesson, correction, dan task lintas sesi

## Enforcement

- hooks Copilot Chronicle akan memblokir tool lain sampai context dan search Chronicle dipanggil untuk turn aktif
- jangan bypass hook dengan shell discovery lebar sebelum `chronicle.search` berhasil atau jelas tidak cukup

## Scope

- file ini melengkapi `AGENTS.md` dan menjadi layer instruksi untuk GitHub Copilot CLI
- hosted coding agent mungkin butuh environment tambahan agar `chronicle-agent` tersedia; install Chronicle hanya mengklaim support lokal penuh untuk Copilot CLI

<!-- END Chronicle Copilot Instructions -->
