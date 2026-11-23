#include "standard_host.h"
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
    size_t checks = 0; int result;
    /* Every native/future role entry stays CLOSED before parsing or constructing
       a native API, including COMPILE_ONLY_STANDARD_HOST_NATIVE_V1 builds. */
    if (argc != 2 || argv == NULL || argv[1] == NULL || strcmp(argv[1], "--self-test") != 0) {
        fputs("STANDARD_NATIVE_HOST_ENTRY_CLOSED\n", stderr); return 2;
    }
    result = host_run_pure_tests(&checks); /* Injected portable fakes ONLY. */
    if (result != 0) {
        printf("{\"schema\":\"%s\",\"status\":\"FAIL\",\"checks\":%zu}\n", HOST_SCHEMA, checks); return 1;
    }
    printf("{\"schema\":\"%s\",\"status\":\"PASS\",\"checks\":%zu,\"nativeEffects\":false,\"clrImplemented\":false,"
        "\"scmPhysicalProven\":false,\"bootstrapAccepted\":false,\"loadedModulesAttested\":false,\"securityAccepted\":false,"
        "\"productionAccepted\":false,\"lic008Closed\":false}\n", HOST_SCHEMA, checks);
    return 0;
}
