import type { Equipment, Exercise, Muscle } from './types';

type Def = Omit<Exercise, 'compound' | 'increment'> & { compound?: boolean; increment?: number };

const ex = (d: Def): Exercise => ({ compound: false, increment: 2.5, ...d });

export const EXERCISES: Exercise[] = [
  // ── Horizontal push ─────────────────────────────────────────
  ex({ id: 'bench_press', name: 'Barbell Bench Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['barbell', 'bench'], compound: true, startRatio: 0.45, increment: 2.5, avoidWith: ['shoulder'],
    description: 'The classic chest builder. You lie on a flat bench and press a barbell up from your chest.',
    steps: ['Lie on the bench with eyes under the bar and feet flat on the floor.', 'Grip the bar slightly wider than shoulder width.', 'Squeeze your shoulder blades together and unrack the bar.', 'Lower the bar with control to the middle of your chest.', 'Press up until your arms are straight, without locking hard.'],
    mistakes: ['Bouncing the bar off the chest.', 'Flaring elbows straight out to 90°.', 'Lifting hips off the bench.', 'Training heavy without a spotter or safety arms.'] }),
  ex({ id: 'db_bench_press', name: 'Dumbbell Bench Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['dumbbell', 'bench'], compound: true, startRatio: 0.15, increment: 2, perHand: true,
    description: 'A chest press with a dumbbell in each hand. Allows a deeper stretch and evens out left/right strength.',
    steps: ['Sit on the bench with dumbbells on your thighs, then lie back and bring them to chest level.', 'Hold them with palms facing forward, elbows about 45° from your body.', 'Press both dumbbells up until arms are straight above your chest.', 'Lower slowly until you feel a stretch in your chest.'],
    mistakes: ['Dropping the dumbbells too fast at the bottom.', 'Clanking dumbbells together at the top.', 'Arching the lower back excessively.'] }),
  ex({ id: 'machine_chest_press', name: 'Machine Chest Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['machine'], compound: true, startRatio: 0.35, increment: 2.5,
    description: 'A seated, guided chest press. Great for beginners because the machine controls the path.',
    steps: ['Adjust the seat so the handles line up with the middle of your chest.', 'Sit tall with your back against the pad.', 'Press the handles forward until your arms are nearly straight.', 'Return slowly until you feel a light stretch in your chest.'],
    mistakes: ['Seat too high or too low.', 'Shoulders rolling forward off the pad.', 'Letting the weight stack slam between reps.'] }),
  ex({ id: 'push_up', name: 'Push-Up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders', 'core'], equipment: ['bodyweight'], compound: true, startRatio: 0, increment: 0,
    description: 'A bodyweight press that trains chest, shoulders, triceps and core together.',
    steps: ['Place hands slightly wider than shoulders, body in a straight line.', 'Lower your chest towards the floor with elbows about 45° from your body.', 'Push back up to straight arms.', 'Make it easier with hands on a bench; harder with feet elevated.'],
    mistakes: ['Hips sagging.', 'Only going halfway down.', 'Head poking forward.'] }),
  ex({ id: 'incline_db_press', name: 'Incline Dumbbell Press', pattern: 'horizontal_push', primary: ['chest', 'shoulders'], secondary: ['triceps'], equipment: ['dumbbell', 'bench'], compound: true, startRatio: 0.12, increment: 2, perHand: true,
    description: 'A dumbbell press on a 30–45° incline bench that emphasises the upper chest.',
    steps: ['Set the bench to about 30°.', 'Bring the dumbbells to shoulder level as you lie back.', 'Press up and slightly in until arms are straight.', 'Lower slowly to upper-chest level.'],
    mistakes: ['Bench set too steep (turns into a shoulder press).', 'Losing shoulder-blade position.'] }),
  ex({ id: 'incline_machine_press', name: 'Incline Machine Press', pattern: 'horizontal_push', primary: ['chest', 'shoulders'], secondary: ['triceps'], equipment: ['machine'], compound: true, startRatio: 0.3, increment: 2.5,
    description: 'A guided incline press for the upper chest.',
    steps: ['Adjust the seat so the handles start at upper-chest height.', 'Press up and forward until arms are nearly straight.', 'Lower under control.'],
    mistakes: ['Shrugging shoulders up to the ears.', 'Using momentum.'] }),

  // ── Chest fly ────────────────────────────────────────────────
  ex({ id: 'cable_fly', name: 'Cable Chest Fly', pattern: 'chest_fly', primary: ['chest'], secondary: ['shoulders'], equipment: ['cable'], startRatio: 0.08, increment: 2.5,
    description: 'An isolation move that keeps tension on the chest through the whole range.',
    steps: ['Set both pulleys around shoulder height and grab a handle in each hand.', 'Step forward into a split stance with a slight bend in your elbows.', 'Bring your hands together in front of your chest in a hugging motion.', 'Open back up slowly until you feel a chest stretch.'],
    mistakes: ['Bending the elbows so it becomes a press.', 'Going too heavy and losing control.'] }),
  ex({ id: 'pec_deck', name: 'Pec Deck Machine', pattern: 'chest_fly', primary: ['chest'], secondary: ['shoulders'], equipment: ['machine'], startRatio: 0.2, increment: 2.5,
    description: 'A seated machine fly that isolates the chest safely.',
    steps: ['Set the seat so the handles are at chest height.', 'With a soft bend in the elbows, bring the handles together.', 'Pause and squeeze, then return slowly.'],
    mistakes: ['Letting the weight pull your arms too far back.', 'Rounding the shoulders forward.'] }),
  ex({ id: 'db_fly', name: 'Dumbbell Fly', pattern: 'chest_fly', primary: ['chest'], secondary: ['shoulders'], equipment: ['dumbbell', 'bench'], startRatio: 0.06, increment: 1, perHand: true,
    description: 'A chest isolation exercise using dumbbells on a flat bench.',
    steps: ['Lie on a bench with dumbbells above your chest, palms facing each other.', 'With a slight elbow bend, lower the weights out to the sides.', 'Stop at a comfortable stretch and bring them back up.'],
    mistakes: ['Going too deep and straining the shoulder.', 'Using weights that are too heavy.'] }),

  // ── Vertical push ────────────────────────────────────────────
  ex({ id: 'db_shoulder_press', name: 'Seated Dumbbell Shoulder Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], equipment: ['dumbbell', 'bench'], compound: true, startRatio: 0.1, increment: 2, perHand: true, avoidWith: ['shoulder'],
    description: 'Builds the front and side of the shoulders.',
    steps: ['Sit on an upright bench with dumbbells at shoulder height, palms forward.', 'Press the dumbbells overhead until arms are straight.', 'Lower slowly back to shoulder height.'],
    mistakes: ['Arching the lower back.', 'Lowering only a few inches.', 'Pressing the weights too far forward.'] }),
  ex({ id: 'machine_shoulder_press', name: 'Machine Shoulder Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], equipment: ['machine'], compound: true, startRatio: 0.25, increment: 2.5, avoidWith: ['shoulder'],
    description: 'A guided overhead press that is easy to learn.',
    steps: ['Adjust the seat so handles start at shoulder height.', 'Press up until arms are almost straight.', 'Lower under control.'],
    mistakes: ['Seat too low causing an awkward start.', 'Leaning back off the pad.'] }),
  ex({ id: 'overhead_press', name: 'Standing Barbell Overhead Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps', 'core'], equipment: ['barbell'], compound: true, startRatio: 0.3, increment: 2.5, avoidWith: ['shoulder', 'back'],
    description: 'A full-body strength lift pressing a barbell overhead while standing.',
    steps: ['Hold the bar at collarbone height with a shoulder-width grip.', 'Brace your core and squeeze your glutes.', 'Press the bar straight up, moving your head back slightly to clear it.', 'Finish with the bar over the middle of your feet.'],
    mistakes: ['Leaning back excessively.', 'Pressing the bar forward instead of up.'] }),
  ex({ id: 'pike_push_up', name: 'Pike Push-Up', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], equipment: ['bodyweight'], compound: true, startRatio: 0, increment: 0,
    description: 'A bodyweight shoulder press done with hips raised high.',
    steps: ['Start in a push-up position and walk your feet in, raising hips into an upside-down V.', 'Bend your elbows to lower the top of your head toward the floor.', 'Press back up.'],
    mistakes: ['Hips dropping so it becomes a normal push-up.'] }),

  // ── Lateral raise / rear delt ────────────────────────────────
  ex({ id: 'db_lateral_raise', name: 'Dumbbell Lateral Raise', pattern: 'lateral_raise', primary: ['shoulders'], secondary: ['traps'], equipment: ['dumbbell'], startRatio: 0.05, increment: 1, perHand: true,
    description: 'Isolates the side delts for wider-looking shoulders.',
    steps: ['Stand holding light dumbbells at your sides.', 'With a slight bend in the elbows, raise your arms out to the sides to shoulder height.', 'Lower slowly.'],
    mistakes: ['Swinging the body to lift the weight.', 'Shrugging the shoulders.', 'Going too heavy.'] }),
  ex({ id: 'cable_lateral_raise', name: 'Cable Lateral Raise', pattern: 'lateral_raise', primary: ['shoulders'], secondary: [], equipment: ['cable'], startRatio: 0.03, increment: 1.25,
    description: 'A lateral raise with constant cable tension.',
    steps: ['Set a pulley at the lowest point and stand side-on to it.', 'Hold the handle with the far hand and raise it out to shoulder height.', 'Lower slowly.'],
    mistakes: ['Leaning far away from the machine.', 'Using momentum.'] }),
  ex({ id: 'band_lateral_raise', name: 'Band Lateral Raise', pattern: 'lateral_raise', primary: ['shoulders'], secondary: [], equipment: ['bands'], startRatio: 0, increment: 0,
    description: 'A lateral raise using a resistance band — great for home.',
    steps: ['Stand on the band and hold one end in each hand.', 'Raise your arms to the sides up to shoulder height.', 'Lower slowly.'],
    mistakes: ['Band too heavy, forcing a shrug.'] }),
  ex({ id: 'face_pull', name: 'Cable Face Pull', pattern: 'rear_delt', primary: ['rear_delts'], secondary: ['traps'], equipment: ['cable'], startRatio: 0.12, increment: 2.5,
    description: 'Strengthens the rear shoulders and upper back; good for posture and shoulder health.',
    steps: ['Set a rope attachment at upper-chest to face height.', 'Pull the rope toward your face, separating your hands as you pull.', 'Finish with elbows high and hands beside your ears, then return slowly.'],
    mistakes: ['Pulling with the lower back.', 'Elbows dropping low.'] }),
  ex({ id: 'reverse_pec_deck', name: 'Reverse Pec Deck', pattern: 'rear_delt', primary: ['rear_delts'], secondary: ['traps'], equipment: ['machine'], startRatio: 0.12, increment: 2.5,
    description: 'A machine fly done in reverse to target the rear delts.',
    steps: ['Sit facing the pad with handles at shoulder height.', 'Push the handles back and out in a wide arc.', 'Return slowly.'],
    mistakes: ['Squeezing the shoulder blades excessively instead of moving the arms.'] }),
  ex({ id: 'db_rear_delt_fly', name: 'Bent-Over Dumbbell Rear Delt Fly', pattern: 'rear_delt', primary: ['rear_delts'], secondary: ['traps'], equipment: ['dumbbell'], startRatio: 0.04, increment: 1, perHand: true,
    description: 'Targets the rear shoulders with light dumbbells.',
    steps: ['Hinge forward at the hips with a flat back.', 'Let the dumbbells hang, then raise them out to the sides.', 'Lower slowly.'],
    mistakes: ['Standing too upright.', 'Using heavy weight and swinging.'] }),

  // ── Vertical pull ────────────────────────────────────────────
  ex({ id: 'lat_pulldown', name: 'Lat Pulldown', pattern: 'vertical_pull', primary: ['lats', 'back'], secondary: ['biceps', 'rear_delts'], equipment: ['cable', 'machine'], compound: true, startRatio: 0.4, increment: 2.5,
    description: 'Builds the lats — the muscles that give your back width.',
    steps: ['Sit with thighs secured under the pad and grip the bar slightly wider than shoulders.', 'Lean back slightly and pull the bar to your upper chest.', 'Lead with the elbows, driving them down and back.', 'Return slowly until arms are straight.'],
    mistakes: ['Pulling the bar behind the neck.', 'Leaning back too far and using momentum.', 'Not letting the arms straighten fully.'] }),
  ex({ id: 'assisted_pull_up', name: 'Assisted Pull-Up', pattern: 'vertical_pull', primary: ['lats', 'back'], secondary: ['biceps'], equipment: ['machine'], compound: true, startRatio: 0, increment: 0,
    description: 'A pull-up with machine or band assistance so you can do full reps while building strength.',
    steps: ['Set the assistance (more assistance = easier).', 'Grip the bar slightly wider than shoulders and kneel/stand on the pad.', 'Pull your chest up toward the bar.', 'Lower all the way down with control.'],
    mistakes: ['Half reps.', 'Swinging.'] }),
  ex({ id: 'pull_up', name: 'Pull-Up', pattern: 'vertical_pull', primary: ['lats', 'back'], secondary: ['biceps', 'core'], equipment: ['pullup_bar'], compound: true, startRatio: 0, increment: 0,
    description: 'The bodyweight king for back width.',
    steps: ['Hang from the bar with a grip slightly wider than shoulders.', 'Pull until your chin passes the bar.', 'Lower to a full hang.'],
    mistakes: ['Kipping/swinging.', 'Not reaching full hang.'] }),
  ex({ id: 'band_pulldown', name: 'Band Lat Pulldown', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps'], equipment: ['bands'], compound: true, startRatio: 0, increment: 0,
    description: 'A home-friendly lat pulldown using a band anchored overhead.',
    steps: ['Anchor a band high (door anchor) and kneel facing it.', 'Pull the band down toward your chest, elbows driving down.', 'Return slowly.'],
    mistakes: ['Pulling with arms only.'] }),

  // ── Horizontal pull ──────────────────────────────────────────
  ex({ id: 'seated_cable_row', name: 'Seated Cable Row', pattern: 'horizontal_pull', primary: ['back'], secondary: ['lats', 'biceps', 'rear_delts'], equipment: ['cable'], compound: true, startRatio: 0.4, increment: 2.5,
    description: 'Builds back thickness — mid-back, lats and rear shoulders.',
    steps: ['Sit with feet on the platform and knees slightly bent.', 'Grab the handle and sit tall.', 'Pull the handle to your stomach, squeezing shoulder blades together.', 'Let your arms extend fully with control.'],
    mistakes: ['Rocking the torso back and forth.', 'Rounding the lower back.'] }),
  ex({ id: 'machine_row', name: 'Chest-Supported Machine Row', pattern: 'horizontal_pull', primary: ['back'], secondary: ['lats', 'biceps', 'rear_delts'], equipment: ['machine'], compound: true, startRatio: 0.35, increment: 2.5,
    description: 'A row with your chest supported — easy on the lower back.',
    steps: ['Adjust the chest pad so you can just reach the handles.', 'Pull the handles back, driving elbows behind you.', 'Return slowly.'],
    mistakes: ['Lifting your chest off the pad.', 'Shrugging.'] }),
  ex({ id: 'db_row', name: 'One-Arm Dumbbell Row', pattern: 'horizontal_pull', primary: ['back', 'lats'], secondary: ['biceps', 'rear_delts'], equipment: ['dumbbell', 'bench'], compound: true, startRatio: 0.2, increment: 2, perHand: true,
    description: 'A single-arm row supported on a bench.',
    steps: ['Place one knee and hand on a bench, back flat.', 'Hold a dumbbell in the other hand, arm hanging.', 'Row the dumbbell toward your hip.', 'Lower to a full stretch.'],
    mistakes: ['Twisting the torso to lift.', 'Pulling toward the shoulder instead of the hip.'] }),
  ex({ id: 'barbell_row', name: 'Barbell Bent-Over Row', pattern: 'horizontal_pull', primary: ['back', 'lats'], secondary: ['biceps', 'rear_delts', 'lower_back'], equipment: ['barbell'], compound: true, startRatio: 0.4, increment: 2.5, avoidWith: ['back'],
    description: 'A heavy free-weight row for overall back thickness.',
    steps: ['Hinge forward with a flat back, bar hanging below shoulders.', 'Pull the bar to your lower ribs.', 'Lower under control without changing your back angle.'],
    mistakes: ['Standing up as you row.', 'Rounding the back.'] }),
  ex({ id: 'band_row', name: 'Band Row', pattern: 'horizontal_pull', primary: ['back'], secondary: ['biceps'], equipment: ['bands'], compound: true, startRatio: 0, increment: 0,
    description: 'A seated or standing row with a band.',
    steps: ['Anchor the band at chest height or loop it around your feet.', 'Pull your hands toward your stomach, squeezing your shoulder blades.', 'Return slowly.'],
    mistakes: ['Shrugging shoulders.'] }),
  ex({ id: 'inverted_row', name: 'Inverted Row', pattern: 'horizontal_pull', primary: ['back'], secondary: ['biceps', 'rear_delts'], equipment: ['bodyweight'], compound: true, startRatio: 0, increment: 0,
    description: 'A bodyweight row under a sturdy table or bar.',
    steps: ['Lie under a sturdy bar or table edge and grab it.', 'Keep your body straight and pull your chest up.', 'Lower slowly.'],
    mistakes: ['Hips sagging.'] }),

  // ── Squat / lunge ────────────────────────────────────────────
  ex({ id: 'back_squat', name: 'Barbell Back Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core', 'lower_back'], equipment: ['barbell'], compound: true, startRatio: 0.5, increment: 2.5, avoidWith: ['knee', 'back'],
    description: 'The main lower-body strength lift.',
    steps: ['Set the bar on your upper back in a rack and step out.', 'Feet shoulder-width, toes slightly out.', 'Brace your core and sit down between your hips until thighs are about parallel.', 'Drive up through your whole foot.'],
    mistakes: ['Knees caving inward.', 'Heels lifting.', 'Rounding the lower back at the bottom.'] }),
  ex({ id: 'leg_press', name: 'Leg Press', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['machine'], compound: true, startRatio: 1.0, increment: 5,
    description: 'A machine squat pattern — heavy leg work without loading the spine.',
    steps: ['Sit with back flat against the pad, feet shoulder-width on the platform.', 'Release the safeties and lower the platform until knees are about 90°.', 'Press back up without locking your knees.'],
    mistakes: ['Lower back rounding off the pad at the bottom.', 'Locking knees at the top.'] }),
  ex({ id: 'goblet_squat', name: 'Goblet Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], equipment: ['dumbbell'], compound: true, startRatio: 0.2, increment: 2, avoidWith: ['knee'],
    description: 'A squat holding one dumbbell at your chest — great for learning squat form.',
    steps: ['Hold a dumbbell vertically against your chest.', 'Feet shoulder-width, toes slightly out.', 'Squat down keeping your chest up.', 'Stand back up.'],
    mistakes: ['Leaning far forward.', 'Knees caving in.'] }),
  ex({ id: 'hack_squat', name: 'Hack Squat Machine', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], equipment: ['machine'], compound: true, startRatio: 0.5, increment: 5, avoidWith: ['knee'],
    description: 'A guided squat that emphasises the quads.',
    steps: ['Stand on the platform with shoulders under the pads.', 'Release the safety and lower until thighs are about parallel.', 'Push back up.'],
    mistakes: ['Feet too low on the platform for your knees.'] }),
  ex({ id: 'bodyweight_squat', name: 'Bodyweight Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: [], equipment: ['bodyweight'], compound: true, startRatio: 0, increment: 0,
    description: 'A basic squat with no load.',
    steps: ['Stand with feet shoulder-width.', 'Sit back and down, arms forward for balance.', 'Stand up.'],
    mistakes: ['Heels lifting.'] }),
  ex({ id: 'walking_lunge', name: 'Dumbbell Walking Lunge', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors'], equipment: ['dumbbell'], compound: true, startRatio: 0.1, increment: 2, perHand: true, avoidWith: ['knee'],
    description: 'A single-leg exercise that builds legs and balance.',
    steps: ['Hold dumbbells at your sides.', 'Step forward and lower your back knee toward the floor.', 'Push through the front heel and step through into the next lunge.'],
    mistakes: ['Front knee caving inward.', 'Steps too short.'] }),
  ex({ id: 'split_squat', name: 'Bulgarian Split Squat', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['adductors'], equipment: ['dumbbell', 'bench'], compound: true, startRatio: 0.08, increment: 2, perHand: true, avoidWith: ['knee'],
    description: 'A rear-foot-elevated split squat — tough but very effective.',
    steps: ['Stand in front of a bench and place one foot behind you on it.', 'Lower straight down until the front thigh is about parallel.', 'Drive back up through the front foot.'],
    mistakes: ['Standing too close to the bench.'] }),

  // ── Hinge / hip ──────────────────────────────────────────────
  ex({ id: 'romanian_deadlift', name: 'Romanian Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['lower_back'], equipment: ['barbell'], compound: true, startRatio: 0.5, increment: 2.5, avoidWith: ['back'],
    description: 'A hip hinge that builds the hamstrings and glutes.',
    steps: ['Hold the bar at hip height with a shoulder-width grip.', 'Push your hips back with a slight knee bend, sliding the bar down your thighs.', 'Stop when you feel a strong hamstring stretch (usually mid-shin).', 'Drive hips forward to stand tall.'],
    mistakes: ['Rounding the back.', 'Turning it into a squat by bending the knees a lot.'] }),
  ex({ id: 'db_rdl', name: 'Dumbbell Romanian Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['lower_back'], equipment: ['dumbbell'], compound: true, startRatio: 0.15, increment: 2, perHand: true, avoidWith: ['back'],
    description: 'A Romanian deadlift with dumbbells.',
    steps: ['Hold dumbbells in front of your thighs.', 'Push hips back, keeping the dumbbells close to your legs.', 'Stop at a strong hamstring stretch and stand back up.'],
    mistakes: ['Dumbbells drifting away from the legs.', 'Rounding the back.'] }),
  ex({ id: 'hip_thrust', name: 'Barbell Hip Thrust', pattern: 'hip_thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['barbell', 'bench'], compound: true, startRatio: 0.5, increment: 5,
    description: 'The best direct glute builder.',
    steps: ['Sit with upper back against a bench and a padded bar over your hips.', 'Feet flat, about hip-width.', 'Drive your hips up until your body is straight from shoulders to knees.', 'Squeeze glutes at the top and lower.'],
    mistakes: ['Over-arching the lower back at the top.'] }),
  ex({ id: 'glute_bridge', name: 'Glute Bridge', pattern: 'hip_thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['bodyweight'], compound: true, startRatio: 0, increment: 0,
    description: 'A floor-based hip extension for the glutes.',
    steps: ['Lie on your back, knees bent, feet flat.', 'Drive through your heels to lift your hips.', 'Squeeze at the top, then lower.'],
    mistakes: ['Pushing through the toes.'] }),

  // ── Knee extension / flexion / calves ────────────────────────
  ex({ id: 'leg_extension', name: 'Leg Extension', pattern: 'knee_extension', primary: ['quads'], secondary: [], equipment: ['machine'], startRatio: 0.25, increment: 2.5,
    description: 'Isolates the quads.',
    steps: ['Sit with the pad on your lower shins and knees in line with the machine pivot.', 'Straighten your legs to lift the pad.', 'Lower slowly.'],
    mistakes: ['Swinging the weight up.', 'Seat position misaligned with knee.'] }),
  ex({ id: 'sissy_squat', name: 'Assisted Sissy Squat', pattern: 'knee_extension', primary: ['quads'], secondary: [], equipment: ['bodyweight'], startRatio: 0, increment: 0, avoidWith: ['knee'],
    description: 'A bodyweight quad isolation holding onto support.',
    steps: ['Hold a sturdy support.', 'Rise onto your toes and lean back as you bend your knees forward.', 'Go as low as comfortable and return.'],
    mistakes: ['Going deeper than your knees tolerate.'] }),
  ex({ id: 'lying_leg_curl', name: 'Lying Leg Curl', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: ['calves'], equipment: ['machine'], startRatio: 0.2, increment: 2.5,
    description: 'Isolates the hamstrings.',
    steps: ['Lie face down with the pad just above your heels.', 'Curl your heels toward your glutes.', 'Lower slowly.'],
    mistakes: ['Hips lifting off the pad.'] }),
  ex({ id: 'seated_leg_curl', name: 'Seated Leg Curl', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: [], equipment: ['machine'], startRatio: 0.25, increment: 2.5,
    description: 'A seated hamstring curl — often more comfortable than lying.',
    steps: ['Sit with the pad behind your lower legs and the thigh pad secure.', 'Curl your legs down and back.', 'Return slowly.'],
    mistakes: ['Thigh pad too loose.'] }),
  ex({ id: 'stability_ball_curl', name: 'Hamstring Slider Curl', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: ['glutes'], equipment: ['bodyweight'], startRatio: 0, increment: 0,
    description: 'A home hamstring curl using sliders, towels or a ball.',
    steps: ['Lie on your back with heels on towels/sliders.', 'Lift hips into a bridge.', 'Slide heels toward you, then slowly extend.'],
    mistakes: ['Hips dropping.'] }),
  ex({ id: 'standing_calf_raise', name: 'Standing Calf Raise', pattern: 'calf', primary: ['calves'], secondary: [], equipment: ['machine'], startRatio: 0.4, increment: 5,
    description: 'Builds the calves.',
    steps: ['Stand with the balls of your feet on the platform edge.', 'Lower your heels for a full stretch.', 'Rise up as high as you can and pause.'],
    mistakes: ['Bouncing.', 'Short range of motion.'] }),
  ex({ id: 'db_calf_raise', name: 'Dumbbell Calf Raise', pattern: 'calf', primary: ['calves'], secondary: [], equipment: ['dumbbell'], startRatio: 0.15, increment: 2, perHand: true,
    description: 'A calf raise holding dumbbells, on a step for more range.',
    steps: ['Stand on a step holding dumbbells.', 'Lower heels below the step.', 'Rise up high and pause.'],
    mistakes: ['Bouncing at the bottom.'] }),
  ex({ id: 'bodyweight_calf_raise', name: 'Single-Leg Calf Raise', pattern: 'calf', primary: ['calves'], secondary: [], equipment: ['bodyweight'], startRatio: 0, increment: 0,
    description: 'A bodyweight calf raise on one leg.',
    steps: ['Stand on one foot on a step, holding something for balance.', 'Lower the heel and rise up high.'],
    mistakes: ['Rushing reps.'] }),

  // ── Arms ─────────────────────────────────────────────────────
  ex({ id: 'db_curl', name: 'Dumbbell Bicep Curl', pattern: 'bicep_curl', primary: ['biceps'], secondary: ['forearms'], equipment: ['dumbbell'], startRatio: 0.08, increment: 1, perHand: true,
    description: 'The standard biceps builder.',
    steps: ['Stand holding dumbbells at your sides, palms forward.', 'Curl the weights up keeping elbows by your sides.', 'Lower slowly to full extension.'],
    mistakes: ['Swinging the body.', 'Elbows drifting forward.', 'Not straightening the arm at the bottom.'] }),
  ex({ id: 'cable_curl', name: 'Cable Bicep Curl', pattern: 'bicep_curl', primary: ['biceps'], secondary: ['forearms'], equipment: ['cable'], startRatio: 0.15, increment: 2.5,
    description: 'A biceps curl with constant cable tension.',
    steps: ['Attach a straight bar to a low pulley.', 'Curl it up keeping elbows pinned.', 'Lower slowly.'],
    mistakes: ['Leaning back.'] }),
  ex({ id: 'hammer_curl', name: 'Hammer Curl', pattern: 'bicep_curl', primary: ['biceps', 'forearms'], secondary: [], equipment: ['dumbbell'], startRatio: 0.09, increment: 1, perHand: true,
    description: 'A curl with palms facing each other — hits biceps and forearms.',
    steps: ['Hold dumbbells with palms facing your body.', 'Curl up keeping the neutral grip.', 'Lower slowly.'],
    mistakes: ['Swinging.'] }),
  ex({ id: 'machine_curl', name: 'Machine Preacher Curl', pattern: 'bicep_curl', primary: ['biceps'], secondary: [], equipment: ['machine'], startRatio: 0.12, increment: 2.5,
    description: 'A supported curl that prevents cheating.',
    steps: ['Sit with upper arms on the pad.', 'Curl the handles up.', 'Lower slowly to almost straight.'],
    mistakes: ['Lifting your elbows off the pad.'] }),
  ex({ id: 'band_curl', name: 'Band Bicep Curl', pattern: 'bicep_curl', primary: ['biceps'], secondary: [], equipment: ['bands'], startRatio: 0, increment: 0,
    description: 'A biceps curl with a resistance band.',
    steps: ['Stand on the band and hold the ends.', 'Curl up keeping elbows by your sides.', 'Lower slowly.'],
    mistakes: ['Elbows moving forward.'] }),
  ex({ id: 'cable_pushdown', name: 'Cable Tricep Pushdown', pattern: 'tricep_extension', primary: ['triceps'], secondary: [], equipment: ['cable'], startRatio: 0.2, increment: 2.5,
    description: 'The go-to triceps isolation.',
    steps: ['Attach a rope or bar to a high pulley.', 'Elbows tucked at your sides, push down until arms are straight.', 'Let it rise slowly to about 90° at the elbow.'],
    mistakes: ['Elbows flaring or moving forward.', 'Leaning over the weight.'] }),
  ex({ id: 'db_overhead_extension', name: 'Dumbbell Overhead Tricep Extension', pattern: 'tricep_extension', primary: ['triceps'], secondary: [], equipment: ['dumbbell'], startRatio: 0.12, increment: 2, avoidWith: ['shoulder'],
    description: 'Stretches and trains the long head of the triceps.',
    steps: ['Hold one dumbbell with both hands overhead.', 'Lower it behind your head by bending your elbows.', 'Extend back up.'],
    mistakes: ['Elbows flaring wide.', 'Arching the lower back.'] }),
  ex({ id: 'bench_dip', name: 'Bench Dip', pattern: 'tricep_extension', primary: ['triceps'], secondary: ['chest', 'shoulders'], equipment: ['bench'], startRatio: 0, increment: 0, avoidWith: ['shoulder'],
    description: 'A bodyweight triceps exercise using a bench.',
    steps: ['Place hands on a bench behind you, legs out in front.', 'Lower by bending your elbows to about 90°.', 'Press back up.'],
    mistakes: ['Going too deep and straining the shoulders.'] }),
  ex({ id: 'band_pushdown', name: 'Band Tricep Pushdown', pattern: 'tricep_extension', primary: ['triceps'], secondary: [], equipment: ['bands'], startRatio: 0, increment: 0,
    description: 'A triceps pushdown with a band anchored high.',
    steps: ['Anchor the band overhead.', 'Elbows at sides, push down until straight.', 'Return slowly.'],
    mistakes: ['Elbows moving.'] }),
  ex({ id: 'close_grip_push_up', name: 'Close-Grip Push-Up', pattern: 'tricep_extension', primary: ['triceps'], secondary: ['chest'], equipment: ['bodyweight'], startRatio: 0, increment: 0,
    description: 'A push-up with hands close together to emphasise the triceps.',
    steps: ['Hands under your shoulders, elbows tucked.', 'Lower your chest to your hands.', 'Press up.'],
    mistakes: ['Elbows flaring.'] }),

  // ── Core / traps ─────────────────────────────────────────────
  ex({ id: 'plank', name: 'Plank', pattern: 'core', primary: ['core'], secondary: ['shoulders'], equipment: ['bodyweight'], startRatio: 0, increment: 0,
    description: 'Builds core stability. Log seconds held as "reps".',
    steps: ['Forearms on the floor, elbows under shoulders.', 'Body in a straight line from head to heels.', 'Brace your abs and hold.'],
    mistakes: ['Hips sagging or piking up.', 'Holding your breath.'] }),
  ex({ id: 'cable_crunch', name: 'Cable Crunch', pattern: 'core', primary: ['core'], secondary: [], equipment: ['cable'], startRatio: 0.25, increment: 2.5,
    description: 'A weighted ab crunch.',
    steps: ['Kneel facing a high pulley holding a rope beside your head.', 'Crunch down by curling your spine, bringing elbows toward knees.', 'Return slowly.'],
    mistakes: ['Pulling with arms.', 'Sitting back onto heels instead of crunching.'] }),
  ex({ id: 'hanging_knee_raise', name: 'Hanging Knee Raise', pattern: 'core', primary: ['core'], secondary: ['forearms'], equipment: ['pullup_bar'], startRatio: 0, increment: 0,
    description: 'A hanging core exercise.',
    steps: ['Hang from a bar.', 'Raise your knees toward your chest, curling your pelvis.', 'Lower slowly without swinging.'],
    mistakes: ['Swinging.'] }),
  ex({ id: 'dead_bug', name: 'Dead Bug', pattern: 'core', primary: ['core'], secondary: [], equipment: ['bodyweight'], startRatio: 0, increment: 0,
    description: 'A back-friendly core exercise.',
    steps: ['Lie on your back, arms up, knees bent at 90°.', 'Lower opposite arm and leg toward the floor while keeping your lower back flat.', 'Return and switch sides.'],
    mistakes: ['Lower back arching off the floor.'] }),
  ex({ id: 'db_shrug', name: 'Dumbbell Shrug', pattern: 'shrug', primary: ['traps'], secondary: ['forearms'], equipment: ['dumbbell'], startRatio: 0.2, increment: 2, perHand: true,
    description: 'Targets the upper traps.',
    steps: ['Hold heavy dumbbells at your sides.', 'Shrug your shoulders straight up toward your ears.', 'Pause and lower.'],
    mistakes: ['Rolling the shoulders.'] }),
];

