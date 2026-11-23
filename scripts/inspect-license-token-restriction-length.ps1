[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Review-only: current process token; no elevation, services, files or key writes.
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Security.Principal;
public static class RestrictionLengthReview {
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int cls,IntPtr data,int size,out int written);
 public static string Run() {
  using(var id=WindowsIdentity.GetCurrent()) {
   int needed;bool first=GetTokenInformation(id.Token,21,IntPtr.Zero,0,out needed);
   int sizingError=Marshal.GetLastWin32Error();IntPtr p=Marshal.AllocHGlobal(4);
   try {
    for(int i=0;i<4;i++)Marshal.WriteByte(p,i,0xaa);
    int written;bool ok=GetTokenInformation(id.Token,21,p,4,out written);
    int queryError=ok?0:Marshal.GetLastWin32Error();
    return "sizingSuccess="+first+" sizingError="+sizingError+" required="+needed+
     " querySuccess="+ok+" queryError="+queryError+" written="+written+" bytes="+
     Marshal.ReadByte(p,0).ToString("x2")+Marshal.ReadByte(p,1).ToString("x2")+
     Marshal.ReadByte(p,2).ToString("x2")+Marshal.ReadByte(p,3).ToString("x2");
   } finally {Marshal.FreeHGlobal(p);}
  }
 }
}
'@
[RestrictionLengthReview]::Run()
