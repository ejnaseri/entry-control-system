#ifndef ECS_STANDARD_NATIVE_LOADER_H
#define ECS_STANDARD_NATIVE_LOADER_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdatomic.h>

#define LOADER_PROFILE "TEST_ONLY_STANDARD_NATIVE_HOST_PROFILE_V2"
#define LOADER_EFFECTS "FRESH_NATIVE_HOST_SERVICES_TWO_KEYS_OWNED_ACCOUNT_LOGON_READONLY_OWNER_OBJECT_TRANSFER_RETURN_DISABLED_RETAIN_V2"
#define LOADER_SCHEMA "TEST_ONLY_STANDARD_NATIVE_LOADER_SELF_TEST_V1"
#define LOADER_ROOT "C:\\ProgramData\\Ecs.Lic008.StandardNativeHostV1"
#define LOADER_BIN LOADER_ROOT "\\bin"
#define LOADER_IMAGE LOADER_BIN "\\StandardControlHost.exe"
#define LOADER_ASSEMBLY LOADER_BIN "\\StandardControl.dll"
#define LOADER_CONFIG LOADER_BIN "\\StandardControl.runtimeconfig.json"
#define LOADER_DOTNET "C:\\Program Files\\dotnet"
#define LOADER_RUNTIME LOADER_DOTNET "\\shared\\Microsoft.NETCore.App\\10.0.11"
#define LOADER_FXR LOADER_DOTNET "\\host\\fxr\\10.0.11\\hostfxr.dll"
#define LOADER_DEPS LOADER_RUNTIME "\\Microsoft.NETCore.App.deps.json"
#define LOADER_TYPE "EntryControl.TestOnly.StandardNativeHost.NativeEntry, StandardControl"
#define LOADER_METHOD "Bootstrap"
#define LOADER_CONFIG_BYTES "{\"runtimeOptions\":{\"tfm\":\"net10.0\",\"rollForward\":\"Disable\",\"framework\":{\"name\":\"Microsoft.NETCore.App\",\"version\":\"10.0.11\"}}}"
#define LOADER_HOSTFXR_HEADER_SHA "f365479a3b54703e288054df05943a215b8a005d145885e8b0508d1ef596afc7"
#define LOADER_DELEGATE_HEADER_SHA "f1be3dd52842835b1f824e28a070b9a9626ecd73b1572a1ef772ac07088e8775"
#define LOADER_PATH_CAP 256u
#define LOADER_PROPERTY_CAP 16u
#define LOADER_PROPERTY_ARENA 65536u
#define LOADER_PROPERTY_VALUE_CAP 32768u
#define LOADER_BUDGET_MS 30000u

typedef enum { LOADER_OK=0, LOADER_INVALID, LOADER_MISSING_API, LOADER_API_FAILED,
    LOADER_PENDING, LOADER_DEADLINE, LOADER_REENTERED, LOADER_CONSUMED,
    LOADER_BAD_OBSERVATION, LOADER_PROPERTY_REFUSED, LOADER_HOST_STATUS_REFUSED } loader_code;
typedef enum { LOADER_API_OK=0, LOADER_API_ERROR, LOADER_API_PENDING } loader_disposition;
/* Win32 and host statuses are independent domains. An API error can honestly
   contain raw zero; status is valid only when host_status_present is true. */
typedef struct { loader_disposition disposition; uint32_t win32_error;
    bool host_status_present; int32_t host_status; } loader_api_result;
typedef enum { LOADER_AT_ACQUIRE=1, LOADER_AT_LOAD, LOADER_AT_OBSERVE,
    LOADER_AT_EXPORTS, LOADER_AT_INITIALIZE, LOADER_AT_PROPERTY_COUNT,
    LOADER_AT_PROPERTIES, LOADER_AT_PROPERTY_ADMISSION, LOADER_AT_DELEGATE,
    LOADER_AT_ENTRY, LOADER_AT_PUBLICATION } loader_step;
