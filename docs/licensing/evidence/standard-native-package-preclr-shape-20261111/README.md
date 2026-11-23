# W03 NativeHostV2 pre-CLR shape — closed package evidence

Built November 11 Kabul from baseline `81d9f6412aebc2e2fdba2c373b1aad2e775d8ab7`.
The User command grammar now carries exact `--run-id <lowerhex32>` and
`--nonce <lowerhex64>` fields; the previous User grammar is refused. The service-start
grammar remains unchanged. [Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

Authoritative retained output:
`out/lic008-standard-native-package-binding-v2-08e5a424bb804d5e8aa4ff8d79e3a5d6`.
The independently reconstructed nine-input source-set SHA256 is
`6cdabca7ae1b71027268fc6fd236002158dd3e948b99867503f53c2ee638d67d`.

These five files are **102,683 bytes of byte-for-byte originals**, copied from
the fresh final output with CreateNew, without JSON reserialization. An
independent audit compared each archive byte with the retained output and
checked nine live/snapshot inputs, 375 installed pins, three DLL/configuration/
response-file sets, 63 terminal child records, 57 exact closed CLI refusals
and zero pending children. All authority and effect flags remain false.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 99,387 | `cf51e7ef323188cbdef39f83935b1e6b13e1b947f3600db6e306201a2b03fcaa` |
| [source-set.json](source-set.json) | 1,805 | `6cdabca7ae1b71027268fc6fd236002158dd3e948b99867503f53c2ee638d67d` |
| [default-pure-test-report.json](default-pure-test-report.json) | 497 | `af94199afcbe132b2b04a4d0854db824d7735ef164725681f11af748485bd592` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 497 | `af94199afcbe132b2b04a4d0854db824d7735ef164725681f11af748485bd592` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 497 | `af94199afcbe132b2b04a4d0854db824d7735ef164725681f11af748485bd592` |

Each .NET 10 warning-as-error variant passed profile **144**, input codec
**134**, stage store **1,020** and package binder **700** pure checks, then
refused 19 operational CLI shapes. The three DLL SHA256 values in table order
are `fdd4e7f32850db87b6e22adf43cb7ec066d2b215a072d1a9b5e7aba1dbb90086`,
`665420c36cf1dfa11eddf3b45a33437d4374f600c602cb843b06ff778e22bc5b`
and `c48be9e7620217e7759232c791221ee9774d1ccf29d939945fd8e5b4f0373f0a`.
Byte reproducibility is not established.

The earlier [nonce64 package evidence](../standard-native-package-binding-v2-nonce64-20261111/README.md)
remains historical. This build still accepts only an unsigned in-memory
candidate and unconditionally refuses physical admission. It does not bind
User argv to an Owner-authored protected one-use intent, or establish live
file/process/token custody. No account logon, SCM, native loader, CLR,
persisted-key operation or W03 comparison ran. LIC008/Open003 and security/
production acceptance remain open.
