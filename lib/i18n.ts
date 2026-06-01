/**
 * Lightweight i18n. Two locales: en | ta.
 *
 * Strings are looked up by key. If the Tamil entry is missing, falls back to
 * English. Constituency names + district names are looked up by id/name.
 *
 * Locale persistence:
 *   - localStorage["tn-locale"]
 *   - synced to <html lang> via the LocaleProvider effect
 */

export type Locale = "en" | "ta";

export const LOCALES: { id: Locale; label: string; nativeLabel: string }[] = [
  { id: "en", label: "English", nativeLabel: "English" },
  { id: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
];

// ============= UI STRINGS =============
export const STRINGS: Record<string, { en: string; ta?: string }> = {
  // Header & nav
  "nav.overview": { en: "Overview", ta: "முகப்பு" },
  "nav.constituencies": { en: "Constituencies", ta: "தொகுதிகள்" },
  "nav.parties": { en: "Parties", ta: "கட்சிகள்" },
  "nav.anchor": { en: "Anchor", ta: "தொகுப்பாளர்" },
  "nav.admin": { en: "Admin", ta: "நிர்வாகம்" },
  "nav.broadcastAdmin": { en: "Backstage", ta: "பின்னணி" },
  "nav.broadcast": { en: "Broadcast", ta: "ஒளிபரப்பு" },
  "header.brand": { en: "TN Election Results", ta: "தமிழ்நாடு தேர்தல் முடிவுகள்" },
  "header.subtitle": { en: "2026 · Live Counting", ta: "2026 · நேரடி எண்ணிக்கை" },
  "header.live": { en: "LIVE", ta: "நேரடி" },
  "header.offline": { en: "OFFLINE", ta: "இணைப்பு துண்டிக்கப்பட்டது" },
  "header.updated": { en: "updated", ta: "புதுப்பிக்கப்பட்டது" },

  // Common labels
  "label.constituencies": { en: "Constituencies", ta: "தொகுதிகள்" },
  "label.constituency": { en: "Constituency", ta: "தொகுதி" },
  "label.district": { en: "District", ta: "மாவட்டம்" },
  "label.candidate": { en: "Candidate", ta: "வேட்பாளர்" },
  "label.candidates": { en: "Candidates", ta: "வேட்பாளர்கள்" },
  "label.votes": { en: "Votes", ta: "வாக்குகள்" },
  "label.voteShare": { en: "Vote share", ta: "வாக்கு சதவீதம்" },
  "label.margin": { en: "Margin", ta: "வித்தியாசம்" },
  "label.round": { en: "Round", ta: "சுற்று" },
  "label.totalRounds": { en: "Total rounds", ta: "மொத்த சுற்றுகள்" },
  "label.majority": { en: "Majority", ta: "பெரும்பான்மை" },
  "label.majorityMark": { en: "Majority mark", ta: "பெரும்பான்மை எண்" },
  "label.totalVotes": { en: "Total votes", ta: "மொத்த வாக்குகள்" },
  "label.alliance": { en: "Alliance", ta: "கூட்டணி" },
  "label.party": { en: "Party", ta: "கட்சி" },
  "label.declared": { en: "Declared", ta: "அறிவிக்கப்பட்டவை" },
  "label.counting": { en: "Counting", ta: "எண்ணப்படுகிறது" },
  "label.awaited": { en: "Awaited", ta: "எதிர்பார்ப்பு" },
  "label.reporting": { en: "Reporting", ta: "அறிவிப்பு" },
  "label.trends": { en: "Trends Available", ta: "போக்குகள்" },
  "label.election2026": { en: "Election 2026", ta: "தேர்தல் 2026" },
  "label.megaCoverage": { en: "Mega Coverage", ta: "சிறப்பு ஒளிபரப்பு" },
  "label.tnPollResults": { en: "Tamil Nadu Poll Results", ta: "தமிழ்நாடு தேர்தல் முடிவுகள்" },
  "label.liveFromChennai": { en: "Live from Chennai", ta: "சென்னையிலிருந்து நேரடி" },
  "label.singleConstituency": { en: "Single Constituency Focus", ta: "ஒற்றை தொகுதி கவனம்" },
  "label.flippedVs2021": { en: "Flipped vs 2021", ta: "2021 உடன் மாற்றம்" },
  "label.flipShort": { en: "FLIP", ta: "மாற்றம்" },

  // Status pills
  "status.pending": { en: "Awaited", ta: "எதிர்பார்ப்பு" },
  "status.counting": { en: "Counting", ta: "எண்ணப்படுகிறது" },
  "status.leading": { en: "Leading", ta: "முன்னிலை" },
  "status.won": { en: "Declared", ta: "அறிவிக்கப்பட்டது" },
  "status.called": { en: "Called", ta: "முடிவான முடிவு" },
  "status.likely": { en: "Likely", ta: "வாய்ப்பு" },
  "status.tooClose": { en: "Too Close", ta: "மிக நெருக்கம்" },

  // Hero card
  "hero.leadsWon": { en: "Leads / Won", ta: "முன்னிலை / வெற்றி" },
  "hero.leads": { en: "Leading", ta: "முன்னிலை" },
  "hero.won": { en: "Won", ta: "வெற்றி" },
  "hero.trailing": { en: "Trailing", ta: "பின்னிலை" },
  "hero.winner": { en: "WINNER", ta: "வெற்றியாளர்" },
  "hero.leadingCap": { en: "LEADING", ta: "முன்னிலை" },
  "hero.trailingCap": { en: "TRAILING", ta: "பின்னிலை" },
  "hero.majorityCrossed": { en: "Majority Crossed", ta: "பெரும்பான்மை கடந்தது" },
  "hero.majoritySecured": { en: "Majority Secured", ta: "பெரும்பான்மை உறுதி" },

  // Sections
  "section.leadingOverall": { en: "Overall lead", ta: "ஒட்டுமொத்த முன்னிலை" },
  "section.path": { en: "Path to majority", ta: "பெரும்பான்மை வரை" },
  "section.shortOfMajority": { en: "short of majority", ta: "பெரும்பான்மை குறைவு" },
  "section.tnAssembly": { en: "Tamil Nadu Legislative Assembly", ta: "தமிழ்நாடு சட்டப்பேரவை" },
  "section.seats": { en: "seats", ta: "இடங்கள்" },
  "section.decided": { en: "Decided / Total", ta: "முடிவு / மொத்தம்" },
  "section.topParties": { en: "Top Parties", ta: "முன்னணி கட்சிகள்" },
  "section.allianceRollup": { en: "Alliance Rollup", ta: "கூட்டணி ஒட்டுமொத்தம்" },
  "section.voteShare": { en: "Vote Share", ta: "வாக்கு சதவீதம்" },
  "section.closeRaces": { en: "Closest Races", ta: "நெருக்கடியான தொகுதிகள்" },
  "section.upsetsTitle": { en: "Biggest Upsets vs 2021", ta: "மிகப்பெரிய மாற்றங்கள் (2021 உடன்)" },
  "section.justDeclared": { en: "Just Declared", ta: "புதிதாக அறிவிக்கப்பட்டது" },
  "section.bellwethers": { en: "Bellwethers", ta: "முன்னறிவிக்கும் தொகுதிகள்" },
  "section.vips": { en: "Marquee Races", ta: "முக்கிய போட்டிகள்" },
  "section.storylines": { en: "Storylines · auto-detected", ta: "செய்தித்தலைப்புகள் · தானியங்கி" },
  "section.raceCalls": { en: "Race Calls (AP-style)", ta: "முடிவு முத்திரை" },
  "section.projection": { en: "Live Projection — if pattern holds", ta: "நேரடி கணிப்பு — தற்போதைய போக்கு தொடர்ந்தால்" },
  "section.projectionTitle": { en: "Final Seat Projection", ta: "இறுதி இடங்கள் கணிப்பு" },
  "section.ifPatternHolds": { en: "if pattern holds", ta: "போக்கு தொடர்ந்தால்" },
  "section.projectionBasis": {
    en: "Based on {pct}% of constituencies reporting",
    ta: "{pct}% தொகுதிகள் அறிக்கை அடிப்படையில்",
  },
  "section.swingometer": { en: "Swingometer", ta: "மாற்ற அளவி" },
  "section.swingMap": { en: "Swing Map", ta: "மாற்ற வரைபடம்" },
  "section.swingMapVs2021": { en: "Swing Map vs 2021", ta: "மாற்ற வரைபடம் (2021 உடன்)" },
  "section.vs2021": { en: "vs 2021", ta: "2021 உடன் ஒப்பீடு" },
  "section.allCounted": { en: "Counted from {pct}% of votes", ta: "{pct}% வாக்குகள் எண்ணப்பட்டது" },

  // Chyron templates
  "chyron.breaking": { en: "Breaking", ta: "சிறப்பு செய்தி" },
  "chyron.call": { en: "Key Call", ta: "முக்கிய முடிவு" },
  "chyron.milestone": { en: "Milestone", ta: "சாதனை" },
  "chyron.quote": { en: "Quote", ta: "மேற்கோள்" },

  // Confidence
  "conf.low": { en: "Low confidence — early data", ta: "குறைந்த நம்பகத்தன்மை — ஆரம்ப தரவு" },
  "conf.medium": { en: "Medium confidence", ta: "நடுத்தர நம்பகத்தன்மை" },
  "conf.high": { en: "High confidence", ta: "உயர் நம்பகத்தன்மை" },

  // Footer/help
  "help.cmdK": { en: "⌘K palette · ⌥1–9 scenes", ta: "⌘K தேடல் · ⌥1–9 காட்சிகள்" },

  // Swingometer
  "swing.subtitle": {
    en: "Drag the needle: applies a uniform swing to 2021 results to project seats.",
    ta: "ஊசலை இழு: 2021 முடிவுகளுக்கு சீரான மாற்றம் கொடுத்து இடங்களைக் கணிக்கிறது.",
  },
  "swing.resetLive": { en: "Reset to live", ta: "நேரடி நிலைக்கு" },
  "swing.aiadmkGain": { en: "← AIADMK gain", ta: "← அதிமுக ஆதாயம்" },
  "swing.dmkGain": { en: "DMK gain →", ta: "திமுக ஆதாயம் →" },
  "swing.uniform": {
    en: "Uniform Swing model · 234 seats · {n} for majority",
    ta: "சீரான மாற்ற மாதிரி · 234 இடங்கள் · பெரும்பான்மைக்கு {n}",
  },

  // Swing map
  "swingMap.subtitle": {
    en: "234 ACs · colored by current leader · yellow outline = flipped vs 2021",
    ta: "234 தொகுதிகள் · தற்போதைய முன்னிலை வண்ணம் · மஞ்சள் கோடு = 2021 உடன் மாற்றம்",
  },

  // VIP tracker
  "vips.subtitle": {
    en: "Marquee races · candidates to watch",
    ta: "முக்கிய போட்டிகள் · கவனிக்க வேண்டிய வேட்பாளர்கள்",
  },

  // Close races
  "close.subtitle": {
    en: "Closest margins · could go either way",
    ta: "மிக நெருக்கமான வித்தியாசங்கள் · எப்படியும் முடியலாம்",
  },

  // Upsets
  "upsets.subtitle": {
    en: "Seats flipping vs 2021 — biggest changes first",
    ta: "2021 உடன் மாற்றம் — மிகப்பெரிய மாற்றங்கள் முதலில்",
  },
  "upsets.was": { en: "was", ta: "முன்பு" },
  "upsets.now": { en: "now", ta: "இப்போது" },

  // Bellwethers
  "bellwether.subtitle": {
    en: "Constituencies that historically picked the winning side",
    ta: "வரலாற்று ரீதியாக வெற்றியாளரை தேர்வு செய்த தொகுதிகள்",
  },
  "bellwether.awaiting": { en: "Awaiting", ta: "எதிர்பார்ப்பு" },

  // Scenes
  "scene.hero": { en: "Hero", ta: "முகப்பு" },
  "scene.projection": { en: "Projection", ta: "கணிப்பு" },
  "scene.leaders": { en: "Leaderboard", ta: "தலைவர் பட்டியல்" },
  "scene.swing": { en: "Swingometer", ta: "மாற்ற அளவி" },
  "scene.swingmap": { en: "Swing Map", ta: "மாற்ற வரைபடம்" },
  "scene.vips": { en: "VIPs", ta: "முக்கிய நபர்கள்" },
  "scene.closest": { en: "Closest", ta: "நெருக்கடி" },
  "scene.upsets": { en: "Upsets", ta: "மாற்றங்கள்" },
  "scene.bellwether": { en: "Bellwether", ta: "முன்னறிவிப்பு" },
  "scene.ticker": { en: "Ticker", ta: "செய்தி பட்டை" },
  "scene.single-ac": { en: "Single AC", ta: "ஒரு தொகுதி" },
  "scene.knife": { en: "Knife edge", ta: "நெருக்கடி போட்டிகள்" },
  "scene.regions": { en: "Regional", ta: "மண்டல சுருக்கம்" },
  "scene.majority-timer": { en: "Majority ETA", ta: "118 அடைய நேரம்" },
  "scene.recent-map": { en: "Last rounds", ta: "சமீபத்திய சுற்றுகள்" },
  "scene.trajectory": { en: "Trajectory", ta: "சுற்று வளர்ச்சி" },
  "scene.incumbents": { en: "Incumbents", ta: "தற்போதைய எம்எல்ஏ" },
  "scene.flips": { en: "Leader flips", ta: "தலைமை மாற்றங்கள்" },

  // Storyline templates — headlines
  "story.firstResult": {
    en: "FIRST RESULT: {ac}",
    ta: "முதல் முடிவு: {ac}",
  },
  "story.firstResultSub": {
    en: "{name} ({party}) declared winner",
    ta: "{name} ({party}) வெற்றியாளராக அறிவிக்கப்பட்டது",
  },
  "story.majorityCrossed": {
    en: "{party} CROSSES {n} — MAJORITY SECURED",
    ta: "{party} {n} தாண்டியது — பெரும்பான்மை உறுதி",
  },
  "story.majoritySub": {
    en: "{total} of {grandTotal} seats",
    ta: "{total} / {grandTotal} இடங்கள்",
  },
  "story.tvkOpens": {
    en: "TVK OPENS ACCOUNT IN TN ASSEMBLY",
    ta: "தமிழக சட்டப்பேரவையில் தவெக கணக்கு திறக்கிறது",
  },
  "story.tvkOpensSub": {
    en: "Vijay's party wins first seat in maiden polls",
    ta: "விஜய்யின் கட்சி முதல் தேர்தலில் முதல் இடம் வென்றது",
  },
  "story.ntkOpens": {
    en: "NTK OPENS ACCOUNT — SEEMAN'S BREAKTHROUGH",
    ta: "நாதக கணக்கு திறக்கிறது — செந்தமிழன் சீமனின் சாதனை",
  },
  "story.ntkOpensSub": {
    en: "Naam Tamilar Katchi wins first ever assembly seat",
    ta: "நாம் தமிழர் கட்சி முதல் முறையாக சட்டப்பேரவை இடம் வெற்றி",
  },
  "story.upsetWatch": {
    en: "UPSET WATCH: {name} TRAILING",
    ta: "எச்சரிக்கை: {name} பின்னிலை",
  },
  "story.upsetWatchSub": {
    en: "{role} behind in {ac}",
    ta: "{role} {ac} தொகுதியில் பின்னிலை",
  },
  "story.vipWins": {
    en: "{name} WINS {ac}",
    ta: "{name} {ac} தொகுதியை வென்றார்",
  },
  "story.vipLost": {
    en: "STUNNER: {name} LOSES {ac}",
    ta: "திகைப்பூட்டும் முடிவு: {name} {ac} தொகுதியில் தோல்வி",
  },
  "story.vipLostSub": {
    en: "{role} defeated by {winner} ({party})",
    ta: "{role} தோல்வி — வெற்றியாளர் {winner} ({party})",
  },
  "story.bellwetherFlip": {
    en: "BELLWETHER FLIPS: {ac} {old}→{new}",
    ta: "முன்னறிவிப்பு மாற்றம்: {ac} {old}→{new}",
  },
  "story.bellwetherFlipSub": {
    en: "Historic predictor now leans {party}",
    ta: "வரலாற்று முன்னறிவி இப்போது {party} சார்பாக",
  },
  "story.callMilestone": {
    en: "{n} RACES CALLED",
    ta: "{n} தொகுதிகள் முடிவானது",
  },
  "story.callMilestone100Sub": {
    en: "Counting milestone · {n} mathematical certainties",
    ta: "எண்ணிக்கை மைல்கல் · {n} கணித உறுதி முடிவுகள்",
  },
  "story.callMilestone200Sub": {
    en: "Final stretch — {remaining} seats remaining",
    ta: "இறுதி கட்டம் — {remaining} இடங்கள் மீதம்",
  },

  // Ticker / live updates
  "ticker.breaking": { en: "Breaking", ta: "சிறப்பு செய்தி" },
  "ticker.justDeclared": { en: "Just Declared", ta: "புதிதாக அறிவிக்கப்பட்டது" },
  "ticker.tightestRaces": { en: "Tightest Races", ta: "மிக நெருக்கமான போட்டிகள்" },
  "ticker.leaderboard": { en: "Leaderboard", ta: "தலைவர் பட்டியல்" },

  // Vote share donut
  "voteShare.countedFromPct": {
    en: "Counted from {pct}% of votes",
    ta: "வாக்குகளில் {pct}% எண்ணப்பட்டது",
  },
  "voteShare.awaitingData": { en: "Awaiting data", ta: "தரவு எதிர்பார்ப்பு" },
  "voteShare.noData": { en: "No data yet", ta: "தரவு இன்னும் இல்லை" },

  // Race-call rollup
  "call.title": { en: "AP-style Race Calls", ta: "முடிவு முத்திரை · AP-பாணி" },
  "call.subtitle": {
    en: "Mathematical certainty — uncatchable margins flagged automatically",
    ta: "கணித உறுதி — பின்னேற முடியாத வித்தியாசங்கள் தானாக குறிக்கப்படுகின்றன",
  },
  "call.called": { en: "Called", ta: "முடிவு" },
  "call.likely": { en: "Likely", ta: "வாய்ப்பு" },
  "call.leaning": { en: "Leaning", ta: "சார்பு" },
  "call.tooClose": { en: "Too Close", ta: "மிக நெருக்கம்" },
  "call.explanation": {
    en: "A race is called when the trailing candidate cannot mathematically catch up given remaining rounds.",
    ta: "மீதமுள்ள சுற்றுகளில் கணித ரீதியாக பின்னிற்கும் வேட்பாளரால் முன்னேற முடியாது என்று உறுதியாகும்போது ஒரு போட்டி முடிவு என அறிவிக்கப்படுகிறது.",
  },

  // Headline stats
  "headline.roundsCounted": { en: "Rounds Counted", ta: "சுற்றுகள் எண்ணப்பட்டது" },

  // Command palette
  "palette.placeholder": {
    en: "Type a constituency, candidate, party, or scene…",
    ta: "தொகுதி, வேட்பாளர், கட்சி, அல்லது காட்சி தேடவும்…",
  },
  "palette.scenes": { en: "Scenes", ta: "காட்சிகள்" },
  "palette.constituencies": { en: "Constituencies", ta: "தொகுதிகள்" },
  "palette.candidates": { en: "Candidates", ta: "வேட்பாளர்கள்" },
  "palette.parties": { en: "Parties", ta: "கட்சிகள்" },
  "palette.empty": { en: "No matches", ta: "பொருத்தம் இல்லை" },

  // Round chart / flip
  "flip.label": { en: "FLIP", ta: "மாற்றம்" },
  "round.empty": { en: "No rounds counted yet.", ta: "இன்னும் சுற்றுகள் எண்ணப்படவில்லை." },
  "round.legend": {
    en: "Each box is a round, coloured by the party leading that round. Orange border marks a lead change.",
    ta: "ஒவ்வொரு பெட்டியும் ஒரு சுற்று — அந்த சுற்றில் முன்னிலை வகித்த கட்சியின் வண்ணம். ஆரஞ்சு கோடு முன்னிலை மாற்றம்.",
  },

  // Storylines panel chrome
  "storylines.title": { en: "Storylines · auto-detected", ta: "செய்தித்தலைப்புகள் · தானியங்கி" },
  "storylines.titleShort": { en: "Storylines", ta: "செய்தித்தலைப்புகள்" },
  "storylines.empty": { en: "Waiting for first major event...", ta: "முதல் முக்கிய நிகழ்வுக்காக காத்திருக்கிறது..." },
  "storylines.events": { en: "events", ta: "நிகழ்வுகள்" },
  "storylines.take": { en: "Take ↗", ta: "ஒளிபரப்பு ↗" },

  // Just-declared feed
  "justDeclared.title": { en: "Just declared", ta: "இப்போது அறிவித்தது" },
  "justDeclared.empty": { en: "No seats declared yet — counting underway.", ta: "இன்னும் எந்த இடமும் அறிவிக்கப்படவில்லை — எண்ணிக்கை நடக்கிறது." },
  "justDeclared.copyTitle": { en: "Copy line for chyron / tweet", ta: "செய்திக்கான வரியை நகலெடு" },

  // Counting velocity
  "velocity.title": { en: "Counting velocity", ta: "எண்ணிக்கை வேகம்" },
  "velocity.last60": { en: "Last 60 min", ta: "கடந்த 60 நிமி" },
  "velocity.updates": { en: "Updates", ta: "புதுப்பிப்புகள்" },
  "velocity.declared": { en: "Declared", ta: "அறிவித்தவை" },
  "velocity.activeNow": { en: "Active now", ta: "தற்போது இயங்கும்" },
  "velocity.minShort": { en: "m", ta: "நி" },
  "velocity.now": { en: "now", ta: "இப்போது" },

  // Majority / path-to-majority
  "majority.pathFor": { en: "Path to majority for", ta: "பெரும்பான்மை வழி" },
  "majority.crossed": { en: "Majority crossed", ta: "பெரும்பான்மை கடந்தது" },
  "majority.moreNeeded": { en: "more needed", ta: "மேலும் தேவை" },

  // Projection
  "projection.range": { en: "Range", ta: "வரம்பு" },
  "projection.awaitingHeadline": {
    en: "Projection unavailable — too thin",
    ta: "முன்னறிவு கிடைக்கவில்லை — தரவு பற்றாக்குறை",
  },
  "projection.awaitingDetail": {
    en: "Need at least 10% of ACs reporting before uniform-swing seat projection is meaningful.",
    ta: "சீரான மாற்ற முன்னறிவு பொருத்தமாக இருக்க குறைந்தது 10% தொகுதிகள் அறிவிப்பு தேவை.",
  },

  // Anchor cue cards
  "anchor.title": { en: "Anchor cue cards", ta: "தொகுப்பாளர் வரிகள்" },
  "anchor.eyebrow": { en: "Top 3 storylines · right now", ta: "முதல் 3 செய்திகள் · இப்போது" },
  "anchor.connecting": { en: "Connecting…", ta: "இணைக்கிறது…" },
  "anchor.awaiting": { en: "Awaiting first declarations…", ta: "முதல் அறிவிப்புகளுக்காக காத்திருக்கிறது…" },
  "anchor.autoRefresh": { en: "Auto-refreshes", ta: "தானாக புதுப்பிக்கிறது" },
  "anchor.copy": { en: "Copy", ta: "நகலெடு" },
  "anchor.kind.declared": { en: "Latest call", ta: "அண்மைய அறிவிப்பு" },
  "anchor.kind.close": { en: "Tightest race", ta: "மிக நெருக்கமான போட்டி" },
  "anchor.kind.swing": { en: "Path to power", ta: "ஆட்சிக்கான பாதை" },
  "anchor.kind.majority": { en: "Majority moment", ta: "பெரும்பான்மை தருணம்" },
  "anchor.kind.flip": { en: "Flip", ta: "மாற்றம்" },
  "anchor.kind.intro": { en: "Open with this", ta: "இதனுடன் தொடங்கு" },
  "anchor.kind.swingometer": {
    en: "Swingometer reading",
    ta: "ஸ்விங்கோமீட்டர் வாசிப்பு",
  },
  "anchor.swingometer.thinData": {
    en: "Reporting under 10% — needle is directional only, no projection yet.",
    ta: "10%க்கும் குறைவான தகவல் — ஊசி திசைக் காட்டுகிறது, கணிப்பு இல்லை.",
  },
  "anchor.guide.title": {
    en: "How to read the swingometer (anchor crib sheet)",
    ta: "ஸ்விங்கோமீட்டரை எப்படி வாசிக்கணும் (தொகுப்பாளர் குறிப்பு)",
  },
  "anchor.guide.subtitle": {
    en: "Open this on a second tab during the show — refresher for the on-camera narration.",
    ta: "நிகழ்ச்சியின் போது மற்றொரு தாளில் திறக்கவும் — காமராவில் சொல்வதற்கு குறிப்பு.",
  },

  // Page chrome (constituencies / parties)
  "page.loading": { en: "Loading…", ta: "ஏற்றுகிறது…" },
  "page.constituencies.title": { en: "All Constituencies", ta: "அனைத்து தொகுதிகள்" },
  "page.constituencies.subtitle": {
    en: "Search, filter, or jump straight to a constituency. Live updates on every result.",
    ta: "தொகுதிகளில் தேடவும், வடிகட்டவும் அல்லது நேரடியாக ஒரு தொகுதிக்கு செல்லவும். ஒவ்வொரு முடிவிலும் நேரடி புதுப்பிப்புகள்.",
  },
  "page.parties.title": { en: "Parties & Alliances", ta: "கட்சிகள் & கூட்டணிகள்" },
  "page.parties.subtitle": {
    en: "Leads & wins across every contesting party. Compared against 2021.",
    ta: "ஒவ்வொரு கட்சியின் முன்னிலை மற்றும் வெற்றிகள். 2021 உடன் ஒப்பீடு.",
  },

  // Table / filters
  "table.shown": { en: "{n} of {total} shown", ta: "{total} இல் {n} காட்டப்படுகிறது" },
  "table.searchPlaceholder": {
    en: "Search by name, district, candidate, or AC#",
    ta: "பெயர், மாவட்டம், வேட்பாளர் அல்லது தொகுதி எண் மூலம் தேடவும்",
  },
  "table.allParties": { en: "All parties", ta: "அனைத்து கட்சிகள்" },
  "table.noMatches": {
    en: "No constituencies match these filters.",
    ta: "இந்த வடிகட்டலுக்கு பொருந்தும் தொகுதிகள் இல்லை.",
  },
  "filter.all": { en: "All", ta: "அனைத்தும்" },
};

// ============= PARTIES =============
export const PARTY_NAMES_TA: Record<string, { name: string; full?: string; leader?: string; alliance?: string }> = {
  DMK: { name: "திமுக", full: "திராவிட முன்னேற்றக் கழகம்", leader: "மு. க. ஸ்டாலின்", alliance: "இந்தியா கூட்டணி" },
  AIADMK: { name: "அதிமுக", full: "அனைத்திந்திய அண்ணா திராவிட முன்னேற்றக் கழகம்", leader: "எடப்பாடி கே. பழனிசாமி", alliance: "தேமு கூட்டணி" },
  BJP: { name: "பாஜக", full: "பாரதீய ஜனதா கட்சி", leader: "நயினார் நாகேந்திரன்", alliance: "தேமு கூட்டணி" },
  INC: { name: "காங்கிரஸ்", full: "இந்திய தேசிய காங்கிரஸ்", leader: "கே. செல்வப்பெருந்தகை", alliance: "இந்தியா கூட்டணி" },
  TVK: { name: "தவெக", full: "தமிழக வெற்றிக் கழகம்", leader: "ஜோசப் விஜய்", alliance: "தனி" },
  NTK: { name: "நாதக", full: "நாம் தமிழர் கட்சி", leader: "செந்தமிழன் சீமன்", alliance: "தனி" },
  VCK: { name: "விசிக", full: "விடுதலை சிறுத்தைகள் கட்சி", leader: "தொல். திருமாவளவன்", alliance: "இந்தியா கூட்டணி" },
  PMK: { name: "பாமக", full: "பட்டாளி மக்கள் கட்சி", leader: "அன்புமணி ராமதாஸ்", alliance: "தேமு கூட்டணி" },
  DMDK: { name: "தேமுதிக", full: "தேசிய முற்போக்கு திராவிட கழகம்", leader: "பிரேமலதா விஜயகாந்த்", alliance: "மற்றவை" },
  MDMK: { name: "மதிமுக", full: "மறுமலர்ச்சி திராவிட முன்னேற்றக் கழகம்", leader: "வைகோ", alliance: "இந்தியா கூட்டணி" },
  CPI: { name: "சிபிஐ", full: "இந்திய கம்யூனிஸ்ட் கட்சி", leader: "ரா. முத்தரசன்", alliance: "இந்தியா கூட்டணி" },
  CPM: { name: "சிபிஎம்", full: "இந்திய கம்யூனிஸ்ட் கட்சி (மார்க்சிஸ்ட்)", leader: "கே. பாலகிருஷ்ணன்", alliance: "இந்தியா கூட்டணி" },
  IND: { name: "சுயேச்சை", full: "சுயேச்சை வேட்பாளர்", alliance: "சுயேச்சை" },
  OTH: { name: "மற்றவை", full: "மற்றவை", alliance: "மற்றவை" },
};

// ============= ALLIANCE LABELS =============
export const ALLIANCE_LABELS_TA: Record<string, string> = {
  INDIA: "மதச்சார்பற்ற முற்போக்கு கூட்டணி",
  NDA: "தேமு கூட்டணி",
  TVK: "தனி",
  NTK: "தனி",
  OTHERS: "மற்றவை",
  IND: "சுயேச்சை",
};

// ============= CONSTITUENCY NAMES =============
// Tamil names for the well-known constituencies. Others fall back to English.
export const CONSTITUENCY_NAMES_TA: Record<number, string> = {
  1: "கும்மிடிப்பூண்டி",
  2: "பொன்னேரி",
  3: "திருத்தணி",
  4: "திருவள்ளூர்",
  5: "பூந்தமல்லி",
  6: "ஆவடி",
  7: "மதுரவாயல்",
  8: "அம்பத்தூர்",
  9: "மாதவரம்",
  10: "திருவொற்றியூர்",
  11: "டாக்டர் ராதாகிருஷ்ணன் நகர்",
  12: "பெரம்பூர்",
  13: "கொளத்தூர்",
  14: "வில்லிவாக்கம்",
  15: "திரு-வி-க-நகர்",
  16: "எழும்பூர்",
  17: "ராயபுரம்",
  18: "துறைமுகம்",
  19: "சேப்பாக்கம்-திருவல்லிக்கேணி",
  20: "தௌசண்ட் லைட்ஸ்",
  21: "அண்ணா நகர்",
  22: "விருகம்பாக்கம்",
  23: "சைதாப்பேட்டை",
  24: "தி. நகர்",
  25: "மயிலாப்பூர்",
  26: "வேளச்சேரி",
  27: "சோழிங்கநல்லூர்",
  28: "ஆலந்தூர்",
  29: "ஸ்ரீபெரும்புதூர்",
  30: "பல்லாவரம்",
  31: "தாம்பரம்",
  32: "செங்கல்பட்டு",
  37: "காஞ்சிபுரம்",
  43: "வேலூர்",
  53: "கிருஷ்ணகிரி",
  55: "ஓசூர்",
  59: "தர்மபுரி",
  63: "திருவண்ணாமலை",
  74: "விழுப்புரம்",
  86: "எடப்பாடி",
  88: "சேலம் (மேற்கு)",
  89: "சேலம் (வடக்கு)",
  90: "சேலம் (தெற்கு)",
  94: "நாமக்கல்",
  98: "ஈரோடு (கிழக்கு)",
  99: "ஈரோடு (மேற்கு)",
  111: "திருப்பூர் (வடக்கு)",
  112: "திருப்பூர் (தெற்கு)",
  116: "கோயம்புத்தூர் (வடக்கு)",
  118: "கோயம்புத்தூர் (தெற்கு)",
  121: "பொள்ளாச்சி",
  124: "மடத்துகுளம்",
  144: "நாகப்பட்டினம்",
  149: "திருவாரூர்",
  152: "கும்பகோணம்",
  155: "தஞ்சாவூர்",
  161: "புதுக்கோட்டை",
  167: "சிவகங்கை",
  170: "மதுரை (கிழக்கு)",
  172: "மதுரை (வடக்கு)",
  173: "மதுரை (தெற்கு)",
  174: "மதுரை (மத்திய)",
  175: "மதுரை (மேற்கு)",
  181: "போடிநாயக்கனூர்",
  187: "விருதுநகர்",
  192: "ராமநாதபுரம்",
  195: "தூத்துக்குடி",
  205: "திருநெல்வேலி",
  207: "பாளையங்கோட்டை",
  211: "நாகர்கோவில்",
  217: "ஸ்ரீரங்கம்",
  218: "திருச்சிராப்பள்ளி (மேற்கு)",
  219: "திருச்சிராப்பள்ளி (கிழக்கு)",
  225: "கரூர்",
  229: "திண்டுக்கல்",
  234: "பழனி",
};

// ============= DISTRICT NAMES =============
export const DISTRICT_NAMES_TA: Record<string, string> = {
  Chennai: "சென்னை",
  Tiruvallur: "திருவள்ளூர்",
  Chengalpattu: "செங்கல்பட்டு",
  Kanchipuram: "காஞ்சிபுரம்",
  Vellore: "வேலூர்",
  Ranipet: "ராணிப்பேட்டை",
  Tirupathur: "திருப்பத்தூர்",
  Krishnagiri: "கிருஷ்ணகிரி",
  Dharmapuri: "தர்மபுரி",
  Tiruvannamalai: "திருவண்ணாமலை",
  Villupuram: "விழுப்புரம்",
  Kallakurichi: "கள்ளக்குறிச்சி",
  Salem: "சேலம்",
  Namakkal: "நாமக்கல்",
  Erode: "ஈரோடு",
  Nilgiris: "நீலகிரி",
  Coimbatore: "கோயம்புத்தூர்",
  Tiruppur: "திருப்பூர்",
  Karur: "கரூர்",
  Dindigul: "திண்டுக்கல்",
  Tiruchirappalli: "திருச்சிராப்பள்ளி",
  Perambalur: "பெரம்பலூர்",
  Ariyalur: "அரியலூர்",
  Cuddalore: "கடலூர்",
  Mayiladuthurai: "மயிலாடுதுறை",
  Nagapattinam: "நாகப்பட்டினம்",
  Tiruvarur: "திருவாரூர்",
  Thanjavur: "தஞ்சாவூர்",
  Pudukkottai: "புதுக்கோட்டை",
  Sivaganga: "சிவகங்கை",
  Madurai: "மதுரை",
  Theni: "தேனி",
  Virudhunagar: "விருதுநகர்",
  Ramanathapuram: "ராமநாதபுரம்",
  Thoothukudi: "தூத்துக்குடி",
  Tenkasi: "தென்காசி",
  Tirunelveli: "திருநெல்வேலி",
  Kanniyakumari: "கன்னியாகுமரி",
};

// ============= TRANSLATION FUNCTIONS =============

export function t(key: string, locale: Locale, replacements?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  if (!entry) return key; // missing key — show key for debugging
  let str = (locale === "ta" && entry.ta) || entry.en;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

export function tParty(partyId: string, locale: Locale, fallback: string): string {
  if (locale !== "ta") return fallback;
  return PARTY_NAMES_TA[partyId]?.name ?? fallback;
}

export function tPartyFull(partyId: string, locale: Locale, fallback: string): string {
  if (locale !== "ta") return fallback;
  return PARTY_NAMES_TA[partyId]?.full ?? fallback;
}

export function tPartyLeader(partyId: string, locale: Locale, fallback?: string): string {
  if (locale !== "ta") return fallback ?? "";
  return PARTY_NAMES_TA[partyId]?.leader ?? fallback ?? "";
}

export function tAlliance(partyId: string, locale: Locale, fallback: string): string {
  if (locale !== "ta") return fallback;
  return PARTY_NAMES_TA[partyId]?.alliance ?? fallback;
}

export function tAllianceById(allianceId: string, locale: Locale, fallback: string): string {
  if (locale !== "ta") return fallback;
  return ALLIANCE_LABELS_TA[allianceId] ?? fallback;
}

export function tConstituency(id: number, locale: Locale, fallback: string): string {
  if (locale !== "ta") return fallback;
  return CONSTITUENCY_NAMES_TA[id] ?? fallback;
}

export function tDistrict(name: string, locale: Locale): string {
  if (locale !== "ta") return name;
  return DISTRICT_NAMES_TA[name] ?? name;
}

export function tStatus(status: string, locale: Locale): string {
  return t(`status.${status}`, locale);
}

export function tSceneLabel(sceneId: string, locale: Locale): string {
  return t(`scene.${sceneId}`, locale);
}

export function tChyronTemplate(template: string, locale: Locale): string {
  return t(`chyron.${template.toLowerCase()}`, locale);
}
