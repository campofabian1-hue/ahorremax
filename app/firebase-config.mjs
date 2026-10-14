// Public Firebase WEB configuration only. Never place private keys or Meta secrets here.
// Enable both providers and deploy firestore.rules before configuring this object.
export function authDomainForHost(hostname) {
  return ['fcfinanzas.com', 'ahorremax-c1e48.web.app'].includes(hostname)
    ? hostname
    : 'ahorremax-c1e48.firebaseapp.com';
}

export const firebaseConfig = {
  apiKey: 'AIzaSyC6TYTAIxrOUf_OYz-EFws3kBKIa7eCy4Y',
  authDomain: authDomainForHost(typeof location === 'undefined' ? '' : location.hostname),
  projectId: 'ahorremax-c1e48',
  storageBucket: 'ahorremax-c1e48.firebasestorage.app',
  messagingSenderId: '764434714902',
  appId: '1:764434714902:web:8ea77697c5bf4d70668037',
};
export const providersReady = { google:true, facebook:false };
