import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { dayTotals, weeklyReport, weightTrend } from './analytics';
import { getExercise } from './exercises';
import { computeInsights } from './insights';
import { displayStatus, templateById } from './training';
import type { AppState, MealItem } from './types';
import { addDays, fmtWeight, todayISO, weekStart } from './util';
export { DEFAULT_MODEL, MODEL_OPTIONS } from './ai-config';

// Server-side refusal fallback is supported on these models (Claude API).
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

function client(apiKey: string) {
  // The key is entered by the user, stored only on this device, and sent only to api.anthropic.com.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function common(model: string) {
  return FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {};
}

export class AiError extends Error { name = 'AiError'; }

function explain(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError) throw new AiError('Your Anthropic API key was rejected. Check it in Settings.');
  if (e instanceof Anthropic.RateLimitError) throw new AiError('Rate limited by the AI service. Try again in a minute.');
  if (e instanceof Anthropic.APIConnectionError) throw new AiError('Could not reach the AI service. Are you offline?');
  if (e instanceof Anthropic.APIError) throw new AiError(`AI service error (${e.status ?? 'unknown'}).`);
  throw e instanceof Error ? new AiError(e.message) : new AiError('Unknown AI error');
}

// ── Photo food analysis ──────────────────────────────────────────

const PhotoSchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    grams: z.number(),
    kcal: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  notes: z.string(),
});

export interface PhotoResult { items: MealItem[]; notes: string }

export async function analyzeFoodPhoto(apiKey: string, model: string, base64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', hint: string): Promise<PhotoResult> {
  try {
    const res = await client(apiKey).beta.messages.parse({
      model,
      max_tokens: 4000,
      ...common(model),
      system: 'You are a careful nutrition estimator. Identify each distinct food visible in a meal photo, estimate realistic portion sizes from visual cues (plate size, utensils, typical servings), and estimate macros. Prefer common household units (cup, piece, slice, bowl) with gram equivalents. Mark confidence low when a food is partly hidden, sauces/oils are unknown, or the portion is hard to judge. In notes, briefly mention hidden calories you could not see (oil, butter, dressing) and anything the user should double-check. If the photo does not show food, return an empty items list and say so in notes.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `Estimate the foods and nutrition in this meal.${hint ? ` The user adds: "${hint}"` : ''}` },
        ],
      }],
      output_config: { format: betaZodOutputFormat(PhotoSchema) },
    });
    if (res.stop_reason === 'refusal') throw new AiError('The AI declined to analyse this image.');
    const out = res.parsed_output;
    if (!out) throw new AiError('The AI response could not be read. Try again or log manually.');
    return {
      notes: out.notes,
      items: out.items.map((i) => ({
        name: i.name, qty: i.quantity, unit: i.unit, grams: Math.round(i.grams), kcal: Math.round(i.kcal),
        protein: Math.round(i.protein_g * 10) / 10, carbs: Math.round(i.carbs_g * 10) / 10, fat: Math.round(i.fat_g * 10) / 10,
        uncertain: i.confidence !== 'high',
      })),
    };
  } catch (e) { explain(e); }
}

// ── Coach conversation ───────────────────────────────────────────

