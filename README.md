# FitPilot

[![Netlify Status](https://api.netlify.com/api/v1/badges/fdd064ee-ca14-4561-b383-cfe0a95e4400/deploy-status)](https://app.netlify.com/projects/lucky-sawine-580f93/deploys)

An adaptive personal fitness coach: plan → exercise → record → eat → analyse → adapt.
Built as an installable, offline-capable web app (PWA) with React + TypeScript. All data stays on the device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the core engine (planning, scheduling, NLP, journeys)
npm run build && npx vite preview --port 4173 &
npm run e2e        # browser test of the acceptance journeys (needs Playwright + Chromium)
```

On Android, open the deployed site in Chrome and choose **Add to Home screen** to install it.

## What's in the MVP

| Area | Highlights |
| --- | --- |
| Onboarding | Age, optional gender, height, weight, target, goal, experience, training days, time, gym/home, equipment, diet, injuries. Calculates calorie and macro targets. |
| Plan | Full-body / upper-lower / PPL / body-part splits. Exercises are picked by equipment, experience and injury notes. Sets, reps, rest and conservative starting weights. Every exercise can be edited, swapped or removed. |
| Exercise library | 60+ exercises, each with a description, steps, primary and secondary muscles, equipment, common mistakes, alternatives and a demo-video link. |
| Active workout | Pre-filled weights and reps, one-tap set completion, rest timer, swap, skip, add set or exercise, pause and finish. Every tap is saved, so the workout survives the app closing. |
| Actual vs planned | Every set is stored as performed. Progression comes from actual history: all sets at the top of the rep range → small increase; two sessions below range → back off about 10%. PRs are detected. |
| Workout status | Planned, in progress, completed, partial, missed, skipped and rest. A past workout nobody reported shows as **Not reported**, never as missed. |
| Adaptive scheduling | For a missed workout it weighs three options: an open rest day, swapping with the next workout, or keeping the plan. It checks muscle recovery windows, recent training, soreness, runs of consecutive days and whether the week already covers those muscles. Every option comes with an explanation, and nothing changes until you confirm. History is never rewritten. |
| Nutrition | Photo logging (AI), text logging ("chicken curry with two rotis"), food search, custom foods and saved meals. Estimates are labelled and guessed quantities are flagged for review before saving. Daily dashboard by meal, with edit and delete. |
| Coach | Understands "I missed yesterday's workout", "I only trained chest", "I did back and biceps instead", "I ate 2 eggs…", "3 sets of bench at 135 lb for 8" and many questions. Every change shows up as a card you confirm, with undo. Proactive insights: day-of-week miss patterns, low protein, ready-to-progress lifts, overtraining a muscle, weight trend vs goal. |
| Progress | Weight with a 7-day average, measurements, strength charts (estimated 1RM and heaviest set), 8-week consistency and an honest weekly report. |
| Reminders | Configurable types, frequency cap, quiet hours. Wording is neutral. |
| Privacy | Local-only storage, JSON export and import, delete individual records, delete everything. Clear labels wherever AI is involved. |

## AI (optional)

The app works fully without AI. With an Anthropic API key (Settings → AI coach), it adds:
- **Meal photo analysis**: Claude vision with structured output. You review the results before anything is saved.
- **Open-ended coach answers**: Claude receives a compact factual summary of your data and is instructed never to invent records.

The default model is `claude-opus-5-5`, and you can switch to Sonnet 5.5 or Haiku 5.5 to cut cost. Server-side refusal fallback (`fallbacks: "default"`) is enabled on Opus and Sonnet. The key is stored only in the browser and is never included in exports.

> Calling the API from a browser exposes the key to that device. That's fine for personal use; a multi-user release should route calls through a small backend.

## Architecture

```
src/lib/      pure, tested domain logic (no React)
  planner     targets, split templates, exercise selection, starting loads
  training    schedule materialisation, sessions, progression, PRs, muscle load
  scheduler   recovery-aware missed-workout recommendations
  nlp         food / workout / date parsing
  coach       intent handling → reply + confirmable proposal cards
  actions     the only place proposals mutate state
  insights, analytics, reminders, foods, exercises, ai, store
src/screens/  Home, Workout, Nutrition, Coach, Progress, Settings, Onboarding
```

## Known limitations / next steps
- **Android release**: shipped as an installable PWA. A Play Store build would wrap it with Capacitor (needs the Android SDK).
- **Reminders** only fire while the app or its service worker is running. Reliable background push needs a push server or the native wrapper.
- **Food database** is about 80 common foods plus your custom foods. A larger database such as USDA or Open Food Facts plus barcode scanning would improve manual logging.
- **Photo analysis** needs an API key. Without one, the photo flow falls back to describing the meal in text.
