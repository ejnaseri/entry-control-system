#include "standard_loader.h"
#include <string.h>

/* Explicit managed leaf set read from the pinned installed10.0.11 framework
   deps original. This is a prospective allowed set, not loaded-module proof. */
static const char *const tpa_leaves[] = {
    "Microsoft.CSharp.dll",
    "Microsoft.VisualBasic.Core.dll",
    "Microsoft.VisualBasic.dll",
    "Microsoft.Win32.Primitives.dll",
    "Microsoft.Win32.Registry.dll",
    "mscorlib.dll",
    "netstandard.dll",
    "System.AppContext.dll",
    "System.Buffers.dll",
    "System.Collections.Concurrent.dll",
    "System.Collections.dll",
    "System.Collections.Immutable.dll",
    "System.Collections.NonGeneric.dll",
    "System.Collections.Specialized.dll",
    "System.ComponentModel.Annotations.dll",
    "System.ComponentModel.DataAnnotations.dll",
    "System.ComponentModel.dll",
    "System.ComponentModel.EventBasedAsync.dll",
    "System.ComponentModel.Primitives.dll",
    "System.ComponentModel.TypeConverter.dll",
    "System.Configuration.dll",
    "System.Console.dll",
    "System.Core.dll",
    "System.Data.Common.dll",
    "System.Data.DataSetExtensions.dll",
    "System.Data.dll",
    "System.Diagnostics.Contracts.dll",
    "System.Diagnostics.Debug.dll",
    "System.Diagnostics.DiagnosticSource.dll",
    "System.Diagnostics.FileVersionInfo.dll",
    "System.Diagnostics.Process.dll",
    "System.Diagnostics.StackTrace.dll",
    "System.Diagnostics.TextWriterTraceListener.dll",
    "System.Diagnostics.Tools.dll",
    "System.Diagnostics.TraceSource.dll",
    "System.Diagnostics.Tracing.dll",
    "System.dll",
    "System.Drawing.dll",
    "System.Drawing.Primitives.dll",
    "System.Dynamic.Runtime.dll",
    "System.Formats.Asn1.dll",
    "System.Formats.Tar.dll",
    "System.Globalization.Calendars.dll",
    "System.Globalization.dll",
    "System.Globalization.Extensions.dll",
    "System.IO.Compression.Brotli.dll",
    "System.IO.Compression.dll",
    "System.IO.Compression.FileSystem.dll",
    "System.IO.Compression.ZipFile.dll",
    "System.IO.dll",
    "System.IO.FileSystem.AccessControl.dll",
    "System.IO.FileSystem.dll",
    "System.IO.FileSystem.DriveInfo.dll",
    "System.IO.FileSystem.Primitives.dll",
    "System.IO.FileSystem.Watcher.dll",
    "System.IO.IsolatedStorage.dll",
    "System.IO.MemoryMappedFiles.dll",
    "System.IO.Pipelines.dll",
    "System.IO.Pipes.AccessControl.dll",
    "System.IO.Pipes.dll",
    "System.IO.UnmanagedMemoryStream.dll",
    "System.Linq.AsyncEnumerable.dll",
    "System.Linq.dll",
    "System.Linq.Expressions.dll",
    "System.Linq.Parallel.dll",
    "System.Linq.Queryable.dll",
    "System.Memory.dll",
    "System.Net.dll",
    "System.Net.Http.dll",
    "System.Net.Http.Json.dll",
    "System.Net.HttpListener.dll",
    "System.Net.Mail.dll",
    "System.Net.NameResolution.dll",
    "System.Net.NetworkInformation.dll",
    "System.Net.Ping.dll",
    "System.Net.Primitives.dll",
    "System.Net.Quic.dll",
    "System.Net.Requests.dll",
    "System.Net.Security.dll",
    "System.Net.ServerSentEvents.dll",
    "System.Net.ServicePoint.dll",
    "System.Net.Sockets.dll",
    "System.Net.WebClient.dll",
    "System.Net.WebHeaderCollection.dll",
    "System.Net.WebProxy.dll",
    "System.Net.WebSockets.Client.dll",
    "System.Net.WebSockets.dll",
    "System.Numerics.dll",
    "System.Numerics.Vectors.dll",
    "System.ObjectModel.dll",
    "System.Private.CoreLib.dll",
    "System.Private.DataContractSerialization.dll",
    "System.Private.Uri.dll",
    "System.Private.Xml.dll",
    "System.Private.Xml.Linq.dll",
    "System.Reflection.DispatchProxy.dll",
    "System.Reflection.dll",
    "System.Reflection.Emit.dll",
    "System.Reflection.Emit.ILGeneration.dll",
    "System.Reflection.Emit.Lightweight.dll",
    "System.Reflection.Extensions.dll",
    "System.Reflection.Metadata.dll",
    "System.Reflection.Primitives.dll",
    "System.Reflection.TypeExtensions.dll",
    "System.Resources.Reader.dll",
    "System.Resources.ResourceManager.dll",
    "System.Resources.Writer.dll",
    "System.Runtime.CompilerServices.Unsafe.dll",
    "System.Runtime.CompilerServices.VisualC.dll",
    "System.Runtime.dll",
    "System.Runtime.Extensions.dll",
    "System.Runtime.Handles.dll",
    "System.Runtime.InteropServices.dll",
    "System.Runtime.InteropServices.JavaScript.dll",
    "System.Runtime.InteropServices.RuntimeInformation.dll",
    "System.Runtime.Intrinsics.dll",
    "System.Runtime.Loader.dll",
    "System.Runtime.Numerics.dll",
    "System.Runtime.Serialization.dll",
    "System.Runtime.Serialization.Formatters.dll",
    "System.Runtime.Serialization.Json.dll",
    "System.Runtime.Serialization.Primitives.dll",
    "System.Runtime.Serialization.Xml.dll",
    "System.Security.AccessControl.dll",
    "System.Security.Claims.dll",
    "System.Security.Cryptography.Algorithms.dll",
    "System.Security.Cryptography.Cng.dll",
    "System.Security.Cryptography.Csp.dll",
    "System.Security.Cryptography.dll",
    "System.Security.Cryptography.Encoding.dll",
    "System.Security.Cryptography.OpenSsl.dll",
    "System.Security.Cryptography.Primitives.dll",
    "System.Security.Cryptography.X509Certificates.dll",
    "System.Security.dll",
    "System.Security.Principal.dll",
    "System.Security.Principal.Windows.dll",
    "System.Security.SecureString.dll",
    "System.ServiceModel.Web.dll",
    "System.ServiceProcess.dll",
    "System.Text.Encoding.CodePages.dll",
    "System.Text.Encoding.dll",
    "System.Text.Encoding.Extensions.dll",
    "System.Text.Encodings.Web.dll",
    "System.Text.Json.dll",
    "System.Text.RegularExpressions.dll",
    "System.Threading.AccessControl.dll",
    "System.Threading.Channels.dll",
    "System.Threading.dll",
    "System.Threading.Overlapped.dll",
    "System.Threading.Tasks.Dataflow.dll",
    "System.Threading.Tasks.dll",
    "System.Threading.Tasks.Extensions.dll",
    "System.Threading.Tasks.Parallel.dll",
    "System.Threading.Thread.dll",
    "System.Threading.ThreadPool.dll",
    "System.Threading.Timer.dll",
    "System.Transactions.dll",
    "System.Transactions.Local.dll",
    "System.ValueTuple.dll",
    "System.Web.dll",
    "System.Web.HttpUtility.dll",
    "System.Windows.dll",
    "System.Xml.dll",
    "System.Xml.Linq.dll",
    "System.Xml.ReaderWriter.dll",
    "System.Xml.Serialization.dll",
    "System.Xml.XDocument.dll",
    "System.Xml.XmlDocument.dll",
    "System.Xml.XmlSerializer.dll",
    "System.Xml.XPath.dll",
    "System.Xml.XPath.XDocument.dll",
    "WindowsBase.dll",
};
static const char *const export_names[] = {
    "hostfxr_initialize_for_runtime_config","hostfxr_get_runtime_properties",
    "hostfxr_get_runtime_delegate","hostfxr_close"
};
static const char *const property_names[] = {
    "TRUSTED_PLATFORM_ASSEMBLIES","NATIVE_DLL_SEARCH_DIRECTORIES","PLATFORM_RESOURCE_ROOTS",
    "APP_CONTEXT_BASE_DIRECTORY","APP_CONTEXT_DEPS_FILES","FX_DEPS_FILE",
    "PROBING_DIRECTORIES","RUNTIME_IDENTIFIER","HOST_RUNTIME_CONTRACT"
};
size_t loader_tpa_count(void) { return sizeof tpa_leaves/sizeof tpa_leaves[0]; }
const char *loader_tpa_leaf(size_t i) { return i<loader_tpa_count()?tpa_leaves[i]:NULL; }
const char *loader_export_name(size_t i) { return i<4u?export_names[i]:NULL; }
static size_t length(const char *v,size_t cap) {
    size_t n;if(v==NULL)return cap;for(n=0;n<cap && v[n]!=0;++n){}return n;
}
static bool exact(const char *v,const char *expected) {
    size_t n=strlen(expected);return length(v,n+1u)==n && memcmp(v,expected,n)==0;
}
static bool hex(const char *v,size_t n) {
    size_t i;if(length(v,n+1u)!=n)return false;
    for(i=0;i<n;++i)if(!((v[i]>='0'&&v[i]<='9')||(v[i]>='a'&&v[i]<='f')))return false;
    return true;
}
static bool all_zero(const char *v,size_t n) {
    size_t i;for(i=0;i<n;++i)if(v[i]!=0)return false;return true;
}
static bool run_nonce_valid(const loader_binding *v) {
    if(v->role==1u)return all_zero(v->run_id,sizeof v->run_id)&&all_zero(v->nonce,sizeof v->nonce);
    return hex(v->run_id,32u)&&hex(v->nonce,64u);
}
bool loader_binding_valid(const loader_binding *v) {
    return v!=NULL && exact(v->profile,LOADER_PROFILE) && exact(v->effects,LOADER_EFFECTS) &&
        ((v->role==1u && v->stage==0u)||(v->role==2u && v->stage==3u)||
        (v->role==3u && v->stage==1u)||(v->role==4u && (v->stage==2u||v->stage==4u))) &&
        hex(v->attempt,32u)&&run_nonce_valid(v)&&hex(v->plan_sha256,64u)&&
        hex(v->approval_sha256,64u)&&hex(v->source_sha256,64u)&&hex(v->profile_sha256,64u)&&
        hex(v->package_sha256,64u)&&hex(v->runtime_sha256,64u)&&hex(v->image_sha256,64u)&&
        hex(v->assembly_sha256,64u)&&hex(v->config_sha256,64u);
}
static bool tpa_valid(const char *value) {
    bool seen[172]={false};size_t at=0,count=0,prefix=strlen(LOADER_RUNTIME "\\");
    if(loader_tpa_count()!=172u)return false;
    while(value[at]!=0) {
        size_t start=at,n,i;bool found=false;
        while(value[at]!=0 && value[at]!=';')++at;n=at-start;
        if(n<=prefix || memcmp(value+start,LOADER_RUNTIME "\\",prefix)!=0)return false;
        for(i=0;i<loader_tpa_count();++i)if(n-prefix==strlen(tpa_leaves[i]) &&
            memcmp(value+start+prefix,tpa_leaves[i],n-prefix)==0) {
            if(seen[i])return false;seen[i]=true;found=true;break;
        }
        if(!found || ++count>loader_tpa_count())return false;
        if(value[at]==';')++at;
    }
    return count==loader_tpa_count();
}
static bool runtime_directory(const char *v) {
    return exact(v,"")||exact(v,LOADER_RUNTIME)||exact(v,LOADER_RUNTIME "\\")||
        exact(v,LOADER_RUNTIME ";")||exact(v,LOADER_RUNTIME "\\;");
}
static bool opaque_contract(const char *v) {
    size_t i,n=length(v,19u);bool nonzero=false;
    if(n<3u||n>18u||v[0]!='0'||v[1]!='x')return false;
    for(i=2;i<n;++i){if(!((v[i]>='0'&&v[i]<='9')||(v[i]>='a'&&v[i]<='f')))return false;if(v[i]!='0')nonzero=true;}
    return nonzero;
}
bool loader_properties_valid(const loader_evidence *e) {
    const char *values[9]={NULL};size_t i,j;
    if(e==NULL || e->property_count!=9u || e->arena_used==0 || e->arena_used>LOADER_PROPERTY_ARENA)return false;
    for(i=0;i<e->property_count;++i) {
        const loader_property *p=&e->properties[i];bool found=false;
        if(length(p->name,sizeof p->name)>=sizeof p->name || p->value_offset>=e->arena_used ||
            p->value_length>=e->arena_used-p->value_offset || p->value_length>=LOADER_PROPERTY_VALUE_CAP ||
            e->arena[p->value_offset+p->value_length]!=0)return false;
        for(j=0;j<p->value_length;++j)if((unsigned char)e->arena[p->value_offset+j]<32u ||
            (unsigned char)e->arena[p->value_offset+j]>126u)return false;
        if(length(e->arena+p->value_offset,p->value_length+1u)!=p->value_length)return false;
        for(j=0;j<9u;++j)if(exact(p->name,property_names[j])) {
            if(values[j]!=NULL)return false;values[j]=e->arena+p->value_offset;found=true;break;
        }
        if(!found)return false;
    }
    for(i=0;i<9u;++i)if(values[i]==NULL)return false;
    return tpa_valid(values[0])&&runtime_directory(values[1])&&runtime_directory(values[2])&&
        (exact(values[3],"")||exact(values[3],LOADER_BIN)||exact(values[3],LOADER_BIN "\\"))&&
        (exact(values[4],LOADER_DEPS)||exact(values[4],LOADER_DEPS ";"))&&exact(values[5],LOADER_DEPS)&&
        exact(values[6],"")&&exact(values[7],"win-x64")&&opaque_contract(values[8]);
}
void loader_session_init(loader_session *s) { if(s!=NULL){memset(s,0,sizeof *s);atomic_init(&s->state,0);} }
static loader_api_result ok(void) { loader_api_result r={LOADER_API_OK,0,false,0};return r; }
static loader_code fail(loader_session *s,loader_code code,loader_step step,loader_api_result raw) {
    s->failure.code=code;s->failure.step=step;s->failure.raw=raw;atomic_store(&s->state,3);return code;
}
static loader_code gate(loader_session *s,const loader_api *api,loader_step step) {
    uint64_t before,after;loader_api_result r;
    if(atomic_load(&s->state)!=1)return fail(s,LOADER_REENTERED,step,ok());
    before=api->now_ms(api->context);
    if(atomic_load(&s->state)!=1)return fail(s,LOADER_REENTERED,step,ok());
    if(!s->clock_started){s->clock_started=true;s->began_ms=before;s->last_ms=before;}
    if(before<s->last_ms||before-s->began_ms>=LOADER_BUDGET_MS)return fail(s,LOADER_DEADLINE,step,ok());
    r=api->guard(api->context,step,&s->binding,&s->evidence);
    if(r.disposition!=LOADER_API_OK)return fail(s,r.disposition==LOADER_API_PENDING?LOADER_PENDING:LOADER_API_FAILED,step,r);
    if(atomic_load(&s->state)!=1)return fail(s,LOADER_REENTERED,step,ok());
    after=api->now_ms(api->context);
    if(atomic_load(&s->state)!=1)return fail(s,LOADER_REENTERED,step,ok());
    if(after<before||after-s->began_ms>=LOADER_BUDGET_MS)return fail(s,LOADER_DEADLINE,step,ok());
    s->last_ms=after;return LOADER_OK;
}
static loader_code returned(loader_session *s,const loader_api *api,loader_step step,loader_api_result r) {
    if(r.disposition!=LOADER_API_OK)return fail(s,r.disposition==LOADER_API_PENDING?LOADER_PENDING:LOADER_API_FAILED,step,r);
    return gate(s,api,step);
}
static loader_code host_returned(loader_session *s,const loader_api *api,loader_step step,loader_api_result r,int32_t expected) {
    if(r.disposition!=LOADER_API_OK)return fail(s,r.disposition==LOADER_API_PENDING?LOADER_PENDING:LOADER_API_FAILED,step,r);
    if(!r.host_status_present||r.host_status!=expected)return fail(s,LOADER_HOST_STATUS_REFUSED,step,r);
    return gate(s,api,step);
}
static bool copy_text(const uint16_t *v,char *out,size_t cap,size_t *n) {
    size_t i;if(v==NULL)return false;
    for(i=0;i<cap;++i){uint16_t c=v[i];if(c==0){out[i]=0;*n=i;return true;}if(c<32u||c>126u)return false;out[i]=(char)c;}
    return false;
}
static bool copy_properties(loader_session *s) {
    size_t i,n,remaining;s->evidence.property_count=s->borrowed_count;s->evidence.arena_used=0;
    for(i=0;i<s->borrowed_count;++i) {
        loader_property *p=&s->evidence.properties[i];
        if(!copy_text(s->borrowed_keys[i],p->name,sizeof p->name,&n))return false;
        p->value_offset=s->evidence.arena_used;remaining=LOADER_PROPERTY_ARENA-p->value_offset;
        if(remaining>LOADER_PROPERTY_VALUE_CAP)remaining=LOADER_PROPERTY_VALUE_CAP;
        if(!copy_text(s->borrowed_values[i],s->evidence.arena+p->value_offset,remaining,&n))return false;
        p->value_length=n;s->evidence.arena_used+=n+1u;
    }
    /* Never use borrowed pointers after runtime startup or future close. */
    memset(s->borrowed_keys,0,sizeof s->borrowed_keys);memset(s->borrowed_values,0,sizeof s->borrowed_values);
    return loader_properties_valid(&s->evidence);
}
loader_code loader_resolve(loader_session *s,const loader_binding *binding,const loader_api *provided) {
    loader_api snapshot;const loader_api *api;loader_api_result r;loader_code code;int expected=0;size_t i,count;
    if(s==NULL)return LOADER_INVALID;
    if(!atomic_compare_exchange_strong(&s->state,&expected,1)) {
        if(expected==1){int active=1;if(atomic_compare_exchange_strong(&s->state,&active,3))return LOADER_REENTERED;}
        return LOADER_CONSUMED;
    }
    if(!loader_binding_valid(binding))return fail(s,LOADER_INVALID,LOADER_AT_ACQUIRE,ok());
    s->binding=*binding;
    if(provided==NULL)return fail(s,LOADER_MISSING_API,LOADER_AT_ACQUIRE,ok());
    snapshot=*provided;api=&snapshot;
    if(api->now_ms==NULL||api->guard==NULL||api->acquire==NULL||api->load==NULL||api->observe_module==NULL||
        api->exports==NULL||api->initialize==NULL||api->properties==NULL||api->get_delegate==NULL||api->resolve_entry==NULL)
        return fail(s,LOADER_MISSING_API,LOADER_AT_ACQUIRE,ok());
    if((code=gate(s,api,LOADER_AT_ACQUIRE))!=LOADER_OK)return code;
    s->failure.lease_acquire_entered=true;r=api->acquire(api->context,&s->binding,&s->evidence.lease);
    if((code=returned(s,api,LOADER_AT_ACQUIRE,r))!=LOADER_OK)return code;
    if(s->evidence.lease==0)return fail(s,LOADER_BAD_OBSERVATION,LOADER_AT_ACQUIRE,ok());
    if((code=gate(s,api,LOADER_AT_LOAD))!=LOADER_OK)return code;
    s->failure.native_load_entered=true;r=api->load(api->context,LOADER_FXR,0x900u,&s->evidence.module);
    if((code=returned(s,api,LOADER_AT_LOAD,r))!=LOADER_OK)return code;
    if(s->evidence.module==0)return fail(s,LOADER_BAD_OBSERVATION,LOADER_AT_LOAD,ok());
    if((code=gate(s,api,LOADER_AT_OBSERVE))!=LOADER_OK)return code;
    memset(s->evidence.module_path,0xff,sizeof s->evidence.module_path);
    r=api->observe_module(api->context,s->evidence.module,s->evidence.module_path,sizeof s->evidence.module_path);
    if((code=returned(s,api,LOADER_AT_OBSERVE,r))!=LOADER_OK)return code;
    if(!exact(s->evidence.module_path,LOADER_FXR))return fail(s,LOADER_BAD_OBSERVATION,LOADER_AT_OBSERVE,ok());
    if((code=gate(s,api,LOADER_AT_EXPORTS))!=LOADER_OK)return code;
    r=api->exports(api->context,s->evidence.module,s->evidence.exports,s->evidence.export_owners);
    if((code=returned(s,api,LOADER_AT_EXPORTS,r))!=LOADER_OK)return code;
    for(i=0;i<4u;++i)if(s->evidence.exports[i]==0||s->evidence.export_owners[i]!=s->evidence.module)
        return fail(s,LOADER_BAD_OBSERVATION,LOADER_AT_EXPORTS,ok());
    if((code=gate(s,api,LOADER_AT_INITIALIZE))!=LOADER_OK)return code;
    s->failure.initialization_entered=true;
    r=api->initialize(api->context,LOADER_CONFIG,LOADER_IMAGE,LOADER_DOTNET,&s->evidence.host_context);
    if((code=host_returned(s,api,LOADER_AT_INITIALIZE,r,0))!=LOADER_OK)return code;
    if(s->evidence.host_context==0)return fail(s,LOADER_BAD_OBSERVATION,LOADER_AT_INITIALIZE,ok());
    if((code=gate(s,api,LOADER_AT_PROPERTY_COUNT))!=LOADER_OK)return code;
    s->borrowed_count=0;r=api->properties(api->context,s->evidence.host_context,&s->borrowed_count,NULL,NULL);
    if((code=host_returned(s,api,LOADER_AT_PROPERTY_COUNT,r,(int32_t)0x80008098u))!=LOADER_OK)return code;
    count=s->borrowed_count;
    if(count!=9u||count>LOADER_PROPERTY_CAP)return fail(s,LOADER_PROPERTY_REFUSED,LOADER_AT_PROPERTY_COUNT,r);
    if((code=gate(s,api,LOADER_AT_PROPERTIES))!=LOADER_OK)return code;
    r=api->properties(api->context,s->evidence.host_context,&s->borrowed_count,s->borrowed_keys,s->borrowed_values);
    /* hostfxr owns these buffers. No guard/clock callback may run while the
       session still relies on their contents: a callback can change or close
       the context. Capture the raw result and bound first, then copy now. */
    if(r.disposition!=LOADER_API_OK)return fail(s,r.disposition==LOADER_API_PENDING?LOADER_PENDING:LOADER_API_FAILED,LOADER_AT_PROPERTIES,r);
    if(!r.host_status_present||r.host_status!=0)return fail(s,LOADER_HOST_STATUS_REFUSED,LOADER_AT_PROPERTIES,r);
    if(s->borrowed_count!=count||!copy_properties(s))return fail(s,LOADER_PROPERTY_REFUSED,LOADER_AT_PROPERTIES,r);
    if((code=gate(s,api,LOADER_AT_PROPERTIES))!=LOADER_OK)return code;
    if((code=gate(s,api,LOADER_AT_PROPERTY_ADMISSION))!=LOADER_OK)return code;
    if((code=gate(s,api,LOADER_AT_DELEGATE))!=LOADER_OK)return code;
    s->failure.coreclr_start_entered=true;
    r=api->get_delegate(api->context,s->evidence.host_context,5u,&s->evidence.runtime_delegate);
    if((code=host_returned(s,api,LOADER_AT_DELEGATE,r,0))!=LOADER_OK)return code;
    if(s->evidence.runtime_delegate==0)return fail(s,LOADER_BAD_OBSERVATION,LOADER_AT_DELEGATE,ok());
    if((code=gate(s,api,LOADER_AT_ENTRY))!=LOADER_OK)return code;
    s->failure.component_resolution_entered=true;
    r=api->resolve_entry(api->context,s->evidence.runtime_delegate,LOADER_ASSEMBLY,LOADER_TYPE,LOADER_METHOD,&s->evidence.entry);
    if((code=host_returned(s,api,LOADER_AT_ENTRY,r,0))!=LOADER_OK)return code;
    if(s->evidence.entry==0)return fail(s,LOADER_BAD_OBSERVATION,LOADER_AT_ENTRY,ok());
    if((code=gate(s,api,LOADER_AT_PUBLICATION))!=LOADER_OK)return code;
    expected=1;if(!atomic_compare_exchange_strong(&s->state,&expected,2))return fail(s,LOADER_REENTERED,LOADER_AT_PUBLICATION,ok());
    return LOADER_OK; /* RETAINED capability; entry is NEVER INVOKED here. */
}

