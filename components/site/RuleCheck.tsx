'use client';

import { useState } from 'react';

type When = 'later' | 'today';
type Status = 'pending' | 'accepted';
type Act = 'cancel' | 'skip';

// Platforma qoidalari bilan bir xil mantiq: bekor qilish — kutilayotgan ariza yoki ertangi qabul; kelmaslik faqat qabul qilinganda bloklaydi
function verdict(when: When, status: Status, act: Act): { tone: 'ok' | 'bad' | 'neutral'; title: string; text: string } {
  if (act === 'cancel') {
    if (status === 'pending') return { tone: 'ok', title: 'Bepul bekor qilinadi', text: 'Hali qabul qilinmagan arizani istalgan payt bekor qilasiz.' };
    if (when === 'later') return { tone: 'ok', title: 'Bepul bekor qilinadi', text: 'Smenadan kamida bir kun oldin bekor qilish reytingga ta’sir qilmaydi.' };
    return { tone: 'bad', title: 'Bugun bekor qilib bo‘lmaydi', text: 'Smena kuni qabul qilingan arizani bekor qilib bo‘lmaydi. Kelmasangiz, hisob bloklanadi.' };
  }
  if (status === 'pending') return { tone: 'neutral', title: 'Bloklanmaysiz', text: 'Ariza qabul qilinmagan. Baribir uni bekor qilib qo‘ying, ish beruvchi kutib qolmasin.' };
  return { tone: 'bad', title: 'Hisob bloklanadi', text: 'Qabul qilingan smenaga kelmagan ishchi platformadan chiqariladi.' };
}

function Choice<T extends string>({ q, value, options, onPick }: { q: string; value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <>
      <p className="widget-q">{q}</p>
      <div className="pick-row" role="group" aria-label={q}>
        {options.map(([v, label]) => (
          <button key={v} type="button" className="pick" aria-pressed={v === value} onClick={() => onPick(v)}>{label}</button>
        ))}
      </div>
    </>
  );
}

// "Qoidani sinab ko'ring": vaziyatni tanlang, platforma nima qilishini muhr ko'rsatadi
export default function RuleCheck() {
  const [when, setWhen] = useState<When>('later');
  const [status, setStatus] = useState<Status>('accepted');
  const [act, setAct] = useState<Act>('cancel');
  const v = verdict(when, status, act);
  return (
    <div className="widget sheet taped">
      <h2 className="widget-title">Qoidani sinab ko‘ring</h2>
      <Choice q="Smena qachon?" value={when} onPick={setWhen} options={[['later', 'Ertaga yoki keyin'], ['today', 'Bugun']]} />
      <Choice q="Arizangiz holati?" value={status} onPick={setStatus} options={[['pending', 'Kutilmoqda'], ['accepted', 'Qabul qilingan']]} />
      <Choice q="Bora olmaysiz. Nima qilasiz?" value={act} onPick={setAct} options={[['cancel', 'Bekor qilaman'], ['skip', 'Shunchaki bormayman']]} />
      <div className={`verdict ${v.tone}`} key={`${when}${status}${act}`} role="status">
        <strong>{v.title}</strong>
        <p>{v.text}</p>
      </div>
    </div>
  );
}
