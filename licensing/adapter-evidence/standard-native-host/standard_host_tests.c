#include "standard_host.h"
#include <stdio.h>
#include <string.h>

/* Entire call graph is portable injected fakes. No native factory, Win32,
   dispatcher, environment access, account, key, process or CLR API is called. */
static size_t check_count;
#define T(x) do { ++check_count; if (!(x)) { fprintf(stderr, "PURE_TEST_FAILED:%d\n", __LINE__); return false; } } while (0)

typedef struct {
    host_session session; host_invocation invocation; host_service_start start; host_api api;
    host_grant grant; uint64_t clock; unsigned clock_calls, guard_calls, calls;
    unsigned fail_at, pending_at, expire_at, reenter_at, guard_fail_at, guard_pending_at,
        guard_reenter_at, clock_reenter_at, clock_rollback_at, mutate_at;
    uint32_t raw_error; unsigned env_mode, grant_mode; bool wrong_cwd, zero_handle, bad_contract;
    unsigned log[32]; uint32_t status[3], accepted[3]; unsigned statuses;
    char cwd[HOST_PATH_CAP]; uint16_t environment[HOST_ENV_CAP]; size_t environment_units;
    uint32_t await_budget, join_budget; host_code nested;
} fake;

static host_api_result result(host_api_disposition disposition, uint32_t error) {
    host_api_result r = { disposition, error }; return r;
}
static host_invocation invocation(host_role role) {
    host_invocation v; memset(&v, 0, sizeof v); v.role = role;
    memset(v.attempt, 'a', 32); memset(v.plan_sha256, 'b', 64);
    memset(v.approval_sha256, 'c', 64); memset(v.source_sha256, 'd', 64);
    if (role == HOST_USER) { memset(v.run_id, 'e', 32); memset(v.nonce, 'f', 64); }
    return v;
}
static host_service_start start_value(host_role role) {
    host_service_start v; memset(&v, 0, sizeof v);
    v.stage = role == HOST_SETUP_ROLE ? HOST_STAGE_SETUP : HOST_STAGE_GUARDIAN_BEFORE;
    memset(v.run_id, 'e', 32); memset(v.nonce, 'f', 64); return v;
}
static void reenter(fake *f) { f->nested = host_prepare_process(&f->session, &f->invocation, &f->api); }
static uint64_t now(void *context) {
    fake *f = context; ++f->clock_calls;
    if (f->clock_reenter_at == f->clock_calls) reenter(f);
    if (f->clock_rollback_at == f->clock_calls) return f->clock - 1u;
    return f->clock;
}
static host_api_result guard(void *context, host_step step, const host_invocation *v, const host_service_start *s) {
    fake *f = context; (void)step; (void)s; ++f->guard_calls;
    if (v->role != f->grant.invocation.role || strcmp(v->attempt, f->grant.invocation.attempt) != 0 ||
        strcmp(v->run_id, f->grant.invocation.run_id) != 0 ||
        strcmp(v->nonce, f->grant.invocation.nonce) != 0) f->bad_contract = true;
    if (f->mutate_at == f->guard_calls) {
        f->invocation.role = HOST_OWNER; f->invocation.attempt[0] = '0';
        f->start.nonce[0] = '0'; f->api.guard = NULL; f->api.set_cwd = NULL;
    }
    if (f->guard_reenter_at == f->guard_calls) reenter(f);
    if (f->guard_pending_at == f->guard_calls) return result(HOST_API_PENDING, f->raw_error);
    if (f->guard_fail_at == f->guard_calls) return result(HOST_API_ERROR, f->raw_error);
    return result(HOST_API_OK, 0);
}
static host_api_result event(fake *f, unsigned tag) {
    ++f->calls; if (f->calls <= 32u) f->log[f->calls - 1u] = tag; else f->bad_contract = true;
    if (f->expire_at == f->calls) f->clock += HOST_BUDGET_MS;
    if (f->reenter_at == f->calls) reenter(f);
    if (f->pending_at == f->calls) return result(HOST_API_PENDING, f->raw_error);
    if (f->fail_at == f->calls) return result(HOST_API_ERROR, f->raw_error);
    return result(HOST_API_OK, 0);
}
static host_api_result set_cwd(void *context, const char *path) {
    fake *f = context;
    if (strcmp(path, HOST_BIN) != 0) f->bad_contract = true;
    memcpy(f->cwd, path, strlen(path) + 1u); return event(f, 3);
}
static host_api_result read_cwd(void *context, char *out, size_t cap) {
    fake *f = context; const char *value = f->wrong_cwd ? "C:\\Unexpected" : f->cwd;
    if (strlen(value) + 1u > cap) return result(HOST_API_ERROR, 122);
    memcpy(out, value, strlen(value) + 1u); return event(f, 4);
}
static host_api_result dll(void *context, uint32_t flags) {
    fake *f = context; if (flags != 0x800u) f->bad_contract = true; return event(f, 5);
}
static host_api_result replace(void *context, const uint16_t *block, size_t count) {
    fake *f = context;
    if (count > HOST_ENV_CAP || !host_validate_environment(f->grant.invocation.role, block, count)) return result(HOST_API_ERROR, 87);
    /* Detached fake state owns a copy, including when event returns PENDING.
       It never retains a core stack pointer for access after callback return. */
    memcpy(f->environment, block, count * sizeof block[0]); f->environment_units = count;
    return event(f, 6);
}
static host_api_result read_environment(void *context, uint16_t *out, size_t cap, size_t *written) {
    fake *f = context;
    if (cap < f->environment_units) return result(HOST_API_ERROR, 122);
    memcpy(out, f->environment, f->environment_units * sizeof out[0]); *written = f->environment_units;
    if (f->env_mode == 1) out[0] = 'X';
    if (f->env_mode == 2) out[*written - 1u] = 'X';
    if (f->env_mode == 3) --*written;
    if (f->env_mode == 4) *written = HOST_ENV_CAP + 1u;
    return event(f, 7);
}
static host_api_result register_handler(void *context, const char *name, uintptr_t *handle) {
    fake *f = context;
    if (strcmp(name, f->grant.invocation.role == HOST_SETUP_ROLE ? HOST_SETUP : HOST_GUARDIAN) != 0) f->bad_contract = true;
    *handle = f->zero_handle ? 0 : 123; return event(f, 1);
}
static host_api_result report(void *context, uintptr_t handle, uint32_t state, uint32_t accepted, uint32_t checkpoint, uint32_t hint) {
    fake *f = context; unsigned tag;
    if (handle != 123 || accepted != 0 || f->statuses >= 3) f->bad_contract = true;
    if (f->statuses < 3) { f->status[f->statuses] = state; f->accepted[f->statuses] = accepted; ++f->statuses; }
    if (state == 2) { tag = 2; if (checkpoint != 1 || hint != 5000) f->bad_contract = true; }
    else if (state == 4) { tag = 8; if (checkpoint != 0 || hint != 0) f->bad_contract = true; }
    else if (state == 1) { tag = 13; if (checkpoint != 0 || hint != 0) f->bad_contract = true; }
    else { tag = 99; f->bad_contract = true; }
    return event(f, tag);
}
static host_api_result bootstrap(void *context, const host_invocation *v, const host_service_start *s) {
    fake *f = context;
    if (f->statuses != 2 || f->status[1] != 4 || v->role != f->grant.invocation.role || s->stage != f->grant.start.stage) f->bad_contract = true;
    return event(f, 9);
}
static host_api_result await_grant(void *context, uint32_t budget, host_grant *out) {
    fake *f = context; f->await_budget = budget; *out = f->grant;
    switch (f->grant_mode) {
        case 1: out->invocation.role = HOST_OWNER; break;
        case 2: out->invocation.attempt[0] = '0'; break;
        case 3: out->invocation.plan_sha256[0] = '0'; break;
        case 4: out->invocation.approval_sha256[0] = '0'; break;
        case 5: out->invocation.source_sha256[0] = '0'; break;
        case 6: out->start.stage = HOST_STAGE_GUARDIAN_AFTER; break;
        case 7: out->start.run_id[0] = '0'; break;
        case 8: out->start.nonce[0] = '0'; break;
        case 9: memset(out->start.nonce, 'f', sizeof out->start.nonce); break;
        case 10: out->invocation.run_id[32] = '1'; break;
        case 11: out->invocation.nonce[64] = '1'; break;
        default: break;
    }
    return event(f, 10);
}
static host_api_result work(void *context, const host_grant *grant) {
    fake *f = context;
    if (!f->session.model_grant_matched || grant->start.stage != f->grant.start.stage) f->bad_contract = true;
    return event(f, 11);
}
static host_api_result join_work(void *context, uint32_t budget) {
    fake *f = context; f->join_budget = budget;
    if (!f->session.failure.work_call_entered) f->bad_contract = true;
    return event(f, 12);
}
static void init(fake *f, host_role role) {
    memset(f, 0, sizeof *f); host_session_init(&f->session);
    f->invocation = invocation(role); f->start = start_value(role);
    f->grant.invocation = f->invocation; f->grant.start = f->start; f->clock = 1000; f->raw_error = 0xdeadbeefu;
    f->api.context = f; f->api.now_ms = now; f->api.guard = guard;
    f->api.set_cwd = set_cwd; f->api.read_cwd = read_cwd; f->api.set_dll_policy = dll;
    f->api.replace_environment = replace; f->api.read_environment = read_environment;
    f->api.register_handler = register_handler; f->api.report_status = report;
    f->api.bootstrap_waiting = bootstrap; f->api.await_grant = await_grant;
    f->api.granted_work = work; f->api.join = join_work;
}
static host_code service(fake *f) { return host_service_sequence(&f->session, &f->invocation, &f->start, &f->api); }

