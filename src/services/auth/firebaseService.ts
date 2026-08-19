import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { AppError } from '../../errors/app-error';
import { env } from '../../env';

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
  project_id: string;
};

const createCredential = () => {
  if (env.FIREBASE_SERVICE_ACCOUNT === 'application-default') return applicationDefault();

  try {
    const value = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccountJson;
    const serviceAccount: ServiceAccount = {
      clientEmail: value.client_email,
      privateKey: value.private_key.replace(/\\n/g, '\n'),
      projectId: value.project_id,
    };
    return cert(serviceAccount);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must contain valid service-account JSON.');
  }
};

const firebaseApp = getApps()[0] ?? initializeApp({ credential: createCredential() });

export const firebaseAuth = getAuth(firebaseApp);

type FirebasePasswordLoginResponse = {
  email: string;
  expiresIn: string;
  idToken: string;
  localId: string;
  refreshToken: string;
};

export const signInWithPassword = async (email: string, password: string): Promise<FirebasePasswordLoginResponse> => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  if (!response.ok) {
    throw new AppError('Invalid email or password.', 401);
  }

  return response.json() as Promise<FirebasePasswordLoginResponse>;
};
