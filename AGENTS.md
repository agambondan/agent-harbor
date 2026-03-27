<!-- BEGIN Chronicle Install -->
# Chronicle Agent Rules
Rules Profile: enhanced

Gunakan Chronicle sebagai layer retrieval dan memory default untuk project ini.

## Chronicle-First Protocol

- pada message pertama yang non-trivial dalam satu sesi, mulai dengan `chronicle.init` atau `chronicle.session_init` memakai intent user saat ini
- pada message non-trivial berikutnya, panggil `chronicle.context` atau `chronicle.context_build` lagi sebelum implementasi, debugging, planning, atau repo exploration yang lebar
- jika koneksi MCP diragukan, jalankan `chronicle.doctor` sebelum workflow lain
- jika binding project diragukan, cek `chronicle.list_projects` dan pastikan project aktif benar

## Search-First Protocol

- gunakan `chronicle.search` sebelum scan manual yang lebar dengan `rg`, `find`, atau membuka banyak file untuk discovery
- jika `chronicle.search` kosong atau terlihat stale, jalankan `chronicle.sync` untuk repo lokal lalu retry search
- fallback ke scan manual hanya boleh setelah Chronicle tidak memberi hasil yang cukup atau saat butuh pembacaan file yang sudah terlokalisasi
- gunakan `chronicle.context` atau `chronicle.context_build` saat butuh context pack lintas file yang ringkas untuk task saat ini

## Non-Hook Clients

- untuk Codex dan client tanpa hook surface yang setara, blok ini berlaku sebagai protocol blocking, bukan sekadar panduan opsional
- jangan lanjut ke tool lokal, repo scan, planning lebar, atau edit code sebelum `chronicle.init`/`chronicle.session_init` dan `chronicle.context`/`chronicle.context_build` selesai untuk turn aktif
- jangan jalankan discovery manual lebar seperti `rg`, `find`, atau membuka banyak file sebelum `chronicle.search` dijalankan untuk turn aktif kecuali Chronicle memang kosong atau stale dan sudah di-retry

## Memory Discipline

- gunakan `chronicle.remember` untuk menyimpan preference user, keputusan, dan fakta project yang sudah diverifikasi
- gunakan `chronicle.recall` saat user merujuk keputusan lama atau saat pekerjaan berlanjut lintas sesi

## Sync Discipline

- setelah perubahan repo yang signifikan, jalankan `chronicle.sync` supaya index Chronicle mengikuti code dan docs terbaru
- sesudah install atau binding project, pastikan retrieval CLI bisa berjalan tanpa `--project` untuk repo yang aktif

## Scope

- profil `enhanced` menanam workflow Chronicle-first yang lebih ketat di level instruksi project
- pada client yang mendukung hooks dan sudah dipatch installer, Chronicle-first juga dipaksa lewat hook per-message dan pre-tool gate
- untuk client tanpa hook surface yang setara, blok ini tetap menjadi fallback manual yang eksplisit
- aturan lain di `AGENTS.md` tetap berlaku

<!-- END Chronicle Install -->