static bool parser_tests(void) {
    host_invocation v, before, owner_value, user_value, service_value, dirty; host_service_start s, prior;
    char a[33], b[65], c[65], d[65], run_id[33], nonce[65], long_run[34], long_nonce[66];
    const char *owner[10], *user[14], *svc[12], *run[7], *padded[16], *owner_extra[14], *svc_extra[14]; size_t i;
    memset(a, 'a', 32); a[32] = 0; memset(b, 'b', 64); b[64] = 0;
    memset(c, 'c', 64); c[64] = 0; memset(d, 'd', 64); d[64] = 0;
    memset(run_id, 'e', 32); run_id[32] = 0; memset(nonce, 'f', 64); nonce[64] = 0;
    memset(long_run, 'e', 33); long_run[33] = 0; memset(long_nonce, 'f', 65); long_nonce[65] = 0;
    { const char *x[] = { HOST_IMAGE,"--owner","--attempt",a,"--plan-sha256",b,"--approval-sha256",c,"--source-set-sha256",d };
      memcpy(owner, x, sizeof x); }
    { const char *x[] = { HOST_IMAGE,"--user","--attempt",a,"--plan-sha256",b,"--approval-sha256",c,"--source-set-sha256",d,
          "--run-id",run_id,"--nonce",nonce }; memcpy(user, x, sizeof x); }
    { const char *x[] = { HOST_IMAGE,"--service","--role","Setup","--attempt",a,"--plan-sha256",b,"--approval-sha256",c,"--source-set-sha256",d };
      memcpy(svc, x, sizeof x); }
    { const char *x[] = { HOST_SETUP,"--stage","setup","--run-id",a,"--nonce",nonce }; memcpy(run, x, sizeof x); }
    T(HOST_STAGE_SETUP == 1 && HOST_STAGE_GUARDIAN_BEFORE == 2 && HOST_STAGE_GUARDIAN_AFTER == 4);
    T(host_parse_invocation(10, owner, &v)); T(v.role == HOST_OWNER && host_invocation_valid(&v)); owner_value = v;
    T(v.run_id[0] == 0 && v.run_id[32] == 0 && v.nonce[0] == 0 && v.nonce[64] == 0);
    T(host_parse_invocation(14, user, &v)); T(v.role == HOST_USER && host_invocation_valid(&v)); user_value = v;
    T(strcmp(v.run_id, run_id) == 0 && strcmp(v.nonce, nonce) == 0);
    T(host_parse_invocation(14, user, &v)); T(memcmp(&v, &user_value, sizeof v) == 0); /* shape, not replay authority */
    T(host_parse_invocation(12, svc, &v)); T(v.role == HOST_SETUP_ROLE && host_invocation_valid(&v)); service_value = v;
    T(v.run_id[0] == 0 && v.run_id[32] == 0 && v.nonce[0] == 0 && v.nonce[64] == 0);
    svc[3] = "Guardian"; T(host_parse_invocation(12, svc, &v)); T(v.role == HOST_GUARDIAN_ROLE);
    svc[3] = "Setup"; before = v;
    dirty = owner_value; dirty.run_id[32] = '1'; T(!host_invocation_valid(&dirty));
    dirty = owner_value; dirty.nonce[64] = '1'; T(!host_invocation_valid(&dirty));
    dirty = service_value; dirty.run_id[0] = '1'; T(!host_invocation_valid(&dirty));
    dirty = service_value; dirty.nonce[64] = '1'; T(!host_invocation_valid(&dirty));
    dirty = user_value; dirty.run_id[0] = 'E'; T(!host_invocation_valid(&dirty));
    dirty = user_value; dirty.nonce[0] = 'F'; T(!host_invocation_valid(&dirty));
    for (i = 0; i < 10; ++i) { const char *saved = owner[i]; owner[i] = NULL;
        T(!host_parse_invocation(10, owner, &v)); T(memcmp(&v, &before, sizeof v) == 0); owner[i] = saved; }
    for (i = 0; i < 14; ++i) { const char *saved = user[i]; user[i] = NULL;
        T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); user[i] = saved; }
    for (i = 0; i < 12; ++i) { const char *saved = svc[i]; svc[i] = "unexpected";
        T(!host_parse_invocation(12, svc, &v)); T(memcmp(&v, &before, sizeof v) == 0); svc[i] = saved; }
    for (i = 0; i < 14; ++i) padded[i] = user[i]; padded[14] = "extra"; padded[15] = "extra";
    for (i = 0; i <= 16; ++i) if (i != 10u && i != 12u && i != 14u) {
        T(!host_parse_invocation(i, padded, &v)); T(memcmp(&v, &before, sizeof v) == 0);
    }
    T(!host_parse_invocation(10, user, &v)); T(memcmp(&v, &before, sizeof v) == 0);
    T(!host_parse_invocation(12, user, &v)); T(memcmp(&v, &before, sizeof v) == 0);
    memcpy(owner_extra, user, sizeof owner_extra); owner_extra[1] = "--owner";
    T(!host_parse_invocation(12, owner_extra, &v)); T(memcmp(&v, &before, sizeof v) == 0);
    T(!host_parse_invocation(14, owner_extra, &v)); T(memcmp(&v, &before, sizeof v) == 0);
    memcpy(svc_extra, svc, sizeof svc); svc_extra[12] = "--run-id"; svc_extra[13] = run_id;
    T(!host_parse_invocation(14, svc_extra, &v)); T(memcmp(&v, &before, sizeof v) == 0);
    owner[1] = "--user"; T(!host_parse_invocation(10, owner, &v)); T(memcmp(&v, &before, sizeof v) == 0); owner[1] = "--owner";
    user[10] = "--nonce"; T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); user[10] = "--run-id";
    user[12] = "--run-id"; T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); user[12] = "--nonce";
    user[11] = long_run; T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); user[11] = run_id;
    user[13] = long_nonce; T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); user[13] = nonce;
    run_id[31] = 0; T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); run_id[31] = 'e';
    nonce[63] = 0; T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); nonce[63] = 'f';
    run_id[0] = 'E'; T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); run_id[0] = 'e';
    nonce[0] = 'F'; T(!host_parse_invocation(14, user, &v)); T(memcmp(&v, &before, sizeof v) == 0); nonce[0] = 'f';
    b[0] = 'B'; T(!host_parse_invocation(10, owner, &v)); T(memcmp(&v, &before, sizeof v) == 0); b[0] = 'b';
    a[31] = 0; T(!host_parse_invocation(10, owner, &v)); T(memcmp(&v, &before, sizeof v) == 0); a[31] = 'a';
    owner[0] = "C:\\relative\\StandardControlHost.exe"; T(!host_parse_invocation(10, owner, &v)); T(memcmp(&v, &before, sizeof v) == 0); owner[0] = HOST_IMAGE;
    T(!host_parse_invocation(10, owner, NULL)); T(!host_parse_invocation(10, NULL, &v));
    T(host_parse_service_start(HOST_SETUP_ROLE, 7, run, &s)); T(s.stage == HOST_STAGE_SETUP); prior = s;
    for (i = 0; i < 7; ++i) { const char *saved = run[i]; run[i] = NULL;
        T(!host_parse_service_start(HOST_SETUP_ROLE, 7, run, &s)); T(memcmp(&s, &prior, sizeof s) == 0); run[i] = saved; }
    T(!host_parse_service_start(HOST_OWNER, 7, run, &s)); T(!host_parse_service_start(HOST_USER, 7, run, &s));
    run[0] = HOST_GUARDIAN; run[2] = "guardian-before"; T(host_parse_service_start(HOST_GUARDIAN_ROLE, 7, run, &s));
    T(s.stage == HOST_STAGE_GUARDIAN_BEFORE && (int)s.stage == 2); run[2] = "guardian-after";
    T(host_parse_service_start(HOST_GUARDIAN_ROLE, 7, run, &s)); T(s.stage == HOST_STAGE_GUARDIAN_AFTER && (int)s.stage == 4);
    s.stage = (host_run_stage)3; T(!host_start_valid(HOST_GUARDIAN_ROLE, &s));
    T(!host_parse_service_start(HOST_SETUP_ROLE, 7, run, &s)); run[2] = "setup";
    T(!host_parse_service_start(HOST_GUARDIAN_ROLE, 7, run, &s));
    T(!host_role_valid((host_role)0)); T(!host_role_valid((host_role)5));
    T(!host_invocation_valid(NULL)); T(!host_start_valid(HOST_SETUP_ROLE, NULL));
    return true;
}
static bool environment_tests(void) {
    uint16_t block[HOST_ENV_CAP], copy[HOST_ENV_CAP]; size_t n, j, sentinel; host_role role, other;
    for (role = HOST_OWNER; role <= HOST_GUARDIAN_ROLE; role = (host_role)(role + 1)) {
        memset(block, 0x55, sizeof block);
        T(host_build_environment(role, block, HOST_ENV_CAP, &n)); T(host_validate_environment(role, block, n));
        for (other = HOST_OWNER; other <= HOST_GUARDIAN_ROLE; other = (host_role)(other + 1))
            T(host_validate_environment(other, block, n) == (other == role));
        T(!host_validate_environment(role, block, n - 1u)); T(!host_validate_environment(role, block, n + 1u));
        for (j = 0; j < n; ++j) { memcpy(copy, block, n * sizeof block[0]); copy[j] = 0xffff; T(!host_validate_environment(role, copy, n)); }
        memcpy(copy, block, n * sizeof block[0]); copy[0] = '='; T(!host_validate_environment(role, copy, n));
        copy[0] = 'd'; T(!host_validate_environment(role, copy, n)); /* noncanonical name case */
        memcpy(copy, block, n * sizeof block[0]); copy[n - 1u] = 'X'; copy[n] = 0; copy[n + 1u] = 0;
        T(!host_validate_environment(role, copy, n + 2u)); /* appended inherited field */
        sentinel = 123; T(!host_build_environment(role, copy, n - 1u, &sentinel)); T(sentinel == 123);
    }
    T(!host_build_environment((host_role)0, block, HOST_ENV_CAP, &n));
    T(!host_build_environment(HOST_OWNER, block, HOST_ENV_CAP + 1u, &n));
    T(!host_build_environment(HOST_OWNER, NULL, HOST_ENV_CAP, &n));
    T(!host_build_environment(HOST_OWNER, block, HOST_ENV_CAP, NULL));
    T(!host_validate_environment(HOST_OWNER, NULL, 2)); T(!host_validate_environment(HOST_OWNER, block, HOST_ENV_CAP + 1u));
    { const char b0[] = "A=x\0A=y\0", b1[] = "a=x\0A=y\0", b2[] = "B=x\0A=y\0", b3[] = "=C:=C:\\tmp\0",
        b4[] = "A=\0", b5[] = "A\0", b6[] = "=x\0", b7[] = "A=x\0\0B=y\0";
      const char *bad[] = { b0,b1,b2,b3,b4,b5,b6,b7 };
      const size_t lengths[] = { sizeof b0,sizeof b1,sizeof b2,sizeof b3,sizeof b4,sizeof b5,sizeof b6,sizeof b7 };
      for (j = 0; j < 8; ++j) { size_t k; for (k = 0; k < lengths[j]; ++k) copy[k] = (uint16_t)(unsigned char)bad[j][k]; T(!host_validate_environment(HOST_OWNER, copy, lengths[j])); } }
    return true;
}
static bool positive_tests(void) {
    fake f; host_role role; size_t j;
    for (role = HOST_OWNER; role <= HOST_GUARDIAN_ROLE; role = (host_role)(role + 1)) {
        init(&f, role);
        if (role == HOST_OWNER || role == HOST_USER) {
            T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_OK); T(f.calls == 5);
            for (j = 0; j < 5; ++j) T(f.log[j] == j + 3u);
            T(!f.session.model_grant_matched); T(!f.session.failure.work_call_entered); T(!f.session.failure.status_may_have_changed);
            if (role == HOST_USER) {
                T(strcmp(f.session.invocation.run_id, f.invocation.run_id) == 0);
                T(strcmp(f.session.invocation.nonce, f.invocation.nonce) == 0);
            } else T(f.session.invocation.run_id[0] == 0 && f.session.invocation.nonce[0] == 0);
        } else {
            T(service(&f) == HOST_OK); T(f.calls == 13);
            for (j = 0; j < 13; ++j) T(f.log[j] == j + 1u);
            T(f.session.model_grant_matched); T(f.session.failure.join_completed); T(f.session.failure.work_call_entered);
            T(f.statuses == 3); T(f.status[0] == 2 && f.status[1] == 4 && f.status[2] == 1);
            T(f.await_budget == HOST_BUDGET_MS); T(f.join_budget == HOST_BUDGET_MS);
        }
        T(atomic_load(&f.session.state) == 2); T(!f.bad_contract);
        T(f.session.failure.cwd_may_have_changed && f.session.failure.dll_policy_may_have_changed && f.session.failure.environment_may_have_changed);
        T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_CONSUMED);
    }
    init(&f, HOST_GUARDIAN_ROLE); f.start.stage = HOST_STAGE_GUARDIAN_AFTER; f.grant.start = f.start;
    T(service(&f) == HOST_OK); T(!f.bad_contract);
    init(&f, HOST_SETUP_ROLE); f.mutate_at = 1;
    T(service(&f) == HOST_OK); T(f.session.invocation.role == HOST_SETUP_ROLE); T(f.session.start.nonce[0] == 'f'); T(!f.bad_contract);
    init(&f, HOST_USER); f.mutate_at = 1;
    T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_OK);
    T(f.session.invocation.role == HOST_USER && f.session.invocation.run_id[0] == 'e' &&
        f.session.invocation.nonce[0] == 'f' && !f.bad_contract);
    return true;
}
static bool negative_tests(void) {
    fake f; unsigned i, mode; host_code code;
    for (i = 1; i <= 13; ++i) for (mode = 0; mode < 3; ++mode) {
        init(&f, HOST_SETUP_ROLE); f.raw_error = mode == 0 ? 0 : mode == 1 ? 5 : 997;
        if (mode == 2) f.pending_at = i; else f.fail_at = i;
        code = service(&f); T(code == (mode == 2 ? HOST_PENDING : HOST_API_FAILED));
        T(f.session.failure.win32_error == f.raw_error); T(f.session.failure.api_pending == (mode == 2));
        T(f.calls == i); T(atomic_load(&f.session.state) == 3); T(!f.bad_contract);
        T(f.session.failure.work_call_entered == (i >= 11)); T(f.session.failure.join_completed == (i == 13));
        T(service(&f) == HOST_CONSUMED); T(f.calls == i);
    }
    for (i = 1; i <= 27; ++i) for (mode = 0; mode < 2; ++mode) {
        init(&f, HOST_SETUP_ROLE); if (mode == 0) f.guard_fail_at = i; else f.guard_pending_at = i;
        T(service(&f) == (mode == 0 ? HOST_API_FAILED : HOST_PENDING));
        T(f.session.failure.win32_error == f.raw_error); T(f.guard_calls == i); T(atomic_load(&f.session.state) == 3); T(!f.bad_contract);
    }
    for (i = 1; i <= 11; ++i) {
        init(&f, HOST_GUARDIAN_ROLE); f.grant_mode = i; T(service(&f) == HOST_BAD_GRANT);
        T(f.calls == 10); T(!f.session.failure.work_call_entered); T(!f.session.model_grant_matched); T(f.statuses == 2);
    }
    for (i = 1; i <= 4; ++i) {
        init(&f, HOST_SETUP_ROLE); f.env_mode = i; T(service(&f) == HOST_BAD_READBACK); T(f.calls == 7); T(f.statuses == 1);
    }
    init(&f, HOST_SETUP_ROLE); f.wrong_cwd = true; T(service(&f) == HOST_BAD_READBACK); T(f.calls == 4); T(!f.session.failure.environment_may_have_changed);
    init(&f, HOST_SETUP_ROLE); f.zero_handle = true; T(service(&f) == HOST_BAD_READBACK); T(f.calls == 1); T(!f.session.failure.status_may_have_changed);
    init(&f, HOST_SETUP_ROLE); T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_INVALID); T(f.calls == 0);
    init(&f, HOST_GUARDIAN_ROLE); T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_INVALID); T(f.calls == 0);
    init(&f, HOST_OWNER); T(service(&f) == HOST_INVALID); T(f.calls == 0);
    init(&f, HOST_SETUP_ROLE); f.start.stage = HOST_STAGE_GUARDIAN_BEFORE; T(service(&f) == HOST_INVALID); T(f.calls == 0);
    init(&f, HOST_SETUP_ROLE); f.api.guard = NULL; T(service(&f) == HOST_MISSING_API); T(f.calls == 0);
    init(&f, HOST_SETUP_ROLE); f.api.read_environment = NULL; T(service(&f) == HOST_MISSING_API); T(f.calls == 0);
    init(&f, HOST_SETUP_ROLE); f.api.register_handler = NULL; T(service(&f) == HOST_MISSING_API); T(f.calls == 0);
    init(&f, HOST_SETUP_ROLE); f.api.join = NULL; T(service(&f) == HOST_MISSING_API); T(f.calls == 0);
    init(&f, HOST_OWNER); T(host_prepare_process(&f.session, &f.invocation, NULL) == HOST_MISSING_API); T(f.calls == 0);
    T(host_prepare_process(NULL, NULL, NULL) == HOST_INVALID);
    init(&f, HOST_OWNER); f.invocation.attempt[32] = 'a'; T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_INVALID); T(f.calls == 0);
    init(&f, HOST_OWNER); f.invocation.run_id[32] = '1'; T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_INVALID); T(f.calls == 0);
    init(&f, HOST_USER); f.invocation.run_id[31] = 0; T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_INVALID); T(f.calls == 0);
    init(&f, HOST_USER); f.invocation.nonce[63] = 0; T(host_prepare_process(&f.session, &f.invocation, &f.api) == HOST_INVALID); T(f.calls == 0);
    init(&f, HOST_SETUP_ROLE); f.invocation.nonce[64] = '1'; T(service(&f) == HOST_INVALID); T(f.calls == 0);
    return true;
}
static bool lifetime_tests(void) {
    fake f; unsigned i;
    for (i = 1; i <= 13; ++i) {
        init(&f, HOST_SETUP_ROLE); f.reenter_at = i;
        T(service(&f) == HOST_REENTERED); T(f.nested == HOST_REENTERED); T(f.calls == i); T(atomic_load(&f.session.state) == 3);
        T(service(&f) == HOST_CONSUMED);
        init(&f, HOST_SETUP_ROLE); f.expire_at = i;
        T(service(&f) == HOST_DEADLINE); T(f.calls == i); T(atomic_load(&f.session.state) == 3); T(!f.bad_contract);
    }
    for (i = 1; i <= 27; ++i) {
        init(&f, HOST_SETUP_ROLE); f.guard_reenter_at = i;
        T(service(&f) == HOST_REENTERED); T(f.nested == HOST_REENTERED); T(f.guard_calls == i); T(atomic_load(&f.session.state) == 3);
    }
    for (i = 1; i <= 54; ++i) {
        init(&f, HOST_SETUP_ROLE); f.clock_reenter_at = i;
        T(service(&f) == HOST_REENTERED); T(f.nested == HOST_REENTERED); T(f.clock_calls == i);
        T(f.guard_calls == i / 2u); T(atomic_load(&f.session.state) == 3);
    }
    for (i = 2; i <= 54; ++i) {
        init(&f, HOST_SETUP_ROLE); f.clock_rollback_at = i;
        T(service(&f) == HOST_DEADLINE); T(f.clock_calls == i); T(atomic_load(&f.session.state) == 3);
    }
    /* An owned copied environment survives a pending return; core never adopts
       it as a verified readback, retries, reports stopped, or calls join. */
    init(&f, HOST_SETUP_ROLE); f.pending_at = 6; T(service(&f) == HOST_PENDING);
    T(host_validate_environment(HOST_SETUP_ROLE, f.environment, f.environment_units));
    f.environment[0] = 'X'; T(!host_validate_environment(HOST_SETUP_ROLE, f.environment, f.environment_units));
    T(!f.session.failure.join_completed); T(f.statuses == 1); T(!f.session.failure.work_call_entered);
    return true;
}
int host_run_pure_tests(size_t *checks) {
    bool success; if (checks == NULL) return 1; check_count = 0;
    success = parser_tests() && environment_tests() && positive_tests() && negative_tests() && lifetime_tests();
    *checks = check_count; return success ? 0 : 1;
}
