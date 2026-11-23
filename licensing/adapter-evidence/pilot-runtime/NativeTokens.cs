using Microsoft.Win32.SafeHandles;
namespace EntryControl.TestOnly.Runtime;
internal sealed record TokenSnapshot(string User,string Owner,int Type,int Elevation,string Service,uint Attributes,int GroupCount,bool Restricted,bool QueryComplete);
internal sealed record HostSnapshot(int SchemaVersion,string Scope,string MachineFingerprint,uint Major,uint Minor,uint Build,
    byte ProductType,string OsArchitecture,string ProcessArchitecture,string Runtime);
internal static class HostAdmission
{
    internal const string Scope="TEST_ONLY_PILOT_HOST_BINDING_V1";
    internal static string Fingerprint(string value)
    {
        Program.Need(Guid.TryParseExact(value,"D",out var guid) && guid!=Guid.Empty,"HOST_MACHINE_ID_REFUSED");
        return Program.Hash(Encoding.ASCII.GetBytes(guid.ToString("D")));
    }
    internal static string Digest(HostSnapshot host)
    {
        Program.Need(host.SchemaVersion==1 && host.Scope==Scope && Program.Hex(host.MachineFingerprint,64) &&
            host.Major==10 && host.Minor==0 && host.Build>=10240 && host.ProductType==1 &&
            host.OsArchitecture=="X64" && host.ProcessArchitecture=="X64" && host.Runtime=="10.0.11","HOST_PROFILE_REFUSED");
        return Program.Hash(Program.Serialize(host));
    }
    internal static HostSnapshot Capture()
    {
        Program.Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows),"HOST_OS_REFUSED");
        var version=new OsVersion {Size=(uint)Marshal.SizeOf<OsVersion>(),ServicePack=""};
        Program.Need(RtlGetVersion(ref version)==0 && version.Platform==2,"HOST_OS_QUERY_REFUSED");
        using var machine=Microsoft.Win32.RegistryKey.OpenBaseKey(Microsoft.Win32.RegistryHive.LocalMachine,Microsoft.Win32.RegistryView.Registry64);
        using var key=machine.OpenSubKey("SOFTWARE\\Microsoft\\Cryptography",false);
        Program.Need(key is not null && key.GetValueKind("MachineGuid")==Microsoft.Win32.RegistryValueKind.String,"HOST_MACHINE_QUERY_REFUSED");
        var value=key!.GetValue("MachineGuid",null,Microsoft.Win32.RegistryValueOptions.DoNotExpandEnvironmentNames) as string;
        Program.Need(value is not null && value.Length==36,"HOST_MACHINE_QUERY_REFUSED");
        var host=new HostSnapshot(1,Scope,Fingerprint(value!),version.Major,version.Minor,version.Build,version.ProductType,
            RuntimeInformation.OSArchitecture.ToString(),RuntimeInformation.ProcessArchitecture.ToString(),Environment.Version.ToString());
        Digest(host);return host;
    }
    internal static void Match(HostSnapshot host,string approvedHash)=>Program.Need(Program.Hex(approvedHash,64) && Digest(host)==approvedHash,"HOST_BINDING_MISMATCH");
    internal static void Verify(PilotPlan plan)=>Match(Capture(),plan.HostBindingSha256);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]private struct OsVersion
    {internal uint Size,Major,Minor,Build,Platform;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)]internal string ServicePack;
        internal ushort ServicePackMajor,ServicePackMinor,Suite;internal byte ProductType,Reserved;}
    [DllImport("ntdll.dll",ExactSpelling=true)]private static extern int RtlGetVersion(ref OsVersion version);
    internal static int SelfTest()
    {
        int count=0;void Reject(Action action){try{action();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("HOST_REFUSAL_MISSING");}
        var host=new HostSnapshot(1,Scope,new string('a',64),10,0,22000,1,"X64","X64","10.0.11");
        string hash=Digest(host);Match(host,hash);count++;
        Digest(host with {Build=10240});count++;Digest(host with {Build=19045});count++;
        foreach(var changed in new[]{host with {SchemaVersion=2},host with {Scope="PRODUCT"},host with {MachineFingerprint="bad"},host with {Major=6},
            host with {Minor=1},host with {Build=10000},host with {ProductType=3},host with {OsArchitecture="Arm64"},host with {ProcessArchitecture="X86"},host with {Runtime="10.0.10"}})Reject(()=>Digest(changed));
        Reject(()=>Match(host,new string('b',64)));Reject(()=>Match(host,""));
        Reject(()=>Match(host with {Build=22631},hash));Reject(()=>Match(host with {MachineFingerprint=new string('b',64)},hash));
        Program.Need(Fingerprint("12345678-1234-1234-1234-123456789abc")==Fingerprint("12345678-1234-1234-1234-123456789ABC"),"HOST_ID_CANONICAL_FAILED");count++;
        Reject(()=>Fingerprint("bad"));Reject(()=>Fingerprint("00000000-0000-0000-0000-000000000000"));return count;
    }
}
internal static class NativeTokens
{
    // Checks the current executor, not who authored a stored decision. Capture
    // rejects thread impersonation and obtains the actual primary token.
    internal static void MatchControllerOwner(TokenSnapshot token,string expectedOwnerSid)
    {
        Program.Need(expectedOwnerSid is not null && OwnerAdmission.ValidOwnerSid(expectedOwnerSid) &&
            token.User==expectedOwnerSid && token.Owner=="S-1-5-32-544" && token.Type==1 && token.Elevation==1 &&
            token.Service=="" && token.Attributes==0 && token.GroupCount==0 && !token.Restricted && token.QueryComplete,"CONTROLLER_OWNER_MISMATCH_REFUSED");
    }
    internal static int OwnerMatchSelfTest()
    {
        int count=0;string sid="S-1-5-21-1-2-3-1001";var token=new TokenSnapshot(sid,"S-1-5-32-544",1,1,"",0,0,false,true);
        MatchControllerOwner(token,sid);count++;
        void Reject(Action a){try{a();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("OWNER_MATCH_REFUSAL_MISSING");}
        foreach(var changed in new[]{token with {User="S-1-5-21-1-2-3-1002"},token with {User="S-1-5-18"},
            token with {Owner=sid},token with {Type=2},token with {Elevation=0},token with {Elevation=2},
            token with {Service="S-1-5-80-1-2-3-4-5"},token with {Attributes=4}})Reject(()=>MatchControllerOwner(changed,sid));
        Reject(()=>MatchControllerOwner(token,"S-1-5-18"));Reject(()=>MatchControllerOwner(token,""));return count;
    }
    internal static string BootIdentity()
    {
        var buffer=Marshal.AllocHGlobal(48);
        try {int status=NtQuerySystemInformation(3,buffer,48,out int length);
            Program.Need(status==0 && length>=8 && length<=48,"BOOT_QUERY_REFUSED");
            long ticks=Marshal.ReadInt64(buffer);Program.Need(ticks>0,"BOOT_TIME_REFUSED");
            return Program.Hash(BitConverter.GetBytes(ticks));}
        finally {Marshal.FreeHGlobal(buffer);}
    }
    [DllImport("ntdll.dll")]private static extern int NtQuerySystemInformation(int cls,IntPtr buffer,int length,out int written);
    // Windows service-name namespace derivation only, not a cryptographic trust hash.
    // Fixed names can be derived before registration; actual account/token identity
    // is still checked after registration. No lookup failure is treated as absence.
    internal static string DerivedServiceSid(string role)
    {
        string name=ControllerWindows.ServiceName(role);
        byte[] digest=SHA1.HashData(Encoding.Unicode.GetBytes(name.ToUpperInvariant()));
        return "S-1-5-80-"+string.Join("-",Enumerable.Range(0,5).Select(i=>
            System.Buffers.Binary.BinaryPrimitives.ReadUInt32LittleEndian(digest.AsSpan(i*4,4)).ToString(System.Globalization.CultureInfo.InvariantCulture)));
    }
    internal static string Sid(string role)
    {
        string expected=DerivedServiceSid(role);
        string actual=((SecurityIdentifier)new NTAccount("NT SERVICE",ControllerWindows.ServiceName(role)).Translate(typeof(SecurityIdentifier))).Value;
        Program.Need(actual==expected,"REGISTERED_SERVICE_SID_DERIVATION_MISMATCH");return actual;
    }
    internal static int ServiceSidSelfTest()
    {
        var roles=new[]{"Setup","Guardian","App"};
        // Independently observed with Windows sc.exe showsid, before registration.
        var expected=new[]{"S-1-5-80-1484505011-3519140652-1579809200-3421692943-3374733364",
            "S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315",
            "S-1-5-80-2047476140-866037033-1036749680-3124912352-2263112698"};
        int count=0;for(int i=0;i<3;i++){Program.Need(DerivedServiceSid(roles[i])==expected[i],"SERVICE_SID_VECTOR_FAILED");count++;}
        foreach(string role in new[]{"Child","Controller","guardian","Other","../Setup"}) {
            try{DerivedServiceSid(role);}catch(InvalidDataException){count++;continue;}throw new InvalidDataException("SERVICE_SID_REFUSAL_MISSING");
        }
        void Reject(Action a){try{a();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("NAMESPACE_REFUSAL_MISSING");}
        Program.Need(Program.Root=="C:/ProgramData/Ecs.Lic008.EntryEvidenceV2" &&
            Program.Prefix=="Ecs.Lic008.EntryEvidenceV2","FIXED_NAMESPACE_FAILED");count++;
        Reject(()=>SecureFiles.PathOf("C:/ProgramData/Ecs.Lic008.EntryEvidenceV1/plans/prepare.json"));
        Reject(()=>SecureFiles.PathOf("../Ecs.Lic008.EntryEvidenceV1/plans/prepare.json"));
        foreach(string role in roles) {
            string binary=ControllerWindows.ServiceBinary(role),account=ControllerWindows.ServiceAccount(role);
            ControllerWindows.RetainedConfig(role,16,3,binary,account,"");count++;
            Reject(()=>ControllerWindows.RetainedConfig(role,16,3,binary.Replace("EntryEvidenceV2","EntryEvidenceV1"),account,""));
            if(role!="Setup")Reject(()=>ControllerWindows.RetainedConfig(role,16,3,binary,account.Replace("EntryEvidenceV2","EntryEvidenceV1"),""));
        }
        string oldGuardian="S-1-5-80-352077755-3436833279-1920633778-1136893238-1139765240";
        foreach(string wrong in new[]{oldGuardian,expected[2]}) {
            Program.Need(!ServiceIdentityPolicy.Accept("Guardian",expected[1],wrong,wrong,1,0,0,true,false,false),"OLD_OR_MIXED_SID_ACCEPTED");count++;
        }
        return count;
    }
    internal static TokenSnapshot Capture(string role)
    {
        using(var imp=WindowsIdentity.GetCurrent(true))Program.Need(imp is null,"IMPERSONATION_REFUSED");
        using var identity=WindowsIdentity.GetCurrent();
        return CaptureIdentity(identity,role,role=="Controller"?"":Sid(role=="Child"?"App":role));
    }
    internal static TokenSnapshot CaptureProcess(SafeProcessHandle process,string role,string service)
    {
        Program.Need(role is "Setup" or "Guardian" or "App" or "Child" && PlanAdmission.ValidSid(service),"PROCESS_TOKEN_ROLE_REFUSED");
        Program.Need(OpenProcessToken(process,8,out var token),"PROCESS_TOKEN_QUERY_REFUSED");
        using(token)using(var identity=new WindowsIdentity(token.DangerousGetHandle()))return CaptureIdentity(identity,role,service);
    }
    private static TokenSnapshot CaptureIdentity(WindowsIdentity identity,string role,string service)
    {
        T Info<T>(int cls,Func<IntPtr,int,T> parse) {
            _=GetTokenInformation(identity.AccessToken,cls,IntPtr.Zero,0,out int n);
            Program.Need(n is >=4 and <=1048576,"TOKEN_LENGTH_REFUSED");var ptr=Marshal.AllocHGlobal(n);
            try {Program.Need(GetTokenInformation(identity.AccessToken,cls,ptr,n,out int written) && written>=4 && written<=n,"TOKEN_QUERY_REFUSED");return parse(ptr,written);}
            finally {Marshal.FreeHGlobal(ptr);}
        }
        string owner=Info(4,(b,n)=>{Program.Need(n>=IntPtr.Size,"TOKEN_LENGTH_REFUSED");return new SecurityIdentifier(Marshal.ReadIntPtr(b)).Value;});
        int type=Info(8,(b,_)=>Marshal.ReadInt32(b));int elevation=Info(20,(b,_)=>Marshal.ReadInt32(b));
        int matches=0;
        // This information class returns one byte on the observed host, while
        // its documented shape is DWORD. Do not weaken other token readers.
        bool restricted=TokenRestrictionReader.Read((IntPtr p,int size,out int written)=>
            GetTokenInformation(identity.AccessToken,21,p,size,out written));
        uint attributes=role=="Controller"?0:Info(2,(b,n)=>{
            int count=Marshal.ReadInt32(b),offset=IntPtr.Size==8?8:4,stride=Marshal.SizeOf<Group>();
            Program.Need(n>=offset && count>=0 && count<=(n-offset)/stride,"GROUP_COUNT_REFUSED");uint found=0;
            for(int i=0;i<count;i++){var g=Marshal.PtrToStructure<Group>(b+offset+i*stride);
                if(new SecurityIdentifier(g.Sid).Value==service){matches++;found=g.Attributes;}}return found;});
        string user=identity.User?.Value??"";
        string expected=role switch {"Controller"=>"S-1-5-32-544","Setup"=>"S-1-5-18",_=>service};
        Program.Need(type==1 && owner==expected,"TOKEN_OWNER_TYPE_REFUSED");
        if(role=="Controller")Program.Need(elevation==1,"CONTROLLER_ELEVATION_REFUSED");
        else Program.Need(ServiceIdentityPolicy.Accept(role,service,user,owner,type,matches,attributes,true,false,restricted),"SERVICE_IDENTITY_REFUSED");
        return new(user,owner,type,elevation,service,attributes,matches,restricted,true);
    }
    [StructLayout(LayoutKind.Sequential)]private struct Group {internal IntPtr Sid;internal uint Attributes;}
    [DllImport("advapi32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(SafeAccessTokenHandle token,int cls,IntPtr buffer,int size,out int needed);
    [DllImport("advapi32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenProcessToken(SafeProcessHandle process,uint access,out SafeAccessTokenHandle token);
}

internal static class TokenRestrictionReader
{
    internal delegate bool Query(IntPtr buffer,int capacity,out int written);
    internal static bool Read(Query query)
    {
        IntPtr buffer=Marshal.AllocHGlobal(4);
        try {
            // No default-false fallback: success and exact returned length are
            // checked before any read. Never inspect bytes beyond written.
            bool success=query(buffer,4,out int written);
            Program.Need(success && written is 1 or 4,"TOKEN_RESTRICTION_QUERY_REFUSED");
            return written==1?Marshal.ReadByte(buffer)!=0:Marshal.ReadInt32(buffer)!=0;
        } finally {Marshal.FreeHGlobal(buffer);}
    }
    internal static int SelfTest()
    {
        int count=0;
        foreach(int length in new[]{1,4})
        foreach(uint value in new uint[]{0,1,2,128,255}) {
            bool got=Read((IntPtr p,int capacity,out int written)=>{
                Program.Need(capacity==4,"RESTRICTION_CAPACITY_FAILED");
                Marshal.WriteInt32(p,unchecked((int)0xaaaaaaaa));
                if(length==1)Marshal.WriteByte(p,(byte)value);else Marshal.WriteInt32(p,(int)value);
                written=length;return true;
            });
            Program.Need(got==(value!=0),"RESTRICTION_VALUE_FAILED");count++;
        }
        foreach(uint value in new uint[]{256,65536,0x80000000}) {
            Program.Need(Read((IntPtr p,int capacity,out int written)=>{
                Marshal.WriteInt32(p,unchecked((int)value));written=4;return true;
            }),"RESTRICTION_DWORD_TRUNCATED");count++;
        }
        foreach(bool success in new[]{false,true})
        foreach(int length in new[]{-1,0,1,2,3,4,5,int.MaxValue}) {
            if(success && length is 1 or 4)continue;
            try {
                Read((IntPtr p,int capacity,out int written)=>{written=length;return success;});
            } catch(InvalidDataException ex) when(ex.Message=="TOKEN_RESTRICTION_QUERY_REFUSED") {count++;continue;}
            throw new InvalidDataException("RESTRICTION_REFUSAL_MISSING");
        }
        return count;
    }
}


// Shared pure policy: native token capture and both report admission paths.
// Inputs must come from a successful bounded native query, not report defaults.
internal static class ServiceIdentityPolicy
{
    public static bool Accept(string role,string expectedSid,string user,string owner,int type,
        int groupCount,uint groupAttributes,bool queryComplete,bool impersonating,bool restricted)
    {
        if(!queryComplete || impersonating || restricted || type!=1 || groupCount<0 || groupCount>1)
            return false;
        if(expectedSid==null || !System.Text.RegularExpressions.Regex.IsMatch(expectedSid,@"\AS-1-5-80-\d+-\d+-\d+-\d+-\d+\z"))return false;
        foreach(string value in expectedSid.Substring(9).Split('-')) {
            uint parsed;if(!uint.TryParse(value,out parsed))return false;
        }
        bool virtualRole=role=="Guardian" || role=="App" || role=="Child";
        if(!virtualRole && role!="Setup")return false;
        string expectedUser=virtualRole?expectedSid:"S-1-5-18";
        if(user!=expectedUser || owner!=expectedUser)return false;
        // Never invent SE_GROUP_ENABLED when the SID is TokenUser, not a group.
        if(groupCount==0)return virtualRole && groupAttributes==0;
        // A present disabled or deny-only group is never treated as absent.
        return (groupAttributes&4)!=0 && (groupAttributes&16)==0;
    }
    public static int SelfTest()
    {
        const string sid="S-1-5-80-352077755-3436833279-1920633778-1136893238-1139765240";
        int cases=0;
        foreach(string role in new[]{"Guardian","App","Child","Setup"})
        foreach(int count in new[]{-1,0,1,2})
        foreach(uint flags in new uint[]{0,4,14,16,20})
        foreach(bool rightUser in new[]{false,true})
        foreach(bool rightOwner in new[]{false,true})
        foreach(int type in new[]{1,2}) {
            string expected=role=="Setup"?"S-1-5-18":sid;
            bool groupOk=count==0?(role!="Setup" && flags==0):count==1 && (flags==4 || flags==14);
            bool want=rightUser && rightOwner && type==1 && groupOk;
            bool got=Accept(role,sid,rightUser?expected:"S-1-5-18-WRONG",rightOwner?expected:"WRONG",type,count,flags,true,false,false);
            if(got!=want)throw new Exception("IDENTITY_MATRIX_FAILED");cases++;
        }
        foreach(string role in new[]{"Guardian","App","Child","Setup"}) {
            string expected=role=="Setup"?"S-1-5-18":sid;
            if(Accept(role,sid,expected,expected,1,1,4,false,false,false))throw new Exception("INCOMPLETE_QUERY_ACCEPTED");cases++;
            if(Accept(role,sid,expected,expected,1,1,4,true,true,false))throw new Exception("IMPERSONATION_ACCEPTED");cases++;
            if(Accept(role,sid,expected,expected,1,1,4,true,false,true))throw new Exception("RESTRICTED_ACCEPTED");cases++;
        }
        foreach(string bad in new[]{"","S-1-5-18","S-1-5-80-1-2-3-4-4294967296","S-1-5-80-1-2-3-4-5\n"}) {
            if(Accept("Guardian",bad,bad,bad,1,0,0,true,false,false))throw new Exception("BAD_SID_ACCEPTED");cases++;
        }
        foreach(string role in new[]{"Controller","guardian","Other",""}) {
            if(Accept(role,sid,sid,sid,1,0,0,true,false,false))throw new Exception("BAD_ROLE_ACCEPTED");cases++;
        }
        return cases;
    }
}
