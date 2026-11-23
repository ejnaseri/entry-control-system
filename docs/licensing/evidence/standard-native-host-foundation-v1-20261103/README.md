# W03 native host foundation — original build evidence

Built 2026-11-03 UTC (November 4 Kabul) from baseline `ae7991f` and six
exact inputs. [Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_HOST.md).
Authoritative retained output:
`out/lic008-standard-native-host-v1-7689273d3ab44266a0b6c4986eb7ca4a`.
The source-set SHA256 is
`84b77e806d2e1ca75d3b8ea3c245a369903a9e4b1e033d914aabe57e5dbcb785`.

These eight files are **29,623 bytes of byte-for-byte originals**, copied from
the retained build without JSON parsing or reserialization. The manifest pins
the six source files, portable Zig compiler and verified tool tree, full PE
imports, compile records, self-test reports, and refused-entry results.
Independent source/artifact/archive review PASS (139,363 read-only checks):
the six inputs, all 51 child execution records, three PE import sets and all
eight archived bytes/hashes/lengths match the retained originals.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 22,974 | `b244ce8fdecfd789bd7d5b0705f88f45dcee7c720b897bdc988c3b36b613945e` |
| [source-set.json](source-set.json) | 1,152 | `84b77e806d2e1ca75d3b8ea3c245a369903a9e4b1e033d914aabe57e5dbcb785` |
| [default-pure-test-report.json](default-pure-test-report.json) | 299 | `69bee03838e76454c8f996e3d098c9df647de33bc210bb99a73cd51b828c7dc7` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 299 | `69bee03838e76454c8f996e3d098c9df647de33bc210bb99a73cd51b828c7dc7` |
| [compile-only-native-pure-test-report.json](compile-only-native-pure-test-report.json) | 299 | `69bee03838e76454c8f996e3d098c9df647de33bc210bb99a73cd51b828c7dc7` |
| [default-pe-imports.json](default-pe-imports.json) | 1,483 | `b1129ff64b43a7b0e24c1506090f1d9c44bf2ce38e0de26b9b2a62c405f9b192` |
| [unrelated-defines-pe-imports.json](unrelated-defines-pe-imports.json) | 1,484 | `fa5b601693be873a420c82464cb15ea46a7bb42526fbbe2b0766d66d57f7b799` |
| [compile-only-native-pe-imports.json](compile-only-native-pe-imports.json) | 1,633 | `d58c7782cd96d7ea25d2cb9fbc11cbebd381d6b6dc69a05912e716bbe1f892b7` |

All three AMD64 native console builds pass **2,455 pure injected assertions**
and reject **15 operational CLI entries** each. The executables differ:
default SHA256 `866636a3be0449c10f6c0a50be46fe77fed6304cd2603b184203295736f71291`,
unrelated-defines
`bc93f2ed4b68ce7b7f0cfa4c0d58caf2eb90a050b63b246ff17c09306bcd53ad`,
and compile-only-native
`6f44d2240746edaf7cd13b6786f6612fe5a53a3b80ff8844d488216edbed9e85`.
Byte reproducibility is not established.

Only the pure fake self-test and closed CLI refusal paths were executed. The
native environment/cwd/DLL calls were compiled in the third variant but never
invoked. No actual SCM dispatch, hostfxr/CLR load, managed bootstrap, account
activation/logon, key operation, or W03 comparison ran. Actual service,
bootstrap, loaded-code, security, production and LIC008 acceptance are false.
The earlier ordinary build-tool failure and its corrected empty-output
regression remain under separate retained `out/` directories; no PE from that
failed build was executed.