/** A compact, factual snapshot of the user's data so the model never has to guess. */
export function buildContext(state: AppState, today = todayISO()): string {
  const p = state.profile!;
  const u = p.units;
  const lines: string[] = [];
  lines.push(`Today: ${today}. Units: ${u}.`);
  lines.push(`Profile: age ${p.age}, ${p.gender}, ${p.heightCm} cm, ${fmtWeight(p.weightKg, u)} → target ${fmtWeight(p.targetWeightKg, u)}; goal ${p.goal}; experience ${p.experience}; ${p.location}; equipment: ${p.equipment.join(', ')}; diet: ${p.diet.join(', ') || 'none'}; limitations: ${p.limitations || 'none'}.`);
  lines.push(`Daily targets: ${p.targets.calories} kcal, ${p.targets.protein} g protein, ${p.targets.carbs} g carbs, ${p.targets.fat} g fat.`);
  if (state.plan) {
    lines.push('Workout templates:');
    state.plan.templates.forEach((t) => lines.push(`- ${t.name}: ${t.exercises.map((e) => `${getExercise(e.exerciseId).name} ${e.sets}x${e.repsMin}-${e.repsMax} @ ${fmtWeight(e.weightKg, u)}`).join('; ')}`));
  }
  lines.push('Schedule (last 14 days → next 7):');
  state.schedule.filter((s) => s.date >= addDays(today, -14) && s.date <= addDays(today, 7)).forEach((s) =>
    lines.push(`- ${s.date}: ${templateById(state.plan, s.templateId)?.name ?? 'Rest'} [${displayStatus(s, today)}]${s.note ? ` (${s.note})` : ''}`));
  const recent = [...state.sessions].filter((s) => s.state === 'finished').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  if (recent.length) {
    lines.push('Recent sessions (actual performance):');
    recent.forEach((s) => lines.push(`- ${s.date} ${s.name} (${s.source}): ` + (s.exercises.length ? s.exercises.map((e) => `${getExercise(e.exerciseId).name} ${e.status}${e.sets.some((x) => x.done) ? ' ' + e.sets.filter((x) => x.done).map((x) => `${fmtWeight(x.weightKg, u)}×${x.reps}`).join(', ') : ''}`).join('; ') : `muscles: ${s.reportedMuscles?.join(', ')}`)));
  } else lines.push('No completed sessions recorded yet.');
  const t = dayTotals(state, today);
  lines.push(`Food today: ${t.kcal} kcal, ${t.protein} g protein, ${t.carbs} g carbs, ${t.fat} g fat.`);
  for (let i = 1; i <= 6; i++) { const d = addDays(today, -i); const x = dayTotals(state, d); if (x.kcal) lines.push(`Food ${d}: ${x.kcal} kcal, ${x.protein} g protein.`); }
  const wt = weightTrend(state, today);
  lines.push(`Weight: latest ${wt.current != null ? fmtWeight(wt.current, u) : 'n/a'}; 7-day avg ${wt.avgThis != null ? fmtWeight(wt.avgThis, u) : 'n/a'}; previous 7-day avg ${wt.avgLast != null ? fmtWeight(wt.avgLast, u) : 'n/a'}.`);
  const r = weeklyReport(state, weekStart(today), today);
  lines.push(`This week: ${r.consistency.completed} completed, ${r.consistency.partial} partial, ${r.consistency.missed} missed, ${r.consistency.skipped} skipped, ${r.consistency.unreported} unreported.`);
  const ins = computeInsights(state, today);
  if (ins.length) lines.push('App insights: ' + ins.map((i) => i.text).join(' | '));
  return lines.join('\n');
}

const SYSTEM = `You are FitPilot's coach: a knowledgeable, warm, concise personal fitness coach.
Rules:
- Base every statement about the user on the DATA block. If something isn't recorded, say so plainly; never invent workouts, weights, meals or trends.
- Give practical, evidence-based advice. Avoid extreme diets, very low calories, or training through pain. Suggest seeing a professional for injuries or medical concerns.
- Never encourage excessive training to make up for missed sessions.
- You cannot change the user's records yourself. If they want to log or change something, tell them the short phrase to send (e.g. "I missed Monday's workout", "I ate 2 eggs and toast", "Can I replace bench press?") and the app will ask them to confirm.
- No guilt-based language. Keep answers under ~150 words unless asked for detail. Use plain text with short bullet points when helpful.`;

export async function askCoach(apiKey: string, model: string, state: AppState, question: string): Promise<string> {
  const history = state.chat.slice(-10).filter((m) => m.text).map((m) => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }));
  // Merge consecutive same-role turns (API requires alternation) and start with a user turn.
  const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of history) { const last = msgs[msgs.length - 1]; if (last && last.role === m.role) last.content += '\n' + m.content; else msgs.push({ ...m }); }
  while (msgs.length && msgs[0].role === 'assistant') msgs.shift();
  const content = `DATA:\n${buildContext(state)}\n\nQUESTION: ${question}`;
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs[msgs.length - 1].content += '\n' + content; else msgs.push({ role: 'user', content });
  try {
    const res = await client(apiKey).beta.messages.create({ model, max_tokens: 2000, system: SYSTEM, messages: msgs, output_config: { effort: 'low' }, ...common(model) });
    if (res.stop_reason === 'refusal') return "I can't help with that one. Try asking about your training, nutrition or progress.";
    return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  } catch (e) { explain(e); }
}
