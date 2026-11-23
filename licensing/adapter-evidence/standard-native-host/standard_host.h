#ifndef ECS_STANDARD_NATIVE_HOST_H
#define ECS_STANDARD_NATIVE_HOST_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdatomic.h>

#define HOST_ENV_CAP 1024u
#define HOST_PATH_CAP 256u
#define HOST_BUDGET_MS 30000u
#define HOST_NEW_ROOT "C:\\ProgramData\\Ecs.Lic008.StandardNativeHostV1"
#define HOST_IMAGE HOST_NEW_ROOT "\\bin\\StandardControlHost.exe"
#define HOST_BIN HOST_NEW_ROOT "\\bin"
#define HOST_ASSEMBLY HOST_BIN "\\StandardControl.dll"
#define HOST_CONFIG HOST_BIN "\\StandardControl.runtimeconfig.json"
#define HOST_FXR "C:\\Program Files\\dotnet\\host\\fxr\\10.0.11\\hostfxr.dll"
#define HOST_SETUP "Ecs.Lic008.StandardNativeHostV1.Setup"
#define HOST_GUARDIAN "Ecs.Lic008.StandardNativeHostV1.Guardian"
#define HOST_SCHEMA "TEST_ONLY_STANDARD_NATIVE_HOST_FOUNDATION_SELF_TEST_V1"

typedef enum { HOST_OWNER = 1, HOST_USER, HOST_SETUP_ROLE, HOST_GUARDIAN_ROLE } host_role;
/* Stage 3 is the User stage in the V2 profile, never a service StartService stage. */
typedef enum { HOST_STAGE_SETUP = 1, HOST_STAGE_GUARDIAN_BEFORE = 2, HOST_STAGE_GUARDIAN_AFTER = 4 } host_run_stage;
typedef enum { HOST_OK = 0, HOST_INVALID, HOST_MISSING_API, HOST_API_FAILED, HOST_PENDING,
    HOST_DEADLINE, HOST_REENTERED, HOST_CONSUMED, HOST_BAD_READBACK, HOST_BAD_GRANT } host_code;
typedef enum { HOST_API_OK = 0, HOST_API_ERROR, HOST_API_PENDING } host_api_disposition;
typedef enum { HOST_AT_ADMISSION = 1, HOST_AT_REGISTER, HOST_AT_START_PENDING,
    HOST_AT_CWD_SET, HOST_AT_CWD_READ, HOST_AT_DLL_POLICY, HOST_AT_ENV_SET, HOST_AT_ENV_READ,
    HOST_AT_BOOTSTRAP_WAITING, HOST_AT_RUNNING, HOST_AT_AWAIT_GRANT, HOST_AT_GRANTED_WORK,
    HOST_AT_JOIN, HOST_AT_STOPPED, HOST_AT_PUBLICATION } host_step;

typedef struct { host_api_disposition disposition; uint32_t win32_error; } host_api_result;
typedef struct {
    host_role role;
    char attempt[33], plan_sha256[65], approval_sha256[65], source_sha256[65];
    /* Only User carries these in argv. Owner and service must have every byte
       zero, including the unused tail; service StartService fields are separate. */
    char run_id[33], nonce[65];
} host_invocation;
typedef struct { host_run_stage stage; char run_id[33], nonce[65]; } host_service_start;
typedef struct { host_invocation invocation; host_service_start start; } host_grant;
typedef struct {
    host_code code; host_step step; uint32_t win32_error;
    bool api_pending, cwd_may_have_changed, dll_policy_may_have_changed,
        environment_may_have_changed, status_may_have_changed, work_call_entered, join_completed;
} host_failure;
typedef struct {
    atomic_int state; /* 0 fresh, 1 active, 2 modeled success, 3 retained/poisoned */
    host_invocation invocation; host_service_start start;
    uintptr_t status_handle; uint64_t began_ms, last_ms; bool clock_started;
    host_failure failure;
    bool model_grant_matched;
} host_session;

/* All hooks are trusted injected adapters, never approval from CLI/worker JSON.
   Every callback MUST finish accessing all supplied pointers before returning,
   even HOST_API_PENDING. Detached operations must own their own copied buffers
   in the retained hook context; they cannot borrow stack outputs/arguments.
   Pending/late callbacks are retained unknown operations, not cancellation or
   proof that their effects ended. Sessions and hook state must remain alive.
   The callback table/context pointer are snapshotted at entry; trusted context
   implementation and authority must remain valid for the entire operation.
   Budget checks observe callback boundaries only: synchronous callbacks may
   block indefinitely and this core neither cancels them nor proves a bound.
   There is no CLR loader, persisted key, account, process launch or IPC here. */
typedef struct host_api {
    void *context;
    uint64_t (*now_ms)(void *);
    host_api_result (*guard)(void *, host_step, const host_invocation *, const host_service_start *);
    host_api_result (*set_cwd)(void *, const char *);
    host_api_result (*read_cwd)(void *, char *, size_t);
    host_api_result (*set_dll_policy)(void *, uint32_t);
    host_api_result (*replace_environment)(void *, const uint16_t *, size_t);
    host_api_result (*read_environment)(void *, uint16_t *, size_t, size_t *);
    host_api_result (*register_handler)(void *, const char *, uintptr_t *);
    host_api_result (*report_status)(void *, uintptr_t, uint32_t, uint32_t, uint32_t, uint32_t);
    host_api_result (*bootstrap_waiting)(void *, const host_invocation *, const host_service_start *);
    host_api_result (*await_grant)(void *, uint32_t, host_grant *);
    host_api_result (*granted_work)(void *, const host_grant *);
    host_api_result (*join)(void *, uint32_t);
} host_api;

void host_session_init(host_session *session);
bool host_role_valid(host_role role);
bool host_parse_invocation(size_t argc, const char *const *argv, host_invocation *out);
bool host_parse_service_start(host_role role, size_t argc, const char *const *argv, host_service_start *out);
bool host_invocation_valid(const host_invocation *value);
bool host_start_valid(host_role role, const host_service_start *value);
bool host_build_environment(host_role role, uint16_t *out, size_t capacity, size_t *written);
bool host_validate_environment(host_role role, const uint16_t *block, size_t units);
const char *host_scratch(host_role role);
host_code host_prepare_process(host_session *session, const host_invocation *invocation, const host_api *api);
host_code host_service_sequence(host_session *session, const host_invocation *invocation,
    const host_service_start *start, const host_api *api);
int host_run_pure_tests(size_t *checks);

/* Closed CLI never calls either function, including native compile variants.
   Construction alone performs no Win32 call. Hook context must have process
   lifetime. Only cwd/DLL/environment have native adapters in this increment;
   native dispatcher/ServiceMain binding is absent. Actual SCM/CLR/bootstrap
   acceptance remains absent. */
bool host_windows_compile_only_api(host_api *out, const host_api *trusted_hooks);
host_code host_windows_compile_only_dispatch(const host_invocation *invocation, const host_api *trusted_hooks);

#endif