typedef struct {
    char profile[65], effects[128]; uint32_t role, stage;
    char attempt[33], run_id[33], nonce[65], plan_sha256[65], approval_sha256[65],
        source_sha256[65], profile_sha256[65], package_sha256[65], runtime_sha256[65],
        image_sha256[65], assembly_sha256[65], config_sha256[65];
} loader_binding;
typedef struct { char name[128]; size_t value_offset, value_length; } loader_property;
typedef struct {
    uintptr_t lease, module, exports[4], export_owners[4];
    void *host_context, *runtime_delegate, *entry;
    char module_path[LOADER_PATH_CAP]; size_t property_count, arena_used;
    loader_property properties[LOADER_PROPERTY_CAP]; char arena[LOADER_PROPERTY_ARENA];
} loader_evidence;
typedef struct {
    loader_code code; loader_step step; loader_api_result raw;
    bool lease_acquire_entered, native_load_entered, initialization_entered,
        coreclr_start_entered, component_resolution_entered;
} loader_failure;
typedef struct {
    atomic_int state; /* Fresh0, active1, resolved2, retained/poisoned3. */
    loader_binding binding; loader_evidence evidence; loader_failure failure;
    uint64_t began_ms, last_ms; bool clock_started;
    size_t borrowed_count; const uint16_t *borrowed_keys[LOADER_PROPERTY_CAP],
        *borrowed_values[LOADER_PROPERTY_CAP];
} loader_session;

/* TRUSTED actual adapters, not worker JSON or caller approval booleans.
   acquire roots actual file/ancestor leases in out before any native load.
   guard must authenticate the NEW complete V2 plan/approval and actual primary
   identity/no impersonation, scope/time, current startup/environment/cwd/DLL
   policy and complete protected file/dependency identity+ACL+hash custody.
   In particular: exactly the admitted runtime189 leaves + hostfxr, native EXE,
   two managed payloads, canonical config bytes, no adjacent deps/dev/extra
   binaries, actual module observations bound to held file identities. Hash
   strings/profile descriptors alone cannot implement this contract.
   Specifically recheck actual held hostfxr/module/export identity before init;
   actual hostpolicy identity after init; and actual coreclr/hostpolicy/clrjit
   module identities after delegate startup and before component resolution and
   publication. Observe modules without loading missing candidates. Missing or
   unprovable required observations refuse; this is no all-module attestation.
   hostfxr_get_runtime_properties returns context-owned UTF-16 buffers, whose
   documented lifetime ends on run, property change, or context close. The core
   must copy them before even a guard/clock callback. A successful delegate
   result still needs the post-delegate custody guard: CoreCLR has started.
   Callbacks must stop accessing ALL supplied pointers before returning, even
   PENDING. Any detached asynchronous work owns copies in retained context.
   Retain whole session/context/leases on failure or pending. No retry/unload,
   unknown-context close, cancellation, entry invocation or finalizer cleanup.
   Boundary budgets cannot interrupt a synchronous unreturning callback. */
typedef struct {
    void *context;
    uint64_t (*now_ms)(void *);
    loader_api_result (*guard)(void *,loader_step,const loader_binding *,const loader_evidence *);
    loader_api_result (*acquire)(void *,const loader_binding *,uintptr_t *);
    loader_api_result (*load)(void *,const char *,uint32_t,uintptr_t *);
    loader_api_result (*observe_module)(void *,uintptr_t,char *,size_t);
    loader_api_result (*exports)(void *,uintptr_t,uintptr_t *,uintptr_t *);
    loader_api_result (*initialize)(void *,const char *,const char *,const char *,void **);
    loader_api_result (*properties)(void *,void *,size_t *,const uint16_t **,const uint16_t **);
    loader_api_result (*get_delegate)(void *,void *,uint32_t,void **);
    loader_api_result (*resolve_entry)(void *,void *,const char *,const char *,const char *,void **);
} loader_api;

void loader_session_init(loader_session *);
bool loader_binding_valid(const loader_binding *);
const char *loader_export_name(size_t index);
size_t loader_tpa_count(void);
const char *loader_tpa_leaf(size_t index);
bool loader_properties_valid(const loader_evidence *);
loader_code loader_resolve(loader_session *,const loader_binding *,const loader_api *);
int loader_run_pure_tests(size_t *);

/* Native factory is assignment-only and compile-only; CLOSED main cannot call
   it. Zero-initialized storage is consumed once and must have process lifetime.
   One-shot/no-retry applies to loader_resolve, not arbitrary direct calls to
   raw factory callbacks. Before physical integration, isolate this factory
   behind the trusted core and add per-stage attempt latches or equivalent.
   No successful context-close operation is provided in this increment. */
typedef struct { void *context; uint64_t (*now_ms)(void *);
    loader_api_result (*guard)(void *,loader_step,const loader_binding *,const loader_evidence *);
    loader_api_result (*acquire)(void *,const loader_binding *,uintptr_t *);
} loader_trusted_hooks;
typedef struct {
    atomic_int constructed; loader_trusted_hooks hooks;
    uintptr_t module, exports[4]; bool exports_ready;
    void *host_context, *runtime_delegate;
} loader_native_context;
bool loader_windows_compile_only_api(loader_api *,loader_native_context *,const loader_trusted_hooks *);
#endif
