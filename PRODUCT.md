# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Workers:** students and young people (roughly 18–25) in Tashkent who want flexible, one-day paid work around their studies. They browse open shifts on their phone, apply, and go if accepted.
- **Businesses:** wedding halls (to'yxona), restaurants, marketplace pick-up points (Uzum, Wildberries), warehouses and event organisers who need extra people for a single day, often at short notice. Today they search Telegram groups and people fail to show up.

## Product Purpose

Smena is a marketplace for one-day shifts in Tashkent. A business posts a shift (date, hours, pay, place, how many people); verified workers apply; the business picks who to accept. After the shift both sides rate each other. Success: businesses get people who actually arrive, workers get paid shifts they chose themselves.

## Positioning

The reliability rule: a worker who is accepted and does not come is blocked from the platform. Workers can cancel free of charge until the day before the shift. This "the person will come" guarantee is what Telegram groups and OLX listings cannot offer. The same model works in Russia ("Моя смена"); no equivalent was found in Uzbekistan.

## Operating Context

- Mobile-first: workers use phones; the app installs as a PWA.
- Language: Uzbek (Latin script, typographic apostrophes o‘ g‘ and tutuq ’).
- Times and dates are Tashkent local time. Overnight shifts (e.g. 23:30–02:00) are normal for wedding halls.

## Capabilities and Constraints

- Built: registration by phone + password (worker or business), shift posting, public shift list, apply / cancel, accept / reject, mark came (with 1–5 rating) or no-show (auto-block), worker rates business, phone numbers revealed only after acceptance.
- Pricing (changed by owner, 2026-10-30): the worker pays 15% of their pay per completed shift (e.g. 30 000 of 200 000 so‘m); nothing for no-shows or cancelled shifts. Posting and hiring are free for businesses. Planned: optional monthly subscriptions (Ishchi Pro, Biznes Pro).
- Not built yet: online payment (Click/Payme), SMS verification, Telegram notifications, admin panel for unblocking.
- Stack: Node 22.13+ with no dependencies (node:http + node:sqlite), static HTML/CSS/vanilla JS in `public/`.

## Brand Commitments

- Name: Smena.
- No purple in any design (owner's standing preference).

## Evidence on Hand

None yet: no partner businesses, user counts, testimonials or photos. Example shifts on the site must be labelled as examples. Never invent statistics, partner names, reviews or press.

## Product Principles

1. Reliability over volume: every feature should make "the accepted person comes" more likely.
2. Show the shift, not the promise: time, place and pay are always visible up front.
3. Fair to both sides: workers rate businesses too; cancelling early is free.
4. Phone-first and fast: a student should find and apply to a shift in under a minute.
