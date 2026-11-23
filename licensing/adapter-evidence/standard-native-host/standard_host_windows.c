#include "standard_host.h"
#include <string.h>

/* Compile-only process adapters. CLOSED main never constructs this table.
   This is not custody, approval, actual loader evidence, or a service binding.
   Imports/TLS/CRT already ran before main; DLL search policy is prospective,
   and later explicit LoadLibraryEx flags can override default search policy.
   We do not read the CRT's potentially cached getenv/_environ view. */
#if defined(COMPILE_ONLY_STANDARD_HOST_NATIVE_V1) && defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

_Static_assert(sizeof(WCHAR) == sizeof(uint16_t), "Windows UTF-16 unit width");
static host_api_result native_result(bool success) {
    host_api_result result = { success ? HOST_API_OK : HOST_API_ERROR, success ? 0u : (uint32_t)GetLastError() };
    return result;
}
static host_api_result invalid(void) {
    host_api_result result = { HOST_API_ERROR, ERROR_INVALID_PARAMETER }; return result;
}
static bool widen(const char *text, WCHAR *out, size_t cap) {
    size_t i;
    if (text == NULL || out == NULL) return false;
    for (i = 0; i < cap; ++i) {
        unsigned char c = (unsigned char)text[i];
        if (c == 0) { out[i] = 0; return true; }
        if (c < 32u || c > 126u) return false;
        out[i] = (WCHAR)c;
    }
    return false;
}
static host_api_result native_set_cwd(void *context, const char *path) {
    WCHAR wide[HOST_PATH_CAP]; (void)context;
    if (path == NULL || strcmp(path, HOST_BIN) != 0 || !widen(path, wide, HOST_PATH_CAP)) return invalid();
    return native_result(SetCurrentDirectoryW(wide) != 0);
}
static host_api_result native_read_cwd(void *context, char *out, size_t cap) {
    WCHAR wide[HOST_PATH_CAP]; DWORD count; size_t i; (void)context;
    if (out == NULL || cap == 0 || cap > HOST_PATH_CAP) return invalid();
    count = GetCurrentDirectoryW(HOST_PATH_CAP, wide);
    if (count == 0) return native_result(false);
    if (count >= HOST_PATH_CAP || count >= cap) {
        host_api_result result = { HOST_API_ERROR, ERROR_INSUFFICIENT_BUFFER }; return result;
    }
    for (i = 0; i < count; ++i) {
        if (wide[i] < 32 || wide[i] > 126) return invalid();
        out[i] = (char)wide[i];
    }
    out[count] = 0; return native_result(true);
}
static host_api_result native_dll(void *context, uint32_t flags) {
    (void)context;
    if (flags != 0x800u) return invalid();
    return native_result(SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32) != 0);
}
static host_api_result native_replace(void *context, const uint16_t *block, size_t count) {
    host_role role; bool admitted = false; (void)context;
    for (role = HOST_OWNER; role <= HOST_GUARDIAN_ROLE; role = (host_role)(role + 1))
        if (host_validate_environment(role, block, count)) admitted = true;
    if (!admitted) return invalid();
    /* Windows replaces this process's entire block, not the system/user block. */
    return native_result(SetEnvironmentStringsW((LPWCH)(const void *)block) != 0);
}
static host_api_result native_read_environment(void *context, uint16_t *out, size_t cap, size_t *written) {
    LPWCH block; size_t i; bool found = false; host_api_result result; (void)context;
    if (out == NULL || written == NULL || cap < 2u || cap > HOST_ENV_CAP) return invalid();
    block = GetEnvironmentStringsW();
    if (block == NULL) return native_result(false);
    for (i = 0; i + 1u < cap; ++i) {
        if (block[i] == 0 && block[i + 1u] == 0) { i += 2u; found = true; break; }
    }
    if (found) { memcpy(out, block, i * sizeof out[0]); *written = i; }
    /* Always free the API allocation; no adoption of a truncated snapshot. */
    result = native_result(FreeEnvironmentStringsW(block) != 0);
    if (result.disposition != HOST_API_OK) return result;
    if (!found) { result.disposition = HOST_API_ERROR; result.win32_error = ERROR_INSUFFICIENT_BUFFER; }
    return result;
}
bool host_windows_compile_only_api(host_api *out, const host_api *hooks) {
    host_api value;
    if (out == NULL || hooks == NULL || hooks->now_ms == NULL || hooks->guard == NULL) return false;
    value = *hooks;
    value.set_cwd = native_set_cwd; value.read_cwd = native_read_cwd; value.set_dll_policy = native_dll;
    value.replace_environment = native_replace; value.read_environment = native_read_environment;
    /* No RegisterServiceCtrlHandler/ServiceMain/dispatcher implementation yet. */
    value.register_handler = NULL; value.report_status = NULL;
    *out = value; return true; /* Assignment only, no Win32 invocation. */
}
#else
bool host_windows_compile_only_api(host_api *out, const host_api *hooks) {
    (void)out; (void)hooks; return false;
}
#endif

host_code host_windows_compile_only_dispatch(const host_invocation *invocation, const host_api *hooks) {
    (void)invocation; (void)hooks;
    /* Explicitly ABSENT, even under the native compile symbol. No fallback to
       console preparation or child process, and no actual SCM call. */
    return HOST_MISSING_API;
}
