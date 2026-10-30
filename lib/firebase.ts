// Firebase faqat Google orqali kirish uchun: brauzer Google'dan ID token oladi, server (lib/api.ts) uni tekshirib o'z sessiyasini ochadi.
// Bu qiymatlar maxfiy emas: Firebase veb-konfiguratsiyasi brauzerga ochiq bo'lishi uchun mo'ljallangan.
const firebaseConfig = {
  apiKey: 'AIzaSyCgufWyTyQtT3q4yY7JW-V5BEjdjsoZzQI',
  authDomain: 'smena-855fd.firebaseapp.com',
  projectId: 'smena-855fd',
  storageBucket: 'smena-855fd.firebasestorage.app',
  messagingSenderId: '551559877653',
  appId: '1:551559877653:web:96ffc4d20e1078fb5c6a1c',
};

const ERRORS: Record<string, string> = {
  'auth/popup-blocked': 'Brauzer Google oynasini to‘sdi. Tugmani yana bir bor bosing; takrorlansa, brauzerda bu sayt uchun qalqib chiquvchi oynalarga (pop-up) ruxsat bering',
  'auth/network-request-failed': 'Internet aloqasi yo‘q. Ulanib, qayta urinib ko‘ring',
  'auth/unauthorized-domain': 'Bu manzil Firebase’da ruxsat etilmagan (Authentication → Settings → Authorized domains)',
  'auth/operation-not-allowed': 'Firebase’da Google orqali kirish yoqilmagan (Authentication → Sign-in method)',
};

type Firebase = { auth: import('firebase/auth').Auth; lib: typeof import('firebase/auth') };
let firebase: Firebase | undefined;
let loading: Promise<Firebase> | undefined;

// Firebase kutubxonasi og'ir: sahifa ochilganda fonda yuklanadi (tugma ko'ringanda chaqiriladi)
export function preloadGoogle() {
  loading ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(([app, lib]) => (
    firebase = { auth: lib.getAuth(app.getApps()[0] ?? app.initializeApp(firebaseConfig)), lib }
  )).catch((e) => { loading = undefined; throw e; }); // internet uzilgan bo'lsa, keyingi bosishda qayta urinadi
  return loading;
}

// Google oynasini ochadi; foydalanuvchi oynani yopsa null.
// Brauzer yangi oynani faqat bosish paytining o'zida ochishga ruxsat beradi: orada yuklash kutilsa, oynani to'sadi.
// Shuning uchun kutubxona oldindan yuklangan bo'lsa, oyna hech narsa kutmasdan ochiladi.
export async function googleIdToken() {
  const { auth, lib: { GoogleAuthProvider, signInWithPopup, signOut } } = firebase ?? await preloadGoogle();
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    const idToken = await user.getIdToken();
    // Firebase sessiyasi kerak emas: bundan keyin kirish bizning sid cookie bilan
    await signOut(auth);
    return idToken;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    throw new Error(ERRORS[code] ?? 'Google orqali kirib bo‘lmadi. Qayta urinib ko‘ring');
  }
}
