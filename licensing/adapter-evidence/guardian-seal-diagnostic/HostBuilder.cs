using System;
using System.IO;
using Microsoft.NET.HostModel.AppHost;
internal static class HostBuilder
{
    public static void Main(string[] args)
    {
        if(args.Length!=2 || File.Exists(args[1]))throw new InvalidDataException("NEW_HOST_ONLY");
        HostWriter.CreateAppHost(args[0],args[1],"GuardianSealDiagnostic.dll",
            dotNetSearchOptions:new HostWriter.DotNetSearchOptions {Location=HostWriter.DotNetSearchOptions.SearchLocation.Global});
    }
}
