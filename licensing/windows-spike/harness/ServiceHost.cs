using System.ComponentModel;
using System.Runtime.InteropServices;

namespace Ecs.Lic008;

internal static class ServiceHost
{
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    delegate void MainDelegate(uint count, IntPtr args);
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    delegate uint Handler(uint control, uint eventType, IntPtr eventData, IntPtr context);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct Entry { public string? Name; public MainDelegate? Main; }
    [StructLayout(LayoutKind.Sequential)]
    struct Status
    {
        public uint Type, State, Accepted, Win32Exit, SpecificExit, Checkpoint, WaitHint;
    }
    static IntPtr statusHandle;
    static readonly Handler handler = Control;
    static void Set(uint state, uint exit = 0)
    {
        var status = new Status { Type = 0x10, State = state, Accepted = state == 4 ? 1u : 0u, Win32Exit = exit };
        if (!SetServiceStatus(statusHandle, ref status)) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    static uint Control(uint code, uint eventType, IntPtr data, IntPtr context)
    {
        if (code == 1)
        {
            // Test interruption is an unknown outcome, never a success receipt.
            try { Set(1, 1067); } finally { Environment.Exit(130); }
        }
        return 0;
    }
    public static void Run(string name, Action execute)
    {
        MainDelegate main = (_, _) =>
        {
            statusHandle = RegisterServiceCtrlHandlerExW(name, handler, IntPtr.Zero);
            if (statusHandle == IntPtr.Zero) return;
            uint exit = 0;
            try { Set(4); execute(); }
            catch { exit = 1067; }
            finally { Set(1, exit); }
        };
        var table = new[] { new Entry { Name = name, Main = main }, new Entry() };
        if (!StartServiceCtrlDispatcherW(table)) throw new Win32Exception(Marshal.GetLastWin32Error());
        GC.KeepAlive(main); GC.KeepAlive(handler);
    }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool StartServiceCtrlDispatcherW([In] Entry[] entries);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr RegisterServiceCtrlHandlerExW(string name, Handler callback, IntPtr context);
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool SetServiceStatus(IntPtr handle, ref Status status);
}
