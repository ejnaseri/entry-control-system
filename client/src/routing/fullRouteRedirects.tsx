import { Navigate } from "react-router-dom";

export function PaymentsRedirect() {
  return <Navigate to="/payments/memberships" replace />;
}
