import 'server-only';

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

export type WebAuthnCredentialDescriptor = {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
};

function getRpConfig() {
  const rpID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
  const rpName = process.env.WEBAUTHN_RP_NAME ?? 'VoxLibre';
  const origin = process.env.WEBAUTHN_ORIGIN ?? `http://${rpID}:3000`;
  return { rpID, rpName, origin };
}

export async function createRegistrationOptions(params: {
  userId: string;
  userName: string;
  userDisplayName?: string;
  existingCredentials?: WebAuthnCredentialDescriptor[];
  challenge?: Uint8Array;
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpName, rpID } = getRpConfig();
  const { userId, userName, userDisplayName = '', existingCredentials = [], challenge } = params;

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName,
    userID: new TextEncoder().encode(userId) as never,
    userDisplayName,
    challenge: challenge as never,
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257],
  });

  return options;
}

export async function verifyRegistration(params: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  expectedOrigin?: string;
  expectedRPID?: string;
}): Promise<{
  verified: boolean;
  credential?: {
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
  };
}> {
  const { origin, rpID } = getRpConfig();
  const { response, expectedChallenge, expectedOrigin = origin, expectedRPID = rpID } = params;

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential } = verification.registrationInfo;
  // credential is { id, publicKey, counter, transports } in newer simplewebauthn
  // Normalize: ensure id is base64url string, publicKey is Uint8Array
  const credentialId: string = (credential as unknown as { id: string }).id ?? response.id;
  const publicKey: Uint8Array = (credential as unknown as { publicKey: Uint8Array }).publicKey;
  const counter: number = (credential as unknown as { counter: number }).counter ?? 0;
  const transports = (credential as unknown as { transports?: AuthenticatorTransportFuture[] }).transports;

  return {
    verified: true,
    credential: {
      credentialId,
      publicKey,
      counter,
      transports,
    },
  };
}

export async function createAuthenticationOptions(params: {
  existingCredentials?: WebAuthnCredentialDescriptor[];
  challenge?: Uint8Array;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = getRpConfig();
  const { existingCredentials = [], challenge, userVerification = 'preferred' } = params;

  const options = await generateAuthenticationOptions({
    rpID,
    challenge: challenge ? Buffer.from(challenge).toString('base64url') : undefined,
    allowCredentials:
      existingCredentials.length > 0
        ? existingCredentials.map((cred) => ({
            id: cred.credentialId,
            transports: cred.transports,
          }))
        : undefined,
    userVerification,
  });

  return options;
}

export async function verifyAuthentication(params: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin?: string;
  expectedRPID?: string;
  credential: WebAuthnCredentialDescriptor;
}): Promise<{
  verified: boolean;
  newCounter: number;
}> {
  const { origin, rpID } = getRpConfig();
  const { response, expectedChallenge, expectedOrigin = origin, expectedRPID = rpID, credential } = params;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    credential: {
      id: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
    } as never,
  });

  if (!verification.verified) {
    return { verified: false, newCounter: credential.counter };
  }

  const newCounter = verification.authenticationInfo?.newCounter ?? credential.counter;

  return { verified: true, newCounter };
}

export function getRegistrationTokenFromRequest(request: Request): string | null {
  const headerToken = request.headers.get('x-registration-token');
  if (headerToken) return headerToken.trim() || null;
  return null;
}

export function isRegistrationAllowed(request: Request): boolean {
  const requiredToken = process.env.REGISTRATION_TOKEN;
  if (!requiredToken) {
    // If no token configured, allow registration (open in dev)
    return true;
  }
  const provided = getRegistrationTokenFromRequest(request);
  if (provided && provided === requiredToken) return true;

  // Also check body token via query? For route handlers that parse JSON, we check there.
  return false;
}
