#include "standard_loader.h"
#include <string.h>

/* Compile-only actual adapter. CLOSED main never constructs or calls it.
   File identity/custody and fresh V2 authorization are mandatory trusted hooks,
   not this module's string comparisons. Initial imports/CRT have already run.
   Initialization may execute hostpolicy; delegate/entry resolution can execute
   CLR/component initialization. Only invoking the resolved entry is absent. */
#if defined(COMPILE_ONLY_STANDARD_LOADER_NATIVE_V1) && defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wchar.h>
#include <hostfxr.h>
#include <coreclr_delegates.h>
_Static_assert(sizeof(char_t)==2u,"Pinned Windows hostfxr UTF-16 ABI");
_Static_assert(sizeof(FARPROC)==sizeof(uintptr_t),"Windows function representation");
_Static_assert(sizeof(hostfxr_initialize_for_runtime_config_fn)==sizeof(uintptr_t),"hostfxr ABI width");
_Static_assert(sizeof(load_assembly_and_get_function_pointer_fn)==sizeof(void *),"CoreCLR delegate width");
static loader_api_result win_result(bool success) {
    loader_api_result r={success?LOADER_API_OK:LOADER_API_ERROR,success?0u:(uint32_t)GetLastError(),false,0};return r;
}
static loader_api_result invalid(void) { loader_api_result r={LOADER_API_ERROR,ERROR_INVALID_PARAMETER,false,0};return r; }
static loader_api_result host_result(int32_t status) { loader_api_result r={LOADER_API_OK,0,true,status};return r; }
static bool widen(const char *v,char_t *out,size_t cap) {
    size_t i;if(v==NULL)return false;
    for(i=0;i<cap;++i){unsigned char c=(unsigned char)v[i];if(c==0){out[i]=0;return true;}if(c<32u||c>126u)return false;out[i]=(char_t)c;}
    return false;
}
static uint64_t native_now(void *context) {
    loader_native_context *c=context;return c->hooks.now_ms(c->hooks.context);
}
static loader_api_result native_guard(void *context,loader_step step,const loader_binding *b,const loader_evidence *e) {
    loader_native_context *c=context;return c->hooks.guard(c->hooks.context,step,b,e);
}
static loader_api_result native_acquire(void *context,const loader_binding *b,uintptr_t *out) {
    loader_native_context *c=context;return c->hooks.acquire(c->hooks.context,b,out);
}
static loader_api_result native_load(void *context,const char *path,uint32_t flags,uintptr_t *out) {
    loader_native_context *c=context;char_t wide[LOADER_PATH_CAP];
    if(c==NULL||out==NULL||path==NULL||strcmp(path,LOADER_FXR)!=0||flags!=0x900u||c->module!=0||!widen(path,wide,LOADER_PATH_CAP))return invalid();
    c->module=(uintptr_t)LoadLibraryExW((LPCWSTR)wide,NULL,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_SYSTEM32);
    *out=c->module;return win_result(c->module!=0);
}
static loader_api_result native_observe(void *context,uintptr_t module,char *out,size_t cap) {
    loader_native_context *c=context;WCHAR wide[LOADER_PATH_CAP];DWORD n;size_t i;
    if(c==NULL||module==0||module!=c->module||out==NULL||cap==0||cap>LOADER_PATH_CAP)return invalid();
    n=GetModuleFileNameW((HMODULE)module,wide,LOADER_PATH_CAP);
    if(n==0)return win_result(false);
    if(n>=LOADER_PATH_CAP||n>=cap){loader_api_result r={LOADER_API_ERROR,ERROR_INSUFFICIENT_BUFFER,false,0};return r;}
    for(i=0;i<n;++i){if(wide[i]<32||wide[i]>126)return invalid();out[i]=(char)wide[i];}out[n]=0;
    return win_result(true);
}
static loader_api_result native_exports(void *context,uintptr_t module,uintptr_t *addresses,uintptr_t *owners) {
    loader_native_context *c=context;size_t i;
    if(c==NULL||module==0||module!=c->module||addresses==NULL||owners==NULL||c->exports_ready)return invalid();
    for(i=0;i<4u;++i) {
        FARPROC proc=GetProcAddress((HMODULE)module,loader_export_name(i));HMODULE owner=NULL;
        if(proc==NULL)return win_result(false);
        memcpy(&addresses[i],&proc,sizeof proc);c->exports[i]=addresses[i];
        if(!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
            (LPCWSTR)(const void *)addresses[i],&owner))return win_result(false);
        owners[i]=(uintptr_t)owner;
        if(owners[i]!=module)return invalid();
    }
    c->exports_ready=true;return win_result(true);
}
static loader_api_result native_initialize(void *context,const char *config,const char *image,const char *root,void **out) {
    loader_native_context *c=context;hostfxr_initialize_for_runtime_config_fn fn;
    int32_t status;
    char_t wc[LOADER_PATH_CAP],wi[LOADER_PATH_CAP],wr[LOADER_PATH_CAP];struct hostfxr_initialize_parameters p;
    if(c==NULL||!c->exports_ready||c->exports[0]==0||c->host_context!=NULL||
        out==NULL||config==NULL||image==NULL||root==NULL||
        strcmp(config,LOADER_CONFIG)!=0||strcmp(image,LOADER_IMAGE)!=0||strcmp(root,LOADER_DOTNET)!=0||
        !widen(config,wc,LOADER_PATH_CAP)||!widen(image,wi,LOADER_PATH_CAP)||!widen(root,wr,LOADER_PATH_CAP))return invalid();
    memcpy(&fn,&c->exports[0],sizeof fn);p.size=sizeof p;p.host_path=wi;p.dotnet_root=wr;
    status=fn(wc,&p,out);
    if(status==0)c->host_context=*out;
    return host_result(status); /* Caller session owns the output slot. */
}
static loader_api_result native_properties(void *context,void *host,size_t *count,const uint16_t **keys,const uint16_t **values) {
    loader_native_context *c=context;hostfxr_get_runtime_properties_fn fn;int32_t status;size_t i,capacity;
    const char_t *native_keys[LOADER_PROPERTY_CAP]={NULL},*native_values[LOADER_PROPERTY_CAP]={NULL};
    if(c==NULL||!c->exports_ready||c->exports[1]==0||host==NULL||host!=c->host_context||
        count==NULL||*count>LOADER_PROPERTY_CAP||((keys==NULL)!=(values==NULL)))return invalid();
    memcpy(&fn,&c->exports[1],sizeof fn);capacity=*count;
    status=fn(host,count,keys==NULL?NULL:native_keys,values==NULL?NULL:native_values);
    if(keys!=NULL && *count<=capacity)for(i=0;i<*count;++i) {
        keys[i]=(const uint16_t *)(const void *)native_keys[i];values[i]=(const uint16_t *)(const void *)native_values[i];
    }
    return host_result(status);
}
static loader_api_result native_delegate(void *context,void *host,uint32_t type,void **out) {
    loader_native_context *c=context;hostfxr_get_runtime_delegate_fn fn;int32_t status;
    if(c==NULL||!c->exports_ready||c->exports[2]==0||host==NULL||host!=c->host_context||
        out==NULL||type!=5u||c->runtime_delegate!=NULL)return invalid();
    memcpy(&fn,&c->exports[2],sizeof fn);
    status=fn(host,hdt_load_assembly_and_get_function_pointer,out);
    if(status==0)c->runtime_delegate=*out;
    return host_result(status);
}
static loader_api_result native_entry(void *context,void *runtime_delegate,const char *assembly,const char *type,const char *method,void **out) {
    loader_native_context *c=context;
    load_assembly_and_get_function_pointer_fn fn;char_t wa[LOADER_PATH_CAP],wt[LOADER_PATH_CAP],wm[LOADER_PATH_CAP];
    if(c==NULL||c->module==0||!c->exports_ready||c->exports[2]==0||
        c->host_context==NULL||runtime_delegate==NULL||
        runtime_delegate!=c->runtime_delegate||out==NULL||assembly==NULL||type==NULL||method==NULL||
        strcmp(assembly,LOADER_ASSEMBLY)!=0||strcmp(type,LOADER_TYPE)!=0||strcmp(method,LOADER_METHOD)!=0||
        !widen(assembly,wa,LOADER_PATH_CAP)||!widen(type,wt,LOADER_PATH_CAP)||!widen(method,wm,LOADER_PATH_CAP))return invalid();
    memcpy(&fn,&runtime_delegate,sizeof fn);
    return host_result(fn(wa,wt,wm,NULL,NULL,out)); /* Resolve only. NEVER invoke out. */
}
bool loader_windows_compile_only_api(loader_api *out,loader_native_context *storage,const loader_trusted_hooks *hooks) {
    loader_api a;int expected=0;
    if(out==NULL||storage==NULL||hooks==NULL||hooks->now_ms==NULL||hooks->guard==NULL||hooks->acquire==NULL)return false;
    if(!atomic_compare_exchange_strong(&storage->constructed,&expected,1))return false;
    storage->hooks=*hooks;storage->module=0;memset(storage->exports,0,sizeof storage->exports);
    storage->exports_ready=false;storage->host_context=NULL;storage->runtime_delegate=NULL;memset(&a,0,sizeof a);
    a.context=storage;a.now_ms=native_now;a.guard=native_guard;a.acquire=native_acquire;
    a.load=native_load;a.observe_module=native_observe;a.exports=native_exports;a.initialize=native_initialize;
    a.properties=native_properties;a.get_delegate=native_delegate;a.resolve_entry=native_entry;*out=a;return true;
}
#else
bool loader_windows_compile_only_api(loader_api *out,loader_native_context *storage,const loader_trusted_hooks *hooks) {
    (void)out;(void)storage;(void)hooks;return false;
}
#endif
