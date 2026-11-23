#include "standard_host.h"
#include <string.h>

static size_t bounded_length(const char *text, size_t cap) {
    size_t n;
    if (text == NULL) return cap;
    for (n = 0; n < cap && text[n] != '\0'; ++n) { }
    return n;
}
static bool exact(const char *text, const char *expected) {
    size_t n = strlen(expected);
    return bounded_length(text, n + 1u) == n && memcmp(text, expected, n) == 0;
}
static bool hex(const char *text, size_t length) {
    size_t i;
    if (bounded_length(text, length + 1u) != length) return false;
    for (i = 0; i < length; ++i)
        if (!((text[i] >= '0' && text[i] <= '9') || (text[i] >= 'a' && text[i] <= 'f'))) return false;
    return true;
}
static bool all_zero(const void *value, size_t length) {
    const unsigned char *bytes = (const unsigned char *)value; size_t i;
    for (i = 0; i < length; ++i) if (bytes[i] != 0u) return false;
    return true;
}
bool host_role_valid(host_role role) { return role >= HOST_OWNER && role <= HOST_GUARDIAN_ROLE; }
bool host_invocation_valid(const host_invocation *v) {
    return v != NULL && host_role_valid(v->role) && hex(v->attempt, 32u) && hex(v->plan_sha256, 64u) &&
        hex(v->approval_sha256, 64u) && hex(v->source_sha256, 64u) &&
        (v->role == HOST_USER ? (hex(v->run_id, 32u) && hex(v->nonce, 64u)) :
         (all_zero(v->run_id, sizeof v->run_id) && all_zero(v->nonce, sizeof v->nonce)));
}
bool host_start_valid(host_role role, const host_service_start *v) {
    return v != NULL && hex(v->run_id, 32u) && hex(v->nonce, 64u) &&
        ((role == HOST_SETUP_ROLE && v->stage == HOST_STAGE_SETUP) ||
         (role == HOST_GUARDIAN_ROLE && (v->stage == HOST_STAGE_GUARDIAN_BEFORE || v->stage == HOST_STAGE_GUARDIAN_AFTER)));
}
bool host_parse_invocation(size_t argc, const char *const *argv, host_invocation *out) {
    host_invocation value; size_t first;
    if (argv == NULL || out == NULL || (argc != 10u && argc != 12u && argc != 14u) || !exact(argv[0], HOST_IMAGE)) return false;
    memset(&value, 0, sizeof value);
    if (argc == 10u && exact(argv[1], "--owner")) {
        value.role = HOST_OWNER; first = 2u;
    } else if (argc == 14u && exact(argv[1], "--user")) {
        value.role = HOST_USER; first = 2u;
    } else if (argc == 12u && exact(argv[1], "--service") && exact(argv[2], "--role") &&
        (exact(argv[3], "Setup") || exact(argv[3], "Guardian"))) {
        value.role = exact(argv[3], "Setup") ? HOST_SETUP_ROLE : HOST_GUARDIAN_ROLE; first = 4u;
    } else return false;
    if (!exact(argv[first], "--attempt") || !hex(argv[first + 1u], 32u) ||
        !exact(argv[first + 2u], "--plan-sha256") || !hex(argv[first + 3u], 64u) ||
        !exact(argv[first + 4u], "--approval-sha256") || !hex(argv[first + 5u], 64u) ||
        !exact(argv[first + 6u], "--source-set-sha256") || !hex(argv[first + 7u], 64u)) return false;
    memcpy(value.attempt, argv[first + 1u], 33u); memcpy(value.plan_sha256, argv[first + 3u], 65u);
    memcpy(value.approval_sha256, argv[first + 5u], 65u); memcpy(value.source_sha256, argv[first + 7u], 65u);
    if (value.role == HOST_USER) {
        if (!exact(argv[10], "--run-id") || !hex(argv[11], 32u) ||
            !exact(argv[12], "--nonce") || !hex(argv[13], 64u)) return false;
        memcpy(value.run_id, argv[11], 33u); memcpy(value.nonce, argv[13], 65u);
    }
    if (!host_invocation_valid(&value)) return false;
    *out = value; return true; /* Shape only; no approval/role authorization. */
}
bool host_parse_service_start(host_role role, size_t argc, const char *const *argv, host_service_start *out) {
    host_service_start value;
    if (argv == NULL || out == NULL || argc != 7u ||
        !exact(argv[0], role == HOST_SETUP_ROLE ? HOST_SETUP : HOST_GUARDIAN) ||
        !exact(argv[1], "--stage") || !exact(argv[3], "--run-id") || !hex(argv[4], 32u) ||
        !exact(argv[5], "--nonce") || !hex(argv[6], 64u)) return false;
    memset(&value, 0, sizeof value);
    if (exact(argv[2], "setup")) value.stage = HOST_STAGE_SETUP;
    else if (exact(argv[2], "guardian-before")) value.stage = HOST_STAGE_GUARDIAN_BEFORE;
    else if (exact(argv[2], "guardian-after")) value.stage = HOST_STAGE_GUARDIAN_AFTER;
    else return false;
    memcpy(value.run_id, argv[4], 33u); memcpy(value.nonce, argv[6], 65u);
    if (!host_start_valid(role, &value)) return false;
    *out = value; return true;
}
const char *host_scratch(host_role role) {
    switch (role) {
        case HOST_OWNER: return HOST_NEW_ROOT "\\scratch\\owner";
        case HOST_USER: return HOST_NEW_ROOT "\\scratch\\user";
        case HOST_SETUP_ROLE: return HOST_NEW_ROOT "\\scratch\\setup";
        case HOST_GUARDIAN_ROLE: return HOST_NEW_ROOT "\\scratch\\guardian";
        default: return NULL;
    }
}
static bool append(uint16_t *out, size_t cap, size_t *at, const char *text) {
    size_t i, n = strlen(text);
    if (*at >= cap || n >= cap - *at) return false;
    for (i = 0; i < n; ++i) out[(*at)++] = (uint16_t)(unsigned char)text[i];
    return true;
}
bool host_build_environment(host_role role, uint16_t *out, size_t cap, size_t *written) {
    const char *keys[] = { "DOTNET_EnableDiagnostics=0", "SystemRoot=C:\\Windows", "TEMP=", "TMP=", "windir=C:\\Windows" };
    size_t at = 0, i; const char *scratch = host_scratch(role);
    if (scratch == NULL || out == NULL || written == NULL || cap > HOST_ENV_CAP) return false;
    for (i = 0; i < sizeof keys / sizeof keys[0]; ++i) {
        if (!append(out, cap, &at, keys[i]) || ((i == 2u || i == 3u) && !append(out, cap, &at, scratch)) || at >= cap) return false;
        out[at++] = 0;
    }
    if (at >= cap) return false;
    out[at++] = 0; *written = at; return true;
}
static uint16_t lower_ascii(uint16_t c) { return c >= 'A' && c <= 'Z' ? (uint16_t)(c + ('a' - 'A')) : c; }
static int names_compare(const uint16_t *a, size_t an, const uint16_t *b, size_t bn) {
    size_t i, n = an < bn ? an : bn;
    for (i = 0; i < n; ++i) if (lower_ascii(a[i]) != lower_ascii(b[i])) return lower_ascii(a[i]) < lower_ascii(b[i]) ? -1 : 1;
    return an == bn ? 0 : an < bn ? -1 : 1;
}
bool host_validate_environment(host_role role, const uint16_t *block, size_t units) {
    uint16_t expected[HOST_ENV_CAP]; size_t count = 0, at = 0, previous = 0, previous_name = 0;
    if (block == NULL || units < 2u || units > HOST_ENV_CAP || block[units - 1u] != 0 || block[units - 2u] != 0) return false;
    while (at + 1u < units) {
        size_t start = at, name = 0;
        if (block[at] == 0) return false; /* Extra terminator/hidden tail. */
        while (at < units && block[at] != 0) {
            uint16_t c = block[at];
            if (c < 32u || c > 126u) return false;
            if (c == '=' && name == 0) { name = at - start; if (name == 0) return false; }
            ++at;
        }
        if (at >= units || name == 0 || at - start <= name + 1u ||
            (previous_name != 0 && names_compare(block + previous, previous_name, block + start, name) >= 0)) return false;
        previous = start; previous_name = name; ++at;
        if (at == units - 1u) break;
    }
    return at == units - 1u && host_build_environment(role, expected, HOST_ENV_CAP, &count) &&
        count == units && memcmp(expected, block, units * sizeof block[0]) == 0;
}

