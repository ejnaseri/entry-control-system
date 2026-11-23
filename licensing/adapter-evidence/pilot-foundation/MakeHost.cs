using System;
using System.IO;
using Microsoft.NET.HostModel.AppHost;
internal static class MakeHost
{
    internal static void Main(string[] args)
    {
        if(args.Length!=2 || File.Exists(args[1])) throw new ArgumentException("NEW_HOST_ONLY");
        HostWriter.CreateAppHost(args[0],args[1],"EntryControl.PilotFoundation.dll",
            dotNetSearchOptions:new HostWriter.DotNetSearchOptions {Location=HostWriter.DotNetSearchOptions.SearchLocation.AppLocal});
    }
}
