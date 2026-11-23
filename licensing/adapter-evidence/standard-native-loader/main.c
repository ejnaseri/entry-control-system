#include "standard_loader.h"
#include <stdio.h>
#include <string.h>
int main(int argc,char **argv) {
    size_t checks=0;
    if(argc!=2 || argv==NULL || argv[1]==NULL || strcmp(argv[1],"--self-test")!=0) {
        fputs("STANDARD_NATIVE_LOADER_ENTRY_CLOSED\n",stderr); return 2;
    }
    if(loader_run_pure_tests(&checks)!=0) {
        printf("{\"schema\":\"%s\",\"status\":\"FAIL\",\"checks\":%zu}\n",LOADER_SCHEMA,checks); return 1;
    }
    printf("{\"schema\":\"%s\",\"status\":\"PASS\",\"checks\":%zu,\"nativeEffects\":false,"
        "\"managedEntryInvoked\":false,\"loadedModulesAttested\":false,\"bootstrapAccepted\":false,"
        "\"nativeCompatibilityProven\":false,\"securityAccepted\":false,\"productionAccepted\":false,\"lic008Closed\":false}\n",LOADER_SCHEMA,checks);
    return 0;
}
