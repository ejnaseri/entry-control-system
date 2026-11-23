// TEST_ONLY_DO_NOT_TRUST
//
// Every scalar is publicly derivable from its ASCII label. These keys provide
// fixture isolation by signer purpose, denial state and environment. They remain
// fully capable cryptographic keys and are unsafe by design because every private
// scalar is public. Safety therefore depends on the enforced production import,
// artifact, and trust-registry boundaries around licensing/vectors/**.

import {
  deriveTestOnlyPrivateScalar,
  publicSpkiFromPrivateScalar,
  sha256,
} from "../lib/ecdsa-rfc6979.mjs";

const specifications = [
  ["TEST_ONLY_PROD_ROOT_PRIMARY", "PROD_ROOT", "TEST", "TRUSTED"],
  ["TEST_ONLY_PROD_ROOT_WRONG_ENV", "PROD_ROOT", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_INSTALLATION_DEVICE_PRIMARY", "INSTALLATION_DEVICE", "TEST", "TRUSTED"],
  ["TEST_ONLY_INSTALLATION_DEVICE_REBIND", "INSTALLATION_DEVICE", "TEST", "TRUSTED"],
  ["TEST_ONLY_INSTALLATION_DEVICE_WRONG_ENV", "INSTALLATION_DEVICE", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY", "OFFLINE_ENTITLEMENT", "TEST", "TRUSTED"],
  ["TEST_ONLY_ONLINE_LEASE_PRIMARY", "ONLINE_LEASE", "TEST", "TRUSTED"],
  ["TEST_ONLY_OFFLINE_CONTROL_PRIMARY", "OFFLINE_CONTROL", "TEST", "TRUSTED"],
  ["TEST_ONLY_RECOVERY_PRIMARY", "RECOVERY", "TEST", "TRUSTED"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED", "OFFLINE_ENTITLEMENT", "TEST", "DENIED"],
  ["TEST_ONLY_ONLINE_LEASE_DENIED", "ONLINE_LEASE", "TEST", "DENIED"],
  ["TEST_ONLY_OFFLINE_CONTROL_DENIED", "OFFLINE_CONTROL", "TEST", "DENIED"],
  ["TEST_ONLY_RECOVERY_DENIED", "RECOVERY", "TEST", "DENIED"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_WRONG_ENV", "OFFLINE_ENTITLEMENT", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_ONLINE_LEASE_WRONG_ENV", "ONLINE_LEASE", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_OFFLINE_CONTROL_WRONG_ENV", "OFFLINE_CONTROL", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_RECOVERY_WRONG_ENV", "RECOVERY", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_UNKNOWN_SIGNER", "UNKNOWN", "TEST", "UNKNOWN"],
];

export const TEST_ONLY_KEYS = Object.freeze(Object.fromEntries(specifications.map(([id, purpose, environment, trustClass]) => {
  const privateScalar = deriveTestOnlyPrivateScalar(id);
  const spkiDer = publicSpkiFromPrivateScalar(privateScalar);
  const kid = sha256(spkiDer);
  return [id, Object.freeze({ id, purpose, environment, trustClass, privateScalar, spkiDer, kid })];
})));

export function testOnlyKey(id) {
  const key = TEST_ONLY_KEYS[id];
  if (!key) throw new Error(`Unknown TEST_ONLY key ${id}.`);
  return key;
}
