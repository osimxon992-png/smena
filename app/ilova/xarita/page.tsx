'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLoad } from '@/components/app/AppShell';
import { useT } from '@/components/Lang';
import { type Point, type Shift } from '@/lib/client';

const ShiftMap = dynamic(() => import('@/components/app/Map').then((m) => m.ShiftMap), { ssr: false, loading: () => <div className="map map-loading" /> });

export default function XaritaPage() {
  const { t } = useT();
  const { data } = useLoad<Shift[]>('/shifts');
  const [me, setMe] = useState<Point | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    );
  }, []);

  return (
    <>
      <div className="head"><h1>{t('Smenalar xaritasi')}</h1></div>
      {data ? <ShiftMap shifts={data} me={me} onPick={(id) => window.location.href = `/ilova/smena/${id}`} /> : <p>{t('Yuklanmoqda...')}</p>}
    </>
  );
}
