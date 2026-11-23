#include "standard_loader.h"
#include <stdio.h>
#include <string.h>

/* All callbacks are injected. This file never constructs the real adapter
   except for testing its invalid-argument paths under the native compile flag. */
typedef struct {
    loader_session session;
    loader_binding binding;
    loader_api api;
    uint16_t keys[9][128], values[9][20000];
    char ascii[9][20000];
    size_t step_calls[LOADER_AT_PUBLICATION+1];
    size_t effect_calls[7];
    loader_step guard_error_step, callback_error_step;
    int guard_error_visit, callback_kind, bad_host_status, bad_property_count;
    bool destroy_borrowed_on_post, post_copy_seen, raw_host_error_seen;
    uint64_t ticks;
} fixture;
static fixture f;
static size_t assertions;
#define CHECK(x) do { ++assertions; if (!(x)) { \
    fprintf(stderr,"loader pure test line %d failed: %s\n",__LINE__,#x);return 1; \
} } while (0)

static loader_api_result yes(void) {
    loader_api_result r={LOADER_API_OK,0,false,0};return r;
}
static loader_api_result host(int32_t status) {
    loader_api_result r={LOADER_API_OK,0,true,status};return r;
}
static loader_api_result fault(int kind) {
    loader_api_result r={kind==2?LOADER_API_PENDING:LOADER_API_ERROR,1987u,false,0};return r;
}
static void ascii_to_utf16(const char *v,uint16_t *out,size_t cap) {
    size_t i;for(i=0;i+1u<cap && v[i];++i)out[i]=(uint8_t)v[i];out[i]=0;
}
static const char *const names[9]={
    "TRUSTED_PLATFORM_ASSEMBLIES","NATIVE_DLL_SEARCH_DIRECTORIES",
    "PLATFORM_RESOURCE_ROOTS","APP_CONTEXT_BASE_DIRECTORY","APP_CONTEXT_DEPS_FILES",
    "FX_DEPS_FILE","PROBING_DIRECTORIES","RUNTIME_IDENTIFIER","HOST_RUNTIME_CONTRACT"
};
static bool setup_properties(void) {
    size_t i,at=0,cap=sizeof f.ascii[0],n=loader_tpa_count();
    if(n!=172u)return false;
    for(i=0;i<n;++i) {
        const char *leaf=loader_tpa_leaf(i);
        size_t p=strlen(LOADER_RUNTIME "\\"),q=strlen(leaf);
        if(at+p+q+2u>cap)return false;
        memcpy(f.ascii[0]+at,LOADER_RUNTIME "\\",p);at+=p;
        memcpy(f.ascii[0]+at,leaf,q);at+=q;
        if(i+1u<n)f.ascii[0][at++]=';';
    }
    f.ascii[0][at]=0;
    strcpy(f.ascii[1],LOADER_RUNTIME);
    strcpy(f.ascii[2],LOADER_RUNTIME);
    strcpy(f.ascii[3],LOADER_BIN);
    strcpy(f.ascii[4],LOADER_DEPS);
    strcpy(f.ascii[5],LOADER_DEPS);
    f.ascii[6][0]=0;
    strcpy(f.ascii[7],"win-x64");
    strcpy(f.ascii[8],"0x1234abcd");
    for(i=0;i<9u;++i) {
        ascii_to_utf16(names[i],f.keys[i],128u);
        ascii_to_utf16(f.ascii[i],f.values[i],20000u);
    }
    return true;
}
static uint64_t fake_now(void *context) {
    fixture *p=context;return ++p->ticks;
}
static loader_api_result fake_guard(void *context,loader_step step,const loader_binding *b,const loader_evidence *e) {
    fixture *p=context;
    (void)b;
    ++p->step_calls[step];
    if(p->destroy_borrowed_on_post && step==LOADER_AT_PROPERTIES && p->step_calls[step]==2u) {
        size_t i;
        p->post_copy_seen=loader_properties_valid(e);
        for(i=0;i<9u;++i){p->keys[i][0]=0;p->values[i][0]=0;}
    }
    if(step==p->guard_error_step && (p->guard_error_visit==0 || (int)p->step_calls[step]==p->guard_error_visit))
        return fault(1);
    return yes();
}
static loader_api_result fake_acquire(void *context,const loader_binding *b,uintptr_t *out) {
    fixture *p=context;(void)b;++p->effect_calls[0];*out=11u;
    return p->callback_error_step==LOADER_AT_ACQUIRE?fault(p->callback_kind):yes();
}
static loader_api_result fake_load(void *context,const char *path,uint32_t flags,uintptr_t *out) {
    fixture *p=context;++p->effect_calls[1];
    if(strcmp(path,LOADER_FXR)!=0||flags!=0x900u)return fault(1);
    *out=12u;return p->callback_error_step==LOADER_AT_LOAD?fault(p->callback_kind):yes();
}
static loader_api_result fake_observe(void *context,uintptr_t module,char *out,size_t cap) {
    fixture *p=context;++p->effect_calls[2];
    if(module!=12u||cap<sizeof LOADER_FXR)return fault(1);
    memcpy(out,LOADER_FXR,sizeof LOADER_FXR);
    return p->callback_error_step==LOADER_AT_OBSERVE?fault(p->callback_kind):yes();
}
static loader_api_result fake_exports(void *context,uintptr_t module,uintptr_t *address,uintptr_t *owner) {
    fixture *p=context;size_t i;++p->effect_calls[3];
    if(module!=12u)return fault(1);
    for(i=0;i<4u;++i){address[i]=20u+i;owner[i]=module;}
    return p->callback_error_step==LOADER_AT_EXPORTS?fault(p->callback_kind):yes();
}
static loader_api_result fake_initialize(void *context,const char *config,const char *image,const char *root,void **out) {
    fixture *p=context;++p->effect_calls[4];
    if(strcmp(config,LOADER_CONFIG)||strcmp(image,LOADER_IMAGE)||strcmp(root,LOADER_DOTNET))return fault(1);
    *out=(void *)(uintptr_t)30u;
    if(p->callback_error_step==LOADER_AT_INITIALIZE)return fault(p->callback_kind);
    return host(p->bad_host_status==LOADER_AT_INITIALIZE?1:0);
}
static loader_api_result fake_properties(void *context,void *host_context,size_t *count,const uint16_t **keys,const uint16_t **values) {
    fixture *p=context;size_t i;++p->effect_calls[5];
    if(host_context!=(void *)(uintptr_t)30u)return fault(1);
    if(keys==NULL&&values==NULL) {
        *count=p->bad_property_count?10u:9u;
        if(p->callback_error_step==LOADER_AT_PROPERTY_COUNT)return fault(p->callback_kind);
        return host((int32_t)0x80008098u);
    }
    if(*count<9u)return fault(1);
    *count=9u;
    for(i=0;i<9u;++i){keys[i]=p->keys[i];values[i]=p->values[i];}
    if(p->callback_error_step==LOADER_AT_PROPERTIES)return fault(p->callback_kind);
    if(p->bad_host_status==LOADER_AT_PROPERTIES) {
        p->raw_host_error_seen=true;return host(2);
    }
    return host(0);
}
static loader_api_result fake_delegate(void *context,void *host_context,uint32_t type,void **out) {
    fixture *p=context;++p->effect_calls[6];
    if(host_context!=(void *)(uintptr_t)30u||type!=5u)return fault(1);
    *out=(void *)(uintptr_t)40u;
    if(p->callback_error_step==LOADER_AT_DELEGATE)return fault(p->callback_kind);
    return host(p->bad_host_status==LOADER_AT_DELEGATE?2:0);
}
static loader_api_result fake_entry(void *context,void *delegate,const char *assembly,const char *type,const char *method,void **out) {
    fixture *p=context;
    if(delegate!=(void *)(uintptr_t)40u||strcmp(assembly,LOADER_ASSEMBLY)||
        strcmp(type,LOADER_TYPE)||strcmp(method,LOADER_METHOD))return fault(1);
    *out=(void *)(uintptr_t)50u;
    if(p->callback_error_step==LOADER_AT_ENTRY)return fault(p->callback_kind);
    return host(p->bad_host_status==LOADER_AT_ENTRY?2:0);
}
static void fill_hex(char *p,size_t n,char c) { memset(p,c,n);p[n]=0; }
static bool reset_fixture(void) {
    memset(&f,0,sizeof f);loader_session_init(&f.session);
    strcpy(f.binding.profile,LOADER_PROFILE);
    strcpy(f.binding.effects,LOADER_EFFECTS);
    f.binding.role=1u;f.binding.stage=0u;
    fill_hex(f.binding.attempt,32u,'a');
    /* Owner has no run or nonce yet; memset above zeroed every array byte. */
    fill_hex(f.binding.plan_sha256,64u,'d');
    fill_hex(f.binding.approval_sha256,64u,'e');fill_hex(f.binding.source_sha256,64u,'f');
    fill_hex(f.binding.profile_sha256,64u,'0');fill_hex(f.binding.package_sha256,64u,'1');
    fill_hex(f.binding.runtime_sha256,64u,'2');fill_hex(f.binding.image_sha256,64u,'3');
    fill_hex(f.binding.assembly_sha256,64u,'4');fill_hex(f.binding.config_sha256,64u,'5');
    f.api.context=&f;f.api.now_ms=fake_now;f.api.guard=fake_guard;f.api.acquire=fake_acquire;
    f.api.load=fake_load;f.api.observe_module=fake_observe;f.api.exports=fake_exports;
    f.api.initialize=fake_initialize;f.api.properties=fake_properties;
    f.api.get_delegate=fake_delegate;f.api.resolve_entry=fake_entry;
    return setup_properties();
}
static bool reset_role(uint32_t role,uint32_t stage) {
    if(!reset_fixture())return false;
    f.binding.role=role;f.binding.stage=stage;
    if(role!=1u){fill_hex(f.binding.run_id,32u,'b');fill_hex(f.binding.nonce,64u,'c');}
    return true;
}
static int invalid_before_acquire(void) {
    CHECK(!loader_binding_valid(&f.binding));
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_INVALID);
    CHECK(f.step_calls[LOADER_AT_ACQUIRE]==0u);
    CHECK(f.effect_calls[0]==0u);
    CHECK(!f.session.failure.lease_acquire_entered);
    CHECK(atomic_load(&f.session.state)==3);
    return 0;
}
static int test_role_run_nonce_shape(void) {
    static const struct {uint32_t role,stage;} later[]={{2u,3u},{3u,1u},{4u,2u},{4u,4u}};
    size_t i;
    CHECK(reset_role(1u,0u));CHECK(loader_binding_valid(&f.binding));
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_OK);
    CHECK(f.effect_calls[0]==1u);
    CHECK(reset_role(1u,0u));f.binding.run_id[0]='a';CHECK(invalid_before_acquire()==0);
    CHECK(reset_role(1u,0u));f.binding.nonce[0]='a';CHECK(invalid_before_acquire()==0);
    CHECK(reset_role(1u,0u));f.binding.run_id[1]='f';CHECK(invalid_before_acquire()==0);
    CHECK(reset_role(1u,0u));f.binding.nonce[64]='f';CHECK(invalid_before_acquire()==0);
    for(i=0;i<sizeof later/sizeof later[0];++i) {
        CHECK(reset_role(later[i].role,later[i].stage));
        CHECK(loader_binding_valid(&f.binding));
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_OK);
        CHECK(f.effect_calls[0]==1u);
        CHECK(reset_role(later[i].role,later[i].stage));f.binding.run_id[0]=0;CHECK(invalid_before_acquire()==0);
        CHECK(reset_role(later[i].role,later[i].stage));f.binding.nonce[0]=0;CHECK(invalid_before_acquire()==0);
        CHECK(reset_role(later[i].role,later[i].stage));fill_hex(f.binding.run_id,31u,'b');CHECK(invalid_before_acquire()==0);
        CHECK(reset_role(later[i].role,later[i].stage));memset(f.binding.run_id,'b',sizeof f.binding.run_id);CHECK(invalid_before_acquire()==0);
        CHECK(reset_role(later[i].role,later[i].stage));fill_hex(f.binding.nonce,63u,'c');CHECK(invalid_before_acquire()==0);
        CHECK(reset_role(later[i].role,later[i].stage));memset(f.binding.nonce,'c',sizeof f.binding.nonce);CHECK(invalid_before_acquire()==0);
    }
    return 0;
}
static int test_success_and_borrowed_copy(void) {
    size_t i;
    CHECK(reset_fixture());CHECK(loader_binding_valid(&f.binding));
    f.destroy_borrowed_on_post=true;
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_OK);
    CHECK(f.post_copy_seen);CHECK(loader_properties_valid(&f.session.evidence));
    CHECK(f.session.evidence.property_count==9u);
    CHECK(f.session.evidence.arena_used>1000u);
    CHECK(f.session.evidence.lease==11u&&f.session.evidence.module==12u);
    CHECK(f.session.evidence.host_context==(void *)(uintptr_t)30u);
    CHECK(f.session.evidence.runtime_delegate==(void *)(uintptr_t)40u);
    CHECK(f.session.evidence.entry==(void *)(uintptr_t)50u);
    CHECK(f.session.failure.lease_acquire_entered&&f.session.failure.native_load_entered);
    CHECK(f.session.failure.initialization_entered&&f.session.failure.coreclr_start_entered);
    CHECK(f.session.failure.component_resolution_entered);
    CHECK(atomic_load(&f.session.state)==2);
    for(i=1;i<=LOADER_AT_PUBLICATION;++i)
        CHECK(f.step_calls[i]==((i==LOADER_AT_PROPERTY_ADMISSION||i==LOADER_AT_PUBLICATION)?1u:2u));
    for(i=0;i<LOADER_PROPERTY_CAP;++i)CHECK(f.session.borrowed_keys[i]==NULL&&f.session.borrowed_values[i]==NULL);
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_CONSUMED);
    CHECK(atomic_load(&f.session.state)==2);
    return 0;
}
static int test_binding_and_api(void) {
    loader_api saved;size_t i;
    CHECK(reset_fixture());CHECK(loader_resolve(NULL,&f.binding,&f.api)==LOADER_INVALID);
    CHECK(reset_fixture());f.binding.profile[0]='X';CHECK(!loader_binding_valid(&f.binding));
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_INVALID);
    CHECK(atomic_load(&f.session.state)==3);
    CHECK(f.effect_calls[0]==0u);
    CHECK(reset_fixture());f.binding.attempt[0]='A';CHECK(!loader_binding_valid(&f.binding));
    CHECK(reset_role(3u,1u));CHECK(loader_binding_valid(&f.binding));
    f.binding.stage=3;CHECK(!loader_binding_valid(&f.binding));
    CHECK(reset_fixture());CHECK(loader_resolve(&f.session,&f.binding,NULL)==LOADER_MISSING_API);
    CHECK(f.effect_calls[0]==0u);
    for(i=0;i<10u;++i) {
        CHECK(reset_fixture());saved=f.api;
        switch(i) {
            case 0:f.api.now_ms=NULL;break;case 1:f.api.guard=NULL;break;
            case 2:f.api.acquire=NULL;break;case 3:f.api.load=NULL;break;
            case 4:f.api.observe_module=NULL;break;case 5:f.api.exports=NULL;break;
            case 6:f.api.initialize=NULL;break;case 7:f.api.properties=NULL;break;
            case 8:f.api.get_delegate=NULL;break;default:f.api.resolve_entry=NULL;break;
        }
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_MISSING_API);
        CHECK(f.effect_calls[0]==0u);f.api=saved;
    }
    return 0;
}
static int test_gates_and_effects(void) {
    loader_step step;size_t i;
    for(step=LOADER_AT_ACQUIRE;step<=LOADER_AT_PUBLICATION;++step) {
        CHECK(reset_fixture());f.guard_error_step=step;
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_API_FAILED);
        CHECK(f.session.failure.step==step);
        CHECK(f.session.failure.raw.win32_error==1987u);
        CHECK(atomic_load(&f.session.state)==3);
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_CONSUMED);
        for(i=step+1u;i<=LOADER_AT_PUBLICATION;++i)CHECK(f.step_calls[i]==0u);
        if(step==LOADER_AT_PROPERTY_ADMISSION||step==LOADER_AT_PUBLICATION)continue;
        CHECK(reset_fixture());f.guard_error_step=step;f.guard_error_visit=2;
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_API_FAILED);
        CHECK(f.session.failure.step==step);
    }
    for(step=LOADER_AT_ACQUIRE;step<=LOADER_AT_ENTRY;++step) {
        if(step==LOADER_AT_PROPERTY_ADMISSION||step==LOADER_AT_PUBLICATION)continue;
        CHECK(reset_fixture());f.callback_error_step=step;f.callback_kind=1;
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_API_FAILED);
        CHECK(f.session.failure.step==step);
        CHECK(f.session.failure.raw.win32_error==1987u);
        CHECK(reset_fixture());f.callback_error_step=step;f.callback_kind=2;
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_PENDING);
        CHECK(f.session.failure.step==step);
        CHECK(atomic_load(&f.session.state)==3);
    }
    return 0;
}
static int test_status_and_properties(void) {
    loader_evidence *e;size_t i;
    CHECK(reset_fixture());f.bad_property_count=1;
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_PROPERTY_REFUSED);
    CHECK(f.session.failure.step==LOADER_AT_PROPERTY_COUNT);
    for(i=0;i<9u;++i) {
        CHECK(reset_fixture());f.keys[i][0]='X';
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_PROPERTY_REFUSED);
        CHECK(f.session.failure.step==LOADER_AT_PROPERTIES);
    }
    for(i=0;i<9u;++i) {
        CHECK(reset_fixture());f.values[i][0]=0x0100u;
        CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_PROPERTY_REFUSED);
    }
    CHECK(reset_fixture());f.bad_host_status=LOADER_AT_INITIALIZE;
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_HOST_STATUS_REFUSED);
    CHECK(f.session.failure.step==LOADER_AT_INITIALIZE);
    CHECK(f.session.failure.raw.host_status_present);
    CHECK(f.session.failure.raw.host_status==1);
    CHECK(reset_fixture());f.bad_host_status=LOADER_AT_PROPERTIES;
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_HOST_STATUS_REFUSED);
    CHECK(f.raw_host_error_seen);
    CHECK(f.step_calls[LOADER_AT_PROPERTIES]==1u);
    CHECK(reset_fixture());f.bad_host_status=LOADER_AT_DELEGATE;
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_HOST_STATUS_REFUSED);
    CHECK(f.session.failure.step==LOADER_AT_DELEGATE);
    CHECK(f.session.failure.coreclr_start_entered);
    CHECK(f.step_calls[LOADER_AT_ENTRY]==0u);
    CHECK(reset_fixture());f.guard_error_step=LOADER_AT_DELEGATE;f.guard_error_visit=2;
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_API_FAILED);
    CHECK(f.session.failure.step==LOADER_AT_DELEGATE);
    CHECK(f.session.failure.coreclr_start_entered);
    CHECK(f.step_calls[LOADER_AT_ENTRY]==0u);
    CHECK(reset_fixture());f.bad_host_status=LOADER_AT_ENTRY;
    CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_HOST_STATUS_REFUSED);
    CHECK(f.session.failure.step==LOADER_AT_ENTRY);
    CHECK(f.session.failure.component_resolution_entered);
    CHECK(reset_fixture());CHECK(loader_resolve(&f.session,&f.binding,&f.api)==LOADER_OK);
    e=&f.session.evidence;
    CHECK(loader_properties_valid(e));
    e->property_count=8u;CHECK(!loader_properties_valid(e));e->property_count=9u;
    e->properties[0].value_offset=e->arena_used;CHECK(!loader_properties_valid(e));
    return 0;
}
#if defined(COMPILE_ONLY_STANDARD_LOADER_NATIVE_V1) && defined(_WIN32)
static int test_native_invalid_inputs(void) {
    loader_native_context context={0};loader_trusted_hooks hooks;loader_api api;
    void *out=NULL;uintptr_t module=0;size_t count=0;
    CHECK(reset_fixture());
    hooks.context=&f;hooks.now_ms=fake_now;hooks.guard=fake_guard;hooks.acquire=fake_acquire;
    CHECK(!loader_windows_compile_only_api(NULL,&context,&hooks));
    CHECK(loader_windows_compile_only_api(&api,&context,&hooks));
    CHECK(!loader_windows_compile_only_api(&api,&context,&hooks));
    CHECK(api.load(api.context,NULL,0x900u,&module).disposition==LOADER_API_ERROR);
    CHECK(api.load(NULL,LOADER_FXR,0x900u,&module).disposition==LOADER_API_ERROR);
    CHECK(api.observe_module(NULL,1u,(char *)&module,sizeof module).disposition==LOADER_API_ERROR);
    CHECK(api.exports(NULL,1u,&module,&module).disposition==LOADER_API_ERROR);
    CHECK(api.properties(NULL,(void *)(uintptr_t)1u,&count,NULL,NULL).disposition==LOADER_API_ERROR);
    CHECK(api.get_delegate(NULL,(void *)(uintptr_t)1u,5u,&out).disposition==LOADER_API_ERROR);
    context.module=2u;context.exports_ready=true;context.exports[0]=1u;context.exports[2]=1u;
    CHECK(api.initialize(api.context,NULL,LOADER_IMAGE,LOADER_DOTNET,&out).disposition==LOADER_API_ERROR);
    CHECK(api.initialize(api.context,LOADER_CONFIG,NULL,LOADER_DOTNET,&out).disposition==LOADER_API_ERROR);
    CHECK(api.initialize(api.context,LOADER_CONFIG,LOADER_IMAGE,NULL,&out).disposition==LOADER_API_ERROR);
    CHECK(api.initialize(NULL,LOADER_CONFIG,LOADER_IMAGE,LOADER_DOTNET,&out).disposition==LOADER_API_ERROR);
    context.host_context=(void *)(uintptr_t)3u;context.runtime_delegate=(void *)(uintptr_t)1u;
    CHECK(api.resolve_entry(api.context,(void *)(uintptr_t)1u,NULL,LOADER_TYPE,LOADER_METHOD,&out).disposition==LOADER_API_ERROR);
    CHECK(api.resolve_entry(api.context,(void *)(uintptr_t)1u,LOADER_ASSEMBLY,NULL,LOADER_METHOD,&out).disposition==LOADER_API_ERROR);
    CHECK(api.resolve_entry(api.context,(void *)(uintptr_t)1u,LOADER_ASSEMBLY,LOADER_TYPE,NULL,&out).disposition==LOADER_API_ERROR);
    CHECK(api.resolve_entry(NULL,(void *)(uintptr_t)1u,LOADER_ASSEMBLY,LOADER_TYPE,LOADER_METHOD,&out).disposition==LOADER_API_ERROR);
    context.runtime_delegate=NULL;
    CHECK(api.resolve_entry(api.context,(void *)(uintptr_t)1u,LOADER_ASSEMBLY,LOADER_TYPE,LOADER_METHOD,&out).disposition==LOADER_API_ERROR);
    CHECK(module==0u&&out==NULL&&context.module==2u);
    return 0;
}
#endif
int loader_run_pure_tests(size_t *count) {
    assertions=0;
    if(count==NULL)return 1;
    if(test_role_run_nonce_shape()||test_success_and_borrowed_copy()||test_binding_and_api()||
        test_gates_and_effects()||test_status_and_properties()) {
        *count=assertions;return 1;
    }
#if defined(COMPILE_ONLY_STANDARD_LOADER_NATIVE_V1) && defined(_WIN32)
    if(test_native_invalid_inputs()){*count=assertions;return 1;}
#endif
    *count=assertions;return 0;
}