export const EXERCISE_MAP: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
export const getExercise = (id: string): Exercise => EXERCISE_MAP[id] ?? EXERCISES[0];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', back: 'Back', lats: 'Lats', shoulders: 'Shoulders', rear_delts: 'Rear delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core', traps: 'Traps',
  lower_back: 'Lower back', adductors: 'Adductors',
};

/** Coarse groups people actually talk about ("legs", "arms"), used for recovery and NLP. */
export const MUSCLE_GROUPS: Record<string, Muscle[]> = {
  chest: ['chest'], pecs: ['chest'],
  back: ['back', 'lats'], lats: ['lats'],
  shoulders: ['shoulders', 'rear_delts'], delts: ['shoulders', 'rear_delts'],
  biceps: ['biceps'], bis: ['biceps'], triceps: ['triceps'], tris: ['triceps'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'], 'lower body': ['quads', 'hamstrings', 'glutes', 'calves'],
  quads: ['quads'], hamstrings: ['hamstrings'], hams: ['hamstrings'], glutes: ['glutes'], calves: ['calves'],
  core: ['core'], abs: ['core'],
  'upper body': ['chest', 'back', 'lats', 'shoulders', 'biceps', 'triceps'],
  push: ['chest', 'shoulders', 'triceps'], pull: ['back', 'lats', 'biceps', 'rear_delts'],
  'full body': ['chest', 'back', 'lats', 'shoulders', 'quads', 'hamstrings', 'glutes'],
};

/** Hours a muscle typically needs before being trained hard again. */
export const RECOVERY_HOURS: Record<Muscle, number> = {
  chest: 48, back: 48, lats: 48, shoulders: 48, rear_delts: 36, biceps: 36, triceps: 36, forearms: 24,
  quads: 72, hamstrings: 72, glutes: 72, calves: 36, core: 24, traps: 36, lower_back: 72, adductors: 48,
};

const has = (avail: Equipment[], need: Equipment[]) => need.every((e) => e === 'bodyweight' || avail.includes(e));

export function isAvailable(e: Exercise, equipment: Equipment[], limitations = ''): boolean {
  if (!has(equipment, e.equipment)) return false;
  const lim = limitations.toLowerCase();
  return !(e.avoidWith ?? []).some((k) => lim.includes(k));
}

/**
 * Alternatives that preserve the purpose of the original: same movement pattern first, then exercises sharing a
 * primary muscle. Filtered by equipment and injury notes when provided.
 */
export function alternativesFor(id: string, equipment?: Equipment[], limitations = '', excludeEquipment?: Equipment): Exercise[] {
  const base = getExercise(id);
  const ok = (e: Exercise) =>
    e.id !== id && (!equipment || isAvailable(e, equipment, limitations)) && (!excludeEquipment || !e.equipment.includes(excludeEquipment));
  const samePattern = EXERCISES.filter((e) => ok(e) && e.pattern === base.pattern);
  const overlap = EXERCISES.filter(
    (e) => ok(e) && e.pattern !== base.pattern && e.primary.some((m) => base.primary.includes(m)) && e.compound === base.compound,
  );
  return [...samePattern, ...overlap].slice(0, 6);
}

export function findExerciseByName(text: string): Exercise | undefined {
  const t = text.toLowerCase();
  const aliases: Record<string, string> = {
    'bench press': 'bench_press', bench: 'bench_press', 'chest press': 'machine_chest_press', 'dumbbell press': 'db_bench_press',
    'db press': 'db_bench_press', 'incline press': 'incline_db_press', 'shoulder press': 'db_shoulder_press', 'overhead press': 'overhead_press',
    ohp: 'overhead_press', 'lateral raise': 'db_lateral_raise', 'side raise': 'db_lateral_raise', 'face pull': 'face_pull',
    pulldown: 'lat_pulldown', 'lat pulldown': 'lat_pulldown', 'pull up': 'pull_up', 'pull-up': 'pull_up', pullup: 'pull_up',
    'assisted pull': 'assisted_pull_up', 'cable row': 'seated_cable_row', row: 'seated_cable_row', 'dumbbell row': 'db_row',
    squat: 'back_squat', squats: 'back_squat', 'leg press': 'leg_press', 'goblet squat': 'goblet_squat', lunge: 'walking_lunge',
    lunges: 'walking_lunge', rdl: 'romanian_deadlift', 'romanian deadlift': 'romanian_deadlift', deadlift: 'romanian_deadlift',
    'hip thrust': 'hip_thrust', 'leg extension': 'leg_extension', 'leg curl': 'lying_leg_curl', 'calf raise': 'standing_calf_raise',
    curl: 'db_curl', curls: 'db_curl', 'bicep curl': 'db_curl', 'hammer curl': 'hammer_curl', pushdown: 'cable_pushdown',
    'tricep pushdown': 'cable_pushdown', 'tricep extension': 'db_overhead_extension', 'push up': 'push_up', 'push-up': 'push_up',
    pushup: 'push_up', plank: 'plank', fly: 'cable_fly', flyes: 'cable_fly', 'pec deck': 'pec_deck', shrug: 'db_shrug',
  };
  const byName = [...EXERCISES].sort((a, b) => b.name.length - a.name.length).find((e) => t.includes(e.name.toLowerCase()));
  if (byName) return byName;
  const key = Object.keys(aliases).sort((a, b) => b.length - a.length).find((k) => new RegExp(`\\b${k}\\b`).test(t));
  return key ? EXERCISE_MAP[aliases[key]] : undefined;
}
