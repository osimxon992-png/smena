'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/components/Lang';
import type { Point, Shift } from '@/lib/client';

type Leaflet = typeof import('leaflet');
type LMap = import('leaflet').Map;

// Joy tanlanmaganda xarita Toshkent markazidan ochiladi
export const TASHKENT: Point = { lat: 41.311, lng: 69.279 };

// Leaflet window'siz ishlamaydi: kutubxona brauzerda, effekt ichida yuklanadi. Xarita OpenStreetMap plitalari bilan
function useLeaflet(center: Point, zoom: number) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<{ L: Leaflet; map: LMap } | null>(null);
  useEffect(() => {
    let gone = false;
    let map: LMap | undefined;
    import('leaflet').then((mod) => {
      const L = ((mod as { default?: Leaflet }).default ?? mod) as Leaflet;
      if (gone || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      setReady({ L, map });
    });
    return () => { gone = true; setReady(null); map?.remove(); };
    // Markaz va masshtab faqat birinchi ochilganda: keyin foydalanuvchi o'zi suradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { box, ...ready };
}
// Xarita hali tirikmi: sahifa yangilanayotganda (Fast Refresh) eski xarita remove() qilingan bo'lishi mumkin, unda panellar yo'q
const alive = (map: LMap | undefined): map is LMap => !!map?.getPane('markerPane');

// Narx yorlig'i ko'rinishidagi belgi (rasm fayllarisiz): "250k", shoshilinch bo'lsa qizil
const pinIcon = (L: Leaflet, html: string, className: string) => L.divIcon({ className: `map-pin ${className}`, html, iconSize: undefined, iconAnchor: [0, 0] });
const short = (pay: number) => (pay >= 1e6 ? `${(pay / 1e6).toFixed(1).replace('.0', '')}M` : `${Math.round(pay / 1000)}k`);

// Ochiq smenalar xaritada. Belgini bossa, ro'yxatdagi smena kartochkasi tanlanadi (onPick). me — "Yaqinimdagilar" dagi joyim
export function ShiftMap({ shifts, me, onPick }: { shifts: Shift[]; me?: Point | null; onPick: (id: number) => void }) {
  const { t, som, day } = useT();
  const { box, L, map } = useLeaflet(me ?? TASHKENT, me ? 13 : 11);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!L || !alive(map)) return;
    const layer = L.layerGroup().addTo(map);
    const placed = shifts.filter((s) => s.lat != null && s.lng != null);
    for (const s of placed) {
      // Matn element orqali: lavozim nomi foydalanuvchi yozgan matn, HTML sifatida qo'yilmaydi
      const tip = document.createElement('span');
      tip.textContent = `${s.title} · ${day(s.date)}, ${s.start_time}`;
      // Shoshilinch smena bir joydagi boshqa smenalar ustida turadi
      L.marker([s.lat!, s.lng!], { icon: pinIcon(L, short(s.pay), s.urgent ? 'is-urgent' : ''), title: `${s.title} · ${som(s.pay)}`, riseOnHover: true, zIndexOffset: s.urgent ? 1000 : 0 })
        .bindTooltip(tip, { direction: 'top', offset: [16, -6] })
        .on('click', () => pick.current(s.id))
        .addTo(layer);
    }
    if (me) L.circleMarker([me.lat, me.lng], { radius: 9, color: '#1F6F80', fillColor: '#1F6F80', fillOpacity: 0.9, weight: 3 }).bindTooltip(t('Siz shu yerdasiz')).addTo(layer);
    const points: [number, number][] = [...placed.map((s): [number, number] => [s.lat!, s.lng!]), ...(me ? [[me.lat, me.lng] as [number, number]] : [])];
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    else if (points.length === 1) map.setView(points[0], 14);
    return () => { layer.remove(); };
  }, [L, map, shifts, me, t, som, day]);

  const missing = shifts.filter((s) => s.lat == null).length;
  return (
    <figure className="map-wrap">
      <div ref={box} className="map" role="region" aria-label={t('Smenalar xaritasi')} />
      {missing > 0 && <figcaption className="hint">{t('{n} ta smenaning joyi xaritada belgilanmagan: ular ro‘yxatda.', { n: missing })}</figcaption>}
    </figure>
  );
}

// Smena joyini tanlash: xaritani bosing yoki belgini suring. value null bo'lsa, joy tanlanmagan
export function PickMap({ value, onChange }: { value: Point | null; onChange: (p: Point) => void }) {
  const { t } = useT();
  const { box, L, map } = useLeaflet(value ?? TASHKENT, value ? 16 : 11);
  const change = useRef(onChange);
  change.current = onChange;
  const marker = useRef<import('leaflet').Marker | null>(null);

  useEffect(() => {
    if (!L || !alive(map)) return;
    const set = (e: { latlng: { lat: number; lng: number } }) => change.current({ lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 });
    map.on('click', set);
    return () => { map.off('click', set); };
  }, [L, map]);

  useEffect(() => {
    if (!L || !alive(map)) return;
    // Xarita qayta yaratilgan bo'lsa, eski belgi unga tegishli emas
    if (marker.current && !map.hasLayer(marker.current)) marker.current = null;
    if (!value) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      marker.current = L.marker([value.lat, value.lng], { icon: pinIcon(L, '📍', 'is-place'), draggable: true, keyboard: false }).addTo(map);
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng();
        change.current({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 });
      });
    } else {
      marker.current.setLatLng([value.lat, value.lng]);
    }
    if (!map.getBounds().contains([value.lat, value.lng])) map.setView([value.lat, value.lng], 16);
  }, [L, map, value]);

  return <div ref={box} className="map map-pick" role="region" aria-label={t('Smena joyini xaritada tanlang')} />;
}
