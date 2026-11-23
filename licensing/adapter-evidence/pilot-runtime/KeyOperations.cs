using Microsoft.Win32.SafeHandles;
using EntryControl.TestOnly;
namespace EntryControl.TestOnly.Runtime;
internal sealed record KeyIntent(int SchemaVersion,string ExperimentId,string Label,string Name);
internal sealed record KeyOwned(int SchemaVersion,string ExperimentId,string Label,string Name,string PublicSha256);
internal sealed record PublicControl(int SchemaVersion,string ExperimentId,KeyOwned[] Keys);
internal static class KeyOperations
{
    internal static readonly string[] Labels={"restricted","app-readable"};
    internal static string Name(PilotPlan p,string label){Program.Need(Labels.Contains(label) && Program.Hex(p.ExperimentId,32),"KEY_NAME_REFUSED");return Program.Prefix+".TEST_ONLY."+p.ExperimentId+"."+label;}
    internal static CngKey Create(PilotPlan p,string label)
    {
        CreationFlags(0x20,0x40);
        NativeTokens.Capture("Setup");string name=Name(p,label);
        Check(NCryptOpenStorageProvider(out var provider,Program.Provider,0));using(provider) {
            Check(NCryptIsAlgSupported(provider,"RSA",0));Check(NCryptCreatePersistedKey(provider,out var handle,"RSA",name,0,0x20));
            using(handle) {
                Set(handle,"Length",BitConverter.GetBytes(3072),0);Set(handle,"Export Policy",BitConverter.GetBytes(0),0);
                Set(handle,"Key Usage",BitConverter.GetBytes(1),0);
                var sd=new RawSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;"+p.GuardianSid+")"+
                    (label=="app-readable"?"(A;;GA;;;"+p.AppSid+")":""));var bytes=new byte[sd.BinaryLength];sd.GetBinaryForm(bytes,0);
                Set(handle,"Security Descr",bytes,4);Check(NCryptFinalizeKey(handle,0x40));return CngKey.Open(handle,CngKeyHandleOpenOptions.None);
            }
        }
    }
    internal static CngKey Open(PilotPlan p,string label)=>CngKey.Open(Name(p,label),new CngProvider(Program.Provider),CngKeyOpenOptions.MachineKey|CngKeyOpenOptions.Silent);
    internal static void CreationFlags(int create,int finalize)=>Program.Need(create==0x20 && finalize==0x40,"KEY_CREATION_FLAGS_REFUSED");
    internal static string CompareCreatedAndReopened(Func<string> created,Func<string,string> reopen)
    {
        string expected=created();Program.Need(Program.Hex(expected,64),"CREATED_IDENTITY_REFUSED");
        string actual=reopen(expected);Program.Need(Program.Hex(actual,64) && actual==expected,"PERSISTED_IDENTITY_REFUSED");return expected;
    }
    internal static string VerifyNewlyPersisted(CngKey created,PilotPlan p,string label)=>CompareCreatedAndReopened(
        ()=>Verify(created,p,label),expected=>{using var reopened=Open(p,label);return Verify(reopened,p,label,expected);});
    internal static int SelfTest()
    {
        int count=0;void Reject(Action action){try{action();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("KEY_RULE_REFUSAL_MISSING");}
        CreationFlags(32,64);count++;
        foreach(int flags in new[]{0,128,160,96,-1})Reject(()=>CreationFlags(flags,64));
        foreach(int flags in new[]{0,8,72,68,-1})Reject(()=>CreationFlags(32,flags));
        string h=new('a',64);var trace=new List<string>();
        Program.Need(CompareCreatedAndReopened(()=>{trace.Add("created");return h;},expected=>{trace.Add("reopened");Program.Need(expected==h,"EXPECTED_IDENTITY_FAILED");return h;})==h &&
            trace.SequenceEqual(new[]{"created","reopened"}),"KEY_READBACK_ORDER_FAILED");count++;
        bool called=false;Reject(()=>CompareCreatedAndReopened(()=>"bad",expected=>{called=true;return expected;}));Program.Need(!called,"INVALID_CREATED_REOPENED");count++;
        foreach(string actual in new[]{new string('b',64),"bad",""})Reject(()=>CompareCreatedAndReopened(()=>h,_=>actual));
        Reject(()=>CompareCreatedAndReopened(()=>throw new InvalidDataException("CREATED_UNKNOWN"),_=>h));
        Reject(()=>CompareCreatedAndReopened(()=>h,_=>throw new InvalidDataException("REOPEN_UNKNOWN")));
        bool ownedWritten=false;Reject(()=>{CompareCreatedAndReopened(()=>h,_=>throw new InvalidDataException("REOPEN_POLICY_OR_ACCESS_UNKNOWN"));ownedWritten=true;});
        Program.Need(!ownedWritten,"OWNED_RECORD_ON_UNKNOWN");count++;return count;
    }
    internal static string Verify(CngKey key,PilotPlan p,string label,string? expectedPublic=null)
    {
        Program.Need(key.Provider?.Provider==Program.Provider && key.IsMachineKey && key.Algorithm.Algorithm=="RSA" &&
            key.KeySize==3072 && key.ExportPolicy==CngExportPolicies.None && key.KeyUsage==CngKeyUsages.Decryption,"KEY_POLICY_REFUSED");
        var raw=key.GetProperty("Security Descr",(CngPropertyOptions)4).GetValue();Program.Need(raw is not null,"KEY_DACL_MISSING");
        var sd=new RawSecurityDescriptor(raw!,0);var principals=label=="restricted"?new[]{"S-1-5-18",p.GuardianSid}:new[]{"S-1-5-18",p.GuardianSid,p.AppSid};
        Program.Need(sd.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclProtected) && sd.DiscretionaryAcl?.Count==principals.Length,"KEY_DACL_REFUSED");
        var seen=new HashSet<string>();foreach(GenericAce rawAce in sd.DiscretionaryAcl!) {
            Program.Need(rawAce is CommonAce,"KEY_ACE_TYPE_REFUSED");var ace=(CommonAce)rawAce;
            Program.Need(!ace.IsCallback && ace.AceQualifier==AceQualifier.AccessAllowed && ace.AceFlags==AceFlags.None &&
                principals.Contains(ace.SecurityIdentifier.Value) && seen.Add(ace.SecurityIdentifier.Value) &&
                unchecked((uint)ace.AccessMask) is 0x10000000 or 0xd01f01ff,"KEY_ACE_REFUSED");
        }
        using var rsa=new RSACng(key);string hash=Program.Hash(rsa.ExportSubjectPublicKeyInfo());
        Program.Need(expectedPublic is null || hash==expectedPublic,"PUBLIC_IDENTITY_REFUSED");return hash;
    }
    internal static KeyOwned Owned(PilotPlan p,string label)
    {
        var intent=Program.Parse<KeyIntent>(SecureFiles.Read("protected/"+label+"-intent.json",p.GuardianSid,p.AppSid,p));
        var owned=Program.Parse<KeyOwned>(SecureFiles.Read("protected/"+label+"-owned.json",p.GuardianSid,p.AppSid,p));
        Program.Need(intent.SchemaVersion==1 && owned.SchemaVersion==1 && intent.ExperimentId==p.ExperimentId && owned.ExperimentId==p.ExperimentId &&
            intent.Label==label && owned.Label==label && intent.Name==Name(p,label) && owned.Name==intent.Name && Program.Hex(owned.PublicSha256,64),"OWNERSHIP_CHAIN_REFUSED");return owned;
    }
    internal static void ExportDenied(CngKey key)
    {
        foreach(var format in new[]{CngKeyBlobFormat.GenericPrivateBlob,CngKeyBlobFormat.Pkcs8PrivateBlob,CngKeyBlobFormat.OpaqueTransportBlob}) {
            byte[]? bytes=null;try {bytes=key.Export(format);}
            catch(CryptographicException ex) when(unchecked((uint)ex.HResult)==0x80090010){continue;}
            finally {if(bytes is not null)CryptographicOperations.ZeroMemory(bytes);}
            throw new InvalidDataException("PRIVATE_EXPORT_SUCCEEDED");
        }
    }
    private static FixtureContext Context(PilotPlan p,string publicHash)=>new(1,Convert.FromHexString(p.ExperimentId),0,
        SHA256.HashData(Encoding.ASCII.GetBytes("TEST_FIXTURE_ONLY")),Convert.FromHexString(publicHash),Convert.FromHexString(p.ProfileSha256));
    internal static (byte[] Envelope,string ExpectedHash) Seal(CngKey key,PilotPlan p,string publicHash)
    {
        var plain=RandomNumberGenerator.GetBytes(128);var dataKey=RandomNumberGenerator.GetBytes(32);
        try {
            var nonce=RandomNumberGenerator.GetBytes(12);var wrapped=Oaep(key,dataKey,true);
            var ciphertext=new byte[plain.Length];var tag=new byte[16];var context=Context(p,publicHash);
            var header=CandidateCodec.Encode(context,nonce,wrapped,ciphertext,tag);
            using var aes=new AesGcm(dataKey,16);aes.Encrypt(nonce,plain,ciphertext,tag,CandidateCodec.Aad(header));
            var envelope=CandidateCodec.Encode(context,nonce,wrapped,ciphertext,tag);string expected=Program.Hash(plain);
            OpenFixture(key,p,publicHash,envelope,expected);return(envelope,expected);
        } finally {CryptographicOperations.ZeroMemory(plain);CryptographicOperations.ZeroMemory(dataKey);}
    }
    internal static void OpenFixture(CngKey key,PilotPlan p,string publicHash,byte[] input,string expectedHash)
    {
        Program.Need(Program.Hex(expectedHash,64),"EXPECTED_HASH_REFUSED");
        var bytes=CandidateCodec.SnapshotAndValidate(input,Context(p,publicHash));
        byte[] dataKey=Oaep(key,bytes.AsSpan(150,384).ToArray(),false);var plain=new byte[bytes.Length-CandidateCodec.Header-16];
        try {Program.Need(dataKey.Length==32,"DATA_KEY_SIZE_REFUSED");using var aes=new AesGcm(dataKey,16);
            aes.Decrypt(bytes.AsSpan(138,12),bytes.AsSpan(CandidateCodec.Header,plain.Length),bytes.AsSpan(bytes.Length-16),plain,CandidateCodec.Aad(bytes));
            Program.Need(Program.Hash(plain)==expectedHash,"PAYLOAD_HASH_REFUSED");}
        finally {CryptographicOperations.ZeroMemory(dataKey);CryptographicOperations.ZeroMemory(plain);}
    }
    internal static void MutationMatrix(CngKey key,PilotPlan p,string publicHash,byte[] envelope,string expectedHash)
    {
        foreach(int offset in new[]{0,13,14,30,38,70,102,134,138,150,534,envelope.Length-1}) {
            var changed=(byte[])envelope.Clone();changed[offset]^=1;bool refused=false;
            try {OpenFixture(key,p,publicHash,changed,expectedHash);}catch(FormatException){refused=true;}catch(CryptographicException){refused=true;}
            Program.Need(refused,"MUTATION_NOT_REFUSED");
        }
    }
    internal static int OpenStatus(PilotPlan p,string label)
    {
        IntPtr provider=IntPtr.Zero,key=IntPtr.Zero;
        try {int status=OpenProviderRaw(out provider,Program.Provider,0);if(status!=0)throw new CryptographicException(status);
            return NCryptOpenKey(provider,out key,Name(p,label),0,0x60);}
        finally {if(key!=IntPtr.Zero)NCryptFreeObject(key);if(provider!=IntPtr.Zero)NCryptFreeObject(provider);}
    }
    private static byte[] Oaep(CngKey key,byte[] input,bool encrypt)
    {
        var padding=new Padding {Algorithm="SHA256"};int n;
        int status=encrypt?NCryptEncrypt(key.Handle,input,input.Length,ref padding,null,0,out n,0x44):NCryptDecrypt(key.Handle,input,input.Length,ref padding,null,0,out n,0x44);
        Check(status);Program.Need(n is >0 and <=384,"OAEP_SIZE_REFUSED");var output=new byte[n];
        try {Check(encrypt?NCryptEncrypt(key.Handle,input,input.Length,ref padding,output,n,out n,0x44):NCryptDecrypt(key.Handle,input,input.Length,ref padding,output,n,out n,0x44));
            Program.Need(n>0 && n<=output.Length && (encrypt?n==384:n==32),"OAEP_LENGTH_REFUSED");
            if(n==output.Length)return output;
            var trimmed=output.AsSpan(0,n).ToArray();CryptographicOperations.ZeroMemory(output);return trimmed;}
        catch {CryptographicOperations.ZeroMemory(output);throw;}
    }
    private static void Check(int status){if(status!=0)throw new CryptographicException(status);}
    private static void Set(SafeNCryptKeyHandle key,string property,byte[] value,int flags)=>Check(NCryptSetProperty(key,property,value,value.Length,flags));
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]private struct Padding {[MarshalAs(UnmanagedType.LPWStr)]internal string Algorithm;internal IntPtr Label;internal int Length;}
    [DllImport("ncrypt.dll",CharSet=CharSet.Unicode)]private static extern int NCryptOpenStorageProvider(out SafeNCryptProviderHandle handle,string name,int flags);
    [DllImport("ncrypt.dll",CharSet=CharSet.Unicode,EntryPoint="NCryptOpenStorageProvider")]private static extern int OpenProviderRaw(out IntPtr handle,string name,int flags);
    [DllImport("ncrypt.dll",CharSet=CharSet.Unicode)]private static extern int NCryptIsAlgSupported(SafeNCryptProviderHandle provider,string algorithm,int flags);
    [DllImport("ncrypt.dll",CharSet=CharSet.Unicode)]private static extern int NCryptCreatePersistedKey(SafeNCryptProviderHandle provider,out SafeNCryptKeyHandle key,string algorithm,string name,int legacy,int flags);
    [DllImport("ncrypt.dll",CharSet=CharSet.Unicode)]private static extern int NCryptSetProperty(SafeNCryptKeyHandle key,string property,byte[] value,int length,int flags);
    [DllImport("ncrypt.dll")]private static extern int NCryptFinalizeKey(SafeNCryptKeyHandle key,int flags);
    [DllImport("ncrypt.dll",CharSet=CharSet.Unicode)]private static extern int NCryptOpenKey(IntPtr provider,out IntPtr key,string name,int legacy,int flags);
    [DllImport("ncrypt.dll")]private static extern int NCryptFreeObject(IntPtr handle);
    [DllImport("ncrypt.dll")]private static extern int NCryptEncrypt(SafeNCryptKeyHandle key,byte[] input,int length,ref Padding padding,[Out]byte[]? output,int size,out int written,int flags);
    [DllImport("ncrypt.dll")]private static extern int NCryptDecrypt(SafeNCryptKeyHandle key,byte[] input,int length,ref Padding padding,[Out]byte[]? output,int size,out int written,int flags);
}
