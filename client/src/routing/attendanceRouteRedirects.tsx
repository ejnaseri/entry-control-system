import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getEmployee } from "../api/employees";
import { NotFoundPage } from "./NotFoundPage";

export function MembersRedirect() { return <Navigate replace to="/employees" />; }
export function MemberAddRedirect() { return <Navigate replace to="/employees/add" />; }
export function MemberDetailRedirect() {
  return <GuardedEmployeeRedirect edit={false} />;
}
export function MemberEditRedirect() {
  return <GuardedEmployeeRedirect edit />;
}

function GuardedEmployeeRedirect({ edit }: { edit: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!id) { setAllowed(false); return; }
    let active = true;
    void getEmployee(id).then(() => { if (active) setAllowed(true); }).catch(() => { if (active) setAllowed(false); });
    return () => { active = false; };
  }, [id]);
  if (allowed === null) return <div className="p-6 text-center text-slate-400">Loading…</div>;
  if (!allowed || !id) return <NotFoundPage />;
  return <Navigate replace to={`/employees/${id}${edit ? "/edit" : ""}`} />;
}
