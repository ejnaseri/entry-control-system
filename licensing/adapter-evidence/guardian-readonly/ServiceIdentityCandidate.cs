using System;
using System.Text.RegularExpressions;

// PURE CANDIDATE ONLY. No native calls, report admission, or production wiring.
// Inputs must come from a successful bounded native query, not report defaults.
public static class ServiceIdentityCandidate
{
    public static bool Accept(string role,string expectedSid,string user,string owner,int type,
        int groupCount,uint groupAttributes,bool queryComplete,bool impersonating,bool restricted)
    {
        if(!queryComplete || impersonating || restricted || type!=1 || groupCount<0 || groupCount>1)
            return false;
        if(expectedSid==null || !Regex.IsMatch(expectedSid,@"\AS-1-5-80-\d+-\d+-\d+-\d+-\d+\z"))return false;
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