void host_session_init(host_session *s) { if (s != NULL) { memset(s, 0, sizeof *s); atomic_init(&s->state, 0); } }
static host_code fail(host_session *s, host_code code, host_step step, host_api_result result) {
    s->failure.code = code; s->failure.step = step; s->failure.win32_error = result.win32_error;
    s->failure.api_pending = result.disposition == HOST_API_PENDING; atomic_store(&s->state, 3); return code;
}
static host_api_result ok_result(void) { host_api_result r = { HOST_API_OK, 0 }; return r; }
static host_code begin(host_session *s, const host_invocation *v, const host_api *api) {
    int expected = 0;
    if (s == NULL) return HOST_INVALID;
    if (!atomic_compare_exchange_strong(&s->state, &expected, 1)) {
        if (expected == 1) {
            int active = 1;
            /* Linearize refusal/poison while active; do not overwrite a
               concurrent successful terminal publication with a stale store. */
            if (atomic_compare_exchange_strong(&s->state, &active, 3)) return HOST_REENTERED;
        }
        return HOST_CONSUMED;
    }
    if (!host_invocation_valid(v)) return fail(s, HOST_INVALID, HOST_AT_ADMISSION, ok_result());
    s->invocation = *v;
    if (api == NULL || api->now_ms == NULL || api->guard == NULL || api->set_cwd == NULL || api->read_cwd == NULL ||
        api->set_dll_policy == NULL || api->replace_environment == NULL || api->read_environment == NULL)
        return fail(s, HOST_MISSING_API, HOST_AT_ADMISSION, ok_result());
    return HOST_OK;
}
static host_code gate(host_session *s, const host_api *api, host_step step) {
    uint64_t before, after; host_api_result r;
    if (atomic_load(&s->state) != 1) return fail(s, HOST_REENTERED, step, ok_result());
    before = api->now_ms(api->context);
    if (atomic_load(&s->state) != 1) return fail(s, HOST_REENTERED, step, ok_result());
    if (!s->clock_started) { s->clock_started = true; s->began_ms = before; s->last_ms = before; }
    if (before < s->last_ms || before - s->began_ms >= HOST_BUDGET_MS) return fail(s, HOST_DEADLINE, step, ok_result());
    r = api->guard(api->context, step, &s->invocation, &s->start);
    if (r.disposition != HOST_API_OK) return fail(s, r.disposition == HOST_API_PENDING ? HOST_PENDING : HOST_API_FAILED, step, r);
    if (atomic_load(&s->state) != 1) return fail(s, HOST_REENTERED, step, ok_result());
    after = api->now_ms(api->context);
    if (atomic_load(&s->state) != 1) return fail(s, HOST_REENTERED, step, ok_result());
    if (after < before || after - s->began_ms >= HOST_BUDGET_MS) return fail(s, HOST_DEADLINE, step, ok_result());
    if (atomic_load(&s->state) != 1) return fail(s, HOST_REENTERED, step, ok_result());
    s->last_ms = after; return HOST_OK;
}
static host_code after_call(host_session *s, const host_api *api, host_step step, host_api_result r) {
    /* Preserve a returned raw failure rather than manufacture cancellation or
       continue status/cleanup callbacks after a failed/pending operation. */
    if (r.disposition != HOST_API_OK) return fail(s, r.disposition == HOST_API_PENDING ? HOST_PENDING : HOST_API_FAILED, step, r);
    return gate(s, api, step);
}
static uint32_t remaining(const host_session *s) { return (uint32_t)(HOST_BUDGET_MS - (s->last_ms - s->began_ms)); }
static host_code prepare(host_session *s, const host_api *api) {
    uint16_t expected[HOST_ENV_CAP], observed[HOST_ENV_CAP]; char cwd[HOST_PATH_CAP]; size_t expected_count = 0, observed_count = 0;
    host_code code; host_api_result r;
    if (!host_build_environment(s->invocation.role, expected, HOST_ENV_CAP, &expected_count)) return fail(s, HOST_INVALID, HOST_AT_ENV_SET, ok_result());
    if ((code = gate(s, api, HOST_AT_CWD_SET)) != HOST_OK) return code;
    s->failure.cwd_may_have_changed = true; r = api->set_cwd(api->context, HOST_BIN);
    if ((code = after_call(s, api, HOST_AT_CWD_SET, r)) != HOST_OK) return code;
    if ((code = gate(s, api, HOST_AT_CWD_READ)) != HOST_OK) return code;
    memset(cwd, 0xff, sizeof cwd); r = api->read_cwd(api->context, cwd, sizeof cwd);
    if ((code = after_call(s, api, HOST_AT_CWD_READ, r)) != HOST_OK) return code;
    if (!exact(cwd, HOST_BIN)) return fail(s, HOST_BAD_READBACK, HOST_AT_CWD_READ, ok_result());
    if ((code = gate(s, api, HOST_AT_DLL_POLICY)) != HOST_OK) return code;
    s->failure.dll_policy_may_have_changed = true; r = api->set_dll_policy(api->context, 0x800u);
    if ((code = after_call(s, api, HOST_AT_DLL_POLICY, r)) != HOST_OK) return code;
    if ((code = gate(s, api, HOST_AT_ENV_SET)) != HOST_OK) return code;
    s->failure.environment_may_have_changed = true; r = api->replace_environment(api->context, expected, expected_count);
    if ((code = after_call(s, api, HOST_AT_ENV_SET, r)) != HOST_OK) return code;
    /* Read the whole block AFTER cwd/search staging; no inherited hidden drive
       variables, unsorted duplicates or trailing data can be silently adopted. */
    if ((code = gate(s, api, HOST_AT_ENV_READ)) != HOST_OK) return code;
    memset(observed, 0xff, sizeof observed); r = api->read_environment(api->context, observed, HOST_ENV_CAP, &observed_count);
    if ((code = after_call(s, api, HOST_AT_ENV_READ, r)) != HOST_OK) return code;
    if (!host_validate_environment(s->invocation.role, observed, observed_count)) return fail(s, HOST_BAD_READBACK, HOST_AT_ENV_READ, ok_result());
    return HOST_OK;
}
static host_code publish(host_session *s, const host_api *api) {
    int expected = 1; host_code code = gate(s, api, HOST_AT_PUBLICATION);
    if (code != HOST_OK) return code;
    if (!atomic_compare_exchange_strong(&s->state, &expected, 2)) return fail(s, HOST_REENTERED, HOST_AT_PUBLICATION, ok_result());
    return HOST_OK;
}
host_code host_prepare_process(host_session *s, const host_invocation *v, const host_api *api) {
    host_api snapshot;
    if (api != NULL) { snapshot = *api; api = &snapshot; }
    host_code code = begin(s, v, api);
    if (code != HOST_OK) return code;
    if (s->invocation.role != HOST_OWNER && s->invocation.role != HOST_USER)
        return fail(s, HOST_INVALID, HOST_AT_ADMISSION, ok_result());
    if ((code = prepare(s, api)) != HOST_OK) return code;
    return publish(s, api);
}
static bool grants_match(const host_session *s, const host_grant *g) {
    return host_invocation_valid(&g->invocation) && host_start_valid(g->invocation.role, &g->start) &&
        g->invocation.role == s->invocation.role && g->start.stage == s->start.stage &&
        strcmp(g->invocation.attempt, s->invocation.attempt) == 0 && strcmp(g->invocation.plan_sha256, s->invocation.plan_sha256) == 0 &&
        strcmp(g->invocation.approval_sha256, s->invocation.approval_sha256) == 0 && strcmp(g->invocation.source_sha256, s->invocation.source_sha256) == 0 &&
        strcmp(g->invocation.run_id, s->invocation.run_id) == 0 && strcmp(g->invocation.nonce, s->invocation.nonce) == 0 &&
        strcmp(g->start.run_id, s->start.run_id) == 0 && strcmp(g->start.nonce, s->start.nonce) == 0;
}
static host_code status(host_session *s, const host_api *api, host_step step, uint32_t state, uint32_t checkpoint, uint32_t hint) {
    host_code code = gate(s, api, step); host_api_result r;
    if (code != HOST_OK) return code;
    s->failure.status_may_have_changed = true;
    r = api->report_status(api->context, s->status_handle, state, 0, checkpoint, hint);
    return after_call(s, api, step, r);
}
host_code host_service_sequence(host_session *s, const host_invocation *v, const host_service_start *start, const host_api *api) {
    host_api snapshot;
    if (api != NULL) { snapshot = *api; api = &snapshot; }
    host_code code = begin(s, v, api); host_api_result r; host_grant grant;
    if (code != HOST_OK) return code;
    if (!host_start_valid(s->invocation.role, start)) return fail(s, HOST_INVALID, HOST_AT_ADMISSION, ok_result());
    s->start = *start;
    if (api->register_handler == NULL || api->report_status == NULL || api->bootstrap_waiting == NULL ||
        api->await_grant == NULL || api->granted_work == NULL || api->join == NULL)
        return fail(s, HOST_MISSING_API, HOST_AT_ADMISSION, ok_result());
    if ((code = gate(s, api, HOST_AT_REGISTER)) != HOST_OK) return code;
    r = api->register_handler(api->context, s->invocation.role == HOST_SETUP_ROLE ? HOST_SETUP : HOST_GUARDIAN, &s->status_handle);
    if ((code = after_call(s, api, HOST_AT_REGISTER, r)) != HOST_OK) return code;
    if (s->status_handle == 0) return fail(s, HOST_BAD_READBACK, HOST_AT_REGISTER, ok_result());
    if ((code = status(s, api, HOST_AT_START_PENDING, 2, 1, 5000)) != HOST_OK) return code;
    if ((code = prepare(s, api)) != HOST_OK) return code;
    /* Owner can require SCM RUNNING/PID before connecting bootstrap. RUNNING
       means waiting with ControlsAccepted=0, never authority to perform work. */
    if ((code = status(s, api, HOST_AT_RUNNING, 4, 0, 0)) != HOST_OK) return code;
    if ((code = gate(s, api, HOST_AT_BOOTSTRAP_WAITING)) != HOST_OK) return code;
    r = api->bootstrap_waiting(api->context, &s->invocation, &s->start);
    if ((code = after_call(s, api, HOST_AT_BOOTSTRAP_WAITING, r)) != HOST_OK) return code;
    if ((code = gate(s, api, HOST_AT_AWAIT_GRANT)) != HOST_OK) return code;
    memset(&grant, 0, sizeof grant); r = api->await_grant(api->context, remaining(s), &grant);
    if ((code = after_call(s, api, HOST_AT_AWAIT_GRANT, r)) != HOST_OK) return code;
    if (!grants_match(s, &grant)) return fail(s, HOST_BAD_GRANT, HOST_AT_AWAIT_GRANT, ok_result());
    s->model_grant_matched = true;
    if ((code = gate(s, api, HOST_AT_GRANTED_WORK)) != HOST_OK) return code;
    s->failure.work_call_entered = true; r = api->granted_work(api->context, &grant);
    if ((code = after_call(s, api, HOST_AT_GRANTED_WORK, r)) != HOST_OK) return code;
    if ((code = gate(s, api, HOST_AT_JOIN)) != HOST_OK) return code;
    r = api->join(api->context, remaining(s));
    if ((code = after_call(s, api, HOST_AT_JOIN, r)) != HOST_OK) return code;
    s->failure.join_completed = true;
    if ((code = status(s, api, HOST_AT_STOPPED, 1, 0, 0)) != HOST_OK) return code;
    return publish(s, api);
}
