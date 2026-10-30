// Firebase Auth faqat tasdiqlash uchun: Google orqali kirish va telefonga SMS kod. Brauzer Firebase'dan ID token oladi,
// server (lib/api.ts) uni tekshirib o'z sessiyasini ochadi.
// Bu qiymatlar maxfiy emas: Firebase veb-konfiguratsiyasi brauzerga ochiq bo'lishi uchun mo'ljallangan.
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

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
  'auth/invalid-phone-number': 'Telefon raqam noto‘g‘ri. +998 90 123 45 67 ko‘rinishida kiriting',
  'auth/too-many-requests': 'Bu raqamga juda ko‘p kod so‘raldi. Birozdan keyin qayta urinib ko‘ring',
  'auth/quota-exceeded': 'Bugungi SMS chegarasi tugadi. Ertaga qayta urinib ko‘ring yoki parol bilan kiring',
  'auth/invalid-verification-code': 'Kod noto‘g‘ri. SMS dagi 6 xonali kodni kiriting',
  'auth/code-expired': 'Kod muddati o‘tdi. Yangi kod oling',
  'auth/captcha-check-failed': 'Robot emasligingiz tasdiqlanmadi. Sahifani yangilab, qayta urinib ko‘ring',
  'auth/billing-not-enabled': 'SMS yuborish hali yoqilmagan (Firebase’da Blaze tarifi kerak)',
  'auth/admin-restricted-operation': 'SMS yuborish hali yoqilmagan (Firebase’da Phone kirish usuli kerak)',
};
const errorOf = (e: unknown, fallback: string) => new Error(ERRORS[(e as { code?: string }).code ?? ''] ?? fallback);

type Firebase = { auth: import('firebase/auth').Auth; lib: typeof import('firebase/auth') };
let firebase: Firebase | undefined;
let loading: Promise<Firebase> | undefined;

// Firebase kutubxonasi og'ir: sahifa ochilganda fonda yuklanadi (kirish/ro'yxat formasi ko'ringanda chaqiriladi)
export function preloadFirebase() {
  loading ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(([app, lib]) => {
    const auth = lib.getAuth(app.getApps()[0] ?? app.initializeApp(firebaseConfig));
    auth.languageCode = 'uz';
    return (firebase = { auth, lib });
  }).catch((e) => { loading = undefined; throw e; }); // internet uzilgan bo'lsa, keyingi bosishda qayta urinadi
  return loading;
}

// Google oynasini ochadi; foydalanuvchi oynani yopsa null.
// Brauzer yangi oynani faqat bosish paytining o'zida ochishga ruxsat beradi: orada yuklash kutilsa, oynani to'sadi.
// Shuning uchun kutubxona oldindan yuklangan bo'lsa, oyna hech narsa kutmasdan ochiladi.
export async function googleIdToken() {
  const { auth, lib: { GoogleAuthProvider, signInWithPopup, signOut } } = firebase ?? await preloadFirebase();
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    const idToken = await user.getIdToken();
    // Firebase sessiyasi kerak emas: bundan keyin kirish bizning sid cookie bilan
    await signOut(auth);
    return idToken;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    throw errorOf(e, 'Google orqali kirib bo‘lmadi. Qayta urinib ko‘ring');
  }
}

// Ko'rinmas reCAPTCHA: Firebase SMS yuborishdan oldin so'rov robotdan emasligini tekshiradi.
// Har yuborishda yangisi: eskisini tozalab, alohida bo'sh joyga chizamiz
let verifier: RecaptchaVerifier | undefined;

// Raqamga (+998...) 6 xonali kod yuboradi; qaytgan natija bilan keyin kod tasdiqlanadi
export async function sendSmsCode(phone: string) {
  const { auth, lib } = firebase ?? await preloadFirebase();
  verifier?.clear();
  const box = document.createElement('div');
  document.body.append(box);
  verifier = new lib.RecaptchaVerifier(auth, box, { size: 'invisible' });
  try {
    return await lib.signInWithPhoneNumber(auth, phone, verifier);
  } catch (e) {
    verifier.clear();
    verifier = undefined;
    throw errorOf(e, 'Kod yuborib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring');
  }
}

// Kod to'g'ri bo'lsa, server tekshiradigan token (tasdiqlangan raqam bilan)
export async function confirmSmsCode(sent: ConfirmationResult, code: string) {
  const { auth, lib } = firebase ?? await preloadFirebase();
  try {
    const { user } = await sent.confirm(code);
    const idToken = await user.getIdToken();
    await lib.signOut(auth);
    return idToken;
  } catch (e) {
    throw errorOf(e, 'Kodni tasdiqlab bo‘lmadi. Qayta urinib ko‘ring');
  }
}

export type { ConfirmationResult };
